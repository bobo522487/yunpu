import { Hono } from "hono";
import { config } from "../../config";
import { AppError } from "../../lib/errors";
import type { ApiEnv } from "../../types";
import {
  AcceptInviteSchema,
  CreateInviteSchema,
  CreateOrganizationSchema,
  InviteParamsSchema,
  ListPageQuerySchema,
  MemberParamsSchema,
  OrganizationIdParamsSchema,
  TransferOwnerSchema,
  UpdateMemberRoleSchema,
  UpdateOrganizationSchema,
} from "./schema";
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

function requireUser(user: ApiEnv["Variables"]["user"]) {
  if (!user) throw new AppError("UNAUTHORIZED", "需要登录", 401);
  return user;
}

function validationError(details: Record<string, unknown>): AppError {
  return new AppError("VALIDATION", "请求参数不合法", 400, details);
}

export const organizationRouter = new Hono<ApiEnv>();

organizationRouter.get("/organizations", async (c) => {
  const user = requireUser(c.get("user"));
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
  const user = requireUser(c.get("user"));
  const parsed = OrganizationIdParamsSchema.safeParse(c.req.param());
  if (!parsed.success) {
    throw validationError(parsed.error.flatten().fieldErrors);
  }
  const organization = await getOrganization(
    user.id,
    parsed.data.organizationId,
  );
  if (!organization) {
    throw new AppError("NOT_FOUND", "目标不存在或已失效", 404);
  }
  return c.json({ ok: true, data: { organization } });
});

organizationRouter.patch("/organizations/:organizationId", async (c) => {
  const user = requireUser(c.get("user"));
  const parsed = OrganizationIdParamsSchema.safeParse(c.req.param());
  if (!parsed.success) {
    throw validationError(parsed.error.flatten().fieldErrors);
  }
  const body = await c.req.json().catch(() => null);
  const patch = UpdateOrganizationSchema.safeParse(body);
  if (!patch.success) {
    throw validationError(patch.error.flatten().fieldErrors);
  }
  const organization = await updateOrganizationForUser(
    user.id,
    parsed.data.organizationId,
    patch.data,
  );
  return c.json({ ok: true, data: { organization } });
});

organizationRouter.post("/organizations/:organizationId/leave", async (c) => {
  const user = requireUser(c.get("user"));
  const parsed = OrganizationIdParamsSchema.safeParse(c.req.param());
  if (!parsed.success) {
    throw validationError(parsed.error.flatten().fieldErrors);
  }
  await leaveOrganizationForUser(user.id, parsed.data.organizationId);
  return c.json({ ok: true, data: { left: true } });
});

organizationRouter.post("/organizations", async (c) => {
  const user = requireUser(c.get("user"));
  const body = await c.req.json().catch(() => null);
  const parsed = CreateOrganizationSchema.safeParse(body);
  if (!parsed.success) {
    throw validationError(parsed.error.flatten().fieldErrors);
  }
  const organization = await createOrganization(user.id, parsed.data.name);
  return c.json({ ok: true, data: { organization } }, 201);
});

organizationRouter.post(
  "/organizations/:organizationId/activate",
  async (c) => {
    const user = requireUser(c.get("user"));
    const parsed = OrganizationIdParamsSchema.safeParse(c.req.param());
    if (!parsed.success) {
      throw validationError(parsed.error.flatten().fieldErrors);
    }
    const organization = await activateOrganizationForUser(
      user.id,
      parsed.data.organizationId,
    );
    return c.json({ ok: true, data: { organization } });
  },
);

organizationRouter.post("/invites/accept", async (c) => {
  const user = requireUser(c.get("user"));
  const body = await c.req.json().catch(() => null);
  const parsed = AcceptInviteSchema.safeParse(body);
  if (!parsed.success) {
    throw validationError(parsed.error.flatten().fieldErrors);
  }
  const organization = await acceptInvite(user.id, parsed.data.token);
  return c.json({
    ok: true,
    data: { organization, defaultOrganizationChanged: true },
  });
});

// ---- 控制台：成员 ----

