import { expect, test } from "vitest";
import { withAdminDb } from "../auth/fixtures";

// Six leaf tables had a SELECT policy that re-entered organization_member under
// RLS, while their write policies already used the single security-definer
// helper. Keep both the catalog contract and the runtime plan honest.
const LEAF_TABLES = [
  "invite",
  "project",
  "person",
  "person_name",
  "person_relation",
  "lineage_projection",
] as const;

test("leaf tenant_select policies use visible_org_array only", async () => {
  await withAdminDb(async (client) => {
    const result = await client.query<{
      tablename: string;
      expression: string;
    }>(
      `
      SELECT c.relname AS tablename, pg_get_expr(p.polqual, p.polrelid) AS expression
        FROM pg_policy p
        JOIN pg_class c ON c.oid = p.polrelid
       WHERE c.relname = ANY($1::text[])
         AND p.polname = 'tenant_select'
         AND p.polcmd = 'r'
       ORDER BY c.relname
      `,
      [[...LEAF_TABLES]],
    );

    expect(result.rows.map((row) => row.tablename)).toEqual(
      [...LEAF_TABLES].sort(),
    );
    for (const row of result.rows) {
      expect(row.expression).toContain("visible_org_array");
      expect(row.expression).not.toContain("organization_member");
    }
  });
});

test("a tenant SELECT plan does not rescan organization_member", async () => {
  await withAdminDb(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query("SET LOCAL ROLE genealogy_app");
      await client.query(
        "SET LOCAL app.user_id = '01900000-0000-7000-8000-000000000001'",
      );
      const result = await client.query<{ "QUERY PLAN": string[] }>(
        "EXPLAIN (ANALYZE, FORMAT JSON) SELECT id FROM public.person",
      );
      const plan = JSON.stringify(result.rows[0]?.["QUERY PLAN"] ?? []);
      expect(plan).toContain('"Relation Name":"person"');
      expect(plan).not.toContain("organization_member");
    } finally {
      await client.query("ROLLBACK");
    }
  });
});
