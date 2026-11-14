import { Hono } from "hono";
import { Client } from "pg";

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

app.get("/api/health", async (c) => {
  let client: Client | undefined;

  try {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return c.json(healthPayload("down"), 503);
    }

    client = new Client({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 5000,
      query_timeout: 5000,
    });
    await client.connect();
    await client.query("SELECT 1");
    return c.json(healthPayload("up"));
  } catch {
    return c.json(healthPayload("down"), 503);
  } finally {
    await client?.end().catch(() => undefined);
  }
});

export default app;
