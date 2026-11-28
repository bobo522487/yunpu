import { serve } from "@hono/node-server";
import app from "./app";
import { config } from "./config";
import { businessPool } from "./db/with-tenant-transaction";
import { initStorage } from "./storage";

async function closePools(): Promise<void> {
  const { authPool } = await import("./modules/auth/better-auth");
  await Promise.allSettled([businessPool.end(), authPool.end()]);
}

const env = config();

try {
  await initStorage({
    endpoint: env.S3_ENDPOINT,
    bucket: env.S3_BUCKET,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    region: env.S3_REGION,
  });
} catch (error) {
  console.error(
    `storage init failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}

// Bind all interfaces so the dev API can be reached from the LAN.
// Override with HOST=127.0.0.1 when only local access is wanted.
const host = process.env.HOST?.trim() || "0.0.0.0";

const server = serve({
  fetch: app.fetch,
  port: env.PORT,
  hostname: host,
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`received ${signal}, shutting down`);
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  await closePools();
  process.exit(0);
}

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    void shutdown(signal);
  });
}

console.log(`yunpu api listening on http://${host}:${env.PORT}`);
