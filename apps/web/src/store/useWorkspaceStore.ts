import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type Workspace, type WorkspaceNotification } from '../types';
import {
  activateOrganizationRequest,
  createProjectRequest,
  fetchOrganizations,
  type ProjectColorTheme,
  type ProjectRecord,
} from '../features/dashboard/api';
import { createAppStorage } from './storageAdapter';
import { migrateWorkspaceState } from './workspacePersist';

export const ASSET_COLOR_PALETTES: Record<
  ProjectColorTheme,
  { tileBg: string; darkTileBg: string; fillDark: string; fillLight: string; label: string }
> = {
  sky: {
    tileBg: '#EAF4F7',
    darkTileBg: 'rgba(88, 177, 205, 0.16)',
    fillDark: '#057091',
    fillLight: '#3E9EB8',
    label: '青蓝',
  },
  pink: {
    tileBg: '#F6EAE8',
    darkTileBg: 'rgba(176, 86, 75, 0.16)',
    fillDark: '#7B281E',
    fillLight: '#C05A4C',
    label: '朱砂',
  },
  orange: {
    tileBg: '#F7EFE2',
    darkTileBg: 'rgba(181, 125, 58, 0.16)',
    fillDark: '#734A1A',
    fillLight: '#B8823D',
    label: '琥珀',
  },
  indigo: {
    tileBg: '#EAEDF5',
    darkTileBg: 'rgba(79, 102, 155, 0.18)',
    fillDark: '#2A3B66',
    fillLight: '#5770A8',
    label: '靛蓝',
  },
  emerald: {
    tileBg: '#E9F2EC',
    darkTileBg: 'rgba(69, 128, 96, 0.16)',
    fillDark: '#234D38',
    fillLight: '#4D8B6B',
    label: '竹青',
  },
  violet: {
    tileBg: '#EFEBE7',
    darkTileBg: 'rgba(130, 107, 94, 0.18)',
    fillDark: '#4D3B32',
    fillLight: '#8B7263',
    label: '紫檀',
  },
};

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  activeProjectId: string;
  projects: ProjectRecord[];
  notifications: WorkspaceNotification[];
  searchQuery: string;
  /** 本机草稿，不是 ProjectRecord 的字段。 */
  zibeiByProject: Record<string, string[]>;

  setSearchQuery: (query: string) => void;
  setProjectZibei: (projectId: string, words: string[]) => void;
  hydrateFromApi: () => Promise<void>;
  setCurrentOrganization: (workspaceId: string) => Promise<void>;
  resolveNextAvailableOrganization: () => Workspace | null;
  setActiveProjectId: (projectId: string) => void;
  resetWorkspaceSession: () => void;

  syncProject: (project: ProjectRecord) => void;
  syncWorkspaceProjects: (organizationId: string, items: ProjectRecord[]) => void;
  dropProject: (projectId: string) => void;
  duplicateProject: (id: string) => Promise<ProjectRecord | null>;

  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
}

