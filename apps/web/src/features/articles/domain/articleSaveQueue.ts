import type { JSONContent } from '@tiptap/core';
import { extractArticleMetrics } from './articleMetrics';
import { persistableContentJson } from './persistableContent';

export interface ArticleSaveCommit {
  projectId?: string;
  articleId: string;
  contentJson: JSONContent;
  contentHtml: string;
  wordCount: number;
  paragraphCount: number;
  linkedPersonIds: string[];
  linkedChartIds: string[];
}

export function createArticleSaveQueue(options: {
  delayMs: number;
  schedule: (fn: () => void, ms: number) => number;
  cancel: (handle: number) => void;
  projectHtml: (json: JSONContent) => string;
  onCommit: (commit: ArticleSaveCommit) => void;
}) {
  let timer: number | null = null;
  let pending: {
    projectId?: string;
    articleId: string;
    readJson: () => JSONContent;
  } | null = null;

  const clearTimer = () => {
    if (timer !== null) {
      options.cancel(timer);
      timer = null;
    }
  };

  const emit = (): ArticleSaveCommit | null => {
    if (!pending) return null;
    const current = pending;
    pending = null;
    const contentJson = persistableContentJson(current.readJson());
    const metrics = extractArticleMetrics(contentJson);
    const commit: ArticleSaveCommit = {
      ...(current.projectId !== undefined ? { projectId: current.projectId } : {}),
      articleId: current.articleId,
      contentJson,
      contentHtml: options.projectHtml(contentJson),
      wordCount: metrics.wordCount,
      paragraphCount: metrics.paragraphCount,
      linkedPersonIds: metrics.linkedPersonIds,
      linkedChartIds: metrics.linkedChartIds,
    };
    options.onCommit(commit);
    return commit;
  };

  return {
    noteEdit(
      articleId: string,
      readJson: () => JSONContent,
      projectId?: string,
    ) {
      pending = { projectId, articleId, readJson };
      clearTimer();
      timer = options.schedule(() => {
        timer = null;
        emit();
      }, options.delayMs);
    },
    flush() {
      clearTimer();
      return emit();
    },
    dispose() {
      clearTimer();
      pending = null;
    },
    hasPending() {
      return pending !== null;
    },
  };
}