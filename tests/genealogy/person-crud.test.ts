import { describe, expect, test } from "vitest";
import { withAdminDb } from "../auth/fixtures";
import { call, createPerson, seedOwnerProject } from "./fixtures/helpers";

describe("person CRUD (genealogy)", () => {
  test("create, read, update with version conflict, and delete cascades", async () => {
    const { cookie, projectId } = await seedOwnerProject("person-crud");

    const created = await createPerson(cookie, projectId, {
      displayName: "张明德",
      sex: "male",
      surname: "张",
      birthYear: 1920,
    });
    expect(created.status).toBe(201);
    expect(created.json.ok).toBe(true);
    const person = created.data?.person as Record<string, unknown>;
    expect(person.displayName).toBe("张明德");
    expect(person.sex).toBe("male");
    expect(person.version).toBe(1);
    expect(person.projectId).toBe(projectId);

    const fetched = await call(
      `/api/v1/projects/${projectId}/persons/${person.id}`,
      cookie,
    );
    expect(fetched.status).toBe(200);
    expect((fetched.data?.person as { displayName: string }).displayName).toBe(
      "张明德",
    );

    const listed = await call(`/api/v1/projects/${projectId}/persons`, cookie);
    expect(listed.status).toBe(200);
    expect(
      (listed.data?.persons as { id: string }[]).some(
        (item) => item.id === person.id,
      ),
    ).toBe(true);

    const patched = await call(
      `/api/v1/projects/${projectId}/persons/${person.id}`,
      cookie,
      {
        method: "PATCH",
        body: JSON.stringify({ displayName: "张明德（修订）", version: 1 }),
      },
    );
    expect(patched.status).toBe(200);
    const patchedPerson = patched.data?.person as {
      displayName: string;
      surname: string | null;
      birthYear: number | null;
      deathYear: number | null;
      version: number;
    };
    expect(patchedPerson.displayName).toBe("张明德（修订）");
    expect(patchedPerson.surname).toBe("张");
    expect(patchedPerson.birthYear).toBe(1920);
    expect(patchedPerson.deathYear).toBeNull();
    expect(patchedPerson.version).toBe(2);

    const cleared = await call(
      `/api/v1/projects/${projectId}/persons/${person.id}`,
      cookie,
      {
        method: "PATCH",
        body: JSON.stringify({ surname: null, birthYear: null, version: 2 }),
      },
    );
    expect(cleared.status).toBe(200);
    expect(
      (cleared.data?.person as { surname: string | null }).surname,
    ).toBeNull();
    expect(
      (cleared.data?.person as { birthYear: number | null }).birthYear,
    ).toBeNull();
    expect((cleared.data?.person as { version: number }).version).toBe(3);

    const stale = await call(
      `/api/v1/projects/${projectId}/persons/${person.id}`,
      cookie,
      {
        method: "PATCH",
        body: JSON.stringify({ displayName: "冲突", version: 2 }),
      },
    );
    expect(stale.status).toBe(409);
    expect(stale.json.code).toBe("VERSION_CONFLICT");

    const child = await createPerson(cookie, projectId, {
      displayName: "张子",
    });
    const childId = (child.data?.person as { id: string }).id;
    const edge = await call(`/api/v1/projects/${projectId}/relations`, cookie, {
      method: "POST",
      body: JSON.stringify({
        fromPersonId: person.id,
        toPersonId: childId,
        kind: "biological_parent",
      }),
    });
    expect(edge.status).toBe(201);

    const removed = await call(
      `/api/v1/projects/${projectId}/persons/${person.id}`,
      cookie,
      { method: "DELETE" },
    );
    expect(removed.status).toBe(200);

    const after = await call(
      `/api/v1/projects/${projectId}/persons/${person.id}`,
      cookie,
    );
    expect(after.status).toBe(404);

    const residual = await withAdminDb(async (client) => {
      const relations = await client.query(
        `SELECT count(*)::int AS n FROM person_relation
         WHERE project_id = $1
           AND (from_person_id = $2 OR to_person_id = $2)`,
        [projectId, person.id],
      );
      const projection = await client.query(
        `SELECT count(*)::int AS n FROM lineage_projection
         WHERE project_id = $1 AND person_id = $2`,
        [projectId, person.id],
      );
      const names = await client.query(
        `SELECT count(*)::int AS n FROM person_name
         WHERE project_id = $1 AND person_id = $2`,
        [projectId, person.id],
      );
      return {
        relations: relations.rows[0].n as number,
        projection: projection.rows[0].n as number,
        names: names.rows[0].n as number,
      };
    });
    expect(residual.relations).toBe(0);
    expect(residual.projection).toBe(0);
    expect(residual.names).toBe(0);
  });

  test("blank displayName is rejected", async () => {
    const { cookie, projectId } = await seedOwnerProject("person-blank");
    const result = await createPerson(cookie, projectId, {
      displayName: "   ",
    });
    expect(result.status).toBe(400);
    expect(result.json.code).toBe("VALIDATION");
  });

  test("deleting a child person with a parent relation succeeds cleanly", async () => {
    const { cookie, projectId } = await seedOwnerProject("person-del-child");
    const parent = await createPerson(cookie, projectId, { displayName: "父" });
    const child = await createPerson(cookie, projectId, { displayName: "子" });
    const parentId = (parent.data?.person as { id: string }).id;
    const childId = (child.data?.person as { id: string }).id;

    const edge = await call(`/api/v1/projects/${projectId}/relations`, cookie, {
      method: "POST",
      body: JSON.stringify({
        fromPersonId: parentId,
        toPersonId: childId,
        kind: "biological_parent",
      }),
    });
    expect(edge.status).toBe(201);

    const removedChild = await call(
      `/api/v1/projects/${projectId}/persons/${childId}`,
      cookie,
      { method: "DELETE" },
    );
    expect(removedChild.status).toBe(200);

    const after = await call(
      `/api/v1/projects/${projectId}/persons/${childId}`,
      cookie,
    );
    expect(after.status).toBe(404);
  });
});
