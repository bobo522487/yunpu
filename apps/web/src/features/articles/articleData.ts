import type { TreeItem } from '../../components/common/Tree/types';
import type { ArticleDocument, ProjectArticleSeedContext } from './types';
import { getArticleTemplate } from './domain/articleTemplates';
import { extractArticleMetrics } from './domain/articleMetrics';
import { contentJsonToHtml, htmlToContentJson } from './domain/htmlProjection';

export function makeArticleStorageKey(projectId: string, articleId: string): string {
  return `${projectId}::${articleId}`;
}

export function findFirstArticleId(items: TreeItem[]): string | null {
  for (const item of items) {
    if (item.type === 'article') {
      return String(item.id);
    }
    if (item.children?.length) {
      const found = findFirstArticleId(item.children);
      if (found) return found;
    }
  }
  return null;
}

export function countArticlesInTree(items: TreeItem[]): number {
  let count = 0;
  for (const item of items) {
    if (item.type === 'article') {
      count += 1;
    } else if (item.children?.length) {
      count += countArticlesInTree(item.children);
    }
  }
  return count;
}

export function extractPlainTextFromHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function computeWordCount(html: string): number {
  const plain = extractPlainTextFromHtml(html);
  if (!plain) return 0;
  return plain.replace(/\s+/g, '').length;
}

export function formatNowTimestamp(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

export function createInitialArticleSeed(
  projectId: string,
  ctx: ProjectArticleSeedContext
): {
  tree: TreeItem[];
  articles: Record<string, ArticleDocument>;
  defaultSelectedId: string;
} {
  const familyName = ctx.familyName?.trim() || '本族';
  const surname = ctx.surname?.trim() || '宗';
  const hallName = ctx.hallName?.trim() || `${surname}氏宗堂`;
  const ancestor = ctx.ancestor?.trim() || `${surname}氏始迁祖`;
  const timestamp = formatNowTimestamp();

  const prefaceId = 'article-preface';
  const rulesId = 'article-rules';
  const originId = 'article-origin';
  const mottoId = 'article-motto';
  const biographyId = 'article-biography';
  const inscriptionId = 'article-inscription';

  const tree: TreeItem[] = [
    {
      id: 'article-vol-front',
      type: 'folder',
      collapsed: false,
      data: { name: '卷首 · 谱序与凡例' },
      children: [
        {
          id: prefaceId,
          type: 'article',
          data: { name: '重修族谱序' },
          children: [],
        },
        {
          id: rulesId,
          type: 'article',
          data: { name: '修谱凡例' },
          children: [],
        },
      ],
    },
    {
      id: 'article-vol-origin',
      type: 'folder',
      collapsed: false,
      data: { name: '卷一 · 姓氏源流' },
      children: [
        {
          id: originId,
          type: 'article',
          data: { name: `${surname}氏得姓源流考` },
          children: [],
        },
      ],
    },
    {
      id: 'article-vol-precepts',
      type: 'folder',
      collapsed: false,
      data: { name: '卷二 · 家训族规' },
      children: [
        {
          id: mottoId,
          type: 'article',
          data: { name: '祖训家规十条' },
          children: [],
        },
      ],
    },
    {
      id: 'article-vol-biographies',
      type: 'folder',
      collapsed: false,
      data: { name: '卷三 · 人物传记与艺文' },
      children: [
        {
          id: biographyId,
          type: 'article',
          data: { name: `${ancestor}公传略` },
          children: [],
        },
        {
          id: inscriptionId,
          type: 'article',
          data: { name: '宗祠碑记与艺文录' },
          children: [],
        },
      ],
    },
  ];

  const templateIds: Array<{
    articleId: string;
    templateId: string;
    title: string;
    subtitle: string;
    author: string;
  }> = [
    {
      articleId: prefaceId,
      templateId: 'preface',
      title: '重修族谱序',
      subtitle: `卷首 · ${familyName}重修谱序`,
      author: `${hallName}修谱编委会`,
    },
    {
      articleId: rulesId,
      templateId: 'rules',
      title: '修谱凡例',
      subtitle: '卷首 · 编修体例与收录规范',
      author: `${hallName}修谱编委会`,
    },
    {
      articleId: originId,
      templateId: 'origin',
      title: `${surname}氏得姓源流考`,
      subtitle: `卷一 · ${surname}氏受姓源流与迁徙沿革`,
      author: '谱牒文献考订组',
    },
    {
      articleId: mottoId,
      templateId: 'motto',
      title: '祖训家规十条',
      subtitle: `卷二 · ${hallName}传家训诫`,
      author: '先祖遗训辑录',
    },
    {
      articleId: biographyId,
      templateId: 'biography',
      title: `${ancestor}公传略`,
      subtitle: '卷三 · 人物传记',
      author: `${hallName}编委会`,
    },
    {
      articleId: inscriptionId,
      templateId: 'inscription',
      title: '宗祠碑记与艺文录',
      subtitle: '卷三 · 碑刻铭文与诗词选存',
      author: '艺文辑录组',
    },
  ];

  const articles: Record<string, ArticleDocument> = {};
  for (const item of templateIds) {
    const template = getArticleTemplate(item.templateId);
    if (!template) continue;
    const contentJson = htmlToContentJson(template.buildContent(ctx));
    const metrics = extractArticleMetrics(contentJson);
    articles[makeArticleStorageKey(projectId, item.articleId)] = {
      id: item.articleId,
      title: item.title,
      subtitle: item.subtitle,
      author: item.author,
      docType: template.docType,
      status: 'draft',
      privacy: 'clan',
      contentJson,
      contentHtml: contentJsonToHtml(contentJson),
      linkedPersonIds: metrics.linkedPersonIds,
      linkedChartIds: metrics.linkedChartIds,
      citations: [],
      version: 1,
      wordCount: metrics.wordCount,
      updatedAt: timestamp,
    };
  }

  return {
    tree,
    articles,
    defaultSelectedId: prefaceId,
  };
}
