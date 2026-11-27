import '../extensions/articleSchema.happy-dom.ts';
import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { JSONContent } from '@tiptap/core';
import type { PersonRecord } from '../../lineage/types';
import { htmlToContentJson } from './htmlProjection.ts';
import {
  buildBiographyMentionHtml,
  filterPersonMentions,
  resolvePersonMentionLabel,
} from './personMention.ts';

function findPersonMention(json: JSONContent): JSONContent | null {
  if (json.type === 'personMention') return json;
  for (const child of json.content ?? []) {
    const found = findPersonMention(child);
    if (found) return found;
  }
  return null;
}

const people = [
  { personId: 'p1', chartId: 'c1', name: '陈伯温', generation: 1 },
  { personId: 'p2', chartId: 'c1', name: '陈元亮', generation: 2 },
];

test('按姓名过滤并限制 8 条', () => {
  assert.equal(filterPersonMentions('伯温', people)[0]?.personId, 'p1');
  assert.equal(filterPersonMentions('', people).length, 2);
});

test('改名读最新姓名，删人退回 fallbackName', () => {
  assert.deepEqual(resolvePersonMentionLabel({ personId: 'p1', fallbackName: '伯温' }, [{ id: 'p1', name: '陈伯温' }]), {
    text: '陈伯温',
    missing: false,
  });
  assert.deepEqual(resolvePersonMentionLabel({ personId: 'gone', fallbackName: '伯温' }, []), {
    text: '伯温',
    missing: true,
  });
});

test('传略 HTML 带有 personMention 属性', () => {
  const person = {
    id: 'p1',
    branchId: 'c1',
    name: '伯温',
    gender: 'male',
    status: 'deceased',
    generation: 1,
    fatherId: null,
  } as PersonRecord;
  const html = buildBiographyMentionHtml(person, 'c1', '一世。耕读传家。');
  assert.match(html, /data-person-id="p1"/);
  assert.match(html, /data-chart-id="c1"/);
  assert.match(html, /data-fallback-name="伯温"/);
  assert.match(html, /data-generation="1"/);
  assert.match(html, /耕读传家/);
});

test('buildBiographyMentionHtml 往返保留人物提及属性', () => {
  const person = {
    id: 'p1',
    branchId: 'c1',
    name: '伯温',
    gender: 'male',
    status: 'deceased',
    generation: 1,
    fatherId: null,
  } as PersonRecord;
  const html = buildBiographyMentionHtml(person, 'c1', '一世。耕读传家。');
  const json = htmlToContentJson(html);
  const mention = findPersonMention(json);
  assert.ok(mention?.attrs);
  assert.equal(mention.attrs.personId, 'p1');
  assert.equal(mention.attrs.chartId, 'c1');
  assert.equal(mention.attrs.fallbackName, '伯温');
  assert.equal(mention.attrs.generation, 1);
  assert.equal(json.type, 'doc');
  assert.match(html, /伯温/);
});