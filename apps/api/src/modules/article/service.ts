import type {
  CreateArticleInput,
  CreateArticleRevisionInput,
  RestoreArticleRevisionInput,
  UpdateArticleInput,
} from "@yunpu/shared";
import { requireProjectMember } from "../../access";
import { withTenantTransaction } from "../../db/with-tenant-transaction";
import { AppError, notFound } from "../../lib/errors";
import {
  type FolderRecord,
  folderExistsInTx,
  listFoldersInTx,
} from "../folder/service";
import {
  type ArticleRecord,
  type ArticleRevisionRecord,
  casUpdateArticle,
  deleteArticle,
  getArticle,
  getArticleRevision,
  insertArticle,
  insertArticleRevision,
  listArticleRevisions,
  listArticles,
} from "./queries";

export type { ArticleRecord, ArticleRevisionRecord };

function articleVersionConflict(current: ArticleRecord): AppError {
  return new AppError(
    "VERSION_CONFLICT",
    "谱文已被他人修改，请刷新后重试",
    409,
    {
      article: current,
    },
  );
}

export async function listArticleDirectoryForProject(
  userId: string,
  projectId: string,
): Promise<{ folders: FolderRecord[]; articles: ArticleRecord[] }> {
  return withTenantTransaction({ userId, readOnly: true }, async (db) => {
    await requireProjectMember(db, projectId, userId, null);
    const [folders, articles] = await Promise.all([
      listFoldersInTx(db, projectId, "article"),
      listArticles(db, projectId),
    ]);
    return { folders, articles };
  });
}

export async function getArticleForProject(
  userId: string,
  projectId: string,
  articleId: string,
): Promise<ArticleRecord> {
  return withTenantTransaction({ userId, readOnly: true }, async (db) => {
    await requireProjectMember(db, projectId, userId, null);
    const found = await getArticle(db, projectId, articleId);
    if (!found) throw notFound();
    return found;
  });
}

export async function createArticleForProject(
  userId: string,
  projectId: string,
  input: CreateArticleInput,
): Promise<ArticleRecord> {
  return withTenantTransaction({ userId }, async (db) => {
    const { organizationId } = await requireProjectMember(
      db,
      projectId,
      userId,
      "editor",
    );
    if (input.folderId) {
      const exists = await folderExistsInTx(
        db,
        projectId,
        input.folderId,
        "article",
      );
      if (!exists) throw notFound();
    }
    return insertArticle(db, organizationId, projectId, userId, input);
  });
}

export async function updateArticleForProject(
  userId: string,
  projectId: string,
  articleId: string,
  input: UpdateArticleInput,
): Promise<ArticleRecord> {
  return withTenantTransaction({ userId }, async (db) => {
    await requireProjectMember(db, projectId, userId, "editor");
    const { version, ...values } = input;
    if (values.folderId) {
      const exists = await folderExistsInTx(
        db,
        projectId,
        values.folderId,
        "article",
      );
      if (!exists) throw notFound();
    }

    const updated = await casUpdateArticle(
      db,
      projectId,
      articleId,
      userId,
      version,
      values,
    );
    if (updated) return updated;

    const existing = await getArticle(db, projectId, articleId);
    if (existing) {
      throw articleVersionConflict(existing);
    }
    throw notFound();
  });
}

export async function duplicateArticleForProject(
  userId: string,
  projectId: string,
  articleId: string,
): Promise<ArticleRecord> {
  return withTenantTransaction({ userId }, async (db) => {
    const { organizationId } = await requireProjectMember(
      db,
      projectId,
      userId,
      "editor",
    );
    const source = await getArticle(db, projectId, articleId);
    if (!source) throw notFound();

    return insertArticle(db, organizationId, projectId, userId, {
      folderId: source.folderId,
      seq: source.seq + 1,
      title: `${source.title} (副本)`,
      subtitle: source.subtitle,
      author: source.author,
      docType: source.docType,
      status: source.status,
      privacy: source.privacy,
      contentJson: source.contentJson,
      contentHtml: source.contentHtml,
      linkedPersonIds: source.linkedPersonIds,
      linkedChartIds: source.linkedChartIds,
      citations: source.citations,
      wordCount: source.wordCount,
    });
  });
}

export async function deleteArticleForProject(
  userId: string,
  projectId: string,
  articleId: string,
): Promise<void> {
  await withTenantTransaction({ userId }, async (db) => {
    await requireProjectMember(db, projectId, userId, "editor");
    const deleted = await deleteArticle(db, projectId, articleId);
    if (!deleted) throw notFound();
  });
}

export async function listArticleRevisionsForProject(
  userId: string,
  projectId: string,
  articleId: string,
): Promise<ArticleRevisionRecord[]> {
  return withTenantTransaction({ userId, readOnly: true }, async (db) => {
    await requireProjectMember(db, projectId, userId, null);
    const found = await getArticle(db, projectId, articleId);
    if (!found) throw notFound();
    return listArticleRevisions(db, projectId, articleId);
  });
}

export async function createArticleRevisionForProject(
  userId: string,
  projectId: string,
  articleId: string,
  input: CreateArticleRevisionInput,
): Promise<ArticleRevisionRecord> {
  return withTenantTransaction({ userId }, async (db) => {
    const { organizationId } = await requireProjectMember(
      db,
      projectId,
      userId,
      "editor",
    );
    const current = await getArticle(db, projectId, articleId);
    if (!current) throw notFound();

    return insertArticleRevision(
      db,
      organizationId,
      projectId,
      articleId,
      userId,
      {
        version: current.version,
        title: current.title,
        status: current.status,
        contentJson: current.contentJson,
        contentHtml: current.contentHtml,
        wordCount: current.wordCount,
        summary: input.summary?.trim() || "手动记入修订",
        authorName: input.authorName?.trim() || "家族编委会",
      },
    );
  });
}

export async function restoreArticleRevisionForProject(
  userId: string,
  projectId: string,
  articleId: string,
  revisionId: string,
  input: RestoreArticleRevisionInput,
): Promise<{ article: ArticleRecord; revision: ArticleRevisionRecord }> {
  return withTenantTransaction({ userId }, async (db) => {
    const { organizationId } = await requireProjectMember(
      db,
      projectId,
      userId,
      "editor",
    );
    const targetRev = await getArticleRevision(
      db,
      projectId,
      articleId,
      revisionId,
    );
    if (!targetRev) throw notFound();

    const restored = await casUpdateArticle(
      db,
      projectId,
      articleId,
      userId,
      input.version,
      {
        title: targetRev.title,
        status: targetRev.status,
        contentJson: targetRev.contentJson,
        contentHtml: targetRev.contentHtml,
        wordCount: targetRev.wordCount,
      },
    );
    if (!restored) {
      const existing = await getArticle(db, projectId, articleId);
      if (existing) throw articleVersionConflict(existing);
      throw notFound();
    }

    const revision = await insertArticleRevision(
      db,
      organizationId,
      projectId,
      articleId,
      userId,
      {
        version: restored.version,
        title: restored.title,
        status: restored.status,
        contentJson: restored.contentJson,
        contentHtml: restored.contentHtml,
        wordCount: restored.wordCount,
        summary: `回滚至版本 ${targetRev.version}`,
        authorName: input.authorName?.trim() || "家族编委会",
      },
    );

    return { article: restored, revision };
  });
}
