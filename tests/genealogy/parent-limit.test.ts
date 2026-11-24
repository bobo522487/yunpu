import { describe, expect, test } from "vitest";
import { withAdminDb } from "../auth/fixtures";
import {
  createPerson,
  createRelation,
  seedOwnerProject,
} from "./fixtures/helpers";

async function personId(
  cookie: string,
  projectId: string,
  name: string,
): Promise<string> {
  const created = await createPerson(cookie, projectId, { displayName: name });
  expect(created.status).toBe(201);
  return (created.data?.person as { id: string }).id;
}

describe("parent cardinality", () => {
  test("a third parent of the same kind is GX011 and ritual heir is not capped", async () => {
    const { cookie, organizationId, projectId } =
      await seedOwnerProject("parent-limit");
    const child = await personId(cookie, projectId, "子");
    const parents = [
      await personId(cookie, projectId, "父一"),
      await personId(cookie, projectId, "父二"),
      await personId(cookie, projectId, "父三"),
    ];

    for (const parent of parents.slice(0, 2)) {
      const created = await createRelation(cookie, projectId, {
        fromPersonId: parent,
        toPersonId: child,
        kind: "biological_parent",
      });
      expect(created.status).toBe(201);
    }

    const third = await createRelation(cookie, projectId, {
      fromPersonId: parents[2],
      toPersonId: child,
      kind: "biological_parent",
    });
    expect(third.status).toBe(409);
    expect(third.json.code).toBe("PARENT_LIMIT");
    expect(third.json.message).toBe("同类型父母边已达上限");

    await expect(
      withAdminDb((client) =>
        client.query(
          `INSERT INTO person_relation (
             organization_id, project_id, from_person_id, to_person_id, kind
           ) VALUES ($1, $2, $3, $4, 'biological_parent')`,
          [organizationId, projectId, parents[2], child],
        ),
      ),
    ).rejects.toMatchObject({ code: "GX011" });

    const heirs = [
      await personId(cookie, projectId, "嗣一"),
      await personId(cookie, projectId, "嗣二"),
      await personId(cookie, projectId, "嗣三"),
    ];
    await withAdminDb(async (client) => {
      for (const heir of heirs) {
        await client.query(
          `INSERT INTO person_relation (
             organization_id, project_id, from_person_id, to_person_id, kind
           ) VALUES ($1, $2, $3, $4, 'ritual_heir')`,
          [organizationId, projectId, heir, child],
        );
      }
      const count = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM person_relation
          WHERE project_id = $1 AND to_person_id = $2 AND kind = 'ritual_heir'`,
        [projectId, child],
      );
      expect(count.rows[0]?.count).toBe("3");
    });
  });
});
