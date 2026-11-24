import { describe, expect, test } from "vitest";
import {
  createOrganization,
  insertInvite,
  request,
  signUp,
  uniqueEmail,
  withAdminDb,
  type JsonResponse,
} from "../auth/fixtures";

async function getDetail(
  cookie: string | null,
  organizationId: string,
): Promise<{ status: number; json: JsonResponse }> {
  const response = await request(`/api/v1/organizations/${organizationId}`, {
    headers: cookie ? { cookie } : {},
  });
  return { status: response.status, json: (await response.json()) as JsonResponse };
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
      await client.query("SELECT 1 FROM auth.\"user\" WHERE id = $1", [ownerId]);
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
