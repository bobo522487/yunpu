import assert from 'node:assert/strict';
import { afterEach, test } from 'vitest';
import {
  ApiError,
  apiRequest,
  apiUpload,
  resetApiTransportForTests,
} from './api.ts';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetApiTransportForTests();
});

test('apiRequest 解包后端 JSON 信封并返回 data', async () => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ ok: true, data: { name: '陈氏宗谱' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch;

  const data = await apiRequest<{ name: string }>('/api/v1/projects/p1');
  assert.deepEqual(data, { name: '陈氏宗谱' });
});

test('apiRequest 将业务错误信封映射为 ApiError，并将非 JSON / 断网映射为 UNREACHABLE', async () => {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({ ok: false, code: 'VERSION_CONFLICT', message: '版本冲突' }),
      { status: 409, headers: { 'content-type': 'application/json' } },
    )) as typeof fetch;

  await assert.rejects(
    () => apiRequest('/api/v1/projects/p1', { method: 'PATCH', body: { version: 1 } }),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.code, 'VERSION_CONFLICT');
      assert.equal(error.status, 409);
      return true;
    },
  );

  globalThis.fetch = (async () => {
    throw new Error('connect ECONNREFUSED');
  }) as typeof fetch;

  await assert.rejects(
    () => apiRequest('/api/v1/organizations'),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.code, 'UNREACHABLE');
      return true;
    },
  );
});

test('apiUpload 发送二进制 Blob 与对应 Content-Type 并解析返回结果', async () => {
  let seenContentType = '';
  let seenMethod = '';
  globalThis.fetch = (async (_input, init) => {
    seenMethod = init?.method ?? '';
    seenContentType =
      (init?.headers as Record<string, string>)['content-type'] ?? '';
    return new Response(
      JSON.stringify({
        ok: true,
        data: { key: 'avatar.jpg', url: '/api/v1/projects/p1/media/avatar.jpg' },
      }),
      { status: 201, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;

  const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
  const result = await apiUpload<{ key: string; url: string }>(
    '/api/v1/projects/p1/media',
    blob,
    'image/jpeg',
  );
  assert.equal(seenMethod, 'POST');
  assert.equal(seenContentType, 'image/jpeg');
  assert.equal(result.key, 'avatar.jpg');
});
