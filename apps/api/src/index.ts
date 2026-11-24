import { serve } from "@hono/node-server";
import app from "./app";
import { initStorage } from "./storage";
import { config } from "./config";
import { closePools } from "./db/pool";

const env = config();

await initStorage({
  endpoint: env.S3_ENDPOINT,
  bucket: env.S3_BUCKET,
  accessKeyId: env.S3_ACCESS_KEY_ID,
  secretAccessKey: env.S3_SECRET_ACCESS_KEY,
});

const server = serve({
  fetch: app.fetch,
  port: env.PORT,
  hostname: "127.0.0.1",
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

console.log(`yunpu api listening on http://127.0.0.1:${env.PORT}`);
