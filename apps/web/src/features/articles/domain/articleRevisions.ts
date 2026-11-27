import type { JSONContent } from '@tiptap/core';
import { createEntityId } from '../../../lib/id';
import type { ArticleDocument, ArticleRevision } from '../types';
import { extractArticleMetrics } from './articleMetrics';

export function articleRevisionFromDocument(
  doc: ArticleDocument,
  summary: string,
  authorName: string,
  createdAt: string,
): ArticleRevision {
  return {
    id: createEntityId(`rev-${doc.id}-${doc.version}`),
    articleId: doc.id,
    version: doc.version,
    title: doc.title,
    status: doc.status,
    contentJson: doc.contentJson ?? { type: 'doc', content: [] },
    contentHtml: doc.contentHtml,
    wordCount: doc.wordCount,
    summary,
    authorName,
    createdAt,
  };
}

export function appendArticleRevision(
  existing: ArticleRevision[],
  revision: ArticleRevision,
  limit = 30,
): ArticleRevision[] {
  const next = [...existing, revision];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

export function restoreArticleFromRevision(
  current: ArticleDocument,
  revision: ArticleRevision,
  updatedAt: string,
): ArticleDocument {
  const metrics = extractArticleMetrics(revision.contentJson as JSONContent);
  return {
    ...current,
    title: revision.title,
    status: revision.status,
    contentJson: revision.contentJson,
    contentHtml: revision.contentHtml,
    wordCount: revision.wordCount,
    linkedPersonIds: metrics.linkedPersonIds,
    linkedChartIds: metrics.linkedChartIds,
    version: current.version + 1,
    updatedAt,
  };
}