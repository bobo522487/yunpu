import type { TreeItem } from '../../components/common/Tree/types';
import type { FolderDto } from '../lineage/api';
import { makeArticleStorageKey } from './articleData';
import type { ArticleDocument } from './types';

function articleToTreeItem(doc: ArticleDocument): TreeItem {
  return {
    id: doc.id,
    type: 'article',
    data: {
      name: doc.title,
      folderId: doc.folderId ?? null,
      seq: doc.seq ?? 0,
      version: doc.version,
    },
    children: [],
  };
}

export function articleDirectoryToTreeItems(
  folders: FolderDto[],
  articles: ArticleDocument[],
  collapsedFolderIds: Record<string, boolean> = {},
): TreeItem[] {
  const sortedFolders = [...folders].sort(
    (a, b) => a.seq - b.seq || a.createdAt.localeCompare(b.createdAt),
  );
  const sortedArticles = [...articles].sort(
    (a, b) =>
      (a.seq ?? 0) - (b.seq ?? 0) ||
      (a.createdAt ?? '').localeCompare(b.createdAt ?? ''),
  );

  const folderIdSet = new Set(sortedFolders.map((f) => f.id));
  const childrenByFolder = new Map<string, TreeItem[]>();
  const rootArticles: { seq: number; createdAt: string; item: TreeItem }[] = [];

  for (const doc of sortedArticles) {
    const node = articleToTreeItem(doc);
    if (doc.folderId && folderIdSet.has(doc.folderId)) {
      const list = childrenByFolder.get(doc.folderId) ?? [];
      list.push(node);
      childrenByFolder.set(doc.folderId, list);
    } else {
      rootArticles.push({
        seq: doc.seq ?? 0,
        createdAt: doc.createdAt ?? '',
        item: node,
      });
    }
  }

  const topLevel: {
    seq: number;
    createdAt: string;
    kindOrder: number;
    item: TreeItem;
  }[] = [];

  for (const folder of sortedFolders) {
    topLevel.push({
      seq: folder.seq,
      createdAt: folder.createdAt,
      kindOrder: 0,
      item: {
        id: folder.id,
        type: 'folder',
        collapsed: Boolean(collapsedFolderIds[folder.id]),
        data: {
          name: folder.name,
          seq: folder.seq,
        },
        children: childrenByFolder.get(folder.id) ?? [],
      },
    });
  }

  for (const entry of rootArticles) {
    topLevel.push({
      seq: entry.seq,
      createdAt: entry.createdAt,
      kindOrder: 1,
      item: entry.item,
    });
  }

  topLevel.sort(
    (a, b) =>
      a.seq - b.seq ||
      a.kindOrder - b.kindOrder ||
      a.createdAt.localeCompare(b.createdAt),
  );

  return topLevel.map((entry) => entry.item);
}

export function buildArticlesByKey(
  projectId: string,
  articles: ArticleDocument[],
): Record<string, ArticleDocument> {
  const map: Record<string, ArticleDocument> = {};
  for (const doc of articles) {
    map[makeArticleStorageKey(projectId, doc.id)] = doc;
  }
  return map;
}
