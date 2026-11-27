import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { formatNowTimestamp, makeArticleStorageKey } from '../features/articles/articleData';
import {
  appendArticleRevision,
  articleRevisionFromDocument,
} from '../features/articles/domain/articleRevisions';
import type { ArticleDocument, ArticleRevision } from '../features/articles/types';
import { createAsyncEntityStorage } from './storageAdapter';

interface ArticleRevisionState {
  revisionsByKey: Record<string, ArticleRevision[]>;
  getRevisions: (projectId: string, articleId: string) => ArticleRevision[];
  recordRevisionForDoc: (
    projectId: string,
    doc: ArticleDocument,
    summary: string,
    authorName: string,
    createdAt?: string,
  ) => ArticleRevision | null;
  removeArticleRevisions: (projectId: string, articleIds: string[]) => void;
  importLegacyRevisions: (
    legacyByArticleId: Record<string, ArticleRevision[]>,
    existingArticleKeys?: string[],
  ) => void;
}

export const useArticleRevisionStore = create<ArticleRevisionState>()(
  persist(
    (set, get) => ({
      revisionsByKey: {},

      getRevisions: (projectId, articleId) => {
        const scopedKey = makeArticleStorageKey(projectId, articleId);
        const map = get().revisionsByKey;
        return map[scopedKey] ?? map[articleId] ?? [];
      },

      recordRevisionForDoc: (projectId, doc, summary, authorName, createdAt) => {
        if (!doc?.contentJson) return null;
        const key = makeArticleStorageKey(projectId, doc.id);
        const revision = articleRevisionFromDocument(
          doc,
          summary,
          authorName,
          createdAt ?? formatNowTimestamp(),
        );
        set((state) => {
          const existing = state.revisionsByKey[key] ?? [];
          return {
            revisionsByKey: {
              ...state.revisionsByKey,
              [key]: appendArticleRevision(existing, revision),
            },
          };
        });
        return revision;
      },

      removeArticleRevisions: (projectId, articleIds) =>
        set((state) => {
          if (articleIds.length === 0) return state;
          const next = { ...state.revisionsByKey };
          let changed = false;
          for (const articleId of articleIds) {
            const key = makeArticleStorageKey(projectId, articleId);
            if (key in next) {
              delete next[key];
              changed = true;
            }
          }
          return changed ? { revisionsByKey: next } : state;
        }),

      importLegacyRevisions: (legacyByArticleId, existingArticleKeys = []) => {
        const entries = Object.entries(legacyByArticleId);
        if (entries.length === 0) return;

        // Map bare articleId -> matching projectId::articleId keys to scope legacy revisions when unambiguous
        const projectsByArticleId = new Map<string, string[]>();
        for (const key of existingArticleKeys) {
          const sep = key.indexOf('::');
          if (sep <= 0) continue;
          const articleId = key.slice(sep + 2);
          const list = projectsByArticleId.get(articleId) ?? [];
          list.push(key);
          projectsByArticleId.set(articleId, list);
        }

        set((state) => {
          const next = { ...state.revisionsByKey };
          for (const [articleId, revs] of entries) {
            if (!Array.isArray(revs) || revs.length === 0) continue;
            const matches = projectsByArticleId.get(articleId);
            const targetKey = matches?.length === 1 ? matches[0] : articleId;
            if (!next[targetKey]) {
              next[targetKey] = revs;
            }
          }
          return { revisionsByKey: next };
        });
      },
    }),
    {
      name: 'yunpu:article-revisions',
      version: 1,
      storage: createAsyncEntityStorage(),
      partialize: (state) => ({
        revisionsByKey: state.revisionsByKey,
      }),
    },
  ),
);
