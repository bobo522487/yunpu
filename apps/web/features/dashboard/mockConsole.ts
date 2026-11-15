import { ApiError, type RequestOptions } from '../../lib/api';
import { loadDb, saveDb, type MockOrganization } from '../auth/mockAuth';

// 控制台 Mock：数据结构、错误码与真实信封逐字段一致（contracts/console-api.md §8）。
// 由 mockAuth 的 handleMockRequest 末尾委托调用；不匹配的路径返回 undefined。

const STORAGE_KEY = 'nocoapp:mock-console';

type MockProject = {
  id: string;
  organizationId: string;
  name: string;
  status: 'planning' | 'in_progress' | 'completed';
  surname: string | null;
  hallName: string | null;
  originText: string | null;
  description: string | null;
  colorTheme: 'sky' | 'pink' | 'orange' | 'indigo' | 'emerald' | 'violet';
  projectLevel: number;
  createdAt: string;
  updatedAt: string;
};

type MockMember = {
  userId: string;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  isOwner: boolean;
  joinedAt: string;
};

type MockInvite = {
  id: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  status: 'pending' | 'accepted' | 'revoked';
  expiresAt: string;
  createdAt: string;
  token?: string;
};

type ConsoleDb = {
  projects: MockProject[];
  members: Record<string, MockMember[]>;
  invites: Record<string, MockInvite[]>;
  activatedAt: Record<string, number>;
};

function loadConsoleDb(): ConsoleDb {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const db = JSON.parse(raw) as ConsoleDb;
      // 旧本地数据可能缺新增字段，归一化避免编辑弹窗读到 undefined。
      for (const project of db.projects ?? []) {
        project.colorTheme ??= 'sky';
        project.projectLevel ??= 1;
      }
      return db;
    }
  } catch {
    // 忽略损坏的本地数据。
  }
  return { projects: [], members: {}, invites: {}, activatedAt: {} };
}

function saveConsoleDb(db: ConsoleDb): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // 隐私模式等场景下仅内存生效。
  }
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function requireBody(options: RequestOptions): Record<string, unknown> {
  return (options.body ?? {}) as Record<string, unknown>;
}

function normalizeRole(org: MockOrganization): 'admin' | 'editor' | 'viewer' {
  if (org.isOwner) return 'admin';
  if (org.role === 'member') return 'viewer';
  if (org.role === 'owner') return 'admin';
  if (org.role === 'admin' || org.role === 'editor' || org.role === 'viewer') {
    return org.role;
  }
  return 'viewer';
}

const ROLE_RANK = { viewer: 0, editor: 1, admin: 2 } as const;

type Session = {
  userId: string;
  email: string;
  name: string;
  orgs: MockOrganization[];
  org: MockOrganization;
  role: 'admin' | 'editor' | 'viewer';
  consoleDb: ConsoleDb;
  authDb: ReturnType<typeof loadDb>;
};

/** 当前会话 + 目标组织；组织不存在或不属于当前用户 → 与真实后端一致的 404（不泄漏存在性）。 */
function requireOrg(organizationId: string): Session {
  const authDb = loadDb();
  const user = authDb.users.find((item) => item.id === authDb.sessionUserId);
  if (!user) throw new ApiError('请先登录', 'UNAUTHORIZED', 401);
  const orgs = authDb.organizations[user.id] ?? [];
  const org = orgs.find((item) => item.id === organizationId);
  if (!org || org.status === 'archived') {
    throw new ApiError('目标不存在或已失效', 'NOT_FOUND', 404);
  }
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    orgs,
    org,
    role: normalizeRole(org),
    consoleDb: loadConsoleDb(),
    authDb,
  };
}

function requireRole(session: Session, min: 'editor' | 'admin'): void {
  if (ROLE_RANK[session.role] < ROLE_RANK[min]) {
    throw new ApiError('无权执行该操作', 'FORBIDDEN', 403);
  }
}

