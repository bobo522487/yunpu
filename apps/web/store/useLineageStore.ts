import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TreeItem } from '../components/common/Tree/types';
import { findItemDeep, removeItem, setProperty } from '../components/common/Tree/utilities';
import { createAppStorage } from './storageAdapter';
import { LineageViewMode, PersonRecord } from '../features/lineage/types';
import { createSeedPersonsForChart } from '../features/lineage/lineageData';

export const DEFAULT_LINEAGE_TREE: TreeItem[] = [
  {
    id: 'lineage-group-royal',
    type: 'folder',
    collapsed: false,
    data: { name: '【范例】皇族世系参考' },
    children: [
      {
        id: 'lineage-royal-1',
        type: 'chart',
        data: { name: '西汉天潢图系' },
        children: [],
      },
      {
        id: 'lineage-royal-2',
        type: 'chart',
        data: { name: '西汉楚元王交公世系图' },
        children: [],
      },
      {
        id: 'lineage-royal-3',
        type: 'chart',
        data: { name: '西汉梁孝王武之裔图系' },
        children: [],
      },
      {
        id: 'lineage-royal-4',
        type: 'chart',
        data: { name: '东汉天潢图系' },
        children: [],
      },
      {
        id: 'lineage-royal-5',
        type: 'chart',
        data: { name: '蜀汉天潢图系' },
        children: [],
      },
      {
        id: 'lineage-royal-6',
        type: 'chart',
        data: { name: '东汉广陵思王荆之裔图系' },
        children: [],
      },
      {
        id: 'lineage-royal-7',
        type: 'chart',
        data: { name: '南朝宋刘天潢图系' },
        children: [],
      },
    ],
  },
  {
    id: 'lineage-group-other',
    type: 'folder',
    collapsed: false,
    data: { name: '【范例】其他世系参考' },
    children: [
      {
        id: 'lineage-other-1',
        type: 'chart',
        data: { name: '小田幼房世派世系图' },
        children: [],
      },
      {
        id: 'lineage-other-2',
        type: 'chart',
        data: { name: '墨山王氏習静位下世系' },
        children: [],
      },
      {
        id: 'lineage-other-3',
        type: 'chart',
        data: { name: '小田幼房世派世系图' },
        children: [],
      },
    ],
  },
  {
    id: 'lineage-group-ancestors',
    type: 'folder',
    collapsed: false,
    data: { name: '【范例】远祖世系参考' },
    children: [
      {
        id: 'lineage-ancestor-1',
        type: 'chart',
        data: { name: '彭氏远祖世次' },
        children: [],
      },
    ],
  },
];

export function findFirstChartId(items: TreeItem[]): string | null {
  for (const item of items) {
    if (item.type === 'chart') {
      return String(item.id);
    }
    if (item.children?.length) {
      const found = findFirstChartId(item.children);
      if (found) return found;
    }
  }
  return null;
}

export function countChartsInTree(items: TreeItem[]): number {
  let count = 0;
  for (const item of items) {
    if (item.type === 'chart') {
      count += 1;
    } else if (item.children?.length) {
      count += countChartsInTree(item.children);
    }
  }
  return count;
}

export function makeChartStorageKey(projectId: string, chartId: string): string {
  return `${projectId}::${chartId}`;
}

function cloneDefaultTree(): TreeItem[] {
  return JSON.parse(JSON.stringify(DEFAULT_LINEAGE_TREE));
}

function preserveCollapsedChildren(
  prevItems: TreeItem[],
  nextItems: TreeItem[]
): TreeItem[] {
  return nextItems.map((item) => {
    const prevNode = findItemDeep(prevItems, item.id);
    const restoredChildren =
      item.collapsed && item.children.length === 0 && prevNode?.children?.length
        ? prevNode.children
        : preserveCollapsedChildren(prevItems, item.children || []);
    return {
      ...item,
      children: restoredChildren,
    };
  });
}

