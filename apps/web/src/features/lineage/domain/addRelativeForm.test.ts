import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { PersonRecord } from '../types';
import {
  UNKNOWN_MOTHER_KEY,
  buildMotherOptionsForFather,
  getChildRelationSelectOptions,
  resolveChildRelationValue,
  resolvePersonFullName,
} from './addRelativeForm.ts';

function person(partial: Partial<PersonRecord> & Pick<PersonRecord, 'id' | 'name'>): PersonRecord {
  return {
    generation: 1,
    gender: 'male',
    status: 'living',
    fatherId: null,
    branchId: 'chart-1',
    biographyOrder: 1,
    ...partial,
  };
}

test('resolveChildRelationValue 按类别与性别映射关系称谓', () => {
  assert.equal(resolveChildRelationValue('biological', 'male'), '生子');
  assert.equal(resolveChildRelationValue('biological', 'female'), '生女');
  assert.equal(resolveChildRelationValue('foster', 'male'), '养子');
  assert.equal(resolveChildRelationValue('foster', 'female'), '养女');
  assert.equal(resolveChildRelationValue('step', 'male'), '继子');
  assert.equal(resolveChildRelationValue('step', 'female'), '继女');
  assert.equal(resolveChildRelationValue('adoptive_heir', 'male'), '过继');
  assert.equal(resolveChildRelationValue('adoptive_heir', 'female'), '过继');
});

test('getChildRelationSelectOptions 按性别返回选项文案', () => {
  const male = getChildRelationSelectOptions('male');
  assert.equal(male[0]?.label, '生子');
  assert.equal(male.find((o) => o.value === 'foster')?.label, '养子');

  const female = getChildRelationSelectOptions('female');
  assert.equal(female[0]?.label, '生女');
  assert.equal(female.find((o) => o.value === 'step')?.label, '继女');

  const unknown = getChildRelationSelectOptions('unknown');
  assert.equal(unknown[0]?.label, '生子女');
});

test('resolvePersonFullName 本宗与配偶姓氏规则', () => {
  assert.equal(
    resolvePersonFullName(person({ id: 'a', surname: '陈', name: '伯温' }), '陈'),
    '陈伯温'
  );
  assert.equal(
    resolvePersonFullName(
      person({ id: 'b', name: '王氏', spouseOfId: 'a', gender: 'female' }),
      '陈'
    ),
    '王氏'
  );
});

test('buildMotherOptionsForFather 已有不详配偶时复用，否则追加自动创建项', () => {
  const father = person({ id: 'f1', surname: '陈', name: '太祖' });
  const knownSpouse = person({
    id: 's1',
    name: '李氏',
    gender: 'female',
    spouseOfId: 'f1',
  });
  const withKnown = buildMotherOptionsForFather(father, [father, knownSpouse], '陈');
  assert.equal(withKnown.length, 2);
  assert.equal(withKnown[0]?.id, 's1');
  assert.equal(withKnown[1]?.key, UNKNOWN_MOTHER_KEY);
  assert.equal(withKnown[1]?.isAutoCreateUnknown, true);

  const unknownSpouse = person({
    id: 's2',
    name: '不详',
    gender: 'female',
    spouseOfId: 'f1',
  });
  const withUnknown = buildMotherOptionsForFather(
    father,
    [father, knownSpouse, unknownSpouse],
    '陈'
  );
  assert.equal(withUnknown.at(-1)?.id, 's2');
  assert.equal(withUnknown.at(-1)?.isAutoCreateUnknown, false);
});
