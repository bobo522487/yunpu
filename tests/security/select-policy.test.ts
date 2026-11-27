import { expect, test } from "vitest";
import { withAdminDb } from "../auth/fixtures";

// Six leaf tables had a SELECT policy that re-entered organization_member under
// RLS, while their write policies already used the single security-definer
// helper. Keep both the catalog contract and the runtime plan honest.
const LEAF_TABLES = [
  "article",
  "article_revision",
  "book",
  "book_edition",
  "folder",
  "invite",
  "lineage",
  "lineage_projection",
  "person",
  "person_event",
  "person_name",
  "person_relation",
  "project",
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

test("descendant prefix predicate is eligible for idx_lineage_projection_path_text", async () => {
  await withAdminDb(async (client) => {
    await client.query("BEGIN");
    try {
      const orgId = "01900000-0000-7000-8000-000000000091";
      const projectId = "01900000-0000-7000-8000-000000000092";
      const rootPersonId = "01900000-0000-7000-8000-000000000093";

      await client.query("SET LOCAL session_replication_role = replica");
      // Isolate planner statistics inside this rolled-back transaction from rows left by earlier suites;
      // otherwise independence-assumption selectivity (freq(org) * freq(project)) underestimates
      // idx_lineage_projection_org_project, and 20k rows keep path_text ahead of Seq Scan across bloated pages.
      await client.query("DELETE FROM public.lineage_projection");
      await client.query(
        `INSERT INTO public.lineage_projection
           (organization_id, project_id, person_id, primary_path, generation)
         VALUES ($1::uuid, $2::uuid, $3::uuid, 'r0'::ltree, 0)`,
        [orgId, projectId, rootPersonId],
      );
      await client.query(
        `INSERT INTO public.lineage_projection
           (organization_id, project_id, person_id, primary_path, generation)
         SELECT $1::uuid, $2::uuid, uuidv7(), ('r0.c' || gs.i)::ltree, 1
           FROM generate_series(1, 15) AS gs(i)`,
        [orgId, projectId],
      );
      await client.query(
        `INSERT INTO public.lineage_projection
           (organization_id, project_id, person_id, primary_path, generation)
         SELECT $1::uuid, $2::uuid, uuidv7(), ('u' || gs.i)::ltree, 0
           FROM generate_series(1, 20000) AS gs(i)`,
        [orgId, projectId],
      );
      await client.query("SET LOCAL session_replication_role = origin");
      await client.query("ANALYZE public.lineage_projection");

      const result = await client.query<{ "QUERY PLAN": string[] }>(
        `EXPLAIN (FORMAT JSON)
         WITH root_path AS (
           SELECT lp.person_id, lp.primary_path
             FROM public.lineage_projection lp
            WHERE lp.organization_id = $1::uuid
              AND lp.project_id = $2::uuid
              AND lp.person_id = $3::uuid
         )
         SELECT lp.person_id
           FROM public.lineage_projection lp
           JOIN root_path rp ON true
          WHERE lp.organization_id = $1::uuid
            AND lp.project_id = $2::uuid
            AND lp.primary_path::text ~>=~ (rp.primary_path::text || '.')
            AND lp.primary_path::text ~<~ (rp.primary_path::text || '/')`,
        [orgId, projectId, rootPersonId],
      );
      const plan = JSON.stringify(result.rows[0]?.["QUERY PLAN"] ?? []);
      expect(plan).toContain("idx_lineage_projection_path_text");
    } finally {
      await client.query("ROLLBACK");
    }
  });
});
