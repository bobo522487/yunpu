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
    name: '研发协同空间',
    kind: 'team',
    color: '#0CA678',
    plan: '团队版',
    createdAt: '2026-03-04',
  },
];

const INITIAL_PROJECTS: ProjectItem[] = [
  {
    id: 'proj-getting-started',
    workspaceId: 'ws-personal',
    name: 'Getting Started',
    description: '快速上手数据表管理与视图筛选的示例项目',
    colorTheme: 'sky',
    ownerType: 'owned',
    defaultTableId: 'users',
    updatedAt: '2 小时前',
  },
  {
    id: 'proj-sales-crm',
    workspaceId: 'ws-personal',
    name: '客户与订单项目',
    description: '统一管理客户资料、订单流水及售后工单',
    colorTheme: 'pink',
    ownerType: 'owned',
    defaultTableId: 'orders',
    updatedAt: '1 天前',
  },
  {
    id: 'proj-inventory',
    workspaceId: 'ws-personal',
    name: '进销存项目',
    description: '商品目录、库存变动日志与采购审批数据中心',
    colorTheme: 'orange',
    ownerType: 'owned',
    defaultTableId: 'products',
    updatedAt: '3 天前',
  },
  {
    id: 'proj-supply-chain',
    workspaceId: 'ws-team',
    name: '供应链协同项目',
    description: '跨部门供应商对账与仓储物流调度数据',
    colorTheme: 'emerald',
    ownerType: 'shared',
    defaultTableId: 'inventory_logs',
    updatedAt: '5 小时前',
  },
];

const INITIAL_APPS: AppItem[] = [
  {
    id: 'app-order-mgmt',
    workspaceId: 'ws-personal',
    name: '订单管理门户',
    description: '面向运营团队的订单审核与状态流转应用',
    colorTheme: 'indigo',
    ownerType: 'owned',
    defaultPageId: 'page-1',
    updatedAt: '4 小时前',
  },
  {
    id: 'app-analytics-hub',
    workspaceId: 'ws-team',
    name: '经营数据看板',
    description: '核心营收指标与库存预警可视化应用',
    colorTheme: 'violet',
    ownerType: 'shared',
    defaultPageId: 'page-2',
    updatedAt: '2 天前',
  },
];

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
    email: 'linxiao@nocoapp.dev',
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
    email: 'chenmo@nocoapp.dev',
    role: '管理员',
    joinedAt: '2026-03-10',
    avatarColor: '#047857',
  },
];

const INITIAL_NOTIFICATIONS: WorkspaceNotification[] = [
  {
    id: 'notif-1',
    title: '项目结构已同步',
    description: '进销存项目中的「Products」表新增了 3 条记录。',
    time: '10 分钟前',
    read: false,
  },
  {
    id: 'notif-2',
    title: '成员加入工作区',
    description: '林晓 已接受邀请加入「个人空间」。',
    time: '2 小时前',
    read: false,
  },
  {
    id: 'notif-3',
    title: '应用发布成功',
    description: '订单管理门户 v1.2 已更新页面布局。',
    time: '昨天',
    read: true,
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
  setActiveProjectId: (projectId: string) => void;
  createWorkspace: (name: string) => Workspace;
  updateWorkspace: (workspaceId: string, updates: Partial<Workspace>) => void;

  createProject: (payload: {
    name: string;
    description?: string;
    colorTheme: AssetColorTheme;
    defaultTableId?: string;
  }) => ProjectItem;
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

      createProject: ({ name, description, colorTheme, defaultTableId }) => {
        const newProj: ProjectItem = {
          id: `proj-${Date.now()}`,
          workspaceId: get().activeWorkspaceId,
          name: name.trim(),
          description: description?.trim() || '新建数据与业务协同项目',
          colorTheme,
          ownerType: 'owned',
          defaultTableId: defaultTableId || '',
          updatedAt: '刚刚',
        };
        set((state) => ({
          projects: [...state.projects, newProj],
          activeProjectId: newProj.id,
        }));
        return newProj;
      },

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
      version: 1,
      storage: createAppStorage(),
    }
  )
);
