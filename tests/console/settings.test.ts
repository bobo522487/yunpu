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
): Promise<string> {
  const member = await signUp(email);
  await withAdminDb(async (client) => {
    await client.query(
      `INSERT INTO organization_member (organization_id, user_id, role, created_at, updated_at)
       SELECT $1, id, $2, now(), now() FROM auth."user" WHERE email = $3
       ON CONFLICT DO NOTHING`,
      [organizationId, role, email.toLowerCase()],
    );
  });
  return member.cookie;
}

describe("organization settings (console)", () => {
  test("admin renames the organization; blank name is rejected", async () => {
    const owner = await signUp(uniqueEmail("set-o"));
    const created = await createOrganization(owner.cookie, "旧名字");
    const organizationId = (created.data?.organization as { id: string }).id;

    const renamed = await call(
      `/api/v1/organizations/${organizationId}`,
      owner.cookie,
      { method: "PATCH", body: JSON.stringify({ name: "新名字" }) },
    );
    expect(renamed.status).toBe(200);
    expect((renamed.data?.organization as { name: string }).name).toBe(
      "新名字",
    );

    const blank = await call(
      `/api/v1/organizations/${organizationId}`,
      owner.cookie,
      { method: "PATCH", body: JSON.stringify({ name: "   " }) },
    );
    expect(blank.status).toBe(400);
    expect(blank.json.code).toBe("VALIDATION");
  });

  test("viewer cannot rename or archive", async () => {
    const owner = await signUp(uniqueEmail("set-v-o"));
    const created = await createOrganization(owner.cookie, "只读设置组织");
    const organizationId = (created.data?.organization as { id: string }).id;
    const viewerCookie = await addMember(
      organizationId,
      uniqueEmail("set-v-t"),
      "viewer",
    );

    const rename = await call(
      `/api/v1/organizations/${organizationId}`,
      viewerCookie,
      { method: "PATCH", body: JSON.stringify({ name: "越权改名" }) },
    );
    expect(rename.status).toBe(403);
    expect(rename.json.code).toBe("FORBIDDEN");

    const archive = await call(
      `/api/v1/organizations/${organizationId}`,
      viewerCookie,
      { method: "PATCH", body: JSON.stringify({ status: "archived" }) },
    );
    expect(archive.status).toBe(403);

    const detail = await call(
      `/api/v1/organizations/${organizationId}`,
      owner.cookie,
    );
    expect((detail.data?.organization as { status: string }).status).toBe(
      "active",
    );
  });

  test("archived organization leaves the active list and rejects writes", async () => {
    const owner = await signUp(uniqueEmail("set-a-o"));
    const created = await createOrganization(owner.cookie, "归档组织");
    const organizationId = (created.data?.organization as { id: string }).id;

    const archived = await call(
      `/api/v1/organizations/${organizationId}`,
      owner.cookie,
      { method: "PATCH", body: JSON.stringify({ status: "archived" }) },
    );
    expect(archived.status).toBe(200);
    expect((archived.data?.organization as { status: string }).status).toBe(
      "archived",
    );

    const list = await call("/api/v1/organizations", owner.cookie);
    const ids = (list.data?.organizations as { id: string }[]).map(
      (org) => org.id,
    );
    expect(ids).not.toContain(organizationId);

    const activate = await call(
      `/api/v1/organizations/${organizationId}/activate`,
      owner.cookie,
      { method: "POST" },
    );
    expect(activate.status).toBe(404);

    const projectCreate = await call(
      `/api/v1/organizations/${organizationId}/projects`,
      owner.cookie,
      { method: "POST", body: JSON.stringify({ name: "归档后新建" }) },
    );
    expect(projectCreate.status).toBe(409);
    expect(projectCreate.json.code).toBe("CONFLICT");
  });

  test("cross-tenant rename returns not found", async () => {
    const owner = await signUp(uniqueEmail("set-x-o"));
    const created = await createOrganization(owner.cookie, "跨租户设置组织");
    const organizationId = (created.data?.organization as { id: string }).id;

    const stranger = await signUp(uniqueEmail("set-x-s"));
    const result = await call(
      `/api/v1/organizations/${organizationId}`,
      stranger.cookie,
      { method: "PATCH", body: JSON.stringify({ name: "偷改" }) },
    );
    expect(result.status).toBe(404);
    expect(result.json.code).toBe("NOT_FOUND");
  });

  test("non-owner leaves; owner must transfer first", async () => {
    const owner = await signUp(uniqueEmail("set-l-o"));
    const created = await createOrganization(owner.cookie, "退出组织");
    const organizationId = (created.data?.organization as { id: string }).id;
    const memberEmail = uniqueEmail("set-l-t");
    const memberCookie = await addMember(organizationId, memberEmail, "editor");

    const ownerLeave = await call(
      `/api/v1/organizations/${organizationId}/leave`,
      owner.cookie,
      { method: "POST" },
    );
    expect(ownerLeave.status).toBe(409);
    expect(ownerLeave.json.code).toBe("CONFLICT");

    const leave = await call(
      `/api/v1/organizations/${organizationId}/leave`,
      memberCookie,
      { method: "POST" },
    );
    expect(leave.status).toBe(200);

    const list = await call("/api/v1/organizations", memberCookie);
    const ids = (list.data?.organizations as { id: string }[]).map(
      (org) => org.id,
    );
    expect(ids).not.toContain(organizationId);

    const detail = await call(
      `/api/v1/organizations/${organizationId}/members`,
      memberCookie,
    );
    expect(detail.status).toBe(404);
  });

  test("unauthenticated settings write is rejected", async () => {
    const owner = await signUp(uniqueEmail("set-u-o"));
    const created = await createOrganization(owner.cookie, "未登录设置组织");
    const organizationId = (created.data?.organization as { id: string }).id;

    const result = await call(`/api/v1/organizations/${organizationId}`, null, {
      method: "PATCH",
      body: JSON.stringify({ name: "未登录改名" }),
    });
    expect(result.status).toBe(401);
  });
});
