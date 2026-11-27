import {
  AcceptInviteSchema,
  CreateInviteSchema,
  CreateOrganizationSchema,
  OrganizationIdParamsSchema,
  PageQuerySchema,
  TransferOwnerSchema,
  UpdateMemberRoleSchema,
  UpdateOrganizationSchema,
} from "@yunpu/shared";
import { Hono } from "hono";
import { config } from "../../config";
import {
  parseJson,
  parseParams,
  parseQuery,
  requireUser,
} from "../../lib/http";
import type { ApiEnv } from "../../types";
import { InviteParamsSchema, MemberParamsSchema } from "./schema";
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

organizationRouter.get("/organizations", async (c) => {
  const user = requireUser(c);
  const organizations = await listMyOrganizations(user.id);
  return c.json({
    ok: true,
    data: {
      organizations,
      defaultOrganizationId: organizations[0]?.id ?? null,
    },
  });
});

organizationRouter.get("/organizations/:organizationId", async (c) => {
  const user = requireUser(c);
  const { organizationId } = parseParams(c, OrganizationIdParamsSchema);
  const organization = await getOrganization(user.id, organizationId);
  return c.json({ ok: true, data: { organization } });
});

organizationRouter.patch("/organizations/:organizationId", async (c) => {
  const user = requireUser(c);
  const { organizationId } = parseParams(c, OrganizationIdParamsSchema);
  const patch = await parseJson(c, UpdateOrganizationSchema);
  const organization = await updateOrganizationForUser(
    user.id,
    organizationId,
    patch,
  );
  return c.json({ ok: true, data: { organization } });
});

organizationRouter.post("/organizations/:organizationId/leave", async (c) => {
  const user = requireUser(c);
  const { organizationId } = parseParams(c, OrganizationIdParamsSchema);
  await leaveOrganizationForUser(user.id, organizationId);
  return c.json({ ok: true, data: { left: true } });
});

organizationRouter.post("/organizations", async (c) => {
  const user = requireUser(c);
  const parsed = await parseJson(c, CreateOrganizationSchema);
  const organization = await createOrganization(user.id, parsed.name);
  return c.json({ ok: true, data: { organization } }, 201);
});

organizationRouter.post(
  "/organizations/:organizationId/activate",
  async (c) => {
    const user = requireUser(c);
    const { organizationId } = parseParams(c, OrganizationIdParamsSchema);
    const organization = await activateOrganizationForUser(
      user.id,
      organizationId,
    );
    return c.json({ ok: true, data: { organization } });
  },
);

organizationRouter.post("/invites/accept", async (c) => {
  const user = requireUser(c);
  const parsed = await parseJson(c, AcceptInviteSchema);
  const organization = await acceptInvite(user.id, parsed.token);
  return c.json({
    ok: true,
    data: { organization, defaultOrganizationChanged: true },
  });
});

// ---- 控制台：成员 ----

organizationRouter.get("/organizations/:organizationId/members", async (c) => {
  const user = requireUser(c);
  const { organizationId } = parseParams(c, OrganizationIdParamsSchema);
  const query = parseQuery(c, PageQuerySchema);
  const page = await listMembersForOrg(user.id, organizationId, query);
  return c.json({ ok: true, data: page });
});

organizationRouter.patch(
  "/organizations/:organizationId/members/:userId",
  async (c) => {
    const user = requireUser(c);
    const params = parseParams(c, MemberParamsSchema);
    const parsed = await parseJson(c, UpdateMemberRoleSchema);
    const member = await updateMemberRoleForOrg(
      user.id,
      params.organizationId,
      params.userId,
      parsed.role,
    );
    return c.json({ ok: true, data: { member } });
  },
);

organizationRouter.delete(
  "/organizations/:organizationId/members/:userId",
  async (c) => {
    const user = requireUser(c);
    const params = parseParams(c, MemberParamsSchema);
    await removeMemberFromOrg(user.id, params.organizationId, params.userId);
    return c.json({ ok: true, data: { removed: true } });
  },
);

// ---- 控制台：邀请 ----

organizationRouter.get("/organizations/:organizationId/invites", async (c) => {
  const user = requireUser(c);
  const { organizationId } = parseParams(c, OrganizationIdParamsSchema);
  const query = parseQuery(c, PageQuerySchema);
  const page = await listInvitesForOrg(user.id, organizationId, query);
  return c.json({ ok: true, data: page });
});

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

organizationRouter.post("/organizations/:organizationId/invites", async (c) => {
  const user = requireUser(c);
  const { organizationId } = parseParams(c, OrganizationIdParamsSchema);
  const parsed = await parseJson(c, CreateInviteSchema);
  // 邀请链接指向前端；仅信任已配置的 Origin，否则回退 BETTER_AUTH_URL。
  const origin = trustedInviteOrigin(c.req.header("origin"));
  const result = await createInviteForOrg(
    user.id,
    organizationId,
    parsed,
    origin,
  );
  return c.json({ ok: true, data: result }, 201);
});

organizationRouter.delete(
  "/organizations/:organizationId/invites/:inviteId",
  async (c) => {
    const user = requireUser(c);
    const params = parseParams(c, InviteParamsSchema);
    await revokeInviteForOrg(user.id, params.organizationId, params.inviteId);
    return c.json({ ok: true, data: { revoked: true } });
  },
);

// ---- 控制台：所有权转移 ----

organizationRouter.put("/organizations/:organizationId/owner", async (c) => {
  const user = requireUser(c);
  const { organizationId } = parseParams(c, OrganizationIdParamsSchema);
  const parsed = await parseJson(c, TransferOwnerSchema);
  const result = await transferOwnerForOrg(
    user.id,
    organizationId,
    parsed.newOwnerUserId,
  );
  return c.json({ ok: true, data: result });
});

export default organizationRouter;
