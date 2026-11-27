import {
  CreateFolderSchema,
  FolderIdParamsSchema,
  ListFoldersQuerySchema,
  ProjectIdParamsSchema,
  UpdateFolderSchema,
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
  createFolderForProject,
  deleteFolderForProject,
  listFoldersForProject,
  updateFolderForProject,
} from "./service";

export const folderRouter = new Hono<ApiEnv>();

folderRouter.get("/projects/:projectId/folders", async (c) => {
  const user = requireUser(c);
  const { projectId } = parseParams(c, ProjectIdParamsSchema);
  const query = parseQuery(c, ListFoldersQuerySchema);
  const folders = await listFoldersForProject(user.id, projectId, query.kind);
  return c.json({ ok: true, data: { folders } });
});

folderRouter.post("/projects/:projectId/folders", async (c) => {
  const user = requireUser(c);
  const { projectId } = parseParams(c, ProjectIdParamsSchema);
  const input = await parseJson(c, CreateFolderSchema);
  const folder = await createFolderForProject(user.id, projectId, input);
  return c.json({ ok: true, data: { folder } }, 201);
});

folderRouter.patch("/projects/:projectId/folders/:folderId", async (c) => {
  const user = requireUser(c);
  const { projectId, folderId } = parseParams(c, FolderIdParamsSchema);
  const input = await parseJson(c, UpdateFolderSchema);
  const folder = await updateFolderForProject(
    user.id,
    projectId,
    folderId,
    input,
  );
  return c.json({ ok: true, data: { folder } });
});

folderRouter.delete("/projects/:projectId/folders/:folderId", async (c) => {
  const user = requireUser(c);
  const { projectId, folderId } = parseParams(c, FolderIdParamsSchema);
  await deleteFolderForProject(user.id, projectId, folderId);
  return c.json({ ok: true, data: { deleted: true } });
});

export default folderRouter;
