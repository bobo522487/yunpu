import { AppError } from "@yunpu/shared";
import { describe, expect, test, vi } from "vitest";
import {
  runMediaReconciliationGc,
  toProjectMediaObjectKey,
} from "../src/modules/project/media-gc";
import {
  assertValidImageMagicBytes,
  buildMediaResponseHeaders,
  detectImageExtension,
  resolveDeclaredImageType,
} from "../src/modules/project/service";
import { parseGcArgs } from "../../../scripts/gc-media";

describe("project media magic-byte & header guards", () => {
  test("detectImageExtension identifies PNG, JPEG, WEBP, GIF87a, GIF89a", () => {
    expect(
      detectImageExtension(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe("png");
    expect(detectImageExtension(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      "jpg",
    );
    expect(
      detectImageExtension(
        new Uint8Array([
          0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42,
          0x50,
        ]),
      ),
    ).toBe("webp");
    expect(
      detectImageExtension(new TextEncoder().encode("GIF87a\x01\x00")),
    ).toBe("gif");
    expect(
      detectImageExtension(new TextEncoder().encode("GIF89a\x01\x00")),
    ).toBe("gif");
  });

  test("detectImageExtension rejects non-images and truncated headers", () => {
    expect(
      detectImageExtension(new TextEncoder().encode("<svg onload=alert(1)>")),
    ).toBeNull();
    expect(
      detectImageExtension(new TextEncoder().encode("<html>hi</html>")),
    ).toBeNull();
    expect(
      detectImageExtension(new Uint8Array([0x89, 0x50, 0x4e, 0x47])),
    ).toBeNull();
    expect(
      detectImageExtension(
        new Uint8Array([
          0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x41, 0x56, 0x49,
          0x20,
        ]),
      ),
    ).toBeNull();
  });

  test("assertValidImageMagicBytes rejects spoofed payloads and mismatched signatures with 400 VALIDATION", () => {
    const { ext } = resolveDeclaredImageType("image/png; charset=utf-8");
    expect(ext).toBe("png");

    try {
      assertValidImageMagicBytes(
        new TextEncoder().encode("<script>alert(1)</script>"),
        "png",
      );
      expect.unreachable("should throw AppError");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("VALIDATION");
      expect((error as AppError).status).toBe(400);
    }

    try {
      assertValidImageMagicBytes(
        new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
        "png",
      );
      expect.unreachable("should throw AppError");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("VALIDATION");
      expect((error as AppError).status).toBe(400);
    }
  });

  test("buildMediaResponseHeaders sets X-Content-Type-Options: nosniff and anti-sniffing CSP", () => {
    const headers = buildMediaResponseHeaders(
      "01900000-0000-7000-8000-000000000001.webp",
    );
    expect(headers["content-type"]).toBe("image/webp");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["content-security-policy"]).toBe(
      "default-src 'none'; sandbox",
    );
    expect(headers["content-disposition"]).toBe(
      'inline; filename="01900000-0000-7000-8000-000000000001.webp"',
    );
  });
});

describe("media reconciliation GC", () => {
  test("toProjectMediaObjectKey normalizes bare keys and URL paths", () => {
    expect(toProjectMediaObjectKey("proj-1", "abc.png")).toBe(
      "projects/proj-1/abc.png",
    );
    expect(toProjectMediaObjectKey("proj-1", "projects/proj-1/abc.png")).toBe(
      "projects/proj-1/abc.png",
    );
    expect(
      toProjectMediaObjectKey(
        "proj-1",
        "/api/v1/projects/proj-1/media/abc.png",
      ),
    ).toBe("projects/proj-1/abc.png");
    expect(toProjectMediaObjectKey("proj-1", "   ")).toBeNull();
  });

  test("runMediaReconciliationGc respects grace period, active references, and dry-run", async () => {
    const now = new Date("2026-11-27T12:00:00.000Z");
    const deleteObjects = vi.fn(async (keys: string[]) => keys);

    const baseObjects = [
      {
        key: "projects/p1/active-old.png",
        lastModified: new Date("2026-11-20T00:00:00.000Z"),
      },
      {
        key: "projects/p1/orphan-within-grace.png",
        lastModified: new Date("2026-11-27T11:30:00.000Z"),
      },
      {
        key: "projects/p1/orphan-no-mtime.png",
      },
      {
        key: "projects/p1/orphan-expired.jpg",
        lastModified: new Date("2026-11-25T00:00:00.000Z"),
      },
    ];
    const referenced = new Set(["projects/p1/active-old.png"]);

    const dryReport = await runMediaReconciliationGc({
      prefix: "projects/",
      gracePeriodMs: 2 * 3_600_000,
      now,
      dryRun: true,
      listObjects: async () => baseObjects,
      listReferencedKeys: async () => referenced,
      deleteObjects,
    });

    expect(dryReport).toEqual({
      prefix: "projects/",
      dryRun: true,
      gracePeriodMs: 2 * 3_600_000,
      scannedCount: 4,
      referencedCount: 1,
      activeCount: 1,
      withinGraceCount: 2,
      orphanCandidateKeys: ["projects/p1/orphan-expired.jpg"],
      deletedKeys: [],
    });
    expect(deleteObjects).not.toHaveBeenCalled();

    const liveReport = await runMediaReconciliationGc({
      prefix: "projects/",
      gracePeriodMs: 2 * 3_600_000,
      now,
      dryRun: false,
      listObjects: async () => baseObjects,
      listReferencedKeys: async () => referenced,
      deleteObjects,
    });

    expect(liveReport.deletedKeys).toEqual(["projects/p1/orphan-expired.jpg"]);
    expect(deleteObjects).toHaveBeenCalledWith([
      "projects/p1/orphan-expired.jpg",
    ]);
  });

  test("runMediaReconciliationGc rejects unsafe prefix or negative gracePeriodMs", async () => {
    await expect(
      runMediaReconciliationGc({
        prefix: "media/",
        gracePeriodMs: 0,
        dryRun: true,
        listObjects: async () => [],
        listReferencedKeys: async () => new Set(),
        deleteObjects: async () => [],
      }),
    ).rejects.toThrow(/projects\//);

    await expect(
      runMediaReconciliationGc({
        prefix: "projects/",
        gracePeriodMs: -1,
        dryRun: true,
        listObjects: async () => [],
        listReferencedKeys: async () => new Set(),
        deleteObjects: async () => [],
      }),
    ).rejects.toThrow(/non-negative/);
  });

  test("parseGcArgs parses --dry-run, --grace-hours, --grace-ms, and validates inputs", () => {
    const parsed = parseGcArgs([
      "--dry-run",
      "--grace-hours",
      "48",
      "--prefix",
      "projects/abc/",
      "--env",
      "test",
    ]);
    expect(parsed).toEqual({
      dryRun: true,
      gracePeriodMs: 48 * 3_600_000,
      prefix: "projects/abc/",
      env: "test",
      now: undefined,
      help: false,
    });

    expect(() => parseGcArgs(["--prefix", "other/"])).toThrow(/projects\//);
    expect(() => parseGcArgs(["--grace-hours", "-5"])).toThrow(
      /invalid grace hours/,
    );
  });
});
