import {
  CreateProjectSchema,
  ListProjectsQuerySchema,
  OrganizationIdParamsSchema,
  ProjectIdParamsSchema,
  ProjectMediaParamsSchema,
  UpdateProjectSchema,
} from "@yunpu/shared";
import { Hono } from "hono";
import { notFound, validationError } from "../../lib/errors";
import {
  parseJson,
  parseParams,
  parseQuery,
  requireUser,
} from "../../lib/http";
import { getObject, putObject } from "../../storage";
import type { ApiEnv } from "../../types";
import {
  assertProjectMediaAccess,
  assertValidImageMagicBytes,
  buildMediaResponseHeaders,
  createProject,
  getProjectById,
  listProjectsForOrg,
  removeProject,
  resolveDeclaredImageType,
  updateProject,
} from "./service";

const MAX_PROJECT_MEDIA_BYTES = 5 * 1024 * 1024;

async function readBoundedImageBody(
  request: Request,
): Promise<{ body: Uint8Array } | { exceeded: true }> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_PROJECT_MEDIA_BYTES
  ) {
    return { exceeded: true };
  }

  const stream = request.body;
  if (!stream) {
    throw validationError({ body: "图片内容不能为空" });
  }

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let exceeded = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_PROJECT_MEDIA_BYTES) {
        exceeded = true;
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (exceeded) {
    return { exceeded: true };
  }
  if (total === 0) {
    throw validationError({ body: "图片内容不能为空" });
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { body };
}

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

projectRouter.post("/projects/:projectId/media", async (c) => {
  const user = requireUser(c);
  const { projectId } = parseParams(c, ProjectIdParamsSchema);
  await assertProjectMediaAccess(user.id, projectId, "write");

  const { ext, contentType } = resolveDeclaredImageType(
    c.req.header("content-type"),
  );
  const read = await readBoundedImageBody(c.req.raw);
  if ("exceeded" in read) {
    return c.json(
      { ok: false, code: "VALIDATION", message: "图片大小不能超过 5MB" },
      413,
    );
  }
  assertValidImageMagicBytes(read.body, ext);

  const fileName = `${crypto.randomUUID()}.${ext}`;
  const objectKey = `projects/${projectId}/${fileName}`;
  await putObject(objectKey, read.body, contentType);

  return c.json(
    {
      ok: true,
      data: {
        key: fileName,
        url: `/api/v1/projects/${projectId}/media/${fileName}`,
      },
    },
    201,
  );
});

projectRouter.get("/projects/:projectId/media/:fileName", async (c) => {
  const user = requireUser(c);
  const { projectId, fileName } = parseParams(c, ProjectMediaParamsSchema);
  await assertProjectMediaAccess(user.id, projectId, "read");

  const bytes = await getObject(`projects/${projectId}/${fileName}`);
  if (!bytes) throw notFound();

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: buildMediaResponseHeaders(fileName),
  });
});

export default projectRouter;
