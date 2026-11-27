import type { JSONContent } from '@tiptap/core';

export interface ArticleHeading {
  level: 1 | 2 | 3;
  text: string;
}

export interface ArticleMetrics {
  wordCount: number;
  paragraphCount: number;
  readingMinutes: number;
  headings: ArticleHeading[];
  linkedPersonIds: string[];
  linkedChartIds: string[];
}

const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'listItem',
  'blockquote',
  'figureImage',
  'table',
]);

function textOf(node: JSONContent | null | undefined): string {
  if (!node) return '';
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'personMention' && !(node.content && node.content.length > 0)) {
    return String(node.attrs?.fallbackName ?? '');
  }
  return (node.content ?? []).map((child) => textOf(child)).join('');
}

function countChars(value: string): number {
  return value.replace(/\s+/g, '').length;
}

export function readingTimeLabel(wordCount: number): string {
  if (wordCount <= 0) return '预计阅读 0 分钟';
  return `预计阅读 ${Math.max(1, Math.ceil(wordCount / 300))} 分钟`;
}

export function extractArticleMetrics(doc: JSONContent | null | undefined): ArticleMetrics {
  const headings: ArticleHeading[] = [];
  const linkedPersonIds: string[] = [];
  const linkedChartIds: string[] = [];
  const personSeen = new Set<string>();
  const chartSeen = new Set<string>();
  let paragraphCount = 0;
  let wordCount = 0;

  const visit = (node: JSONContent | null | undefined) => {
    if (!node) return;
    if (node.type && BLOCK_TYPES.has(node.type)) paragraphCount += 1;
    if (node.type === 'heading') {
      const level = node.attrs?.level;
      if (level === 1 || level === 2 || level === 3) {
        headings.push({ level, text: textOf(node).replace(/\s+/g, '') });
      }
    }
    if (node.type === 'personMention') {
      const personId = String(node.attrs?.personId ?? '').trim();
      const chartId = String(node.attrs?.chartId ?? '').trim();
      if (personId && !personSeen.has(personId)) {
        personSeen.add(personId);
        linkedPersonIds.push(personId);
      }
      if (chartId && !chartSeen.has(chartId)) {
        chartSeen.add(chartId);
        linkedChartIds.push(chartId);
      }
    }
    if (node.type === 'text') {
      wordCount += countChars(node.text ?? '');
    } else if (node.type === 'personMention' && !(node.content && node.content.length > 0)) {
      wordCount += countChars(String(node.attrs?.fallbackName ?? ''));
    }
    if (node.type === 'figureImage') {
      wordCount += countChars(String(node.attrs?.caption ?? ''));
    }
    if (node.type === 'inlineAnnotation') {
      wordCount += countChars(String(node.attrs?.noteText ?? ''));
    }
    for (const child of node.content ?? []) visit(child);
  };

  visit(doc);
  return {
    wordCount,
    paragraphCount,
    readingMinutes: wordCount <= 0 ? 0 : Math.max(1, Math.ceil(wordCount / 300)),
    headings,
    linkedPersonIds,
    linkedChartIds,
  };
}
