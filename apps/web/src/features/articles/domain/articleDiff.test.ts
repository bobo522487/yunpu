import assert from 'node:assert/strict';
import { test } from 'vitest';
import { diffArticleParagraphs } from './articleDiff.ts';

test('段落 diff 标出新增和删除', () => {
  const diff = diffArticleParagraphs(
    { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '甲' }] }] },
    { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '乙' }] }] },
  );
  assert.deepEqual(diff.map((item) => item.kind), ['removed', 'added']);
  assert.equal(diff[0]?.text, '甲');
  assert.equal(diff[1]?.text, '乙');
});