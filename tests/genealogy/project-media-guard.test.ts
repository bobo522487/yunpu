import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { config } from "../../apps/api/src/config";
import { runMediaReconciliationGc } from "../../apps/api/src/modules/project/media-gc";
import {
  deleteObjects,
  getObject,
  initStorage,
  listObjects,
} from "../../apps/api/src/storage";
import { queryAllReferencedMediaKeys } from "../../scripts/gc-media";
import {
  createTenantCleanupTracker,
  request,
  signUp,
  uniqueEmail,
} from "../auth/fixtures";
import { call, createPerson, seedOwnerProject } from "./fixtures/helpers";

const VALID_IMAGE_SAMPLES = [
  {
    label: "PNG",
    contentType: "image/png",
    ext: "png",
    bytes: new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]),
  },
  {
    label: "JPEG",
    contentType: "image/jpeg",
    ext: "jpg",
    bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]),
  },
  {
    label: "WEBP",
    contentType: "image/webp",
    ext: "webp",
    bytes: new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x18, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      0x56, 0x50, 0x38, 0x20,
    ]),
  },
  {
    label: "GIF",
    contentType: "image/gif",
    ext: "gif",
    bytes: new TextEncoder().encode("GIF89a\x01\x00\x01\x00\x00\x00\x00;"),
  },
] as const;

