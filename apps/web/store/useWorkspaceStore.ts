import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  AppItem,
  AssetColorTheme,
  ProjectItem,
  Workspace,
  WorkspaceMember,
  WorkspaceNotification,
} from '../types';
import {
  activateOrganizationRequest,
  fetchOrganizations,
} from '../features/dashboard/api';
import { createAppStorage } from './storageAdapter';

export const ASSET_COLOR_PALETTES: Record<
  AssetColorTheme,
  { tileBg: string; darkTileBg: string; fillDark: string; fillLight: string; label: string }
> = {
  sky: {
    tileBg: '#E0F5FF',
    darkTileBg: 'rgba(54, 191, 255, 0.14)',
    fillDark: '#004869',
    fillLight: '#36BFFF',
    label: '天蓝',
  },
  pink: {
    tileBg: '#FFE1F6',
    darkTileBg: 'rgba(252, 58, 198, 0.14)',
    fillDark: '#68024C',
    fillLight: '#FC3AC6',
    label: '洋红',
  },
  orange: {
    tileBg: '#FEEDE1',
    darkTileBg: 'rgba(250, 130, 49, 0.14)',
    fillDark: '#5D2702',
    fillLight: '#FA8231',
    label: '暖橙',
  },
  indigo: {
    tileBg: '#E7EDFF',
    darkTileBg: 'rgba(51, 102, 255, 0.16)',
    fillDark: '#1E3A8A',
    fillLight: '#3366FF',
    label: '钴蓝',
  },
  emerald: {
    tileBg: '#E2F8EF',
    darkTileBg: 'rgba(16, 185, 129, 0.15)',
    fillDark: '#065F46',
    fillLight: '#10B981',
    label: '翠绿',
  },
  violet: {
    tileBg: '#F1E8FF',
    darkTileBg: 'rgba(139, 92, 246, 0.16)',
    fillDark: '#4C1D95',
    fillLight: '#8B5CF6',
    label: '紫罗兰',
  },
};

const INITIAL_WORKSPACES: Workspace[] = [
  {
    id: 'ws-personal',
    name: '个人空间',
    kind: 'personal',
    color: '#3B5BDB',
    plan: '免费版',
    createdAt: '2026-01-12',
  },
  {
    id: 'ws-team',
    name: '宗亲修谱空间',
    kind: 'team',
    color: '#0CA678',
    plan: '团队版',
    createdAt: '2026-03-04',
  },
];

const LEGACY_MOCK_PROJECT_IDS = new Set([
  'proj-getting-started',
  'proj-sales-crm',
  'proj-inventory',
  'proj-supply-chain',
]);

const LEGACY_MOCK_APP_IDS = new Set(['app-order-mgmt', 'app-analytics-hub']);

const INITIAL_PROJECTS: ProjectItem[] = [
  {
    id: 'proj-chen-yimen',
    workspaceId: 'ws-personal',
    name: '义门陈氏宗谱',
    description: '梳理义门陈氏历代迁徙源流、分庄支派及世系行传。',
    colorTheme: 'sky',
    ownerType: 'owned',
    defaultTableId: 'clan_members',
    updatedAt: '2 小时前',
    primarySurname: '陈',
    primaryName: '义门陈氏宗谱',
    region: '江西省/九江市/德安县',
    projectState: '0',
    projectLevel: 5,
  },
  {
    id: 'proj-han-royal',
    workspaceId: 'ws-personal',
    name: '两汉刘氏天潢谱',
    description: '收录西汉、东汉及蜀汉宗室世系图谱与帝王行传参考。',
    colorTheme: 'indigo',
    ownerType: 'owned',
    defaultTableId: 'clan_members',
    updatedAt: '1 天前',
    primarySurname: '刘',
    primaryName: '丰沛刘氏天潢',
    region: '江苏省/徐州市/丰县',
    projectState: '1',
    projectLevel: 4,
  },
  {
    id: 'proj-peng-ancestors',
    workspaceId: 'ws-team',
    name: '彭城远祖合修谱',
    description: '宗亲协同校勘各房世派字辈、墓茔坐向与行状传记。',
    colorTheme: 'emerald',
    ownerType: 'shared',
    defaultTableId: 'branch_records',
    updatedAt: '5 小时前',
    primarySurname: '彭',
    primaryName: '彭城彭氏合谱',
    region: '贵州省/遵义市/桐梓县',
    projectState: '0',
    projectLevel: 4,
  },
];

