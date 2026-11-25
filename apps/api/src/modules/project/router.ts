import {
  CreateProjectSchema,
  ListProjectsQuerySchema,
  OrganizationIdParamsSchema,
  ProjectIdParamsSchema,
  UpdateProjectSchema,
} from "@yunpu/shared";
import { Hono } from "hono";
import {
  parseJson,
  parseParams,
  parseQuery,
  requireUser,
} from "../../lib/http";
import type { ApiEnv } from "../../types";
import {
  createProject,
  getProjectById,
  listProjectsForOrg,
  removeProject,
  updateProject,
} from "./service";

export const projectRouter = new Hono<ApiEnv>();

projectRouter.get("/organizations/:organizationId/projects", async (c) => {
  const user = requireUser(c);
  const params = parseParams(c, OrganizationIdParamsSchema);
  const query = parseQuery(c, ListProjectsQuerySchema);
  const page = await listProjectsForOrg(user.id, params.organizationId, {
    cursor: query.cursor,
    limit: query.limit,
  });
  return c.json({ ok: true, data: page });
});

projectRouter.post("/organizations/:organizationId/projects", async (c) => {
  const user = requireUser(c);
  const { organizationId } = parseParams(c, OrganizationIdParamsSchema);
  const input = await parseJson(c, CreateProjectSchema);
  const project = await createProject(user.id, organizationId, input);
  return c.json({ ok: true, data: { project } }, 201);
});

projectRouter.get("/projects/:projectId", async (c) => {
  const user = requireUser(c);
  const { projectId } = parseParams(c, ProjectIdParamsSchema);
  const project = await getProjectById(user.id, projectId);
  return c.json({ ok: true, data: { project } });
});

projectRouter.patch("/projects/:projectId", async (c) => {
  const user = requireUser(c);
  const { projectId } = parseParams(c, ProjectIdParamsSchema);
  const { version, ...values } = await parseJson(c, UpdateProjectSchema);
  const project = await updateProject(user.id, projectId, version, values);
  return c.json({ ok: true, data: { project } });
});

projectRouter.delete("/projects/:projectId", async (c) => {
  const user = requireUser(c);
  const { projectId } = parseParams(c, ProjectIdParamsSchema);
  await removeProject(user.id, projectId);
  return c.json({ ok: true, data: { deleted: true } });
});

export default projectRouter;
