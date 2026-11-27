import '../extensions/articleSchema.happy-dom.ts';
import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { ArticleDocument } from '../types';
import { commitArticleContent } from './articleCommit.ts';

const existing: ArticleDocument = {
  id: 'a1',
  title: '旧题',
  subtitle: '',
  author: '',
  docType: 'custom',
  status: 'draft',
  privacy: 'clan',
  contentHtml: '<p>旧</p>',
  linkedPersonIds: [],
  linkedChartIds: [],
  citations: [],
  version: 3,
  wordCount: 1,
  updatedAt: '2024-01-01 00:00',
};

test('提交 AST 时派生 HTML 和字数，并递增版本', () => {
  const next = commitArticleContent(
    existing,
    'a1',
    {
      title: '新题',
      contentJson: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: '新正文' }],
          },
        ],
      },
    },
    '2026-11-24 12:00'
  );
  assert.equal(next.title, '新题');
  assert.equal(next.version, 4);
  assert.equal(next.wordCount, 3);
  assert.match(next.contentHtml, /新正文/);
  assert.equal(next.docType, 'custom');
});

test('提交时保留并更新审校状态', () => {
  const next = commitArticleContent(existing, 'a1', { status: 'review', privacy: 'editors' }, '2026-11-24 12:00');
  assert.equal(next.status, 'review');
  assert.equal(next.privacy, 'editors');
  assert.equal(next.version, 4);
});