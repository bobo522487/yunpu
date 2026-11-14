import { createHash, createHmac } from "node:crypto";

// Minimal AWS SigV4 helpers so the application can create and check the
// bucket itself. Bun's S3Client has no CreateBucket/HeadBucket operation, so
// the two bucket-level requests are signed by hand against the same
// credentials the client uses.

function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: string | Uint8Array, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

function uriEncode(value: string, encodeSlash: boolean): string {
  let out = "";
  for (const char of value) {
    if (/[A-Za-z0-9_.~-]/.test(char)) {
      out += char;
    } else if (char === "/") {
      out += encodeSlash ? "%2F" : "/";
    } else {
      out += [...Buffer.from(char, "utf8")].map((b) => `%${b.toString(16).toUpperCase().padStart(2, "0")}`).join("");
    }
  }
  return out;
}

interface EndpointParts {
  protocol: string;
  host: string;
  port: string;
}

function endpointParts(endpoint: string): EndpointParts {
  const url = new URL(endpoint);
  return {
    protocol: url.protocol.replace(":", ""),
    host: url.hostname,
    port: url.port || (url.protocol === "https:" ? "443" : "80"),
  };
}

async function signedBucketRequest(config: {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  method: "HEAD" | "PUT";
}): Promise<Response> {
  const parts = endpointParts(config.endpoint);
  // MinIO is addressed path-style: the bucket is the first path segment.
  const hostHeader = `${parts.host}${parts.port === "80" || parts.port === "443" ? "" : `:${parts.port}`}`;
  const url = `${parts.protocol}://${hostHeader}/${config.bucket}`;
  const now = new Date();
  const amzDate = `${now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15)}Z`;
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex("");
  const canonicalHeaders =
    `host:${hostHeader}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    config.method,
    `/${config.bucket}`,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${config.secretAccessKey}`, dateStamp), config.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  return fetch(url, {
    method: config.method,
    headers: {
      Authorization:
        `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    },
    signal: AbortSignal.timeout(5000),
  });
}

export interface StorageConfig {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

let s3Client: import("bun").S3Client | undefined;
let storageConfig: StorageConfig | undefined;

// MinIO answers on any region; the client uses the same fixed value.
const region = "us-east-1";

export async function initStorage(config: StorageConfig): Promise<void> {
  storageConfig = config;
  s3Client = new Bun.S3Client({
    endpoint: config.endpoint,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    bucket: config.bucket,
    region,
    retry: 2,
  });

  // The bucket is created by the application at startup. Creation failure
  // means the environment cannot serve media, so the process exits instead
  // of ever reporting readiness.
  try {
    const head = await signedBucketRequest({ ...config, region, method: "HEAD" });
    if (head.status === 404) {
      const create = await signedBucketRequest({ ...config, region, method: "PUT" });
      if (create.status !== 200) {
        throw new Error(`CreateBucket returned ${create.status}`);
      }
    } else if (head.status !== 200) {
      throw new Error(`HeadBucket returned ${head.status}`);
    }
  } catch (error) {
    console.error(`storage init failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

export interface StorageCheck {
  up: boolean;
  reason?: string;
}

// Ready requires the live probe AND bucket access with this environment's
// own credentials. A listening port alone is not "up".
export async function checkStorage(): Promise<StorageCheck> {
  const config = storageConfig;
  if (!config) {
    return { up: false, reason: "storage not initialized" };
  }

  try {
    const probe = await fetch(new URL("/minio/health/live", config.endpoint), {
      signal: AbortSignal.timeout(3000),
    });
    if (probe.status !== 200) {
      return { up: false, reason: "storage live probe failed" };
    }
  } catch {
    return { up: false, reason: "storage live probe failed" };
  }

  try {
    const head = await signedBucketRequest({ ...config, region, method: "HEAD" });
    if (head.status !== 200) {
      return { up: false, reason: "bucket not accessible with environment credentials" };
    }
  } catch {
    return { up: false, reason: "bucket not accessible with environment credentials" };
  }

  return { up: true };
}

export function s3(): import("bun").S3Client {
  if (!s3Client) {
    throw new Error("storage not initialized");
  }
  return s3Client;
}

export async function putObject(key: string, body: Uint8Array): Promise<void> {
  await s3().write(key, body);
}

export async function getObject(key: string): Promise<Uint8Array | undefined> {
  try {
    const file = s3().file(key);
    const buffer = await file.arrayBuffer();
    return new Uint8Array(buffer);
  } catch {
    return undefined;
  }
}
