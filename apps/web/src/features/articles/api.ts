import { ApiError, apiRequest } from '../../lib/api';
import type { ArticleDocument } from './types';

export interface ArticleWriteRequest {
  articleId: string;
  expectedVersion: number;
  article: ArticleDocument;
}

export async function saveArticleRemote(
  url: string,
  request: ArticleWriteRequest,
): Promise<
  | { ok: true; article: ArticleDocument }
  | { ok: false; status: 409; server: ArticleDocument }
> {
  try {
    const data = await apiRequest<{ article?: ArticleDocument }>(url, {
      method: 'PUT',
      body: {
        expectedVersion: request.expectedVersion,
        article: request.article,
      },
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
