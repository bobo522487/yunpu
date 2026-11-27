import assert from 'node:assert/strict';
import { test } from 'vitest';
import { nextArticleTheme } from './articleTheme.ts';

test('主题只在 modern 和 classic 之间切换', () => {
  assert.equal(nextArticleTheme('modern'), 'classic');
  assert.equal(nextArticleTheme('classic'), 'modern');
});