import { describe, expect, test } from "vitest";
import { createOrganization, signUp, uniqueEmail } from "../auth/fixtures";
import { call } from "../fixtures/http";
import { addMember } from "../fixtures/members";

describe("organization invites (console)", () => {
  test("creating an invite returns a one-time inviteUrl; list never exposes the token", async () => {
    const owner = await signUp(uniqueEmail("inv-owner"));
    const created = await createOrganization(owner.cookie, "邀请组织");
    const organizationId = (created.data?.organization as { id: string }).id;
    const invitee = uniqueEmail("inv-target");

    const createdInvite = await call(
      `/api/v1/organizations/${organizationId}/invites`,
      owner.cookie,
      {
        method: "POST",
        body: JSON.stringify({ email: invitee, role: "editor" }),
      },
    );
    expect(createdInvite.status).toBe(201);
    const inviteUrl = createdInvite.data?.inviteUrl as string;
    expect(inviteUrl).toContain("/#/invite/");
    const token = inviteUrl.split("/#/invite/")[1];
    expect(token.length).toBeGreaterThanOrEqual(43);

    const invite = createdInvite.data?.invite as Record<string, unknown>;
    expect(invite.email).toBe(invitee);
    expect(invite.role).toBe("editor");
    expect(invite.status).toBe("pending");
    expect(JSON.stringify(invite)).not.toContain(token);

    const list = await call(
      `/api/v1/organizations/${organizationId}/invites`,
      owner.cookie,
    );
    expect(list.status).toBe(200);
    const items = list.data?.items as Record<string, unknown>[];
    expect(items.length).toBe(1);
    expect(JSON.stringify(items)).not.toContain(token);
    expect(items[0].email).toBe(invitee);
  });

  test("duplicate pending invite for the same email is rejected", async () => {
    const owner = await signUp(uniqueEmail("inv-dup-o"));
    const created = await createOrganization(owner.cookie, "重复邀请组织");
    const organizationId = (created.data?.organization as { id: string }).id;
    const invitee = uniqueEmail("inv-dup-t");

    const first = await call(
      `/api/v1/organizations/${organizationId}/invites`,
      owner.cookie,
      {
        method: "POST",
        body: JSON.stringify({ email: invitee, role: "viewer" }),
      },
    );
    expect(first.status).toBe(201);

    const second = await call(
      `/api/v1/organizations/${organizationId}/invites`,
      owner.cookie,
      {
        method: "POST",
        body: JSON.stringify({ email: invitee, role: "admin" }),
      },
    );
    expect(second.status).toBe(409);
    expect(second.json.code).toBe("CONFLICT");
  });

  test("viewer cannot read or create invites", async () => {
    const owner = await signUp(uniqueEmail("inv-v-o"));
    const created = await createOrganization(owner.cookie, "只读邀请组织");
    const organizationId = (created.data?.organization as { id: string }).id;
    const { cookie: viewerCookie } = await addMember(
      organizationId,
      uniqueEmail("inv-v-t"),
      "viewer",
    );

    const list = await call(
      `/api/v1/organizations/${organizationId}/invites`,
      viewerCookie,
    );
    expect(list.status).toBe(403);

    const create = await call(
      `/api/v1/organizations/${organizationId}/invites`,
      viewerCookie,
      {
        method: "POST",
        body: JSON.stringify({ email: uniqueEmail("inv-v-x"), role: "viewer" }),
      },
    );
    expect(create.status).toBe(403);
    expect(create.json.code).toBe("FORBIDDEN");
  });

  test("revoking a pending invite makes it unusable; double revoke fails", async () => {
    const owner = await signUp(uniqueEmail("inv-r-o"));
    const created = await createOrganization(owner.cookie, "撤销邀请组织");
    const organizationId = (created.data?.organization as { id: string }).id;

    const createdInvite = await call(
      `/api/v1/organizations/${organizationId}/invites`,
      owner.cookie,
      {
        method: "POST",
        body: JSON.stringify({ email: uniqueEmail("inv-r-t"), role: "editor" }),
      },
    );
    const inviteId = (createdInvite.data?.invite as { id: string }).id;

    const revoked = await call(
      `/api/v1/organizations/${organizationId}/invites/${inviteId}`,
      owner.cookie,
      { method: "DELETE" },
    );
    expect(revoked.status).toBe(200);

    const list = await call(
      `/api/v1/organizations/${organizationId}/invites`,
      owner.cookie,
    );
    const item = (list.data?.items as Record<string, unknown>[]).find(
      (entry) => entry.id === inviteId,
    );
    expect(item?.status).toBe("revoked");

    const again = await call(
      `/api/v1/organizations/${organizationId}/invites/${inviteId}`,
      owner.cookie,
      { method: "DELETE" },
    );
    expect(again.status).toBe(404);
    expect(again.json.code).toBe("NOT_FOUND");
  });

  test("non-admin member cannot revoke; cross-tenant gets not found", async () => {
    const owner = await signUp(uniqueEmail("inv-p-o"));
    const created = await createOrganization(owner.cookie, "权限邀请组织");
    const organizationId = (created.data?.organization as { id: string }).id;
    const { cookie: editorCookie } = await addMember(
      organizationId,
      uniqueEmail("inv-p-e"),
      "editor",
    );

    const createdInvite = await call(
      `/api/v1/organizations/${organizationId}/invites`,
      owner.cookie,
      {
        method: "POST",
        body: JSON.stringify({ email: uniqueEmail("inv-p-t"), role: "viewer" }),
      },
    );
    const inviteId = (createdInvite.data?.invite as { id: string }).id;

    const byEditor = await call(
      `/api/v1/organizations/${organizationId}/invites/${inviteId}`,
      editorCookie,
      { method: "DELETE" },
    );
    expect(byEditor.status).toBe(403);

    const stranger = await signUp(uniqueEmail("inv-p-s"));
    const byStranger = await call(
      `/api/v1/organizations/${organizationId}/invites/${inviteId}`,
      stranger.cookie,
      { method: "DELETE" },
    );
    expect(byStranger.status).toBe(404);

    const stillPending = await call(
      `/api/v1/organizations/${organizationId}/invites`,
      owner.cookie,
    );
    const item = (stillPending.data?.items as Record<string, unknown>[]).find(
      (entry) => entry.id === inviteId,
    );
    expect(item?.status).toBe("pending");
  });

  test("revoked invite cannot be redeemed", async () => {
    const owner = await signUp(uniqueEmail("inv-a-o"));
    const created = await createOrganization(owner.cookie, "兑换撤销组织");
    const organizationId = (created.data?.organization as { id: string }).id;
    const inviteeEmail = `inv-a-match-${Date.now()}@example.com`;
    const invitee = await signUp(inviteeEmail);

    const matched = await call(
      `/api/v1/organizations/${organizationId}/invites`,
      owner.cookie,
      {
        method: "POST",
        body: JSON.stringify({ email: inviteeEmail, role: "editor" }),
      },
    );
    expect(matched.status).toBe(201);
    const inviteId = (matched.data?.invite as { id: string }).id;
    const token = (matched.data?.inviteUrl as string).split("/#/invite/")[1];

    const revoked = await call(
      `/api/v1/organizations/${organizationId}/invites/${inviteId}`,
      owner.cookie,
      { method: "DELETE" },
    );
    expect(revoked.status).toBe(200);

    const redeem = await call("/api/v1/invites/accept", invitee.cookie, {
      method: "POST",
      body: JSON.stringify({ token }),
    });
    expect(redeem.status).toBeGreaterThanOrEqual(400);
    expect(redeem.json.ok).toBe(false);
  });
});
