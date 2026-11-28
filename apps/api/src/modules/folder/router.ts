import { Hono } from "hono";
import { createContractBinder } from "../../lib/contract";
import type { ApiEnv } from "../../types";
import {
  createFolderForProject,
  deleteFolderForProject,
  listFoldersForProject,
  updateFolderForProject,
} from "./service";

export const folderRouter = new Hono<ApiEnv>();
const route = createContractBinder(
  folderRouter,
  "apps/api/src/modules/folder/router.ts",
);

route(
  "get",
  "/projects/:projectId/folders",
  async (c, { user, params, query }) => {
    const folders = await listFoldersForProject(
      user.id,
      params.projectId,
      query.kind,
    );
    return c.json({ ok: true, data: { folders } });
  },
);

route(
  "post",
  "/projects/:projectId/folders",
  async (c, { user, params, body }) => {
    const folder = await createFolderForProject(
      user.id,
      params.projectId,
      body,
    );
    return c.json({ ok: true, data: { folder } }, 201);
  },
);

route(
  "patch",
  "/projects/:projectId/folders/:folderId",
  async (c, { user, params, body }) => {
    const folder = await updateFolderForProject(
      user.id,
      params.projectId,
      params.folderId,
      body,
    );
    return c.json({ ok: true, data: { folder } });
  },
);

route(
  "delete",
  "/projects/:projectId/folders/:folderId",
  async (c, { user, params }) => {
    await deleteFolderForProject(user.id, params.projectId, params.folderId);
    return c.json({ ok: true, data: { deleted: true } });
  },
);

export default folderRouter;
