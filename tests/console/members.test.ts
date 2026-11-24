import { describe, expect, test } from "vitest";
import {
  createOrganization,
  type JsonResponse,
  request,
  signUp,
  uniqueEmail,
  withAdminDb,
} from "../auth/fixtures";

async function call(
  path: string,
  cookie: string | null,
  init: RequestInit = {},
): Promise<{
  status: number;
  json: JsonResponse;
  data?: Record<string, unknown>;
}> {
  const response = await request(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
      ...(init.headers ?? {}),
    },
  });
  const json = (await response.json()) as JsonResponse;
  return { status: response.status, json, data: json.data };
}

async function addMember(
  organizationId: string,
  email: string,
  role: "admin" | "editor" | "viewer",
): Promise<{ cookie: string; userId: string }> {
  const member = await signUp(email);
  const userId = await withAdminDb(async (client) => {
    const result = await client.query<{ id: string }>(
      `SELECT id FROM auth."user" WHERE email = $1`,
      [email.toLowerCase()],
    );
    await client.query(
      `INSERT INTO organization_member (organization_id, user_id, role, created_at, updated_at)
       VALUES ($1, $2, $3, now(), now())
       ON CONFLICT DO NOTHING`,
      [organizationId, result.rows[0].id, role],
    );
    return result.rows[0].id;
  });
  return { cookie: member.cookie, userId };
}

describe("organization members (console)", () => {
  test("member list includes role, ownership and join time", async () => {
    const owner = await signUp(uniqueEmail("mem-owner"));
    const created = await createOrganization(owner.cookie, "成员组织");
    const organizationId = (created.data?.organization as { id: string }).id;
    const second = await addMember(
      organizationId,
      uniqueEmail("mem-b"),
      "editor",
    );

    const list = await call(
      `/api/v1/organizations/${organizationId}/members`,
      owner.cookie,
    );
    expect(list.status).toBe(200);
    const items = list.data?.items as Record<string, unknown>[];
    expect(items.length).toBe(2);

    const ownerRow = items.find((item) => item.isOwner === true);
    expect(ownerRow?.role).toBe("admin");
    expect(typeof ownerRow?.joinedAt).toBe("string");

    const editorRow = items.find((item) => item.userId === second.userId);
    expect(editorRow?.role).toBe("editor");
    expect(typeof editorRow?.email).toBe("string");
    expect(typeof editorRow?.name).toBe("string");
  });

  test("admin updates member role; owner role is protected", async () => {
    const owner = await signUp(uniqueEmail("mem-role-o"));
    const created = await createOrganization(owner.cookie, "角色组织2");
    const organizationId = (created.data?.organization as { id: string }).id;
    const target = await addMember(
      organizationId,
      uniqueEmail("mem-role-t"),
      "viewer",
    );

    const changed = await call(
      `/api/v1/organizations/${organizationId}/members/${target.userId}`,
      owner.cookie,
      { method: "PATCH", body: JSON.stringify({ role: "editor" }) },
    );
    expect(changed.status).toBe(200);
    expect((changed.data?.member as { role: string }).role).toBe("editor");

    const ownerRow = await call(
      `/api/v1/organizations/${organizationId}/members`,
      owner.cookie,
    );
    const ownerMember = (
      ownerRow.data?.items as Record<string, unknown>[]
    ).find((item) => item.isOwner === true);
    const ownerMemberId = ownerMember?.userId as string;

    const changeOwner = await call(
      `/api/v1/organizations/${organizationId}/members/${ownerMemberId}`,
      owner.cookie,
      { method: "PATCH", body: JSON.stringify({ role: "viewer" }) },
    );
    expect(changeOwner.status).toBe(409);
    expect(changeOwner.json.code).toBe("CONFLICT");
  });

  test("viewer cannot modify members", async () => {
    const owner = await signUp(uniqueEmail("mem-v-o"));
    const created = await createOrganization(owner.cookie, "只读组织");
    const organizationId = (created.data?.organization as { id: string }).id;
    const viewer = await addMember(
      organizationId,
      uniqueEmail("mem-v-t"),
      "viewer",
    );
    const other = await addMember(
      organizationId,
      uniqueEmail("mem-v-x"),
      "editor",
    );

    const patch = await call(
      `/api/v1/organizations/${organizationId}/members/${other.userId}`,
      viewer.cookie,
      { method: "PATCH", body: JSON.stringify({ role: "admin" }) },
    );
    expect(patch.status).toBe(403);
    expect(patch.json.code).toBe("FORBIDDEN");

    const remove = await call(
      `/api/v1/organizations/${organizationId}/members/${other.userId}`,
      viewer.cookie,
      { method: "DELETE" },
    );
    expect(remove.status).toBe(403);

    const viewerList = await call(
      `/api/v1/organizations/${organizationId}/members`,
      viewer.cookie,
    );
    expect(viewerList.status).toBe(200);
    expect(viewer.userId).not.toBe(other.userId);
  });

  test("removing a member works; removing the owner is rejected", async () => {
    const owner = await signUp(uniqueEmail("mem-del-o"));
    const created = await createOrganization(owner.cookie, "移除组织");
    const organizationId = (created.data?.organization as { id: string }).id;
    const target = await addMember(
      organizationId,
      uniqueEmail("mem-del-t"),
      "editor",
    );

    const removed = await call(
      `/api/v1/organizations/${organizationId}/members/${target.userId}`,
      owner.cookie,
      { method: "DELETE" },
    );
    expect(removed.status).toBe(200);

    const listAfter = await call(
      `/api/v1/organizations/${organizationId}/members`,
      owner.cookie,
    );
    expect((listAfter.data?.items as unknown[]).length).toBe(1);

    const ownerRow = (listAfter.data?.items as Record<string, unknown>[]).find(
      (item) => item.isOwner === true,
    );
    const removeOwner = await call(
      `/api/v1/organizations/${organizationId}/members/${ownerRow?.userId}`,
      owner.cookie,
      { method: "DELETE" },
    );
    expect(removeOwner.status).toBe(409);
    expect(removeOwner.json.code).toBe("CONFLICT");
  });

  test("cross-tenant member management returns not found", async () => {
    const owner = await signUp(uniqueEmail("mem-x-o"));
    const created = await createOrganization(owner.cookie, "跨租户组织");
    const organizationId = (created.data?.organization as { id: string }).id;
    const target = await addMember(
      organizationId,
      uniqueEmail("mem-x-t"),
      "editor",
    );

    const stranger = await signUp(uniqueEmail("mem-x-s"));
    const list = await call(
      `/api/v1/organizations/${organizationId}/members`,
      stranger.cookie,
    );
    expect(list.status).toBe(404);
    expect(list.json.code).toBe("NOT_FOUND");

    const patch = await call(
      `/api/v1/organizations/${organizationId}/members/${target.userId}`,
      stranger.cookie,
      { method: "PATCH", body: JSON.stringify({ role: "admin" }) },
    );
    expect(patch.status).toBe(404);
  });

  test("unauthenticated member list is rejected", async () => {
    const owner = await signUp(uniqueEmail("mem-u-o"));
    const created = await createOrganization(owner.cookie, "未登录组织");
    const organizationId = (created.data?.organization as { id: string }).id;

    const result = await call(
      `/api/v1/organizations/${organizationId}/members`,
      null,
    );
    expect(result.status).toBe(401);
  });
});
