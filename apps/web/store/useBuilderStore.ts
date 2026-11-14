import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Breakpoint,
  DeviceType,
  GridItemData,
  LayoutItem,
  Page,
  PageLayouts,
  WidgetInstance,
} from '../types';
import { createAppStorage } from './storageAdapter';

export const BREAKPOINTS: Breakpoint[] = ['lg', 'md', 'sm', 'xs', 'xxs'];

export const BREAKPOINT_COLS: Record<Breakpoint, number> = {
  lg: 12,
  md: 10,
  sm: 6,
  xs: 4,
  xxs: 2,
};

export const getBreakpointForDevice = (device: DeviceType): Breakpoint => {
  switch (device) {
    case 'mobile':
      return 'xxs';
    case 'tablet':
      return 'sm';
    case 'desktop':
    default:
      return 'lg';
  }
};

export const resolveCanvasItems = (
  widgetsById: Record<string, WidgetInstance> | undefined,
  layouts: PageLayouts | undefined,
  breakpoint: Breakpoint = 'lg'
): GridItemData[] => {
  if (!widgetsById || !layouts) return [];
  const bpLayout = layouts[breakpoint] ?? layouts.lg ?? [];
  return bpLayout
    .map((layoutItem): GridItemData | null => {
      const widget = widgetsById[layoutItem.i];
      if (!widget) return null;
      return {
        ...layoutItem,
        type: widget.type,
        title: widget.title,
        content: widget.content,
      };
    })
    .filter((item): item is GridItemData => item !== null);
};

const INITIAL_PAGES: Page[] = [
  { id: 'page-1', name: 'Dashboard', type: 'page', icon: 'LayoutGrid', isHome: true, isHidden: false, isDisabled: false, height: '800' },
  { id: 'page-2', name: 'Orders', type: 'page', icon: 'ShoppingCart', isHome: false, isHidden: false, isDisabled: false, height: '1000' },
  { id: 'page-3', name: 'Settings', type: 'page', icon: 'Settings', isHome: false, isHidden: false, isDisabled: false, height: '600' },
];

const INITIAL_WIDGETS_BY_PAGE: Record<string, Record<string, WidgetInstance>> = {
  'page-1': {
    stat1: { id: 'stat1', type: 'stat', title: 'Total Revenue', content: { value: '$45,231.89', trend: '+20.1%' } },
    stat2: { id: 'stat2', type: 'stat', title: 'Subscriptions', content: { value: '+2350', trend: '+180.1%' } },
    stat3: { id: 'stat3', type: 'stat', title: 'Sales', content: { value: '+12,234', trend: '+19%' } },
    chart1: {
      id: 'chart1',
      type: 'chart',
      title: 'Revenue Overview',
      content: { _query: { definition: { source: 'managed', tableId: 'orders', select: ['date', 'amount'] } } },
    },
    list1: {
      id: 'list1',
      type: 'table',
      title: 'Recent Sales',
      content: { _query: { definition: { source: 'managed', tableId: 'orders', limit: 5 } } },
    },
  },
  'page-2': {},
  'page-3': {},
};

const INITIAL_LAYOUTS_BY_PAGE: Record<string, PageLayouts> = {
  'page-1': {
    lg: [
      { i: 'stat1', x: 0, y: 0, w: 3, h: 3 },
      { i: 'stat2', x: 3, y: 0, w: 3, h: 3 },
      { i: 'stat3', x: 6, y: 0, w: 3, h: 3 },
      { i: 'chart1', x: 0, y: 3, w: 8, h: 8 },
      { i: 'list1', x: 8, y: 3, w: 4, h: 8 },
    ],
  },
  'page-2': { lg: [] },
  'page-3': { lg: [] },
};

const cloneJson = <T>(val: T): T =>
  typeof structuredClone === 'function'
    ? structuredClone(val)
    : JSON.parse(JSON.stringify(val));

