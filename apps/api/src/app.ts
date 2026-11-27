import { ERROR_STATUS } from "@yunpu/shared";
import type { Context } from "hono";
import { Hono } from "hono";
import { compress } from "hono/compress";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { config } from "./config";
import { businessPool } from "./db/with-tenant-transaction";
import { AppError, tryMapDatabaseError } from "./lib/errors";
import { logEvent } from "./lib/logger";
import media from "./media";
import { authMiddleware } from "./middleware/auth";
import { accountRouter } from "./modules/account/router";
import { articleRouter } from "./modules/article/router";
import { authRouter } from "./modules/auth";
import { bookRouter } from "./modules/book/router";
import { folderRouter } from "./modules/folder/router";
import { lineageRouter } from "./modules/lineage/router";
import { organizationRouter } from "./modules/organization/router";
import { personRouter } from "./modules/person/router";
import { projectRouter } from "./modules/project/router";
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

export async function probeDatabase(): Promise<{
  up: boolean;
  version?: string;
}> {
  const databaseUrl = config().DATABASE_URL;
  if (!databaseUrl) {
    return { up: false };
  }

  try {
    const result = await businessPool.query<{ version: string }>(
      "SELECT version()",
    );
    return { up: true, version: result.rows[0]?.version };
  } catch (error) {
    logEvent({
      event: "database_probe",
      result: "failed",
      reason: error instanceof Error ? error.message : String(error),
    });
    return { up: false };
  }
}

app.use(requestId());
app.use(secureHeaders());
app.use(compress());
app.use(
  "/api/*",
  cors({
    origin: (origin) => {
      const allowed = config().CORS_ORIGINS;
      return allowed.includes(origin) ? origin : undefined;
    },
    credentials: true,
    allowHeaders: ["content-type", "authorization"],
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  }),
);
app.use("/api/v1/*", authMiddleware());

export function onApiError(error: unknown, c: Context<ApiEnv>): Response {
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
    const code =
      Object.entries(ERROR_STATUS).find(
        ([, status]) => status === error.status,
      )?.[0] ?? "INTERNAL";
    return c.json(
      {
        ok: false,
        code,
        message: error.message,
      },
      error.status as ContentfulStatusCode,
    );
  }

  const mapped = tryMapDatabaseError(error);
  if (mapped) {
    return c.json(
      {
        ok: false,
        code: mapped.code,
        message: mapped.message,
        details: mapped.details,
      },
      mapped.status as ContentfulStatusCode,
    );
  }

  logEvent({
    event: "unhandled_error",
    request_id: c.get("requestId"),
    reason: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? (error.stack ?? "") : "",
  });
  return c.json(
    {
      ok: false,
      code: "INTERNAL",
      message: "服务器内部错误",
    },
    500,
  );
}

app.onError(onApiError);

app.notFound((c) =>
  c.json({ ok: false, code: "NOT_FOUND", message: "接口不存在" }, 404),
);

app.get("/api/health", async (c) => {
  const database = await probeDatabase();
  return c.json(
    healthPayload(database.up ? "up" : "down"),
    database.up ? 200 : 503,
  );
});

app.get("/api/ready", async (c) => {
  const [database, storage] = await Promise.all([
    probeDatabase(),
    checkStorage(),
  ]);

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
    reasons.push(
      `database: version mismatch, expected PostgreSQL 18, got ${database.version}`,
    );
  }
  if (!storage.up && storage.reason) {
    reasons.push(`storage: ${storage.reason}`);
  }

  return c.json({ ok: false, checks, reason: reasons.join("; ") }, 503);
});

const apiRoutes = new Hono<ApiEnv>()
  .route("/auth", authRouter)
  .route("/", organizationRouter)
  .route("/", projectRouter)
  .route("/", folderRouter)
  .route("/", lineageRouter)
  .route("/", accountRouter)
  .route("/", personRouter)
  .route("/", articleRouter)
  .route("/", bookRouter);

app.route("/api/v1", apiRoutes);
app.route("/", media);

export type AppType = typeof apiRoutes;
export default app;
