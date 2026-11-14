import { expect, test } from "bun:test";
import { createHash, createHmac } from "node:crypto";

// Lifecycle checks run against both environments while they are up. They
// prove three outcomes: development data survives down/up, the test
// environment starts from an empty baseline every time, and resetting one
// environment leaves the other one's objects untouched.

const devBase = "http://127.0.0.1:3000";
const testBase = "http://127.0.0.1:3010";
const devToken = process.env.DEV_YUNPU_CAPABILITY_TOKEN ?? "example-development-capability-token";
const testToken = process.env.YUNPU_CAPABILITY_TOKEN ?? "example-test-capability-token";
const envsh = new URL("../../scripts/env.sh", import.meta.url).pathname;

// Count objects directly in one environment's bucket. The storage account
// for each environment is the MinIO root account that scripts/env.sh
// generates, so the credentials match .env.test / .env.development values.
function envValue(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.length > 0 ? value : fallback;
}

const devStorage = {
  endpoint: envValue("DEV_S3_ENDPOINT", "http://127.0.0.1:9000"),
  accessKeyId: envValue("DEV_S3_ACCESS_KEY_ID", "example-development-access"),
  secretAccessKey: envValue("DEV_S3_SECRET_ACCESS_KEY", "example-development-secret"),
  bucket: envValue("DEV_S3_BUCKET", "yunpu-development"),
};

const testStorage = {
  endpoint: envValue("S3_ENDPOINT", "http://127.0.0.1:9010"),
  accessKeyId: envValue("S3_ACCESS_KEY_ID", "example-test-access"),
  secretAccessKey: envValue("S3_SECRET_ACCESS_KEY", "example-test-secret"),
  bucket: envValue("S3_BUCKET", "yunpu-test"),
};

// MinIO is addressed path-style, but Bun's S3Client.list() sends a
// virtual-hosted request that MinIO answers with NoSuchBucket. Count objects
// with a hand-signed ListObjectsV2 GET, using the same SigV4 scheme the app
// uses for its bucket-level requests.
const region = "us-east-1";

function sha256Hex(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: string | Uint8Array, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

function uriEncode(value: string): string {
  // AWS canonical-query encoding: keep A-Za-z0-9-_.~, percent-encode the
  // rest (including "/", which must stay %2F inside the prefix value).
  return value.replace(/[^A-Za-z0-9-_.~]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`);
}

async function objectCount(storage: typeof devStorage): Promise<number> {
  const url = new URL(`${storage.endpoint}/${storage.bucket}`);
  url.searchParams.set("list-type", "2");
  url.searchParams.set("prefix", "media/");
  const host = url.host;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const dateStamp = amzDate.slice(0, 8);
  const query = [...url.searchParams.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => `${uriEncode(k)}=${uriEncode(v)}`)
    .join("&");
  const payloadHash = "UNSIGNED-PAYLOAD";
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = ["GET", `/${storage.bucket}`, query, canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${storage.secretAccessKey}`, dateStamp), region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization:
        `AWS4-HMAC-SHA256 Credential=${storage.accessKeyId}/${scope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    throw new Error(`ListObjectsV2 failed: ${response.status} ${await response.text()}`);
  }
  const xml = await response.text();
  return (xml.match(/<Key>/g) ?? []).length;
}

// Each lifecycle test restarts an environment, so the application socket goes
// away and comes back. Close the connection every time to avoid reusing a
// dead keep-alive socket from a previous environment instance.
async function mediaWrite(base: string, token: string, body: string): Promise<string> {
  const response = await fetch(`${base}/api/media`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, connection: "close" },
    body,
  });
  expect(response.status).toBe(201);
  const { key } = (await response.json()) as { key: string };
  return key;
}

async function mediaRead(base: string, token: string, key: string): Promise<Response> {
  return fetch(`${base}/api/media/${key}`, {
    headers: { authorization: `Bearer ${token}`, connection: "close" },
  });
}

test("development data survives down then up", async () => {
  const key = await mediaWrite(devBase, devToken, "survives-down-up");

  const down = Bun.spawnSync(["sh", envsh, "down", "development"]);
  expect(down.exitCode).toBe(0);
  const up = Bun.spawnSync(["sh", envsh, "up", "development"]);
  expect(up.exitCode).toBe(0);

  const read = await mediaRead(devBase, devToken, key);
  expect(read.status).toBe(200);
  expect(await read.text()).toBe("survives-down-up");
}, 240000);

test("up test wipes the previous round's data", async () => {
  const key = await mediaWrite(testBase, testToken, "must-not-survive");

  const up = Bun.spawnSync(["sh", envsh, "up", "test"]);
  expect(up.exitCode).toBe(0);

  const read = await mediaRead(testBase, testToken, key);
  expect(read.status).toBe(404);
}, 240000);

test("resetting one environment leaves the other's objects in place", async () => {
  const devKey = await mediaWrite(devBase, devToken, "kept-through-test-reset");
  const testKey = await mediaWrite(testBase, testToken, "gone-after-reset");

  const devCountBefore = await objectCount(devStorage);
  expect(devCountBefore).toBeGreaterThan(0);

  const reset = Bun.spawnSync(["sh", envsh, "reset", "test"]);
  expect(reset.exitCode).toBe(0);

  const devRead = await mediaRead(devBase, devToken, devKey);
  expect(devRead.status).toBe(200);
  expect(await devRead.text()).toBe("kept-through-test-reset");

  const testRead = await mediaRead(testBase, testToken, testKey);
  expect(testRead.status).toBe(404);

  const devCountAfter = await objectCount(devStorage);
  expect(devCountAfter).toBe(devCountBefore);

  const testCountAfter = await objectCount(testStorage);
  expect(testCountAfter).toBe(0);
}, 240000);