const collectDescendantPageIds = (pages: Page[], rootId: string): Set<string> => {
  const ids = new Set<string>([rootId]);
  let added = true;
  while (added) {
    added = false;
    for (const page of pages) {
      if (page.parentId && ids.has(page.parentId) && !ids.has(page.id)) {
        ids.add(page.id);
        added = true;
      }
    }
  }
  return ids;
};

interface BuilderState {
  pages: Page[];
  widgetsByPage: Record<string, Record<string, WidgetInstance>>;
  layoutsByPage: Record<string, PageLayouts>;
  selectedComponentId: string | null;
  draggedWidget: any | null;
  droppedWidget: any | null;

  setPages: (pages: Page[]) => void;
  addPage: (page: Page) => void;
  updatePage: (id: string, updates: Partial<Page>) => void;
  duplicatePage: (id: string) => void;
  deletePage: (id: string) => void;
  togglePageFolder: (id: string) => void;
  reorderPages: (pages: Page[]) => void;

  setSelectedComponentId: (id: string | null) => void;
  setDraggedWidget: (widget: any | null) => void;
  setDroppedWidget: (widget: any | null) => void;

  addWidget: (
    pageId: string,
    widget: WidgetInstance,
    geometry: Omit<LayoutItem, 'i'>,
    activeBreakpoint?: Breakpoint
  ) => void;
  updateWidget: (
    pageId: string,
    widgetId: string,
    updates: Partial<Omit<WidgetInstance, 'id'>>
  ) => void;
  updateLayoutGeometry: (
    pageId: string,
    breakpoint: Breakpoint,
    widgetId: string,
    updates: Partial<Omit<LayoutItem, 'i'>>
  ) => void;
  duplicateWidget: (pageId: string, widgetId: string) => string | null;
  deleteWidget: (pageId: string, widgetId: string) => void;
  setPageLayouts: (pageId: string, layouts: PageLayouts) => void;
  clearPageCanvas: (pageId: string) => void;
}

