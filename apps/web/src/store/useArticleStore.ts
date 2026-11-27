import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TreeItem } from '../components/common/Tree/types';
import {
  collectSubtreeIdsByType,
  duplicateTreeNode,
  findTreeNode,
  insertTreeNode,
  preserveCollapsedChildren,
  removeTreeNode,
  updateTreeNodeData,
} from '../lib/treeOps';
import { createAsyncEntityStorage } from './storageAdapter';
import { shouldInitializeProjectSeed } from './hydrationGate';
import {
  createInitialArticleSeed,
  findFirstArticleId,
  formatNowTimestamp,
  makeArticleStorageKey,
} from '../features/articles/articleData';
import { errorMessage } from '../lib/api';
import { createEntityId } from '../lib/id';
import { saveArticleRemote } from '../features/articles/api';
import { commitArticleContent } from '../features/articles/domain/articleCommit';
import { createArticleWrite } from '../features/articles/domain/articleWrite';
import { resolveApiMode } from '../lib/apiMode';
import {
  contentJsonToHtml,
  htmlToContentJson,
} from '../features/articles/domain/htmlProjection';
import {
  migrateArticlesV1ToV2,
  migrateArticlesV2ToV3,
} from '../features/articles/domain/migrateArticles';
import { useArticleRevisionStore } from './useArticleRevisionStore';
import type { JSONContent } from '@tiptap/core';
import type {
  ArticleDocument,
  ArticleMetaInput,
  ProjectArticleSeedContext,
} from '../features/articles/types';

export interface ArticleConflictState {
  projectId: string;
  articleId: string;
  local: ArticleDocument;
  server: ArticleDocument;
}

interface ArticleState {
  _hasHydrated: boolean;
  _setHasHydrated: (hydrated: boolean) => void;
  treesByProject: Record<string, TreeItem[]>;
  selectedNodeIdByProject: Record<string, string>;
  articlesByKey: Record<string, ArticleDocument>;
  articleConflict: ArticleConflictState | null;
  saveError: string | null;
  clearSaveError: () => void;

  ensureProjectInitialized: (
    projectId: string,
    ctx: ProjectArticleSeedContext
  ) => void;
  setTree: (projectId: string, items: TreeItem[]) => void;
  selectNode: (projectId: string, nodeId: string) => void;
  addFolder: (projectId: string, name?: string) => string;
  addArticle: (
    projectId: string,
    parentId?: string,
    meta?: ArticleMetaInput
  ) => string;
  updateArticleContent: (
    projectId: string,
    articleId: string,
    updates: Partial<ArticleMetaInput> & {
      contentJson?: JSONContent;
      contentHtml?: string;
    }
  ) => void;
  updateArticleMeta: (
    projectId: string,
    articleId: string,
    meta: ArticleMetaInput
  ) => void;
  renameNode: (projectId: string, id: string, name: string) => void;
  duplicateNode: (projectId: string, id: string) => void;
  removeNode: (projectId: string, id: string) => void;
  recordRevision: (
    projectId: string,
    articleId: string,
    summary: string,
    authorName: string,
  ) => void;
  restoreRevision: (
    projectId: string,
    articleId: string,
    revisionId: string,
    authorName: string,
  ) => void;
  chooseArticleConflictResolution: (
    choice: 'keep-local' | 'take-server',
  ) => void;
}

const articleWrite = createArticleWrite((request) =>
  saveArticleRemote(`/api/v1/articles/${request.articleId}`, request),
);

function articleWriteMode(): 'local' | 'network' {
  return resolveApiMode(import.meta.env) === 'network' ? 'network' : 'local';
}

function applyArticleRowToState(
  state: ArticleState,
  projectId: string,
  articleId: string,
  doc: ArticleDocument,
  titleUpdateFrom?: string,
): Partial<ArticleState> {
  const key = makeArticleStorageKey(projectId, articleId);
  const currentTree = state.treesByProject[projectId] || [];
  const treeNode = findTreeNode(currentTree, articleId);
  const nextTitle = titleUpdateFrom?.trim();
  const shouldUpdateTreeTitle =
    Boolean(nextTitle) && treeNode && treeNode.data?.name !== nextTitle;

  return {
    treesByProject: {
      ...state.treesByProject,
      [projectId]: shouldUpdateTreeTitle
        ? updateTreeNodeData(currentTree, articleId, (data) => ({
            ...data,
            name: nextTitle!,
          }))
        : currentTree,
    },
    articlesByKey: { ...state.articlesByKey, [key]: doc },
  };
}

