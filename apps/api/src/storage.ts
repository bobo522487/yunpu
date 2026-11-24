import { createHash, createHmac } from "node:crypto";
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: string | Uint8Array, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
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
  const hostHeader = `${parts.host}${parts.port === "80" || parts.port === "443" ? "" : `:${parts.port}`}`;
  const url = `${parts.protocol}://${hostHeader}/${config.bucket}`;
  const now = new Date();
  const amzDate = `${now
    .toISOString()
    .replace(/[:-]|\.\d{3}/g, "")
    .slice(0, 15)}Z`;
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
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signingKey = hmac(
    hmac(
      hmac(hmac(`AWS4${config.secretAccessKey}`, dateStamp), config.region),
      "s3",
    ),
    "aws4_request",
  );
  const signature = createHmac("sha256", signingKey)
    .update(stringToSign)
    .digest("hex");

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

let s3Client: S3Client | undefined;
let storageConfig: StorageConfig | undefined;

const region = "us-east-1";

export async function initStorage(config: StorageConfig): Promise<void> {
  storageConfig = config;
  s3Client = new S3Client({
    endpoint: config.endpoint,
    region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  try {
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: config.bucket }));
    } catch {
      await s3Client.send(new CreateBucketCommand({ Bucket: config.bucket }));
    }
  } catch (error) {
    // Fallback to signed helpers for MinIO quirks
    try {
      const head = await signedBucketRequest({
        ...config,
        region,
        method: "HEAD",
      });
      if (head.status === 404) {
        const create = await signedBucketRequest({
          ...config,
          region,
          method: "PUT",
        });
        if (create.status !== 200) {
          throw new Error(`CreateBucket returned ${create.status}`);
        }
      } else if (head.status !== 200) {
        throw new Error(`HeadBucket returned ${head.status}`);
      }
    } catch (fallbackError) {
      console.error(
        `storage init failed: ${error instanceof Error ? error.message : String(error)}; fallback: ${
          fallbackError instanceof Error
            ? fallbackError.message
            : String(fallbackError)
        }`,
      );
      process.exit(1);
    }
  }
}

export interface StorageCheck {
  up: boolean;
  reason?: string;
}

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
    const head = await signedBucketRequest({
      ...config,
      region,
      method: "HEAD",
    });
    if (head.status !== 200) {
      return {
        up: false,
        reason: "bucket not accessible with environment credentials",
      };
    }
  } catch {
    return {
      up: false,
      reason: "bucket not accessible with environment credentials",
    };
  }

  return { up: true };
}

function s3(): S3Client {
  if (!s3Client) {
    throw new Error("storage not initialized");
  }
  return s3Client;
}

export async function putObject(key: string, body: Uint8Array): Promise<void> {
  const config = storageConfig;
  if (!config) throw new Error("storage not initialized");
  await s3().send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body,
    }),
  );
}

export async function getObject(key: string): Promise<Uint8Array | undefined> {
  const config = storageConfig;
  if (!config) throw new Error("storage not initialized");
  try {
    const result = await s3().send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: key,
      }),
    );
    if (!result.Body) return undefined;
    const bytes = await result.Body.transformToByteArray();
    return new Uint8Array(bytes);
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "NoSuchKey" || name === "NotFound") return undefined;
    throw error;
  }
}