function seedMembers(session: Session): MockMember[] {
  const existing = session.consoleDb.members[session.org.id];
  if (existing && existing.length > 0) return existing;

  const members: MockMember[] = [
    {
      userId: session.userId,
      name: session.name,
      email: session.email,
      role: session.role,
      isOwner: session.org.isOwner,
      joinedAt: nowIso(),
    },
  ];
  if (!session.org.isOwner) {
    // 非 owner 的组织补一个合成 owner，保证名单里始终有 owner（与真实数据一致）。
    members.unshift({
      userId: `mock-owner-${session.org.id}`,
      name: '组织所有者',
      email: 'owner@example.com',
      role: 'admin',
      isOwner: true,
      joinedAt: nowIso(),
    });
  }
  session.consoleDb.members[session.org.id] = members;
  saveConsoleDb(session.consoleDb);
  return members;
}

function orgDetail(session: Session) {
  const members = seedMembers(session);
  const pendingInvites = (
    session.consoleDb.invites[session.org.id] ?? []
  ).filter((invite) => invite.status === 'pending');
  return {
    id: session.org.id,
    name: session.org.name,
    status: session.org.status ?? 'active',
    ownerUserId: members.find((member) => member.isOwner)?.userId ?? session.userId,
    myRole: session.role,
    isOwner: session.org.isOwner,
    memberCount: members.length,
    pendingInviteCount: pendingInvites.length,
    projectCount: session.consoleDb.projects.filter(
      (project) => project.organizationId === session.org.id,
    ).length,
  };
}

function paginate<T>(items: T[], search: string): { items: T[]; nextCursor: string | null } {
  const params = new URLSearchParams(search);
  const limit = Math.min(Math.max(Number(params.get('limit') ?? 50) || 50, 1), 200);
  const offset = Number(params.get('cursor') ?? 0) || 0;
  const slice = items.slice(offset, offset + limit);
  const end = offset + slice.length;
  return { items: slice, nextCursor: end < items.length ? String(end) : null };
}

function findProject(projectId: string): { consoleDb: ConsoleDb; project: MockProject } {
  const consoleDb = loadConsoleDb();
  const project = consoleDb.projects.find((item) => item.id === projectId);
  if (!project) throw new ApiError('目标不存在或已失效', 'NOT_FOUND', 404);
  return { consoleDb, project };
}

