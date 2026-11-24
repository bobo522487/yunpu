import { describe, expect, test } from "vitest";
import { withAdminDb } from "../auth/fixtures";
import { createPerson, seedOwnerProject } from "./fixtures/helpers";

describe("lineage projection", () => {
  test("a parent edge refreshes the child in the same transaction and a cycle rolls it back", async () => {
    const { organizationId, projectId, cookie } =
      await seedOwnerProject("projection-tx");
    const parent = await createPerson(cookie, projectId, { displayName: "父" });
    const child = await createPerson(cookie, projectId, { displayName: "子" });
    const parentId = (parent.data?.person as { id: string }).id;
    const childId = (child.data?.person as { id: string }).id;

    await withAdminDb(async (client) => {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO person_relation (
           organization_id, project_id, from_person_id, to_person_id, kind
         ) VALUES ($1, $2, $3, $4, 'biological_parent')`,
        [organizationId, projectId, parentId, childId],
      );
      const generation = await client.query<{ generation: number }>(
        `SELECT generation FROM lineage_projection
          WHERE project_id = $1 AND person_id = $2`,
        [projectId, childId],
      );
      expect(generation.rows[0]?.generation).toBe(1);
      await client.query("COMMIT");
    });

    await expect(
      withAdminDb(async (client) => {
        await client.query("BEGIN");
        await client.query(
          `INSERT INTO person_relation (
             organization_id, project_id, from_person_id, to_person_id, kind
           ) VALUES ($1, $2, $3, $4, 'biological_parent')`,
          [organizationId, projectId, childId, parentId],
        );
        await client.query("COMMIT");
      }),
    ).rejects.toMatchObject({ code: "GX001" });

    const remaining = await withAdminDb((client) =>
      client.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM person_relation
          WHERE project_id = $1 AND from_person_id = $2 AND to_person_id = $3`,
        [projectId, childId, parentId],
      ),
    );
    expect(remaining.rows[0]?.count).toBe("0");
  });
});
