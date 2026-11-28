import type { TreeItem } from '../../components/common/Tree/types';
import { createEntityId } from '../../lib/id';
import { findTreeNode } from '../../lib/treeOps';
import type { ArticleDocument } from '../articles/types';
import {
  computeWordCount,
  extractPlainTextFromHtml,
  makeArticleStorageKey,
} from '../articles/articleData';
import { contentJsonToOutputHtml } from '../articles/domain/htmlProjection';
import { getLineageGraph } from '../lineage/domain/lineageGraph';
import { buildPersonSummary } from '../lineage/domain/personSummary';
import type { PersonRecord } from '../lineage/types';
import {
  computeAutoRankLabel,
  formatPersonAliases,
} from '../lineage/utils/personHelpers';
import type {
  BookEdition,
  BookLayoutConfig,
  BookRecord,
  CatalogLeafNode,
  CatalogLineageNode,
  CatalogNode,
  CatalogSectionCode,
  CompiledLineageEntry,
  CompiledPage,
  CompiledTocEntry,
} from './types';
import { formatTimestampNow } from './bookFormat';

export {
  BINDING_LABELS,
  formatPageNumberLabel,
  formatTimestampNow,
  LINEAGE_STYLE_LABELS,
  PAPER_SIZE_LABELS,
  sanitizeVolumeNo,
  toChineseNumeral,
} from './bookFormat';
export { generateProofHtmlDocument } from './bookProofHtml';

export function resolveChartPersons(
  projectId: string,
  chartId: string,
  lineageTree: TreeItem[],
  personsByChart: Record<string, PersonRecord[]>,
  _projectSurname?: string
): { chartName: string; persons: PersonRecord[] } {
  const node = findTreeNode(lineageTree, chartId);
  const chartName = node?.data?.name || '谱系图谱';
  const key = `${projectId}::${chartId}`;
  return {
    chartName,
    persons: personsByChart[key] ?? [],
  };
}

export function sliceLineagePersons(
  allPersons: PersonRecord[],
  node: CatalogLineageNode
): PersonRecord[] {
  if (!allPersons.length) return [];

  const startPerson =
    allPersons.find((p) => p.id === node.startMemberId) || allPersons[0];
  if (!startPerson) return [];

  const startGen = startPerson.generation || 1;
  const { childrenByFatherId: childrenByParent } = getLineageGraph(allPersons);

  const result: PersonRecord[] = [];
  const visited = new Set<string>();

  const traverse = (person: PersonRecord) => {
    if (visited.has(person.id)) return;

    if (
      node.descendantScope === 'generations' &&
      node.maxGenerations &&
      person.generation - startGen + 1 > node.maxGenerations
    ) {
      return;
    }

    if (
      node.descendantScope === 'member' &&
      node.endMemberId &&
      person.id === node.endMemberId
    ) {
      return;
    }

    visited.add(person.id);
    result.push(person);

    if (
      node.descendantScope === 'member_inclusive' &&
      node.endMemberId &&
      person.id === node.endMemberId
    ) {
      return;
    }

    const kids = childrenByParent.get(person.id) || [];
    for (const child of kids) {
      traverse(child);
    }
  };

  traverse(startPerson);
  return result;
}

function splitHtmlIntoPages(html: string, maxCharsPerPage: number): string[] {
  const plain = extractPlainTextFromHtml(html);
  if (!plain || plain.length <= maxCharsPerPage) {
    return [html || '<p>暂无正文内容。</p>'];
  }

  // Split by paragraph / heading boundaries when available
  const blocks = html
    .split(/(?=<(?:p|h[1-6]|blockquote|table|ul|ol)[\s>])/i)
    .map((b) => b.trim())
    .filter(Boolean);

  if (blocks.length <= 1) {
    return [html];
  }

  const pages: string[] = [];
  let currentBlocks: string[] = [];
  let currentChars = 0;

  for (const block of blocks) {
    const blockLen = extractPlainTextFromHtml(block).length || 20;
    if (currentChars > 0 && currentChars + blockLen > maxCharsPerPage) {
      pages.push(currentBlocks.join('\n'));
      currentBlocks = [block];
      currentChars = blockLen;
    } else {
      currentBlocks.push(block);
      currentChars += blockLen;
    }
  }

  if (currentBlocks.length > 0) {
    pages.push(currentBlocks.join('\n'));
  }

  return pages.length > 0 ? pages : [html];
}

