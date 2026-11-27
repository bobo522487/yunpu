import type { JSONContent } from '@tiptap/core';
import {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import mammoth from 'mammoth';
import type { ArticleAssetRecord } from '../types';
import { contentJsonToHtml, htmlToContentJson } from './htmlProjection';
import {
  mapContentJsonPersonMentionsForOutput,
  type PersonMentionOutputContext,
} from './outputContentJson';

export interface DocxBlock {
  kind: 'heading' | 'paragraph' | 'blockquote' | 'figure' | 'table';
  text: string;
  level?: 1 | 2 | 3;
  rows?: string[][];
}

export function sanitizeArticleFileName(title: string): string {
  const safe = (title || '谱文').replace(/[\\/:*?"<>|]/g, '_').trim() || '谱文';
  return `${safe}.docx`;
}

function inlineText(node: JSONContent | null | undefined): string {
  if (!node) return '';
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'personMention') return String(node.attrs?.fallbackName ?? '');
  if (node.type === 'inlineAnnotation') {
    const note = String(node.attrs?.noteText ?? '');
    return note ? `（注：${note}）` : '';
  }
  return (node.content ?? []).map((child) => inlineText(child)).join('');
}

export function articleJsonToDocxBlocks(json: JSONContent): DocxBlock[] {
  const blocks: DocxBlock[] = [];
  const visit = (node: JSONContent) => {
    if (node.type === 'heading') {
      const level = node.attrs?.level;
      blocks.push({
        kind: 'heading',
        level: level === 1 || level === 2 || level === 3 ? level : 1,
        text: inlineText(node),
      });
      return;
    }
    if (node.type === 'blockquote') {
      blocks.push({ kind: 'blockquote', text: inlineText(node) });
      return;
    }
    if (node.type === 'figureImage') {
      blocks.push({ kind: 'figure', text: String(node.attrs?.caption ?? '') });
      return;
    }
    if (node.type === 'table') {
      const rows = (node.content ?? []).map((row) =>
        (row.content ?? []).map((cell) => inlineText(cell)),
      );
      blocks.push({ kind: 'table', text: '', rows });
      return;
    }
    if (node.type === 'paragraph') {
      blocks.push({ kind: 'paragraph', text: inlineText(node) });
      return;
    }
    for (const child of node.content ?? []) visit(child);
  };
  for (const child of json.content ?? []) visit(child);
  return blocks;
}

function headingLevel(level: 1 | 2 | 3 | undefined) {
  if (level === 1) return HeadingLevel.HEADING_1;
  if (level === 3) return HeadingLevel.HEADING_3;
  return HeadingLevel.HEADING_2;
}

export function tiptapJsonToDocx(
  article: { title: string; subtitle?: string; author?: string; contentJson?: JSONContent },
  projectMeta: { hallName?: string; mentionContext?: PersonMentionOutputContext },
): Document {
  const baseJson = article.contentJson ?? { type: 'doc', content: [] };
  const contentJson = projectMeta.mentionContext
    ? mapContentJsonPersonMentionsForOutput(baseJson, projectMeta.mentionContext)
    : baseJson;
  const blocks = articleJsonToDocxBlocks(contentJson);
  const children = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [new TextRun(article.title || '未命名谱文')],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun([article.subtitle, article.author].filter(Boolean).join(' · '))],
    }),
    ...blocks.map((block) => {
      if (block.kind === 'heading') {
        return new Paragraph({ heading: headingLevel(block.level), children: [new TextRun(block.text)] });
      }
      if (block.kind === 'table') {
        return new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: (block.rows ?? []).map(
            (row) =>
              new TableRow({
                children: row.map(
                  (cell) => new TableCell({ children: [new Paragraph({ children: [new TextRun(cell)] })] }),
                ),
              }),
          ),
        });
      }
      return new Paragraph({ children: [new TextRun(block.text)] });
    }),
  ];
  return new Document({
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [new TextRun([projectMeta.hallName, article.subtitle].filter(Boolean).join(' · '))],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun('第 '),
                  new TextRun({ children: [PageNumber.CURRENT] }),
                  new TextRun(' 页 / 共 '),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES] }),
                  new TextRun(' 页'),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
}

function rewriteAssetImages(json: JSONContent): JSONContent {
  const next: JSONContent = { ...json, attrs: json.attrs ? { ...json.attrs } : undefined };
  const src = String(next.attrs?.src ?? '');
  if (src.startsWith('asset://')) {
    next.type = 'figureImage';
    next.attrs = {
      ...next.attrs,
      assetId: src.slice('asset://'.length),
      src: null,
      caption: String(next.attrs?.caption ?? ''),
      widthPct: next.attrs?.widthPct ?? 80,
      align: next.attrs?.align ?? 'center',
    };
  }
  if (json.content) next.content = json.content.map((child) => rewriteAssetImages(child));
  return next;
}

export async function importDocxArrayBuffer(arrayBuffer: ArrayBuffer): Promise<{
  contentJson: JSONContent;
  contentHtml: string;
  images: ArticleAssetRecord[];
}> {
  const images: ArticleAssetRecord[] = [];
  // Node mammoth reads `buffer` (ArrayBuffer works at runtime); browser build reads `arrayBuffer`.
  const mammothZipInput = { arrayBuffer, buffer: arrayBuffer } as { arrayBuffer: ArrayBuffer };
  const result = await mammoth.convertToHtml(
    mammothZipInput,
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const buffer = await image.read();
        const assetId = crypto.randomUUID();
        images.push({
          assetId,
          contentType: image.contentType,
          bytes: new Uint8Array(buffer),
        });
        return { src: `asset://${assetId}` };
      }),
    },
  );
  const contentJson = rewriteAssetImages(htmlToContentJson(result.value));
  return { contentJson, contentHtml: contentJsonToHtml(contentJson), images };
}