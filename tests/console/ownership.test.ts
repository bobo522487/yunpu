import type { MemberRole } from "@yunpu/shared";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { withTenantTransaction } from "../../apps/api/src/db/with-tenant-transaction";
import {
  createOrganization,
  createTenantCleanupTracker,
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
      message: "不能移除组织所有者",
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

  test("direct SQL demotion of owner is rejected by database trigger (GX013)", async () => {
    const ownerEmail = uniqueEmail("t10-db-guard-o");
    const owner = await trackedSignUp(ownerEmail);
    const organizationId = await trackedCreateOrganization(
      owner.cookie,
      "T010 数据库保护所有者组织",
    );
    const ownerUserId = await findUserIdByEmail(ownerEmail);
    expect(ownerUserId).toBeDefined();
    if (!ownerUserId) throw new Error("owner user id not found");

    await expect(
      withTenantTransaction({ userId: ownerUserId }, (db) =>
        db.execute(
          `UPDATE organization_member SET role = 'viewer'
            WHERE organization_id = '${organizationId}'::uuid
              AND user_id = '${ownerUserId}'::uuid`,
        ),
      ),
    ).rejects.toMatchObject({ cause: { code: "GX013" } });
    expect(await storedRole(organizationId, ownerUserId)).toBe("admin");
  });
});

describe("transfer concurrency and atomicity (T-011 review)", () => {
  const tracker = createTenantCleanupTracker();

  beforeEach(() => {
    tracker.reset();
  });

  afterEach(async () => {
    await tracker.cleanup();
  });

  function trackedEmail(prefix: string): string {
    return tracker.trackEmail(uniqueEmail(prefix));
  }

  async function trackedSignUp(email: string) {
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
    return addMember(organizationId, trackedEmail(prefix), role);
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

  async function storedTransferAuditCount(
    organizationId: string,
  ): Promise<number> {
    return withAdminDb(async (client) => {
      const result = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM audit_log
         WHERE organization_id = $1 AND action = 'organization.owner_transferred'`,
        [organizationId],
      );
      return Number(result.rows[0]?.count ?? 0);
    });
  }

  test.each([1, 2, 3])(
    "concurrent transfers have one winner and no partial promotion (run %i)",
    async (run) => {
      const ownerEmail = trackedEmail(`t11-x-o-${run}`);
      const owner = await trackedSignUp(ownerEmail);
      const organizationId = await trackedCreateOrganization(
        owner.cookie,
        `T011 并发移交组织 ${run}`,
      );
      const ownerUserId = await findUserIdByEmail(ownerEmail);
      expect(ownerUserId).toBeDefined();
      if (!ownerUserId) throw new Error("owner user id not found");
      // Both candidates start as viewers: a losing racer's promotion must be
      // rolled back by GX010, which is observable as role = viewer below.
      const winner = await trackedAddMember(
        organizationId,
        `t11-x-w-${run}`,
        "viewer",
      );
      const loser = await trackedAddMember(
        organizationId,
        `t11-x-l-${run}`,
        "viewer",
      );
      expect(await storedRole(organizationId, winner.userId)).toBe("viewer");
      expect(await storedRole(organizationId, loser.userId)).toBe("viewer");

      const transferTo = (newOwnerUserId: string) =>
        call(`/api/v1/organizations/${organizationId}/owner`, owner.cookie, {
          method: "PUT",
          body: JSON.stringify({ newOwnerUserId }),
        });
      // Hold the organization row lock until BOTH requests have read the old
      // owner and are waiting to UPDATE it. Without this barrier the second
      // request could observe the winner's committed owner and fail earlier
      // with GX006/403 instead of the intended CAS conflict GX010/409.
      const transfers = withAdminDb(async (lockClient) => {
        await lockClient.query("BEGIN");
        try {
          await lockClient.query(
            "SELECT id FROM organization WHERE id = $1 FOR UPDATE",
            [organizationId],
          );
          const inFlight = Promise.all([
            transferTo(winner.userId),
            transferTo(loser.userId),
          ]);
          for (let attempt = 0; attempt < 40; attempt += 1) {
            const waiting = await lockClient.query<{ count: string }>(
              "SELECT count(*)::text AS count FROM pg_locks WHERE locktype = 'transactionid' AND NOT granted",
            );
            if (Number(waiting.rows[0]?.count ?? 0) >= 2) break;
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
          await lockClient.query("COMMIT");
          return inFlight;
        } catch (error) {
          await lockClient.query("ROLLBACK");
          throw error;
        }
      });
      const [first, second] = await transfers;
      const results = [first, second];
      const succeeded = results.find((item) => item.status === 200);
      const rejected = results.find((item) => item.status === 409);
      if (!succeeded || !rejected) {
        throw new Error(
          `expected one 200 and one 409 transfer response, got ${JSON.stringify(results.map((item) => ({ status: item.status, json: item.json })))}`,
        );
      }
      expect(succeeded.json.ok).toBe(true);

      const actualOwnerId = await storedOwnerId(organizationId);
      expect(actualOwnerId).toBeDefined();
      expect([winner.userId, loser.userId]).toContain(actualOwnerId);
      expect(succeeded.data?.ownerUserId).toBe(actualOwnerId);
      expect(rejected.json).toEqual({
        ok: false,
        code: "CONFLICT",
        details: { sqlstate: "GX010" },
        message: "操作已被并发请求抢先，请重试",
      });

      const newOwnerUserId = actualOwnerId as string;
      const failedUserId =
        newOwnerUserId === winner.userId ? loser.userId : winner.userId;
      expect(await storedRole(organizationId, newOwnerUserId)).toBe("admin");
      expect(await storedRole(organizationId, failedUserId)).toBe("viewer");
      expect(await storedRole(organizationId, ownerUserId)).toBe("admin");
      expect(await storedTransferAuditCount(organizationId)).toBe(1);

      const detail = await call(
        `/api/v1/organizations/${organizationId}`,
        owner.cookie,
      );
      expect(detail.status).toBe(200);
      expect(detail.data?.organization).toMatchObject({
        ownerUserId: newOwnerUserId,
        isOwner: false,
        myRole: "admin",
      });
    },
  );

  test("a rejected archived transfer does not promote the recipient or write audit", async () => {
    const ownerEmail = trackedEmail("t11-at-o");
    const owner = await trackedSignUp(ownerEmail);
    const organizationId = await trackedCreateOrganization(
      owner.cookie,
      "T011 归档原子性组织",
    );
    const recipient = await trackedAddMember(
      organizationId,
      "t11-at-v",
      "viewer",
    );
    expect(await storedRole(organizationId, recipient.userId)).toBe("viewer");
    expect(await storedTransferAuditCount(organizationId)).toBe(0);
    const ownerUserId = await findUserIdByEmail(ownerEmail);
    expect(ownerUserId).toBeDefined();
    if (!ownerUserId) throw new Error("owner user id not found");

    await setOrganizationStatus(organizationId, "archived");
    const rejected = await call(
      `/api/v1/organizations/${organizationId}/owner`,
      owner.cookie,
      {
        method: "PUT",
        body: JSON.stringify({ newOwnerUserId: recipient.userId }),
      },
    );
    expect(rejected.status).toBe(409);
    expect(rejected.json).toEqual({
      ok: false,
      code: "CONFLICT",
      details: { sqlstate: "GX012" },
      message: "组织已归档，无法写入",
    });
    expect(await storedOwnerId(organizationId)).toBe(ownerUserId);
    expect(await storedRole(organizationId, recipient.userId)).toBe("viewer");
    expect(await storedTransferAuditCount(organizationId)).toBe(0);
  });
});
