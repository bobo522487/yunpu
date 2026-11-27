import assert from 'node:assert/strict';
import { test } from 'vitest';
import { migrateArticlesV1ToV2 } from './migrateArticles.ts';

test('v1 谱文补齐默认字段且不生成 contentJson', () => {
  const next = migrateArticlesV1ToV2({
    treesByProject: { p1: [{ id: 'article-preface', type: 'article' }] },
    selectedNodeIdByProject: { p1: 'article-preface' },
    articlesByKey: {
      'p1::article-preface': {
        id: 'article-preface',
        title: '重修族谱序',
        contentHtml: '<p>旧稿</p>',
        wordCount: 2,
        updatedAt: '2024-01-01 00:00',
      },
    },
  });

  const doc = next.articlesByKey['p1::article-preface'];
  assert.equal(doc.docType, 'custom');
  assert.equal(doc.status, 'draft');
  assert.equal(doc.privacy, 'clan');
  assert.deepEqual(doc.linkedPersonIds, []);
  assert.deepEqual(doc.linkedChartIds, []);
  assert.deepEqual(doc.citations, []);
  assert.equal(doc.version, 1);
  assert.equal(doc.contentHtml, '<p>旧稿</p>');
  assert.equal(doc.wordCount, 2);
  assert.equal(doc.contentJson, undefined);
  assert.equal(next.selectedNodeIdByProject.p1, 'article-preface');
});

test('缺省快照不会抛错', () => {
  const next = migrateArticlesV1ToV2(null);
  assert.deepEqual(next.articlesByKey, {});
  assert.deepEqual(next.treesByProject, {});
});