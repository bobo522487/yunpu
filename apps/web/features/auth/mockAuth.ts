import { ApiError, type RequestOptions } from '../../lib/api';
import { handleConsoleMock } from '../dashboard/mockConsole';

export type MockUser = {
  id: string;
  email: string;
  password: string;
  name: string;
};

export type MockOrganization = {
  id: string;
  name: string;
  role: string;
  isOwner: boolean;
  status?: 'active' | 'suspended' | 'archived';
};

export type MockDb = {
  users: MockUser[];
  organizations: Record<string, MockOrganization[]>;
  sessionUserId: string | null;
};

const STORAGE_KEY = 'nocoapp:mock-auth';

export function loadDb(): MockDb {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as MockDb;
  } catch {
    // 忽略损坏的本地数据，回退到空库。
  }
  return { users: [], organizations: {}, sessionUserId: null };
}

export function saveDb(db: MockDb): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // 隐私模式等场景下仅内存生效。
  }
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function requireBody(options: RequestOptions): Record<string, unknown> {
  return (options.body ?? {}) as Record<string, unknown>;
}

function currentUser(db: MockDb): MockUser {
  const user = db.users.find((item) => item.id === db.sessionUserId);
  if (!user) {
    throw new ApiError('请先登录', 'UNAUTHENTICATED', 401);
  }
  return user;
}

function defaultOrganization(
  db: MockDb,
  user: MockUser,
): MockOrganization | null {
  return db.organizations[user.id]?.[0] ?? null;
}

function sessionPayload(db: MockDb, user: MockUser) {
  const organization = defaultOrganization(db, user);
  return {
    user: { id: user.id, email: user.email, name: user.name },
    defaultOrganization: organization,
    onboarding: organization === null,
  };
}

function signInPayload(db: MockDb, user: MockUser) {
  return sessionPayload(db, user);
}

function signUp(db: MockDb, options: RequestOptions) {
  const body = requireBody(options);
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const inviteToken = String(body.inviteToken ?? '').trim();

  if (db.users.some((item) => item.email === email)) {
    throw new ApiError('该邮箱已注册', 'EMAIL_ALREADY_EXISTS', 409);
  }

  const user: MockUser = {
    id: uid('user'),
    email,
    password,
    name: email.split('@')[0] || email,
  };
  db.users.push(user);

  const organization: MockOrganization = inviteToken
    ? { id: uid('org'), name: '邀请的组织', role: 'member', isOwner: false, status: 'active' }
    : { id: uid('org'), name: `${user.name} 的工作区`, role: 'owner', isOwner: true, status: 'active' };
  db.organizations[user.id] = [organization];
  db.sessionUserId = user.id;
  saveDb(db);

  return {
    user: { id: user.id, email: user.email, name: user.name },
    defaultOrganization: organization,
    invite: inviteToken ? { accepted: true } : undefined,
  };
}

function signIn(db: MockDb, options: RequestOptions) {
  const body = requireBody(options);
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');

  const user = db.users.find((item) => item.email === email);
  if (!user || user.password !== password) {
    throw new ApiError('邮箱或密码不正确', 'INVALID_CREDENTIALS', 401);
  }

  db.sessionUserId = user.id;
  saveDb(db);
  return signInPayload(db, user);
}

function signOut(db: MockDb) {
  db.sessionUserId = null;
  saveDb(db);
  return { signedOut: true };
}

function createOrganization(db: MockDb, options: RequestOptions) {
  currentUser(db);
  const body = requireBody(options);
  const name = String(body.name ?? '').trim();
  if (!name) {
    throw new ApiError('组织名不能为空', 'VALIDATION', 400);
  }

  const user = currentUser(db);
  const organization: MockOrganization = {
    id: uid('org'),
    name,
    role: 'owner',
    isOwner: true,
    status: 'active',
  };
  db.organizations[user.id] = [...(db.organizations[user.id] ?? []), organization];
  saveDb(db);
  return { organization };
}

function acceptInvite(db: MockDb, options: RequestOptions) {
  currentUser(db);
  const body = requireBody(options);
  const token = String(body.token ?? '').trim();
  if (!token) {
    throw new ApiError('邀请 token 不能为空', 'VALIDATION', 400);
  }

  const user = currentUser(db);
  const existing = db.organizations[user.id] ?? [];
  const organization: MockOrganization = {
    id: uid('org'),
    name: `邀请组织 ${token.slice(0, 6)}`,
    role: 'member',
    isOwner: false,
    status: 'active',
  };
  db.organizations[user.id] = [organization, ...existing];
  saveDb(db);
  return { organization, defaultOrganizationChanged: true };
}

export function handleMockRequest(path: string, options: RequestOptions): unknown {
  const method = options.method ?? 'GET';
  const db = loadDb();

  if (path === '/api/v1/auth/session' && method === 'GET') {
    const user = currentUserOrNull(db);
    return user ? sessionPayload(db, user) : { user: null, defaultOrganization: null, onboarding: false };
  }
  if (path === '/api/v1/auth/sign-in' && method === 'POST') {
    return signIn(db, options);
  }
  if (path === '/api/v1/auth/sign-up' && method === 'POST') {
    return signUp(db, options);
  }
  if (path === '/api/v1/auth/sign-out' && method === 'POST') {
    return signOut(db);
  }
  if (path === '/api/v1/organizations' && method === 'POST') {
    return createOrganization(db, options);
  }
  if (path === '/api/v1/invites/accept' && method === 'POST') {
    return acceptInvite(db, options);
  }

  // 控制台端点（组织详情/成员/邀请/项目/账号）由 mockConsole 委托处理。
  const consoleResult = handleConsoleMock(path, options);
  if (consoleResult !== undefined) return consoleResult;

  throw new ApiError('Mock 尚未实现该接口', 'MOCK_NOT_IMPLEMENTED', 501);
}

function currentUserOrNull(db: MockDb): MockUser | null {
  return db.users.find((item) => item.id === db.sessionUserId) ?? null;
}

// 注册由 features/auth/enableMock（dev + VITE_ENABLE_MOCK=1）显式驱动，
// 本模块不再顶层自注册，生产构建不会包含 mock 链。
