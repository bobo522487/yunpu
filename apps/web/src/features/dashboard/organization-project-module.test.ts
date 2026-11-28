import assert from 'node:assert/strict';
import { QueryClient } from '@tanstack/react-query';
import { describe, test } from 'vitest';
import { ApiError } from '../../lib/api.ts';
import type { OrganizationSummary } from '../auth/api.ts';
import { lineageKeys } from '../lineage/queries.ts';
import type { OrgDetail, ProjectRecord } from './api.ts';
import {
  createOrganizationProjectController,
  dashboardKeys,
  PROJECT_SWITCHER_LIMIT,
  resolveCurrentOrganizationId,
  type OrganizationProjectSessionAdapter,
  type OrganizationProjectTransport,
} from './organizationProjectModule.ts';

function makeProject(
  id: string,
  organizationId: string,
  overrides: Partial<ProjectRecord> = {},
): ProjectRecord {
  return {
    id,
    organizationId,
    name: `家族 ${id}`,
    status: 'in_progress',
    surname: '陈',
    ancestor: '太祖',
    hallName: '义门堂',
    originText: '江西九江',
    description: '族谱简介',
    colorTheme: 'sky',
    projectLevel: 1,
    iconKey: null,
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createMemoryHarness(initial?: {
  organizations?: OrganizationSummary[];
  defaultOrganizationId?: string | null;
  projects?: ProjectRecord[];
}) {
  let orgs: OrganizationSummary[] = [...(initial?.organizations ?? [])];
  let defaultOrgId =
    initial?.defaultOrganizationId !== undefined
      ? initial.defaultOrganizationId
      : (orgs[0]?.id ?? null);
  let projects: ProjectRecord[] = [...(initial?.projects ?? [])];
  let seq = 100;
  let refreshCalls = 0;

  let activeOrganizationId = '';
  let activeProjectId = '';
  let defaultOrganization: OrganizationSummary | null =
    orgs.find((o) => o.id === defaultOrgId) ?? null;

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const session: OrganizationProjectSessionAdapter = {
    getActiveOrganizationId: () => activeOrganizationId,
    setActiveOrganizationId: (id) => {
      activeOrganizationId = id;
    },
    getActiveProjectId: () => activeProjectId,
    setActiveProjectId: (id) => {
      activeProjectId = id;
    },
    getDefaultOrganization: () => defaultOrganization,
    setDefaultOrganization: (org) => {
      defaultOrganization = org;
    },
    isAuthenticated: () => true,
    refreshSession: async () => {
      refreshCalls += 1;
    },
  };

  const calls = {
    fetchProject: [] as string[],
    createProject: [] as Array<{ orgId: string; iconKey?: string }>,
    updateProject: [] as Array<{ projectId: string; version: number }>,
    activateOrganization: [] as string[],
  };

  let nextConflict = false;

  const transport: OrganizationProjectTransport = {
    fetchOrganizations: async () => ({
      organizations: orgs.map((o) => ({
        id: o.id,
        name: o.name,
        role: o.role,
        isOwner: o.isOwner,
        lastUsedAt: '2026-01-01T00:00:00.000Z',
      })),
      defaultOrganizationId: defaultOrgId,
    }),
    fetchOrganization: async (orgId) => {
      const found = orgs.find((o) => o.id === orgId);
      if (!found) throw new ApiError('组织不存在', 'NOT_FOUND', 404);
      const detail: OrgDetail = {
        id: found.id,
        name: found.name,
        status: 'active',
        ownerUserId: 'user-1',
        myRole: found.role,
        isOwner: found.isOwner,
        memberCount: 1,
        pendingInviteCount: 0,
        projectCount: projects.filter((p) => p.organizationId === orgId).length,
      };
      return { organization: detail };
    },
    updateOrganization: async (orgId, patch) => {
      const idx = orgs.findIndex((o) => o.id === orgId);
      if (idx < 0) throw new ApiError('组织不存在', 'NOT_FOUND', 404);
      if (patch.status === 'archived') {
        orgs = orgs.filter((o) => o.id !== orgId);
        if (defaultOrgId === orgId) {
          defaultOrgId = orgs[0]?.id ?? null;
        }
        return {
          organization: {
            id: orgId,
            name: '已归档组织',
            status: 'archived',
            ownerUserId: 'user-1',
            myRole: 'admin',
            isOwner: true,
            memberCount: 1,
            pendingInviteCount: 0,
            projectCount: 0,
          },
        };
      }
      const nextName = patch.name ?? orgs[idx].name;
      orgs[idx] = { ...orgs[idx], name: nextName };
      return {
        organization: {
          id: orgs[idx].id,
          name: nextName,
          status: 'active',
          ownerUserId: 'user-1',
          myRole: orgs[idx].role,
          isOwner: orgs[idx].isOwner,
          memberCount: 1,
          pendingInviteCount: 0,
          projectCount: projects.filter((p) => p.organizationId === orgId).length,
        },
      };
    },
    activateOrganization: async (orgId) => {
      calls.activateOrganization.push(orgId);
      const found = orgs.find((o) => o.id === orgId);
      if (!found) throw new ApiError('组织不存在', 'NOT_FOUND', 404);
      defaultOrgId = orgId;
      return { organization: found };
    },
    fetchProjects: async (orgId, page = {}) => {
      const filtered = projects.filter((p) => p.organizationId === orgId);
      const limit = page.limit ?? 50;
      return {
        items: filtered.slice(0, limit),
        nextCursor: filtered.length > limit ? 'next' : null,
      };
    },
    fetchProject: async (projectId) => {
      calls.fetchProject.push(projectId);
      const found = projects.find((p) => p.id === projectId);
      if (!found) throw new ApiError('家族不存在', 'NOT_FOUND', 404);
      return { project: found };
    },
    createProject: async (orgId, payload) => {
      calls.createProject.push({ orgId, iconKey: payload.iconKey });
      seq += 1;
      const created = makeProject(`p-${seq}`, orgId, {
        name: payload.name,
        status: payload.status ?? 'in_progress',
        surname: payload.surname ?? null,
        ancestor: payload.ancestor ?? null,
        hallName: payload.hallName ?? null,
        originText: payload.originText ?? null,
        description: payload.description ?? null,
        colorTheme: payload.colorTheme ?? 'sky',
        projectLevel: payload.projectLevel ?? 1,
        iconKey: payload.iconKey ?? null,
      });
      projects = [created, ...projects];
      return { project: created };
    },
    updateProject: async (projectId, payload) => {
      calls.updateProject.push({ projectId, version: payload.version });
      if (nextConflict) {
        nextConflict = false;
        // 模拟服务端已有更新版本，客户端下一次重拉可见最新 version=2
        projects = projects.map((p) =>
          p.id === projectId ? { ...p, version: p.version + 1 } : p,
        );
        throw new ApiError('版本冲突', 'VERSION_CONFLICT', 409);
      }
      const idx = projects.findIndex((p) => p.id === projectId);
      if (idx < 0) throw new ApiError('家族不存在', 'NOT_FOUND', 404);
      const next = {
        ...projects[idx],
        ...payload,
        version: projects[idx].version + 1,
      };
      projects[idx] = next;
      return { project: next };
    },
    deleteProject: async (projectId) => {
      projects = projects.filter((p) => p.id !== projectId);
      return { deleted: true };
    },
  };

  const controller = createOrganizationProjectController({
    queryClient,
    transport,
    session,
  });

  return {
    queryClient,
    transport,
    controller,
    calls,
    triggerNextConflict: () => {
      nextConflict = true;
    },
    getSessionSnapshot: () => ({
      activeOrganizationId,
      activeProjectId,
      defaultOrganization,
      refreshCalls,
    }),
  };
}

describe('Organization 与 Project 单一服务端缓存深模块', () => {
  test('首页 limit:5 与切换器 limit:200 缓存键相互隔离，超过 5 个家族不会被截断', async () => {
    const items = Array.from({ length: 7 }, (_, i) =>
      makeProject(`p-${i + 1}`, 'org-1'),
    );
    const { queryClient, transport } = createMemoryHarness({
      organizations: [
        { id: 'org-1', name: '义门组织', role: 'admin', isOwner: true },
      ],
      projects: items,
    });

    const homePage = await queryClient.fetchQuery({
      queryKey: dashboardKeys.projects('org-1', { limit: 5, sort: 'recent' }),
      queryFn: () =>
        transport.fetchProjects('org-1', { limit: 5, sort: 'recent' }),
    });
    const switcherPage = await queryClient.fetchQuery({
      queryKey: dashboardKeys.projects('org-1', {
        limit: PROJECT_SWITCHER_LIMIT,
        sort: 'recent',
      }),
      queryFn: () =>
        transport.fetchProjects('org-1', {
          limit: PROJECT_SWITCHER_LIMIT,
          sort: 'recent',
        }),
    });

    assert.equal(homePage.items.length, 5);
    assert.equal(switcherPage.items.length, 7);
    assert.equal(
      queryClient.getQueryData<typeof homePage>(
        dashboardKeys.projects('org-1', { limit: 5, sort: 'recent' }),
      )?.items.length,
      5,
    );
  });

  test('createProject 预填单条缓存、同步选中态并失效刷新列表与谱系目录缓存', async () => {
    const { queryClient, controller, getSessionSnapshot } = createMemoryHarness({
      organizations: [
        { id: 'org-1', name: '义门组织', role: 'admin', isOwner: true },
      ],
    });

    queryClient.setQueryData(
      dashboardKeys.projects('org-1', { limit: PROJECT_SWITCHER_LIMIT, sort: 'recent' }),
      { items: [], nextCursor: null },
    );

    const created = await controller.createProject('org-1', {
      name: '新建陈氏谱',
      surname: '陈',
    });

    assert.equal(
      queryClient.getQueryData<ProjectRecord>(dashboardKeys.project(created.id))
        ?.name,
      '新建陈氏谱',
    );
    assert.equal(getSessionSnapshot().activeProjectId, created.id);
    assert.equal(
      queryClient.getQueryState(
        dashboardKeys.projects('org-1', {
          limit: PROJECT_SWITCHER_LIMIT,
          sort: 'recent',
        }),
      )?.isInvalidated,
      true,
    );
    assert.equal(
      queryClient.getQueryState(lineageKeys.directory(created.id)) === undefined,
      true,
    );
  });

  test('updateProject 在缺失 version 时自动补拉，且在 409 冲突时刷新缓存并显式抛错', async () => {
    const existing = makeProject('p-1', 'org-1', {
      name: '旧谱名',
      version: 3,
    });
    const { queryClient, controller, calls, triggerNextConflict } =
      createMemoryHarness({
        organizations: [
          { id: 'org-1', name: '义门组织', role: 'admin', isOwner: true },
        ],
        projects: [existing],
      });

    // 1. 缓存空时自动 fetchProject 拿 version=3 并更新至 version=4
    const updated = await controller.updateProject('p-1', { name: '新谱名' });
    assert.deepEqual(calls.fetchProject, ['p-1']);
    assert.deepEqual(calls.updateProject, [{ projectId: 'p-1', version: 3 }]);
    assert.equal(updated.name, '新谱名');
    assert.equal(updated.version, 4);

    // 2. 缓存已有 version=4 时直接复用，遇到 409 后失效缓存并显式抛错
    queryClient.setQueryData(
      dashboardKeys.projects('org-1', { limit: 5, sort: 'recent' }),
      { items: [updated], nextCursor: null },
    );
    triggerNextConflict();

    await assert.rejects(
      () => controller.updateProject('p-1', { name: '并发写入' }),
      (err: unknown) => err instanceof ApiError && err.code === 'VERSION_CONFLICT',
    );
    assert.equal(
      queryClient.getQueryState(dashboardKeys.project('p-1'))?.isInvalidated,
      true,
    );
    assert.equal(
      queryClient.getQueryState(
        dashboardKeys.projects('org-1', { limit: 5, sort: 'recent' }),
      )?.isInvalidated,
      true,
    );
  });

  test('duplicateProject 遵循 ADR-0022 不透传 iconKey 并刷新列表缓存与选中态', async () => {
    const source = makeProject('p-src', 'org-1', {
      name: '源家族',
      iconKey: 'custom-seal.png',
    });
    const { queryClient, controller, calls, getSessionSnapshot } =
      createMemoryHarness({
        organizations: [
          { id: 'org-1', name: '义门组织', role: 'admin', isOwner: true },
        ],
        projects: [source],
      });

    queryClient.setQueryData(
      dashboardKeys.projects('org-1', { limit: PROJECT_SWITCHER_LIMIT, sort: 'recent' }),
      { items: [source], nextCursor: null },
    );

    const copy = await controller.duplicateProject('p-src');
    assert.equal(copy.name, '源家族 (副本)');
    assert.equal(copy.iconKey, null);
    assert.equal(calls.createProject[0]?.iconKey, undefined);
    assert.equal(getSessionSnapshot().activeProjectId, copy.id);
    assert.equal(
      queryClient.getQueryState(
        dashboardKeys.projects('org-1', {
          limit: PROJECT_SWITCHER_LIMIT,
          sort: 'recent',
        }),
      )?.isInvalidated,
      true,
    );
  });

  test('deleteProject 移除单条缓存并在删除当前选中家族时清空 activeProjectId', async () => {
    const p1 = makeProject('p-1', 'org-1');
    const { queryClient, controller, getSessionSnapshot } = createMemoryHarness({
      organizations: [
        { id: 'org-1', name: '义门组织', role: 'admin', isOwner: true },
      ],
      projects: [p1],
    });

    controller.primeProjectCache(p1);
    assert.equal(getSessionSnapshot().activeProjectId, 'p-1');

    await controller.deleteProject('p-1');
    assert.equal(getSessionSnapshot().activeProjectId, '');
    assert.equal(
      queryClient.getQueryData(dashboardKeys.project('p-1')),
      undefined,
    );
  });

  test('switchOrganization、renameOrganization 与 archiveOrganization 正确维护可用组织与引导状态', async () => {
    const { queryClient, controller, calls, getSessionSnapshot } =
      createMemoryHarness({
        organizations: [
          { id: 'org-a', name: '组织甲', role: 'admin', isOwner: true },
          { id: 'org-b', name: '组织乙', role: 'admin', isOwner: true },
        ],
        defaultOrganizationId: 'org-a',
      });

    await controller.renameOrganization('org-a', '  组织甲新名  ');
    assert.equal(getSessionSnapshot().defaultOrganization?.name, '组织甲新名');
    assert.equal(
      queryClient.getQueryData<OrgDetail>(dashboardKeys.organization('org-a'))
        ?.name,
      '组织甲新名',
    );

    // 归档组织甲后自动切到组织乙
    const firstArchive = await controller.archiveOrganization('org-a');
    assert.equal(firstArchive.nextOrganization?.id, 'org-b');
    assert.equal(getSessionSnapshot().activeOrganizationId, 'org-b');
    assert.equal(getSessionSnapshot().defaultOrganization?.id, 'org-b');
    assert.deepEqual(calls.activateOrganization, ['org-b']);

    // 归档最后一个组织乙后返回 null，清空状态并刷新会话进入引导流程
    const secondArchive = await controller.archiveOrganization('org-b');
    assert.equal(secondArchive.nextOrganization, null);
    assert.equal(getSessionSnapshot().activeOrganizationId, '');
    assert.equal(getSessionSnapshot().activeProjectId, '');
    assert.equal(getSessionSnapshot().defaultOrganization, null);
    assert.equal(getSessionSnapshot().refreshCalls, 1);
  });

  test('resolveCurrentOrganizationId 首帧回退服务端默认组织，跨组织冷直链仅对齐会话态', () => {
    assert.equal(resolveCurrentOrganizationId('', 'org-default'), 'org-default');
    assert.equal(resolveCurrentOrganizationId('org-link-b', 'org-default'), 'org-link-b');
    assert.equal(resolveCurrentOrganizationId('', null), '');
  });
});
