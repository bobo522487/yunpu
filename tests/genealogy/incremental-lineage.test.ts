import { describe, expect, test } from "vitest";
import { withAdminDb } from "../auth/fixtures";
import { seedOwnerProject } from "./fixtures/helpers";

const DEPTH = 80;

describe("incremental lineage projection", () => {
  test("an 80-generation chain has a complete projection", async () => {
    const { organizationId, projectId } =
      await seedOwnerProject("lineage-depth");

    await withAdminDb(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO person (organization_id, project_id, sex, is_living, version)
         SELECT $1::uuid, $2::uuid, 'unknown', true, 1
           FROM generate_series(1, $3)
         RETURNING id`,
        [organizationId, projectId, DEPTH + 1],
      );
      const ids = inserted.rows.map((row) => row.id);
      expect(ids).toHaveLength(DEPTH + 1);

      await client.query(
        `INSERT INTO person_relation (
           organization_id, project_id, from_person_id, to_person_id, kind
         )
         SELECT $1::uuid, $2::uuid, e.f, e.t, 'biological_parent'
           FROM unnest($3::uuid[], $4::uuid[]) AS e(f, t)`,
        [organizationId, projectId, ids.slice(0, DEPTH), ids.slice(1)],
      );

      const leaf = await client.query<{
        generation: number;
        path: string;
      }>(
        `SELECT generation, primary_path::text AS path
           FROM lineage_projection
          WHERE project_id = $1::uuid AND person_id = $2::uuid`,
        [projectId, ids[DEPTH]],
      );
      expect(leaf.rows[0]?.generation).toBe(DEPTH);
      expect(leaf.rows[0]?.path.split(".")).toHaveLength(DEPTH + 1);
    });
  });

  const perf = process.env.YUNPU_PERF === "1" ? describe : describe.skip;

  perf("single-edge reflow at 10k nodes", () => {
    test("reflowing a changed leaf edge completes in under 10ms", async () => {
      const { organizationId, projectId } =
        await seedOwnerProject("lineage-perf");

      const { elapsedMs, subtreeSize } = await withAdminDb(async (client) => {
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO person (organization_id, project_id, sex, is_living, version)
           SELECT $1::uuid, $2::uuid, 'unknown', true, 1
             FROM generate_series(1, 10000)
           RETURNING id`,
          [organizationId, projectId],
        );
        const ids = inserted.rows.map((row) => row.id);

        const fromIds = ids
          .slice(1)
          .map((_, index) => ids[Math.floor(index / 2)]);
        const toIds = ids.slice(1);
        // Seed the 10k-node fixture with refresh triggers disabled: setup cost
        // is not the benchmark; the single edge move below is.
        await client.query("SET session_replication_role = replica");
        await client.query(
          `INSERT INTO person_relation (
             organization_id, project_id, from_person_id, to_person_id, kind
           )
           SELECT $1::uuid, $2::uuid, e.f, e.t, 'biological_parent'
             FROM unnest($3::uuid[], $4::uuid[]) AS e(f, t)`,
          [organizationId, projectId, fromIds, toIds],
        );
        await client.query("SET session_replication_role = origin");
        await client.query("SELECT app.rebuild_project_lineage($1::uuid)", [
          projectId,
        ]);

        // Measure the incremental projection update itself at 10k nodes,
        // excluding generic constraint-trigger overhead on relation writes.
        const leafId = ids.at(-1) ?? "";
        await client.query("SET session_replication_role = replica");
        await client.query(
          `INSERT INTO person_relation (
             organization_id, project_id, from_person_id, to_person_id, kind
           ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'biological_parent')`,
          [organizationId, projectId, ids[0], leafId],
        );
        await client.query("SET session_replication_role = origin");

        // Warm the plan cache, then take a median so one cold-buffer outlier
        // does not obscure the steady-state subtree reflow cost.
        const samples: number[] = [];
        for (let run = 0; run < 5; run += 1) {
          const started = performance.now();
          await client.query("SELECT app.reflow_lineage_from($1, $2)", [
            projectId,
            leafId,
          ]);
          samples.push(performance.now() - started);
        }
        samples.sort((a, b) => a - b);
        const elapsedMs = samples[Math.floor(samples.length / 2)] ?? Infinity;

        const subtree = await client.query<{ n: number }>(
          `SELECT count(*)::int AS n
             FROM lineage_projection
            WHERE project_id = $1::uuid
              AND (
                primary_path::text = (SELECT primary_path::text FROM lineage_projection
                 WHERE project_id = $1::uuid AND person_id = $2::uuid)
                OR primary_path::text LIKE (SELECT primary_path::text FROM lineage_projection
                 WHERE project_id = $1::uuid AND person_id = $2::uuid) || '.%'
              )`,
          [projectId, ids[ids.length - 1]],
        );
        return { elapsedMs, subtreeSize: subtree.rows[0]?.n ?? 0 };
      });

      expect(subtreeSize).toBe(1);
      expect(elapsedMs).toBeLessThan(10);
    });
  });
});
