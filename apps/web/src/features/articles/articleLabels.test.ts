import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  DOC_TYPE_LABELS,
  filterArticlesByStatus,
  PRIVACY_LABELS,
  STATUS_LABELS,
} from './articleLabels.ts';
import type { ArticleDocument } from './types';

test('文体、状态、隐私标签覆盖全部枚举', () => {
  assert.equal(DOC_TYPE_LABELS.preface, '谱序');
  assert.equal(DOC_TYPE_LABELS.rules, '凡例');
  assert.equal(DOC_TYPE_LABELS.origin, '姓氏源流');
  assert.equal(DOC_TYPE_LABELS.motto, '家训族规');
  assert.equal(DOC_TYPE_LABELS.biography, '人物传记');
  assert.equal(DOC_TYPE_LABELS.inscription, '碑记艺文');
  assert.equal(DOC_TYPE_LABELS.custom, '自定义篇目');
  assert.equal(STATUS_LABELS.draft, '草稿');
  assert.equal(STATUS_LABELS.review, '待校');
  assert.equal(STATUS_LABELS.approved, '定稿');
  assert.equal(PRIVACY_LABELS.public, '公开');
  assert.equal(PRIVACY_LABELS.clan, '族内');
  assert.equal(PRIVACY_LABELS.editors, '编委');
});

const docs = [
  { status: 'draft' },
  { status: 'approved' },
] as ArticleDocument[];

test('卷目筛选按审校状态过滤', () => {
  assert.equal(filterArticlesByStatus(docs, 'all').length, 2);
  assert.equal(filterArticlesByStatus(docs, 'approved').length, 1);
});