import { describe, expect, test } from "vitest";
import { createOrganization, signUp, uniqueEmail } from "../auth/fixtures";
import { addMember } from "../fixtures/members";
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

  test("listProjects rejects numeric timestamp cursors before hitting Postgres", async () => {
    const { cookie, organizationId } = await seedOwnerProject("proj-num-cur");
    const cursor = encodeURIComponent("1|01900000-0000-7000-8000-000000000001");
    const response = await call(
      `/api/v1/organizations/${organizationId}/projects?cursor=${cursor}&limit=2`,
      cookie,
    );
    expect(response.status).toBe(400);
    expect(response.json.code).toBe("VALIDATION");
    expect(response.json.details?.cursor).toBe("游标格式不合法");
  });

  test("listMembers and listInvites validate cursors and omit trailing empty-page cursors", async () => {
    const owner = await signUp(uniqueEmail("page-org-o"));
    const createdOrg = await createOrganization(owner.cookie, "分页组织");
    const organizationId = (createdOrg.data?.organization as { id: string }).id;
    await addMember(organizationId, uniqueEmail("page-org-m"), "editor");

    const badMemberCursor = await call(
      `/api/v1/organizations/${organizationId}/members?cursor=bad-cursor`,
      owner.cookie,
    );
    expect(badMemberCursor.status).toBe(400);
    expect(badMemberCursor.json.code).toBe("VALIDATION");
    expect(badMemberCursor.json.details?.cursor).toBe("游标格式不合法");

    const exactMembers = await call(
      `/api/v1/organizations/${organizationId}/members?limit=2`,
      owner.cookie,
    );
    expect(exactMembers.status).toBe(200);
    expect((exactMembers.data?.items as unknown[]).length).toBe(2);
    expect(exactMembers.data?.nextCursor).toBeNull();

    const firstInvite = await call(
      `/api/v1/organizations/${organizationId}/invites`,
      owner.cookie,
      {
        method: "POST",
        body: JSON.stringify({ email: uniqueEmail("page-inv-1") }),
      },
    );
    expect(firstInvite.status).toBe(201);
    const secondInvite = await call(
      `/api/v1/organizations/${organizationId}/invites`,
      owner.cookie,
      {
        method: "POST",
        body: JSON.stringify({ email: uniqueEmail("page-inv-2") }),
      },
    );
    expect(secondInvite.status).toBe(201);

    const badInviteCursor = await call(
      `/api/v1/organizations/${organizationId}/invites?cursor=not-valid`,
      owner.cookie,
    );
    expect(badInviteCursor.status).toBe(400);
    expect(badInviteCursor.json.code).toBe("VALIDATION");

    const exactInvites = await call(
      `/api/v1/organizations/${organizationId}/invites?limit=2`,
      owner.cookie,
    );
    expect(exactInvites.status).toBe(200);
    expect((exactInvites.data?.items as unknown[]).length).toBe(2);
    expect(exactInvites.data?.nextCursor).toBeNull();
  });

  test("empty PATCH payload preserves top-level refine error in details._form", async () => {
    const { cookie, projectId } = await seedOwnerProject("empty-patch");
    const response = await call(`/api/v1/projects/${projectId}`, cookie, {
      method: "PATCH",
      body: JSON.stringify({ version: 1 }),
    });
    expect(response.status).toBe(400);
    expect(response.json.code).toBe("VALIDATION");
    expect(response.json.details?._form).toEqual(["至少提供一个要修改的字段"]);
  });
});