function flattenSectionLeaves(
  nodes: CatalogNode[],
  chapterTitle?: string
): Array<{ leaf: CatalogLeafNode; chapterTitle?: string }> {
  const items: Array<{ leaf: CatalogLeafNode; chapterTitle?: string }> = [];
  for (const node of nodes) {
    if (node.nodeType === 'chapter') {
      items.push(...flattenSectionLeaves(node.children, node.title));
    } else {
      items.push({ leaf: node, chapterTitle });
    }
  }
  return items;
}

export interface CompileBookParams {
  projectId: string;
  book: BookRecord;
  articlesByKey: Record<string, ArticleDocument>;
  lineageTree: TreeItem[];
  personsByChart: Record<string, PersonRecord[]>;
  projectSurname?: string;
}

export function compileBookEdition(params: CompileBookParams): BookEdition {
  const { projectId, book, articlesByKey, lineageTree, personsByChart, projectSurname } =
    params;
  const layout: BookLayoutConfig = { ...book.layoutConfig };

  const charsPerPage =
    layout.density === 'loose' ? 420 : layout.density === 'compact' ? 760 : 580;

  const pages: CompiledPage[] = [];
  const tocEntries: CompiledTocEntry[] = [];
  const uniqueMemberIds = new Set<string>();
  let totalWords = 0;

  // Page 1: Cover page
  pages.push({
    pageNo: 1,
    type: 'cover',
    sectionCode: 'cover',
    headerTitle: book.headerName || book.bookName,
    eyebrowTitle: book.volumeNo || '卷一',
    hallName: book.hallName || '宗亲堂',
    title: book.bookName,
    author: book.editor || '家族编委会',
  });

  // Compile preface items BEFORE TOC (卷首：显示在目录之前的内容)
  const prefaceLeaves = flattenSectionLeaves(book.sections.preface.items);
  const preTocPages: CompiledPage[] = [];

  const appendArticlePages = (
    targetList: CompiledPage[],
    sectionCode: CatalogSectionCode,
    sectionLabel: string,
    leaf: Extract<CatalogLeafNode, { nodeType: 'article' }>,
    chapterTitle?: string,
    recordToc = true
  ) => {
    const key = makeArticleStorageKey(projectId, leaf.sourceArticleId);
    const doc = articlesByKey[key];
    const html = doc?.contentJson
      ? contentJsonToOutputHtml(doc.contentJson, { projectId, personsByChart })
      : doc?.contentHtml ||
        `<p>「${leaf.displayTitle}」引用自谱文《${leaf.sourceTitle}》，当前暂无正文或原谱文已被移除。</p>`;
    const wc = doc ? doc.wordCount : computeWordCount(html);
    totalWords += wc;

    const chunks = splitHtmlIntoPages(html, charsPerPage);
    chunks.forEach((chunkHtml, idx) => {
      const pageNo = targetList === preTocPages ? 2 + preTocPages.length : 0;
      if (idx === 0 && recordToc) {
        tocEntries.push({
          title: leaf.displayTitle,
          sectionLabel: chapterTitle || sectionLabel,
          pageNo,
          level: chapterTitle ? 2 : 1,
        });
      }
      targetList.push({
        pageNo,
        type: 'article',
        sectionCode,
        headerTitle: book.headerName || book.bookName,
        eyebrowTitle: chapterTitle || sectionLabel,
        hallName: book.hallName || '',
        chapterTitle,
        title: idx === 0 ? leaf.displayTitle : `${leaf.displayTitle}（续）`,
        author: doc?.author || book.editor,
        contentHtml: chunkHtml,
      });
    });
  };

  for (const item of prefaceLeaves) {
    if (item.leaf.nodeType === 'article') {
      appendArticlePages(
        preTocPages,
        'preface',
        '卷首',
        item.leaf,
        item.chapterTitle,
        false
      );
    }
  }

  pages.push(...preTocPages);

  // Reserve TOC page right after preface
  const tocPageIndex = pages.length;
  const tocPageNo = tocPageIndex + 1;
  pages.push({
    pageNo: tocPageNo,
    type: 'toc',
    sectionCode: 'toc',
    headerTitle: book.headerName || book.bookName,
    eyebrowTitle: '目录',
    hallName: book.hallName || '',
    title: '谱书总目',
    tocEntries: [],
  });

  // Helper to append post-TOC content
  const appendPostTocArticle = (
    sectionCode: CatalogSectionCode,
    sectionLabel: string,
    leaf: Extract<CatalogLeafNode, { nodeType: 'article' }>,
    chapterTitle?: string
  ) => {
    const key = makeArticleStorageKey(projectId, leaf.sourceArticleId);
    const doc = articlesByKey[key];
    const html = doc?.contentJson
      ? contentJsonToOutputHtml(doc.contentJson, { projectId, personsByChart })
      : doc?.contentHtml ||
        `<p>「${leaf.displayTitle}」引用自谱文《${leaf.sourceTitle}」，暂无正文内容。</p>`;
    const wc = doc ? doc.wordCount : computeWordCount(html);
    totalWords += wc;

    const chunks = splitHtmlIntoPages(html, charsPerPage);
    chunks.forEach((chunkHtml, idx) => {
      const pageNo = pages.length + 1;
      if (idx === 0) {
        tocEntries.push({
          title: leaf.displayTitle,
          sectionLabel: chapterTitle || sectionLabel,
          pageNo,
          level: chapterTitle ? 2 : 1,
        });
      }
      pages.push({
        pageNo,
        type: 'article',
        sectionCode,
        headerTitle: book.headerName || book.bookName,
        eyebrowTitle: chapterTitle || sectionLabel,
        hallName: book.hallName || '',
        chapterTitle,
        title: idx === 0 ? leaf.displayTitle : `${leaf.displayTitle}（续）`,
        author: doc?.author || book.editor,
        contentHtml: chunkHtml,
      });
    });
  };

  const appendLineagePages = (
    leaf: CatalogLineageNode,
    chapterTitle?: string
  ) => {
    const { persons: chartPersons } = resolveChartPersons(
      projectId,
      leaf.chartId,
      lineageTree,
      personsByChart,
      projectSurname
    );
    const sliced = sliceLineagePersons(chartPersons, leaf);
    sliced.forEach((p) => uniqueMemberIds.add(p.id));

    const chartIndex = getLineageGraph(chartPersons);
    const childrenMap = new Map<string, string[]>();
    for (const p of sliced) {
      const parentId = p.fatherId || p.motherId;
      if (parentId && !p.spouseOfId) {
        const arr = childrenMap.get(parentId) || [];
        arr.push(p.name);
        childrenMap.set(parentId, arr);
      }
    }

    const eyebrow = leaf.eyebrowTitle || '谱系';
    const totalTitle = leaf.totalTitle || book.bookName;

    // 1. 世系表 (allocate page numbers first or collect entries)
    const entries: CompiledLineageEntry[] = sliced.map((p) => {
      const parentId = p.fatherId || p.motherId;
      const father = parentId ? chartIndex.personById.get(parentId) : undefined;
      const kids = childrenMap.get(p.id) || [];
      const spouses = chartIndex.spousesByPartnerId.get(p.id) || [];
      const rank = computeAutoRankLabel(p, chartPersons);
      const aliasesText = formatPersonAliases(p) || undefined;
      const summary = buildPersonSummary(p, chartPersons, kids, spouses, rank);
      totalWords += p.name.length + summary.length;
      return {
        id: p.id,
        name: p.name,
        surname: p.surname,
        aliasesText,
        generation: p.generation,
        rank: rank || undefined,
        fatherName: father?.name,
        spousesText: spouses.map((s) => s.name).join('、') || undefined,
        summaryText: summary,
        childrenNames: kids,
      };
    });

    // Calculate approximate page start for shixi entries
    const indexPagesCount =
      leaf.indexConfig.enabled && sliced.length > 0
        ? Math.max(1, Math.ceil(sliced.length / 18))
        : 0;
    const diaoxianPagesCount =
      leaf.diaoxianConfig.enabled && sliced.length > 0 ? 1 : 0;

    const firstShixiPageNo =
      pages.length + 1 + indexPagesCount + diaoxianPagesCount;

    // 1. 族丁检索表
    if (leaf.indexConfig.enabled) {
      const rowsPerPage = 18;
      const totalIdxPages = Math.max(1, Math.ceil(sliced.length / rowsPerPage));
      for (let i = 0; i < totalIdxPages; i++) {
        const pageNo = pages.length + 1;
        if (i === 0 && leaf.indexConfig.inToc) {
          tocEntries.push({
            title: `${leaf.eyebrowTitle} · ${leaf.indexConfig.tocTitle || '族丁检索表'}`,
            sectionLabel: chapterTitle || '谱系',
            pageNo,
            level: 2,
          });
        }
        const sliceRows = sliced
          .slice(i * rowsPerPage, (i + 1) * rowsPerPage)
          .map((p, idx) => ({
            name: p.name,
            generation: p.generation,
            fatherName:
              (p.fatherId ? chartIndex.personById.get(p.fatherId)?.name : undefined) ||
              '—',
            pageRef:
              firstShixiPageNo + Math.floor((i * rowsPerPage + idx) / 6),
          }));

        pages.push({
          pageNo,
          type: 'lineage_index',
          sectionCode: 'lineage',
          headerTitle: book.headerName || book.bookName,
          eyebrowTitle: eyebrow,
          hallName: book.hallName || '',
          chapterTitle,
          title: leaf.indexConfig.tocTitle || '族丁检索表',
          indexRows: sliceRows,
        });
      }
    }

    // 2. 吊线图
    if (leaf.diaoxianConfig.enabled) {
      const pageNo = pages.length + 1;
      if (leaf.diaoxianConfig.inToc) {
        tocEntries.push({
          title: `${leaf.eyebrowTitle} · ${leaf.diaoxianConfig.tocTitle || '吊线图'}`,
          sectionLabel: chapterTitle || '谱系',
          pageNo,
          level: 2,
        });
      }
      pages.push({
        pageNo,
        type: 'lineage_tree',
        sectionCode: 'lineage',
        headerTitle: book.headerName || book.bookName,
        eyebrowTitle: eyebrow,
        hallName: book.hallName || '',
        chapterTitle,
        title: `${totalTitle} · ${leaf.diaoxianConfig.tocTitle || '吊线图'}`,
        treePersons: sliced.slice(0, 32).map((p) => ({
          id: p.id,
          name: p.name,
          generation: p.generation,
          fatherId: p.fatherId,
          rank: computeAutoRankLabel(p, chartPersons) || undefined,
        })),
      });
    }

    // 3. 世系表
    if (leaf.shixiConfig.enabled) {
      const entriesPerPage =
        layout.density === 'loose' ? 4 : layout.density === 'compact' ? 8 : 6;
      const totalShixiPages = Math.max(
        1,
        Math.ceil(entries.length / entriesPerPage)
      );
      for (let i = 0; i < totalShixiPages; i++) {
        const pageNo = pages.length + 1;
        if (i === 0 && leaf.shixiConfig.inToc) {
          tocEntries.push({
            title: `${leaf.eyebrowTitle} · ${leaf.shixiConfig.tocTitle || '谱系表'}`,
            sectionLabel: chapterTitle || '谱系',
            pageNo,
            level: 2,
          });
        }
        pages.push({
          pageNo,
          type: 'lineage_table',
          sectionCode: 'lineage',
          headerTitle: book.headerName || book.bookName,
          eyebrowTitle: eyebrow,
          hallName: book.hallName || '',
          chapterTitle,
          title: `${totalTitle} · ${leaf.shixiConfig.tocTitle || '谱系表'}`,
          lineageEntries: entries.slice(
            i * entriesPerPage,
            (i + 1) * entriesPerPage
          ),
          lineageStyle: layout.lineageStyle,
        });
      }
    }
  };

  const postSections: Array<{ code: CatalogSectionCode; label: string }> = [
    { code: 'body', label: '正文' },
    { code: 'lineage', label: '谱系' },
    { code: 'appendix', label: '附录' },
  ];

  for (const sec of postSections) {
    const nodes = book.sections[sec.code].items;
    for (const node of nodes) {
      if (node.nodeType === 'chapter') {
        const chapterStartPage = pages.length + 1;
        if (node.children.length > 0) {
          tocEntries.push({
            title: node.title,
            sectionLabel: sec.label,
            pageNo: chapterStartPage,
            level: 1,
          });
        }
        for (const child of node.children) {
          if (child.nodeType === 'article') {
            appendPostTocArticle(sec.code, sec.label, child, node.title);
          } else {
            appendLineagePages(child, node.title);
          }
        }
      } else if (node.nodeType === 'article') {
        appendPostTocArticle(sec.code, sec.label, node);
      } else {
        appendLineagePages(node);
      }
    }
  }

  // Update TOC entries
  pages[tocPageIndex] = {
    ...pages[tocPageIndex],
    tocEntries,
  };

  return {
    id: createEntityId('ed'),
    createdAt: formatTimestampNow(),
    bindingStyle: layout.bindingStyle,
    lineageStyle: layout.lineageStyle,
    paperSize: layout.paperSize,
    pageCount: pages.length,
    memberCount: uniqueMemberIds.size,
    wordCount: totalWords,
    printStatus: 'none',
    layoutSnapshot: layout,
    pages,
  };
}
