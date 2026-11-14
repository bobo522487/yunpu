import React, { useEffect } from 'react';
import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';
import ProjectMiniRail from '../components/layout/ProjectMiniRail';
import ProjectSidebar from '../components/layout/ProjectSidebar';
import ProjectTopbar from '../components/layout/ProjectTopbar';
import { CommandPaletteProvider } from '../components/layout/CommandPaletteModal';
import Editor from '../features/editor/components/Editor';
import DataPage from '../features/data-modeler/pages/DataPage';
import DataSourcePage from '../features/datasource/pages/DataSourcePage';
import PostgreSQLPage from '../features/datasource/pages/PostgreSQLPage';
import AppBuilderPage from '../features/app-builder/pages/AppBuilderPage';
import DashboardPage from '../features/dashboard/pages/DashboardPage';
import WorkspaceHomePage from '../features/dashboard/pages/WorkspaceHomePage';
import MembersPage from '../features/dashboard/pages/MembersPage';
import WorkspaceSettingsPage from '../features/dashboard/pages/WorkspaceSettingsPage';
import ProjectHomePage from '../features/project/pages/ProjectHomePage';
import ProjectSettingsPage from '../features/project/pages/ProjectSettingsPage';
import LoginPage from '../features/auth/pages/LoginPage';
import RegisterPage from '../features/auth/pages/RegisterPage';
import ForgotPasswordPage from '../features/auth/pages/ForgotPasswordPage';
import { ViewMode } from '../types';
import { useResizable } from '../hooks/useResizable';
import { useRouteContext } from '../hooks/useRouteContext';
import {
  resolveIsDarkMode,
  usePreferencesStore,
} from '../store/usePreferencesStore';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { useBuilderStore } from '../store/useBuilderStore';
import { useDataStore } from '../store/useDataStore';

const RequireAuth: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const isAuthenticated = usePreferencesStore((s) => s.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return children;
};

