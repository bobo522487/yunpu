import {
  CreateLineageSchema,
  LineageIdParamsSchema,
  ProjectIdParamsSchema,
  UpdateLineageSchema,
} from "@yunpu/shared";
import { Hono } from "hono";
import { parseJson, parseParams, requireUser } from "../../lib/http";
import type { ApiEnv } from "../../types";
import {
  createLineageForProject,
  deleteLineageForProject,
  getLineageGraphForProject,
  listLineageDirectoryForProject,
  updateLineageForProject,
} from "./service";

export const lineageRouter = new Hono<ApiEnv>();

lineageRouter.get("/projects/:projectId/lineages", async (c) => {
  const user = requireUser(c);
  const { projectId } = parseParams(c, ProjectIdParamsSchema);
  const directory = await listLineageDirectoryForProject(user.id, projectId);
  return c.json({ ok: true, data: directory });
});

lineageRouter.post("/projects/:projectId/lineages", async (c) => {
  const user = requireUser(c);
  const { projectId } = parseParams(c, ProjectIdParamsSchema);
  const input = await parseJson(c, CreateLineageSchema);
  const created = await createLineageForProject(user.id, projectId, input);
  return c.json({ ok: true, data: created }, 201);
});

lineageRouter.patch("/projects/:projectId/lineages/:lineageId", async (c) => {
  const user = requireUser(c);
  const { projectId, lineageId } = parseParams(c, LineageIdParamsSchema);
  const input = await parseJson(c, UpdateLineageSchema);
  const lineage = await updateLineageForProject(
    user.id,
    projectId,
    lineageId,
    input,
  );
  return c.json({ ok: true, data: { lineage } });
});

lineageRouter.delete("/projects/:projectId/lineages/:lineageId", async (c) => {
  const user = requireUser(c);
  const { projectId, lineageId } = parseParams(c, LineageIdParamsSchema);
  await deleteLineageForProject(user.id, projectId, lineageId);
  return c.json({ ok: true, data: { deleted: true } });
});

lineageRouter.get(
  "/projects/:projectId/lineages/:lineageId/graph",
  async (c) => {
    const user = requireUser(c);
    const { projectId, lineageId } = parseParams(c, LineageIdParamsSchema);
    const graph = await getLineageGraphForProject(
      user.id,
      projectId,
      lineageId,
    );
    return c.json({ ok: true, data: graph });
  },
);

export default lineageRouter;
