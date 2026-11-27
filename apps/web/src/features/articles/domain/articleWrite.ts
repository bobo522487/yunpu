import type { JSONContent } from '@tiptap/core';
import type { ArticleWriteRequest } from '../api';
import { makeArticleStorageKey } from '../articleData';
import type { ArticleDocument, ArticleMetaInput } from '../types';
import { commitArticleContent } from './articleCommit';
import { resolveArticleConflict } from './articleConflict';

export type ArticleSaveResult =
  | { ok: true; article: ArticleDocument }
  | { ok: false; status: 409; server: ArticleDocument };

export type ArticleSavePort = (
  request: ArticleWriteRequest,
) => Promise<ArticleSaveResult>;

export type ArticleWriteMode = 'local' | 'network';

export type ArticleWriteHandlers = {
  onSuccess: (article: ArticleDocument) => void;
  onConflict: (server: ArticleDocument) => void;
  onSupersededSuccess?: (article: ArticleDocument) => void;
  onError?: (expectedVersion: number, error?: unknown) => void;
};

type ContentUpdates = Partial<ArticleMetaInput> & {
  contentJson?: JSONContent;
  contentHtml?: string;
};

export type CommitContentInput = {
  projectId: string;
  articleId: string;
  existing: ArticleDocument | undefined;
  updates: ContentUpdates;
  mode: ArticleWriteMode;
  updatedAt: string;
  readCurrent: () => ArticleDocument | undefined;
  handlers: ArticleWriteHandlers;
};

export type ResolveConflictInput = {
  projectId: string;
  articleId: string;
  choice: 'keep-local' | 'take-server';
  local: ArticleDocument;
  server: ArticleDocument;
  mode: ArticleWriteMode;
  updatedAt: string;
  readCurrent: () => ArticleDocument | undefined;
  handlers: ArticleWriteHandlers;
};

function readRequest(
  articleId: string,
  fallback: ArticleDocument,
  readCurrent: () => ArticleDocument | undefined,
): ArticleWriteRequest {
  const current = readCurrent() ?? fallback;
  const acceptedVersion = current.version;
  return {
    articleId,
    expectedVersion: acceptedVersion,
    article: { ...current, version: acceptedVersion },
  };
}

export function createArticleWrite(save: ArticleSavePort) {
  const attemptIdByKey = new Map<string, number>();
  const chainByKey = new Map<string, Promise<void>>();
  const latestByKey = new Map<
    string,
    {
      attemptId: number;
      readRequest: () => ArticleWriteRequest;
      handlers: ArticleWriteHandlers;
    }
  >();

  function bump(key: string): number {
    const next = (attemptIdByKey.get(key) ?? 0) + 1;
    attemptIdByKey.set(key, next);
    return next;
  }

  function enqueue(
    key: string,
    attemptId: number,
    handlers: ArticleWriteHandlers,
    resolveRequest: () => ArticleWriteRequest,
  ) {
    attemptIdByKey.set(key, attemptId);
    latestByKey.set(key, { attemptId, readRequest: resolveRequest, handlers });
    const previous = chainByKey.get(key) ?? Promise.resolve();
    const next = previous
      .then(async () => {
        if (attemptIdByKey.get(key) !== attemptId) return;
        const latest = latestByKey.get(key);
        if (!latest || latest.attemptId !== attemptId) return;
        const outbound = latest.readRequest();
        const expectedVersion = outbound.expectedVersion;
        let result: ArticleSaveResult;
        try {
          result = await save(outbound);
        } catch (error) {
          if (attemptIdByKey.get(key) === attemptId) {
            latest.handlers.onError?.(expectedVersion, error);
          }
          return;
        }
        const stillCurrent = attemptIdByKey.get(key) === attemptId;
        if (!stillCurrent) {
          if (result.ok) {
            const newest = latestByKey.get(key);
            newest?.handlers.onSupersededSuccess?.(result.article);
          }
          return;
        }
        if (result.ok) {
          latest.handlers.onSuccess(result.article);
          return;
        }
        latest.handlers.onConflict(result.server);
      })
      .catch(() => undefined);
    chainByKey.set(key, next);
  }

  return {
    commitContent(input: CommitContentInput): ArticleDocument {
      const doc = commitArticleContent(
        input.existing,
        input.articleId,
        input.updates,
        input.updatedAt,
        { bumpVersion: input.mode !== 'network' },
      );
      if (input.mode !== 'network') return doc;
      const key = makeArticleStorageKey(input.projectId, input.articleId);
      const attemptId = bump(key);
      const resolveRequest = () =>
        readRequest(input.articleId, doc, input.readCurrent);
      enqueue(key, attemptId, input.handlers, resolveRequest);
      return doc;
    },

    resolveConflict(input: ResolveConflictInput): ArticleDocument {
      const key = makeArticleStorageKey(input.projectId, input.articleId);
      if (input.choice === 'take-server') {
        bump(key);
        return input.server;
      }
      const resolved = resolveArticleConflict('keep-local', input.local, input.server);
      if (input.mode !== 'network') return resolved;
      const attemptId = bump(key);
      const resolveRequest = () =>
        readRequest(input.articleId, resolved, input.readCurrent);
      enqueue(key, attemptId, input.handlers, resolveRequest);
      return resolved;
    },

    invalidate(projectId: string, articleId: string) {
      bump(makeArticleStorageKey(projectId, articleId));
    },
  };
}
