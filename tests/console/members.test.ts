import type { MemberRole } from "@yunpu/shared";
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

async function trackedSignUp(email: string) {
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

async function trackedAddMember(
  organizationId: string,
  prefix: string,
  role: MemberRole,
) {
  const email = uniqueEmail(prefix);
  trackEmail(email);
  return addMember(organizationId, email, role);
}

async function archiveOrganization(
  cookie: string,
  organizationId: string,
): Promise<void> {
  const archived = await call(
    `/api/v1/organizations/${organizationId}`,
    cookie,
    { method: "PATCH", body: JSON.stringify({ status: "archived" }) },
  );
  expect(archived.status).toBe(200);
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

  test("archived organization rejects member role changes with GX012", async () => {
    const owner = await trackedSignUp(uniqueEmail("mem-ar-r-o"));
    const organizationId = await trackedCreateOrganization(
      owner.cookie,
      "归档角色组织",
    );
    const target = await trackedAddMember(
      organizationId,
      "mem-ar-r-t",
      "viewer",
    );
    await archiveOrganization(owner.cookie, organizationId);

    const changed = await call(
      `/api/v1/organizations/${organizationId}/members/${target.userId}`,
      owner.cookie,
      { method: "PATCH", body: JSON.stringify({ role: "editor" }) },
    );
    expect(changed.status).toBe(409);
    expect(changed.json.ok).toBe(false);
    expect(changed.json.code).toBe("CONFLICT");
    expect(changed.json.details).toMatchObject({ sqlstate: "GX012" });
  });

  test("archived organization rejects member removal with GX012", async () => {
    const owner = await trackedSignUp(uniqueEmail("mem-ar-d-o"));
    const organizationId = await trackedCreateOrganization(
      owner.cookie,
      "归档移除组织",
    );
    const target = await trackedAddMember(
      organizationId,
      "mem-ar-d-t",
      "editor",
    );
    await archiveOrganization(owner.cookie, organizationId);

    const removed = await call(
      `/api/v1/organizations/${organizationId}/members/${target.userId}`,
      owner.cookie,
      { method: "DELETE" },
    );
    expect(removed.status).toBe(409);
    expect(removed.json.ok).toBe(false);
    expect(removed.json.code).toBe("CONFLICT");
    expect(removed.json.details).toMatchObject({ sqlstate: "GX012" });
  });

  test("archived organization rejects member leave with GX012", async () => {
    const owner = await trackedSignUp(uniqueEmail("mem-ar-l-o"));
    const organizationId = await trackedCreateOrganization(
      owner.cookie,
      "归档退出组织",
    );
    const member = await trackedAddMember(
      organizationId,
      "mem-ar-l-t",
      "editor",
    );
    await archiveOrganization(owner.cookie, organizationId);

    const left = await call(
      `/api/v1/organizations/${organizationId}/leave`,
      member.cookie,
      { method: "POST" },
    );
    expect(left.status).toBe(409);
    expect(left.json.ok).toBe(false);
    expect(left.json.code).toBe("CONFLICT");
    expect(left.json.details).toMatchObject({ sqlstate: "GX012" });
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
