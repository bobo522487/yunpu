import { Hono } from "hono";
import { createContractBinder } from "../../lib/contract";
import type { ApiEnv } from "../../types";
import {
  createLineageForProject,
  deleteLineageForProject,
  getLineageGraphForProject,
  listLineageDirectoryForProject,
  updateLineageForProject,
} from "./service";

export const lineageRouter = new Hono<ApiEnv>();
const route = createContractBinder(
  lineageRouter,
  "apps/api/src/modules/lineage/router.ts",
);

route("get", "/projects/:projectId/lineages", async (c, { user, params }) => {
  const directory = await listLineageDirectoryForProject(
    user.id,
    params.projectId,
  );
  return c.json({ ok: true, data: directory });
});

route(
  "post",
  "/projects/:projectId/lineages",
  async (c, { user, params, body }) => {
    const created = await createLineageForProject(
      user.id,
      params.projectId,
      body,
    );
    return c.json({ ok: true, data: created }, 201);
  },
);

route(
  "patch",
  "/projects/:projectId/lineages/:lineageId",
  async (c, { user, params, body }) => {
    const lineage = await updateLineageForProject(
      user.id,
      params.projectId,
      params.lineageId,
      body,
    );
    return c.json({ ok: true, data: { lineage } });
  },
);

route(
  "delete",
  "/projects/:projectId/lineages/:lineageId",
  async (c, { user, params }) => {
    await deleteLineageForProject(user.id, params.projectId, params.lineageId);
    return c.json({ ok: true, data: { deleted: true } });
  },
);

route(
  "get",
  "/projects/:projectId/lineages/:lineageId/graph",
  async (c, { user, params }) => {
    const graph = await getLineageGraphForProject(
      user.id,
      params.projectId,
      params.lineageId,
    );
    return c.json({ ok: true, data: graph });
  },
);

export default lineageRouter;
