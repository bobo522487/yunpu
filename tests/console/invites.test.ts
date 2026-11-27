import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  createOrganization,
  createTenantCleanupTracker,
  signUp,
  uniqueEmail,
} from "../auth/fixtures";
import { call } from "../fixtures/http";
import { addMember } from "../fixtures/members";

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

  test("archived organization rejects invite creation with GX012", async () => {
    const owner = await trackedSignUp(uniqueEmail("inv-ar-c-o"));
    const organizationId = await trackedCreateOrganization(
      owner.cookie,
      "归档创建邀请组织",
    );
    await archiveOrganization(owner.cookie, organizationId);

    const created = await call(
      `/api/v1/organizations/${organizationId}/invites`,
      owner.cookie,
      {
        method: "POST",
        body: JSON.stringify({
          email: uniqueEmail("inv-ar-c-t"),
          role: "editor",
        }),
      },
    );
    expect(created.status).toBe(409);
    expect(created.json.ok).toBe(false);
    expect(created.json.code).toBe("CONFLICT");
    expect(created.json.details).toMatchObject({ sqlstate: "GX012" });
  });

  test("archived organization rejects invite redemption with GX012", async () => {
    const owner = await trackedSignUp(uniqueEmail("inv-ar-r-o"));
    const organizationId = await trackedCreateOrganization(
      owner.cookie,
      "归档兑换邀请组织",
    );
    const inviteeEmail = uniqueEmail("inv-ar-r-t");
    const invitee = await trackedSignUp(inviteeEmail);

    const created = await call(
      `/api/v1/organizations/${organizationId}/invites`,
      owner.cookie,
      {
        method: "POST",
        body: JSON.stringify({ email: inviteeEmail, role: "editor" }),
      },
    );
    expect(created.status).toBe(201);
    const token = (created.data?.inviteUrl as string).split("/#/invite/")[1];

    await archiveOrganization(owner.cookie, organizationId);

    const redeem = await call("/api/v1/invites/accept", invitee.cookie, {
      method: "POST",
      body: JSON.stringify({ token }),
    });
    expect(redeem.status).toBe(409);
    expect(redeem.json.ok).toBe(false);
    expect(redeem.json.code).toBe("CONFLICT");
    expect(redeem.json.details).toMatchObject({ sqlstate: "GX012" });
  });

  test("omitting role creates a viewer invite and redemption yields a viewer member", async () => {
    const owner = await signUp(uniqueEmail("inv-default-o"));
    const created = await createOrganization(owner.cookie, "默认角色邀请组织");
    const organizationId = (created.data?.organization as { id: string }).id;
    const inviteeEmail = uniqueEmail("inv-default-t");
    const invitee = await signUp(inviteeEmail);

    const createdInvite = await call(
      `/api/v1/organizations/${organizationId}/invites`,
      owner.cookie,
      {
        method: "POST",
        body: JSON.stringify({ email: inviteeEmail }),
      },
    );
    expect(createdInvite.status).toBe(201);
    const invite = createdInvite.data?.invite as Record<string, unknown>;
    expect(invite.role).toBe("viewer");

    const listed = await call(
      `/api/v1/organizations/${organizationId}/invites`,
      owner.cookie,
    );
    expect(listed.status).toBe(200);
    const invites = listed.data?.items as Record<string, unknown>[];
    expect(invites.find((entry) => entry.email === inviteeEmail)?.role).toBe(
      "viewer",
    );

    const token = (createdInvite.data?.inviteUrl as string).split(
      "/#/invite/",
    )[1];
    const accepted = await call("/api/v1/invites/accept", invitee.cookie, {
      method: "POST",
      body: JSON.stringify({ token }),
    });
    expect(accepted.status).toBe(200);

    const members = await call(
      `/api/v1/organizations/${organizationId}/members`,
      owner.cookie,
    );
    expect(members.status).toBe(200);
    const memberItems = members.data?.items as Record<string, unknown>[];
    expect(
      memberItems.find((entry) => entry.email === inviteeEmail)?.role,
    ).toBe("viewer");
  });

  test("untrusted Origin header does not poison generated inviteUrl", async () => {
    const owner = await trackedSignUp(uniqueEmail("inv-origin-o"));
    const organizationId = await trackedCreateOrganization(
      owner.cookie,
      "Origin校验组织",
    );
    const created = await call(
      `/api/v1/organizations/${organizationId}/invites`,
      owner.cookie,
      {
        method: "POST",
        headers: { origin: "https://evil.example" },
        body: JSON.stringify({
          email: uniqueEmail("inv-origin-t"),
          role: "viewer",
        }),
      },
    );
    expect(created.status).toBe(201);
    const inviteUrl = created.data?.inviteUrl as string;
    expect(inviteUrl).not.toContain("evil.example");
    expect(inviteUrl).toContain("/#/invite/");
  });
});
