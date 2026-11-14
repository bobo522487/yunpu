import { Hono } from "hono";
import { AppError } from "../../lib/errors";
import type { ApiEnv } from "../../types";
import {
  AcceptInviteSchema,
  CreateOrganizationSchema,
  OrganizationIdParamsSchema,
} from "./schema";
import {
  acceptInvite,
  activateOrganizationForUser,
  createOrganization,
  listMyOrganizations,
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

organizationRouter.post("/organizations/:organizationId/activate", async (c) => {
  const user = requireUser(c.get("user"));
  const parsed = OrganizationIdParamsSchema.safeParse(c.req.param());
  if (!parsed.success) {
    throw validationError(parsed.error.flatten().fieldErrors);
  }
  const organization = await activateOrganizationForUser(user.id, parsed.data.organizationId);
  return c.json({ ok: true, data: { organization } });
});

organizationRouter.post("/invites/accept", async (c) => {
  const user = requireUser(c.get("user"));
  const body = await c.req.json().catch(() => null);
  const parsed = AcceptInviteSchema.safeParse(body);
  if (!parsed.success) {
    throw validationError(parsed.error.flatten().fieldErrors);
  }
  const organization = await acceptInvite(user.id, parsed.data.token);
  return c.json({ ok: true, data: { organization, defaultOrganizationChanged: true } });
});

export default organizationRouter;
