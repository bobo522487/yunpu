import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { ArticleDocument } from '../types';
import { createMemoryArticleTable } from './articleCasMemory.ts';

function doc(version: number, title: string): ArticleDocument {
  return {
    id: 'a1',
    title,
    docType: 'custom',
    status: 'draft',
    privacy: 'clan',
    contentHtml: `<p>${title}</p>`,
    linkedPersonIds: [],
    linkedChartIds: [],
    citations: [],
    version,
    wordCount: title.length,
    updatedAt: '',
  };
}

test('后写的旧版本不能覆盖新版本', () => {
  const table = createMemoryArticleTable();
  assert.equal(table.write(0, doc(1, '甲')).ok, true);
  const lost = table.write(1, doc(2, '乙'));
  assert.equal(lost.ok, true);
  const conflict = table.write(1, doc(2, '丙'));
  assert.equal(conflict.ok, false);
  if (!conflict.ok) assert.equal(conflict.server?.title, '乙');
  assert.equal(table.read('a1')?.title, '乙');
  assert.equal(table.read('a1')?.version, 2);
});