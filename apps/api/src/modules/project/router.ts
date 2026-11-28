import { Hono } from "hono";
import { createContractBinder } from "../../lib/contract";
import { notFound, validationError } from "../../lib/errors";
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
const route = createContractBinder(
  projectRouter,
  "apps/api/src/modules/project/router.ts",
);

route(
  "get",
  "/organizations/:organizationId/projects",
  async (c, { user, params, query }) => {
    const page = await listProjectsForOrg(user.id, params.organizationId, {
      cursor: query.cursor,
      limit: query.limit,
    });
    return c.json({ ok: true, data: page });
  },
);

route(
  "post",
  "/organizations/:organizationId/projects",
  async (c, { user, params, body }) => {
    const project = await createProject(user.id, params.organizationId, body);
    return c.json({ ok: true, data: { project } }, 201);
  },
);

route("get", "/projects/:projectId", async (c, { user, params }) => {
  const project = await getProjectById(user.id, params.projectId);
  return c.json({ ok: true, data: { project } });
});

route("patch", "/projects/:projectId", async (c, { user, params, body }) => {
  const { version, ...values } = body;
  const project = await updateProject(
    user.id,
    params.projectId,
    version,
    values,
  );
  return c.json({ ok: true, data: { project } });
});

route("delete", "/projects/:projectId", async (c, { user, params }) => {
  await removeProject(user.id, params.projectId);
  return c.json({ ok: true, data: { deleted: true } });
});

route("post", "/projects/:projectId/media", async (c, { user, params }) => {
  const { projectId } = params;
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

route(
  "get",
  "/projects/:projectId/media/:fileName",
  async (_c, { user, params }) => {
    const { projectId, fileName } = params;
    await assertProjectMediaAccess(user.id, projectId, "read");

    const bytes = await getObject(`projects/${projectId}/${fileName}`);
    if (!bytes) throw notFound();

    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: buildMediaResponseHeaders(fileName),
    });
  },
);

export default projectRouter;
