import { Hono } from "hono";
import { Client } from "pg";
import { checkStorage } from "./storage";

const app = new Hono();

function healthPayload(database: "up" | "down") {
  return {
    ok: database === "up",
    checks: {
      process: "up",
      database,
    },
  };
}

async function probeDatabase(): Promise<{ up: boolean; version?: string }> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return { up: false };
  }

  let client: Client | undefined;
  try {
    client = new Client({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 5000,
      query_timeout: 5000,
    });
    await client.connect();
    const result = await client.query<{ version: string }>("SELECT version()");
    return { up: true, version: result.rows[0]?.version };
  } catch {
    return { up: false };
  } finally {
    await client?.end().catch(() => undefined);
  }
}

app.get("/api/health", async (c) => {
  const database = await probeDatabase();
  return c.json(healthPayload(database.up ? "up" : "down"), database.up ? 200 : 503);
});

app.get("/api/ready", async (c) => {
  const [database, storage] = await Promise.all([probeDatabase(), checkStorage()]);

  const versionOk = database.version?.includes("PostgreSQL 18") ?? false;
  const checks: Record<string, "up" | "down"> = {
    process: "up",
    database: database.up && versionOk ? "up" : "down",
    storage: storage.up ? "up" : "down",
  };
  const ok = Object.values(checks).every((value) => value === "up");

  if (ok) {
    return c.json({
      ok: true,
      checks,
      version: database.version,
    });
  }

  const reasons: string[] = [];
  if (!database.up) {
    reasons.push("database: connection failed");
  } else if (!versionOk) {
    reasons.push(`database: version mismatch, expected PostgreSQL 18, got ${database.version}`);
  }
  if (!storage.up && storage.reason) {
    reasons.push(`storage: ${storage.reason}`);
  }

  return c.json({ ok: false, checks, reason: reasons.join("; ") }, 503);
});

const starterPage = () =>
  `<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8"><title>Yunpu</title></head>
  <body>
    <main>
      <h1>示例工作区</h1>
      <p data-marker="yunpu-starter-workspace">yunpu-starter-workspace</p>
    </main>
  </body>
</html>`;

const emptyPage = () =>
  `<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8"><title>Yunpu</title></head>
  <body>
    <main id="root"></main>
  </body>
</html>`;

app.get("/", (c) => {
  const environment = process.env.YUNPU_ENV;
  if (environment === "development") {
    return c.html(starterPage());
  }
  // test (and any other value): empty state without the starter markers.
  return c.html(emptyPage());
});

export default app;
