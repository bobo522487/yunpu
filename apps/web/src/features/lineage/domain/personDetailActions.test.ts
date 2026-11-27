import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { PersonAliasRecord, PersonRecord } from '../types';
import {
  applyAliasDelete,
  applyAliasSave,
  formatVitalGenderText,
} from './personDetailActions.ts';

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

test('formatVitalGenderText 映射性别文案', () => {
  assert.equal(formatVitalGenderText('male'), '男');
  assert.equal(formatVitalGenderText('female'), '女');
  assert.equal(formatVitalGenderText('unknown'), '未知');
});

test('applyAliasSave 创建与编辑别名并同步 aliases', () => {
  const base = person({ id: 'p1', name: '伯温' });
  const created = applyAliasSave(
    base,
    { mode: 'create', initialAlias: { id: 'a1', type: '', surname: '', name: '' } },
    { id: 'a1', type: '字', surname: '陈', name: '文正' }
  );
  assert.equal(created.aliasItems?.length, 1);
  assert.ok((created.aliases?.length ?? 0) > 0);

  const edited = applyAliasSave(
    { ...base, aliasItems: created.aliasItems },
    {
      mode: 'edit',
      index: 0,
      initialAlias: created.aliasItems![0] as PersonAliasRecord,
    },
    { id: 'a1', type: '号', surname: '陈', name: '青田' }
  );
  assert.equal(edited.aliasItems?.[0]?.type, '号');
  assert.equal(edited.aliasItems?.[0]?.name, '青田');
});

test('applyAliasDelete 删空后清除 alias 字段', () => {
  const alias: PersonAliasRecord = {
    id: 'a1',
    type: '字',
    surname: '陈',
    name: '文正',
  };
  const base = person({
    id: 'p1',
    name: '伯温',
    aliasItems: [alias],
    aliases: ['字 陈文正'],
  });
  const next = applyAliasDelete(base, {
    mode: 'edit',
    index: 0,
    initialAlias: alias,
  });
  assert.equal(next.aliasItems, undefined);
  assert.equal(next.aliases, undefined);
});
