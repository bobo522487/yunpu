import assert from 'node:assert/strict';
import { test } from 'vitest';
import { migrateWorkspaceState } from './workspacePersist.ts';

test('v1 里的种子项目和 0/1 状态全部丢掉', () => {
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
    },
    1,
  ) as {
    projects: unknown[];
    activeProjectId: string;
    workspaces: unknown[];
    activeWorkspaceId: string;
  };

  assert.deepEqual(next.projects, []);
  assert.equal(next.activeProjectId, '');
  assert.deepEqual(next.workspaces, []);
  assert.equal(next.activeWorkspaceId, '');
});