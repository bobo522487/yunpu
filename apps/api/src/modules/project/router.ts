import { OrganizationIdParamsSchema } from "@yunpu/shared";
import { Hono } from "hono";
import { AppError } from "../../lib/errors";
import type { ApiEnv } from "../../types";
import {
  CreateProjectSchema,
  ListProjectsQuerySchema,
  ProjectIdParamsSchema,
  UpdateProjectSchema,
} from "./schema";
import {
  createProject,
  getProjectById,
  listProjectsForOrg,
  removeProject,
  updateProject,
} from "./service";

function requireUser(user: ApiEnv["Variables"]["user"]) {
  if (!user) throw new AppError("UNAUTHORIZED", "需要登录", 401);
  return user;
}

function validationError(details: Record<string, unknown>): AppError {
  return new AppError("VALIDATION", "请求参数不合法", 400, details);
}

export const projectRouter = new Hono<ApiEnv>();

projectRouter.get("/organizations/:organizationId/projects", async (c) => {
  const user = requireUser(c.get("user"));
  const params = OrganizationIdParamsSchema.safeParse(c.req.param());
  if (!params.success) {
    throw validationError(params.error.flatten().fieldErrors);
  }
  const query = ListProjectsQuerySchema.safeParse(c.req.query());
  if (!query.success) {
    throw validationError(query.error.flatten().fieldErrors);
  }
  const page = await listProjectsForOrg(user.id, params.data.organizationId, {
    cursor: query.data.cursor,
    limit: query.data.limit,
  });
  return c.json({ ok: true, data: page });
});

projectRouter.post("/organizations/:organizationId/projects", async (c) => {
  const user = requireUser(c.get("user"));
  const organizationId = c.req.param("organizationId");
  const body = await c.req.json().catch(() => null);
  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) {
    throw validationError(parsed.error.flatten().fieldErrors);
  }
  const project = await createProject(user.id, organizationId, parsed.data);
  return c.json({ ok: true, data: { project } }, 201);
});

projectRouter.get("/projects/:projectId", async (c) => {
  const user = requireUser(c.get("user"));
  const parsed = ProjectIdParamsSchema.safeParse(c.req.param());
  if (!parsed.success) {
    throw validationError(parsed.error.flatten().fieldErrors);
  }
  const project = await getProjectById(user.id, parsed.data.projectId);
  return c.json({ ok: true, data: { project } });
});

projectRouter.patch("/projects/:projectId", async (c) => {
  const user = requireUser(c.get("user"));
  const parsedParams = ProjectIdParamsSchema.safeParse(c.req.param());
  if (!parsedParams.success) {
    throw validationError(parsedParams.error.flatten().fieldErrors);
  }
  const body = await c.req.json().catch(() => null);
  const parsed = UpdateProjectSchema.safeParse(body);
  if (!parsed.success) {
    throw validationError(parsed.error.flatten().fieldErrors);
  }
  const { expectedUpdatedAt, ...values } = parsed.data;
  const project = await updateProject(
    user.id,
    parsedParams.data.projectId,
    expectedUpdatedAt,
    values,
  );
  return c.json({ ok: true, data: { project } });
});

projectRouter.delete("/projects/:projectId", async (c) => {
  const user = requireUser(c.get("user"));
  const parsed = ProjectIdParamsSchema.safeParse(c.req.param());
  if (!parsed.success) {
    throw validationError(parsed.error.flatten().fieldErrors);
  }
  await removeProject(user.id, parsed.data.projectId);
  return c.json({ ok: true, data: { deleted: true } });
});

export default projectRouter;
