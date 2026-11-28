import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'vitest';
import { Window } from 'happy-dom';
import { resetApiTransportForTests } from '../../lib/api.ts';
import { useWorkspaceStore } from '../../store/useWorkspaceStore.ts';
import { useAuthStore } from './useAuthStore.ts';

if (typeof globalThis.window === 'undefined') {
  const win = new Window({ url: 'https://localhost/' });
  globalThis.window = win as unknown as Window & typeof globalThis.window;
  globalThis.CustomEvent = win.CustomEvent as unknown as typeof CustomEvent;
} else if (typeof globalThis.CustomEvent === 'undefined') {
  globalThis.CustomEvent = (globalThis.window as unknown as { CustomEvent: typeof CustomEvent }).CustomEvent;
}

const originalFetch = globalThis.fetch;

function jsonEnvelope(data: unknown, status = 200) {
  return new Response(JSON.stringify({ ok: true, data }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function errorEnvelope(code: string, message: string, status: number) {
  return new Response(JSON.stringify({ ok: false, code, message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function resetStore() {
  useAuthStore.setState({
    status: 'loading',
    user: null,
    defaultOrganization: null,
    onboarding: false,
    error: null,
    bootstrapped: false,
  });
}

beforeEach(() => {
  resetApiTransportForTests();
  resetStore();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetApiTransportForTests();
  resetStore();
});

test('bootstrap fetches session once and is idempotent on subsequent calls', async () => {
  let fetchCount = 0;
  globalThis.fetch = (async () => {
    fetchCount += 1;
    return jsonEnvelope({
      user: { id: 'u-1', email: 'test@example.com', name: 'Test User' },
      defaultOrganization: { id: 'org-1', name: '陈氏谱牒', role: 'admin', isOwner: true },
      onboarding: false,
    });
  }) as typeof fetch;

  await useAuthStore.getState().bootstrap();
  await useAuthStore.getState().bootstrap();

  assert.equal(fetchCount, 1);
  const state = useAuthStore.getState();
  assert.equal(state.bootstrapped, true);
  assert.equal(state.status, 'authenticated');
  assert.equal(state.user?.email, 'test@example.com');
  assert.equal(state.defaultOrganization?.id, 'org-1');
  assert.equal(state.onboarding, false);
});

test('refreshSession transitions to anonymous on null user and captures error on failure', async () => {
  globalThis.fetch = (async () =>
    jsonEnvelope({
      user: null,
      defaultOrganization: null,
      onboarding: false,
    })) as typeof fetch;

  await useAuthStore.getState().refreshSession();
  assert.equal(useAuthStore.getState().status, 'anonymous');
  assert.equal(useAuthStore.getState().user, null);
  assert.equal(useAuthStore.getState().error, null);

  globalThis.fetch = (async () =>
    errorEnvelope('INTERNAL', '服务暂不可用', 500)) as typeof fetch;

  await useAuthStore.getState().refreshSession();
  assert.equal(useAuthStore.getState().status, 'anonymous');
  assert.equal(useAuthStore.getState().error, '服务暂不可用');
});

test('signIn populates session including onboarding flag and surfaces errors on failure', async () => {
  globalThis.fetch = (async () =>
    errorEnvelope('INVALID_CREDENTIALS', '邮箱或密码不正确', 401)) as typeof fetch;

  await assert.rejects(() => useAuthStore.getState().signIn('a@b.com', 'wrong'));
  assert.equal(useAuthStore.getState().status, 'loading');
  assert.equal(useAuthStore.getState().error, '邮箱或密码不正确');

  globalThis.fetch = (async () =>
    jsonEnvelope({
      user: { id: 'u-2', email: 'onboard@example.com', name: 'Onboard' },
      defaultOrganization: null,
      onboarding: true,
    })) as typeof fetch;

  const payload = await useAuthStore.getState().signIn('onboard@example.com', 'pass1234');
  assert.equal(payload.onboarding, true);
  assert.equal(useAuthStore.getState().status, 'authenticated');
  assert.equal(useAuthStore.getState().onboarding, true);
  assert.equal(useAuthStore.getState().defaultOrganization, null);
  assert.equal(useAuthStore.getState().error, null);
});

test('signUp authenticates user with default organization and clears onboarding', async () => {
  globalThis.fetch = (async () =>
    jsonEnvelope({
      user: { id: 'u-3', email: 'new@example.com', name: 'new' },
      defaultOrganization: { id: 'org-3', name: 'new 的工作区', role: 'admin', isOwner: true },
      invite: { accepted: true },
    })) as typeof fetch;

  const payload = await useAuthStore.getState().signUp('new@example.com', 'password123', 'inv-1');
  assert.equal(payload.invite?.accepted, true);
  assert.equal(useAuthStore.getState().status, 'authenticated');
  assert.equal(useAuthStore.getState().onboarding, false);
  assert.equal(useAuthStore.getState().defaultOrganization?.id, 'org-3');
  assert.equal(useAuthStore.getState().error, null);
});

test('signOut always resets store to anonymous even when signOutRequest rejects', async () => {
  useAuthStore.setState({
    status: 'authenticated',
    user: { id: 'u-1', email: 'a@b.com', name: 'A' },
    defaultOrganization: { id: 'org-1', name: 'Org', role: 'admin', isOwner: true },
    onboarding: false,
    error: 'stale error',
  });

  globalThis.fetch = (async () =>
    errorEnvelope('INTERNAL', 'network glitch', 500)) as typeof fetch;

  await assert.rejects(() => useAuthStore.getState().signOut());
  const state = useAuthStore.getState();
  assert.equal(state.status, 'anonymous');
  assert.equal(state.user, null);
  assert.equal(state.defaultOrganization, null);
  assert.equal(state.onboarding, false);
  assert.equal(state.error, null);
});

test('markUnauthorized sets session-expired error only when transitioning from authenticated', () => {
  useAuthStore.setState({ status: 'anonymous', user: null, error: null });
  useAuthStore.getState().markUnauthorized();
  assert.equal(useAuthStore.getState().status, 'anonymous');
  assert.equal(useAuthStore.getState().error, null);

  useAuthStore.setState({
    status: 'authenticated',
    user: { id: 'u-1', email: 'a@b.com', name: 'A' },
    defaultOrganization: { id: 'org-1', name: 'Org', role: 'admin', isOwner: true },
    onboarding: false,
    error: null,
  });
  useAuthStore.getState().markUnauthorized();
  // A second concurrent 401 must not wipe out the expiry message.
  useAuthStore.getState().markUnauthorized();
  assert.equal(useAuthStore.getState().status, 'anonymous');
  assert.equal(useAuthStore.getState().user, null);
  assert.equal(useAuthStore.getState().defaultOrganization, null);
  assert.match(useAuthStore.getState().error ?? '', /登录状态已失效/);
});

test('setUserName updates active user name and clearError resets error', () => {
  useAuthStore.getState().setUserName('Nobody');
  assert.equal(useAuthStore.getState().user, null);

  useAuthStore.setState({
    user: { id: 'u-1', email: 'a@b.com', name: 'Old' },
    error: 'some error',
  });
  useAuthStore.getState().setUserName('New Name');
  assert.equal(useAuthStore.getState().user?.name, 'New Name');

  useAuthStore.getState().clearError();
  assert.equal(useAuthStore.getState().error, null);
});

test('signOut and markUnauthorized reset tenant workspace state to prevent cross-account leaks', async () => {
  useWorkspaceStore.setState({
    activeOrganizationId: 'org-1',
    activeProjectId: 'proj-1',
    zibeiByProject: { 'proj-1': ['仁', '义'] },
  });
  useAuthStore.setState({
    status: 'authenticated',
    user: { id: 'u-1', email: 'a@b.com', name: 'A' },
    defaultOrganization: { id: 'org-1', name: '甲家族', role: 'admin', isOwner: true },
    onboarding: false,
    error: null,
  });

  globalThis.fetch = (async () =>
    jsonEnvelope({ signedOut: true })) as typeof fetch;

  await useAuthStore.getState().signOut();
  let ws = useWorkspaceStore.getState();
  assert.equal(ws.activeOrganizationId, '');
  assert.equal(ws.activeProjectId, '');
  assert.deepEqual(ws.zibeiByProject, {});

  useWorkspaceStore.setState({
    activeOrganizationId: 'org-2',
    activeProjectId: 'proj-2',
  });
  useAuthStore.setState({
    status: 'authenticated',
    user: { id: 'u-2', email: 'b@b.com', name: 'B' },
    defaultOrganization: { id: 'org-2', name: '乙家族', role: 'admin', isOwner: true },
    onboarding: false,
    error: null,
  });

  useAuthStore.getState().markUnauthorized();
  ws = useWorkspaceStore.getState();
  assert.equal(ws.activeOrganizationId, '');
  assert.equal(ws.activeProjectId, '');
});
