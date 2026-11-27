import assert from 'node:assert/strict';
import { test } from 'vitest';
import { filterSlashCommands } from './slashCommands.ts';

test('斜杠命令按标题和关键字过滤', () => {
  assert.equal(filterSlashCommands('夹注')[0]?.id, 'interlinear');
  assert.equal(filterSlashCommands('表格')[0]?.id, 'table');
  assert.ok(filterSlashCommands('').length >= 6);
});