import { Hono } from "hono";
import { compress } from "hono/compress";
import { HTTPException } from "hono/http-exception";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { Client } from "pg";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { AppError, mapDatabaseError } from "./lib/errors";
import { authMiddleware } from "./middleware/auth";
import { authPages } from "./pages/auth";
import { authRouter } from "./modules/auth/router";
import { organizationRouter } from "./modules/organization/router";
import { checkStorage } from "./storage";
import type { ApiEnv } from "./types";

const app = new Hono<ApiEnv>();

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

app.use(requestId());
app.use(secureHeaders());
app.use(compress());
app.use(authMiddleware());

app.onError((error, c) => {
  if (error instanceof AppError) {
    const retryAfter = error.details?.retryAfterSeconds;
    if (typeof retryAfter === "number") {
      c.header("Retry-After", String(retryAfter));
    }
    return c.json(
      {
        ok: false,
        code: error.code,
        message: error.message,
        details: error.details,
      },
      error.status as ContentfulStatusCode,
    );
  }

  if (error instanceof HTTPException) {
    return c.json(
      {
        ok: false,
        code: "VALIDATION",
        message: error.message,
      },
      error.status as ContentfulStatusCode,
    );
  }

  const mapped = mapDatabaseError(error);
  return c.json(
    {
      ok: false,
      code: mapped.code,
      message: mapped.message,
    },
    mapped.status as ContentfulStatusCode,
  );
});

app.notFound((c) =>
  c.json({ ok: false, code: "NOT_FOUND", message: "接口不存在" }, 404),
);

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
  return c.html(emptyPage());
});

app.route("/api/v1/auth", authRouter);
app.route("/api/v1", organizationRouter);
app.route("/", authPages);

export default app;
