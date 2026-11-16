export enum ViewMode {
  HOME = 'HOME',
  PROJECTS = 'PROJECTS',
  MEMBERS = 'MEMBERS',
  WORKSPACE_SETTINGS = 'WORKSPACE_SETTINGS',
  PROJECT_HOME = 'PROJECT_HOME',
  LINEAGE = 'LINEAGE',
  ARTICLES = 'ARTICLES',
  BOOKS = 'BOOKS',
  PROJECT_SETTINGS = 'PROJECT_SETTINGS',
}

export type AppTheme = 'vercel' | 'supabase' | 'slack' | 'vscode';
export type ThemeMode = 'system' | 'light' | 'dark';

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
  primarySurname?: string;
  region?: string;
  primaryName?: string;
  projectState?: '0' | '1';
  projectLevel?: number;
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

export interface UserProfile {
  name: string;
  email: string;
  avatar?: string;
  role?: string;
  bio?: string;
}
