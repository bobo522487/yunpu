import assert from 'node:assert/strict';
import { test } from 'vitest';
import { toCreateProjectPayload } from './projectPayload.ts';

const base = {
  name: '义门陈氏',
  description: '',
  colorTheme: 'sky' as const,
  surname: '陈',
  ancestor: '陈旺',
  hallName: '义门',
  originText: '江西省/九江市/德安县',
  projectLevel: 5,
};

test('编辑保存不把 planning 收成 in_progress', () => {
  const payload = toCreateProjectPayload({ ...base, status: 'planning' });
  assert.equal(payload.status, 'planning');
});

test('completed 保持 completed', () => {
  const payload = toCreateProjectPayload({ ...base, status: 'completed' });
  assert.equal(payload.status, 'completed');
});