export const useBuilderStore = create<BuilderState>()(
  persist(
    (set, get) => ({
      pages: INITIAL_PAGES,
      widgetsByPage: INITIAL_WIDGETS_BY_PAGE,
      layoutsByPage: INITIAL_LAYOUTS_BY_PAGE,
      selectedComponentId: null,
      draggedWidget: null,
      droppedWidget: null,

      setPages: (pages) => set({ pages }),

      addPage: (page) =>
        set((state) => ({
          pages: [...state.pages, page],
          widgetsByPage: {
            ...state.widgetsByPage,
            [page.id]: state.widgetsByPage[page.id] || {},
          },
          layoutsByPage: {
            ...state.layoutsByPage,
            [page.id]: state.layoutsByPage[page.id] || { lg: [] },
          },
        })),

      updatePage: (id, updates) =>
        set((state) => ({
          pages: state.pages.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        })),

      duplicatePage: (id) =>
        set((state) => {
          const cloneSubtree = (
            pageId: string,
            newParentId?: string
          ): {
            pages: Page[];
            widgetsByPage: Record<string, Record<string, WidgetInstance>>;
            layoutsByPage: Record<string, PageLayouts>;
          } => {
            const page = state.pages.find((p) => p.id === pageId);
            if (!page) {
              return { pages: [], widgetsByPage: {}, layoutsByPage: {} };
            }

            const newId = `page-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const newPage: Page = {
              ...cloneJson(page),
              id: newId,
              parentId: newParentId ?? page.parentId,
              name: newParentId ? page.name : `${page.name} Copy`,
              isHome: false,
            };

            const origWidgets = state.widgetsByPage[pageId] || {};
            const idMap = new Map<string, string>();
            const newWidgets: Record<string, WidgetInstance> = {};

            Object.values(origWidgets).forEach((widget) => {
              const newWidgetId = `${widget.type}-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 9)}`;
              idMap.set(widget.id, newWidgetId);
              newWidgets[newWidgetId] = {
                ...cloneJson(widget),
                id: newWidgetId,
              };
            });

            const origLayouts = state.layoutsByPage[pageId] || { lg: [] };
            const newLayouts: PageLayouts = {};
            (Object.keys(origLayouts) as Breakpoint[]).forEach((bp) => {
              const items = origLayouts[bp];
              if (!items) return;
              newLayouts[bp] = items.map((item) => ({
                ...item,
                i: idMap.get(item.i) || item.i,
              }));
            });

            let resultPages = [newPage];
            let resultWidgets = { [newId]: newWidgets };
            let resultLayouts = { [newId]: newLayouts };

            const children = state.pages.filter((p) => p.parentId === pageId);
            children.forEach((child) => {
              const childClone = cloneSubtree(child.id, newId);
              resultPages = [...resultPages, ...childClone.pages];
              resultWidgets = { ...resultWidgets, ...childClone.widgetsByPage };
              resultLayouts = { ...resultLayouts, ...childClone.layoutsByPage };
            });

            return {
              pages: resultPages,
              widgetsByPage: resultWidgets,
              layoutsByPage: resultLayouts,
            };
          };

          const cloned = cloneSubtree(id);
          return {
            pages: [...state.pages, ...cloned.pages],
            widgetsByPage: { ...state.widgetsByPage, ...cloned.widgetsByPage },
            layoutsByPage: { ...state.layoutsByPage, ...cloned.layoutsByPage },
          };
        }),

      deletePage: (id) =>
        set((state) => {
          const idsToRemove = collectDescendantPageIds(state.pages, id);
          const nextWidgetsByPage = { ...state.widgetsByPage };
          const nextLayoutsByPage = { ...state.layoutsByPage };
          idsToRemove.forEach((pid) => {
            delete nextWidgetsByPage[pid];
            delete nextLayoutsByPage[pid];
          });
          return {
            pages: state.pages.filter((p) => !idsToRemove.has(p.id)),
            widgetsByPage: nextWidgetsByPage,
            layoutsByPage: nextLayoutsByPage,
          };
        }),

      togglePageFolder: (id) =>
        set((state) => ({
          pages: state.pages.map((p) =>
            p.id === id ? { ...p, isOpen: !p.isOpen } : p
          ),
        })),

      reorderPages: (pages) => set({ pages }),

      setSelectedComponentId: (selectedComponentId) => set({ selectedComponentId }),
      setDraggedWidget: (draggedWidget) => set({ draggedWidget }),
      setDroppedWidget: (droppedWidget) => set({ droppedWidget }),

      addWidget: (pageId, widget, geometry) =>
        set((state) => {
          const pageWidgets = state.widgetsByPage[pageId] || {};
          const currentLayouts = state.layoutsByPage[pageId] || { lg: [] };
          const nextLayouts: PageLayouts = { ...currentLayouts };

          BREAKPOINTS.forEach((bp) => {
            const baseList = nextLayouts[bp] || nextLayouts.lg || [];
            if (baseList.some((item) => item.i === widget.id)) return;
            const maxCols = BREAKPOINT_COLS[bp];
            const clampedW = Math.min(geometry.w, maxCols);
            const clampedX = Math.max(0, Math.min(geometry.x, maxCols - clampedW));
            nextLayouts[bp] = [
              ...baseList,
              {
                ...geometry,
                i: widget.id,
                x: clampedX,
                w: clampedW,
              },
            ];
          });

          return {
            widgetsByPage: {
              ...state.widgetsByPage,
              [pageId]: {
                ...pageWidgets,
                [widget.id]: widget,
              },
            },
            layoutsByPage: {
              ...state.layoutsByPage,
              [pageId]: nextLayouts,
            },
            selectedComponentId: widget.id,
          };
        }),

      updateWidget: (pageId, widgetId, updates) =>
        set((state) => {
          const pageWidgets = state.widgetsByPage[pageId];
          const existing = pageWidgets?.[widgetId];
          if (!existing) return {};

          return {
            widgetsByPage: {
              ...state.widgetsByPage,
              [pageId]: {
                ...pageWidgets,
                [widgetId]: {
                  ...existing,
                  ...updates,
                  content: updates.content ?? existing.content,
                },
              },
            },
          };
        }),

      updateLayoutGeometry: (pageId, breakpoint, widgetId, updates) =>
        set((state) => {
          const currentLayouts = state.layoutsByPage[pageId] || { lg: [] };
          const sourceList = currentLayouts[breakpoint] || currentLayouts.lg || [];
          const maxCols = BREAKPOINT_COLS[breakpoint];
          const updatedList = sourceList.map((item) => {
            if (item.i !== widgetId) return item;
            const nextW = updates.w !== undefined ? Math.min(updates.w, maxCols) : item.w;
            return { ...item, ...updates, w: nextW };
          });

          return {
            layoutsByPage: {
              ...state.layoutsByPage,
              [pageId]: {
                ...currentLayouts,
                [breakpoint]: updatedList,
              },
            },
          };
        }),

      duplicateWidget: (pageId, widgetId) => {
        const state = get();
        const pageWidgets = state.widgetsByPage[pageId];
        const origWidget = pageWidgets?.[widgetId];
        if (!origWidget) return null;

        const newId = `${origWidget.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const clonedWidget: WidgetInstance = {
          ...cloneJson(origWidget),
          id: newId,
        };

        const currentLayouts = state.layoutsByPage[pageId] || { lg: [] };
        const nextLayouts: PageLayouts = {};
        (Object.keys(currentLayouts) as Breakpoint[]).forEach((bp) => {
          const list = currentLayouts[bp] || [];
          const origLayout = list.find((l) => l.i === widgetId);
          nextLayouts[bp] = origLayout
            ? [...list, { ...origLayout, i: newId, y: Infinity }]
            : list;
        });

        set({
          widgetsByPage: {
            ...state.widgetsByPage,
            [pageId]: {
              ...pageWidgets,
              [newId]: clonedWidget,
            },
          },
          layoutsByPage: {
            ...state.layoutsByPage,
            [pageId]: nextLayouts,
          },
          selectedComponentId: newId,
        });

        return newId;
      },

      deleteWidget: (pageId, widgetId) =>
        set((state) => {
          const pageWidgets = { ...(state.widgetsByPage[pageId] || {}) };
          delete pageWidgets[widgetId];

          const currentLayouts = state.layoutsByPage[pageId] || {};
          const nextLayouts: PageLayouts = {};
          (Object.keys(currentLayouts) as Breakpoint[]).forEach((bp) => {
            const list = currentLayouts[bp];
            if (list) {
              nextLayouts[bp] = list.filter((item) => item.i !== widgetId);
            }
          });

          return {
            widgetsByPage: {
              ...state.widgetsByPage,
              [pageId]: pageWidgets,
            },
            layoutsByPage: {
              ...state.layoutsByPage,
              [pageId]: nextLayouts,
            },
            selectedComponentId:
              state.selectedComponentId === widgetId ? null : state.selectedComponentId,
          };
        }),

      setPageLayouts: (pageId, layouts) =>
        set((state) => ({
          layoutsByPage: {
            ...state.layoutsByPage,
            [pageId]: layouts,
          },
        })),

      clearPageCanvas: (pageId) =>
        set((state) => ({
          widgetsByPage: {
            ...state.widgetsByPage,
            [pageId]: {},
          },
          layoutsByPage: {
            ...state.layoutsByPage,
            [pageId]: { lg: [] },
          },
          selectedComponentId: null,
        })),
    }),
    {
      name: 'nocoapp:builder',
      version: 1,
      storage: createAppStorage(),
      partialize: (state) => ({
        pages: state.pages,
        widgetsByPage: state.widgetsByPage,
        layoutsByPage: state.layoutsByPage,
      }),
    }
  )
);
