import { Hono } from "hono";
import { createContractBinder } from "../../lib/contract";
import { notFound, validationError } from "../../lib/errors";
import { getObject, putObject } from "../../storage";
import type { ApiEnv } from "../../types";
import {
  assertProjectMediaAccess,
  assertValidImageMagicBytes,
  buildMediaResponseHeaders,
  resolveDeclaredImageType,
} from "../project/service";
import {
  createArticleForProject,
  createArticleRevisionForProject,
  deleteArticleForProject,
  duplicateArticleForProject,
  getArticleForProject,
  listArticleDirectoryForProject,
  listArticleRevisionsForProject,
  restoreArticleRevisionForProject,
  updateArticleForProject,
} from "./service";

const MAX_ARTICLE_ASSET_BYTES = 5 * 1024 * 1024;

async function readBoundedAssetBody(
  request: Request,
): Promise<{ body: Uint8Array } | { exceeded: true }> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_ARTICLE_ASSET_BYTES
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
      if (total > MAX_ARTICLE_ASSET_BYTES) {
        exceeded = true;
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (exceeded) return { exceeded: true };
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

export const articleRouter = new Hono<ApiEnv>();
const route = createContractBinder(
  articleRouter,
  "apps/api/src/modules/article/router.ts",
);

route("get", "/projects/:projectId/articles", async (c, { user, params }) => {
  const directory = await listArticleDirectoryForProject(
    user.id,
    params.projectId,
  );
  return c.json({ ok: true, data: directory });
});

route(
  "post",
  "/projects/:projectId/articles",
  async (c, { user, params, body }) => {
    const article = await createArticleForProject(
      user.id,
      params.projectId,
      body,
    );
    return c.json({ ok: true, data: { article } }, 201);
  },
);

route(
  "get",
  "/projects/:projectId/articles/:articleId",
  async (c, { user, params }) => {
    const article = await getArticleForProject(
      user.id,
      params.projectId,
      params.articleId,
    );
    return c.json({ ok: true, data: { article } });
  },
);

route(
  "patch",
  "/projects/:projectId/articles/:articleId",
  async (c, { user, params, body }) => {
    const article = await updateArticleForProject(
      user.id,
      params.projectId,
      params.articleId,
      body,
    );
    return c.json({ ok: true, data: { article } });
  },
);

route(
  "post",
  "/projects/:projectId/articles/:articleId/duplicate",
  async (c, { user, params }) => {
    const article = await duplicateArticleForProject(
      user.id,
      params.projectId,
      params.articleId,
    );
    return c.json({ ok: true, data: { article } }, 201);
  },
);

route(
  "delete",
  "/projects/:projectId/articles/:articleId",
  async (c, { user, params }) => {
    await deleteArticleForProject(user.id, params.projectId, params.articleId);
    return c.json({ ok: true, data: { deleted: true } });
  },
);

route(
  "get",
  "/projects/:projectId/articles/:articleId/revisions",
  async (c, { user, params }) => {
    const revisions = await listArticleRevisionsForProject(
      user.id,
      params.projectId,
      params.articleId,
    );
    return c.json({ ok: true, data: { revisions } });
  },
);

route(
  "post",
  "/projects/:projectId/articles/:articleId/revisions",
  async (c, { user, params, body }) => {
    const revision = await createArticleRevisionForProject(
      user.id,
      params.projectId,
      params.articleId,
      body,
    );
    return c.json({ ok: true, data: { revision } }, 201);
  },
);

route(
  "post",
  "/projects/:projectId/articles/:articleId/revisions/:revisionId/restore",
  async (c, { user, params, body }) => {
    const restored = await restoreArticleRevisionForProject(
      user.id,
      params.projectId,
      params.articleId,
      params.revisionId,
      body,
    );
    return c.json({ ok: true, data: restored });
  },
);

route(
  "post",
  "/projects/:projectId/article-assets",
  async (c, { user, params }) => {
    const { projectId } = params;
    await assertProjectMediaAccess(user.id, projectId, "write");

    const { ext, contentType } = resolveDeclaredImageType(
      c.req.header("content-type"),
    );
    const read = await readBoundedAssetBody(c.req.raw);
    if ("exceeded" in read) {
      return c.json(
        { ok: false, code: "VALIDATION", message: "图片大小不能超过 5MB" },
        413,
      );
    }
    assertValidImageMagicBytes(read.body, ext);

    const fileName = `${crypto.randomUUID()}.${ext}`;
    const objectKey = `article-assets/${projectId}/${fileName}`;
    await putObject(objectKey, read.body, contentType);

    return c.json(
      {
        ok: true,
        data: {
          key: fileName,
          url: `/api/v1/projects/${projectId}/article-assets/${fileName}`,
        },
      },
      201,
    );
  },
);

route(
  "get",
  "/projects/:projectId/article-assets/:fileName",
  async (_c, { user, params }) => {
    const { projectId, fileName } = params;
    await assertProjectMediaAccess(user.id, projectId, "read");

    const bytes = await getObject(`article-assets/${projectId}/${fileName}`);
    if (!bytes) throw notFound();

    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: buildMediaResponseHeaders(fileName),
    });
  },
);

export default articleRouter;
