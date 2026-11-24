import { Client } from "pg";

export type LargeTreeSeed = {
  projectId: string;
  organizationId: string;
  rootPersonId: string;
  personCount: number;
};

/**
 * Seed ~5k persons with biological_parent edges and refresh lineage_projection.
 * Uses the migrate/admin connection (bypasses RLS) for throughput.
 */
export async function seedLargeTree(input: {
  organizationId: string;
  projectId: string;
  personCount?: number;
}): Promise<LargeTreeSeed> {
  const personCount = input.personCount ?? 5000;
  const client = new Client({
    connectionString: process.env.MIGRATE_DATABASE_URL,
  });
  await client.connect();
  try {
    await client.query("BEGIN");

    const persons = await client.query<{ id: string }>(
      `INSERT INTO person (organization_id, project_id, sex, is_living, version)
       SELECT $1::uuid, $2::uuid, 'unknown', true, 1
         FROM generate_series(1, $3)
       RETURNING id`,
      [input.organizationId, input.projectId, personCount],
    );
    const ids = persons.rows.map((row) => row.id);
    const rootPersonId = ids[0];

    await client.query(
      `INSERT INTO person_name (organization_id, project_id, person_id, kind, value, is_primary)
       SELECT $1::uuid, $2::uuid, p.id, 'formal', 'P' || gs.i::text, true
         FROM unnest($3::uuid[]) WITH ORDINALITY AS p(id, ord)
         JOIN generate_series(1, $4) AS gs(i) ON gs.i = p.ord`,
      [input.organizationId, input.projectId, ids, personCount],
    );

    // Fan-out tree: each non-root has parent floor((i-1)/2) for a binary-ish shape.
    const edges: Array<[string, string]> = [];
    for (let i = 1; i < ids.length; i += 1) {
      const parentIndex = Math.floor((i - 1) / 2);
      edges.push([ids[parentIndex], ids[i]]);
    }

    const fromIds = edges.map(([from]) => from);
    const toIds = edges.map(([, to]) => to);
    await client.query(
      `INSERT INTO person_relation (
         organization_id, project_id, from_person_id, to_person_id, kind
       )
       SELECT $1::uuid, $2::uuid, f, t, 'biological_parent'
         FROM unnest($3::uuid[], $4::uuid[]) AS e(f, t)`,
      [input.organizationId, input.projectId, fromIds, toIds],
    );

    await client.query(
      `WITH RECURSIVE rebuilt AS (
         SELECT $3::uuid AS person_id,
                replace($3::text, '-', '')::ltree AS primary_path,
                0 AS generation
         UNION ALL
         SELECT r.to_person_id,
                (p.primary_path || replace(r.to_person_id::text, '-', ''))::ltree,
                p.generation + 1
           FROM person_relation r
           JOIN rebuilt p ON p.person_id = r.from_person_id
          WHERE r.project_id = $2::uuid
            AND r.kind = 'biological_parent'
       )
       INSERT INTO lineage_projection
         (organization_id, project_id, person_id, primary_path, generation, updated_at)
       SELECT $1::uuid, $2::uuid, person_id, primary_path, generation, clock_timestamp()
         FROM rebuilt
       ON CONFLICT (project_id, person_id) DO UPDATE
         SET primary_path = EXCLUDED.primary_path,
             generation = EXCLUDED.generation,
             updated_at = clock_timestamp()`,
      [input.organizationId, input.projectId, rootPersonId],
    );

    await client.query("COMMIT");
    await client.query(
      "ANALYZE person, person_name, person_relation, lineage_projection",
    );
    return {
      projectId: input.projectId,
      organizationId: input.organizationId,
      rootPersonId,
      personCount: ids.length,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}
