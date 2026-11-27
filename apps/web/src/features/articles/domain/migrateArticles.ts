import type { ArticleDocument, ArticleRevision } from '../types';

interface V1Article {
  id?: string;
  title?: string;
  subtitle?: string;
  author?: string;
  contentHtml?: string;
  contentJson?: ArticleDocument['contentJson'];
  wordCount?: number;
  updatedAt?: string;
  docType?: ArticleDocument['docType'];
  status?: ArticleDocument['status'];
  privacy?: ArticleDocument['privacy'];
  linkedPersonIds?: string[];
  linkedChartIds?: string[];
  citations?: ArticleDocument['citations'];
  version?: number;
}

export function migrateArticlesV1ToV2(persisted: unknown): {
  treesByProject: Record<string, unknown[]>;
  selectedNodeIdByProject: Record<string, string>;
  articlesByKey: Record<string, ArticleDocument>;
} {
  const state = (persisted ?? {}) as {
    treesByProject?: Record<string, unknown[]>;
    selectedNodeIdByProject?: Record<string, string>;
    articlesByKey?: Record<string, V1Article>;
  };
  const articlesByKey: Record<string, ArticleDocument> = {};
  for (const [key, doc] of Object.entries(state.articlesByKey ?? {})) {
    articlesByKey[key] = {
      id: doc.id || key.split('::').pop() || key,
      title: doc.title || '未命名谱文',
      subtitle: doc.subtitle || '',
      author: doc.author || '',
      docType: doc.docType || 'custom',
      status: doc.status || 'draft',
      privacy: doc.privacy || 'clan',
      contentJson: doc.contentJson,
      contentHtml: doc.contentHtml || '<p></p>',
      linkedPersonIds: doc.linkedPersonIds || [],
      linkedChartIds: doc.linkedChartIds || [],
      citations: doc.citations || [],
      version: doc.version || 1,
      wordCount: doc.wordCount || 0,
      updatedAt: doc.updatedAt || '',
    };
  }
  return {
    treesByProject: state.treesByProject || {},
    selectedNodeIdByProject: state.selectedNodeIdByProject || {},
    articlesByKey,
  };
}

type ArticlePersistV2 = ReturnType<typeof migrateArticlesV1ToV2>;

export function migrateArticlesV2ToV3(persisted: unknown): ArticlePersistV2 & {
  revisionsByArticleId: Record<string, ArticleRevision[]>;
} {
  const state = (persisted ?? {}) as ArticlePersistV2 & {
    revisionsByArticleId?: Record<string, ArticleRevision[]>;
  };
  return {
    treesByProject: state.treesByProject || {},
    selectedNodeIdByProject: state.selectedNodeIdByProject || {},
    articlesByKey: state.articlesByKey || {},
    revisionsByArticleId: state.revisionsByArticleId ?? {},
  };
}