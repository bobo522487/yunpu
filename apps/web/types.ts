export enum FileType {
  FILE = 'FILE',
  FOLDER = 'FOLDER',
}

export interface FileSystemNode {
  id: string;
  name: string;
  type: FileType;
  content?: string;
  isOpen?: boolean;
  children?: FileSystemNode[];
  language?: string;
}

export enum ViewMode {
  HOME = 'HOME',
  PROJECTS = 'PROJECTS',
  MEMBERS = 'MEMBERS',
  WORKSPACE_SETTINGS = 'WORKSPACE_SETTINGS',
  PROJECT_HOME = 'PROJECT_HOME',
  PROJECT_SETTINGS = 'PROJECT_SETTINGS',
  APPS = 'APPS',
  DATA = 'DATA',
  DATASOURCE = 'DATASOURCE',
  SETTINGS = 'SETTINGS',
}

export type AppTheme = 'vercel' | 'supabase' | 'slack' | 'vscode';
export type ThemeMode = 'system' | 'light' | 'dark';
export type DeviceType = 'desktop' | 'tablet' | 'mobile';
export type Breakpoint = 'lg' | 'md' | 'sm' | 'xs' | 'xxs';

export interface Workspace {
  id: string;
  name: string;
  kind: 'personal' | 'team';
  color: string;
  plan: string;
  createdAt: string;
}

export type AssetColorTheme = 'sky' | 'pink' | 'orange' | 'indigo' | 'emerald' | 'violet';

export interface ProjectItem {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  colorTheme: AssetColorTheme;
  ownerType: 'owned' | 'shared';
  defaultTableId: string;
  updatedAt: string;
}

export interface AppItem {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  colorTheme: AssetColorTheme;
  ownerType: 'owned' | 'shared';
  defaultPageId: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  name: string;
  email: string;
  role: '所有者' | '管理员' | '编辑者' | '查看者';
  joinedAt: string;
  avatarColor: string;
}

export interface WorkspaceNotification {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
}

export interface Tab {
  id: string;
  fileId: string;
  title: string;
  isDirty?: boolean;
}

export interface QueryConfig {
  id?: string;
  type?: string;
  definition: {
    source?: string;
    tableId?: string;
    select?: string[];
    orderBy?: string;
    orderDir?: 'asc' | 'desc';
    limit?: number;
    [key: string]: any;
  };
}

export interface Page {
  id: string;
  name: string;
  type: 'page' | 'folder';
  parentId?: string;
  isOpen?: boolean;
  icon: string;
  isHome: boolean;
  isHidden: boolean;
  isDisabled: boolean;
  height: string;
  content?: {
    state?: Record<string, any>;
    queries?: Record<string, QueryConfig>;
    lifecycle?: {
      onMount?: any[];
    };
    [key: string]: any;
  };
}

export interface DbTable {
  id: string;
  orgId?: string;
  projectId?: string;
  sourceId?: string;
  name: string;
  code: string;
  physicalName?: string;
  kind: 'table' | 'view';
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface FilterRule {
  id: string;
  fieldId: string;
  operator: 'contains' | 'equals' | 'startsWith' | 'endsWith';
  value: string;
}

export interface SortRule {
  fieldId: string;
  direction: 'asc' | 'desc';
}

export interface ViewConfig {
  filters: FilterRule[];
  sort: SortRule | null;
  hiddenFields: string[];
}

export interface DbView {
  id: string;
  tableId: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  config: ViewConfig;
}

/**
 * Pure geometric layout coordinates per breakpoint (no duplicated widget content).
 */
export interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

/**
 * Single source of truth for a widget's semantic definition & properties on a page.
 */
export interface WidgetInstance {
  id: string;
  type: string;
  title?: string;
  content: Record<string, any>;
}

export type PageLayouts = Partial<Record<Breakpoint, LayoutItem[]>>;

/**
 * Derived view model joining WidgetInstance + LayoutItem for Canvas / PropertyPanel / Widgets.
 */
export interface GridItemData extends LayoutItem {
  type: string;
  title?: string;
  content: Record<string, any>;
}

export type SchemaFieldType =
  | 'serial'
  | 'varchar'
  | 'int'
  | 'bigint'
  | 'float'
  | 'boolean'
  | 'date with time'
  | 'jsonb';

export type FieldIconKey =
  | 'key'
  | 'text'
  | 'mail'
  | 'check'
  | 'calendar'
  | 'dollar'
  | 'package'
  | 'cart'
  | 'arrowUpDown'
  | 'hash'
  | 'toggle'
  | 'braces';

export interface ForeignKeyConfig {
  targetTableId: string;
  targetColumnId: string;
  onUpdate: string;
  onDelete: string;
}

export interface SchemaField {
  id: string;
  name: string;
  type: SchemaFieldType;
  defaultValue: string;
  isPrimary: boolean;
  isForeignKey?: boolean;
  foreignKeyConfig?: ForeignKeyConfig;
  isUnique: boolean;
  isNullable: boolean;
  description?: string;
  flex?: boolean;
  width?: number;
  iconName?: FieldIconKey;
  timeZone?: string;
}

export interface UserProfile {
  name: string;
  email: string;
  avatar?: string;
  role?: string;
  bio?: string;
}