const ORG_COLORS = ['#057091', '#2C7A92', '#0D9488', '#3B82A6', '#58B1CD'];

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      workspaces: [],
      activeWorkspaceId: '',
      activeProjectId: '',
      projects: [],
      notifications: [],
      searchQuery: '',
      zibeiByProject: {},

      setSearchQuery: (searchQuery) => set({ searchQuery }),

      setProjectZibei: (projectId, words) =>
        set((state) => ({
          zibeiByProject: { ...(state.zibeiByProject || {}), [projectId]: words },
        })),

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
            })
          );
          set((state) => {
            const validOrgIds = new Set(workspaces.map((w) => w.id));
            const validProjects = state.projects.filter((p) =>
              validOrgIds.has(p.organizationId)
            );
            const activeExists = workspaces.some(
              (w) => w.id === state.activeWorkspaceId
            );
            const fallbackExists =
              payload.defaultOrganizationId !== null &&
              workspaces.some((w) => w.id === payload.defaultOrganizationId);
            const nextWorkspaceId = activeExists
              ? state.activeWorkspaceId
              : fallbackExists
                ? (payload.defaultOrganizationId as string)
                : (workspaces[0]?.id ?? '');
            const activeProjectStillValid = validProjects.some(
              (p) =>
                p.id === state.activeProjectId &&
                p.organizationId === nextWorkspaceId
            );
            return {
              workspaces,
              projects: validProjects,
              activeWorkspaceId: nextWorkspaceId,
              activeProjectId: activeProjectStillValid
                ? state.activeProjectId
                : '',
            };
          });
          const activeWorkspaceId = get().activeWorkspaceId;
          const activeOrg = payload.organizations.find(
            (org) => org.id === activeWorkspaceId,
          );
          if (activeOrg) {
            const { useAuthStore } = await import(
              '../features/auth/useAuthStore'
            );
            const authState = useAuthStore.getState();
            if (
              authState.status === 'authenticated' &&
              (authState.defaultOrganization?.id !== activeOrg.id ||
                authState.defaultOrganization?.name !== activeOrg.name)
            ) {
              authState.setDefaultOrganization({
                id: activeOrg.id,
                name: activeOrg.name,
                role: activeOrg.role,
                isOwner: activeOrg.isOwner,
              });
            }
          }
        } catch (error) {
          set({ workspaces: [] });
          throw error;
        }
      },

      setCurrentOrganization: async (workspaceId) => {
        const result = await activateOrganizationRequest(workspaceId);
        set((state) => {
          const wsProjects = state.projects.filter(
            (p) => p.organizationId === workspaceId
          );
          return {
            activeWorkspaceId: workspaceId,
            activeProjectId: wsProjects.some((p) => p.id === state.activeProjectId)
              ? state.activeProjectId
              : (wsProjects[0]?.id ?? ''),
          };
        });
        const { useAuthStore } = await import('../features/auth/useAuthStore');
        if (useAuthStore.getState().status === 'authenticated') {
          useAuthStore.getState().setDefaultOrganization(result.organization);
        }
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
          if (proj && proj.organizationId !== state.activeWorkspaceId) {
            return { activeProjectId, activeWorkspaceId: proj.organizationId };
          }
          return { activeProjectId };
        }),

      resetWorkspaceSession: () =>
        set({
          workspaces: [],
          activeWorkspaceId: '',
          activeProjectId: '',
          projects: [],
          notifications: [],
          searchQuery: '',
          zibeiByProject: {},
        }),

      syncProject: (project) =>
        set((state) => {
          const existing = state.projects.find((p) => p.id === project.id);
          return {
            projects: existing
              ? state.projects.map((p) => (p.id === project.id ? project : p))
              : [...state.projects, project],
          };
        }),

      syncWorkspaceProjects: (organizationId, items) =>
        set((state) => {
          const otherProjects = state.projects.filter(
            (p) => p.organizationId !== organizationId
          );
          return { projects: [...otherProjects, ...items] };
        }),

      dropProject: (projectId) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== projectId),
          activeProjectId:
            state.activeProjectId === projectId ? '' : state.activeProjectId,
        })),

      duplicateProject: async (id) => {
        const source = get().projects.find((p) => p.id === id);
        if (!source) return null;
        const result = await createProjectRequest(source.organizationId, {
          name: `${source.name} (副本)`,
          status: source.status,
          surname: source.surname ?? undefined,
          ancestor: source.ancestor ?? undefined,
          hallName: source.hallName ?? undefined,
          originText: source.originText ?? undefined,
          description: source.description ?? undefined,
          colorTheme: source.colorTheme,
          projectLevel: source.projectLevel,
        });
        get().syncProject(result.project);
        set({ activeProjectId: result.project.id });
        return result.project;
      },

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
      name: 'yunpu:workspace',
      version: 2,
      storage: createAppStorage(),
      migrate: migrateWorkspaceState,
      partialize: (state) => ({
        activeWorkspaceId: state.activeWorkspaceId,
        activeProjectId: state.activeProjectId,
        zibeiByProject: state.zibeiByProject,
      }),
    }
  )
);