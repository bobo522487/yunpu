import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  createOrganization,
  createTenantCleanupTracker,
  readSession,
  signUp,
  uniqueEmail,
  withAdminDb,
} from "../auth/fixtures";
import { call } from "../fixtures/http";
import { addMember } from "../fixtures/members";

const tracker = createTenantCleanupTracker();

beforeEach(() => {
  tracker.reset();
});

afterEach(async () => {
  await tracker.cleanup();
});

function trackEmail(email: string): void {
  tracker.trackEmail(email);
}

async function trackedSignUp(prefix: string) {
  const email = uniqueEmail(prefix);
  trackEmail(email);
  const signedUp = await signUp(email);
  expect(signedUp.response.status).toBe(201);
  return signedUp;
}

async function trackedCreateOrganization(
  cookie: string,
  name: string,
): Promise<string> {
  const created = await createOrganization(cookie, name);
  expect(created.ok).toBe(true);
  const organizationId = (
    created.data?.organization as { id?: string } | undefined
  )?.id;
  if (!organizationId) {
    throw new Error("createOrganization did not return an organization id");
  }
  return organizationId;
}

async function storedLastUsedAt(
  organizationId: string,
  userId: string,
): Promise<Date | null> {
  return withAdminDb(async (client) => {
    const result = await client.query<{ last_used_at: Date | null }>(
      `SELECT last_used_at FROM organization_member
       WHERE organization_id = $1 AND user_id = $2`,
      [organizationId, userId],
    );
    return result.rows[0]?.last_used_at ?? null;
  });
}

async function storedAuditCount(organizationId: string): Promise<number> {
  return withAdminDb(async (client) => {
    const result = await client.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM audit_log WHERE organization_id = $1",
      [organizationId],
    );
    return Number(result.rows[0]?.count ?? 0);
  });
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
    const { cookie: viewerCookie } = await addMember(
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
    expect(activate.json.ok).toBe(false);
    expect(activate.json.code).toBe("NOT_FOUND");

    const projectCreate = await call(
      `/api/v1/organizations/${organizationId}/projects`,
      owner.cookie,
      { method: "POST", body: JSON.stringify({ name: "归档后新建" }) },
    );
    expect(projectCreate.status).toBe(409);
    expect(projectCreate.json.code).toBe("CONFLICT");
  });

  test("archived organization rejects rename with a conflict error", async () => {
    const owner = await trackedSignUp("set-ar-o");
    const organizationId = await trackedCreateOrganization(
      owner.cookie,
      "归档改名组织",
    );

    const archived = await call(
      `/api/v1/organizations/${organizationId}`,
      owner.cookie,
      { method: "PATCH", body: JSON.stringify({ status: "archived" }) },
    );
    expect(archived.status).toBe(200);

    const rename = await call(
      `/api/v1/organizations/${organizationId}`,
      owner.cookie,
      { method: "PATCH", body: JSON.stringify({ name: "归档后改名" }) },
    );
    expect(rename.status).toBe(409);
    expect(rename.json.ok).toBe(false);
    expect(rename.json.code).toBe("CONFLICT");
    expect(rename.json.message).toBe("组织已归档，无法写入");
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
    const { cookie: memberCookie } = await addMember(
      organizationId,
      memberEmail,
      "editor",
    );

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

  test("switching current organization updates the session and persisted last-used timestamp", async () => {
    const owner = await trackedSignUp("set-sw-o");
    const ownerUserId = (owner.json.data?.user as { id: string }).id;
    const firstId = await trackedCreateOrganization(owner.cookie, "切换前组织");
    const secondId = await trackedCreateOrganization(
      owner.cookie,
      "切换后组织",
    );
    const before = await storedLastUsedAt(secondId, ownerUserId);

    const activated = await call(
      `/api/v1/organizations/${secondId}/activate`,
      owner.cookie,
      { method: "POST" },
    );
    expect(activated.status).toBe(200);
    expect(activated.json.ok).toBe(true);
    expect(activated.data?.organization).toMatchObject({
      id: secondId,
      role: "admin",
      isOwner: true,
    });

    const session = await readSession(owner.cookie);
    expect((session.data?.defaultOrganization as { id: string }).id).toBe(
      secondId,
    );

    const after = await storedLastUsedAt(secondId, ownerUserId);
    expect(after).not.toBeNull();
    if (before) {
      expect(after?.getTime()).toBeGreaterThanOrEqual(before.getTime());
    }

    const list = await call("/api/v1/organizations", owner.cookie);
    expect(
      (list.data?.organizations as { id: string }[]).map((item) => item.id),
    ).toEqual(expect.arrayContaining([firstId, secondId]));
    expect(list.data?.defaultOrganizationId).toBe(secondId);
  });

  test("activating an archived organization leaves membership and audit state untouched", async () => {
    const owner = await trackedSignUp("set-at-o");
    const ownerUserId = (owner.json.data?.user as { id: string }).id;
    const organizationId = await trackedCreateOrganization(
      owner.cookie,
      "归档切换无副作用组织",
    );

    const firstActivation = await call(
      `/api/v1/organizations/${organizationId}/activate`,
      owner.cookie,
      { method: "POST" },
    );
    expect(firstActivation.status).toBe(200);
    const before = await storedLastUsedAt(organizationId, ownerUserId);
    expect(before).not.toBeNull();

    const archived = await call(
      `/api/v1/organizations/${organizationId}`,
      owner.cookie,
      { method: "PATCH", body: JSON.stringify({ status: "archived" }) },
    );
    expect(archived.status).toBe(200);
    const auditBefore = await storedAuditCount(organizationId);

    const retry = await call(
      `/api/v1/organizations/${organizationId}/activate`,
      owner.cookie,
      { method: "POST" },
    );
    expect(retry.status).toBe(404);
    expect(retry.json).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "不存在或无权",
    });

    const after = await storedLastUsedAt(organizationId, ownerUserId);
    expect(after?.toISOString()).toBe(before?.toISOString());
    expect(await storedAuditCount(organizationId)).toBe(auditBefore);
    const stored = await withAdminDb(async (client) => {
      const result = await client.query<{ name: string; status: string }>(
        "SELECT name, status FROM organization WHERE id = $1",
        [organizationId],
      );
      return result.rows[0];
    });
    expect(stored).toMatchObject({
      name: "归档切换无副作用组织",
      status: "archived",
    });
  });
});