organizationRouter.get("/organizations/:organizationId/members", async (c) => {
  const user = requireUser(c.get("user"));
  const params = MemberParamsSchema.pick({ organizationId: true }).safeParse(
    c.req.param(),
  );
  if (!params.success) {
    throw validationError(params.error.flatten().fieldErrors);
  }
  const query = ListPageQuerySchema.safeParse(c.req.query());
  if (!query.success) {
    throw validationError(query.error.flatten().fieldErrors);
  }
  const page = await listMembersForOrg(
    user.id,
    params.data.organizationId,
    query.data,
  );
  return c.json({ ok: true, data: page });
});

organizationRouter.patch(
  "/organizations/:organizationId/members/:userId",
  async (c) => {
    const user = requireUser(c.get("user"));
    const params = MemberParamsSchema.safeParse(c.req.param());
    if (!params.success) {
      throw validationError(params.error.flatten().fieldErrors);
    }
    const body = await c.req.json().catch(() => null);
    const parsed = UpdateMemberRoleSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError(parsed.error.flatten().fieldErrors);
    }
    const member = await updateMemberRoleForOrg(
      user.id,
      params.data.organizationId,
      params.data.userId,
      parsed.data.role,
    );
    return c.json({ ok: true, data: { member } });
  },
);

organizationRouter.delete(
  "/organizations/:organizationId/members/:userId",
  async (c) => {
    const user = requireUser(c.get("user"));
    const params = MemberParamsSchema.safeParse(c.req.param());
    if (!params.success) {
      throw validationError(params.error.flatten().fieldErrors);
    }
    await removeMemberFromOrg(
      user.id,
      params.data.organizationId,
      params.data.userId,
    );
    return c.json({ ok: true, data: { removed: true } });
  },
);

// ---- 控制台：邀请 ----

organizationRouter.get("/organizations/:organizationId/invites", async (c) => {
  const user = requireUser(c.get("user"));
  const params = OrganizationIdParamsSchema.safeParse(c.req.param());
  if (!params.success) {
    throw validationError(params.error.flatten().fieldErrors);
  }
  const query = ListPageQuerySchema.safeParse(c.req.query());
  if (!query.success) {
    throw validationError(query.error.flatten().fieldErrors);
  }
  const page = await listInvitesForOrg(
    user.id,
    params.data.organizationId,
    query.data,
  );
  return c.json({ ok: true, data: page });
});

organizationRouter.post("/organizations/:organizationId/invites", async (c) => {
  const user = requireUser(c.get("user"));
  const params = OrganizationIdParamsSchema.safeParse(c.req.param());
  if (!params.success) {
    throw validationError(params.error.flatten().fieldErrors);
  }
  const body = await c.req.json().catch(() => null);
  const parsed = CreateInviteSchema.safeParse(body);
  if (!parsed.success) {
    throw validationError(parsed.error.flatten().fieldErrors);
  }
  // 邀请链接指向前端；浏览器同源代理会带上 Origin，缺省回退到已配置的应用地址。
  const origin = c.req.header("origin") ?? config().BETTER_AUTH_URL;
  const result = await createInviteForOrg(
    user.id,
    params.data.organizationId,
    parsed.data,
    origin,
  );
  return c.json({ ok: true, data: result }, 201);
});

organizationRouter.delete(
  "/organizations/:organizationId/invites/:inviteId",
  async (c) => {
    const user = requireUser(c.get("user"));
    const params = InviteParamsSchema.safeParse(c.req.param());
    if (!params.success) {
      throw validationError(params.error.flatten().fieldErrors);
    }
    await revokeInviteForOrg(
      user.id,
      params.data.organizationId,
      params.data.inviteId,
    );
    return c.json({ ok: true, data: { revoked: true } });
  },
);

// ---- 控制台：所有权转移 ----

organizationRouter.put("/organizations/:organizationId/owner", async (c) => {
  const user = requireUser(c.get("user"));
  const params = OrganizationIdParamsSchema.safeParse(c.req.param());
  if (!params.success) {
    throw validationError(params.error.flatten().fieldErrors);
  }
  const body = await c.req.json().catch(() => null);
  const parsed = TransferOwnerSchema.safeParse(body);
  if (!parsed.success) {
    throw validationError(parsed.error.flatten().fieldErrors);
  }
  const result = await transferOwnerForOrg(
    user.id,
    params.data.organizationId,
    parsed.data.newOwnerUserId,
  );
  return c.json({ ok: true, data: result });
});

export default organizationRouter;
