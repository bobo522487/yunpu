import { Hono } from "hono";
import { config } from "../../config";
import { createContractBinder } from "../../lib/contract";
import type { ApiEnv } from "../../types";
import {
  acceptInvite,
  activateOrganizationForUser,
  createInviteForOrg,
  createOrganization,
  getOrganization,
  leaveOrganizationForUser,
  listInvitesForOrg,
  listMembersForOrg,
  listMyOrganizations,
  removeMemberFromOrg,
  revokeInviteForOrg,
  transferOwnerForOrg,
  updateMemberRoleForOrg,
  updateOrganizationForUser,
} from "./service";

export const organizationRouter = new Hono<ApiEnv>();
const route = createContractBinder(
  organizationRouter,
  "apps/api/src/modules/organization/router.ts",
);

route("get", "/organizations", async (c, { user }) => {
  const organizations = await listMyOrganizations(user.id);
  return c.json({
    ok: true,
    data: {
      organizations,
      defaultOrganizationId: organizations[0]?.id ?? null,
    },
  });
});

route("get", "/organizations/:organizationId", async (c, { user, params }) => {
  const organization = await getOrganization(user.id, params.organizationId);
  return c.json({ ok: true, data: { organization } });
});

route(
  "patch",
  "/organizations/:organizationId",
  async (c, { user, params, body }) => {
    const organization = await updateOrganizationForUser(
      user.id,
      params.organizationId,
      body,
    );
    return c.json({ ok: true, data: { organization } });
  },
);

route(
  "post",
  "/organizations/:organizationId/leave",
  async (c, { user, params }) => {
    await leaveOrganizationForUser(user.id, params.organizationId);
    return c.json({ ok: true, data: { left: true } });
  },
);

route("post", "/organizations", async (c, { user, body }) => {
  const organization = await createOrganization(user.id, body.name);
  return c.json({ ok: true, data: { organization } }, 201);
});

route(
  "post",
  "/organizations/:organizationId/activate",
  async (c, { user, params }) => {
    const organization = await activateOrganizationForUser(
      user.id,
      params.organizationId,
    );
    return c.json({ ok: true, data: { organization } });
  },
);

route("post", "/invites/accept", async (c, { user, body }) => {
  const organization = await acceptInvite(user.id, body.token);
  return c.json({
    ok: true,
    data: { organization, defaultOrganizationChanged: true },
  });
});

// ---- 控制台：成员 ----

route(
  "get",
  "/organizations/:organizationId/members",
  async (c, { user, params, query }) => {
    const page = await listMembersForOrg(user.id, params.organizationId, query);
    return c.json({ ok: true, data: page });
  },
);

route(
  "patch",
  "/organizations/:organizationId/members/:userId",
  async (c, { user, params, body }) => {
    const member = await updateMemberRoleForOrg(
      user.id,
      params.organizationId,
      params.userId,
      body.role,
    );
    return c.json({ ok: true, data: { member } });
  },
);

route(
  "delete",
  "/organizations/:organizationId/members/:userId",
  async (c, { user, params }) => {
    await removeMemberFromOrg(user.id, params.organizationId, params.userId);
    return c.json({ ok: true, data: { removed: true } });
  },
);

// ---- 控制台：邀请 ----

route(
  "get",
  "/organizations/:organizationId/invites",
  async (c, { user, params, query }) => {
    const page = await listInvitesForOrg(user.id, params.organizationId, query);
    return c.json({ ok: true, data: page });
  },
);

function trustedInviteOrigin(headerOrigin: string | undefined): string {
  const env = config();
  const fallback = new URL(env.BETTER_AUTH_URL).origin;
  if (!headerOrigin) return fallback;

  let normalized: string;
  try {
    normalized = new URL(headerOrigin).origin;
  } catch {
    return fallback;
  }

  const allowed = new Set<string>([fallback]);
  for (const candidate of env.CORS_ORIGINS) {
    try {
      allowed.add(new URL(candidate).origin);
    } catch {
      // Ignore malformed configured origin strings.
    }
  }
  return allowed.has(normalized) ? normalized : fallback;
}

route(
  "post",
  "/organizations/:organizationId/invites",
  async (c, { user, params, body }) => {
    // 邀请链接指向前端；仅信任已配置的 Origin，否则回退 BETTER_AUTH_URL。
    const origin = trustedInviteOrigin(c.req.header("origin"));
    const result = await createInviteForOrg(
      user.id,
      params.organizationId,
      body,
      origin,
    );
    return c.json({ ok: true, data: result }, 201);
  },
);

route(
  "delete",
  "/organizations/:organizationId/invites/:inviteId",
  async (c, { user, params }) => {
    await revokeInviteForOrg(user.id, params.organizationId, params.inviteId);
    return c.json({ ok: true, data: { revoked: true } });
  },
);

// ---- 控制台：所有权转移 ----

route(
  "put",
  "/organizations/:organizationId/owner",
  async (c, { user, params, body }) => {
    const result = await transferOwnerForOrg(
      user.id,
      params.organizationId,
      body.newOwnerUserId,
    );
    return c.json({ ok: true, data: result });
  },
);

export default organizationRouter;
