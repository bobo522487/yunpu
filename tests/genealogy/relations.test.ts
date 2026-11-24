import { describe, expect, test } from "vitest";
import { withAdminDb } from "../auth/fixtures";
import {
  call,
  createPerson,
  createRelation,
  seedOwnerProject,
} from "./fixtures/helpers";

describe("person relations (genealogy)", () => {
  test("accepts parent and spouse edges with normalized spouse order", async () => {
    const { cookie, projectId } = await seedOwnerProject("rel-ok");
    const a = await createPerson(cookie, projectId, { displayName: "甲" });
    const b = await createPerson(cookie, projectId, { displayName: "乙" });
    const c = await createPerson(cookie, projectId, { displayName: "丙" });
    const aId = (a.data?.person as { id: string }).id;
    const bId = (b.data?.person as { id: string }).id;
    const cId = (c.data?.person as { id: string }).id;

    const parent = await createRelation(cookie, projectId, {
      fromPersonId: aId,
      toPersonId: cId,
      kind: "biological_parent",
    });
    expect(parent.status).toBe(201);

    const [lo, hi] = aId < bId ? [aId, bId] : [bId, aId];
    const spouse = await createRelation(cookie, projectId, {
      fromPersonId: hi,
      toPersonId: lo,
      kind: "spouse",
    });
    expect(spouse.status).toBe(201);
    const relation = spouse.data?.relation as {
      fromPersonId: string;
      toPersonId: string;
    };
    expect(relation.fromPersonId).toBe(lo);
    expect(relation.toPersonId).toBe(hi);
  });

  test("rejects self-loop and reverse spouse as conflict", async () => {
    const { cookie, projectId } = await seedOwnerProject("rel-self");
    const a = await createPerson(cookie, projectId, { displayName: "甲" });
    const b = await createPerson(cookie, projectId, { displayName: "乙" });
    const aId = (a.data?.person as { id: string }).id;
    const bId = (b.data?.person as { id: string }).id;

    const self = await createRelation(cookie, projectId, {
      fromPersonId: aId,
      toPersonId: aId,
      kind: "biological_parent",
    });
    expect(self.status).toBe(400);
    expect(self.json.code).toBe("VALIDATION");

    const first = await createRelation(cookie, projectId, {
      fromPersonId: aId,
      toPersonId: bId,
      kind: "spouse",
    });
    expect(first.status).toBe(201);

    const reverse = await createRelation(cookie, projectId, {
      fromPersonId: bId,
      toPersonId: aId,
      kind: "spouse",
    });
    expect(reverse.status).toBe(409);
    expect(reverse.json.code).toBe("CONFLICT");
  });

  test("third biological or adoptive parent yields PARENT_LIMIT", async () => {
    const { cookie, projectId } = await seedOwnerProject("rel-limit");
    const child = await createPerson(cookie, projectId, { displayName: "子" });
    const childId = (child.data?.person as { id: string }).id;

    for (const label of ["父1", "父2", "父3"]) {
      const parent = await createPerson(cookie, projectId, {
        displayName: label,
      });
      const result = await createRelation(cookie, projectId, {
        fromPersonId: (parent.data?.person as { id: string }).id,
        toPersonId: childId,
        kind: "biological_parent",
      });
      if (label === "父3") {
        expect(result.status).toBe(409);
        expect(result.json.code).toBe("PARENT_LIMIT");
      } else {
        expect(result.status).toBe(201);
      }
    }

    for (const label of ["养1", "养2", "养3"]) {
      const parent = await createPerson(cookie, projectId, {
        displayName: label,
      });
      const result = await createRelation(cookie, projectId, {
        fromPersonId: (parent.data?.person as { id: string }).id,
        toPersonId: childId,
        kind: "adoptive_parent",
      });
      if (label === "养3") {
        expect(result.status).toBe(409);
        expect(result.json.code).toBe("PARENT_LIMIT");
      } else {
        expect(result.status).toBe(201);
      }
    }
  });

  test("ancestor cycle maps to CYCLE_DETECTED and rolls back", async () => {
    const { cookie, projectId } = await seedOwnerProject("rel-cycle");
    const a = await createPerson(cookie, projectId, { displayName: "祖" });
    const b = await createPerson(cookie, projectId, { displayName: "父" });
    const c = await createPerson(cookie, projectId, { displayName: "子" });
    const aId = (a.data?.person as { id: string }).id;
    const bId = (b.data?.person as { id: string }).id;
    const cId = (c.data?.person as { id: string }).id;

    expect(
      (
        await createRelation(cookie, projectId, {
          fromPersonId: aId,
          toPersonId: bId,
          kind: "biological_parent",
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await createRelation(cookie, projectId, {
          fromPersonId: bId,
          toPersonId: cId,
          kind: "biological_parent",
        })
      ).status,
    ).toBe(201);

    const cycle = await createRelation(cookie, projectId, {
      fromPersonId: cId,
      toPersonId: aId,
      kind: "biological_parent",
    });
    expect(cycle.status).toBe(409);
    expect(cycle.json.code).toBe("CYCLE_DETECTED");

    const count = await withAdminDb(async (client) => {
      const result = await client.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM person_relation
         WHERE project_id = $1
           AND from_person_id = $2 AND to_person_id = $3`,
        [projectId, cId, aId],
      );
      return result.rows[0].n;
    });
    expect(count).toBe(0);
  });

  test("illegal API kind is validation error", async () => {
    const { cookie, projectId } = await seedOwnerProject("rel-kind");
    const a = await createPerson(cookie, projectId, { displayName: "甲" });
    const b = await createPerson(cookie, projectId, { displayName: "乙" });
    const result = await createRelation(cookie, projectId, {
      fromPersonId: (a.data?.person as { id: string }).id,
      toPersonId: (b.data?.person as { id: string }).id,
      kind: "step_parent",
    });
    expect(result.status).toBe(400);
    expect(result.json.code).toBe("VALIDATION");
  });

  test("delete relation succeeds", async () => {
    const { cookie, projectId } = await seedOwnerProject("rel-del");
    const a = await createPerson(cookie, projectId, { displayName: "甲" });
    const b = await createPerson(cookie, projectId, { displayName: "乙" });
    const edge = await createRelation(cookie, projectId, {
      fromPersonId: (a.data?.person as { id: string }).id,
      toPersonId: (b.data?.person as { id: string }).id,
      kind: "biological_parent",
    });
    const relationId = (edge.data?.relation as { id: string }).id;
    const removed = await call(
      `/api/v1/projects/${projectId}/relations/${relationId}`,
      cookie,
      { method: "DELETE" },
    );
    expect(removed.status).toBe(200);
  });
});
