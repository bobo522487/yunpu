import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, test, vi } from "vitest";
import { checkStorage, initStorage } from "../../apps/api/src/storage";

const requests: string[] = [];
const server = createServer((req, res) => {
  requests.push(`${req.method} ${req.url}`);
  res.writeHead(200);
  res.end();
});

describe("storage uses only the S3 SDK", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    requests.length = 0;
  });

  test("no hand-written SigV4, MinIO probe, or in-library exit remains", async () => {
    const source = await readFile(
      new URL("../../apps/api/src/storage.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toContain("createHmac");
    expect(source).not.toContain("x-amz-date");
    expect(source).not.toContain("/minio/health/live");
    expect(source).not.toContain("process.exit");
    expect(source).toContain("new HeadBucketCommand");
  });

  test("initStorage throws instead of exiting when the bucket is unavailable", async () => {
    await expect(
      initStorage({
        endpoint: "http://127.0.0.1:1",
        bucket: "yunpu-test",
        accessKeyId: "key",
        secretAccessKey: "secret",
        region: "us-east-1",
      }),
    ).rejects.toThrow(/storage init failed/);
  });

  test("a plain S3-compatible endpoint passes checkStorage via HeadBucket", async () => {
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const { port } = server.address() as AddressInfo;

    try {
      await initStorage({
        endpoint: `http://127.0.0.1:${port}`,
        bucket: "yunpu-test",
        accessKeyId: "key",
        secretAccessKey: "secret",
        region: "eu-central-1",
      });
      requests.length = 0;

      expect(await checkStorage()).toEqual({ up: true });
      expect(requests).toEqual(["HEAD /yunpu-test/"]);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
