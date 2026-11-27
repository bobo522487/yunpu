import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  activateOrganization,
  createOrganization,
  createTenantCleanupTracker,
  findUserIdByEmail,
  insertInvite,
  type JsonResponse,
  listOrganizations,
  readSession,
  request,
  signUp,
  uniqueEmail,
  withAdminDb,
} from "./fixtures";

const tracker = createTenantCleanupTracker();

function trackedEmail(prefix: string): string {
  // Track before the request that may fail; cleanup must never bind a
  // non-uuid placeholder to a uuid column.
  return tracker.trackEmail(uniqueEmail(prefix));
}

async function ownerWithOrganization() {
  const email = trackedEmail("invite-owner");
  const registered = await signUp(email);
  const userId = (registered.json.data?.user as { id: string }).id;
  const created = await createOrganization(registered.cookie, "邀请组织");
  const organizationId = (created.data?.organization as { id: string }).id;
  return { email, userId, organizationId, cookie: registered.cookie };
}

describe("US3 invite acceptance", () => {
  beforeEach(() => {
    tracker.reset();
  });

  afterEach(async () => {
    await tracker.cleanup();
  });

  test("joining through an invite does not create a personal organization", async () => {
    const owner = await ownerWithOrganization();
    const invitee = trackedEmail("invitee");
    const token = crypto.randomUUID();
    await insertInvite({
      organizationId: owner.organizationId,
      email: invitee,
      token,
      invitedBy: owner.userId,
    });

    const registered = await signUp(invitee, { inviteToken: token });
    expect(registered.response.status).toBe(201);
    expect(
      (registered.json.data?.invite as { accepted: boolean }).accepted,
    ).toBe(true);
    expect(
      (registered.json.data?.defaultOrganization as { id: string }).id,
    ).toBe(owner.organizationId);

    const organizations = await listOrganizations(registered.cookie);
    expect((organizations.data?.organizations as { id: string }[]).length).toBe(
      1,
    );

    const auditCount = await withAdminDb(async (client) => {
      const rows = await client.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM audit_log WHERE organization_id = $1 AND action = 'invite.accepted' AND project_id IS NULL",
        [owner.organizationId],
      );
      return Number(rows.rows[0]?.count ?? 0);
    });
    expect(auditCount).toBe(1);
  });

  test("an email mismatch keeps registration successful but rejects the invite", async () => {
    const owner = await ownerWithOrganization();
    const token = crypto.randomUUID();
    await insertInvite({
      organizationId: owner.organizationId,
      email: trackedEmail("intended"),
      token,
      invitedBy: owner.userId,
    });

    const registered = await signUp(trackedEmail("other"), {
      inviteToken: token,
    });
    expect(registered.response.status).toBe(201);
    expect(
      (registered.json.data?.invite as { accepted: boolean }).accepted,
    ).toBe(false);
    expect((registered.json.data?.invite as { reason: string }).reason).toBe(
      "email_mismatch",
    );
    expect(
      (registered.json.data?.defaultOrganization as { id: string }).id,
    ).not.toBe(owner.organizationId);
  });

  test("an expired invite does not block registration", async () => {
    const owner = await ownerWithOrganization();
    const invitee = trackedEmail("expired");
    const token = crypto.randomUUID();
    await insertInvite({
      organizationId: owner.organizationId,
      email: invitee,
      token,
      invitedBy: owner.userId,
      expiresInHours: -1,
    });

    const registered = await signUp(invitee, { inviteToken: token });
    expect(registered.response.status).toBe(201);
    expect(
      (registered.json.data?.invite as { accepted: boolean }).accepted,
    ).toBe(false);
    expect((registered.json.data?.invite as { reason: string }).reason).toBe(
      "expired",
    );
  });

  test("a consumed invite cannot be used again", async () => {
    const owner = await ownerWithOrganization();
    const first = trackedEmail("first");
    const token = crypto.randomUUID();
    await insertInvite({
      organizationId: owner.organizationId,
      email: first,
      token,
      invitedBy: owner.userId,
    });
    const firstSignUp = await signUp(first, { inviteToken: token });
    expect(
      (firstSignUp.json.data?.invite as { accepted: boolean }).accepted,
    ).toBe(true);

    const secondSignUp = await signUp(trackedEmail("second"), {
      inviteToken: token,
    });
    expect(secondSignUp.response.status).toBe(201);
    expect(
      (secondSignUp.json.data?.invite as { accepted: boolean }).accepted,
    ).toBe(false);
    expect((secondSignUp.json.data?.invite as { reason: string }).reason).toBe(
      "already_used",
    );
  });

  test("a logged-in user can accept an invite and switch default organization", async () => {
    const owner = await ownerWithOrganization();
    const memberEmail = trackedEmail("member");
    const member = await signUp(memberEmail);
    const before = member.json.data?.defaultOrganization as { id: string };
    const token = crypto.randomUUID();

    await insertInvite({
      organizationId: owner.organizationId,
      email: memberEmail,
      token,
      invitedBy: owner.userId,
    });

    const accepted = await request("/api/v1/invites/accept", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: member.cookie },
      body: JSON.stringify({ token }),
    });
    expect(accepted.status).toBe(200);

    const session = await readSession(member.cookie);
    expect((session.data?.defaultOrganization as { id: string }).id).toBe(
      owner.organizationId,
    );
    expect((session.data?.defaultOrganization as { id: string }).id).not.toBe(
      before.id,
    );
  });

  test.each([1, 2, 3])(
    "concurrent acceptance succeeds exactly once (run %i)",
    async (run) => {
      const owner = await ownerWithOrganization();
      const memberEmail = trackedEmail(`concurrent-${run}`);
      const member = await signUp(memberEmail);
      const inviteeUserId = await findUserIdByEmail(memberEmail);
      expect(inviteeUserId).toBeDefined();
      if (!inviteeUserId) throw new Error("invitee user id not found");
      const token = crypto.randomUUID();
      await insertInvite({
        organizationId: owner.organizationId,
        email: memberEmail,
        token,
        invitedBy: owner.userId,
      });

      const accept = () =>
        request("/api/v1/invites/accept", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: member.cookie,
          },
          body: JSON.stringify({ token }),
        });
      const [first, second] = await Promise.all([accept(), accept()]);
      const firstJson = (await first.json()) as JsonResponse;
      const secondJson = (await second.json()) as JsonResponse;
      const responses = [
        { status: first.status, json: firstJson },
        { status: second.status, json: secondJson },
      ];
      const winner = responses.find((item) => item.status === 200);
      const loser = responses.find((item) => item.status === 409);
      expect(winner).toBeDefined();
      expect(loser).toBeDefined();
      if (!winner || !loser) throw new Error("expected one 200 and one 409");
      expect(winner.json.ok).toBe(true);
      expect(winner.json.details).toBeUndefined();
      expect((winner.json.data?.organization as { id: string }).id).toBe(
        owner.organizationId,
      );
      expect(winner.json.data?.defaultOrganizationChanged).toBe(true);
      expect(loser.json).toEqual({
        ok: false,
        code: "CONFLICT",
        details: { sqlstate: "GX010" },
        message: "操作已被并发请求抢先，请重试",
      });

      const persisted = await withAdminDb(async (client) => {
        const invite = await client.query<{
          status: string;
          accepted_at: Date | null;
        }>(
          "SELECT status, accepted_at FROM invite WHERE organization_id = $1 AND email = $2",
          [owner.organizationId, memberEmail.toLowerCase()],
        );
        const members = await client.query<{ user_id: string }>(
          "SELECT user_id FROM organization_member WHERE organization_id = $1",
          [owner.organizationId],
        );
        const memberRow = await client.query<{
          role: string;
          last_used_at: Date | null;
        }>(
          `SELECT role, last_used_at FROM organization_member
           WHERE organization_id = $1 AND user_id = $2`,
          [owner.organizationId, inviteeUserId],
        );
        const audit = await client.query<{ count: string }>(
          `SELECT count(*)::text AS count FROM audit_log
           WHERE organization_id = $1 AND action = 'invite.accepted' AND project_id IS NULL`,
          [owner.organizationId],
        );
        return {
          invite: invite.rows[0],
          memberCount: members.rows.length,
          memberUserIds: members.rows.map((row) => row.user_id),
          memberRow: memberRow.rows[0],
          auditCount: Number(audit.rows[0]?.count ?? 0),
        };
      });
      expect(persisted.invite?.status).toBe("accepted");
      expect(persisted.invite?.accepted_at).not.toBeNull();
      expect(persisted.memberCount).toBe(2);
      expect(persisted.memberUserIds).toEqual(
        expect.arrayContaining([owner.userId, inviteeUserId]),
      );
      expect(persisted.memberRow?.role).toBe("editor");
      expect(persisted.memberRow?.last_used_at).not.toBeNull();
      expect(persisted.auditCount).toBe(1);

      const session = await readSession(member.cookie);
      expect((session.data?.defaultOrganization as { id: string }).id).toBe(
        owner.organizationId,
      );
    },
  );

  test("an invalid invite token leaves membership and audit state unchanged", async () => {
    const owner = await ownerWithOrganization();
    const memberEmail = trackedEmail("invalid-token");
    const member = await signUp(memberEmail);
    const missingToken = crypto.randomUUID();

    const rejected = await request("/api/v1/invites/accept", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: member.cookie },
      body: JSON.stringify({ token: missingToken }),
    });
    expect(rejected.status).toBe(404);
    expect(await rejected.json()).toEqual({
      ok: false,
      code: "NOT_FOUND",
      details: { sqlstate: "GX005" },
      message: "目标不存在或已失效",
    });

    const state = await withAdminDb(async (client) => {
      const members = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM organization_member
         WHERE organization_id = $1 AND user_id = $2`,
        [owner.organizationId, owner.userId],
      );
      const audits = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM audit_log
         WHERE organization_id = $1 AND action = 'invite.accepted' AND project_id IS NULL`,
        [owner.organizationId],
      );
      return {
        memberCount: Number(members.rows[0]?.count ?? 0),
        auditCount: Number(audits.rows[0]?.count ?? 0),
      };
    });
    expect(state).toEqual({ memberCount: 1, auditCount: 0 });
  });

  test("activating the invited organization is allowed for the member", async () => {
    const owner = await ownerWithOrganization();
    const memberEmail = trackedEmail("activate-member");
    const member = await signUp(memberEmail);
    const token = crypto.randomUUID();
    await insertInvite({
      organizationId: owner.organizationId,
      email: memberEmail,
      token,
      invitedBy: owner.userId,
    });
    await request("/api/v1/invites/accept", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: member.cookie },
      body: JSON.stringify({ token }),
    });

    const activated = await activateOrganization(
      member.cookie,
      owner.organizationId,
    );
    expect(activated.response.status).toBe(200);
  });

  test("an owner accepting a viewer invite keeps the admin role", async () => {
    const owner = await ownerWithOrganization();
    const token = crypto.randomUUID();
    await insertInvite({
      organizationId: owner.organizationId,
      email: owner.email,
      role: "viewer",
      token,
      invitedBy: owner.userId,
    });

    const accepted = await request("/api/v1/invites/accept", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: owner.cookie },
      body: JSON.stringify({ token }),
    });
    expect(accepted.status).toBe(200);

    const role = await withAdminDb(async (client) => {
      const result = await client.query<{ role: string }>(
        `SELECT role FROM organization_member
          WHERE organization_id = $1 AND user_id = $2`,
        [owner.organizationId, owner.userId],
      );
      return result.rows[0]?.role;
    });
    expect(role).toBe("admin");
  });
});
