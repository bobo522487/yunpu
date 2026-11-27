import './articleSchema.happy-dom.ts';
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { generateHTML } from '@tiptap/core';
import { createArticleExtensions } from './createArticleExtensions.ts';

test('段落输出首行缩进和行距', () => {
  const html = generateHTML(
    {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { textIndent: '2em', lineHeight: '1.8' },
          content: [{ type: 'text', text: '谱序' }],
        },
      ],
    },
    createArticleExtensions(),
  );
  assert.match(html, /text-indent:\s*2em/);
  assert.match(html, /line-height:\s*1\.8/);
  assert.match(html, /谱序/);
});

test('图注节点输出 figure、assetId 和 figcaption', () => {
  const html = generateHTML(
    {
      type: 'doc',
      content: [
        {
          type: 'figureImage',
          attrs: {
            assetId: 'asset-1',
            caption: '宗祠旧影',
            widthPct: 70,
            align: 'center',
            src: null,
          },
        },
      ],
    },
    createArticleExtensions(),
  );
  assert.match(html, /<figure/);
  assert.match(html, /data-asset-id="asset-1"/);
  assert.match(html, /宗祠旧影/);
  assert.doesNotMatch(html, /data:/);
});

test('人物提及和夹注输出稳定属性', () => {
  const html = generateHTML(
    {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'personMention',
              attrs: { personId: 'p1', chartId: 'c1', fallbackName: '伯温', generation: 1 },
            },
            {
              type: 'inlineAnnotation',
              attrs: { mode: 'interlinear', citationId: 'cit-1', noteText: '待考' },
            },
          ],
        },
      ],
    },
    createArticleExtensions(),
  );
  assert.match(html, /data-person-id="p1"/);
  assert.match(html, /data-fallback-name="伯温"/);
  assert.match(html, /puwen-interlinear/);
  assert.match(html, /待考/);
});