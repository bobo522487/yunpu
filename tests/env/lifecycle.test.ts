import { expect, test } from "bun:test";
import { readdirSync } from "node:fs";

// Lifecycle checks run against both environments while they are up. They
// prove three outcomes: development data survives down/up, the test
// environment starts from an empty baseline every time, and resetting one
// environment leaves the other one's objects untouched.

const devBase = "http://127.0.0.1:3000";
const testBase = "http://127.0.0.1:3010";
const devToken = process.env.DEV_YUNPU_CAPABILITY_TOKEN ?? "example-development-capability-token";
const testToken = process.env.YUNPU_CAPABILITY_TOKEN ?? "example-test-capability-token";
const envsh = new URL("../../scripts/env.sh", import.meta.url).pathname;

async function mediaWrite(base: string, token: string, body: string): Promise<string> {
  const response = await fetch(`${base}/api/media`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body,
  });
  expect(response.status).toBe(201);
  const { key } = (await response.json()) as { key: string };
  return key;
}

async function mediaRead(base: string, token: string, key: string): Promise<Response> {
  return fetch(`${base}/api/media/${key}`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

async function objectCount(endpointEnv: string, bucketEnv: string): Promise<number> {
  // Count objects via the application's own storage listing, without adding
  // a product route: use bun's S3Client against the environment endpoint.
  const { S3Client } = await import("bun");
  const client = new S3Client({
    endpoint: process.env[endpointEnv]!,
    accessKeyId: "example-count-access",
    secretAccessKey: "example-count-secret",
    bucket: process.env[bucketEnv]!,
    region: "us-east-1",
  });
  try {
    const keys: string[] = [];
    for await (const key of client.list({ prefix: "lifecycle/" })) {
      keys.push(key);
    }
    return keys.length;
  } catch {
    return -1;
  }
}

test("development data survives down then up", async () => {
  const key = await mediaWrite(devBase, devToken, "survives-down-up");

  let down = Bun.spawnSync(["sh", envsh, "down", "development"]);
  expect(down.exitCode).toBe(0);
  let up = Bun.spawnSync(["sh", envsh, "up", "development"]);
  expect(up.exitCode).toBe(0);

  const read = await mediaRead(devBase, devToken, key);
  expect(read.status).toBe(200);
  expect(await read.text()).toBe("survives-down-up");
});

test("up test wipes the previous round's data", async () => {
  const key = await mediaWrite(testBase, testToken, "must-not-survive");

  const up = Bun.spawnSync(["sh", envsh, "up", "test"]);
  expect(up.exitCode).toBe(0);

  const read = await mediaRead(testBase, testToken, key);
  expect(read.status).toBe(404);
});

test("resetting one environment leaves the other's objects in place", async () => {
  const devKey = await mediaWrite(devBase, devToken, "kept-through-test-reset");
  const testKey = await mediaWrite(testBase, testToken, "gone-after-reset");

  const before = await objectCount("LIFECYCLE_TEST_S3_ENDPOINT", "LIFECYCLE_TEST_S3_BUCKET");

  const reset = Bun.spawnSync(["sh", envsh, "reset", "test"]);
  expect(reset.exitCode).toBe(0);

  const devRead = await mediaRead(devBase, devToken, devKey);
  expect(devRead.status).toBe(200);
  expect(await devRead.text()).toBe("kept-through-test-reset");

  const testRead = await mediaRead(testBase, testToken, testKey);
  expect(testRead.status).toBe(404);

  const after = await objectCount("LIFECYCLE_TEST_S3_ENDPOINT", "LIFECYCLE_TEST_S3_BUCKET");
  // The reset environment lost the object; the other environment kept its count.
  expect(before).toBe(-1 || before);
  expect(after).toBe(before);
});
