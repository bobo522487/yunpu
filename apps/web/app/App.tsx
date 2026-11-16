import React, { useEffect } from 'react';
import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
  useParams,
} from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';
import ProjectMiniRail from '../components/layout/ProjectMiniRail';
import ProjectSidebar from '../components/layout/ProjectSidebar';
import ProjectTopbar from '../components/layout/ProjectTopbar';
import { CommandPaletteProvider } from '../components/layout/CommandPaletteModal';
import DashboardPage from '../features/dashboard/pages/DashboardPage';
import WorkspaceHomePage from '../features/dashboard/pages/WorkspaceHomePage';
import MembersPage from '../features/dashboard/pages/MembersPage';
import WorkspaceSettingsPage from '../features/dashboard/pages/WorkspaceSettingsPage';
import ProjectHomePage from '../features/project/pages/ProjectHomePage';
import ProjectSettingsPage from '../features/project/pages/ProjectSettingsPage';
import GenealogySectionPage from '../features/project/pages/GenealogySectionPage';
import LoginPage from '../features/auth/pages/LoginPage';
import RegisterPage from '../features/auth/pages/RegisterPage';
import ForgotPasswordPage from '../features/auth/pages/ForgotPasswordPage';
import OnboardingPage from '../features/auth/pages/OnboardingPage';
import { useAuthStore } from '../features/auth/useAuthStore';
import MockModeIndicator from '../components/MockModeIndicator';
import { useResizable } from '../hooks/useResizable';
import { useRouteContext } from '../hooks/useRouteContext';
import {
  resolveIsDarkMode,
  usePreferencesStore,
} from '../store/usePreferencesStore';
import { useWorkspaceStore } from '../store/useWorkspaceStore';

const RequireAuth: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-sm text-muted-foreground">
        正在检查登录状态...
      </div>
    );
  }

  if (status !== 'authenticated') {
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

/** 引导状态（无可用组织）时不渲染四页，整体重定向到 /onboarding（spec FR-002）。 */
const ConsoleGate: React.FC = () => {
  const onboarding = useAuthStore((s) => s.onboarding);
  if (onboarding) return <Navigate to="/onboarding" replace />;
  return <MainLayout />;
};

/** 邀请链接入口：`/#/invite/:token` → 引导页并预填令牌（spec FR-005 / contracts §4）。 */
const InviteRedirect: React.FC = () => {
  const { token } = useParams();
  return (
    <Navigate
      to={`/onboarding?invite=${encodeURIComponent(token ?? '')}`}
      replace
    />
  );
};

const MainLayout: React.FC = () => {
  const { activeProjectId, isWorkspaceShell } = useRouteContext();
  const isProjectSidebarCollapsed = usePreferencesStore(
    (s) => s.isProjectSidebarCollapsed
  );
  const storedProjectId = useWorkspaceStore((s) => s.activeProjectId);
  const setActiveProjectId = useWorkspaceStore((s) => s.setActiveProjectId);

  useEffect(() => {
    if (!isWorkspaceShell && activeProjectId && activeProjectId !== storedProjectId) {
      setActiveProjectId(activeProjectId);
    }
  }, [isWorkspaceShell, activeProjectId, storedProjectId, setActiveProjectId]);

  useEffect(() => {
    if (!isWorkspaceShell) return;
    // 组织列表以 API 为唯一事实源；失败时 store 已清空模板假组织，页面各自展示错误态。
    void useWorkspaceStore.getState().hydrateFromApi().catch(() => {});
  }, [isWorkspaceShell]);

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

  return (
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
      </div>
    </CommandPaletteProvider>
  );
};

const App: React.FC = () => {
  const themeMode = usePreferencesStore((s) => s.themeMode);
  const setThemeMode = usePreferencesStore((s) => s.setThemeMode);
  const theme = usePreferencesStore((s) => s.theme);
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  // 会话失效（任意请求 401）→ 清会话，RequireAuth 跳转登录（SC-009）。
  useEffect(() => {
    const onUnauthorized = () => useAuthStore.getState().markUnauthorized();
    window.addEventListener('yunpu:unauthorized', onUnauthorized);
    return () => window.removeEventListener('yunpu:unauthorized', onUnauthorized);
  }, []);

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
          path="/onboarding"
          element={
            <RequireAuth>
              <OnboardingPage />
            </RequireAuth>
          }
        />
        <Route path="/invite/:token" element={<InviteRedirect />} />

        <Route
          element={
            <RequireAuth>
              <ConsoleGate />
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
            path="/projects/:projectId/lineage"
            element={<GenealogySectionPage section="lineage" />}
          />
          <Route
            path="/projects/:projectId/articles"
            element={<GenealogySectionPage section="articles" />}
          />
          <Route
            path="/projects/:projectId/books"
            element={<GenealogySectionPage section="books" />}
          />
          <Route
            path="/projects/:projectId/settings"
            element={<ProjectSettingsPage />}
          />

          {/* 已下线的模板功能（应用构建/数据表/数据源/代码文件）统一回落到项目首页 */}
          <Route
            path="/projects/:projectId/data/:tableId"
            element={<ProjectFallback />}
          />
          <Route
            path="/projects/:projectId/datasources/*"
            element={<ProjectFallback />}
          />
          <Route path="/projects/:projectId/files" element={<ProjectFallback />} />
          <Route
            path="/projects/:projectId/apps/*"
            element={<ProjectFallback />}
          />
          <Route path="/apps" element={<Navigate to="/" replace />} />
          <Route path="/apps/*" element={<Navigate to="/" replace />} />
          <Route path="/data/*" element={<Navigate to="/" replace />} />
          <Route path="/datasources/*" element={<Navigate to="/" replace />} />
          <Route path="/files" element={<Navigate to="/" replace />} />

          <Route path="*" element={<Navigate to="/home" replace />} />
        </Route>
      </Routes>
      <MockModeIndicator />
    </HashRouter>
  );
};

/** 模板功能下线后的占位页：项目壳内把旧链接送回项目首页。 */
const ProjectFallback: React.FC = () => {
  const { projectId } = useParams();
  return <Navigate to={`/projects/${projectId ?? ''}`} replace />;
};

export default App;
