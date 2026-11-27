import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { ArticleDocument, ArticleRevision } from '../types';
import {
  appendArticleRevision,
  articleRevisionFromDocument,
  restoreArticleFromRevision,
} from './articleRevisions.ts';

test('同一文档版本两次记入修订时修订 id 不重复', () => {
  const doc = {
    id: 'a1',
    title: '题',
    docType: 'custom',
    status: 'draft',
    privacy: 'clan',
    contentHtml: '<p></p>',
    contentJson: { type: 'doc', content: [] },
    linkedPersonIds: [],
    linkedChartIds: [],
    citations: [],
    version: 3,
    wordCount: 0,
    updatedAt: 'now',
  } as ArticleDocument;
  const a = articleRevisionFromDocument(doc, '甲', '编者', 't1');
  const b = articleRevisionFromDocument(doc, '乙', '编者', 't2');
  assert.notEqual(a.id, b.id);
});

test('超过 30 份时丢掉最旧修订', () => {
  const existing: ArticleRevision[] = Array.from({ length: 30 }, (_, index) => ({
    id: `r${index}`,
    articleId: 'a1',
    version: index + 1,
    title: '题',
    status: 'draft',
    contentJson: { type: 'doc' },
    contentHtml: '<p></p>',
    wordCount: 0,
    authorName: '甲',
    createdAt: String(index),
  }));
  const next = appendArticleRevision(existing, { ...existing[0], id: 'new', version: 31, createdAt: '31' });
  assert.equal(next.length, 30);
  assert.equal(next[0]?.id, 'r1');
  assert.equal(next[29]?.id, 'new');
});

test('回滚复制修订正文并递增当前版本', () => {
  const current = {
    id: 'a1',
    title: '新题',
    docType: 'custom',
    status: 'approved',
    privacy: 'clan',
    contentHtml: '<p>新</p>',
    contentJson: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '新' }] }] },
    linkedPersonIds: [],
    linkedChartIds: [],
    citations: [],
    version: 8,
    wordCount: 1,
    updatedAt: 'now',
  } as ArticleDocument;
  const revision = {
    id: 'r1',
    articleId: 'a1',
    version: 3,
    title: '旧题',
    status: 'draft',
    contentJson: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '旧' }] }] },
    contentHtml: '<p>旧</p>',
    wordCount: 1,
    authorName: '甲',
    createdAt: 'then',
  } as ArticleRevision;
  const restored = restoreArticleFromRevision(current, revision, 'later');
  assert.equal(restored.title, '旧题');
  assert.equal(restored.status, 'draft');
  assert.equal(restored.version, 9);
  assert.equal(restored.contentJson, revision.contentJson);
});