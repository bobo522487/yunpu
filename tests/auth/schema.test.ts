import { describe, expect, test } from "vitest";
import { withAdminDb } from "./fixtures";

describe("database foundation", () => {
  test("contains auth schema and expected public business tables", async () => {
    const tables = await withAdminDb(async (client) => {
      const result = await client.query<{ tablename: string }>(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
      );
      return result.rows.map((row) => row.tablename);
    });

    expect(tables).toEqual([
      "article",
      "article_revision",
      "audit_log",
      "book",
      "book_edition",
      "folder",
      "invite",
      "lineage",
      "lineage_projection",
      "organization",
      "organization_member",
      "person",
      "person_event",
      "person_name",
      "person_relation",
      "project",
      "schema_migrations",
    ]);
  });

  test("tenant tables have enabled and forced RLS", async () => {
    const rows = await withAdminDb(async (client) => {
      const result = await client.query<{
        relname: string;
        relrowsecurity: boolean;
        relforcerowsecurity: boolean;
      }>(
        `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> 'schema_migrations'
         ORDER BY c.relname`,
      );
      return result.rows;
    });

    expect(rows.map((row) => row.relname)).toEqual([
      "article",
      "article_revision",
      "audit_log",
      "book",
      "book_edition",
      "folder",
      "invite",
      "lineage",
      "lineage_projection",
      "organization",
      "organization_member",
      "person",
      "person_event",
      "person_name",
      "person_relation",
      "project",
    ]);
    for (const row of rows) {
      expect(row.relrowsecurity).toBe(true);
      expect(row.relforcerowsecurity).toBe(true);
    }
  });

  test("organization_member exposes last_used_at", async () => {
    const column = await withAdminDb(async (client) => {
      const result = await client.query<{
        data_type: string;
        is_nullable: string;
      }>(
        `SELECT data_type, is_nullable
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'organization_member'
           AND column_name = 'last_used_at'`,
      );
      return result.rows[0];
    });

    expect(column?.data_type).toBe("timestamp with time zone");
    expect(column?.is_nullable).toBe("YES");
  });

  test("controlled functions are owned by rls_definer", async () => {
    const rows = await withAdminDb(async (client) => {
      const result = await client.query<{ proname: string; owner: string }>(
        `SELECT p.proname, pg_get_userbyid(p.proowner) AS owner
         FROM pg_proc p
         WHERE p.pronamespace = 'app'::regnamespace
           AND p.proname IN ('create_organization', 'accept_invite', 'visible_org_array')
         ORDER BY p.proname`,
      );
      return result.rows;
    });

    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.owner).toBe("rls_definer");
    }
  });

  test("append-only and scope triggers exist", async () => {
    const rows = await withAdminDb(async (client) => {
      const result = await client.query<{ tgname: string }>(
        "SELECT tgname FROM pg_trigger WHERE NOT tgisinternal ORDER BY tgname",
      );
      return result.rows.map((row) => row.tgname);
    });

    expect(rows).toContain("trg_audit_log_append_only");
    expect(rows).toContain("trg_guard_scope_immutable");
    expect(rows).toContain("trg_touch_updated_at");
  });
});
