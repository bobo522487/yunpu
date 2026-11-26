import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  createOrganization,
  signUp,
  uniqueEmail,
  withAdminDb,
} from "../auth/fixtures";
import { call } from "../fixtures/http";
import { addMember } from "../fixtures/members";

let emails: Set<string>;

beforeEach(() => {
  emails = new Set();
});

afterEach(async () => {
  // Register the email before signUp so a partially created fixture is still
  // cleaned up; derive organizations from their owner and never bind a
  // non-uuid placeholder to a uuid parameter.
  if (emails.size === 0) return;
  const tracked = [...emails];
  await withAdminDb(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query("SET LOCAL session_replication_role = replica");
      const users = await client.query<{ id: string }>(
        'SELECT id FROM auth."user" WHERE email = ANY($1::text[])',
        [tracked],
      );
      const userIds = users.rows.map((row) => row.id);
      if (userIds.length > 0) {
        await client.query(
          `DELETE FROM audit_log WHERE organization_id IN
             (SELECT id FROM organization WHERE owner_user_id = ANY($1::uuid[]))`,
          [userIds],
        );
        await client.query(
          `DELETE FROM invite WHERE organization_id IN
             (SELECT id FROM organization WHERE owner_user_id = ANY($1::uuid[]))`,
          [userIds],
        );
        await client.query(
          `DELETE FROM organization_member WHERE organization_id IN
             (SELECT id FROM organization WHERE owner_user_id = ANY($1::uuid[]))`,
          [userIds],
        );
        await client.query(
          `DELETE FROM project WHERE organization_id IN
             (SELECT id FROM organization WHERE owner_user_id = ANY($1::uuid[]))`,
          [userIds],
        );
        await client.query(
          "DELETE FROM organization WHERE owner_user_id = ANY($1::uuid[])",
          [userIds],
        );
        await client.query(
          "DELETE FROM auth.session WHERE user_id = ANY($1::uuid[])",
          [userIds],
        );
        await client.query(
          "DELETE FROM auth.account WHERE user_id = ANY($1::uuid[])",
          [userIds],
        );
        await client.query(
          "DELETE FROM auth.verification WHERE identifier = ANY($1::text[])",
          [tracked],
        );
        await client.query(
          'DELETE FROM auth."user" WHERE id = ANY($1::uuid[])',
          [userIds],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
});

function trackEmail(email: string): void {
  emails.add(email.toLowerCase());
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
});
