import { describe, expect, test } from "vitest";
import {
  createOrganization,
  signUp,
  uniqueEmail,
  withAdminDb,
} from "../auth/fixtures";
import {
  call,
  createPerson,
  createRelation,
  seedOwnerProject,
} from "./fixtures/helpers";

describe("controlled subgraph", () => {
  test("returns bounded neighborhood with defaults and hasMore flags", async () => {
    const { cookie, projectId } = await seedOwnerProject("sub-basic");

    const ids: string[] = [];
    for (let i = 0; i < 8; i += 1) {
      const person = await createPerson(cookie, projectId, {
        displayName: `P${i}`,
      });
      ids.push((person.data?.person as { id: string }).id);
    }
    // Chain: 0→1→2→3→4→5→6→7
    for (let i = 0; i < 7; i += 1) {
      const edge = await createRelation(cookie, projectId, {
        fromPersonId: ids[i],
        toPersonId: ids[i + 1],
        kind: "biological_parent",
      });
      expect(edge.status).toBe(201);
    }

    const root = ids[3];
    const result = await call(
      `/api/v1/projects/${projectId}/subgraph?rootPersonId=${root}`,
      cookie,
    );
    expect(result.status).toBe(200);
    expect(result.json.ok).toBe(true);
    const data = result.data as {
      rootPersonId: string;
      persons: unknown[];
      relations: unknown[];
      hasMoreAncestors: boolean;
      hasMoreDescendants: boolean;
    };
    expect(data.rootPersonId).toBe(root);
    expect(data.persons.length).toBeLessThanOrEqual(300);
    // default up=2 → ancestors 2,1 ; down=4 → 4,5,6,7 ; plus root
    expect(data.persons.length).toBe(7);
    expect(data.hasMoreAncestors).toBe(true);
    expect(data.hasMoreDescendants).toBe(false);

    const limited = await call(
      `/api/v1/projects/${projectId}/subgraph?rootPersonId=${root}&upDepth=10&downDepth=10&limit=3`,
      cookie,
    );
    expect(limited.status).toBe(200);
    const limitedData = limited.data as {
      persons: unknown[];
      hasMoreAncestors: boolean;
      hasMoreDescendants: boolean;
    };
    expect(limitedData.persons.length).toBeLessThanOrEqual(3);
    expect(limitedData.hasMoreAncestors || limitedData.hasMoreDescendants).toBe(
      true,
    );
  });

  test("missing root returns 404", async () => {
    const { cookie, projectId } = await seedOwnerProject("sub-missing");
    const result = await call(
      `/api/v1/projects/${projectId}/subgraph?rootPersonId=01900000-0000-7000-8000-000000000001`,
      cookie,
    );
    expect(result.status).toBe(404);
    expect(result.json.code).toBe("NOT_FOUND");
  });

  test("cross-tenant subgraph is not readable", async () => {
    const owner = await seedOwnerProject("sub-tenant-a");
    const person = await createPerson(owner.cookie, owner.projectId, {
      displayName: "根",
    });
    const personId = (person.data?.person as { id: string }).id;

    const stranger = await signUp(uniqueEmail("sub-tenant-b"));
    await createOrganization(stranger.cookie, "租户B");

    const result = await call(
      `/api/v1/projects/${owner.projectId}/subgraph?rootPersonId=${personId}`,
      stranger.cookie,
    );
    expect(result.status).toBe(404);
  });

  test("a ritual_heir ancestor keeps its connecting edge", async () => {
    const { cookie, projectId, organizationId } =
      await seedOwnerProject("sub-ritual");
    const ancestor = await createPerson(cookie, projectId, {
      displayName: "嗣父母",
    });
    const heir = await createPerson(cookie, projectId, {
      displayName: "嗣子",
    });
    const ancestorId = (ancestor.data?.person as { id: string }).id;
    const heirId = (heir.data?.person as { id: string }).id;

    // The API deliberately accepts only the three product-facing kinds, but
    // historical/imported ritual_heir edges can exist in the database.
    await withAdminDb(async (client) => {
      await client.query(
        `INSERT INTO person_relation (
           organization_id, project_id, from_person_id, to_person_id, kind
         ) VALUES ($1, $2, $3, $4, 'ritual_heir')`,
        [organizationId, projectId, ancestorId, heirId],
      );
    });

    const result = await call(
      `/api/v1/projects/${projectId}/subgraph?rootPersonId=${heirId}&upDepth=1&downDepth=0`,
      cookie,
    );
    expect(result.status).toBe(200);
    const data = result.data as {
      persons: Array<{ id: string }>;
      relations: Array<{
        kind: string;
        fromPersonId: string;
        toPersonId: string;
      }>;
    };
    expect(data.persons.map((person) => person.id)).toContain(ancestorId);
    expect(data.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "ritual_heir",
          fromPersonId: ancestorId,
          toPersonId: heirId,
        }),
      ]),
    );
  });
});