function commitArticlePatch(
  get: () => ArticleState,
  set: (
    partial:
      | Partial<ArticleState>
      | ((state: ArticleState) => Partial<ArticleState>),
  ) => void,
  projectId: string,
  articleId: string,
  updates: Partial<ArticleMetaInput> & {
    contentJson?: JSONContent;
    contentHtml?: string;
  },
  titleForTree?: string,
): ArticleDocument {
  const state = get();
  const key = makeArticleStorageKey(projectId, articleId);
  const existing = state.articlesByKey[key];
  const currentTree = state.treesByProject[projectId] || [];
  const treeNode = findTreeNode(currentTree, articleId);

  const mergedUpdates = {
    ...updates,
    title:
      updates.title !== undefined
        ? updates.title
        : existing?.title || treeNode?.data?.name || '未命名谱文',
  };

  const nextDoc = articleWrite.commitContent({
    projectId,
    articleId,
    existing,
    updates: mergedUpdates,
    mode: articleWriteMode(),
    updatedAt: formatNowTimestamp(),
    readCurrent: () => get().articlesByKey[key],
    handlers: {
      onSuccess: (article) => {
        set((s) => ({
          ...applyArticleRowToState(
            s,
            projectId,
            articleId,
            article,
            titleForTree ?? article.title,
          ),
          articleConflict: null,
          saveError: null,
        }));
      },
      onSupersededSuccess: (article) => {
        set((s) => {
          const current = s.articlesByKey[key];
          if (!current || article.version <= current.version) return s;
          return applyArticleRowToState(s, projectId, articleId, {
            ...current,
            version: article.version,
          });
        });
      },
      onConflict: (server) => {
        const local = get().articlesByKey[key] ?? nextDoc;
        set({
          articleConflict: {
            projectId,
            articleId,
            local,
            server,
          },
          saveError: null,
        });
      },
      onError: (_expectedVersion, error) => {
        set({ saveError: errorMessage(error) });
      },
    },
  });

  set((s) => ({
    ...applyArticleRowToState(s, projectId, articleId, nextDoc, titleForTree),
  }));

  return nextDoc;
}

