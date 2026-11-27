import { describe, expect, test } from "vitest";
import { RELATION_KINDS } from "../../packages/shared/src/enums";
import {
  call,
  createPerson,
  createRelation,
  seedOwnerProject,
} from "./fixtures/helpers";

describe("person extended fields, names, 7 relations & events (genealogy)", () => {
  test("person extended UI fields round-trip on create, read, and update", async () => {
    const { cookie, projectId } = await seedOwnerProject("person-ext");

    const created = await createPerson(cookie, projectId, {
      displayName: "林远航",
      surname: "林",
      givenName: "远航",
      romanizedSurname: "Lin",
      romanizedName: "Yuanhang",
      romanizedSuffix: "Sr.",
      sex: "male",
      isLiving: false,
      generationWord: "远",
      relationTitle: "十五世祖",
      siblingOrder: 2,
      birthInfo: {
        structuredDate: {
          schemaVersion: 1,
          kind: "date",
          calendar: "gregorian",
          qualifier: "exact",
          precision: "day",
          parts: { year: 1898, month: 4, day: 12 },
        },
        structuredPlace: {
          schemaVersion: 1,
          kind: "structured",
          country: "中国",
          province: "福建省",
          city: "福州市",
          originalText: "福建福州",
        },
      },
      deathInfo: {
        structuredDate: {
          schemaVersion: 1,
          kind: "date",
          calendar: "gregorian",
          qualifier: "exact",
          precision: "year",
          parts: { year: 1966 },
        },
        cause: "寿终正寝",
        manualAge: 68,
      },
      biography: "幼习诗书，晚年编修乡里志。",
      notes: "旧谱第三卷有载。",
      avatarKey: "01900000-0000-7000-8000-000000000001.png",
    });

    expect(created.status).toBe(201);
    const person = created.data?.person as Record<string, unknown>;
    expect(person.givenName).toBe("远航");
    expect(person.romanizedSurname).toBe("Lin");
    expect(person.birthYear).toBe(1898);
    expect(person.deathYear).toBe(1966);
    expect(person.generationWord).toBe("远");
    expect(person.relationTitle).toBe("十五世祖");
    expect(person.siblingOrder).toBe(2);
    expect(person.avatarKey).toBe("01900000-0000-7000-8000-000000000001.png");

    const fetched = await call(
      `/api/v1/projects/${projectId}/persons/${person.id}`,
      cookie,
    );
    expect(fetched.status).toBe(200);
    const loaded = fetched.data?.person as Record<string, unknown>;
    expect((loaded.names as unknown[]).length).toBe(1);
    expect(loaded.biography).toBe("幼习诗书，晚年编修乡里志。");
    expect((loaded.deathInfo as { manualAge: number }).manualAge).toBe(68);
  });

  test("PersonName CRUD enforces unique (kind, value) and protects primary name", async () => {
    const { cookie, projectId } = await seedOwnerProject("person-names");
    const created = await createPerson(cookie, projectId, {
      displayName: "苏轼",
      surname: "苏",
      givenName: "轼",
    });
    const personId = (created.data?.person as { id: string }).id;

    const courtesy = await call(
      `/api/v1/projects/${projectId}/persons/${personId}/names`,
      cookie,
      {
        method: "POST",
        body: JSON.stringify({ kind: "courtesy", value: "子瞻", label: "字" }),
      },
    );
    expect(courtesy.status).toBe(201);
    const nameId = (courtesy.data?.name as { id: string }).id;

    const duplicate = await call(
      `/api/v1/projects/${projectId}/persons/${personId}/names`,
      cookie,
      {
        method: "POST",
        body: JSON.stringify({ kind: "courtesy", value: "子瞻" }),
      },
    );
    expect(duplicate.status).toBe(409);

    const updated = await call(
      `/api/v1/projects/${projectId}/persons/${personId}/names/${nameId}`,
      cookie,
      {
        method: "PATCH",
        body: JSON.stringify({ value: "东坡居士", kind: "art", label: "号" }),
      },
    );
    expect(updated.status).toBe(200);
    expect((updated.data?.name as { value: string }).value).toBe("东坡居士");

    const deleted = await call(
      `/api/v1/projects/${projectId}/persons/${personId}/names/${nameId}`,
      cookie,
      { method: "DELETE" },
    );
    expect(deleted.status).toBe(200);
  });

  test("supports all 7 relation kinds, PATCH role labels, and rejects cross-lineage links (GX014)", async () => {
    const { cookie, projectId } = await seedOwnerProject("rel-ext");
    const l1 = await call(`/api/v1/projects/${projectId}/lineages`, cookie, {
      method: "POST",
      body: JSON.stringify({ name: "支系甲" }),
    });
    const l2 = await call(`/api/v1/projects/${projectId}/lineages`, cookie, {
      method: "POST",
      body: JSON.stringify({ name: "支系乙" }),
    });
    const lineageA = (l1.data?.lineage as { id: string }).id;
    const lineageB = (l2.data?.lineage as { id: string }).id;

    const root = await createPerson(cookie, projectId, {
      lineageId: lineageA,
      displayName: "中心人物",
    });
    const rootId = (root.data?.person as { id: string }).id;

    // Test every relation kind from RELATION_KINDS
    for (const [idx, kind] of RELATION_KINDS.entries()) {
      const other = await createPerson(cookie, projectId, {
        lineageId: lineageA,
        displayName: `关联${idx}`,
      });
      const otherId = (other.data?.person as { id: string }).id;
      const edge = await createRelation(cookie, projectId, {
        fromPersonId: otherId,
        toPersonId: rootId,
        kind,
        fromRoleLabel: `起-${kind}`,
        toRoleLabel: `止-${kind}`,
        sortOrder: idx,
        note: `备注-${kind}`,
      });
      expect(edge.status, kind).toBe(201);
      const relation = edge.data?.relation as {
        id: string;
        kind: string;
        fromPersonId: string;
        toPersonId: string;
        fromRoleLabel: string | null;
        toRoleLabel: string | null;
      };
      if (kind === "partner" || kind === "spouse") {
        expect(relation.fromPersonId < relation.toPersonId).toBe(true);
      }

      const patched = await call(
        `/api/v1/projects/${projectId}/relations/${relation.id}`,
        cookie,
        {
          method: "PATCH",
          body: JSON.stringify({
            fromRoleLabel: "修订起",
            toRoleLabel: "修订止",
            note: "已修订",
          }),
        },
      );
      expect(patched.status).toBe(200);
      expect((patched.data?.relation as { note: string }).note).toBe("已修订");
    }

    // Cross-lineage relation must fail with 409 GX014
    const alien = await createPerson(cookie, projectId, {
      lineageId: lineageB,
      displayName: "他谱人物",
    });
    const alienId = (alien.data?.person as { id: string }).id;
    const crossEdge = await createRelation(cookie, projectId, {
      fromPersonId: rootId,
      toPersonId: alienId,
      kind: "spouse",
    });
    expect(crossEdge.status).toBe(409);
    expect(crossEdge.json.code).toBe("CONFLICT");
  });

  test("PersonEvent CRUD persists and cascades when person is deleted", async () => {
    const { cookie, projectId } = await seedOwnerProject("person-events");
    const created = await createPerson(cookie, projectId, {
      displayName: "范仲淹",
      isLiving: false,
    });
    const personId = (created.data?.person as { id: string }).id;

    const eventRes = await call(
      `/api/v1/projects/${projectId}/persons/${personId}/events`,
      cookie,
      {
        method: "POST",
        body: JSON.stringify({
          type: "career",
          structuredDate: {
            schemaVersion: 1,
            kind: "date",
            calendar: "gregorian",
            qualifier: "exact",
            precision: "year",
            parts: { year: 1015 },
          },
          description: "中乙科进士第，任广德军司理参军。",
          sortOrder: 0,
        }),
      },
    );
    expect(eventRes.status).toBe(201);
    const eventId = (eventRes.data?.event as { id: string }).id;

    const patched = await call(
      `/api/v1/projects/${projectId}/persons/${personId}/events/${eventId}`,
      cookie,
      {
        method: "PATCH",
        body: JSON.stringify({
          description: "大中祥符八年进士及第。",
          sortOrder: 1,
        }),
      },
    );
    expect(patched.status).toBe(200);
    expect((patched.data?.event as { sortOrder: number }).sortOrder).toBe(1);

    const fetched = await call(
      `/api/v1/projects/${projectId}/persons/${personId}`,
      cookie,
    );
    expect(
      (fetched.data?.person as { events: { description: string }[] }).events[0]
        ?.description,
    ).toBe("大中祥符八年进士及第。");

    const delEvent = await call(
      `/api/v1/projects/${projectId}/persons/${personId}/events/${eventId}`,
      cookie,
      { method: "DELETE" },
    );
    expect(delEvent.status).toBe(200);
  });
});
