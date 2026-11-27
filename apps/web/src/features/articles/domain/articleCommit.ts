import type { JSONContent } from '@tiptap/core';
import type { ArticleDocument, ArticleMetaInput } from '../types';
import { computeWordCount } from '../articleData';
import { extractArticleMetrics } from './articleMetrics';
import { contentJsonToHtml } from './htmlProjection';
import { persistableContentJson } from './persistableContent';

export function commitArticleContent(
  existing: ArticleDocument | undefined,
  articleId: string,
  updates: Partial<ArticleMetaInput> & {
    contentJson?: JSONContent;
    contentHtml?: string;
  },
  updatedAt: string,
  options?: { bumpVersion?: boolean },
): ArticleDocument {
  const bumpVersion = options?.bumpVersion ?? true;
  const contentJson = updates.contentJson
    ? persistableContentJson(updates.contentJson)
    : existing?.contentJson;
  const metrics = contentJson ? extractArticleMetrics(contentJson) : null;
  const contentHtml = contentJson
    ? contentJsonToHtml(contentJson)
    : updates.contentHtml ?? existing?.contentHtml ?? '<p></p>';
  return {
    id: articleId,
    title: updates.title ?? existing?.title ?? '未命名谱文',
    subtitle: updates.subtitle ?? existing?.subtitle ?? '',
    author: updates.author ?? existing?.author ?? '',
    docType: updates.docType ?? existing?.docType ?? 'custom',
    status: updates.status ?? existing?.status ?? 'draft',
    privacy: updates.privacy ?? existing?.privacy ?? 'clan',
    contentJson,
    contentHtml,
    linkedPersonIds: metrics?.linkedPersonIds ?? existing?.linkedPersonIds ?? [],
    linkedChartIds: metrics?.linkedChartIds ?? existing?.linkedChartIds ?? [],
    citations: updates.citations ?? existing?.citations ?? [],
    version: existing
      ? bumpVersion
        ? existing.version + 1
        : existing.version
      : 1,
    wordCount: metrics?.wordCount ?? computeWordCount(contentHtml),
    updatedAt,
  };
}