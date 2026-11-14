import { describe, expect, test } from "bun:test";
import {
  activateOrganization,
  createOrganization,
  insertInvite,
  listOrganizations,
  readSession,
  request,
  signUp,
  uniqueEmail,
  withAdminDb,
} from "./fixtures";

async function ownerWithOrganization() {
  const email = uniqueEmail("invite-owner");
  const registered = await signUp(email);
  const userId = (registered.json.data?.user as { id: string }).id;
  const created = await createOrganization(registered.cookie, "邀请组织");
  const organizationId = (created.data?.organization as { id: string }).id;
  return { email, userId, organizationId, cookie: registered.cookie };
}

describe("US3 invite acceptance", () => {
  test("joining through an invite does not create a personal organization", async () => {
    const owner = await ownerWithOrganization();
    const invitee = uniqueEmail("invitee");
    const token = crypto.randomUUID();
    await insertInvite({
      organizationId: owner.organizationId,
      email: invitee,
      token,
      invitedBy: owner.userId,
    });

    const registered = await signUp(invitee, { inviteToken: token });
    expect(registered.response.status).toBe(201);
    expect((registered.json.data?.invite as { accepted: boolean }).accepted).toBe(true);
    expect(
      (registered.json.data?.defaultOrganization as { id: string }).id,
    ).toBe(owner.organizationId);

    const organizations = await listOrganizations(registered.cookie);
    expect((organizations.data?.organizations as { id: string }[]).length).toBe(1);

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
      email: uniqueEmail("intended"),
      token,
      invitedBy: owner.userId,
    });

    const registered = await signUp(uniqueEmail("other"), {
      inviteToken: token,
    });
    expect(registered.response.status).toBe(201);
    expect((registered.json.data?.invite as { accepted: boolean }).accepted).toBe(false);
    expect((registered.json.data?.invite as { reason: string }).reason).toBe("email_mismatch");
    expect(
      (registered.json.data?.defaultOrganization as { id: string }).id,
    ).not.toBe(owner.organizationId);
  });

  test("an expired invite does not block registration", async () => {
    const owner = await ownerWithOrganization();
    const invitee = uniqueEmail("expired");
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
    expect((registered.json.data?.invite as { accepted: boolean }).accepted).toBe(false);
    expect((registered.json.data?.invite as { reason: string }).reason).toBe("expired");
  });

  test("a consumed invite cannot be used again", async () => {
    const owner = await ownerWithOrganization();
    const first = uniqueEmail("first");
    const token = crypto.randomUUID();
    await insertInvite({
      organizationId: owner.organizationId,
      email: first,
      token,
      invitedBy: owner.userId,
    });
    const firstSignUp = await signUp(first, { inviteToken: token });
    expect((firstSignUp.json.data?.invite as { accepted: boolean }).accepted).toBe(true);

    const secondSignUp = await signUp(uniqueEmail("second"), {
      inviteToken: token,
    });
    expect(secondSignUp.response.status).toBe(201);
    expect((secondSignUp.json.data?.invite as { accepted: boolean }).accepted).toBe(false);
    expect((secondSignUp.json.data?.invite as { reason: string }).reason).toBe("already_used");
  });

  test("a logged-in user can accept an invite and switch default organization", async () => {
    const owner = await ownerWithOrganization();
    const memberEmail = uniqueEmail("member");
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
    expect((session.data?.defaultOrganization as { id: string }).id).not.toBe(before.id);
  });

  test("concurrent acceptance succeeds once", async () => {
    const owner = await ownerWithOrganization();
    const memberEmail = uniqueEmail("concurrent");
    const member = await signUp(memberEmail);
    const token = crypto.randomUUID();
    await insertInvite({
      organizationId: owner.organizationId,
      email: memberEmail,
      token,
      invitedBy: owner.userId,
    });

    const [first, second] = await Promise.all([
      request("/api/v1/invites/accept", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: member.cookie },
        body: JSON.stringify({ token }),
      }),
      request("/api/v1/invites/accept", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: member.cookie },
        body: JSON.stringify({ token }),
      }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses[0]).toBe(200);
    expect(statuses[1]).toBe(409);
  });

  test("activating the invited organization is allowed for the member", async () => {
    const owner = await ownerWithOrganization();
    const memberEmail = uniqueEmail("activate-member");
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

    const activated = await activateOrganization(member.cookie, owner.organizationId);
    expect(activated.response.status).toBe(200);
  });
});
