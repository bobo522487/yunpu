import '../extensions/articleSchema.happy-dom.ts';
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import {
  articleJsonToDocxBlocks,
  importDocxArrayBuffer,
  sanitizeArticleFileName,
  tiptapJsonToDocx,
} from './docxCodec.ts';

test('段落内联注记 待考 导出为（注：待考）', () => {
  const blocks = articleJsonToDocxBlocks({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: '序文' },
          { type: 'inlineAnnotation', attrs: { noteText: '待考' } },
        ],
      },
    ],
  });
  assert.match(blocks[0]?.text ?? '', /（注：待考）/);
});

test('文件名是 docx，块遍历保留标题和人物兜底名', () => {
  assert.equal(sanitizeArticleFileName('重修/族谱'), '重修_族谱.docx');
  const blocks = articleJsonToDocxBlocks({
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '谱序' }] },
      {
        type: 'paragraph',
        content: [
          {
            type: 'personMention',
            attrs: { personId: 'p1', chartId: 'c1', fallbackName: '伯温', generation: 1 },
          },
        ],
      },
    ],
  });
  assert.equal(blocks[0]?.text, '谱序');
  assert.equal(blocks[1]?.text, '伯温');
});

test('导出的 docx 是 zip，导入能读回标题', async () => {
  const source = new Document({
    sections: [
      {
        children: [
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('重修族谱序')] }),
          new Paragraph({ children: [new TextRun('吾族迁居。')] }),
        ],
      },
    ],
  });
  const packed = await Packer.toBuffer(source);
  assert.equal(packed[0], 0x50);
  assert.equal(packed[1], 0x4b);
  const arrayBuffer = packed.buffer.slice(
    packed.byteOffset,
    packed.byteOffset + packed.byteLength,
  ) as ArrayBuffer;
  const imported = await importDocxArrayBuffer(arrayBuffer);
  assert.match(imported.contentHtml, /重修族谱序/);
  assert.match(imported.contentHtml, /吾族迁居/);

  const exported = tiptapJsonToDocx(
    { title: '重修族谱序', subtitle: '卷首', author: '编委会', contentJson: imported.contentJson },
    { hallName: '德星堂' },
  );
  const out = await Packer.toBuffer(exported);
  assert.equal(out[0], 0x50);
});