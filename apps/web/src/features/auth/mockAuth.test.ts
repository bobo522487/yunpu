import assert from 'node:assert/strict';
import { beforeEach, test } from 'vitest';
import { Window } from 'happy-dom';
import { ApiError } from '../../lib/api.ts';
import { DEMO_ACCOUNT } from './demoAccount.ts';
import { handleMockRequest, loadDb } from './mockAuth.ts';

if (typeof globalThis.localStorage === 'undefined') {
  const win = new Window({ url: 'https://localhost/' });
  globalThis.window = win as unknown as Window & typeof globalThis.window;
  globalThis.localStorage = win.localStorage as unknown as Storage;
}

const MOCK_AUTH_STORAGE_KEY = 'nocoapp:mock-auth:v2';

beforeEach(() => {
  localStorage.clear();
});

test('loadDb seeds demo account and recovers cleanly from corrupted localStorage', () => {
  localStorage.setItem(MOCK_AUTH_STORAGE_KEY, '{not-valid-json');
  const db = loadDb();
  assert.equal(db.users.length, 1);
  assert.equal(db.users[0].email, DEMO_ACCOUNT.email);
  assert.equal(db.organizations[DEMO_ACCOUNT.id].length, 2);
  assert.equal(db.sessionUserId, null);
});

test('mockAuth handles sign-in, session check, and sign-out', () => {
  const anon = handleMockRequest('/api/v1/auth/session', { method: 'GET' }) as {
    user: unknown;
    onboarding: boolean;
  };
  assert.equal(anon.user, null);
  assert.equal(anon.onboarding, false);

  assert.throws(
    () =>
      handleMockRequest('/api/v1/auth/sign-in', {
        method: 'POST',
        body: { email: DEMO_ACCOUNT.email, password: 'wrong-password' },
      }),
    (err: unknown) => err instanceof ApiError && err.status === 401 && err.code === 'INVALID_CREDENTIALS',
  );

  const signedIn = handleMockRequest('/api/v1/auth/sign-in', {
    method: 'POST',
    body: { email: `  ${DEMO_ACCOUNT.email.toUpperCase()}  `, password: DEMO_ACCOUNT.password },
  }) as { user: { email: string }; defaultOrganization: { id: string } | null; onboarding: boolean };
  assert.equal(signedIn.user.email, DEMO_ACCOUNT.email);
  assert.equal(signedIn.defaultOrganization?.id, 'org-demo-personal');
  assert.equal(signedIn.onboarding, false);

  const session = handleMockRequest('/api/v1/auth/session', { method: 'GET' }) as {
    user: { email: string } | null;
  };
  assert.equal(session.user?.email, DEMO_ACCOUNT.email);

  const out = handleMockRequest('/api/v1/auth/sign-out', { method: 'POST' }) as { signedOut: boolean };
  assert.equal(out.signedOut, true);
  assert.equal(
    (handleMockRequest('/api/v1/auth/session', { method: 'GET' }) as { user: unknown }).user,
    null,
  );
});

test('mockAuth handles sign-up, duplicate email 409, org creation, and invite acceptance', () => {
  const created = handleMockRequest('/api/v1/auth/sign-up', {
    method: 'POST',
    body: { email: '  NewUser@Example.COM ', password: 'password123' },
  }) as { user: { email: string; name: string }; defaultOrganization: { isOwner: boolean }; invite?: unknown };

  assert.equal(created.user.email, 'newuser@example.com');
  assert.equal(created.user.name, 'newuser');
  assert.equal(created.defaultOrganization.isOwner, true);
  assert.equal(created.invite, undefined);

  assert.throws(
    () =>
      handleMockRequest('/api/v1/auth/sign-up', {
        method: 'POST',
        body: { email: 'newuser@example.com', password: 'password123' },
      }),
    (err: unknown) => err instanceof ApiError && err.status === 409 && err.code === 'EMAIL_ALREADY_EXISTS',
  );

  assert.throws(
    () =>
      handleMockRequest('/api/v1/organizations', {
        method: 'POST',
        body: { name: '   ' },
      }),
    (err: unknown) => err instanceof ApiError && err.status === 400 && err.code === 'VALIDATION',
  );

  const orgRes = handleMockRequest('/api/v1/organizations', {
    method: 'POST',
    body: { name: '李氏谱牒馆' },
  }) as { organization: { name: string; isOwner: boolean } };
  assert.equal(orgRes.organization.name, '李氏谱牒馆');
  assert.equal(orgRes.organization.isOwner, true);

  assert.throws(
    () =>
      handleMockRequest('/api/v1/invites/accept', {
        method: 'POST',
        body: { token: '' },
      }),
    (err: unknown) => err instanceof ApiError && err.status === 400 && err.code === 'VALIDATION',
  );

  const inviteRes = handleMockRequest('/api/v1/invites/accept', {
    method: 'POST',
    body: { token: 'inv-abcdef123' },
  }) as { organization: { role: string; isOwner: boolean }; defaultOrganizationChanged: boolean };
  assert.equal(inviteRes.organization.role, 'viewer');
  assert.equal(inviteRes.organization.isOwner, false);
  assert.equal(inviteRes.defaultOrganizationChanged, true);
});

test('mockAuth enforces auth on protected endpoints and throws 501 for unknown routes', () => {
  assert.throws(
    () =>
      handleMockRequest('/api/v1/organizations', {
        method: 'POST',
        body: { name: 'Unauth Org' },
      }),
    (err: unknown) => err instanceof ApiError && err.status === 401 && err.code === 'UNAUTHENTICATED',
  );

  assert.throws(
    () => handleMockRequest('/api/v1/auth/non-existent', { method: 'GET' }),
    (err: unknown) => err instanceof ApiError && err.status === 501 && err.code === 'MOCK_NOT_IMPLEMENTED',
  );
});
