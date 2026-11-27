import { create } from 'zustand';
import type { ArticleDocument } from '../features/articles/types';

export interface ArticleConflictState {
  projectId: string;
  articleId: string;
  local: ArticleDocument;
  server: ArticleDocument;
}

export interface ArticleUiState {
  selectedNodeIdByProject: Record<string, string>;
  collapsedFoldersByProject: Record<string, Record<string, boolean>>;
  articleConflict: ArticleConflictState | null;
  saveError: string | null;

  selectNode: (projectId: string, nodeId: string) => void;
  setFolderCollapsed: (
    projectId: string,
    folderId: string,
    collapsed: boolean,
  ) => void;
  setCollapsedFolders: (
    projectId: string,
    collapsedMap: Record<string, boolean>,
  ) => void;
  setArticleConflict: (conflict: ArticleConflictState | null) => void;
  setSaveError: (error: string | null) => void;
  clearSaveError: () => void;
}

export const useArticleStore = create<ArticleUiState>()((set) => ({
  selectedNodeIdByProject: {},
  collapsedFoldersByProject: {},
  articleConflict: null,
  saveError: null,

  selectNode: (projectId, nodeId) =>
    set((state) => ({
      selectedNodeIdByProject: {
        ...state.selectedNodeIdByProject,
        [projectId]: nodeId,
      },
    })),

  setFolderCollapsed: (projectId, folderId, collapsed) =>
    set((state) => ({
      collapsedFoldersByProject: {
        ...state.collapsedFoldersByProject,
        [projectId]: {
          ...(state.collapsedFoldersByProject[projectId] ?? {}),
          [folderId]: collapsed,
        },
      },
    })),

  setCollapsedFolders: (projectId, collapsedMap) =>
    set((state) => ({
      collapsedFoldersByProject: {
        ...state.collapsedFoldersByProject,
        [projectId]: collapsedMap,
      },
    })),

  setArticleConflict: (articleConflict) => set({ articleConflict }),

  setSaveError: (saveError) => set({ saveError }),

  clearSaveError: () => set({ saveError: null }),
}));
