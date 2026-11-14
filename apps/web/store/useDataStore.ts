import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { arrayMove } from '@dnd-kit/sortable';
import { DbTable, DbView, SchemaField } from '../types';
import { INITIAL_RECORDS, INITIAL_SCHEMAS } from './mockData';
import { createAppStorage } from './storageAdapter';

const DEFAULT_TABLE_PROJECT_MAP: Record<string, string> = {
  users: 'proj-getting-started',
  orders: 'proj-sales-crm',
  products: 'proj-inventory',
  inventory_logs: 'proj-supply-chain',
};

const INITIAL_TABLES: DbTable[] = [
  { id: 'users', projectId: 'proj-getting-started', name: 'Users', code: 'users', kind: 'table', description: 'System users' },
  { id: 'orders', projectId: 'proj-sales-crm', name: 'Orders', code: 'orders', kind: 'table', description: 'Customer orders' },
  { id: 'products', projectId: 'proj-inventory', name: 'Products', code: 'products', kind: 'table', description: 'Product catalog' },
  { id: 'inventory_logs', projectId: 'proj-supply-chain', name: 'Inventory Logs', code: 'inventory_logs', kind: 'table', description: 'Stock changes' },
];

const INITIAL_VIEWS: DbView[] = INITIAL_TABLES.map((table) => ({
  id: `view_${table.id}_default`,
  tableId: table.id,
  name: table.name,
  isDefault: true,
  config: {
    filters: [],
    sort: null,
    hiddenFields: [],
  },
}));

const cloneJson = <T>(val: T): T =>
  typeof structuredClone === 'function'
    ? structuredClone(val)
    : JSON.parse(JSON.stringify(val));

interface DataState {
  tables: DbTable[];
  dataViewMode: 'DATA' | 'MODEL';
  schemas: Record<string, SchemaField[]>;
  records: Record<string, Record<string, any>[]>;
  views: DbView[];
  activeViewId: string | null;

  setTables: (tables: DbTable[]) => void;
  setDataViewMode: (mode: 'DATA' | 'MODEL') => void;
  addTable: (table: DbTable, schema?: SchemaField[], initialRecords?: Record<string, any>[]) => void;
  duplicateTable: (id: string) => string | null;
  updateTable: (id: string, updates: Partial<DbTable>) => void;
  deleteTable: (id: string) => string | null;
  reorderTables: (tables: DbTable[]) => void;

  setTableSchema: (tableId: string, schema: SchemaField[]) => void;
  addTableColumn: (tableId: string, column: SchemaField) => void;
  updateTableColumn: (tableId: string, columnId: string, updates: Partial<SchemaField>) => void;
  deleteTableColumn: (tableId: string, columnIdOrIds: string | (string | number)[]) => void;

  setTableRecords: (tableId: string, records: Record<string, any>[]) => void;
  addTableRecord: (tableId: string, record: Record<string, any>) => void;
  updateTableRecord: (tableId: string, recordId: string | number, updates: Record<string, any>) => void;
  updateTableCell: (tableId: string, rowId: string | number, colId: string, value: any) => void;
  deleteTableRecords: (tableId: string, recordIds: (string | number)[]) => void;
  reorderTableRecords: (tableId: string, activeId: string, overId: string) => void;

