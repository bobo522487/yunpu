import { create } from 'zustand';
import type { TreeItem } from '../components/common/Tree/types';
import { findFirstTreeNodeByType } from '../lib/treeOps';
import type { LineageViewMode } from '../features/lineage/types';
import type { GenealogyPlace } from '../features/place-input';

export function resolveChartSurname(
  node: TreeItem | undefined,
  projectSurname?: string,
): string {
  if (node?.data?.surname !== undefined) {
    return node.data.surname;
  }
  return projectSurname?.trim() ?? '';
}

export function findFirstChartId(items: TreeItem[]): string | null {
  const hit = findFirstTreeNodeByType(items, 'chart');
  return hit ? String(hit.id) : null;
}

export function makeChartStorageKey(projectId: string, chartId: string): string {
  return `${projectId}::${chartId}`;
}

export interface LineageChartMeta {
  name: string;
  surname?: string;
  hallName?: string;
  progenitor?: string;
  region?: GenealogyPlace | null;
}

export interface LineageUiState {
  selectedNodeIdByProject: Record<string, string>;
  selectedPersonIdByChart: Record<string, string | null>;
  viewModeByProject: Record<string, LineageViewMode>;
  collapsedFoldersByProject: Record<string, Record<string, boolean>>;

  selectNode: (projectId: string, nodeId: string) => void;
  selectPerson: (
    projectId: string,
    chartId: string,
    personId: string | null,
  ) => void;
  setViewMode: (projectId: string, mode: LineageViewMode) => void;
  setFolderCollapsed: (
    projectId: string,
    folderId: string,
    collapsed: boolean,
  ) => void;
  setCollapsedFolders: (
    projectId: string,
    collapsedMap: Record<string, boolean>,
  ) => void;
}

export const useLineageStore = create<LineageUiState>()((set) => ({
  selectedNodeIdByProject: {},
  selectedPersonIdByChart: {},
  viewModeByProject: {},
  collapsedFoldersByProject: {},

  selectNode: (projectId, nodeId) =>
    set((state) => ({
      selectedNodeIdByProject: {
        ...state.selectedNodeIdByProject,
        [projectId]: nodeId,
      },
    })),

  selectPerson: (projectId, chartId, personId) =>
    set((state) => ({
      selectedPersonIdByChart: {
        ...state.selectedPersonIdByChart,
        [makeChartStorageKey(projectId, chartId)]: personId,
      },
    })),

  setViewMode: (projectId, mode) =>
    set((state) => ({
      viewModeByProject: { ...state.viewModeByProject, [projectId]: mode },
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
}));
