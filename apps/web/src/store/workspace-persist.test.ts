import assert from 'node:assert/strict';
import { test } from 'vitest';
import { useWorkspaceStore } from './useWorkspaceStore.ts';
import { migrateWorkspaceState } from './workspacePersist.ts';

test('v1 里的种子项目、旧工作区与 activeProjectId 全部丢掉并保留字辈草稿', () => {
  const next = migrateWorkspaceState(
    {
      projects: [
        {
          id: 'proj-chen-yimen',
          workspaceId: 'ws-personal',
          projectState: '0',
          defaultTableId: 'clan_members',
          updatedAt: '刚刚',
        },
      ],
      activeProjectId: 'proj-chen-yimen',
      workspaces: [{ id: 'ws-personal', name: '个人空间' }],
      zibeiByProject: { 'proj-1': ['仁'] },
    },
    1,
  ) as Record<string, unknown>;

  assert.equal('projects' in next, false);
  assert.equal('workspaces' in next, false);
  assert.equal('activeWorkspaceId' in next, false);
  assert.equal(next.activeProjectId, '');
  assert.deepEqual(next.zibeiByProject, { 'proj-1': ['仁'] });
});

test('v2 升级至 v3 剥离历史服务端镜像字段并保留 activeProjectId 与字辈草稿', () => {
  const next = migrateWorkspaceState(
    {
      projects: [{ id: 'p-1', name: '旧镜像' }],
      workspaces: [{ id: 'org-1', name: '旧组织' }],
      activeWorkspaceId: 'org-1',
      activeProjectId: 'p-1',
      zibeiByProject: { 'p-1': ['仁', '义'] },
    },
    2,
  ) as Record<string, unknown>;

  assert.equal('projects' in next, false);
  assert.equal('workspaces' in next, false);
  assert.equal('activeWorkspaceId' in next, false);
  assert.equal(next.activeProjectId, 'p-1');
  assert.deepEqual(next.zibeiByProject, { 'p-1': ['仁', '义'] });
});

test('useWorkspaceStore 仅保留本地界面状态，不持有服务端实体镜像或动态鉴权方法', () => {
  const state = useWorkspaceStore.getState() as unknown as Record<string, unknown>;
  assert.equal('workspaces' in state, false);
  assert.equal('projects' in state, false);
  assert.equal('notifications' in state, false);
  assert.equal('searchQuery' in state, false);
  assert.equal('hydrateFromApi' in state, false);
  assert.equal('setCurrentOrganization' in state, false);
  assert.equal('syncProject' in state, false);
  assert.equal('syncWorkspaceProjects' in state, false);
});