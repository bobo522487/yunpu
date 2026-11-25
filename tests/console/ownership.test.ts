import { describe, expect, test } from "vitest";
import {
  createOrganization,
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