function cloneSubtreeWithNewIds(node: TreeItem, suffix: string): TreeItem {
  return {
    ...node,
    id: `${String(node.id)}-copy-${suffix}-${Math.random().toString(36).slice(2, 6)}`,
    data: {
      ...node.data,
      name: `${node.data?.name || String(node.id)} (副本)`,
    },
    children: (node.children || []).map((child) =>
      cloneSubtreeWithNewIds(child, suffix)
    ),
  };
}

function collectDescendantIds(persons: PersonRecord[], rootId: string): Set<string> {
  const toDelete = new Set<string>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of persons) {
      if (p.fatherId && toDelete.has(p.fatherId) && !toDelete.has(p.id)) {
        toDelete.add(p.id);
        changed = true;
      }
    }
  }
  return toDelete;
}

interface LineageState {
  treesByProject: Record<string, TreeItem[]>;
  selectedNodeIdByProject: Record<string, string>;
  personsByChart: Record<string, PersonRecord[]>;
  selectedPersonIdByChart: Record<string, string | null>;
  viewModeByProject: Record<string, LineageViewMode>;

  setTree: (projectId: string, items: TreeItem[]) => void;
  selectNode: (projectId: string, nodeId: string) => void;
  addGroup: (projectId: string, name?: string) => string;
  addChart: (projectId: string, parentId?: string, name?: string) => string;
  renameNode: (projectId: string, id: string, name: string) => void;
  duplicateNode: (projectId: string, id: string) => void;
  removeNode: (projectId: string, id: string) => void;

  setViewMode: (projectId: string, mode: LineageViewMode) => void;
  selectPerson: (projectId: string, chartId: string, personId: string | null) => void;
  addPerson: (
    projectId: string,
    chartId: string,
    person: PersonRecord,
    chartName?: string,
    surname?: string
  ) => void;
  updatePerson: (
    projectId: string,
    chartId: string,
    personId: string,
    updates: Partial<PersonRecord>,
    chartName?: string,
    surname?: string
  ) => void;
  deletePerson: (
    projectId: string,
    chartId: string,
    personId: string,
    chartName?: string,
    surname?: string
  ) => void;
  reorderSibling: (
    projectId: string,
    chartId: string,
    parentId: string,
    childId: string,
    direction: 'up' | 'down',
    chartName?: string,
    surname?: string
  ) => void;
}

