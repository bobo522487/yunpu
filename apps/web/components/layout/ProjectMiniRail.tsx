import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  Database,
  Home,
  LayoutGrid,
  Settings,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ViewMode } from '../../types';
import { WorkspaceLogoIcon } from '../common/NocoIcons';
import UserAvatarMenu from './UserAvatarMenu';
import { useRouteContext } from '../../hooks/useRouteContext';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { useBuilderStore } from '../../store/useBuilderStore';
import { useDataStore } from '../../store/useDataStore';

const ProjectMiniRail: React.FC = () => {
  const navigate = useNavigate();
  const { activeView, activeProjectId, activeTableId } = useRouteContext();

  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const projects = useWorkspaceStore((s) => s.projects);
  const apps = useWorkspaceStore((s) => s.apps);
  const notifications = useWorkspaceStore((s) => s.notifications);
  const markNotificationRead = useWorkspaceStore((s) => s.markNotificationRead);
  const markAllNotificationsRead = useWorkspaceStore((s) => s.markAllNotificationsRead);
  const pages = useBuilderStore((s) => s.pages);
  const tables = useDataStore((s) => s.tables);

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifContainerRef = useRef<HTMLDivElement>(null);

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        notifContainerRef.current &&
        !notifContainerRef.current.contains(e.target as Node)
      ) {
        setIsNotifOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsNotifOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  const isHomeActive = activeView === ViewMode.PROJECT_HOME;
  const isDataActive = activeView === ViewMode.DATA;
  const isAppsActive = activeView === ViewMode.APPS;
  const isSettingsActive =
    activeView === ViewMode.PROJECT_SETTINGS ||
    activeView === ViewMode.DATASOURCE ||
    activeView === ViewMode.SETTINGS;

  const handleOpenHome = () => {
    navigate(`/projects/${activeProjectId}`);
  };

  const handleOpenData = () => {
    const projectTables = tables.filter(
      (t) => !t.projectId || t.projectId === activeProjectId
    );
    const activeProject = projects.find((p) => p.id === activeProjectId);
    const targetTableId =
      (activeTableId && projectTables.some((t) => t.id === activeTableId)
        ? activeTableId
        : undefined) ||
      (activeProject?.defaultTableId &&
      projectTables.some((t) => t.id === activeProject.defaultTableId)
        ? activeProject.defaultTableId
        : undefined) ||
      projectTables[0]?.id;

    if (targetTableId) {
      navigate(`/projects/${activeProjectId}/data/${targetTableId}`);
    } else {
      navigate(`/projects/${activeProjectId}`);
    }
  };

  const handleOpenApps = () => {
    const wsApps = apps.filter((a) => a.workspaceId === activeWorkspaceId);
    const targetApp = wsApps[0] || apps[0];
    const targetPageId =
      targetApp?.defaultPageId ||
      pages.find((p) => p.type === 'page')?.id ||
      'page-1';
    navigate(
      `/projects/${activeProjectId}/apps/${
        targetApp?.id || 'app-order-mgmt'
      }/pages/${targetPageId}`
    );
  };

  const handleOpenSettings = () => {
    navigate(`/projects/${activeProjectId}/settings`);
  };

  return (
    <nav
      aria-label="项目功能导航"
      data-testid="nc-mini-sidebar-v2"
      className="w-12 h-full shrink-0 border-r border-border bg-[hsl(var(--surface-subtle))] flex flex-col items-center justify-between py-1.5 select-none z-40 relative"
    >
      {/* Top: Back to Workspace Logo + Main Modules */}
      <div className="flex flex-col items-center w-full gap-1">
        <button
          type="button"
          onClick={() => navigate('/')}
          title={`返回工作区：${activeWorkspace?.name || '个人空间'}`}
          data-testid="nc-rail-logo"
          className="group w-9 h-9 my-0.5 rounded-lg flex items-center justify-center hover:bg-[hsl(var(--surface-hover))] transition-colors relative cursor-pointer"
        >
          <span className="transition-opacity duration-150 group-hover:opacity-0 flex items-center justify-center">
            <WorkspaceLogoIcon className="w-6 h-6" />
          </span>
          <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-foreground">
            <ArrowLeft size={17} strokeWidth={1.8} />
          </span>
        </button>

        <div className="w-6 h-px bg-border my-1" />

        {/* Project Home Overview Rail Item */}
        <button
          type="button"
          onClick={handleOpenHome}
          title="首页概览"
          data-panel="home"
          data-testid="nc-rail-home-btn"
          aria-current={isHomeActive ? 'page' : undefined}
          className={`w-9 h-9 rounded-lg flex flex-col items-center justify-center transition-colors cursor-pointer ${
            isHomeActive
              ? 'bg-primary/[0.12] text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.2)]'
              : 'text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--surface-hover))]'
          }`}
        >
          <Home size={17} strokeWidth={1.75} />
        </button>

        {/* Data Rail Item */}
        <button
          type="button"
          onClick={handleOpenData}
          title="数据"
          data-panel="data"
          aria-current={isDataActive ? 'page' : undefined}
          className={`w-9 h-9 rounded-lg flex flex-col items-center justify-center transition-colors cursor-pointer ${
            isDataActive
              ? 'bg-primary/[0.12] text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.2)]'
              : 'text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--surface-hover))]'
          }`}
        >
          <Database size={17} strokeWidth={1.75} />
        </button>

        {/* Apps Rail Item */}
        <button
          type="button"
          onClick={handleOpenApps}
          title="应用"
          data-panel="apps"
          aria-current={isAppsActive ? 'page' : undefined}
          className={`w-9 h-9 rounded-lg flex flex-col items-center justify-center transition-colors cursor-pointer ${
            isAppsActive
              ? 'bg-primary/[0.12] text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.2)]'
              : 'text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--surface-hover))]'
          }`}
        >
          <LayoutGrid size={17} strokeWidth={1.75} />
        </button>

        <div className="w-6 h-px bg-border my-1" />

        {/* Project Settings Rail Item */}
        <button
          type="button"
          onClick={handleOpenSettings}
          title="设置"
          data-panel="settings"
          aria-current={isSettingsActive ? 'page' : undefined}
          className={`w-9 h-9 rounded-lg flex flex-col items-center justify-center transition-colors cursor-pointer ${
            isSettingsActive
              ? 'bg-primary/[0.12] text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.2)]'
              : 'text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--surface-hover))]'
          }`}
        >
          <Settings size={17} strokeWidth={1.75} />
        </button>
      </div>

      {/* Bottom: Activity Notifications + User Avatar Menu */}
      <div className="flex flex-col items-center w-full gap-1">
        <div className="w-6 h-px bg-border my-1" />

        <div ref={notifContainerRef} className="relative flex items-center justify-center">
          <button
            type="button"
            onClick={() => setIsNotifOpen((v) => !v)}
            title="活动"
            data-panel="notification"
            data-testid="nc-home-sidebar-notification"
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors relative cursor-pointer ${
              isNotifOpen
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--surface-hover))]'
            }`}
          >
            <Bell size={17} strokeWidth={1.75} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[14px] h-[14px] px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-semibold tabular-nums flex items-center justify-center leading-none">
                {unreadCount}
              </span>
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute bottom-0 left-full ml-2 w-[310px] rounded-xl border border-border bg-popover text-popover-foreground shadow-[var(--shadow-popover)] z-[85] overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
                <span className="text-xs font-semibold text-foreground tabular-nums">
                  活动通知 ({unreadCount})
                </span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllNotificationsRead}
                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    <CheckCheck size={12} /> 全部已读
                  </button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-border/60">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    暂无活动消息
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => markNotificationRead(n.id)}
                      className={`px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors ${
                        !n.read ? 'bg-accent/40' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-foreground truncate">
                          {n.title}
                        </span>
                        <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                          {n.time}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        {n.description}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <UserAvatarMenu variant="rail" />
      </div>
    </nav>
  );
};

export default ProjectMiniRail;