function handleOrganizations(parts: string[], search: string, options: RequestOptions) {
  const method = options.method ?? 'GET';
  const authDb = loadDb();
  const user = authDb.users.find((item) => item.id === authDb.sessionUserId);
  if (!user) throw new ApiError('请先登录', 'UNAUTHORIZED', 401);
  const consoleDb = loadConsoleDb();

  // /organizations
  if (parts.length === 1) {
    if (method !== 'GET') return undefined; // POST 由 mockAuth 处理
    const orgs = (authDb.organizations[user.id] ?? []).filter(
      (org) => org.status !== 'archived',
    );
    const sorted = [...orgs].sort(
      (a, b) => (consoleDb.activatedAt[b.id] ?? 0) - (consoleDb.activatedAt[a.id] ?? 0),
    );
    return {
      organizations: sorted.map((org) => ({
        id: org.id,
        name: org.name,
        role: normalizeRole(org),
        isOwner: org.isOwner,
        lastUsedAt: consoleDb.activatedAt[org.id]
          ? new Date(consoleDb.activatedAt[org.id]).toISOString()
          : null,
      })),
      defaultOrganizationId: sorted[0]?.id ?? null,
    };
  }

  const organizationId = parts[1];
  const rest = parts.slice(2);

  if (rest.length === 0) {
    const session = requireOrg(organizationId);
    if (method === 'GET') return { organization: orgDetail(session) };
    if (method === 'PATCH') {
      const body = requireBody(options);
      if (typeof body.name === 'string') {
        const name = body.name.trim();
        if (!name) throw new ApiError('请求参数不合法', 'VALIDATION', 400);
        session.org.name = name;
      }
      if (body.status === 'archived') {
        if (session.role !== 'admin') {
          throw new ApiError('无权执行该操作', 'FORBIDDEN', 403);
        }
        session.org.status = 'archived';
      } else if (body.status !== undefined) {
        throw new ApiError('请求参数不合法', 'VALIDATION', 400);
      }
      saveDb(session.authDb);
      return { organization: orgDetail(session) };
    }
    return undefined;
  }

  if (rest[0] === 'activate' && method === 'POST') {
    const session = requireOrg(organizationId);
    consoleDb.activatedAt[session.org.id] = Date.now();
    saveConsoleDb(consoleDb);
    return {
      organization: {
        id: session.org.id,
        name: session.org.name,
        role: session.role,
        isOwner: session.org.isOwner,
      },
    };
  }

  if (rest[0] === 'leave' && method === 'POST') {
    const session = requireOrg(organizationId);
    if (session.org.isOwner) {
      throw new ApiError('请先转移所有权', 'CONFLICT', 409);
    }
    session.authDb.organizations[session.userId] = session.orgs.filter(
      (org) => org.id !== organizationId,
    );
    saveDb(session.authDb);
    return { left: true };
  }

  if (rest[0] === 'members') {
    const session = requireOrg(organizationId);
    if (rest.length === 1 && method === 'GET') {
      const members = seedMembers(session);
      return paginate(members, search);
    }
    const userId = rest[1];
    const member = seedMembers(session).find((item) => item.userId === userId);
    if (!member) throw new ApiError('目标不存在或已失效', 'NOT_FOUND', 404);
    if (method === 'PATCH') {
      requireRole(session, 'admin');
      if (member.isOwner) throw new ApiError('不能修改所有者角色', 'CONFLICT', 409);
      const body = requireBody(options);
      const role = body.role;
      if (role !== 'admin' && role !== 'editor' && role !== 'viewer') {
        throw new ApiError('请求参数不合法', 'VALIDATION', 400);
      }
      member.role = role;
      saveConsoleDb(session.consoleDb);
      return { member };
    }
    if (method === 'DELETE') {
      requireRole(session, 'admin');
      if (member.isOwner) throw new ApiError('不能移除组织所有者', 'CONFLICT', 409);
      session.consoleDb.members[session.org.id] = seedMembers(session).filter(
        (item) => item.userId !== userId,
      );
      saveConsoleDb(session.consoleDb);
      return { removed: true };
    }
    return undefined;
  }

  if (rest[0] === 'invites') {
    const session = requireOrg(organizationId);
    const invites = session.consoleDb.invites[session.org.id] ?? [];
    if (rest.length === 1 && method === 'GET') {
      requireRole(session, 'admin');
      return paginate(
        invites.map(({ token: _token, ...invite }) => invite),
        search,
      );
    }
    if (rest.length === 1 && method === 'POST') {
      requireRole(session, 'admin');
      const body = requireBody(options);
      const email = String(body.email ?? '').trim().toLowerCase();
      const role = body.role;
      if (!email || role !== 'admin' && role !== 'editor' && role !== 'viewer') {
        throw new ApiError('请求参数不合法', 'VALIDATION', 400);
      }
      if (
        invites.some(
          (invite) => invite.email === email && invite.status === 'pending',
        )
      ) {
        throw new ApiError('记录已存在', 'CONFLICT', 409);
      }
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      const token = btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      const invite: MockInvite = {
        id: uid('inv'),
        email,
        role,
        status: 'pending',
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
        createdAt: nowIso(),
        token,
      };
      invites.push(invite);
      session.consoleDb.invites[session.org.id] = invites;
      saveConsoleDb(session.consoleDb);
      const { token: createdToken, ...record } = invite;
      return {
        invite: record,
        inviteUrl: `${window.location.origin}/#/invite/${createdToken}`,
      };
    }
    if (rest.length === 2 && method === 'DELETE') {
      requireRole(session, 'admin');
      const invite = invites.find((item) => item.id === rest[1]);
      if (!invite || invite.status !== 'pending') {
        throw new ApiError('目标不存在或已失效', 'NOT_FOUND', 404);
      }
      invite.status = 'revoked';
      saveConsoleDb(session.consoleDb);
      return { revoked: true };
    }
    return undefined;
  }

  if (rest[0] === 'owner' && method === 'PUT') {
    const session = requireOrg(organizationId);
    if (!session.org.isOwner) throw new ApiError('无权执行该操作', 'FORBIDDEN', 403);
    const body = requireBody(options);
    const newOwnerUserId = String(body.newOwnerUserId ?? '');
    const members = seedMembers(session);
    const target = members.find((item) => item.userId === newOwnerUserId);
    if (!target) throw new ApiError('目标不存在或已失效', 'NOT_FOUND', 404);
    for (const member of members) member.isOwner = member.userId === newOwnerUserId;
    session.org.isOwner = false;
    session.org.role = 'admin';
    saveDb(session.authDb);
    saveConsoleDb(session.consoleDb);
    return { ownerUserId: newOwnerUserId };
  }

  if (rest[0] === 'projects') {
    const session = requireOrg(organizationId);
    const projects = session.consoleDb.projects
      .filter((project) => project.organizationId === organizationId)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    if (rest.length === 1 && method === 'GET') {
      return paginate(projects, search);
    }
    if (rest.length === 1 && method === 'POST') {
      requireRole(session, 'editor');
      const body = requireBody(options);
      const name = String(body.name ?? '').trim();
      if (!name) throw new ApiError('请求参数不合法', 'VALIDATION', 400);
      const status =
        body.status === 'in_progress' || body.status === 'completed'
          ? body.status
          : 'planning';
      const project: MockProject = {
        id: uid('proj'),
        organizationId,
        name,
        status,
        surname: typeof body.surname === 'string' && body.surname.trim() ? body.surname.trim() : null,
        hallName: typeof body.hallName === 'string' && body.hallName.trim() ? body.hallName.trim() : null,
        originText: typeof body.originText === 'string' && body.originText.trim() ? body.originText.trim() : null,
        description: typeof body.description === 'string' && body.description.trim() ? body.description.trim() : null,
        colorTheme:
          body.colorTheme === 'pink' ||
          body.colorTheme === 'orange' ||
          body.colorTheme === 'indigo' ||
          body.colorTheme === 'emerald' ||
          body.colorTheme === 'violet'
            ? body.colorTheme
            : 'sky',
        projectLevel:
          typeof body.projectLevel === 'number' &&
          Number.isInteger(body.projectLevel) &&
          body.projectLevel >= 1 &&
          body.projectLevel <= 5
            ? body.projectLevel
            : 1,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      session.consoleDb.projects.push(project);
      saveConsoleDb(session.consoleDb);
      return { project };
    }
    return undefined;
  }

  return undefined;
}

function handleProjects(parts: string[], search: string, options: RequestOptions) {
  const method = options.method ?? 'GET';
  const projectId = parts[1];
  const authDb = loadDb();
  const user = authDb.users.find((item) => item.id === authDb.sessionUserId);
  if (!user) throw new ApiError('请先登录', 'UNAUTHORIZED', 401);

  const { consoleDb, project } = findProject(projectId);
  const orgs = authDb.organizations[user.id] ?? [];
  const org = orgs.find(
    (item) => item.id === project.organizationId && item.status !== 'archived',
  );
  // 跨租户或无权：与真实后端一致返回 404，不泄漏存在性。
  if (!org) throw new ApiError('目标不存在或已失效', 'NOT_FOUND', 404);
  const session: Session = {
    userId: user.id,
    email: user.email,
    name: user.name,
    orgs,
    org,
    role: normalizeRole(org),
    consoleDb,
    authDb,
  };

  if (method === 'GET') return { project };

  if (method === 'PATCH') {
    requireRole(session, 'editor');
    const body = requireBody(options);
    const expectedUpdatedAt = String(body.expectedUpdatedAt ?? '');
    if (expectedUpdatedAt !== project.updatedAt) {
      throw new ApiError('操作已被并发请求抢先，请重试', 'CONFLICT', 409);
    }
    if (typeof body.name === 'string') {
      const name = body.name.trim();
      if (!name) throw new ApiError('请求参数不合法', 'VALIDATION', 400);
      project.name = name;
    }
    if (
      body.status === 'planning' ||
      body.status === 'in_progress' ||
      body.status === 'completed'
    ) {
      project.status = body.status;
    }
    for (const field of ['surname', 'hallName', 'originText', 'description'] as const) {
      if (field in body) {
        const value = body[field];
        project[field] =
          typeof value === 'string' && value.trim() ? value.trim() : null;
      }
    }
    if (
      body.colorTheme === 'sky' ||
      body.colorTheme === 'pink' ||
      body.colorTheme === 'orange' ||
      body.colorTheme === 'indigo' ||
      body.colorTheme === 'emerald' ||
      body.colorTheme === 'violet'
    ) {
      project.colorTheme = body.colorTheme;
    }
    if (
      typeof body.projectLevel === 'number' &&
      Number.isInteger(body.projectLevel) &&
      body.projectLevel >= 1 &&
      body.projectLevel <= 5
    ) {
      project.projectLevel = body.projectLevel;
    }
    project.updatedAt = nowIso();
    saveConsoleDb(consoleDb);
    return { project };
  }

  if (method === 'DELETE') {
    requireRole(session, 'admin');
    consoleDb.projects = consoleDb.projects.filter((item) => item.id !== projectId);
    saveConsoleDb(consoleDb);
    return { deleted: true };
  }

  return undefined;
}

function handleAccount(search: string, options: RequestOptions) {
  const method = options.method ?? 'GET';
  const authDb = loadDb();
  const user = authDb.users.find((item) => item.id === authDb.sessionUserId);
  if (!user) throw new ApiError('请先登录', 'UNAUTHORIZED', 401);

  if (method === 'GET') {
    return { id: user.id, email: user.email, name: user.name };
  }
  if (method === 'PATCH') {
    const body = requireBody(options);
    const name = String(body.name ?? '').trim();
    if (!name || name.length > 100) {
      throw new ApiError('请求参数不合法', 'VALIDATION', 400);
    }
    user.name = name;
    saveDb(authDb);
    return { id: user.id, email: user.email, name: user.name };
  }
  return undefined;
}

function handleChangePassword(options: RequestOptions) {
  const authDb = loadDb();
  const user = authDb.users.find((item) => item.id === authDb.sessionUserId);
  if (!user) throw new ApiError('请先登录', 'UNAUTHORIZED', 401);
  const body = requireBody(options);
  const currentPassword = String(body.currentPassword ?? '');
  const newPassword = String(body.newPassword ?? '');
  if (user.password !== currentPassword) {
    throw new ApiError('当前密码不正确', 'VALIDATION', 400);
  }
  if (newPassword.length < 8) {
    throw new ApiError('密码至少 8 个字符', 'VALIDATION', 400);
  }
  user.password = newPassword;
  saveDb(authDb);
  return { changed: true as const };
}

export function handleConsoleMock(
  path: string,
  options: RequestOptions,
): unknown | undefined {
  const [pathname, search = ''] = path.split('?');
  if (!pathname.startsWith('/api/v1/')) return undefined;
  const parts = pathname.slice('/api/v1/'.length).split('/').filter(Boolean);
  if (parts.length === 0) return undefined;

  if (parts[0] === 'organizations') {
    return handleOrganizations(parts, search, options);
  }
  if (parts[0] === 'projects') {
    return handleProjects(parts, search, options);
  }
  if (parts[0] === 'account' && parts.length === 1) {
    return handleAccount(search, options);
  }
  if (parts[0] === 'account' && parts[1] === 'password' && options.method === 'POST') {
    return handleChangePassword(options);
  }
  return undefined;
}