export const useLineageStore = create<LineageState>()(
  persist(
    (set, get) => ({
      treesByProject: {},
      selectedNodeIdByProject: {},
      personsByChart: {},
      selectedPersonIdByChart: {},
      viewModeByProject: {},

      setTree: (projectId, nextItems) =>
        set((state) => {
          const prevItems =
            state.treesByProject[projectId] || cloneDefaultTree();
          const merged = preserveCollapsedChildren(prevItems, nextItems);
          return {
            treesByProject: {
              ...state.treesByProject,
              [projectId]: merged,
            },
          };
        }),

      selectNode: (projectId, nodeId) =>
        set((state) => ({
          selectedNodeIdByProject: {
            ...state.selectedNodeIdByProject,
            [projectId]: nodeId,
          },
        })),

      addGroup: (projectId, name) => {
        const id = `lineage-group-${Date.now()}`;
        const current = get().treesByProject[projectId] || cloneDefaultTree();
        const newGroup: TreeItem = {
          id,
          type: 'folder',
          collapsed: false,
          data: { name: name?.trim() || '新建世系分组' },
          children: [],
        };
        set((state) => ({
          treesByProject: {
            ...state.treesByProject,
            [projectId]: [...current, newGroup],
          },
          selectedNodeIdByProject: {
            ...state.selectedNodeIdByProject,
            [projectId]: id,
          },
        }));
        return id;
      },

      addChart: (projectId, parentId, name) => {
        const id = `lineage-chart-${Date.now()}`;
        const chartName = name?.trim() || '新建世系图';
        const current = get().treesByProject[projectId] || cloneDefaultTree();
        const newChart: TreeItem = {
          id,
          type: 'chart',
          data: { name: chartName },
          children: [],
        };

        let nextTree: TreeItem[];
        if (parentId) {
          const insertIntoParent = (items: TreeItem[]): TreeItem[] =>
            items.map((item) => {
              if (item.id === parentId) {
                return {
                  ...item,
                  collapsed: false,
                  children: [...(item.children || []), newChart],
                };
              }
              if (item.children?.length) {
                return { ...item, children: insertIntoParent(item.children) };
              }
              return item;
            });
          nextTree = insertIntoParent(current);
        } else {
          nextTree = [...current, newChart];
        }

        const key = makeChartStorageKey(projectId, id);
        const seed = createSeedPersonsForChart(id, chartName);

        set((state) => ({
          treesByProject: {
            ...state.treesByProject,
            [projectId]: nextTree,
          },
          selectedNodeIdByProject: {
            ...state.selectedNodeIdByProject,
            [projectId]: id,
          },
          personsByChart: {
            ...state.personsByChart,
            [key]: seed,
          },
          selectedPersonIdByChart: {
            ...state.selectedPersonIdByChart,
            [key]: null,
          },
        }));
        return id;
      },

      renameNode: (projectId, id, name) =>
        set((state) => {
          const current =
            state.treesByProject[projectId] || cloneDefaultTree();
          const trimmed = name.trim();
          if (!trimmed) return state;
          const updated = setProperty(
            JSON.parse(JSON.stringify(current)),
            id,
            'data',
            (data) => ({ ...data, name: trimmed })
          );
          return {
            treesByProject: {
              ...state.treesByProject,
              [projectId]: updated,
            },
          };
        }),

      duplicateNode: (projectId, id) =>
        set((state) => {
          const current =
            state.treesByProject[projectId] || cloneDefaultTree();
          const suffix = String(Date.now()).slice(-4);
          const nextPersonsByChart = { ...state.personsByChart };

          const insertCopy = (items: TreeItem[]): TreeItem[] => {
            const result: TreeItem[] = [];
            for (const item of items) {
              if (item.id === id) {
                result.push(item);
                const cloned = cloneSubtreeWithNewIds(item, suffix);
                result.push(cloned);
                if (item.type === 'chart') {
                  const srcKey = makeChartStorageKey(projectId, String(item.id));
                  const dstKey = makeChartStorageKey(projectId, String(cloned.id));
                  const srcPersons =
                    state.personsByChart[srcKey] ||
                    createSeedPersonsForChart(String(item.id), item.data?.name);
                  nextPersonsByChart[dstKey] = JSON.parse(
                    JSON.stringify(srcPersons)
                  );
                }
              } else if (item.children?.length) {
                result.push({
                  ...item,
                  children: insertCopy(item.children),
                });
              } else {
                result.push(item);
              }
            }
            return result;
          };

          return {
            treesByProject: {
              ...state.treesByProject,
              [projectId]: insertCopy(current),
            },
            personsByChart: nextPersonsByChart,
          };
        }),

      removeNode: (projectId, id) =>
        set((state) => {
          const current =
            state.treesByProject[projectId] || cloneDefaultTree();
          const nextTree = removeItem(
            JSON.parse(JSON.stringify(current)),
            id
          );
          const currentSelected = state.selectedNodeIdByProject[projectId];
          const nextSelected =
            currentSelected === id
              ? findFirstChartId(nextTree) || String(nextTree[0]?.id || '')
              : currentSelected;
          const nextPersons = { ...state.personsByChart };
          delete nextPersons[makeChartStorageKey(projectId, id)];
          return {
            treesByProject: {
              ...state.treesByProject,
              [projectId]: nextTree,
            },
            selectedNodeIdByProject: {
              ...state.selectedNodeIdByProject,
              [projectId]: nextSelected,
            },
            personsByChart: nextPersons,
          };
        }),

      setViewMode: (projectId, mode) =>
        set((state) => ({
          viewModeByProject: {
            ...state.viewModeByProject,
            [projectId]: mode,
          },
        })),

      selectPerson: (projectId, chartId, personId) =>
        set((state) => ({
          selectedPersonIdByChart: {
            ...state.selectedPersonIdByChart,
            [makeChartStorageKey(projectId, chartId)]: personId,
          },
        })),

      addPerson: (projectId, chartId, person, chartName, surname) =>
        set((state) => {
          const key = makeChartStorageKey(projectId, chartId);
          const currentPersons =
            state.personsByChart[key] ||
            createSeedPersonsForChart(chartId, chartName, surname);
          return {
            personsByChart: {
              ...state.personsByChart,
              [key]: [...currentPersons, person],
            },
            selectedPersonIdByChart: {
              ...state.selectedPersonIdByChart,
              [key]: person.id,
            },
          };
        }),

      updatePerson: (projectId, chartId, personId, updates, chartName, surname) =>
        set((state) => {
          const key = makeChartStorageKey(projectId, chartId);
          const currentPersons =
            state.personsByChart[key] ||
            createSeedPersonsForChart(chartId, chartName, surname);
          return {
            personsByChart: {
              ...state.personsByChart,
              [key]: currentPersons.map((p) =>
                p.id === personId ? { ...p, ...updates } : p
              ),
            },
          };
        }),

      deletePerson: (projectId, chartId, personId, chartName, surname) =>
        set((state) => {
          const key = makeChartStorageKey(projectId, chartId);
          const currentPersons =
            state.personsByChart[key] ||
            createSeedPersonsForChart(chartId, chartName, surname);
          const toDelete = collectDescendantIds(currentPersons, personId);
          const remaining = currentPersons.filter((p) => !toDelete.has(p.id));
          const currentSel = state.selectedPersonIdByChart[key];
          return {
            personsByChart: {
              ...state.personsByChart,
              [key]: remaining,
            },
            selectedPersonIdByChart: {
              ...state.selectedPersonIdByChart,
              [key]: currentSel && toDelete.has(currentSel) ? null : currentSel,
            },
          };
        }),

      reorderSibling: (
        projectId,
        chartId,
        parentId,
        childId,
        direction,
        chartName,
        surname
      ) =>
        set((state) => {
          const key = makeChartStorageKey(projectId, chartId);
          const currentPersons =
            state.personsByChart[key] ||
            createSeedPersonsForChart(chartId, chartName, surname);

          const siblings = currentPersons
            .filter((p) => p.fatherId === parentId)
            .sort((a, b) => {
              const orderA = a.siblingOrder ?? a.biographyOrder ?? 50;
              const orderB = b.siblingOrder ?? b.biographyOrder ?? 50;
              return orderA - orderB;
            });

          const idx = siblings.findIndex((s) => s.id === childId);
          if (idx < 0) return state;
          const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
          if (targetIdx < 0 || targetIdx >= siblings.length) return state;

          const reordered = [...siblings];
          const [moved] = reordered.splice(idx, 1);
          reordered.splice(targetIdx, 0, moved);

          const orderMap = new Map<string, number>();
          reordered.forEach((sib, index) => {
            orderMap.set(sib.id, index + 1);
          });

          return {
            personsByChart: {
              ...state.personsByChart,
              [key]: currentPersons.map((p) => {
                const newOrder = orderMap.get(p.id);
                if (newOrder === undefined) return p;
                return {
                  ...p,
                  siblingOrder: newOrder,
                  biographyOrder: newOrder,
                };
              }),
            },
          };
        }),
    }),
    {
      name: 'nocoapp:lineage',
      version: 3,
      storage: createAppStorage(),
      migrate: (persistedState: unknown, version: number) => {
        const state = (persistedState as Partial<LineageState>) || {};
        if (version < 3) {
          return {
            ...state,
            selectedPersonIdByChart: {},
          };
        }
        return state;
      },
    }
  )
);

