import { Client } from "pg";
import { describe, expect, test } from "vitest";
import { withAdminDb } from "../auth/fixtures";

async function businessClient(): Promise<Client> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  return client;
}

describe("console foundation (project table)", () => {
  test("project table exists with enabled and forced RLS", async () => {
    const row = await withAdminDb(async (client) => {
      const result = await client.query<{
        relrowsecurity: boolean;
        relforcerowsecurity: boolean;
      }>(
        `SELECT c.relrowsecurity, c.relforcerowsecurity
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = 'project'`,
      );
      return result.rows[0];
    });

    expect(row).toBeDefined();
    expect(row?.relrowsecurity).toBe(true);
    expect(row?.relforcerowsecurity).toBe(true);
  });

  test("audit_log entity_type CHECK includes project", async () => {
    const definition = await withAdminDb(async (client) => {
      const result = await client.query<{ pg_get_expr: string }>(
        `SELECT pg_get_expr(conbin, conrelid) AS pg_get_expr
         FROM pg_constraint
         WHERE conname = 'ck_audit_log_entity_type'`,
      );
      return result.rows[0]?.pg_get_expr ?? "";
    });

    expect(definition).toContain("'project'");
  });

  test("project RLS is fail-closed without app.user_id", async () => {
    const client = await businessClient();
    try {
      const result = await client.query(
        "SELECT count(*)::int AS count FROM project",
      );
      expect(result.rows[0]?.count).toBe(0);
    } finally {
      await client.end();
    }
  });

  test("project read requires a visible organization membership", async () => {
    const client = await businessClient();
    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT set_config('app.user_id', '00000000-0000-7000-8000-000000000001', true)",
      );
      const result = await client.query(
        "SELECT count(*)::int AS count FROM project",
      );
      expect(result.rows[0]?.count).toBe(0);
      await client.query("ROLLBACK");
    } finally {
      await client.end();
    }
  });

  test("project has the documented columns", async () => {
    const columns = await withAdminDb(async (client) => {
      const result = await client.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'project'
         ORDER BY ordinal_position`,
      );
      return result.rows.map((row) => row.column_name);
    });

    expect(columns).toEqual([
      "id",
      "organization_id",
      "name",
      "status",
      "surname",
      "hall_name",
      "origin_text",
      "description",
      "created_at",
      "updated_at",
      // 0010 迁移以 ADD COLUMN 追加到表尾。
      "color_theme",
      "project_level",
    ]);
  });
});
