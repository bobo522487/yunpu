import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { PersonRecord } from '../types';
import { buildPersonSummary } from './personSummary.ts';

function person(partial: Partial<PersonRecord> & Pick<PersonRecord, 'id' | 'name'>): PersonRecord {
  return {
    branchId: 'chart-1',
    gender: 'male',
    status: 'deceased',
    generation: 1,
    fatherId: null,
    ...partial,
  };
}

test('传略摘要串起字号、生年和子女', () => {
  const summary = buildPersonSummary(
    person({ id: 'p1', name: '伯温', biography: '耕读传家' }),
    [],
    ['元亮'],
    [],
    '一世',
  );
  assert.match(summary, /一世/);
  assert.match(summary, /耕读传家/);
  assert.match(summary, /子：元亮/);
});

test('没有任何事实时给出待补行传', () => {
  const summary = buildPersonSummary(person({ id: 'p2', name: '某' }), [], [], [], '');
  assert.equal(summary, '谱系谱名录存录，待补行传。');
});