  setViews: (views: DbView[]) => void;
  addView: (view: DbView) => void;
  updateView: (id: string, updates: Partial<DbView>) => void;
  deleteView: (id: string) => void;
  duplicateView: (id: string) => void;
  setActiveViewId: (id: string | null) => void;
}

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => ({
      tables: INITIAL_TABLES,
      dataViewMode: 'DATA',
      schemas: INITIAL_SCHEMAS,
      records: INITIAL_RECORDS,
      views: INITIAL_VIEWS,
      activeViewId: INITIAL_VIEWS[0]?.id || null,

      setTables: (tables) => set({ tables }),
      setDataViewMode: (dataViewMode) => set({ dataViewMode }),

      addTable: (table, schema, initialRecords) =>
        set((state) => {
          const defaultView: DbView = {
            id: `view_${table.id}_default`,
            tableId: table.id,
            name: table.name,
            isDefault: true,
            config: { filters: [], sort: null, hiddenFields: [] },
          };

          const tableSchema: SchemaField[] =
            schema && schema.length > 0
              ? schema
              : [
                  {
                    id: 'id',
                    name: 'ID',
                    type: 'serial',
                    width: 60,
                    iconName: 'key',
                    isPrimary: true,
                    isUnique: true,
                    isNullable: false,
                    defaultValue: 'auto-inc',
                  },
                ];

          return {
            tables: [...state.tables, table],
            views: [...state.views, defaultView],
            activeViewId: defaultView.id,
            schemas: { ...state.schemas, [table.id]: tableSchema },
            records: { ...state.records, [table.id]: initialRecords || [] },
          };
        }),

      duplicateTable: (id) => {
        const state = get();
        const table = state.tables.find((t) => t.id === id);
        if (!table) return null;

        const timestamp = Date.now();
        const newId = `${table.code}_copy_${timestamp}`;
        const newTable: DbTable = {
          ...table,
          id: newId,
          name: `${table.name} Copy`,
          code: `${table.code}_copy_${timestamp}`.substring(0, 50),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const clonedSchema = cloneJson(state.schemas[id] || []);
        const clonedRecords = cloneJson(state.records[id] || []);
        const tableViews = state.views.filter((v) => v.tableId === id);
        const newViews = tableViews.map((v, idx) => ({
          ...cloneJson(v),
          id: `view_${newId}_${timestamp}_${idx}`,
          tableId: newId,
          name: v.isDefault ? newTable.name : `${v.name} Copy`,
        }));

        set({
          tables: [...state.tables, newTable],
          views: [...state.views, ...newViews],
          schemas: { ...state.schemas, [newId]: clonedSchema },
          records: { ...state.records, [newId]: clonedRecords },
          activeViewId: newViews[0]?.id || null,
        });

        return newId;
      },

      updateTable: (id, updates) =>
        set((state) => {
          const updatedTables = state.tables.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          );
          const updatedViews = updates.name
            ? state.views.map((v) =>
                v.tableId === id && v.isDefault ? { ...v, name: updates.name! } : v
              )
            : state.views;

          return { tables: updatedTables, views: updatedViews };
        }),

      deleteTable: (id) => {
        const state = get();
        const { [id]: _removedSchema, ...remainingSchemas } = state.schemas;
        const { [id]: _removedRecords, ...remainingRecords } = state.records;
        const remainingTables = state.tables.filter((t) => t.id !== id);
        const nextTableId = remainingTables[0]?.id || null;

        set({
          tables: remainingTables,
          views: state.views.filter((v) => v.tableId !== id),
          schemas: remainingSchemas,
          records: remainingRecords,
        });

        return nextTableId;
      },

      reorderTables: (tables) => set({ tables }),

      setTableSchema: (tableId, schema) =>
        set((state) => ({
          schemas: { ...state.schemas, [tableId]: schema },
        })),

      addTableColumn: (tableId, column) =>
        set((state) => {
          const currentSchema = state.schemas[tableId] || [];
          return {
            schemas: { ...state.schemas, [tableId]: [...currentSchema, column] },
          };
        }),

      updateTableColumn: (tableId, columnId, updates) =>
        set((state) => {
          const currentSchema = state.schemas[tableId] || [];
          return {
            schemas: {
              ...state.schemas,
              [tableId]: currentSchema.map((col) =>
                col.id === columnId ? { ...col, ...updates } : col
              ),
            },
          };
        }),

      deleteTableColumn: (tableId, columnIdOrIds) =>
        set((state) => {
          const idsToDelete = new Set(
            Array.isArray(columnIdOrIds)
              ? columnIdOrIds.map(String)
              : [String(columnIdOrIds)]
          );
          const currentSchema = state.schemas[tableId] || [];
          return {
            schemas: {
              ...state.schemas,
              [tableId]: currentSchema.filter(
                (col) => !idsToDelete.has(String(col.id))
              ),
            },
          };
        }),

      setTableRecords: (tableId, tableRecords) =>
        set((state) => ({
          records: { ...state.records, [tableId]: tableRecords },
        })),

      addTableRecord: (tableId, record) =>
        set((state) => {
          const currentRecords = state.records[tableId] || [];
          const maxId = Math.max(...currentRecords.map((r) => Number(r.id) || 0), 0);
          const newRecord = { id: record.id || maxId + 1, ...record };
          return {
            records: {
              ...state.records,
              [tableId]: [...currentRecords, newRecord],
            },
          };
        }),

      updateTableRecord: (tableId, recordId, updates) =>
        set((state) => {
          const currentRecords = state.records[tableId] || [];
          return {
            records: {
              ...state.records,
              [tableId]: currentRecords.map((rec) =>
                rec.id === recordId ? { ...rec, ...updates } : rec
              ),
            },
          };
        }),

      updateTableCell: (tableId, rowId, colId, value) =>
        set((state) => {
          const currentRecords = state.records[tableId] || [];
          return {
            records: {
              ...state.records,
              [tableId]: currentRecords.map((rec) =>
                rec.id === rowId ? { ...rec, [colId]: value } : rec
              ),
            },
          };
        }),

      deleteTableRecords: (tableId, recordIds) =>
        set((state) => {
          const idsToDelete = new Set(recordIds.map(String));
          const currentRecords = state.records[tableId] || [];
          return {
            records: {
              ...state.records,
              [tableId]: currentRecords.filter(
                (rec) => !idsToDelete.has(String(rec.id))
              ),
            },
          };
        }),

      reorderTableRecords: (tableId, activeId, overId) =>
        set((state) => {
          const currentRecords = state.records[tableId] || [];
          const oldIndex = currentRecords.findIndex(
            (r) => String(r.id) === String(activeId)
          );
          const newIndex = currentRecords.findIndex(
            (r) => String(r.id) === String(overId)
          );
          if (oldIndex === -1 || newIndex === -1) return {};
          return {
            records: {
              ...state.records,
              [tableId]: arrayMove(currentRecords, oldIndex, newIndex),
            },
          };
        }),

      setViews: (views) => set({ views }),
      addView: (view) =>
        set((state) => ({ views: [...state.views, view], activeViewId: view.id })),
      updateView: (id, updates) =>
        set((state) => ({
          views: state.views.map((v) => (v.id === id ? { ...v, ...updates } : v)),
        })),
      deleteView: (id) =>
        set((state) => ({
          views: state.views.filter((v) => v.id !== id),
          activeViewId: state.activeViewId === id ? null : state.activeViewId,
        })),
      duplicateView: (id) =>
        set((state) => {
          const view = state.views.find((v) => v.id === id);
          if (!view) return {};
          const newView: DbView = {
            ...cloneJson(view),
            id: `view_${view.tableId}_${Date.now()}`,
            name: `${view.name} Copy`,
            isDefault: false,
          };
          return { views: [...state.views, newView] };
        }),
      setActiveViewId: (activeViewId) => set({ activeViewId }),
    }),
    {
      name: 'nocoapp:data',
      version: 2,
      storage: createAppStorage(),
      migrate: (persistedState: any) => {
        if (!persistedState || !Array.isArray(persistedState.tables)) {
          return persistedState;
        }
        return {
          ...persistedState,
          tables: persistedState.tables.map((t: DbTable) => ({
            ...t,
            projectId:
              t.projectId ||
              DEFAULT_TABLE_PROJECT_MAP[t.id] ||
              'proj-getting-started',
          })),
        };
      },
    }
  )
);