const MainLayout: React.FC = () => {
  const { activeView, activeProjectId, isWorkspaceShell } = useRouteContext();
  const isProjectSidebarCollapsed = usePreferencesStore(
    (s) => s.isProjectSidebarCollapsed
  );
  const storedProjectId = useWorkspaceStore((s) => s.activeProjectId);
  const setActiveProjectId = useWorkspaceStore((s) => s.setActiveProjectId);

  const draggedWidget = useBuilderStore((s) => s.draggedWidget);
  const setDraggedWidget = useBuilderStore((s) => s.setDraggedWidget);
  const setDroppedWidget = useBuilderStore((s) => s.setDroppedWidget);

  const isAppBuilder = activeView === ViewMode.APPS;

  useEffect(() => {
    if (!isWorkspaceShell && activeProjectId && activeProjectId !== storedProjectId) {
      setActiveProjectId(activeProjectId);
    }
  }, [isWorkspaceShell, activeProjectId, storedProjectId, setActiveProjectId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const {
    width: wsSidebarWidth,
    isResizing: isResizingWsSidebar,
    startResizing: startResizingWsSidebar,
  } = useResizable({
    initialWidth: 256,
    minWidth: 210,
    maxWidth: 400,
    edge: 'left',
    leftOffset: 0,
  });

  const {
    width: projectSidebarWidth,
    isResizing: isResizingProjectSidebar,
    startResizing: startResizingProjectSidebar,
  } = useResizable({
    initialWidth: 252,
    minWidth: 200,
    maxWidth: 400,
    edge: 'left',
    leftOffset: 48,
  });

  const isResizing = isResizingWsSidebar || isResizingProjectSidebar;

  const handleDragStart = (event: DragStartEvent) => {
    setDraggedWidget(event.active.data.current);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && over.id === 'canvas-droppable') {
      setDroppedWidget({
        ...active.data.current,
        id: `widget-${Date.now()}`,
      });
    }
    setDraggedWidget(null);
  };

  const layoutContent = (
    <CommandPaletteProvider>
      <div
        className={`flex h-screen w-screen bg-background text-foreground overflow-hidden font-sans transition-colors duration-200 ${
          isResizing ? 'cursor-col-resize select-none' : ''
        }`}
      >
        {isWorkspaceShell ? (
          <>
            {/* Workspace Shell: 256px Workspace Sidebar + 56px Global Search Header */}
            <Sidebar width={wsSidebarWidth} />

            <div
              className="w-[1px] bg-transparent hover:bg-primary/60 cursor-col-resize z-40 relative transition-colors shrink-0"
              onMouseDown={startResizingWsSidebar}
            >
              <div className="absolute inset-y-0 -left-1 w-2.5 cursor-col-resize z-40" />
            </div>

            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
              <Header />

              <main className="flex-1 flex overflow-hidden relative bg-background min-w-0">
                <Outlet />
              </main>
            </div>
          </>
        ) : (
          <>
            {/* Project Shell: 48px Mini Rail + Collapsible Project Sidebar + 48px Breadcrumb Topbar */}
            <ProjectMiniRail />

            <ProjectSidebar width={projectSidebarWidth} />

            {!isProjectSidebarCollapsed && (
              <div
                className="w-[1px] bg-transparent hover:bg-primary/60 cursor-col-resize z-40 relative transition-colors shrink-0"
                onMouseDown={startResizingProjectSidebar}
              >
                <div className="absolute inset-y-0 -left-1 w-2.5 cursor-col-resize z-40" />
              </div>
            )}

            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
              <ProjectTopbar />

              <main className="flex-1 flex overflow-hidden relative bg-background min-w-0">
                <Outlet />
              </main>
            </div>
          </>
        )}

        <DragOverlay>
          {draggedWidget ? (
            <div className="opacity-80 pointer-events-none transform scale-105 cursor-grabbing">
              <div className="flex flex-col items-center justify-center p-2 rounded-md border bg-card shadow-xl w-20 h-20">
                {draggedWidget.icon && (
                  <draggedWidget.icon size={24} className="text-primary mb-1" />
                )}
                <span className="text-[10px] font-medium text-foreground">
                  {draggedWidget.name}
                </span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </CommandPaletteProvider>
  );

  if (isAppBuilder) {
    return (
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {layoutContent}
      </DndContext>
    );
  }

  return layoutContent;
};

const App: React.FC = () => {
  const themeMode = usePreferencesStore((s) => s.themeMode);
  const setThemeMode = usePreferencesStore((s) => s.setThemeMode);
  const theme = usePreferencesStore((s) => s.theme);
  const defaultPageId = useBuilderStore(
    (s) => s.pages.find((p) => p.type === 'page')?.id || 'page-1'
  );
  const defaultTableId = useDataStore((s) => s.tables[0]?.id || 'users');

  useEffect(() => {
    const applyThemeClass = () => {
      const root = document.documentElement;
      const dark = resolveIsDarkMode(themeMode);
      if (dark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }

      root.classList.remove(
        'theme-slack',
        'theme-supabase',
        'theme-vscode',
        'theme-vercel'
      );
      if (theme && theme !== 'vercel') {
        root.classList.add(`theme-${theme}`);
      }
    };

    applyThemeClass();

    if (themeMode === 'system' && window.matchMedia) {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        setThemeMode('system');
        applyThemeClass();
      };
      media.addEventListener('change', handleChange);
      return () => media.removeEventListener('change', handleChange);
    }
  }, [themeMode, theme, setThemeMode]);

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        <Route
          element={
            <RequireAuth>
              <MainLayout />
            </RequireAuth>
          }
        >
          {/* Workspace Shell Routes */}
          <Route path="/" element={<DashboardPage />} />
          <Route path="/projects" element={<DashboardPage />} />
          <Route path="/home" element={<WorkspaceHomePage />} />
          <Route path="/members" element={<MembersPage />} />
          <Route path="/settings" element={<WorkspaceSettingsPage />} />

          {/* Project Shell Routes */}
          <Route path="/projects/:projectId" element={<ProjectHomePage />} />
          <Route
            path="/projects/:projectId/data/:tableId"
            element={<DataPage />}
          />
          <Route
            path="/projects/:projectId/datasources"
            element={<DataSourcePage />}
          />
          <Route
            path="/projects/:projectId/datasources/postgresql"
            element={<PostgreSQLPage />}
          />
          <Route
            path="/projects/:projectId/datasources/postgresql/:id"
            element={<PostgreSQLPage />}
          />
          <Route path="/projects/:projectId/files" element={<Editor />} />
          <Route
            path="/projects/:projectId/settings"
            element={<ProjectSettingsPage />}
          />
          <Route
            path="/projects/:projectId/apps/:appId/pages/:pageId"
            element={<AppBuilderPage />}
          />

          {/* Legacy Direct Routes (also render inside Project Shell) */}
          <Route
            path="/apps"
            element={
              <Navigate
                to={`/apps/app-order-mgmt/pages/${defaultPageId}`}
                replace
              />
            }
          />
          <Route
            path="/apps/:appId"
            element={
              <Navigate
                to={`/apps/app-order-mgmt/pages/${defaultPageId}`}
                replace
              />
            }
          />
          <Route path="/apps/:appId/pages/:pageId" element={<AppBuilderPage />} />

          <Route
            path="/data"
            element={<Navigate to={`/data/${defaultTableId}`} replace />}
          />
          <Route path="/data/new" element={<Navigate to="/datasources" replace />} />
          <Route path="/data/:tableId" element={<DataPage />} />

          <Route path="/datasources" element={<DataSourcePage />} />
          <Route path="/datasources/postgresql" element={<PostgreSQLPage />} />
          <Route path="/datasources/postgresql/:id" element={<PostgreSQLPage />} />

          <Route path="/files" element={<Editor />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};

export default App;
