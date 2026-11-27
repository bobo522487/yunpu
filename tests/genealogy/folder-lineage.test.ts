import { beforeAll, describe, expect, test } from "vitest";
import { config } from "../../apps/api/src/config";
import { initStorage } from "../../apps/api/src/storage";
import {
  createOrganization,
  request,
  setOrganizationStatus,
  signUp,
  uniqueEmail,
  withAdminDb,
} from "../auth/fixtures";
import { call } from "../fixtures/http";
import { addMember } from "../fixtures/members";
import { seedOwnerProject } from "./fixtures/helpers";

describe("folder, lineage, ancestor & project media (genealogy)", () => {
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
  test("flat folder CRUD, duplicate conflict, and deleting folder unbinds lineages", async () => {
    const { cookie, projectId } = await seedOwnerProject("folder-crud");

    const f1 = await call(`/api/v1/projects/${projectId}/folders`, cookie, {
      method: "POST",
      body: JSON.stringify({ name: "总支系", seq: 1 }),
    });
    expect(f1.status).toBe(201);
    const folderId = (f1.data?.folder as { id: string }).id;

    const dup = await call(`/api/v1/projects/${projectId}/folders`, cookie, {
      method: "POST",
      body: JSON.stringify({ name: "总支系", seq: 2 }),
    });
    expect(dup.status).toBe(409);
    expect(dup.json.code).toBe("CONFLICT");

    const l1 = await call(`/api/v1/projects/${projectId}/lineages`, cookie, {
      method: "POST",
      body: JSON.stringify({
        name: "长房世系",
        folderId,
        surname: "陈",
        seq: 0,
      }),
    });
    expect(l1.status).toBe(201);
    const lineageId = (
      l1.data?.lineage as { id: string; folderId: string | null }
    ).id;
    expect((l1.data?.lineage as { folderId: string | null }).folderId).toBe(
      folderId,
    );

    const renamed = await call(
      `/api/v1/projects/${projectId}/folders/${folderId}`,
      cookie,
      {
        method: "PATCH",
        body: JSON.stringify({ name: "主支系", seq: 0 }),
      },
    );
    expect(renamed.status).toBe(200);
    expect((renamed.data?.folder as { name: string }).name).toBe("主支系");

    const removed = await call(
      `/api/v1/projects/${projectId}/folders/${folderId}`,
      cookie,
      { method: "DELETE" },
    );
    expect(removed.status).toBe(200);

    const directory = await call(
      `/api/v1/projects/${projectId}/lineages`,
      cookie,
    );
    expect(directory.status).toBe(200);
    expect((directory.data?.folders as unknown[]).length).toBe(0);
    const lineages = directory.data?.lineages as {
      id: string;
      folderId: string | null;
    }[];
    expect(lineages.length).toBe(1);
    expect(lineages[0]?.id).toBe(lineageId);
    expect(lineages[0]?.folderId).toBeNull();
  });

  test("lineage CRUD with CAS, progenitor auto-seeding, graph endpoint, and project ancestor", async () => {
    const owner = await signUp(uniqueEmail("lineage-owner"));
    const org = await createOrganization(owner.cookie, "开谱组织");
    const organizationId = (org.data?.organization as { id: string }).id;

    // Creating a project with ancestor atomically creates starter lineage + 1st-gen progenitor
    const createdProj = await call(
      `/api/v1/organizations/${organizationId}/projects`,
      owner.cookie,
      {
        method: "POST",
        body: JSON.stringify({
          name: "王氏宗谱",
          surname: "王",
          ancestor: "王太公",
          hallName: "三槐堂",
        }),
      },
    );
    expect(createdProj.status).toBe(201);
    const project = createdProj.data?.project as {
      id: string;
      ancestor: string | null;
    };
    expect(project.ancestor).toBe("王太公");

    const dir = await call(
      `/api/v1/projects/${project.id}/lineages`,
      owner.cookie,
    );
    expect(dir.status).toBe(200);
    const starterLineage = (
      dir.data?.lineages as {
        id: string;
        progenitor: string | null;
        version: number;
      }[]
    )[0];
    expect(starterLineage).toBeDefined();
    expect(starterLineage.progenitor).toBe("王太公");

    const starterGraph = await call(
      `/api/v1/projects/${project.id}/lineages/${starterLineage.id}/graph`,
      owner.cookie,
    );
    expect(starterGraph.status).toBe(200);
    const persons = starterGraph.data?.persons as {
      displayName: string;
      relationTitle: string | null;
      isLiving: boolean;
    }[];
    expect(persons.length).toBe(1);
    expect(persons[0]?.displayName).toBe("王太公");
    expect(persons[0]?.relationTitle).toBe("始祖");
    expect(persons[0]?.isLiving).toBe(false);

    // Create another lineage with progenitor & update with CAS
    const branch = await call(
      `/api/v1/projects/${project.id}/lineages`,
      owner.cookie,
      {
        method: "POST",
        body: JSON.stringify({
          name: "二房迁徙支系",
          surname: "王",
          progenitor: "王二公",
          region: {
            schemaVersion: 1,
            kind: "structured",
            country: "中国",
            province: "浙江省",
            city: "杭州市",
            originalText: "浙江杭州",
          },
          seq: 1,
        }),
      },
    );
    expect(branch.status).toBe(201);
    const branchLineage = branch.data?.lineage as {
      id: string;
      version: number;
    };
    expect(
      (branch.data?.progenitorPerson as { displayName: string }).displayName,
    ).toBe("王二公");

    const patched = await call(
      `/api/v1/projects/${project.id}/lineages/${branchLineage.id}`,
      owner.cookie,
      {
        method: "PATCH",
        body: JSON.stringify({
          name: "二房杭城支系",
          version: branchLineage.version,
        }),
      },
    );
    expect(patched.status).toBe(200);
    expect((patched.data?.lineage as { version: number }).version).toBe(2);

    const stale = await call(
      `/api/v1/projects/${project.id}/lineages/${branchLineage.id}`,
      owner.cookie,
      {
        method: "PATCH",
        body: JSON.stringify({ name: "旧版本", version: 1 }),
      },
    );
    expect(stale.status).toBe(409);
    expect(stale.json.code).toBe("VERSION_CONFLICT");

    const deletedBranch = await call(
      `/api/v1/projects/${project.id}/lineages/${branchLineage.id}`,
      owner.cookie,
      { method: "DELETE" },
    );
    expect(deletedBranch.status).toBe(200);

    // Physical project deletion cascades folder, lineage, and persons
    const deletedProj = await call(
      `/api/v1/projects/${project.id}`,
      owner.cookie,
      { method: "DELETE" },
    );
    expect(deletedProj.status).toBe(200);

    const counts = await withAdminDb(async (client) => {
      const l = await client.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM lineage WHERE project_id = $1",
        [project.id],
      );
      const p = await client.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM person WHERE project_id = $1",
        [project.id],
      );
      return { lineages: l.rows[0].n, persons: p.rows[0].n };
    });
    expect(counts.lineages).toBe(0);
    expect(counts.persons).toBe(0);
  });

  test("authenticated project media upload/read and RBAC / tenant isolation", async () => {
    const {
      cookie: ownerCookie,
      organizationId,
      projectId,
    } = await seedOwnerProject("media-rbac");
    const viewer = await addMember(
      organizationId,
      uniqueEmail("media-viewer"),
      "viewer",
    );
    const stranger = await signUp(uniqueEmail("media-stranger"));

    const folderReject = await call(
      `/api/v1/projects/${projectId}/folders`,
      viewer.cookie,
      { method: "POST", body: JSON.stringify({ name: "越权分组" }) },
    );
    expect(folderReject.status).toBe(403);
    expect(folderReject.json.code).toBe("FORBIDDEN");

    const strangerDirectory = await call(
      `/api/v1/projects/${projectId}/lineages`,
      stranger.cookie,
    );
    expect(strangerDirectory.status).toBe(404);

    // Editor+ uploads PNG portrait to project media
    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    const upload = await request(`/api/v1/projects/${projectId}/media`, {
      method: "POST",
      headers: {
        cookie: ownerCookie,
        "content-type": "image/png",
      },
      body: pngBytes,
    });
    expect(upload.status).toBe(201);
    const uploadJson = (await upload.json()) as {
      ok: boolean;
      data: { key: string; url: string };
    };
    expect(uploadJson.ok).toBe(true);
    expect(uploadJson.data.url).toBe(
      `/api/v1/projects/${projectId}/media/${uploadJson.data.key}`,
    );

    // Viewer can read uploaded portrait, cannot upload
    const viewerRead = await request(uploadJson.data.url, {
      headers: { cookie: viewer.cookie },
    });
    expect(viewerRead.status).toBe(200);
    expect(viewerRead.headers.get("content-type")).toBe("image/png");
    const readBytes = new Uint8Array(await viewerRead.arrayBuffer());
    expect(Array.from(readBytes)).toEqual(Array.from(pngBytes));

    const viewerUpload = await request(`/api/v1/projects/${projectId}/media`, {
      method: "POST",
      headers: {
        cookie: viewer.cookie,
        "content-type": "image/png",
      },
      body: pngBytes,
    });
    expect(viewerUpload.status).toBe(403);

    // Non-member receives 404
    const strangerRead = await request(uploadJson.data.url, {
      headers: { cookie: stranger.cookie },
    });
    expect(strangerRead.status).toBe(404);

    // Unsupported content-type receives 400
    const badMime = await request(`/api/v1/projects/${projectId}/media`, {
      method: "POST",
      headers: {
        cookie: ownerCookie,
        "content-type": "text/plain",
      },
      body: "not-an-image",
    });
    expect(badMime.status).toBe(400);

    // Archived organization rejects upload with 409
    await setOrganizationStatus(organizationId, "archived");
    const archivedUpload = await request(
      `/api/v1/projects/${projectId}/media`,
      {
        method: "POST",
        headers: {
          cookie: ownerCookie,
          "content-type": "image/png",
        },
        body: pngBytes,
      },
    );
    expect(archivedUpload.status).toBe(409);
  });
});
