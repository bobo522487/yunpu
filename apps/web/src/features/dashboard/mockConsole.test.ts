import assert from 'node:assert/strict';
import { beforeEach, test } from 'vitest';
import { Window } from 'happy-dom';
import { ApiError } from '../../lib/api.ts';
import { DEMO_ACCOUNT } from '../auth/demoAccount.ts';
import { handleMockRequest } from '../auth/mockAuth.ts';

if (typeof globalThis.localStorage === 'undefined') {
  const win = new Window({ url: 'https://localhost/' });
  globalThis.window = win as unknown as Window & typeof globalThis.window;
  globalThis.localStorage = win.localStorage as unknown as Storage;
}

beforeEach(() => {
  localStorage.clear();
  handleMockRequest('/api/v1/auth/sign-in', {
    method: 'POST',
    body: { email: DEMO_ACCOUNT.email, password: DEMO_ACCOUNT.password },
  });
});

test('PATCH /api/v1/projects/:id increments version on match and rejects stale version with 409 VERSION_CONFLICT', () => {
  const created = handleMockRequest(
    '/api/v1/organizations/org-demo-personal/projects',
    {
      method: 'POST',
      body: { name: '版本测试谱牒' },
    },
  ) as { project: { id: string; version: number; name: string } };

  assert.equal(created.project.version, 1);

  const updated = handleMockRequest(
    `/api/v1/projects/${created.project.id}`,
    {
      method: 'PATCH',
      body: { name: '版本测试谱牒 v2', version: 1 },
    },
  ) as { project: { version: number; name: string } };

  assert.equal(updated.project.version, 2);
  assert.equal(updated.project.name, '版本测试谱牒 v2');

  assert.throws(
    () =>
      handleMockRequest(`/api/v1/projects/${created.project.id}`, {
        method: 'PATCH',
        body: { name: '陈旧覆盖', version: 1 },
      }),
    (err: unknown) =>
      err instanceof ApiError &&
      err.status === 409 &&
      err.code === 'VERSION_CONFLICT',
  );
});
