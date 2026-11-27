import { useCallback, useMemo } from 'react';
import {
  type QueryClient,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { JSONContent } from '@tiptap/core';
import type { CreateArticleInput, UpdateArticleInput } from '@yunpu/shared';
import { errorMessage } from '../../lib/api';
import { useArticleStore } from '../../store/useArticleStore';
import {
  createFolderRequest,
  deleteFolderRequest,
  type FolderDto,
  updateFolderRequest,
} from '../lineage/api';
import { articleDirectoryToTreeItems, buildArticlesByKey } from './adapter';
import {
  type ArticlesDirectoryPayload,
  createArticleRequest,
  createArticleRevisionRequest,
  deleteArticleRequest,
  duplicateArticleRequest,
  fetchArticleRevisions,
  fetchArticlesDirectory,
  restoreArticleRevisionRequest,
  saveArticleRemote,
  updateArticleRequest,
} from './api';
import { formatNowTimestamp, makeArticleStorageKey } from './articleData';
import { createArticleWrite } from './domain/articleWrite';
import { htmlToContentJson } from './domain/htmlProjection';
import type {
  ArticleDocument,
  ArticleMetaInput,
  ArticleRevision,
} from './types';

export const articlesKeys = {
  all: ['articles'] as const,
  directory: (projectId: string) =>
    ['articles', 'directory', projectId] as const,
  revisions: (projectId: string, articleId: string) =>
    ['articles', 'revisions', projectId, articleId] as const,
};

const EMPTY_COLLAPSED: Record<string, boolean> = {};

const articleWrite = createArticleWrite((request) => {
  if (!request.projectId) {
    return Promise.reject(new Error('缺少 projectId'));
  }
  return saveArticleRemote(
    `/api/v1/projects/${request.projectId}/articles/${request.articleId}`,
    request,
  );
});

export function useArticlesDirectoryQuery(projectId: string) {
  return useQuery<ArticlesDirectoryPayload>({
    queryKey: articlesKeys.directory(projectId),
    queryFn: () => fetchArticlesDirectory(projectId),
    enabled: Boolean(projectId),
  });
}

export function useArticleRevisionsQuery(
  projectId: string,
  articleId: string,
  enabled = true,
) {
  return useQuery<ArticleRevision[]>({
    queryKey: articlesKeys.revisions(projectId, articleId),
    queryFn: async () => {
      const data = await fetchArticleRevisions(projectId, articleId);
      return data.revisions;
    },
    enabled: Boolean(projectId && articleId && enabled),
  });
}

export async function invalidateArticlesDirectory(
  queryClient: QueryClient,
  projectId: string,
) {
  await queryClient.invalidateQueries({
    queryKey: articlesKeys.directory(projectId),
  });
}

export async function invalidateArticleRevisions(
  queryClient: QueryClient,
  projectId: string,
  articleId: string,
) {
  await queryClient.invalidateQueries({
    queryKey: articlesKeys.revisions(projectId, articleId),
  });
}

export function useProjectArticlesSnapshot(projectId: string) {
  const collapsedByProject = useArticleStore(
    (s) => s.collapsedFoldersByProject[projectId] ?? EMPTY_COLLAPSED,
  );
  const directoryQuery = useArticlesDirectoryQuery(projectId);

  const folders = useMemo(
    () => directoryQuery.data?.folders ?? [],
    [directoryQuery.data],
  );
  const articles = useMemo(
    () => directoryQuery.data?.articles ?? [],
    [directoryQuery.data],
  );
  const articleTree = useMemo(
    () => articleDirectoryToTreeItems(folders, articles, collapsedByProject),
    [folders, articles, collapsedByProject],
  );
  const articlesByKey = useMemo(
    () => buildArticlesByKey(projectId, articles),
    [projectId, articles],
  );
  const articlesById = useMemo(
    () => new Map<string, ArticleDocument>(articles.map((a) => [a.id, a])),
    [articles],
  );
  const foldersById = useMemo(
    () => new Map<string, FolderDto>(folders.map((f) => [f.id, f])),
    [folders],
  );

  return {
    directory: directoryQuery.data,
    folders,
    articles,
    articleTree,
    articlesByKey,
    articlesById,
    foldersById,
    isLoading: directoryQuery.isPending,
    isError: directoryQuery.isError,
    error: directoryQuery.error,
    refetch: directoryQuery.refetch,
  };
}

function patchArticleInCache(
  queryClient: QueryClient,
  projectId: string,
  nextDoc: ArticleDocument,
  onlyBumpVersionIfNewer = false,
) {
  queryClient.setQueryData<ArticlesDirectoryPayload>(
    articlesKeys.directory(projectId),
    (prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        articles: prev.articles.map((item) => {
          if (item.id !== nextDoc.id) return item;
          if (onlyBumpVersionIfNewer) {
            return nextDoc.version > item.version
              ? { ...item, version: nextDoc.version }
              : item;
          }
          return nextDoc;
        }),
      };
    },
  );
}

