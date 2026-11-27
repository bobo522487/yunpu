import type { ArticleDocType, ArticlePrivacy, ArticleStatus } from './types';

export const DOC_TYPE_LABELS: Record<ArticleDocType, string> = {
  preface: '谱序',
  rules: '凡例',
  origin: '姓氏源流',
  motto: '家训族规',
  biography: '人物传记',
  inscription: '碑记艺文',
  custom: '自定义篇目',
};

export const STATUS_LABELS: Record<ArticleStatus, string> = {
  draft: '草稿',
  review: '待校',
  approved: '定稿',
};

export const PRIVACY_LABELS: Record<ArticlePrivacy, string> = {
  public: '公开',
  clan: '族内',
  editors: '编委',
};

export function filterArticlesByStatus<T extends { status?: ArticleStatus }>(
  docs: T[],
  status: ArticleStatus | 'all',
): T[] {
  if (status === 'all') return docs;
  return docs.filter((doc) => doc.status === status);
}