const INITIAL_APPS: AppItem[] = [];

const INITIAL_MEMBERS: WorkspaceMember[] = [
  {
    id: 'mem-1',
    workspaceId: 'ws-personal',
    name: '电波',
    email: 'bobo522487@gmail.com',
    role: '所有者',
    joinedAt: '2026-01-12',
    avatarColor: '#4B177B',
  },
  {
    id: 'mem-2',
    workspaceId: 'ws-personal',
    name: '林晓',
    email: 'linxiao@yunpu.cn',
    role: '编辑者',
    joinedAt: '2026-02-18',
    avatarColor: '#1E40AF',
  },
  {
    id: 'mem-3',
    workspaceId: 'ws-team',
    name: '电波',
    email: 'bobo522487@gmail.com',
    role: '所有者',
    joinedAt: '2026-03-04',
    avatarColor: '#4B177B',
  },
  {
    id: 'mem-4',
    workspaceId: 'ws-team',
    name: '陈默',
    email: 'chenmo@yunpu.cn',
    role: '管理员',
    joinedAt: '2026-03-10',
    avatarColor: '#047857',
  },
];

const INITIAL_NOTIFICATIONS: WorkspaceNotification[] = [
  {
    id: 'notif-genealogy-1',
    title: '世系图谱已更新',
    description: '「义门陈氏宗谱」中的西汉天潢图系已收录 14 位族人节点。',
    time: '10 分钟前',
    read: false,
  },
  {
    id: 'notif-genealogy-2',
    title: '宗亲加入修谱空间',
    description: '林晓 已接受邀请加入「个人空间」。',
    time: '2 小时前',
    read: false,
  },
];

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  activeProjectId: string;
  projects: ProjectItem[];
  apps: AppItem[];
  members: WorkspaceMember[];
  notifications: WorkspaceNotification[];
  searchQuery: string;

  setSearchQuery: (query: string) => void;
  switchWorkspace: (workspaceId: string) => void;
  /** 从后端拉取我的组织列表并灌入 workspaces（API 为唯一事实源）。 */
  hydrateFromApi: () => Promise<void>;
  /** 切换当前组织：调 activate（切换即记住，spec FR-007）并清空跨组织的活动项目指针。 */
  setCurrentOrganization: (workspaceId: string) => Promise<void>;
  /** 归档后的去向：返回下一个可用组织，没有则 null（引导状态，spec FR-013）。 */
  resolveNextAvailableOrganization: () => Workspace | null;
  setActiveProjectId: (projectId: string) => void;
  createWorkspace: (name: string) => Workspace;
  updateWorkspace: (workspaceId: string, updates: Partial<Workspace>) => void;

  createProject: (payload: {
    name: string;
    description?: string;
    colorTheme: AssetColorTheme;
    defaultTableId?: string;
    primarySurname?: string;
    region?: string;
    primaryName?: string;
    projectState?: '0' | '1';
    projectLevel?: number;
  }) => ProjectItem;
  /** 把后端项目投影进 store，供模板项目壳（ProjectHomePage）展示名称等基本信息。 */
  syncProject: (project: {
    id: string;
    organizationId: string;
    name: string;
    description?: string | null;
    updatedAt: string;
  }) => void;
  /** 项目被删除后从 store 移除，避免项目壳展示已删除项目。 */
  dropProject: (projectId: string) => void;
  updateProject: (id: string, updates: Partial<ProjectItem>) => void;
  renameProject: (id: string, name: string) => void;
  duplicateProject: (id: string) => ProjectItem | null;
  deleteProject: (id: string) => void;

  createApp: (payload: {
    name: string;
    description?: string;
    colorTheme: AssetColorTheme;
    defaultPageId?: string;
  }) => AppItem;
  updateApp: (id: string, updates: Partial<AppItem>) => void;
  renameApp: (id: string, name: string) => void;
  duplicateApp: (id: string) => AppItem | null;
  deleteApp: (id: string) => void;

  inviteMember: (payload: {
    name: string;
    email: string;
    role: WorkspaceMember['role'];
  }) => void;
  updateMemberRole: (memberId: string, role: WorkspaceMember['role']) => void;
  removeMember: (memberId: string) => void;

  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
}

