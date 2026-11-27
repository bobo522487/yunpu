import assert from 'node:assert/strict';
import { test } from 'vitest';
import { readFileSync } from 'node:fs';

test('谱文 SQL 契约包含三张表、RLS 和 CAS', () => {
  const sql = readFileSync(new URL('./articles.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE TABLE articles/);
  assert.match(sql, /CREATE TABLE article_person_links/);
  assert.match(sql, /CREATE TABLE article_revisions/);
  assert.match(sql, /FORCE ROW LEVEL SECURITY/);
  assert.match(sql, /current_setting\('app\.tenant_id'\)::uuid/);
  assert.match(sql, /version = version \+ 1/);
  assert.match(sql, /AND version = \$5/);
});