describe("project media magic-byte guard, nosniff headers & reconciliation GC", () => {
  const uploadedKeysToCleanup: string[] = [];
  const cleanupTracker = createTenantCleanupTracker();

  beforeAll(async () => {
    const env = config();
    await initStorage({
      endpoint: env.S3_ENDPOINT,
      bucket: env.S3_BUCKET,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      region: env.S3_REGION,
    });
  });

  afterAll(async () => {
    if (uploadedKeysToCleanup.length > 0) {
      await deleteObjects(uploadedKeysToCleanup).catch(() => {});
    }
    await cleanupTracker.cleanup();
  });

  test("rejects spoofed Content-Type payloads and signature mismatches with 400 VALIDATION without storing to S3", async () => {
    const email = cleanupTracker.trackEmail(uniqueEmail("media-spoof"));
    const owner = await signUp(email);
    expect(owner.response.status).toBe(201);

    const orgRes = await call("/api/v1/organizations", owner.cookie, {
      method: "POST",
      body: JSON.stringify({ name: "media-spoof-org" }),
    });
    const organizationId = cleanupTracker.trackOrganization(
      (orgRes.data?.organization as { id: string }).id,
    );
    const projectRes = await call(
      `/api/v1/organizations/${organizationId}/projects`,
      owner.cookie,
      { method: "POST", body: JSON.stringify({ name: "media-spoof-proj" }) },
    );
    const projectId = (projectRes.data?.project as { id: string }).id;

    // 1. Spoofed Content-Type: image/png with HTML/SVG body
    for (const payload of [
      "<html><script>alert(1)</script></html>",
      "<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>",
      "plain-text-not-an-image",
    ]) {
      const res = await request(`/api/v1/projects/${projectId}/media`, {
        method: "POST",
        headers: {
          cookie: owner.cookie,
          "content-type": "image/png",
        },
        body: payload,
      });
      expect(res.status).toBe(400);
      const json = (await res.json()) as { ok: boolean; code: string };
      expect(json.ok).toBe(false);
      expect(json.code).toBe("VALIDATION");
    }

    // 2. Signature mismatch: JPEG bytes declared as image/png
    const jpegAsPng = await request(`/api/v1/projects/${projectId}/media`, {
      method: "POST",
      headers: {
        cookie: owner.cookie,
        "content-type": "image/png",
      },
      body: VALID_IMAGE_SAMPLES[1].bytes,
    });
    expect(jpegAsPng.status).toBe(400);
    const mismatchJson = (await jpegAsPng.json()) as {
      ok: boolean;
      code: string;
    };
    expect(mismatchJson.ok).toBe(false);
    expect(mismatchJson.code).toBe("VALIDATION");

    // 3. Ensure no object was written to S3 for any rejected upload
    const stored = await listObjects(`projects/${projectId}/`);
    expect(stored).toEqual([]);
  });

  test("accepts valid PNG/JPEG/WEBP/GIF uploads and serves downloads with nosniff and sandbox headers", async () => {
    const { cookie, organizationId, projectId } =
      await seedOwnerProject("media-valid");
    cleanupTracker.trackOrganization(organizationId);

    for (const sample of VALID_IMAGE_SAMPLES) {
      const upload = await request(`/api/v1/projects/${projectId}/media`, {
        method: "POST",
        headers: {
          cookie,
          "content-type": sample.contentType,
        },
        body: sample.bytes,
      });
      expect(upload.status, sample.label).toBe(201);
      const uploadJson = (await upload.json()) as {
        ok: boolean;
        data: { key: string; url: string };
      };
      expect(uploadJson.ok).toBe(true);
      expect(uploadJson.data.key.endsWith(`.${sample.ext}`)).toBe(true);
      uploadedKeysToCleanup.push(
        `projects/${projectId}/${uploadJson.data.key}`,
      );

      const download = await request(uploadJson.data.url, {
        headers: { cookie },
      });
      expect(download.status, sample.label).toBe(200);
      expect(download.headers.get("content-type")).toBe(sample.contentType);
      expect(download.headers.get("x-content-type-options")).toBe("nosniff");
      expect(download.headers.get("content-security-policy")).toBe(
        "default-src 'none'; sandbox",
      );
      expect(download.headers.get("content-disposition")).toBe(
        `inline; filename="${uploadJson.data.key}"`,
      );
      const downloadedBytes = new Uint8Array(await download.arrayBuffer());
      expect(Array.from(downloadedBytes)).toEqual(Array.from(sample.bytes));
    }
  });

  test("reconciliation GC only deletes unreferenced S3 objects past grace period against real PostgreSQL and S3", async () => {
    const { cookie, organizationId, projectId } =
      await seedOwnerProject("media-gc");
    cleanupTracker.trackOrganization(organizationId);

    const uploadImage = async (
      sample: (typeof VALID_IMAGE_SAMPLES)[number],
    ): Promise<string> => {
      const res = await request(`/api/v1/projects/${projectId}/media`, {
        method: "POST",
        headers: {
          cookie,
          "content-type": sample.contentType,
        },
        body: sample.bytes,
      });
      expect(res.status).toBe(201);
      const json = (await res.json()) as { data: { key: string } };
      uploadedKeysToCleanup.push(`projects/${projectId}/${json.data.key}`);
      return json.data.key;
    };

    // Upload referenced portrait, referenced project icon, and an unreferenced orphan at T0
    const referencedKey = await uploadImage(VALID_IMAGE_SAMPLES[0]);
    const projectIconKey = await uploadImage(VALID_IMAGE_SAMPLES[3]);
    const orphanOldKey = await uploadImage(VALID_IMAGE_SAMPLES[1]);

    // Attach referencedKey to a person in PostgreSQL
    const personRes = await createPerson(cookie, projectId, {
      displayName: "有像先祖",
      avatarKey: referencedKey,
    });
    expect(personRes.status).toBe(201);

    // Attach projectIconKey to project in PostgreSQL
    const projectGetRes = await call(`/api/v1/projects/${projectId}`, cookie);
    expect(projectGetRes.status).toBe(200);
    const currentProject = projectGetRes.data?.project as {
      version: number;
    };
    const patchProjectRes = await call(
      `/api/v1/projects/${projectId}`,
      cookie,
      {
        method: "PATCH",
        body: JSON.stringify({
          iconKey: projectIconKey,
          version: currentProject.version,
        }),
      },
    );
    expect(patchProjectRes.status).toBe(200);
    const patchedProject = patchProjectRes.data?.project as {
      iconKey: string | null;
    };
    expect(patchedProject.iconKey).toBe(projectIconKey);

    // Wait > 1.2s so S3 LastModified (1s granularity) separates old vs fresh uploads
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const orphanFreshKey = await uploadImage(VALID_IMAGE_SAMPLES[2]);

    const prefix = `projects/${projectId}/`;
    const listed = await listObjects(prefix);
    const byKey = new Map(listed.map((item) => [item.key, item]));
    const oldMtime = byKey.get(`${prefix}${orphanOldKey}`)?.lastModified;
    const freshMtime = byKey.get(`${prefix}${orphanFreshKey}`)?.lastModified;
    expect(oldMtime).toBeInstanceOf(Date);
    expect(freshMtime).toBeInstanceOf(Date);
    if (!oldMtime || !freshMtime) {
      throw new Error("expected LastModified on S3 objects");
    }

    const adminDbUrl = process.env.MIGRATE_DATABASE_URL ?? "";
    expect(adminDbUrl).toBeTruthy();

    // Non-BYPASSRLS role must be rejected to prevent silent empty-set deletion
    const appDbUrl = process.env.DATABASE_URL ?? "";
    await expect(queryAllReferencedMediaKeys(appDbUrl)).rejects.toThrow(
      /BYPASSRLS/i,
    );

    const gracePeriodMs = 60_000;
    const oldMs = oldMtime.getTime();
    const freshMs = freshMtime.getTime();

    if (freshMs > oldMs) {
      const effectiveNow = new Date(oldMs + gracePeriodMs);
      // 1. Dry-run reports candidate without deleting
      const dryRunReport = await runMediaReconciliationGc({
        prefix,
        gracePeriodMs,
        now: effectiveNow,
        dryRun: true,
        listObjects,
        listReferencedKeys: () => queryAllReferencedMediaKeys(adminDbUrl),
        deleteObjects,
      });
      expect(dryRunReport.deletedKeys).toEqual([]);
      expect(dryRunReport.orphanCandidateKeys).toEqual([
        `${prefix}${orphanOldKey}`,
      ]);
      expect(dryRunReport.activeCount).toBe(2);
      expect(dryRunReport.withinGraceCount).toBe(1);
      expect(await getObject(`${prefix}${orphanOldKey}`)).toBeDefined();

      // 2. Real GC deletes only orphanOld, preserving referencedKey, projectIconKey, and orphanFresh
      const liveReport = await runMediaReconciliationGc({
        prefix,
        gracePeriodMs,
        now: effectiveNow,
        dryRun: false,
        listObjects,
        listReferencedKeys: () => queryAllReferencedMediaKeys(adminDbUrl),
        deleteObjects,
      });
      expect(liveReport.deletedKeys).toEqual([`${prefix}${orphanOldKey}`]);
      expect(await getObject(`${prefix}${orphanOldKey}`)).toBeUndefined();
      expect(await getObject(`${prefix}${referencedKey}`)).toBeDefined();
      expect(await getObject(`${prefix}${projectIconKey}`)).toBeDefined();
      expect(await getObject(`${prefix}${orphanFreshKey}`)).toBeDefined();
    } else {
      // Fallback if S3 clock rounded both to the exact same second: still verify
      // grace-period exclusion vs expired deletion against real DB + S3.
      const withinGrace = await runMediaReconciliationGc({
        prefix,
        gracePeriodMs,
        now: new Date(oldMs + 1000),
        dryRun: false,
        listObjects,
        listReferencedKeys: () => queryAllReferencedMediaKeys(adminDbUrl),
        deleteObjects,
      });
      expect(withinGrace.deletedKeys).toEqual([]);
      expect(withinGrace.withinGraceCount).toBe(2);

      const expired = await runMediaReconciliationGc({
        prefix,
        gracePeriodMs,
        now: new Date(freshMs + gracePeriodMs),
        dryRun: false,
        listObjects,
        listReferencedKeys: () => queryAllReferencedMediaKeys(adminDbUrl),
        deleteObjects,
      });
      expect(expired.deletedKeys.sort()).toEqual(
        [`${prefix}${orphanFreshKey}`, `${prefix}${orphanOldKey}`].sort(),
      );
      expect(await getObject(`${prefix}${referencedKey}`)).toBeDefined();
      expect(await getObject(`${prefix}${projectIconKey}`)).toBeDefined();
    }
  });
});
