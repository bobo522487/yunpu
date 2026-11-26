import type { MemberRole } from "@yunpu/shared";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  createOrganization,
  findUserIdByEmail,
  setOrganizationStatus,
  signUp,
  uniqueEmail,
  withAdminDb,
} from "../auth/fixtures";
import { call } from "../fixtures/http";
import { addMember } from "../fixtures/members";

describe("ownership transfer (console)", () => {
  test("owner transfers ownership to a member; audit row is written", async () => {
    const owner = await signUp(uniqueEmail("own-o"));
    const created = await createOrganization(owner.cookie, "转移组织");
    const organizationId = (created.data?.organization as { id: string }).id;
    const target = await addMember(
      organizationId,
      uniqueEmail("own-t"),
      "admin",
    );

    const transferred = await call(
      `/api/v1/organizations/${organizationId}/owner`,
      owner.cookie,
      {
        method: "PUT",
        body: JSON.stringify({ newOwnerUserId: target.userId }),
      },
    );
    expect(transferred.status).toBe(200);
    expect(transferred.data?.ownerUserId).toBe(target.userId);

    const detail = await call(
      `/api/v1/organizations/${organizationId}`,
      owner.cookie,
    );
    expect((detail.data?.organization as { isOwner: boolean }).isOwner).toBe(
      false,
    );
    expect(
      (detail.data?.organization as { ownerUserId: string }).ownerUserId,
    ).toBe(target.userId);

    const audits = await withAdminDb(async (client) => {
      const result = await client.query<{ action: string }>(
        `SELECT action FROM audit_log
         WHERE organization_id = $1 AND entity_type = 'organization'
         ORDER BY created_at DESC LIMIT 5`,
        [organizationId],
      );
      return result.rows.map((row) => row.action);
    });
    expect(audits).toContain("organization.owner_transferred");

    // 旧 owner 不再是 owner，二次转移被拒（GX006 → 403）
    const again = await call(
      `/api/v1/organizations/${organizationId}/owner`,
      owner.cookie,
      {
        method: "PUT",
        body: JSON.stringify({ newOwnerUserId: target.userId }),
      },
    );
    expect(again.status).toBe(403);
    expect(again.json.code).toBe("FORBIDDEN");
  });

  test("non-owner member cannot transfer ownership", async () => {
    const owner = await signUp(uniqueEmail("own-n-o"));
    const created = await createOrganization(owner.cookie, "非所有者组织");
    const organizationId = (created.data?.organization as { id: string }).id;
    const editor = await addMember(
      organizationId,
      uniqueEmail("own-n-e"),
      "admin",
    );

    const result = await call(
      `/api/v1/organizations/${organizationId}/owner`,
      editor.cookie,
      {
        method: "PUT",
        body: JSON.stringify({ newOwnerUserId: editor.userId }),
      },
    );
    expect(result.status).toBe(403);
    expect(result.json.code).toBe("FORBIDDEN");
  });

  test("transferring to a non-member is rejected", async () => {
    const owner = await signUp(uniqueEmail("own-m-o"));
    const created = await createOrganization(owner.cookie, "非成员接手组织");
    const organizationId = (created.data?.organization as { id: string }).id;
    const outsiderEmail = uniqueEmail("own-m-s");
    await signUp(outsiderEmail);

    const outsiderUserId = await withAdminDb(async (client) => {
      const result = await client.query<{ id: string }>(
        `SELECT id FROM auth."user" WHERE email = $1`,
        [outsiderEmail.toLowerCase()],
      );
      return result.rows[0].id;
    });

    const result = await call(
      `/api/v1/organizations/${organizationId}/owner`,
      owner.cookie,
      {
        method: "PUT",
        body: JSON.stringify({ newOwnerUserId: outsiderUserId }),
      },
    );
    expect(result.status).toBe(403);
    expect(result.json.code).toBe("FORBIDDEN");
  });

  test("concurrent transfers: exactly one side succeeds", async () => {
    const owner = await signUp(uniqueEmail("own-c-o"));
    const created = await createOrganization(owner.cookie, "并发转移组织");
    const organizationId = (created.data?.organization as { id: string }).id;
    const a = await addMember(organizationId, uniqueEmail("own-c-a"), "admin");
    const b = await addMember(organizationId, uniqueEmail("own-c-b"), "admin");

    const [first, second] = await Promise.all([
      call(`/api/v1/organizations/${organizationId}/owner`, owner.cookie, {
        method: "PUT",
        body: JSON.stringify({ newOwnerUserId: a.userId }),
      }),
      call(`/api/v1/organizations/${organizationId}/owner`, owner.cookie, {
        method: "PUT",
        body: JSON.stringify({ newOwnerUserId: b.userId }),
      }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses[0]).toBe(200);
    expect([403, 409]).toContain(statuses[1]);

    const detail = await call(
      `/api/v1/organizations/${organizationId}`,
      owner.cookie,
    );
    const ownerUserId = (detail.data?.organization as { ownerUserId: string })
      .ownerUserId;
    expect([a.userId, b.userId]).toContain(ownerUserId);
  });

  test("a viewer cannot become a powerless owner: transfer promotes them to admin", async () => {
    const owner = await signUp(uniqueEmail("own-v-o"));
    const created = await createOrganization(owner.cookie, "viewer 接手组织");
    const organizationId = (created.data?.organization as { id: string }).id;
    const viewer = await addMember(
      organizationId,
      uniqueEmail("own-v-t"),
      "viewer",
    );

    const before = await call(
      `/api/v1/organizations/${organizationId}/invites`,
      viewer.cookie,
    );
    expect(before.status).toBe(403);

    const transferred = await call(
      `/api/v1/organizations/${organizationId}/owner`,
      owner.cookie,
      {
        method: "PUT",
        body: JSON.stringify({ newOwnerUserId: viewer.userId }),
      },
    );
    expect(transferred.status).toBe(200);
    expect(transferred.data?.ownerUserId).toBe(viewer.userId);

    const role = await withAdminDb(async (client) => {
      const result = await client.query<{ role: string }>(
        `SELECT role FROM organization_member
          WHERE organization_id = $1 AND user_id = $2`,
        [organizationId, viewer.userId],
      );
      return result.rows[0]?.role;
    });
    expect(role).toBe("admin");

    // A viewer-owner would be locked out by the admin-only RLS; this proves not.
    const after = await call(
      `/api/v1/organizations/${organizationId}/invites`,
      viewer.cookie,
    );
    expect(after.status).toBe(200);
  });

  test("ownership transfer is refused for an archived organization", async () => {
    const owner = await signUp(uniqueEmail("own-a-o"));
    const created = await createOrganization(owner.cookie, "归档组织转移");
    const organizationId = (created.data?.organization as { id: string }).id;
    const target = await addMember(
      organizationId,
      uniqueEmail("own-a-t"),
      "admin",
    );
    await setOrganizationStatus(organizationId, "archived");

    const result = await call(
      `/api/v1/organizations/${organizationId}/owner`,
      owner.cookie,
      {
        method: "PUT",
        body: JSON.stringify({ newOwnerUserId: target.userId }),
      },
    );
    expect(result.status).toBe(409);
    expect(result.json.code).toBe("CONFLICT");

    const actualOwner = await withAdminDb(async (client) => {
      const row = await client.query<{ owner_user_id: string }>(
        "SELECT owner_user_id FROM organization WHERE id = $1",
        [organizationId],
      );
      return row.rows[0].owner_user_id;
    });
    expect(actualOwner).not.toBe(target.userId);
  });

  test("cross-tenant transfer returns not found", async () => {
    const owner = await signUp(uniqueEmail("own-x-o"));
    const created = await createOrganization(owner.cookie, "跨租户转移组织");
    const organizationId = (created.data?.organization as { id: string }).id;
    const target = await addMember(
      organizationId,
      uniqueEmail("own-x-t"),
      "admin",
    );

    const stranger = await signUp(uniqueEmail("own-x-s"));
    const result = await call(
      `/api/v1/organizations/${organizationId}/owner`,
      stranger.cookie,
      {
        method: "PUT",
        body: JSON.stringify({ newOwnerUserId: target.userId }),
      },
    );
    expect(result.status).toBe(404);
    expect(result.json.code).toBe("NOT_FOUND");
  });
});

describe("owner invariants and transfer role effects (T-010 review)", () => {
  let emails: Set<string>;

  beforeEach(() => {
    emails = new Set();
  });

  afterEach(async () => {
    // Every email is registered before the request that can fail. Organization
    // ids are derived from actual user ids, so a non-uuid placeholder is never
    // bound to a uuid parameter when sign-up is only partially complete.
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
          // A successful transfer moves ownership, so collect organizations by
          // either ownership or membership of the tracked users.
          const organizations = await client.query<{ id: string }>(
            `SELECT id FROM organization WHERE owner_user_id = ANY($1::uuid[])
             UNION
             SELECT organization_id AS id FROM organization_member
             WHERE user_id = ANY($1::uuid[])`,
            [userIds],
          );
          const organizationIds = organizations.rows.map((row) => row.id);
          if (organizationIds.length > 0) {
            await client.query(
              "DELETE FROM audit_log WHERE organization_id = ANY($1::uuid[])",
              [organizationIds],
            );
            await client.query(
              "DELETE FROM invite WHERE organization_id = ANY($1::uuid[])",
              [organizationIds],
            );
            await client.query(
              "DELETE FROM organization_member WHERE organization_id = ANY($1::uuid[])",
              [organizationIds],
            );
            await client.query(
              "DELETE FROM project WHERE organization_id = ANY($1::uuid[])",
              [organizationIds],
            );
            await client.query(
              "DELETE FROM organization WHERE id = ANY($1::uuid[])",
              [organizationIds],
            );
          }
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

  async function storedRole(
    organizationId: string,
    userId: string,
  ): Promise<string | undefined> {
    return withAdminDb(async (client) => {
      const result = await client.query<{ role: string }>(
        `SELECT role FROM organization_member
         WHERE organization_id = $1 AND user_id = $2`,
        [organizationId, userId],
      );
      return result.rows[0]?.role;
    });
  }

  async function storedOwnerId(
    organizationId: string,
  ): Promise<string | undefined> {
    return withAdminDb(async (client) => {
      const result = await client.query<{ owner_user_id: string }>(
        "SELECT owner_user_id FROM organization WHERE id = $1",
        [organizationId],
      );
      return result.rows[0]?.owner_user_id;
    });
  }

  test("owner cannot be removed, leave, or be demoted; each conflict preserves the owner row and role", async () => {
    const ownerEmail = uniqueEmail("t10-inv-o");
    const owner = await trackedSignUp(ownerEmail);
    const organizationId = await trackedCreateOrganization(
      owner.cookie,
      "T010 所有者不变量组织",
    );
    const ownerUserId = await findUserIdByEmail(ownerEmail);
    expect(ownerUserId).toBeDefined();
    if (!ownerUserId) throw new Error("owner user id not found");
    const admin = await trackedAddMember(organizationId, "t10-inv-a", "admin");

    const removed = await call(
      `/api/v1/organizations/${organizationId}/members/${ownerUserId}`,
      admin.cookie,
      { method: "DELETE" },
    );
    expect(removed.status).toBe(409);
    expect(removed.json).toEqual({
      ok: false,
      code: "CONFLICT",
      // fk_organization_owner RESTRICT surfaces SQLSTATE 23001, which maps to
      // this generic conflict message (not the 23503-specific branch).
      message: "记录仍被引用",
    });
    expect(await storedOwnerId(organizationId)).toBe(ownerUserId);
    expect(await storedRole(organizationId, ownerUserId)).toBe("admin");

    const left = await call(
      `/api/v1/organizations/${organizationId}/leave`,
      owner.cookie,
      { method: "POST" },
    );
    expect(left.status).toBe(409);
    expect(left.json).toEqual({
      ok: false,
      code: "CONFLICT",
      message: "请先转移所有权再退出组织",
    });
    expect(await storedOwnerId(organizationId)).toBe(ownerUserId);

    const demoted = await call(
      `/api/v1/organizations/${organizationId}/members/${ownerUserId}`,
      admin.cookie,
      { method: "PATCH", body: JSON.stringify({ role: "viewer" }) },
    );
    expect(demoted.status).toBe(409);
    expect(demoted.json).toEqual({
      ok: false,
      code: "CONFLICT",
      message: "不能修改所有者角色",
    });
    expect(await storedRole(organizationId, ownerUserId)).toBe("admin");
  });

  test("transfer promotes a viewer recipient to admin and leaves the previous owner admin", async () => {
    const ownerEmail = uniqueEmail("t10-prom-o");
    const owner = await trackedSignUp(ownerEmail);
    const organizationId = await trackedCreateOrganization(
      owner.cookie,
      "T010 移交角色组织",
    );
    const ownerUserId = await findUserIdByEmail(ownerEmail);
    expect(ownerUserId).toBeDefined();
    if (!ownerUserId) throw new Error("owner user id not found");
    const viewer = await trackedAddMember(
      organizationId,
      "t10-prom-v",
      "viewer",
    );
    expect(await storedRole(organizationId, viewer.userId)).toBe("viewer");
    expect(await storedRole(organizationId, ownerUserId)).toBe("admin");

    const transferred = await call(
      `/api/v1/organizations/${organizationId}/owner`,
      owner.cookie,
      {
        method: "PUT",
        body: JSON.stringify({ newOwnerUserId: viewer.userId }),
      },
    );
    expect(transferred.status).toBe(200);
    expect(transferred.json.ok).toBe(true);
    expect(transferred.data?.ownerUserId).toBe(viewer.userId);
    expect(await storedRole(organizationId, viewer.userId)).toBe("admin");
    expect(await storedRole(organizationId, ownerUserId)).toBe("admin");

    const detail = await call(
      `/api/v1/organizations/${organizationId}`,
      owner.cookie,
    );
    expect(detail.status).toBe(200);
    expect(detail.data?.organization).toMatchObject({
      ownerUserId: viewer.userId,
      isOwner: false,
      myRole: "admin",
    });
  });
});
