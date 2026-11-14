import { useLocation, useMatch } from 'react-router-dom';
import { ViewMode } from '../types';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { useDataStore } from '../store/useDataStore';

export interface RouteContext {
  activeView: ViewMode;
  activeProjectId: string;
  appId: string;
  activePageId: string;
  activeTableId: string;
  datasourceId?: string;
  isWorkspaceShell: boolean;
}

export const useRouteContext = (): RouteContext => {
  const { pathname } = useLocation();
  const projectHomeMatch = useMatch('/projects/:projectId');
  const projectDataMatch = useMatch('/projects/:projectId/data/:tableId');
  const projectDatasourcesMatch = useMatch('/projects/:projectId/datasources');
  const projectPgNewMatch = useMatch('/projects/:projectId/datasources/postgresql');
  const projectPgMatch = useMatch('/projects/:projectId/datasources/postgresql/:id');
  const projectFilesMatch = useMatch('/projects/:projectId/files');
  const projectSettingsMatch = useMatch('/projects/:projectId/settings');
  const projectAppPageMatch = useMatch('/projects/:projectId/apps/:appId/pages/:pageId');
  const projectAppMatch = useMatch('/projects/:projectId/apps/:appId');

  const appPageMatch = useMatch('/apps/:appId/pages/:pageId');
  const appMatch = useMatch('/apps/:appId');
  const dataMatch = useMatch('/data/:tableId');
  const pgMatch = useMatch('/datasources/postgresql/:id');

  const storedProjectId = useWorkspaceStore((s) => s.activeProjectId);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const projects = useWorkspaceStore((s) => s.projects);
  const tables = useDataStore((s) => s.tables);

  let activeView = ViewMode.PROJECTS;
  let isWorkspaceShell = true;

  const matchedTableId =
    projectDataMatch?.params.tableId || dataMatch?.params.tableId || '';

  const matchedProjectId =
    projectHomeMatch?.params.projectId ||
    projectDataMatch?.params.projectId ||
    projectDatasourcesMatch?.params.projectId ||
    projectPgNewMatch?.params.projectId ||
    projectPgMatch?.params.projectId ||
    projectFilesMatch?.params.projectId ||
    projectSettingsMatch?.params.projectId ||
    projectAppPageMatch?.params.projectId ||
    projectAppMatch?.params.projectId ||
    '';

  if (pathname === '/home') {
    activeView = ViewMode.HOME;
  } else if (pathname === '/' || pathname === '/projects') {
    activeView = ViewMode.PROJECTS;
  } else if (pathname.startsWith('/members')) {
    activeView = ViewMode.MEMBERS;
  } else if (pathname.startsWith('/settings')) {
    activeView = ViewMode.WORKSPACE_SETTINGS;
  } else if (projectSettingsMatch) {
    activeView = ViewMode.PROJECT_SETTINGS;
    isWorkspaceShell = false;
  } else if (projectFilesMatch || pathname.startsWith('/files')) {
    activeView = ViewMode.SETTINGS;
    isWorkspaceShell = false;
  } else if (
    projectDatasourcesMatch ||
    projectPgNewMatch ||
    projectPgMatch ||
    pathname.startsWith('/datasources')
  ) {
    activeView = ViewMode.DATASOURCE;
    isWorkspaceShell = false;
  } else if (
    projectAppPageMatch ||
    projectAppMatch ||
    pathname.startsWith('/apps')
  ) {
    activeView = ViewMode.APPS;
    isWorkspaceShell = false;
  } else if (projectDataMatch || pathname.startsWith('/data')) {
    activeView = ViewMode.DATA;
    isWorkspaceShell = false;
  } else if (projectHomeMatch) {
    activeView = ViewMode.PROJECT_HOME;
    isWorkspaceShell = false;
  }

  const tableProjectId = matchedTableId
    ? tables.find((t) => t.id === matchedTableId)?.projectId
    : undefined;

  const fallbackWorkspaceProjectId =
    projects.find((p) => p.workspaceId === activeWorkspaceId)?.id ||
    projects[0]?.id ||
    'proj-getting-started';

  const resolvedProjectId =
    matchedProjectId ||
    tableProjectId ||
    (projects.some((p) => p.id === storedProjectId)
      ? storedProjectId
      : fallbackWorkspaceProjectId);

  return {
    activeView,
    activeProjectId: resolvedProjectId,
    appId:
      projectAppPageMatch?.params.appId ||
      projectAppMatch?.params.appId ||
      appPageMatch?.params.appId ||
      appMatch?.params.appId ||
      'app-order-mgmt',
    activePageId:
      projectAppPageMatch?.params.pageId || appPageMatch?.params.pageId || '',
    activeTableId: matchedTableId,
    datasourceId: projectPgMatch?.params.id || pgMatch?.params.id,
    isWorkspaceShell,
  };
};
