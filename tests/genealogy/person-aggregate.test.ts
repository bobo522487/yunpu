import { describe, expect, test } from "vitest";
import { OPENAPI_OPERATIONS } from "../../apps/api/src/openapi/operations";
import { withAdminDb } from "../auth/fixtures";
import {
  call,
  createPerson,
  createRelation,
  seedOwnerProject,
} from "./fixtures/helpers";

function assertMatchesContract(
  method: "post" | "put",
  path: string,
  payload: unknown,
) {
  const op = OPENAPI_OPERATIONS.find(
    (entry) => entry.method === method && entry.path === path,
  );
  if (!op) throw new Error(`Missing OpenAPI operation: ${method} ${path}`);
  const parsed = op.success.safeParse(payload);
  expect(
    parsed.success,
    parsed.success ? "" : JSON.stringify(parsed.error.issues),
  ).toBe(true);
}

describe("person aggregate & atomic relative endpoints (genealogy)", () => {
  test("PUT /persons/:personId/aggregate atomically updates scalar, names, events, relations and projection", async () => {
    const { cookie, projectId } = await seedOwnerProject("agg-ok");
    const fatherA = await createPerson(cookie, projectId, {
      displayName: "张父甲",
      sex: "unknown",
    });
    const fatherB = await createPerson(cookie, projectId, {
      displayName: "张父乙",
      sex: "unknown",
    });
    const mother = await createPerson(cookie, projectId, {
      displayName: "林母",
      sex: "female",
    });
    const child = await createPerson(cookie, projectId, {
      displayName: "张子",
      surname: "张",
      givenName: "子",
      sex: "male",
    });

    const fatherAId = (fatherA.data?.person as { id: string }).id;
    const fatherBId = (fatherB.data?.person as { id: string }).id;
    const motherId = (mother.data?.person as { id: string }).id;
    const childId = (child.data?.person as { id: string }).id;

    // Seed two biological parents (fatherA has sex=unknown) + 1 alias + 1 event
    const edgeA = await createRelation(cookie, projectId, {
      fromPersonId: fatherAId,
      toPersonId: childId,
      kind: "biological_parent",
    });
    const edgeM = await createRelation(cookie, projectId, {
      fromPersonId: motherId,
      toPersonId: childId,
      kind: "biological_parent",
    });
    const edgeAId = (edgeA.data?.relation as { id: string }).id;
    const edgeMId = (edgeM.data?.relation as { id: string }).id;

    const n1 = await call(
      `/api/v1/projects/${projectId}/persons/${childId}/names`,
      cookie,
      {
        method: "POST",
        body: JSON.stringify({ kind: "courtesy", value: "旧字", label: "字" }),
      },
    );
    const n2 = await call(
      `/api/v1/projects/${projectId}/persons/${childId}/names`,
      cookie,
      {
        method: "POST",
        body: JSON.stringify({ kind: "milk", value: "阿宝", label: "乳名" }),
      },
    );
    const e1 = await call(
      `/api/v1/projects/${projectId}/persons/${childId}/events`,
      cookie,
      {
        method: "POST",
        body: JSON.stringify({
          type: "education",
          description: "入私塾",
          sortOrder: 0,
        }),
      },
    );

    const n1Id = (n1.data?.name as { id: string }).id;
    const n2Id = (n2.data?.name as { id: string }).id;
    const e1Id = (e1.data?.event as { id: string }).id;

    // Replace fatherA -> fatherB explicitly by edge ID (even though fatherA & fatherB are sex=unknown and child already had 2 biological parents)
    const agg = await call(
      `/api/v1/projects/${projectId}/persons/${childId}/aggregate`,
      cookie,
      {
        method: "PUT",
        body: JSON.stringify({
          version: 1,
          person: {
            displayName: "张仲子",
            givenName: "仲子",
            notes: "聚合修订",
          },
          names: {
            deleteIds: [n2Id],
            update: [{ id: n1Id, value: "新字" }],
            create: [{ kind: "art", value: "松筠", label: "号" }],
          },
          events: {
            update: [{ id: e1Id, description: "入郡学", sortOrder: 0 }],
            create: [{ type: "career", description: "任县丞", sortOrder: 1 }],
          },
          relations: {
            deleteIds: [edgeAId],
            update: [{ id: edgeMId, toRoleLabel: "生子" }],
            create: [
              {
                fromPersonId: fatherBId,
                toPersonId: childId,
                kind: "biological_parent",
                toRoleLabel: "生子",
              },
            ],
          },
        }),
      },
    );

    expect(agg.status).toBe(200);
    assertMatchesContract(
      "put",
      "/api/v1/projects/{projectId}/persons/{personId}/aggregate",
      agg.json,
    );

    const data = agg.data as {
      person: {
        version: number;
        displayName: string;
        givenName: string;
        notes: string;
        names: { kind: string; value: string; isPrimary: boolean }[];
        events: { type: string; description: string }[];
      };
      relations: { fromPersonId: string; toPersonId: string; kind: string }[];
      projection: { primaryPath: string; generation: number } | null;
    };

    expect(data.person.version).toBe(2);
    expect(data.person.displayName).toBe("张仲子");
    expect(data.person.givenName).toBe("仲子");
    expect(data.person.notes).toBe("聚合修订");
    expect(
      data.person.names
        .filter((n) => !n.isPrimary)
        .map((n) => `${n.kind}:${n.value}`),
    ).toEqual(["courtesy:新字", "art:松筠"]);
    expect(data.person.events.map((e) => e.description)).toEqual([
      "入郡学",
      "任县丞",
    ]);
    expect(data.relations).toHaveLength(2);
    expect(data.relations.some((r) => r.fromPersonId === fatherBId)).toBe(true);
    expect(data.relations.some((r) => r.fromPersonId === fatherAId)).toBe(
      false,
    );
    expect(data.projection?.generation).toBe(1);

    // Stale CAS version fails cleanly with 409 VERSION_CONFLICT
    const stale = await call(
      `/api/v1/projects/${projectId}/persons/${childId}/aggregate`,
      cookie,
      {
        method: "PUT",
        body: JSON.stringify({
          version: 1,
          person: { notes: "不应写入" },
        }),
      },
    );
    expect(stale.status).toBe(409);
    expect(stale.json.code).toBe("VERSION_CONFLICT");
  });

  test("PUT /persons/:personId/aggregate rolls back scalar fields, version, names, events & projection on GX001 ancestor cycle", async () => {
    const { cookie, projectId } = await seedOwnerProject("agg-cycle-rb");
    const grand = await createPerson(cookie, projectId, {
      displayName: "祖",
      givenName: "祖",
    });
    const parent = await createPerson(cookie, projectId, {
      displayName: "父",
      givenName: "父",
    });
    const child = await createPerson(cookie, projectId, {
      displayName: "子",
      givenName: "子",
      notes: "原始备注",
    });
    const grandId = (grand.data?.person as { id: string }).id;
    const parentId = (parent.data?.person as { id: string }).id;
    const childId = (child.data?.person as { id: string }).id;

    expect(
      (
        await createRelation(cookie, projectId, {
          fromPersonId: grandId,
          toPersonId: parentId,
          kind: "biological_parent",
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await createRelation(cookie, projectId, {
          fromPersonId: parentId,
          toPersonId: childId,
          kind: "biological_parent",
        })
      ).status,
    ).toBe(201);

    // Simultaneously mutate grand's scalar fields + add alias + add event + add cyclic parent edge (child -> grand)
    const failed = await call(
      `/api/v1/projects/${projectId}/persons/${grandId}/aggregate`,
      cookie,
      {
        method: "PUT",
        body: JSON.stringify({
          version: 1,
          person: {
            displayName: "祖（被非法修改）",
            givenName: "非法",
            notes: "不应持久化",
          },
          names: {
            create: [{ kind: "courtesy", value: "不应存在" }],
          },
          events: {
            create: [{ type: "other", description: "不应存在事件" }],
          },
          relations: {
            create: [
              {
                fromPersonId: childId,
                toPersonId: grandId,
                kind: "biological_parent",
              },
            ],
          },
        }),
      },
    );

    expect(failed.status).toBe(409);
    expect(failed.json.code).toBe("CYCLE_DETECTED");

    // Verify in PostgreSQL that grand's version, scalar fields, names, events, and projection are completely intact
    const snapshot = await withAdminDb(async (client) => {
      const p = await client.query<{
        version: number;
        given_name: string | null;
        notes: string | null;
      }>(
        `SELECT version, given_name, notes FROM person WHERE project_id = $1 AND id = $2`,
        [projectId, grandId],
      );
      const pn = await client.query<{ value: string }>(
        `SELECT value FROM person_name WHERE project_id = $1 AND person_id = $2 ORDER BY is_primary DESC`,
        [projectId, grandId],
      );
      const pe = await client.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM person_event WHERE project_id = $1 AND person_id = $2`,
        [projectId, grandId],
      );
      const rel = await client.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM person_relation WHERE project_id = $1 AND from_person_id = $2 AND to_person_id = $3`,
        [projectId, childId, grandId],
      );
      const proj = await client.query<{ generation: number }>(
        `SELECT generation FROM lineage_projection WHERE project_id = $1 AND person_id = $2`,
        [projectId, grandId],
      );
      return {
        person: p.rows[0],
        names: pn.rows.map((r) => r.value),
        eventCount: pe.rows[0].n,
        cyclicEdgeCount: rel.rows[0].n,
        generation: proj.rows[0].generation,
      };
    });

    expect(snapshot.person).toEqual({
      version: 1,
      given_name: "祖",
      notes: null,
    });
    expect(snapshot.names).toEqual(["祖"]);
    expect(snapshot.eventCount).toBe(0);
    expect(snapshot.cyclicEdgeCount).toBe(0);
    expect(snapshot.generation).toBe(0);
  });

  test("PUT /persons/:personId/aggregate rolls back scalar fields & version on GX011 parent limit", async () => {
    const { cookie, projectId } = await seedOwnerProject("agg-limit-rb");
    const p1 = await createPerson(cookie, projectId, { displayName: "父1" });
    const p2 = await createPerson(cookie, projectId, { displayName: "父2" });
    const p3 = await createPerson(cookie, projectId, { displayName: "父3" });
    const child = await createPerson(cookie, projectId, {
      displayName: "子",
      givenName: "子",
    });

    const p1Id = (p1.data?.person as { id: string }).id;
    const p2Id = (p2.data?.person as { id: string }).id;
    const p3Id = (p3.data?.person as { id: string }).id;
    const childId = (child.data?.person as { id: string }).id;

    await createRelation(cookie, projectId, {
      fromPersonId: p1Id,
      toPersonId: childId,
      kind: "biological_parent",
    });
    await createRelation(cookie, projectId, {
      fromPersonId: p2Id,
      toPersonId: childId,
      kind: "biological_parent",
    });

    const failed = await call(
      `/api/v1/projects/${projectId}/persons/${childId}/aggregate`,
      cookie,
      {
        method: "PUT",
        body: JSON.stringify({
          version: 1,
          person: { displayName: "子（不应改）", givenName: "不应改" },
          relations: {
            create: [
              {
                fromPersonId: p3Id,
                toPersonId: childId,
                kind: "biological_parent",
              },
            ],
          },
        }),
      },
    );

    expect(failed.status).toBe(409);
    expect(failed.json.code).toBe("PARENT_LIMIT");

    const fetched = await call(
      `/api/v1/projects/${projectId}/persons/${childId}`,
      cookie,
    );
    const loaded = fetched.data?.person as {
      version: number;
      displayName: string;
      givenName: string;
    };
    expect(loaded.version).toBe(1);
    expect(loaded.displayName).toBe("子");
    expect(loaded.givenName).toBe("子");
  });

  test("POST /projects/:projectId/relatives atomically creates child+companion, spouse+dual-events, parent reflow, and rolls back on failure", async () => {
    const { cookie, projectId } = await seedOwnerProject("relatives-tx");
    const rootRes = await createPerson(cookie, projectId, {
      displayName: "陈旺",
      surname: "陈",
      givenName: "旺",
      sex: "male",
    });
    const rootId = (rootRes.data?.person as { id: string }).id;
    const rootLineageId = (rootRes.data?.person as { lineageId: string })
      .lineageId;

    // 1. Create child + secondary alias + event + auto-created companion mother atomically
    const childRes = await call(
      `/api/v1/projects/${projectId}/relatives`,
      cookie,
      {
        method: "POST",
        body: JSON.stringify({
          anchorPersonId: rootId,
          person: {
            lineageId: rootLineageId,
            displayName: "陈伯宣",
            surname: "陈",
            givenName: "伯宣",
            sex: "male",
          },
          names: [{ kind: "courtesy", value: "子宣", label: "字" }],
          events: [{ type: "career", description: "著家训", sortOrder: 0 }],
          relations: [
            {
              direction: "other_to_new",
              kind: "biological_parent",
              toRoleLabel: "生子",
            },
          ],
          companion: {
            person: {
              lineageId: rootLineageId,
              displayName: "不详",
              givenName: "不详",
              sex: "female",
              isLiving: true,
            },
            spouseRelation: { fromRoleLabel: "夫", toRoleLabel: "妻子" },
            childRelation: { kind: "biological_parent", toRoleLabel: "生子" },
          },
        }),
      },
    );
    expect(childRes.status).toBe(201);
    assertMatchesContract(
      "post",
      "/api/v1/projects/{projectId}/relatives",
      childRes.json,
    );
    const childData = childRes.data as {
      person: {
        id: string;
        names: { value: string }[];
        events: { description: string }[];
      };
      companionPerson: { id: string; displayName: string } | null;
      relations: { id: string }[];
    };
    expect(childData.companionPerson?.displayName).toBe("不详");
    expect(childData.relations).toHaveLength(3);
    expect(childData.person.names.map((n) => n.value)).toEqual([
      "陈伯宣",
      "子宣",
    ]);
    expect(childData.person.events.map((e) => e.description)).toEqual([
      "著家训",
    ]);

    // 2. Create spouse + dual marriage events atomically
    const spouseRes = await call(
      `/api/v1/projects/${projectId}/relatives`,
      cookie,
      {
        method: "POST",
        body: JSON.stringify({
          anchorPersonId: childData.person.id,
          person: {
            displayName: "李氏",
            surname: "李",
            givenName: "氏",
            sex: "female",
          },
          events: [{ type: "marriage", description: "与陈伯宣结缡" }],
          anchorEvents: [{ type: "marriage", description: "与李氏结缡" }],
          relations: [
            {
              direction: "other_to_new",
              kind: "spouse",
              fromRoleLabel: "夫",
              toRoleLabel: "妻子",
            },
          ],
        }),
      },
    );
    expect(spouseRes.status).toBe(201);
    assertMatchesContract(
      "post",
      "/api/v1/projects/{projectId}/relatives",
      spouseRes.json,
    );

    // 3. Add parent above root -> lineage_projection shifts root (gen 0->1) and child (gen 1->2)
    const parentRes = await call(
      `/api/v1/projects/${projectId}/relatives`,
      cookie,
      {
        method: "POST",
        body: JSON.stringify({
          anchorPersonId: rootId,
          person: { displayName: "陈始", surname: "陈", givenName: "始" },
          relations: [{ direction: "new_to_other", kind: "biological_parent" }],
        }),
      },
    );
    expect(parentRes.status).toBe(201);

    const gens = await withAdminDb(async (client) => {
      const res = await client.query<{ person_id: string; generation: number }>(
        `SELECT person_id, generation FROM lineage_projection WHERE project_id = $1`,
        [projectId],
      );
      return new Map(res.rows.map((r) => [r.person_id, r.generation]));
    });
    expect(gens.get(rootId)).toBe(1);
    expect(gens.get(childData.person.id)).toBe(2);

    // 4. Failure rollback: childData.person already has 2 biological parents (root + companion).
    // Adding a 3rd biological parent via POST /relatives with names, events & anchorEvents must fail GX011 and leave 0 orphan rows!
    const beforeCounts = await withAdminDb(async (client) => {
      const p = await client.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM person WHERE project_id = $1`,
        [projectId],
      );
      const pn = await client.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM person_name WHERE project_id = $1`,
        [projectId],
      );
      const pe = await client.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM person_event WHERE project_id = $1`,
        [projectId],
      );
      const lp = await client.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM lineage_projection WHERE project_id = $1`,
        [projectId],
      );
      return {
        persons: p.rows[0].n,
        names: pn.rows[0].n,
        events: pe.rows[0].n,
        projections: lp.rows[0].n,
      };
    });

    const failedRelative = await call(
      `/api/v1/projects/${projectId}/relatives`,
      cookie,
      {
        method: "POST",
        body: JSON.stringify({
          anchorPersonId: childData.person.id,
          person: { displayName: "非法第三亲", sex: "male" },
          names: [{ kind: "courtesy", value: "回滚字" }],
          events: [{ type: "other", description: "回滚事件" }],
          anchorEvents: [{ type: "other", description: "锚点不应新增事件" }],
          relations: [{ direction: "new_to_other", kind: "biological_parent" }],
        }),
      },
    );
    expect(failedRelative.status).toBe(409);
    expect(failedRelative.json.code).toBe("PARENT_LIMIT");

    const afterCounts = await withAdminDb(async (client) => {
      const p = await client.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM person WHERE project_id = $1`,
        [projectId],
      );
      const pn = await client.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM person_name WHERE project_id = $1`,
        [projectId],
      );
      const pe = await client.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM person_event WHERE project_id = $1`,
        [projectId],
      );
      const lp = await client.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM lineage_projection WHERE project_id = $1`,
        [projectId],
      );
      return {
        persons: p.rows[0].n,
        names: pn.rows[0].n,
        events: pe.rows[0].n,
        projections: lp.rows[0].n,
      };
    });

    expect(afterCounts).toEqual(beforeCounts);
  });
});