const AVATAR_COLORS = ['#4B177B', '#1E40AF', '#047857', '#B45309', '#9D174D'];

const ORG_COLORS = ['#3B5BDB', '#0CA678', '#F76707', '#7048E8', '#E64980'];

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      workspaces: INITIAL_WORKSPACES,
      activeWorkspaceId: INITIAL_WORKSPACES[0].id,
      activeProjectId: INITIAL_PROJECTS[0].id,
      projects: INITIAL_PROJECTS,
      apps: INITIAL_APPS,
      members: INITIAL_MEMBERS,
      notifications: INITIAL_NOTIFICATIONS,
      searchQuery: '',

      setSearchQuery: (searchQuery) => set({ searchQuery }),

      switchWorkspace: (activeWorkspaceId) =>
        set((state) => {
          const wsProjects = state.projects.filter(
            (p) => p.workspaceId === activeWorkspaceId
          );
          const currentMatches = wsProjects.some(
            (p) => p.id === state.activeProjectId
          );
          return {
            activeWorkspaceId,
            activeProjectId: currentMatches
              ? state.activeProjectId
              : wsProjects[0]?.id || state.activeProjectId,
          };
        }),

      hydrateFromApi: async () => {
        try {
          const payload = await fetchOrganizations();
          const workspaces: Workspace[] = payload.organizations.map(
            (org, index) => ({
              id: org.id,
              name: org.name,
              kind: 'team',
              color: ORG_COLORS[index % ORG_COLORS.length],
              plan: '组织',
              createdAt: (org.lastUsedAt ?? '').slice(0, 10) || '—',
            }),
          );
          set((state) => {
            const activeExists = workspaces.some(
              (w) => w.id === state.activeWorkspaceId
            );
            const fallbackExists =
              payload.defaultOrganizationId !== null &&
              workspaces.some((w) => w.id === payload.defaultOrganizationId);
            return {
              workspaces,
              activeWorkspaceId: activeExists
                ? state.activeWorkspaceId
                : fallbackExists
                  ? (payload.defaultOrganizationId as string)
                  : (workspaces[0]?.id ?? state.activeWorkspaceId),
            };
          });
        } catch (error) {
          // 拉取失败时不留模板假组织，页面各自展示错误态（FR-015：不虚构数据）。
          set({ workspaces: [] });
          throw error;
        }
      },

      setCurrentOrganization: async (workspaceId) => {
        await activateOrganizationRequest(workspaceId);
        set((state) => {
          const wsProjects = state.projects.filter(
            (p) => p.workspaceId === workspaceId
          );
          return {
            activeWorkspaceId: workspaceId,
            activeProjectId: wsProjects.some((p) => p.id === state.activeProjectId)
              ? state.activeProjectId
              : (wsProjects[0]?.id ?? ''),
          };
        });
      },

      resolveNextAvailableOrganization: () => {
        const state = get();
        return (
          state.workspaces.find((w) => w.id !== state.activeWorkspaceId) ?? null
        );
      },

      setActiveProjectId: (activeProjectId) =>
        set((state) => {
          const proj = state.projects.find((p) => p.id === activeProjectId);
          if (proj && proj.workspaceId !== state.activeWorkspaceId) {
            return { activeProjectId, activeWorkspaceId: proj.workspaceId };
          }
          return { activeProjectId };
        }),

      createWorkspace: (name) => {
        const colors = ['#3B5BDB', '#0CA678', '#F76707', '#7048E8', '#E64980'];
        const newWs: Workspace = {
          id: `ws-${Date.now()}`,
          name: name.trim(),
          kind: 'team',
          color: colors[get().workspaces.length % colors.length],
          plan: '免费版',
          createdAt: new Date().toISOString().slice(0, 10),
        };
        set((state) => ({
          workspaces: [...state.workspaces, newWs],
          activeWorkspaceId: newWs.id,
        }));
        return newWs;
      },

      updateWorkspace: (workspaceId, updates) =>
        set((state) => ({
          workspaces: state.workspaces.map((ws) =>
            ws.id === workspaceId ? { ...ws, ...updates } : ws
          ),
        })),

      createProject: ({
        name,
        description,
        colorTheme,
        defaultTableId,
        primarySurname,
        region,
        primaryName,
        projectState,
        projectLevel,
      }) => {
        const newProj: ProjectItem = {
          id: `proj-${Date.now()}`,
          workspaceId: get().activeWorkspaceId,
          name: name.trim(),
          description: description?.trim() || '',
          colorTheme,
          ownerType: 'owned',
          defaultTableId: defaultTableId || '',
          updatedAt: '刚刚',
          primarySurname: primarySurname?.trim() || undefined,
          region: region?.trim() || undefined,
          primaryName: primaryName?.trim() || undefined,
          projectState: projectState || '0',
          projectLevel: projectLevel ?? 1,
        };
        set((state) => ({
          projects: [...state.projects, newProj],
          activeProjectId: newProj.id,
        }));
        return newProj;
      },

      syncProject: (project) =>
        set((state) => {
          const existing = state.projects.find((p) => p.id === project.id);
          const item: ProjectItem = {
            id: project.id,
            workspaceId: project.organizationId,
            name: project.name,
            description: project.description ?? existing?.description,
            colorTheme: existing?.colorTheme ?? 'sky',
            ownerType: existing?.ownerType ?? 'owned',
            defaultTableId: existing?.defaultTableId ?? '',
            updatedAt: new Date(project.updatedAt).toLocaleDateString(),
          };
          return {
            projects: existing
              ? state.projects.map((p) => (p.id === project.id ? item : p))
              : [...state.projects, item],
          };
        }),

      dropProject: (projectId) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== projectId),
          activeProjectId:
            state.activeProjectId === projectId ? '' : state.activeProjectId,
        })),

      updateProject: (id, updates) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...updates, updatedAt: '刚刚' } : p
          ),
        })),

      renameProject: (id, name) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, name: name.trim() || p.name, updatedAt: '刚刚' } : p
          ),
        })),

      duplicateProject: (id) => {
        const source = get().projects.find((p) => p.id === id);
        if (!source) return null;
        const copy: ProjectItem = {
          ...source,
          id: `proj-${Date.now()}`,
          name: `${source.name} (副本)`,
          ownerType: 'owned',
          updatedAt: '刚刚',
        };
        set((state) => ({
          projects: [...state.projects, copy],
          activeProjectId: copy.id,
        }));
        return copy;
      },

      deleteProject: (id) =>
        set((state) => {
          const remaining = state.projects.filter((p) => p.id !== id);
          const nextProj =
            remaining.find((p) => p.workspaceId === state.activeWorkspaceId) ||
            remaining[0];
          return {
            projects: remaining,
            activeProjectId:
              state.activeProjectId === id
                ? nextProj?.id || ''
                : state.activeProjectId,
          };
        }),

      createApp: ({ name, description, colorTheme, defaultPageId }) => {
        const newApp: AppItem = {
          id: `app-${Date.now()}`,
          workspaceId: get().activeWorkspaceId,
          name: name.trim(),
          description: description?.trim() || '可视化低代码应用',
          colorTheme,
          ownerType: 'owned',
          defaultPageId: defaultPageId || 'page-1',
          updatedAt: '刚刚',
        };
        set((state) => ({ apps: [...state.apps, newApp] }));
        return newApp;
      },

      updateApp: (id, updates) =>
        set((state) => ({
          apps: state.apps.map((a) =>
            a.id === id ? { ...a, ...updates, updatedAt: '刚刚' } : a
          ),
        })),

      renameApp: (id, name) =>
        set((state) => ({
          apps: state.apps.map((a) =>
            a.id === id ? { ...a, name: name.trim() || a.name, updatedAt: '刚刚' } : a
          ),
        })),

      duplicateApp: (id) => {
        const source = get().apps.find((a) => a.id === id);
        if (!source) return null;
        const copy: AppItem = {
          ...source,
          id: `app-${Date.now()}`,
          name: `${source.name} (副本)`,
          ownerType: 'owned',
          updatedAt: '刚刚',
        };
        set((state) => ({ apps: [...state.apps, copy] }));
        return copy;
      },

      deleteApp: (id) =>
        set((state) => ({
          apps: state.apps.filter((a) => a.id !== id),
        })),

      inviteMember: ({ name, email, role }) =>
        set((state) => ({
          members: [
            ...state.members,
            {
              id: `mem-${Date.now()}`,
              workspaceId: state.activeWorkspaceId,
              name: name.trim(),
              email: email.trim(),
              role,
              joinedAt: new Date().toISOString().slice(0, 10),
              avatarColor: AVATAR_COLORS[state.members.length % AVATAR_COLORS.length],
            },
          ],
        })),

      updateMemberRole: (memberId, role) =>
        set((state) => ({
          members: state.members.map((m) => (m.id === memberId ? { ...m, role } : m)),
        })),

      removeMember: (memberId) =>
        set((state) => ({
          members: state.members.filter((m) => m.id !== memberId),
        })),

      markNotificationRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),

      markAllNotificationsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        })),
    }),
    {
      name: 'nocoapp:workspace',
      version: 2,
      storage: createAppStorage(),
      migrate: (persistedState: any, version: number) => {
        if (!persistedState || version >= 2) return persistedState;

        const prevProjects: ProjectItem[] = Array.isArray(persistedState.projects)
          ? persistedState.projects.filter(
              (p: ProjectItem) => !LEGACY_MOCK_PROJECT_IDS.has(p.id)
            )
          : [];

        const mergedProjects = [...INITIAL_PROJECTS];
        for (const proj of prevProjects) {
          if (!mergedProjects.some((p) => p.id === proj.id)) {
            mergedProjects.push(proj);
          }
        }

        const prevApps: AppItem[] = Array.isArray(persistedState.apps)
          ? persistedState.apps.filter(
              (a: AppItem) => !LEGACY_MOCK_APP_IDS.has(a.id)
            )
          : [];

        const nextWorkspaces: Workspace[] = Array.isArray(persistedState.workspaces)
          ? persistedState.workspaces.map((ws: Workspace) =>
              ws.id === 'ws-team' && ws.name === '研发协同空间'
                ? { ...ws, name: '宗亲修谱空间' }
                : ws
            )
          : INITIAL_WORKSPACES;

        const prevActiveProj = persistedState.activeProjectId;
        const nextActiveProj =
          prevActiveProj &&
          !LEGACY_MOCK_PROJECT_IDS.has(prevActiveProj) &&
          mergedProjects.some((p) => p.id === prevActiveProj)
            ? prevActiveProj
            : mergedProjects[0]?.id || 'proj-chen-yimen';

        return {
          ...persistedState,
          workspaces: nextWorkspaces,
          projects: mergedProjects,
          apps: prevApps,
          activeProjectId: nextActiveProj,
          notifications: INITIAL_NOTIFICATIONS,
        };
      },
    }
  )
);
