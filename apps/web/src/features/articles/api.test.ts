import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'vitest';
import { ApiError, resetApiTransportForTests } from '../../lib/api.ts';
import { saveArticleRemote } from './api.ts';

const originalFetch = globalThis.fetch;

beforeEach(() => {
  resetApiTransportForTests();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetApiTransportForTests();
});

test('200 信封解析出已保存的服务器文档', async () => {
  const saved = { id: 'a1', version: 5, title: '已保存' };
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ ok: true, data: { article: saved } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch;

  const result = await saveArticleRemote('/api/v1/articles/a1', {
    articleId: 'a1',
    expectedVersion: 4,
    article: saved as never,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.article.version, 5);
    assert.equal(result.article.title, '已保存');
  }
});

test('409 信封解析出服务器冲突文档', async () => {
  const server = { id: 'a1', version: 5, title: '服务器' };
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        ok: false,
        code: 'CONFLICT',
        message: '版本冲突',
        details: { article: server },
      }),
      {
        status: 409,
        headers: { 'content-type': 'application/json' },
      },
    )) as typeof fetch;

  const result = await saveArticleRemote('/api/v1/articles/a1', {
    articleId: 'a1',
    expectedVersion: 4,
    article: server as never,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 409);
    assert.equal(result.server.version, 5);
  }
});

test('非 409 错误会透传 ApiError 而非静默吞掉', async () => {
  const doc = { id: 'a1', version: 4, title: '草稿' };
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({ ok: false, code: 'INTERNAL', message: '服务异常' }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' },
      },
    )) as typeof fetch;

  await assert.rejects(
    () =>
      saveArticleRemote('/api/v1/articles/a1', {
        articleId: 'a1',
        expectedVersion: 4,
        article: doc as never,
      }),
    (err: unknown) => err instanceof ApiError && err.status === 500,
  );
});
