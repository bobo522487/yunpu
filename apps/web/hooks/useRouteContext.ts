import { useLocation, useMatch } from 'react-router-dom';
import { ViewMode } from '../types';
import { useWorkspaceStore } from '../store/useWorkspaceStore';

export interface RouteContext {
  activeView: ViewMode;
  activeProjectId: string;
  isWorkspaceShell: boolean;
}

export const useRouteContext = (): RouteContext => {
  const { pathname } = useLocation();
  const projectHomeMatch = useMatch('/projects/:projectId');
  const projectLineageMatch = useMatch('/projects/:projectId/lineage');
  const projectArticlesMatch = useMatch('/projects/:projectId/articles');
  const projectBooksMatch = useMatch('/projects/:projectId/books');
  const projectSettingsMatch = useMatch('/projects/:projectId/settings');

  const storedProjectId = useWorkspaceStore((s) => s.activeProjectId);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const projects = useWorkspaceStore((s) => s.projects);

  let activeView = ViewMode.PROJECTS;
  let isWorkspaceShell = true;

  const matchedProjectId =
    projectHomeMatch?.params.projectId ||
    projectLineageMatch?.params.projectId ||
    projectArticlesMatch?.params.projectId ||
    projectBooksMatch?.params.projectId ||
    projectSettingsMatch?.params.projectId ||
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
  } else if (projectLineageMatch) {
    activeView = ViewMode.LINEAGE;
    isWorkspaceShell = false;
  } else if (projectArticlesMatch) {
    activeView = ViewMode.ARTICLES;
    isWorkspaceShell = false;
  } else if (projectBooksMatch) {
    activeView = ViewMode.BOOKS;
    isWorkspaceShell = false;
  } else if (projectHomeMatch) {
    activeView = ViewMode.PROJECT_HOME;
    isWorkspaceShell = false;
  }

  const fallbackWorkspaceProjectId =
    projects.find((p) => p.workspaceId === activeWorkspaceId)?.id ||
    projects[0]?.id ||
    '';

  const resolvedProjectId =
    matchedProjectId ||
    (projects.some((p) => p.id === storedProjectId)
      ? storedProjectId
      : fallbackWorkspaceProjectId);

  return {
    activeView,
    activeProjectId: resolvedProjectId,
    isWorkspaceShell,
  };
};
