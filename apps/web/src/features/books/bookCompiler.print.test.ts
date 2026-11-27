import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { BookEdition, BookRecord } from './types';
import { generateProofHtmlDocument } from './bookCompiler.ts';

const layoutSnapshot = {
  bindingStyle: 'thread',
  lineageStyle: 'su',
  paperSize: 'a4_210x297',
  borderStyle: 'double',
  fontFamily: 'song',
  density: 'standard',
  fishtailStyle: 'none',
  showHeaderName: true,
  showHallName: true,
  pageNumberStyle: 'arabic',
} as const;

const book = {
  id: 'book-test',
  bookName: '陈氏族谱',
  headerName: '',
  hallName: '',
  volumeNo: '卷一',
  editor: '编委会',
  compilationDate: '2026-11-24',
  sections: {
    preface: {
      code: 'preface',
      label: '',
      hint: '',
      collapsed: false,
      items: [],
    },
    body: { code: 'body', label: '', hint: '', collapsed: false, items: [] },
    lineage: {
      code: 'lineage',
      label: '',
      hint: '',
      collapsed: false,
      items: [],
    },
    appendix: {
      code: 'appendix',
      label: '',
      hint: '',
      collapsed: false,
      items: [],
    },
  },
  layoutConfig: layoutSnapshot,
  editions: [],
  updatedAt: '2026-11-24 12:00',
} as BookRecord;

const edition = {
  id: 'ed-test',
  createdAt: '2026-11-24 12:00',
  bindingStyle: 'thread',
  lineageStyle: 'su',
  paperSize: 'a4_210x297',
  pageCount: 0,
  memberCount: 0,
  wordCount: 0,
  printStatus: 'none',
  layoutSnapshot,
  pages: [],
} as BookEdition;

test('印刷稿声明 CSS 页码，校对稿不声明总页计数器', () => {
  const printHtml = generateProofHtmlDocument(book, edition, 'print');
  assert.match(printHtml, /@page/);
  assert.match(printHtml, /counter\(page\)/);
  assert.match(printHtml, /counter\(pages\)/);
  const proofHtml = generateProofHtmlDocument(book, edition, 'proof');
  assert.doesNotMatch(proofHtml, /counter\(pages\)/);
});