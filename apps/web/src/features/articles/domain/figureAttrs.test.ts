import assert from 'node:assert/strict';
import { test } from 'vitest';
import { normalizeFigureAttrs } from './figureAttrs.ts';
import { persistableContentJson } from './persistableContent.ts';

test('拒绝 Base64，并夹取宽度', () => {
  assert.throws(
    () => normalizeFigureAttrs({ assetId: 'a1', src: 'data:image/png;base64,aaaa' }),
    /Base64/,
  );
  const attrs = normalizeFigureAttrs({
    assetId: 'a1',
    caption: '碑拓',
    widthPct: 140,
    align: 'left',
  });
  assert.equal(attrs.widthPct, 100);
  assert.equal(attrs.align, 'left');
});

test('落库 JSON 去掉 blob 和 data src', () => {
  const next = persistableContentJson({
    type: 'doc',
    content: [
      {
        type: 'figureImage',
        attrs: { assetId: 'a1', src: 'blob:http://local/1', caption: '图' },
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: '正文' }],
      },
    ],
  });
  assert.equal(next.content?.[0]?.attrs?.src, null);
  assert.equal(next.content?.[0]?.attrs?.assetId, 'a1');
  assert.equal(next.content?.[1]?.content?.[0]?.text, '正文');
});