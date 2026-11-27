import type { TreeItem } from '../../../../components/common/Tree/types';
import { makeArticleStorageKey } from '../../../articles/articleData';

export interface ArticleListItem {
  id: string;
  title: string;
  folderName: string;
  wordCount: number;
}

export function flattenArticleTree(
  items: TreeItem[],
  articlesByKey: Record<string, { title: string; wordCount: number }>,
  projectId: string,
  folderName = '根目录',
): ArticleListItem[] {
  const out: ArticleListItem[] = [];
  for (const item of items) {
    if (item.type === 'folder') {
      out.push(
        ...flattenArticleTree(
          item.children || [],
          articlesByKey,
          projectId,
          item.data?.name || '卷目',
        ),
      );
    } else if (item.type === 'article') {
      const id = String(item.id);
      const doc = articlesByKey[makeArticleStorageKey(projectId, id)];
      out.push({
        id,
        title: doc?.title || item.data?.name || id,
        folderName,
        wordCount: doc?.wordCount ?? 0,
      });
    }
  }
  return out;
}
