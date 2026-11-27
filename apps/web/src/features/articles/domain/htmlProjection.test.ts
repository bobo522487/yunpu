import '../extensions/articleSchema.happy-dom.ts';
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { contentJsonToHtml, htmlToContentJson } from './htmlProjection.ts';

test('旧 HTML 懒迁移成 doc，再投影回标题文本', () => {
  const json = htmlToContentJson('<h2>修谱缘起</h2><p>吾族迁居。</p>');
  assert.equal(json.type, 'doc');
  const html = contentJsonToHtml(json);
  assert.match(html, /修谱缘起/);
  assert.match(html, /吾族迁居/);
});