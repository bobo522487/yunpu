import { describe, expect, test } from "vitest";
import { call, createPerson, seedOwnerProject } from "./fixtures/helpers";

describe("keyset pagination", () => {
  test("listProjects rejects a malformed cursor before querying", async () => {
    const { cookie, organizationId } = await seedOwnerProject("project-cursor");
    const cursor = encodeURIComponent("not-a-timestamp|not-a-uuid");
    const response = await call(
      `/api/v1/organizations/${organizationId}/projects?cursor=${cursor}&limit=2`,
      cookie,
    );
    expect(response.status).toBe(400);
    expect(response.json.code).toBe("VALIDATION");
    expect(response.json.details?.cursor).toBe("游标格式不合法");
  });

  test("listPersons rejects a malformed cursor before querying", async () => {
    const { cookie, projectId } = await seedOwnerProject("person-cursor");
    const response = await call(
      `/api/v1/projects/${projectId}/persons?cursor=not-a-uuid&limit=2`,
      cookie,
    );
    expect(response.status).toBe(400);
    expect(response.json.code).toBe("VALIDATION");
    expect(response.json.details?.cursor).toBe("游标格式不合法");
  });

  test("listPersons returns bounded pages with a usable cursor", async () => {
    const { cookie, projectId } = await seedOwnerProject("person-page");
    const ids: string[] = [];
    for (const displayName of ["甲", "乙", "丙"]) {
      const person = await createPerson(cookie, projectId, { displayName });
      ids.push((person.data?.person as { id: string }).id);
    }

    const first = await call(
      `/api/v1/projects/${projectId}/persons?limit=2`,
      cookie,
    );
    expect(first.status).toBe(200);
    const page = first.data as {
      persons: Array<{ id: string }>;
      nextCursor: string | null;
    };
    expect(page.persons).toHaveLength(2);
    expect(page.nextCursor).toBeTruthy();

    const second = await call(
      `/api/v1/projects/${projectId}/persons?limit=2&cursor=${page.nextCursor}`,
      cookie,
    );
    expect(second.status).toBe(200);
    const next = second.data as {
      persons: Array<{ id: string }>;
      nextCursor: string | null;
    };
    expect(next.persons.map((person) => person.id)).toEqual([ids[2]]);
    expect(next.nextCursor).toBeNull();
  });

  test("listProjects has no trailing empty page on an exact boundary", async () => {
    const { cookie, organizationId } = await seedOwnerProject("project-page");
    const created = await call(
      `/api/v1/organizations/${organizationId}/projects`,
      cookie,
      { method: "POST", body: JSON.stringify({ name: "第二谱" }) },
    );
    expect(created.status).toBe(201);

    const response = await call(
      `/api/v1/organizations/${organizationId}/projects?limit=2`,
      cookie,
    );
    expect(response.status).toBe(200);
    const page = response.data as {
      items: unknown[];
      nextCursor: string | null;
    };
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBeNull();
  });
});
