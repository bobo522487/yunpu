import assert from 'node:assert/strict';
import { test } from 'vitest';
import { applyArticleVersionCas } from './articleCas.ts';

test('版本一致时加一', () => {
  assert.deepEqual(applyArticleVersionCas({ version: 4 }, 4), { ok: true, nextVersion: 5 });
});

test('版本不一致时返回服务器版本且不前进', () => {
  assert.deepEqual(applyArticleVersionCas({ version: 5 }, 4), { ok: false, serverVersion: 5 });
});

test('文档不存在时服务器版本记为 0', () => {
  assert.deepEqual(applyArticleVersionCas(null, 1), { ok: false, serverVersion: 0 });
});