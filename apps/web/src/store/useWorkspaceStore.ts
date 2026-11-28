import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createAppStorage } from './storageAdapter';
import { migrateWorkspaceState } from './workspacePersist';

interface WorkspaceState {
  /** 当前会话内选中的 Organization ID（仅内存态，不持久化，避免覆盖服务端 Default Organization）。 */
  activeOrganizationId: string;
  activeProjectId: string;
  /** 本机字辈草稿，非服务端 ProjectRecord 字段。 */
  zibeiByProject: Record<string, string[]>;

  setActiveOrganizationId: (organizationId: string) => void;
  setActiveProjectId: (projectId: string) => void;
  setProjectZibei: (projectId: string, words: string[]) => void;
  resetWorkspaceSession: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      activeOrganizationId: '',
      activeProjectId: '',
      zibeiByProject: {},

      setActiveOrganizationId: (activeOrganizationId) =>
        set({ activeOrganizationId }),

      setActiveProjectId: (activeProjectId) => set({ activeProjectId }),

      setProjectZibei: (projectId, words) =>
        set((state) => ({
          zibeiByProject: { ...(state.zibeiByProject || {}), [projectId]: words },
        })),

      resetWorkspaceSession: () =>
        set({
          activeOrganizationId: '',
          activeProjectId: '',
          zibeiByProject: {},
        }),
    }),
    {
      name: 'yunpu:workspace',
      version: 3,
      storage: createAppStorage(),
      migrate: migrateWorkspaceState,
      partialize: (state) => ({
        activeProjectId: state.activeProjectId,
        zibeiByProject: state.zibeiByProject,
      }),
    }
  )
);