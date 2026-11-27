import {
  ArticleIdParamsSchema,
  ArticleRevisionIdParamsSchema,
  CreateArticleRevisionSchema,
  CreateArticleSchema,
  ProjectIdParamsSchema,
  ProjectMediaParamsSchema,
  RestoreArticleRevisionSchema,
  UpdateArticleSchema,
} from "@yunpu/shared";
import { Hono } from "hono";
import { notFound, validationError } from "../../lib/errors";
import { parseJson, parseParams, requireUser } from "../../lib/http";
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

articleRouter.get("/projects/:projectId/articles", async (c) => {
  const user = requireUser(c);
  const { projectId } = parseParams(c, ProjectIdParamsSchema);
  const directory = await listArticleDirectoryForProject(user.id, projectId);
  return c.json({ ok: true, data: directory });
});

articleRouter.post("/projects/:projectId/articles", async (c) => {
  const user = requireUser(c);
  const { projectId } = parseParams(c, ProjectIdParamsSchema);
  const input = await parseJson(c, CreateArticleSchema);
  const article = await createArticleForProject(user.id, projectId, input);
  return c.json({ ok: true, data: { article } }, 201);
});

articleRouter.get("/projects/:projectId/articles/:articleId", async (c) => {
  const user = requireUser(c);
  const { projectId, articleId } = parseParams(c, ArticleIdParamsSchema);
  const article = await getArticleForProject(user.id, projectId, articleId);
  return c.json({ ok: true, data: { article } });
});

articleRouter.patch("/projects/:projectId/articles/:articleId", async (c) => {
  const user = requireUser(c);
  const { projectId, articleId } = parseParams(c, ArticleIdParamsSchema);
  const input = await parseJson(c, UpdateArticleSchema);
  const article = await updateArticleForProject(
    user.id,
    projectId,
    articleId,
    input,
  );
  return c.json({ ok: true, data: { article } });
});

articleRouter.post(
  "/projects/:projectId/articles/:articleId/duplicate",
  async (c) => {
    const user = requireUser(c);
    const { projectId, articleId } = parseParams(c, ArticleIdParamsSchema);
    const article = await duplicateArticleForProject(
      user.id,
      projectId,
      articleId,
    );
    return c.json({ ok: true, data: { article } }, 201);
  },
);

articleRouter.delete("/projects/:projectId/articles/:articleId", async (c) => {
  const user = requireUser(c);
  const { projectId, articleId } = parseParams(c, ArticleIdParamsSchema);
  await deleteArticleForProject(user.id, projectId, articleId);
  return c.json({ ok: true, data: { deleted: true } });
});

articleRouter.get(
  "/projects/:projectId/articles/:articleId/revisions",
  async (c) => {
    const user = requireUser(c);
    const { projectId, articleId } = parseParams(c, ArticleIdParamsSchema);
    const revisions = await listArticleRevisionsForProject(
      user.id,
      projectId,
      articleId,
    );
    return c.json({ ok: true, data: { revisions } });
  },
);

articleRouter.post(
  "/projects/:projectId/articles/:articleId/revisions",
  async (c) => {
    const user = requireUser(c);
    const { projectId, articleId } = parseParams(c, ArticleIdParamsSchema);
    const input = await parseJson(c, CreateArticleRevisionSchema);
    const revision = await createArticleRevisionForProject(
      user.id,
      projectId,
      articleId,
      input,
    );
    return c.json({ ok: true, data: { revision } }, 201);
  },
);

articleRouter.post(
  "/projects/:projectId/articles/:articleId/revisions/:revisionId/restore",
  async (c) => {
    const user = requireUser(c);
    const { projectId, articleId, revisionId } = parseParams(
      c,
      ArticleRevisionIdParamsSchema,
    );
    const input = await parseJson(c, RestoreArticleRevisionSchema);
    const restored = await restoreArticleRevisionForProject(
      user.id,
      projectId,
      articleId,
      revisionId,
      input,
    );
    return c.json({ ok: true, data: restored });
  },
);

articleRouter.post("/projects/:projectId/article-assets", async (c) => {
  const user = requireUser(c);
  const { projectId } = parseParams(c, ProjectIdParamsSchema);
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
});

articleRouter.get(
  "/projects/:projectId/article-assets/:fileName",
  async (c) => {
    const user = requireUser(c);
    const { projectId, fileName } = parseParams(c, ProjectMediaParamsSchema);
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
