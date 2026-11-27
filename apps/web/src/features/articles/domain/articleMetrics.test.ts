import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { JSONContent } from '@tiptap/core';
import { extractArticleMetrics, readingTimeLabel } from './articleMetrics.ts';

const doc: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: '修谱缘起' }],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: '吾族 ' },
        {
          type: 'personMention',
          attrs: { personId: 'p1', chartId: 'c1', fallbackName: '伯温', generation: 1 },
        },
        { type: 'text', text: '迁居。' },
      ],
    },
    {
      type: 'figureImage',
      attrs: { assetId: 'img1', caption: '宗祠', widthPct: 80, align: 'center' },
    },
  ],
};

test('extractArticleMetrics 统计汉字、标题、人物和支派', () => {
  const metrics = extractArticleMetrics(doc);
  assert.equal(metrics.wordCount, '修谱缘起吾族伯温迁居。宗祠'.length);
  assert.equal(metrics.paragraphCount, 3);
  assert.deepEqual(metrics.headings, [{ level: 2, text: '修谱缘起' }]);
  assert.deepEqual(metrics.linkedPersonIds, ['p1']);
  assert.deepEqual(metrics.linkedChartIds, ['c1']);
  assert.equal(metrics.readingMinutes, 1);
});

test('空文档是 0，而不是伪造 1 段', () => {
  const metrics = extractArticleMetrics({ type: 'doc', content: [] });
  assert.equal(metrics.wordCount, 0);
  assert.equal(metrics.paragraphCount, 0);
  assert.equal(readingTimeLabel(0), '预计阅读 0 分钟');
});

test('阅读时长按 300 字一分钟向上取整', () => {
  assert.equal(readingTimeLabel(301), '预计阅读 2 分钟');
});

test('inlineAnnotation 的 noteText 计入字数', () => {
  const metrics = extractArticleMetrics({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'inlineAnnotation',
            attrs: { mode: 'interlinear', noteText: '待考' },
          },
        ],
      },
    ],
  });
  assert.equal(metrics.wordCount, 2);
});
