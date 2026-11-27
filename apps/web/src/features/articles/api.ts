import type {
  CreateArticleInput,
  CreateArticleRevisionInput,
  RestoreArticleRevisionInput,
  UpdateArticleInput,
} from '@yunpu/shared';
import { ApiError, apiRequest, apiUpload } from '../../lib/api';
import type { FolderDto } from '../lineage/api';
import type { ArticleDocument, ArticleRevision } from './types';

export interface ArticleWriteRequest {
  projectId?: string;
  articleId: string;
  expectedVersion: number;
  article: ArticleDocument;
}

export interface ArticlesDirectoryPayload {
  folders: FolderDto[];
  articles: ArticleDocument[];
}

export interface ArticleAssetUploadPayload {
  key: string;
  url: string;
}

export function articleAssetUrl(projectId: string, assetId: string): string {
  const clean = assetId.trim();
  if (!clean) return '';
  if (clean.startsWith('/api/') || clean.startsWith('http://') || clean.startsWith('https://')) {
    return clean;
  }
  return `/api/v1/projects/${projectId}/article-assets/${encodeURIComponent(clean)}`;
}

export async function saveArticleRemote(
  url: string,
  request: ArticleWriteRequest,
): Promise<
  | { ok: true; article: ArticleDocument }
  | { ok: false; status: 409; server: ArticleDocument }
> {
  const doc = request.article;
  const body: UpdateArticleInput = {
    version: request.expectedVersion,
    title: doc.title?.trim() || '未命名谱文',
    subtitle: doc.subtitle ?? '',
    author: doc.author ?? '',
    docType: doc.docType,
    status: doc.status,
    privacy: doc.privacy,
    ...(doc.contentJson && typeof doc.contentJson.type === 'string'
      ? { contentJson: doc.contentJson as UpdateArticleInput['contentJson'] }
      : {}),
    contentHtml: doc.contentHtml ?? '<p></p>',
    linkedPersonIds: doc.linkedPersonIds ?? [],
    linkedChartIds: doc.linkedChartIds ?? [],
    citations: doc.citations ?? [],
    wordCount: Math.max(0, doc.wordCount ?? 0),
  };

  try {
    const data = await apiRequest<{ article?: ArticleDocument }>(url, {
      method: 'PATCH',
      body,
    });
    if (!data?.article) {
      throw new ApiError('谱文保存响应缺少文档数据', 'INVALID_RESPONSE', 500);
    }
    return { ok: true, article: data.article };
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      const serverArticle = error.details?.article as
        | ArticleDocument
        | undefined;
      if (serverArticle) {
        return { ok: false, status: 409, server: serverArticle };
      }
    }
    throw error;
  }
}

export const fetchArticlesDirectory = (projectId: string) =>
  apiRequest<ArticlesDirectoryPayload>(`/api/v1/projects/${projectId}/articles`);

export const createArticleRequest = (
  projectId: string,
  payload: CreateArticleInput,
) =>
  apiRequest<{ article: ArticleDocument }>(
    `/api/v1/projects/${projectId}/articles`,
    { method: 'POST', body: payload },
  );

export const updateArticleRequest = (
  projectId: string,
  articleId: string,
  payload: UpdateArticleInput,
) =>
  apiRequest<{ article: ArticleDocument }>(
    `/api/v1/projects/${projectId}/articles/${articleId}`,
    { method: 'PATCH', body: payload },
  );

export const duplicateArticleRequest = (projectId: string, articleId: string) =>
  apiRequest<{ article: ArticleDocument }>(
    `/api/v1/projects/${projectId}/articles/${articleId}/duplicate`,
    { method: 'POST' },
  );

export const deleteArticleRequest = (projectId: string, articleId: string) =>
  apiRequest<{ deleted: boolean }>(
    `/api/v1/projects/${projectId}/articles/${articleId}`,
    { method: 'DELETE' },
  );

export const fetchArticleRevisions = (projectId: string, articleId: string) =>
  apiRequest<{ revisions: ArticleRevision[] }>(
    `/api/v1/projects/${projectId}/articles/${articleId}/revisions`,
  );

export const createArticleRevisionRequest = (
  projectId: string,
  articleId: string,
  payload: CreateArticleRevisionInput,
) =>
  apiRequest<{ revision: ArticleRevision }>(
    `/api/v1/projects/${projectId}/articles/${articleId}/revisions`,
    { method: 'POST', body: payload },
  );

export const restoreArticleRevisionRequest = (
  projectId: string,
  articleId: string,
  revisionId: string,
  payload: RestoreArticleRevisionInput,
) =>
  apiRequest<{ article: ArticleDocument; revision: ArticleRevision }>(
    `/api/v1/projects/${projectId}/articles/${articleId}/revisions/${revisionId}/restore`,
    { method: 'POST', body: payload },
  );

export const uploadArticleAssetRequest = (
  projectId: string,
  blob: Blob,
  contentType = blob.type || 'image/png',
) =>
  apiUpload<ArticleAssetUploadPayload>(
    `/api/v1/projects/${projectId}/article-assets`,
    blob,
    contentType,
  );