export const useArticleStore = create<ArticleState>()(
  persist(
    (set, get) => ({
      _hasHydrated: false,
      _setHasHydrated: (hydrated) => set({ _hasHydrated: hydrated }),
      treesByProject: {},
      selectedNodeIdByProject: {},
      articlesByKey: {},
      articleConflict: null,
      saveError: null,
      clearSaveError: () => set({ saveError: null }),

      ensureProjectInitialized: (projectId, ctx) => {
        const current = get();
        if (
          !shouldInitializeProjectSeed({
            hasHydrated: current._hasHydrated,
            projectId,
            existingEntry: current.treesByProject[projectId],
          })
        ) {
          return;
        }
        const seed = createInitialArticleSeed(projectId, ctx);
        set((state) => {
          if (state.treesByProject[projectId] !== undefined) return state;
          return {
            treesByProject: { ...state.treesByProject, [projectId]: seed.tree },
            selectedNodeIdByProject: {
              ...state.selectedNodeIdByProject,
              [projectId]:
                state.selectedNodeIdByProject[projectId] || seed.defaultSelectedId,
            },
            articlesByKey: { ...state.articlesByKey, ...seed.articles },
          };
        });
      },

      setTree: (projectId, nextItems) =>
        set((state) => ({
          treesByProject: {
            ...state.treesByProject,
            [projectId]: preserveCollapsedChildren(
              state.treesByProject[projectId] || [],
              nextItems
            ),
          },
        })),

      selectNode: (projectId, nodeId) =>
        set((state) => ({
          selectedNodeIdByProject: {
            ...state.selectedNodeIdByProject,
            [projectId]: nodeId,
          },
        })),

      addFolder: (projectId, name) => {
        const id = createEntityId('article-vol');
        const current = get().treesByProject[projectId] || [];
        const newFolder: TreeItem = {
          id,
          type: 'folder',
          collapsed: false,
          data: { name: name?.trim() || '新建谱文卷目' },
          children: [],
        };
        set((state) => ({
          treesByProject: {
            ...state.treesByProject,
            [projectId]: [...current, newFolder],
          },
          selectedNodeIdByProject: {
            ...state.selectedNodeIdByProject,
            [projectId]: id,
          },
        }));
        return id;
      },

      addArticle: (projectId, parentId, meta) => {
        const id = createEntityId('article');
        const title = meta?.title?.trim() || '未命名谱文';
        const doc = commitArticleContent(
          undefined,
          id,
          {
            title,
            subtitle: meta?.subtitle,
            author: meta?.author,
            docType: meta?.docType,
            status: meta?.status,
            privacy: meta?.privacy,
            citations: meta?.citations,
            contentHtml: meta?.contentHtml,
            contentJson:
              meta?.contentJson ??
              (meta?.contentHtml
                ? htmlToContentJson(meta.contentHtml)
                : htmlToContentJson(
                    `<p>请在此处开始撰写「${title}」正文内容……</p>`
                  )),
          },
          formatNowTimestamp()
        );

        const newNode: TreeItem = {
          id,
          type: 'article',
          data: { name: title },
          children: [],
        };

        const current = get().treesByProject[projectId] || [];
        const key = makeArticleStorageKey(projectId, id);
        set((state) => ({
          treesByProject: {
            ...state.treesByProject,
            [projectId]: insertTreeNode(current, newNode, parentId),
          },
          selectedNodeIdByProject: {
            ...state.selectedNodeIdByProject,
            [projectId]: id,
          },
          articlesByKey: { ...state.articlesByKey, [key]: doc },
        }));
        return id;
      },

      updateArticleContent: (projectId, articleId, updates) => {
        commitArticlePatch(
          get,
          set,
          projectId,
          articleId,
          updates,
          updates.title,
        );
      },

      chooseArticleConflictResolution: (choice) => {
        const conflict = get().articleConflict;
        if (!conflict) return;

        const key = makeArticleStorageKey(conflict.projectId, conflict.articleId);
        const nextDoc = articleWrite.resolveConflict({
          projectId: conflict.projectId,
          articleId: conflict.articleId,
          choice,
          local: conflict.local,
          server: conflict.server,
          mode: articleWriteMode(),
          updatedAt: formatNowTimestamp(),
          readCurrent: () => get().articlesByKey[key],
          handlers: {
            onSuccess: (article) => {
              set((s) => ({
                ...applyArticleRowToState(
                  s,
                  conflict.projectId,
                  conflict.articleId,
                  article,
                  nextDoc.title,
                ),
                articleConflict: null,
                saveError: null,
              }));
            },
            onConflict: (server) => {
              const local = get().articlesByKey[key] ?? nextDoc;
              set({
                articleConflict: {
                  projectId: conflict.projectId,
                  articleId: conflict.articleId,
                  local,
                  server,
                },
                saveError: null,
              });
            },
            onError: (_expectedVersion, error) => {
              set({ saveError: errorMessage(error) });
            },
          },
        });

        set((state) => ({
          ...applyArticleRowToState(
            state,
            conflict.projectId,
            conflict.articleId,
            nextDoc,
            nextDoc.title,
          ),
          articleConflict: null,
        }));
      },

      updateArticleMeta: (projectId, articleId, meta) => {
        const title = meta.title?.trim() || '未命名谱文';
        const existing = get().articlesByKey[makeArticleStorageKey(projectId, articleId)];
        commitArticlePatch(
          get,
          set,
          projectId,
          articleId,
          {
            title,
            subtitle: meta.subtitle,
            author: meta.author,
            status: meta.status,
            privacy: meta.privacy,
            citations: meta.citations,
            docType: meta.docType,
            contentHtml: existing ? undefined : '<p></p>',
          },
          title,
        );
      },

      renameNode: (projectId, id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const currentTree = get().treesByProject[projectId] || [];
        const node = findTreeNode(currentTree, id);
        if (node?.type === 'article') {
          commitArticlePatch(get, set, projectId, id, { title: trimmed }, trimmed);
          return;
        }
        set((state) => ({
          treesByProject: {
            ...state.treesByProject,
            [projectId]: updateTreeNodeData(
              state.treesByProject[projectId] || [],
              id,
              (data) => ({ ...data, name: trimmed }),
            ),
          },
        }));
      },

      duplicateNode: (projectId, id) =>
        set((state) => {
          const currentTree = state.treesByProject[projectId] || [];
          const nextArticles = { ...state.articlesByKey };
          const nextTree = duplicateTreeNode(currentTree, id, (srcId, dstId, node) => {
            if (node.type !== 'article') return;
            const srcDoc =
              state.articlesByKey[makeArticleStorageKey(projectId, srcId)];
            if (!srcDoc) return;
            nextArticles[makeArticleStorageKey(projectId, dstId)] = {
              ...srcDoc,
              id: dstId,
              title:
                srcId === id
                  ? `${node.data?.name || srcId} (副本)`
                  : node.data?.name || srcId,
              updatedAt: formatNowTimestamp(),
              version: (srcDoc.version ?? 0) + 1,
            };
          });
          return {
            treesByProject: { ...state.treesByProject, [projectId]: nextTree },
            articlesByKey: nextArticles,
          };
        }),

      removeNode: (projectId, id) => {
        const currentTree = get().treesByProject[projectId] || [];
        const targetNode = findTreeNode(currentTree, id);
        const removedIds = targetNode
          ? collectSubtreeIdsByType(targetNode, 'article')
          : [id];

        set((state) => {
          const tree = state.treesByProject[projectId] || [];
          const nextTree = removeTreeNode(tree, id);
          const nextArticles = { ...state.articlesByKey };
          for (const aid of removedIds) {
            delete nextArticles[makeArticleStorageKey(projectId, aid)];
          }

          const currentSelected = state.selectedNodeIdByProject[projectId];
          const wasSelectedRemoved =
            currentSelected === id ||
            (currentSelected ? removedIds.includes(currentSelected) : false);

          return {
            treesByProject: { ...state.treesByProject, [projectId]: nextTree },
            selectedNodeIdByProject: {
              ...state.selectedNodeIdByProject,
              [projectId]: wasSelectedRemoved
                ? findFirstArticleId(nextTree) || String(nextTree[0]?.id || '')
                : currentSelected,
            },
            articlesByKey: nextArticles,
          };
        });

        useArticleRevisionStore
          .getState()
          .removeArticleRevisions(projectId, removedIds);
      },

      recordRevision: (projectId, articleId, summary, authorName) => {
        const doc = get().articlesByKey[makeArticleStorageKey(projectId, articleId)];
        if (!doc?.contentJson) return;
        useArticleRevisionStore
          .getState()
          .recordRevisionForDoc(projectId, doc, summary, authorName);
      },

      restoreRevision: (projectId, articleId, revisionId, authorName) => {
        const key = makeArticleStorageKey(projectId, articleId);
        const current = get().articlesByKey[key];
        if (!current) return;
        const revisions = useArticleRevisionStore
          .getState()
          .getRevisions(projectId, articleId);
        const revision = revisions.find((r) => r.id === revisionId);
        if (!revision) return;

        articleWrite.invalidate(projectId, articleId);
        const restored = commitArticlePatch(
          get,
          set,
          projectId,
          articleId,
          {
            title: revision.title,
            status: revision.status,
            contentJson: revision.contentJson,
          },
          revision.title,
        );

        useArticleRevisionStore
          .getState()
          .recordRevisionForDoc(
            projectId,
            restored,
            `回滚至版本 ${revision.version}`,
            authorName,
            restored.updatedAt,
          );
      },
    }),
    {
      name: 'yunpu:articles',
      version: 4,
      storage: createAsyncEntityStorage(),
      partialize: (state) => {
        // Persist contentJson as single source of truth; omit redundant contentHtml when JSON exists
        const slimArticles: Record<string, ArticleDocument> = {};
        for (const [key, doc] of Object.entries(state.articlesByKey)) {
          if (doc.contentJson) {
            const { contentHtml: _omit, ...rest } = doc;
            slimArticles[key] = rest as ArticleDocument;
          } else {
            slimArticles[key] = doc;
          }
        }
        return {
          treesByProject: state.treesByProject,
          selectedNodeIdByProject: state.selectedNodeIdByProject,
          articlesByKey: slimArticles,
        };
      },
      migrate: (persisted, version) => {
        let state =
          version < 2
            ? migrateArticlesV1ToV2(persisted)
            : (persisted as ReturnType<typeof migrateArticlesV1ToV2>);
        if (version < 3) {
          state = migrateArticlesV2ToV3(state);
        }
        if (version < 4) {
          const v3 = state as ReturnType<typeof migrateArticlesV2ToV3>;
          const legacyRevisions = v3.revisionsByArticleId;
          if (legacyRevisions && Object.keys(legacyRevisions).length > 0) {
            useArticleRevisionStore
              .getState()
              .importLegacyRevisions(
                legacyRevisions,
                Object.keys(v3.articlesByKey ?? {}),
              );
          }
          const { revisionsByArticleId: _drop, ...rest } = v3;
          return rest;
        }
        return state;
      },
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<ArticleState>;
        const hydratedArticles: Record<string, ArticleDocument> = {};
        for (const [key, doc] of Object.entries(persisted.articlesByKey ?? {})) {
          hydratedArticles[key] =
            doc.contentJson && !doc.contentHtml
              ? { ...doc, contentHtml: contentJsonToHtml(doc.contentJson) }
              : doc;
        }
        return {
          ...currentState,
          ...persisted,
          articlesByKey: hydratedArticles,
        };
      },
      onRehydrateStorage: () => (state) => {
        state?._setHasHydrated(true);
      },
    }
  )
);
