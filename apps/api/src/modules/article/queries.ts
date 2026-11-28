import { article, articleRevision } from "@yunpu/db";
import type {
  ArticleContentJson,
  ArticleDto,
  ArticleRevisionDto,
  ArticleStatus,
  CreateArticleInput,
  UpdateArticleInput,
} from "@yunpu/shared";
import { and, asc, eq, sql } from "drizzle-orm";
import type { TxDatabase } from "../../db/with-tenant-transaction";
import { isoTimestamp as timestamp } from "../../lib/sql";

export type ArticleRecord = ArticleDto;
export type ArticleRevisionRecord = ArticleRevisionDto;

const articleColumns = {
  id: article.id,
  projectId: article.projectId,
  folderId: article.folderId,
  seq: article.seq,
  title: article.title,
  subtitle: article.subtitle,
  author: article.author,
  docType: article.docType,
  status: article.status,
  privacy: article.privacy,
  contentJson: article.contentJson,
  contentHtml: article.contentHtml,
  linkedPersonIds: article.linkedPersonIds,
  linkedChartIds: article.linkedChartIds,
  citations: article.citations,
  wordCount: article.wordCount,
  version: article.version,
  updatedBy: article.updatedBy,
  createdAt: timestamp(article.createdAt),
  updatedAt: timestamp(article.updatedAt),
};

const revisionColumns = {
  id: articleRevision.id,
  projectId: articleRevision.projectId,
  articleId: articleRevision.articleId,
  version: articleRevision.version,
  title: articleRevision.title,
  status: articleRevision.status,
  contentJson: articleRevision.contentJson,
  contentHtml: articleRevision.contentHtml,
  wordCount: articleRevision.wordCount,
  summary: articleRevision.summary,
  authorName: articleRevision.authorName,
  createdBy: articleRevision.createdBy,
  createdAt: timestamp(articleRevision.createdAt),
};

const DEFAULT_CONTENT_JSON: ArticleContentJson = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export async function listArticles(
  db: TxDatabase,
  projectId: string,
): Promise<ArticleRecord[]> {
  return db
    .select(articleColumns)
    .from(article)
    .where(eq(article.projectId, projectId))
    .orderBy(asc(article.seq), asc(article.createdAt), asc(article.id));
}

export async function getArticle(
  db: TxDatabase,
  projectId: string,
  articleId: string,
): Promise<ArticleRecord | null> {
  const rows = await db
    .select(articleColumns)
    .from(article)
    .where(and(eq(article.projectId, projectId), eq(article.id, articleId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function insertArticle(
  db: TxDatabase,
  organizationId: string,
  projectId: string,
  userId: string,
  values: CreateArticleInput,
): Promise<ArticleRecord> {
  const rows = await db
    .insert(article)
    .values({
      organizationId,
      projectId,
      folderId: values.folderId ?? null,
      seq: values.seq ?? 0,
      title: values.title,
      subtitle: values.subtitle ?? "",
      author: values.author ?? "",
      docType: values.docType ?? "custom",
      status: values.status ?? "draft",
      privacy: values.privacy ?? "clan",
      contentJson: values.contentJson ?? DEFAULT_CONTENT_JSON,
      contentHtml: values.contentHtml ?? "<p></p>",
      linkedPersonIds: values.linkedPersonIds ?? [],
      linkedChartIds: values.linkedChartIds ?? [],
      citations: values.citations ?? [],
      wordCount: values.wordCount ?? 0,
      updatedBy: userId,
    })
    .returning(articleColumns);
  return rows[0];
}

export async function casUpdateArticle(
  db: TxDatabase,
  projectId: string,
  articleId: string,
  userId: string,
  expectedVersion: number,
  values: Omit<UpdateArticleInput, "version">,
): Promise<ArticleRecord | null> {
  const set: Record<string, unknown> = {
    version: sql`${article.version} + 1`,
    updatedBy: userId,
    updatedAt: sql`clock_timestamp()`,
  };
  if (values.folderId !== undefined) set.folderId = values.folderId;
  if (values.seq !== undefined) set.seq = values.seq;
  if (values.title !== undefined) set.title = values.title;
  if (values.subtitle !== undefined) set.subtitle = values.subtitle;
  if (values.author !== undefined) set.author = values.author;
  if (values.docType !== undefined) set.docType = values.docType;
  if (values.status !== undefined) set.status = values.status;
  if (values.privacy !== undefined) set.privacy = values.privacy;
  if (values.contentJson !== undefined) set.contentJson = values.contentJson;
  if (values.contentHtml !== undefined) set.contentHtml = values.contentHtml;
  if (values.linkedPersonIds !== undefined) {
    set.linkedPersonIds = values.linkedPersonIds;
  }
  if (values.linkedChartIds !== undefined) {
    set.linkedChartIds = values.linkedChartIds;
  }
  if (values.citations !== undefined) set.citations = values.citations;
  if (values.wordCount !== undefined) set.wordCount = values.wordCount;

  const rows = await db
    .update(article)
    .set(set)
    .where(
      and(
        eq(article.projectId, projectId),
        eq(article.id, articleId),
        eq(article.version, expectedVersion),
      ),
    )
    .returning(articleColumns);
  return rows[0] ?? null;
}

export async function deleteArticle(
  db: TxDatabase,
  projectId: string,
  articleId: string,
): Promise<boolean> {
  const rows = await db
    .delete(article)
    .where(and(eq(article.projectId, projectId), eq(article.id, articleId)))
    .returning({ id: article.id });
  return rows.length > 0;
}

export async function listArticleRevisions(
  db: TxDatabase,
  projectId: string,
  articleId: string,
): Promise<ArticleRevisionRecord[]> {
  return db
    .select(revisionColumns)
    .from(articleRevision)
    .where(
      and(
        eq(articleRevision.projectId, projectId),
        eq(articleRevision.articleId, articleId),
      ),
    )
    .orderBy(asc(articleRevision.createdAt), asc(articleRevision.id));
}

export async function getArticleRevision(
  db: TxDatabase,
  projectId: string,
  articleId: string,
  revisionId: string,
): Promise<ArticleRevisionRecord | null> {
  const rows = await db
    .select(revisionColumns)
    .from(articleRevision)
    .where(
      and(
        eq(articleRevision.projectId, projectId),
        eq(articleRevision.articleId, articleId),
        eq(articleRevision.id, revisionId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function insertArticleRevision(
  db: TxDatabase,
  organizationId: string,
  projectId: string,
  articleId: string,
  userId: string,
  values: {
    version: number;
    title: string;
    status: ArticleStatus;
    contentJson: ArticleContentJson;
    contentHtml: string;
    wordCount: number;
    summary: string;
    authorName: string;
  },
): Promise<ArticleRevisionRecord> {
  const rows = await db
    .insert(articleRevision)
    .values({
      organizationId,
      projectId,
      articleId,
      version: values.version,
      title: values.title,
      status: values.status,
      contentJson: values.contentJson,
      contentHtml: values.contentHtml,
      wordCount: values.wordCount,
      summary: values.summary,
      authorName: values.authorName,
      createdBy: userId,
    })
    .returning(revisionColumns);
  return rows[0];
}
