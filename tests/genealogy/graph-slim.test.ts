import { describe, expect, test } from "vitest";
import { OPENAPI_OPERATIONS } from "../../apps/api/src/openapi/operations";
import { withAdminDb } from "../auth/fixtures";
import { call, seedOwnerProject } from "./fixtures/helpers";

describe("graph slimming, missing primary name leftJoin, and 1k windowed subgraph", () => {
  test("1,000 persons: missing primary names stay visible, /graph strips events (>=50% smaller), detail endpoint hydrates events, and /subgraph windows", async () => {
    const { cookie, organizationId, projectId } =
      await seedOwnerProject("graph-slim-1k");

    const lineageRes = await call(
      `/api/v1/projects/${projectId}/lineages`,
      cookie,
      {
        method: "POST",
        body: JSON.stringify({ name: "千人世系", surname: "张" }),
      },
    );
    expect(lineageRes.status).toBe(201);
    const lineageId = (lineageRes.data?.lineage as { id: string }).id;

    const personCount = 1000;
    const eventsPerPerson = 5;

    const seeded = await withAdminDb(async (client) => {
      await client.query("BEGIN");
      try {
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO person (
               organization_id, project_id, lineage_id, sex, surname, given_name, is_living, version
             )
             SELECT $1::uuid, $2::uuid, $3::uuid, 'male',
                    CASE WHEN gs.i = 2 THEN NULL ELSE '张' END,
                    CASE WHEN gs.i = 2 THEN NULL ELSE '名' || gs.i::text END,
                    true, 1
               FROM generate_series(1, $4) AS gs(i)
             RETURNING id`,
          [organizationId, projectId, lineageId, personCount],
        );
        const ids = inserted.rows.map((r) => r.id);
        // gs.i = 1 -> ids[0] (root, has primary name)
        // gs.i = 2 -> ids[1] (surname NULL, no primary name -> displayName '')
        // gs.i = 3 -> ids[2] (surname '张', no primary name -> displayName '张')
        const missingBlankId = ids[1];
        const missingSurnameOnlyId = ids[2];

        // Insert primary names for all except index 1 and 2
        const namedIds = ids.filter((_, idx) => idx !== 1 && idx !== 2);
        const namedLabels = ids
          .map((_, idx) => `张名${idx + 1}`)
          .filter((_, idx) => idx !== 1 && idx !== 2);

        await client.query(
          `INSERT INTO person_name (
               organization_id, project_id, person_id, kind, value, surname, is_primary
             )
             SELECT $1::uuid, $2::uuid, p.id, 'formal', p.val, '张', true
               FROM unnest($3::uuid[], $4::text[]) AS p(id, val)`,
          [organizationId, projectId, namedIds, namedLabels],
        );

        // Binary tree parent edges
        const fromIds: string[] = [];
        const toIds: string[] = [];
        for (let i = 1; i < ids.length; i += 1) {
          fromIds.push(ids[Math.floor((i - 1) / 2)]);
          toIds.push(ids[i]);
        }
        await client.query(
          `INSERT INTO person_relation (
               organization_id, project_id, from_person_id, to_person_id, kind
             )
             SELECT $1::uuid, $2::uuid, f, t, 'biological_parent'
               FROM unnest($3::uuid[], $4::uuid[]) AS e(f, t)`,
          [organizationId, projectId, fromIds, toIds],
        );

        // Build lineage_projection
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
          [organizationId, projectId, ids[0]],
        );

        // Seed 5 person_event rows per person (5,000 events total)
        await client.query(
          `INSERT INTO person_event (
               organization_id, project_id, person_id, type,
               structured_date, structured_place, description, sort_order
             )
             SELECT $1::uuid, $2::uuid, p.id, 'career',
                    '{"schemaVersion":1,"kind":"date","calendar":"gregorian","qualifier":"exact","precision":"year","parts":{"year":1920}}'::jsonb,
                    '{"schemaVersion":1,"kind":"structured","country":"中国","province":"江西省","city":"九江市","originalText":"江西九江义门陈氏宗祠"}'::jsonb,
                    '第' || s.n::text || '条生平履历记录：勤勉治学，修葺谱牒，垂范后世。',
                    s.n - 1
               FROM unnest($3::uuid[]) AS p(id)
               CROSS JOIN generate_series(1, $4) AS s(n)`,
          [organizationId, projectId, ids, eventsPerPerson],
        );

        // Query serialized event payloads for accurate baseline comparison
        const eventRes = await client.query<{
          id: string;
          projectId: string;
          personId: string;
          type: string;
          structuredDate: unknown;
          structuredPlace: unknown;
          description: string | null;
          sortOrder: number;
          createdAt: string;
          updatedAt: string;
        }>(
          `SELECT id,
                    project_id AS "projectId",
                    person_id AS "personId",
                    type,
                    structured_date AS "structuredDate",
                    structured_place AS "structuredPlace",
                    description,
                    sort_order AS "sortOrder",
                    to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt",
                    to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "updatedAt"
               FROM person_event
              WHERE project_id = $1::uuid
              ORDER BY person_id, sort_order`,
          [projectId],
        );

        await client.query("COMMIT");
        return {
          rootId: ids[0],
          missingBlankId,
          missingSurnameOnlyId,
          sampleId: ids[500],
          events: eventRes.rows,
        };
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    });

    // 1. /graph returns all 1,000 persons (missing primary name rows preserved!) without events
    const graphRes = await call(
      `/api/v1/projects/${projectId}/lineages/${lineageId}/graph`,
      cookie,
    );
    expect(graphRes.status).toBe(200);

    const graphOp = OPENAPI_OPERATIONS.find(
      (op) =>
        op.method === "get" &&
        op.path === "/api/v1/projects/{projectId}/lineages/{lineageId}/graph",
    );
    expect(graphOp?.success.safeParse(graphRes.json).success).toBe(true);

    const graphData = graphRes.data as {
      persons: Array<Record<string, unknown>>;
      relations: unknown[];
      projections: unknown[];
    };
    expect(graphData.persons).toHaveLength(1000);
    expect(graphData.relations).toHaveLength(999);
    expect(graphData.projections).toHaveLength(1000);

    const blankPerson = graphData.persons.find(
      (p) => p.id === seeded.missingBlankId,
    );
    const surnameOnlyPerson = graphData.persons.find(
      (p) => p.id === seeded.missingSurnameOnlyId,
    );
    expect(blankPerson).toBeDefined();
    expect(blankPerson?.displayName).toBe("");
    expect(surnameOnlyPerson).toBeDefined();
    expect(surnameOnlyPerson?.displayName).toBe("张");

    for (const p of graphData.persons) {
      expect("events" in p).toBe(false);
    }

    // 2. Compare slim /graph bytes vs full-events baseline (>= 50% reduction)
    const eventsByPerson = new Map<string, typeof seeded.events>();
    for (const ev of seeded.events) {
      const list = eventsByPerson.get(ev.personId) ?? [];
      list.push(ev);
      eventsByPerson.set(ev.personId, list);
    }

    const baselinePayload = {
      ...graphRes.json,
      data: {
        ...graphData,
        persons: graphData.persons.map((p) => ({
          ...p,
          events: eventsByPerson.get(p.id as string) ?? [],
        })),
      },
    };

    const slimBytes = Buffer.byteLength(JSON.stringify(graphRes.json), "utf8");
    const baselineBytes = Buffer.byteLength(
      JSON.stringify(baselinePayload),
      "utf8",
    );
    const reductionRatio = (baselineBytes - slimBytes) / baselineBytes;

    console.info(
      `[graph-slim-1k] baselineBytes=${baselineBytes}, slimBytes=${slimBytes}, reduction=${(reductionRatio * 100).toFixed(2)}%`,
    );
    expect(reductionRatio).toBeGreaterThanOrEqual(0.5);

    // 3. On-demand detail endpoint returns full names & events (including for missing-primary-name person)
    const detailRes = await call(
      `/api/v1/projects/${projectId}/persons/${seeded.sampleId}`,
      cookie,
    );
    expect(detailRes.status).toBe(200);
    const detailPerson = detailRes.data?.person as {
      names: unknown[];
      events: unknown[];
    };
    expect(detailPerson.names).toHaveLength(1);
    expect(detailPerson.events).toHaveLength(eventsPerPerson);

    const missingDetailRes = await call(
      `/api/v1/projects/${projectId}/persons/${seeded.missingSurnameOnlyId}`,
      cookie,
    );
    expect(missingDetailRes.status).toBe(200);
    expect(
      (missingDetailRes.data?.person as { displayName: string }).displayName,
    ).toBe("张");
    expect(
      (missingDetailRes.data?.person as { events: unknown[] }).events,
    ).toHaveLength(eventsPerPerson);

    // 4. Probe + windowed /subgraph returns bounded subset when exceeding threshold (200)
    const probeRes = await call(
      `/api/v1/projects/${projectId}/persons?lineageId=${lineageId}&limit=200`,
      cookie,
    );
    expect(probeRes.status).toBe(200);
    expect((probeRes.data?.persons as unknown[]).length).toBe(200);
    expect(probeRes.data?.nextCursor).toBeTruthy();

    const subgraphRes = await call(
      `/api/v1/projects/${projectId}/subgraph?rootPersonId=${seeded.rootId}&upDepth=2&downDepth=4&limit=120`,
      cookie,
    );
    expect(subgraphRes.status).toBe(200);
    const subData = subgraphRes.data as {
      rootPersonId: string;
      persons: Array<{ id: string; displayName: string }>;
      relations: unknown[];
      hasMoreAncestors: boolean;
      hasMoreDescendants: boolean;
    };
    expect(subData.rootPersonId).toBe(seeded.rootId);
    expect(subData.persons.length).toBeLessThanOrEqual(120);
    expect(subData.persons.length).toBeGreaterThan(0);
    expect(subData.hasMoreDescendants).toBe(true);
    expect(
      subData.persons.some((p) => p.id === seeded.missingSurnameOnlyId),
    ).toBe(true);
    expect(
      subData.persons.find((p) => p.id === seeded.missingBlankId)?.displayName,
    ).toBe("");
  }, 60_000);
});