function readArticleFromCache(
  queryClient: QueryClient,
  projectId: string,
  articleId: string,
): ArticleDocument | undefined {
  const cached = queryClient.getQueryData<ArticlesDirectoryPayload>(
    articlesKeys.directory(projectId),
  );
  return cached?.articles.find((a) => a.id === articleId);
}

function nextDefaultArticleFolderName(existing: FolderDto[]): string {
  const taken = new Set(existing.map((f) => f.name));
  const base = '新建谱文卷目';
  if (!taken.has(base)) return base;
  let seq = 2;
  while (taken.has(`${base} ${seq}`)) {
    seq += 1;
  }
  return `${base} ${seq}`;
}

export function useArticleActions(projectId: string) {
  const queryClient = useQueryClient();
  const selectNode = useArticleStore((s) => s.selectNode);
  const setArticleConflict = useArticleStore((s) => s.setArticleConflict);
  const setSaveError = useArticleStore((s) => s.setSaveError);

  const addFolder = useCallback(
    async (name?: string) => {
      if (!projectId) return null;
      const current =
        queryClient.getQueryData<ArticlesDirectoryPayload>(
          articlesKeys.directory(projectId),
        )?.folders ?? [];
      const folderName = name?.trim() || nextDefaultArticleFolderName(current);
      const { folder } = await createFolderRequest(projectId, {
        name: folderName,
        kind: 'article',
        seq: current.length,
      });
      await invalidateArticlesDirectory(queryClient, projectId);
      selectNode(projectId, folder.id);
      return folder.id;
    },
    [projectId, queryClient, selectNode],
  );

  const addArticle = useCallback(
    async (parentId?: string, meta?: ArticleMetaInput) => {
      if (!projectId) return null;
      const title = meta?.title?.trim() || '未命名谱文';
      const contentHtml =
        meta?.contentHtml ?? `<p>请在此处开始撰写「${title}」正文内容……</p>`;
      const contentJson = meta?.contentJson ?? htmlToContentJson(contentHtml);
      const current =
        queryClient.getQueryData<ArticlesDirectoryPayload>(
          articlesKeys.directory(projectId),
        )?.articles ?? [];

      const payload: CreateArticleInput = {
        folderId: parentId ?? null,
        seq: current.length,
        title,
        subtitle: meta?.subtitle ?? '',
        author: meta?.author ?? '',
        docType: meta?.docType ?? 'custom',
        status: meta?.status ?? 'draft',
        privacy: meta?.privacy ?? 'clan',
        contentJson: contentJson as CreateArticleInput['contentJson'],
        contentHtml,
        citations: meta?.citations ?? [],
      };
      const { article } = await createArticleRequest(projectId, payload);
      await invalidateArticlesDirectory(queryClient, projectId);
      selectNode(projectId, article.id);
      return article.id;
    },
    [projectId, queryClient, selectNode],
  );

  const updateArticleContent = useCallback(
    (
      articleId: string,
      updates: Partial<ArticleMetaInput> & {
        contentJson?: JSONContent;
        contentHtml?: string;
      },
    ) => {
      if (!projectId) return;
      const existing = readArticleFromCache(queryClient, projectId, articleId);
      if (!existing) return;

      const mergedUpdates = {
        ...updates,
        title:
          updates.title !== undefined
            ? updates.title
            : existing.title || '未命名谱文',
      };

      const nextDoc = articleWrite.commitContent({
        projectId,
        articleId,
        existing,
        updates: mergedUpdates,
        mode: 'network',
        updatedAt: formatNowTimestamp(),
        readCurrent: () =>
          readArticleFromCache(queryClient, projectId, articleId),
        handlers: {
          onSuccess: (article) => {
            patchArticleInCache(queryClient, projectId, article);
            setArticleConflict(null);
            setSaveError(null);
          },
          onSupersededSuccess: (article) => {
            patchArticleInCache(queryClient, projectId, article, true);
          },
          onConflict: (server) => {
            const local =
              readArticleFromCache(queryClient, projectId, articleId) ?? nextDoc;
            setArticleConflict({
              projectId,
              articleId,
              local,
              server,
            });
            setSaveError(null);
          },
          onError: (_expectedVersion, error) => {
            setSaveError(errorMessage(error));
          },
        },
      });

      patchArticleInCache(queryClient, projectId, nextDoc);
    },
    [projectId, queryClient, setArticleConflict, setSaveError],
  );

  const chooseArticleConflictResolution = useCallback(
    (choice: 'keep-local' | 'take-server') => {
      const conflict = useArticleStore.getState().articleConflict;
      if (!conflict || conflict.projectId !== projectId) return;

      const nextDoc = articleWrite.resolveConflict({
        projectId: conflict.projectId,
        articleId: conflict.articleId,
        choice,
        local: conflict.local,
        server: conflict.server,
        mode: 'network',
        updatedAt: formatNowTimestamp(),
        readCurrent: () =>
          readArticleFromCache(
            queryClient,
            conflict.projectId,
            conflict.articleId,
          ),
        handlers: {
          onSuccess: (article) => {
            patchArticleInCache(queryClient, conflict.projectId, article);
            setArticleConflict(null);
            setSaveError(null);
          },
          onConflict: (server) => {
            const local =
              readArticleFromCache(
                queryClient,
                conflict.projectId,
                conflict.articleId,
              ) ?? nextDoc;
            setArticleConflict({
              projectId: conflict.projectId,
              articleId: conflict.articleId,
              local,
              server,
            });
            setSaveError(null);
          },
          onError: (_expectedVersion, error) => {
            setSaveError(errorMessage(error));
          },
        },
      });

      patchArticleInCache(queryClient, conflict.projectId, nextDoc);
      setArticleConflict(null);
    },
    [projectId, queryClient, setArticleConflict, setSaveError],
  );

  const updateArticleMeta = useCallback(
    async (articleId: string, meta: ArticleMetaInput) => {
      if (!projectId) return;
      const existing = readArticleFromCache(queryClient, projectId, articleId);
      if (!existing) return;
      const payload: UpdateArticleInput = {
        version: existing.version,
        title: meta.title?.trim() || existing.title || '未命名谱文',
        ...(meta.subtitle !== undefined ? { subtitle: meta.subtitle } : {}),
        ...(meta.author !== undefined ? { author: meta.author } : {}),
        ...(meta.status !== undefined ? { status: meta.status } : {}),
        ...(meta.privacy !== undefined ? { privacy: meta.privacy } : {}),
        ...(meta.citations !== undefined ? { citations: meta.citations } : {}),
        ...(meta.docType !== undefined ? { docType: meta.docType } : {}),
      };
      const { article } = await updateArticleRequest(
        projectId,
        articleId,
        payload,
      );
      patchArticleInCache(queryClient, projectId, article);
      await invalidateArticlesDirectory(queryClient, projectId);
    },
    [projectId, queryClient],
  );

  const renameNode = useCallback(
    async (id: string, name: string) => {
      const clean = name.trim();
      if (!clean || !projectId) return;
      const cached = queryClient.getQueryData<ArticlesDirectoryPayload>(
        articlesKeys.directory(projectId),
      );
      const isFolder = cached?.folders.some((f) => f.id === id);
      if (isFolder) {
        await updateFolderRequest(projectId, id, { name: clean });
        await invalidateArticlesDirectory(queryClient, projectId);
        return;
      }
      const existing = cached?.articles.find((a) => a.id === id);
      if (!existing) return;
      await updateArticleRequest(projectId, id, {
        version: existing.version,
        title: clean,
      });
      await invalidateArticlesDirectory(queryClient, projectId);
    },
    [projectId, queryClient],
  );

  const duplicateNode = useCallback(
    async (id: string) => {
      if (!projectId) return;
      const cached = queryClient.getQueryData<ArticlesDirectoryPayload>(
        articlesKeys.directory(projectId),
      );
      const isArticle = cached?.articles.some((a) => a.id === id);
      if (!isArticle) return;
      const { article } = await duplicateArticleRequest(projectId, id);
      await invalidateArticlesDirectory(queryClient, projectId);
      selectNode(projectId, article.id);
    },
    [projectId, queryClient, selectNode],
  );

  const removeNode = useCallback(
    async (id: string) => {
      if (!projectId) return;
      const cached = queryClient.getQueryData<ArticlesDirectoryPayload>(
        articlesKeys.directory(projectId),
      );
      const isFolder = cached?.folders.some((f) => f.id === id);
      if (isFolder) {
        await deleteFolderRequest(projectId, id);
      } else {
        articleWrite.invalidate(projectId, id);
        await deleteArticleRequest(projectId, id);
      }
      await invalidateArticlesDirectory(queryClient, projectId);
    },
    [projectId, queryClient],
  );

  const recordRevision = useCallback(
    async (articleId: string, summary: string, authorName: string) => {
      if (!projectId) return;
      await createArticleRevisionRequest(projectId, articleId, {
        summary,
        authorName,
      });
      await invalidateArticleRevisions(queryClient, projectId, articleId);
    },
    [projectId, queryClient],
  );

  const restoreRevision = useCallback(
    async (articleId: string, revisionId: string, authorName: string) => {
      if (!projectId) return;
      const existing = readArticleFromCache(queryClient, projectId, articleId);
      if (!existing) return;
      articleWrite.invalidate(projectId, articleId);
      const res = await restoreArticleRevisionRequest(
        projectId,
        articleId,
        revisionId,
        {
          version: existing.version,
          authorName,
        },
      );
      patchArticleInCache(queryClient, projectId, res.article);
      await Promise.all([
        invalidateArticlesDirectory(queryClient, projectId),
        invalidateArticleRevisions(queryClient, projectId, articleId),
      ]);
    },
    [projectId, queryClient],
  );

  return {
    addFolder,
    addArticle,
    updateArticleContent,
    chooseArticleConflictResolution,
    updateArticleMeta,
    renameNode,
    duplicateNode,
    removeNode,
    recordRevision,
    restoreRevision,
  };
}

export { makeArticleStorageKey };
