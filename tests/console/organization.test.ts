import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  createOrganization,
  findUserIdByEmail,
  insertInvite,
  type JsonResponse,
  request,
  signUp,
  uniqueEmail,
  withAdminDb,
} from "../auth/fixtures";
import { call, type Envelope } from "../fixtures/http";
import { addMember } from "../fixtures/members";

async function getDetail(
  cookie: string | null,
  organizationId: string,
): Promise<{ status: number; json: JsonResponse }> {
  const response = await request(`/api/v1/organizations/${organizationId}`, {
    headers: cookie ? { cookie } : {},
  });
  return {
    status: response.status,
    json: (await response.json()) as JsonResponse,
  };
}

describe("GET /api/v1/organizations/:id (console org detail)", () => {
  test("owner sees accurate counts, role and ownership", async () => {
    const owner = await signUp(uniqueEmail("org-detail"));
    const created = await createOrganization(owner.cookie, "甲谱工作室");
    const organizationId = (created.data?.organization as { id: string }).id;

    // 第二名成员由数据库直接加入（成员加入流程属邀请模块，这里只验证计数）
    const ownerId = await withAdminDb(async (client) => {
      const result = await client.query<{ owner_user_id: string }>(
        "SELECT owner_user_id FROM organization WHERE id = $1",
        [organizationId],
      );
      return result.rows[0].owner_user_id;
    });
    const secondUserId = "11111111-1111-7111-8111-111111111111";
    await withAdminDb(async (client) => {
      await client.query(
        `INSERT INTO auth."user" (id, name, email, created_at, updated_at)
         VALUES ($1, '成员乙', 'member-b@example.com', now(), now())
         ON CONFLICT DO NOTHING`,
        [secondUserId],
      );
      const userRow = await client.query<{ id: string }>(
        `SELECT id FROM auth."user" WHERE email = 'member-b@example.com'`,
      );
      await client.query(
        `INSERT INTO organization_member (organization_id, user_id, role, created_at, updated_at)
         VALUES ($1, $2, 'editor', now(), now())
         ON CONFLICT DO NOTHING`,
        [organizationId, userRow.rows[0].id],
      );
      await client.query('SELECT 1 FROM auth."user" WHERE id = $1', [ownerId]);
    });

    await insertInvite({
      organizationId,
      email: "invitee@example.com",
      token: `detail-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      invitedBy: ownerId,
    });

    const { status, json } = await getDetail(owner.cookie, organizationId);
    expect(status).toBe(200);
    expect(json.ok).toBe(true);

    const organization = json.data?.organization as Record<string, unknown>;
    expect(organization.id).toBe(organizationId);
    expect(organization.name).toBe("甲谱工作室");
    expect(organization.status).toBe("active");
    expect(organization.myRole).toBe("admin");
    expect(organization.isOwner).toBe(true);
    expect(organization.memberCount).toBe(2);
    expect(organization.pendingInviteCount).toBe(1);
    expect(organization.projectCount).toBe(0);
  });

  test("cross-tenant access returns not found without leaking existence", async () => {
    const owner = await signUp(uniqueEmail("org-owner-x"));
    const created = await createOrganization(owner.cookie, "私有组织");
    const organizationId = (created.data?.organization as { id: string }).id;

    const stranger = await signUp(uniqueEmail("org-stranger-x"));
    const { status, json } = await getDetail(stranger.cookie, organizationId);
    expect(status).toBe(404);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("NOT_FOUND");
  });

  test("unauthenticated request is rejected", async () => {
    const owner = await signUp(uniqueEmail("org-owner-y"));
    const created = await createOrganization(owner.cookie, "需要登录的组织");
    const organizationId = (created.data?.organization as { id: string }).id;

    const { status, json } = await getDetail(null, organizationId);
    expect(status).toBe(401);
    expect(json.ok).toBe(false);
    expect(json.code).toBe("UNAUTHORIZED");
  });
});

describe("cross-tenant isolation envelope (T-010 review)", () => {
  let emails: Set<string>;

  beforeEach(() => {
    emails = new Set();
  });

  afterEach(async () => {
    // Register targets before the failing cross-tenant requests. Organization
    // ids come from resolved user ids only; no placeholder is bound to uuid.
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

  test("detail, members, invites, transfer, rename and archive all look absent across tenants", async () => {
    const ownerEmail = uniqueEmail("t10-x-o");
    const strangerEmail = uniqueEmail("t10-x-s");
    const organizationName = `T010 跨租户隔离组织-${Date.now()}`;
    const owner = await trackedSignUp(ownerEmail);
    const organizationId = await trackedCreateOrganization(
      owner.cookie,
      organizationName,
    );
    const memberEmail = uniqueEmail("t10-x-m");
    trackEmail(memberEmail);
    const member = await addMember(organizationId, memberEmail, "admin");
    const ownerUserId = await findUserIdByEmail(ownerEmail);
    expect(ownerUserId).toBeDefined();
    if (!ownerUserId) throw new Error("owner user id not found");

    // Use a real invite id: no non-uuid placeholder is ever sent as a param.
    const inviteeEmail = uniqueEmail("t10-x-i");
    const createdInvite = await call(
      `/api/v1/organizations/${organizationId}/invites`,
      owner.cookie,
      {
        method: "POST",
        body: JSON.stringify({ email: inviteeEmail, role: "viewer" }),
      },
    );
    expect(createdInvite.status).toBe(201);
    const inviteId = (createdInvite.data?.invite as { id: string }).id;
    const stranger = await trackedSignUp(strangerEmail);

    // The detail route maps a null read to its own generic 404 message; every
    // other guarded endpoint uses requireMember's generic 404. Both envelopes
    // carry exactly ok/code/message and no trace of the hidden organization.
    const readMessage = "目标不存在或已失效";
    const guardedMessage = "不存在或无权";
    const cases: {
      label: string;
      response: Envelope;
      message: string;
    }[] = [
      {
        label: "detail",
        response: await call(
          `/api/v1/organizations/${organizationId}`,
          stranger.cookie,
        ),
        message: readMessage,
      },
      {
        label: "members list",
        response: await call(
          `/api/v1/organizations/${organizationId}/members`,
          stranger.cookie,
        ),
        message: guardedMessage,
      },
      {
        label: "members role change",
        response: await call(
          `/api/v1/organizations/${organizationId}/members/${member.userId}`,
          stranger.cookie,
          { method: "PATCH", body: JSON.stringify({ role: "viewer" }) },
        ),
        message: guardedMessage,
      },
      {
        label: "members remove",
        response: await call(
          `/api/v1/organizations/${organizationId}/members/${member.userId}`,
          stranger.cookie,
          { method: "DELETE" },
        ),
        message: guardedMessage,
      },
      {
        label: "invites list",
        response: await call(
          `/api/v1/organizations/${organizationId}/invites`,
          stranger.cookie,
        ),
        message: guardedMessage,
      },
      {
        label: "invites create",
        response: await call(
          `/api/v1/organizations/${organizationId}/invites`,
          stranger.cookie,
          {
            method: "POST",
            body: JSON.stringify({
              email: uniqueEmail("t10-x-sneak"),
              role: "viewer",
            }),
          },
        ),
        message: guardedMessage,
      },
      {
        label: "invites revoke",
        response: await call(
          `/api/v1/organizations/${organizationId}/invites/${inviteId}`,
          stranger.cookie,
          { method: "DELETE" },
        ),
        message: guardedMessage,
      },
      {
        label: "owner transfer",
        response: await call(
          `/api/v1/organizations/${organizationId}/owner`,
          stranger.cookie,
          {
            method: "PUT",
            body: JSON.stringify({ newOwnerUserId: member.userId }),
          },
        ),
        message: guardedMessage,
      },
      {
        label: "rename",
        response: await call(
          `/api/v1/organizations/${organizationId}`,
          stranger.cookie,
          { method: "PATCH", body: JSON.stringify({ name: "跨租户改名" }) },
        ),
        message: guardedMessage,
      },
      {
        label: "archive",
        response: await call(
          `/api/v1/organizations/${organizationId}`,
          stranger.cookie,
          { method: "PATCH", body: JSON.stringify({ status: "archived" }) },
        ),
        message: guardedMessage,
      },
    ];

    for (const { label, response, message } of cases) {
      expect(response.status, label).toBe(404);
      expect(response.json, label).toEqual({
        ok: false,
        code: "NOT_FOUND",
        message,
      });
      expect(response.data, label).toBeUndefined();
      const body = JSON.stringify(response.json);
      expect(body, label).not.toContain(organizationName);
      expect(body, label).not.toContain(organizationId);
      expect(body, label).not.toContain(ownerEmail);
    }

    const after = await call(
      `/api/v1/organizations/${organizationId}`,
      owner.cookie,
    );
    expect(after.status).toBe(200);
    expect(after.data?.organization).toMatchObject({
      id: organizationId,
      name: organizationName,
      status: "active",
      ownerUserId: ownerUserId,
    });
    const remainingInvites = await call(
      `/api/v1/organizations/${organizationId}/invites`,
      owner.cookie,
    );
    expect((remainingInvites.data?.items as unknown[]).length).toBe(1);
  });
});
