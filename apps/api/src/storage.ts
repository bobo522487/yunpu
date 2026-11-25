import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export interface StorageConfig {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

let s3Client: S3Client | undefined;
let storageConfig: StorageConfig | undefined;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Initialise the S3-compatible client. Failures are thrown: the caller owns
 * the process lifecycle and decides whether a bad storage config is fatal.
 */
export async function initStorage(config: StorageConfig): Promise<void> {
  storageConfig = config;
  s3Client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: config.bucket }));
  } catch (headError) {
    try {
      await s3Client.send(new CreateBucketCommand({ Bucket: config.bucket }));
    } catch (createError) {
      throw new Error(
        `storage init failed: head=${errorMessage(headError)}; create=${errorMessage(createError)}`,
      );
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
    await s3().send(new HeadBucketCommand({ Bucket: config.bucket }));
    return { up: true };
  } catch (error) {
    return {
      up: false,
      reason: `bucket not accessible with environment credentials: ${errorMessage(error)}`,
    };
  }
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
