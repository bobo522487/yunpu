import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'vitest';
import { Window } from 'happy-dom';
import { ApiError, resetApiTransportForTests } from '../../lib/api.ts';
import {
  acceptInviteRequest,
  createOrganizationRequest,
  fetchSession,
  signInRequest,
  signOutRequest,
  signUpRequest,
} from './api.ts';

const win = new Window({ url: 'https://localhost/' });
globalThis.window = win as unknown as Window & typeof globalThis.window;
globalThis.CustomEvent = win.CustomEvent as unknown as typeof CustomEvent;

const originalFetch = globalThis.fetch;

beforeEach(() => {
  resetApiTransportForTests();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetApiTransportForTests();
});

test('fetchSession requests GET /api/v1/auth/session with credentials and unwraps envelope', async () => {
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = String(input);
    capturedInit = init;
    return new Response(
      JSON.stringify({
        ok: true,
        data: {
          user: { id: 'u1', email: 'a@example.com', name: 'Alice' },
          defaultOrganization: { id: 'o1', name: 'Org 1', role: 'owner', isOwner: true },
          onboarding: false,
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;

  const session = await fetchSession();
  assert.equal(capturedUrl, '/api/v1/auth/session');
  assert.equal(capturedInit?.method, 'GET');
  assert.equal(capturedInit?.credentials, 'include');
  assert.equal(session.user?.email, 'a@example.com');
  assert.equal(session.onboarding, false);
});

test('signInRequest and signUpRequest send JSON payloads and omit empty inviteToken', async () => {
  const calls: Array<{ url: string; method?: string; body?: string; contentType?: string }> = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = init?.headers as Record<string, string> | undefined;
    calls.push({
      url: String(input),
      method: init?.method,
      body: typeof init?.body === 'string' ? init.body : undefined,
      contentType: headers?.['content-type'],
    });
    return new Response(
      JSON.stringify({
        ok: true,
        data: {
          user: { id: 'u1', email: 'u@example.com', name: 'u' },
          defaultOrganization: { id: 'o1', name: 'Workspace', role: 'owner', isOwner: true },
          onboarding: false,
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;

  await signInRequest('u@example.com', 'secret123');
  await signUpRequest('new@example.com', 'secret123');
  await signUpRequest('invited@example.com', 'secret123', 'inv-999');

  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, '/api/v1/auth/sign-in');
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].contentType, 'application/json');
  assert.deepEqual(JSON.parse(calls[0].body!), { email: 'u@example.com', password: 'secret123' });

  assert.equal(calls[1].url, '/api/v1/auth/sign-up');
  assert.deepEqual(JSON.parse(calls[1].body!), { email: 'new@example.com', password: 'secret123' });

  assert.equal(calls[2].url, '/api/v1/auth/sign-up');
  assert.deepEqual(JSON.parse(calls[2].body!), {
    email: 'invited@example.com',
    password: 'secret123',
    inviteToken: 'inv-999',
  });
});

test('signOutRequest, createOrganizationRequest, and acceptInviteRequest hit expected endpoints', async () => {
  const urls: string[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    urls.push(String(input));
    return new Response(
      JSON.stringify({ ok: true, data: { signedOut: true } }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;

  await signOutRequest();
  await createOrganizationRequest('陈氏宗亲会');
  await acceptInviteRequest('tok-123');

  assert.deepEqual(urls, [
    '/api/v1/auth/sign-out',
    '/api/v1/organizations',
    '/api/v1/invites/accept',
  ]);
});

test('401 on non-sign-in endpoints dispatches yunpu:unauthorized, while sign-in 401 does not', async () => {
  let unauthorizedEvents = 0;
  const listener = () => {
    unauthorizedEvents += 1;
  };
  window.addEventListener('yunpu:unauthorized', listener);

  try {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ ok: false, code: 'INVALID_CREDENTIALS', message: '邮箱或密码不正确' }),
        { status: 401, headers: { 'content-type': 'application/json' } },
      )) as typeof fetch;

    await assert.rejects(
      () => signInRequest('bad@example.com', 'wrong'),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 401);
        assert.equal(error.code, 'INVALID_CREDENTIALS');
        return true;
      },
    );
    assert.equal(unauthorizedEvents, 0);

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ ok: false, code: 'UNAUTHENTICATED', message: '会话已过期' }),
        { status: 401, headers: { 'content-type': 'application/json' } },
      )) as typeof fetch;

    await assert.rejects(
      () => createOrganizationRequest('测试组织'),
      (error: unknown) => error instanceof ApiError && error.status === 401,
    );
    assert.equal(unauthorizedEvents, 1);
  } finally {
    window.removeEventListener('yunpu:unauthorized', listener);
  }
});

test('non-JSON proxy response throws ApiError with UNREACHABLE', async () => {
  globalThis.fetch = (async () =>
    new Response('<html>502 Bad Gateway</html>', {
      status: 502,
      headers: { 'content-type': 'text/html' },
    })) as typeof fetch;

  await assert.rejects(
    () => fetchSession(),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.code, 'UNREACHABLE');
      assert.equal(error.status, 0);
      return true;
    },
  );
});

test('stale pre-login 401 arriving after signInRequest succeeds does not dispatch yunpu:unauthorized', async () => {
  let unauthorizedEvents = 0;
  const listener = () => {
    unauthorizedEvents += 1;
  };
  window.addEventListener('yunpu:unauthorized', listener);

  let releaseStaleRequest!: () => void;
  const staleGate = new Promise<void>((resolve) => {
    releaseStaleRequest = resolve;
  });

  try {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/v1/auth/sign-in') {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              user: { id: 'u1', email: 'u@example.com', name: 'u' },
              defaultOrganization: null,
              onboarding: true,
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      await staleGate;
      return new Response(
        JSON.stringify({ ok: false, code: 'UNAUTHENTICATED', message: 'stale' }),
        { status: 401, headers: { 'content-type': 'application/json' } },
      );
    }) as typeof fetch;

    const stalePromise = createOrganizationRequest('Old Request');
    await signInRequest('u@example.com', 'secret123');
    releaseStaleRequest();

    await assert.rejects(
      () => stalePromise,
      (err: unknown) => err instanceof ApiError && err.status === 401,
    );
    assert.equal(unauthorizedEvents, 0);
  } finally {
    window.removeEventListener('yunpu:unauthorized', listener);
  }
});
