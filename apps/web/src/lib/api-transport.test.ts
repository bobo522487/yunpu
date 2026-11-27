import assert from 'node:assert/strict';
import { afterEach, test } from 'vitest';
import {
  ApiError,
  apiRequest,
  registerMockHandler,
  resetApiTransportForTests,
} from './api.ts';

afterEach(() => {
  resetApiTransportForTests();
});

test('direct mock 不发网络请求', async () => {
  let fetched = false;
  globalThis.fetch = (async () => {
    fetched = true;
    throw new Error('不应调用 fetch');
  }) as typeof fetch;

  registerMockHandler(() => ({ ok: true }), { direct: true });
  const data = await apiRequest<{ ok: boolean }>('/api/v1/auth/session');
  assert.deepEqual(data, { ok: true });
  assert.equal(fetched, false);
});

test('注册了非 direct handler 时，网络失败仍抛 UNREACHABLE', async () => {
  globalThis.fetch = (async () => {
    throw new Error('connect ECONNREFUSED');
  }) as typeof fetch;

  registerMockHandler(() => ({ fromMock: true }), { direct: false });
  await assert.rejects(
    () => apiRequest('/api/v1/organizations'),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.code, 'UNREACHABLE');
      return true;
    },
  );
});