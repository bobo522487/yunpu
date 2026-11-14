import React from 'react';
import { ArrowRight, Database, LayoutGrid, FolderPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePreferencesStore } from '../../../store/usePreferencesStore';
import {
  ASSET_COLOR_PALETTES,
  useWorkspaceStore,
} from '../../../store/useWorkspaceStore';
import {
  AppColoredIcon,
  ProjectColoredIcon,
} from '../../../components/common/NocoIcons';

const WorkspaceHomePage: React.FC = () => {
  const navigate = useNavigate();
  const user = usePreferencesStore((s) => s.user);
  const isDarkMode = usePreferencesStore((s) => s.isDarkMode);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const projects = useWorkspaceStore((s) => s.projects);
  const apps = useWorkspaceStore((s) => s.apps);
  const setActiveProjectId = useWorkspaceStore((s) => s.setActiveProjectId);

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  const wsProjects = projects.filter((p) => p.workspaceId === activeWorkspaceId);
  const wsApps = apps.filter((a) => a.workspaceId === activeWorkspaceId);

  return (
    <div className="flex-1 h-full overflow-y-auto bg-background">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-7 space-y-8">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            你好，{user.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            欢迎来到「{activeWorkspace?.name}」，快速访问你的项目、数据模型与可视化应用。
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-3.5 p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-xs transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-lg bg-accent text-accent-foreground flex items-center justify-center shrink-0">
              <FolderPlus size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold text-foreground">
                管理工作区项目
              </div>
              <div className="text-[12px] font-medium text-muted-foreground mt-0.5 tabular-nums">
                共 {wsProjects.length} 个项目
              </div>
            </div>
            <ArrowRight
              size={15}
              className="text-muted-foreground group-hover:translate-x-0.5 transition-transform"
            />
          </button>

          <button
            type="button"
            onClick={() => {
              const firstApp = wsApps[0] || apps[0];
              navigate(
                `/apps/${firstApp?.id || 'app-order-mgmt'}/pages/${
                  firstApp?.defaultPageId || 'page-1'
                }`
              );
            }}
            className="flex items-center gap-3.5 p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-xs transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <LayoutGrid size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold text-foreground">
                打开应用构建器
              </div>
              <div className="text-[12px] font-medium text-muted-foreground mt-0.5 tabular-nums">
                共 {wsApps.length} 个可视化应用
              </div>
            </div>
            <ArrowRight
              size={15}
              className="text-muted-foreground group-hover:translate-x-0.5 transition-transform"
            />
          </button>

          <button
            type="button"
            onClick={() => navigate('/datasources')}
            className="flex items-center gap-3.5 p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-xs transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Database size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold text-foreground">
                连接外部数据源
              </div>
              <div className="text-[12px] font-medium text-muted-foreground mt-0.5">
                PostgreSQL · MySQL · API
              </div>
            </div>
            <ArrowRight
              size={15}
              className="text-muted-foreground group-hover:translate-x-0.5 transition-transform"
            />
          </button>
        </div>

        {/* Recent Projects & Apps */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-semibold text-foreground">最近访问</h2>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-[13px] font-medium text-primary hover:underline"
            >
              查看全部项目
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {wsProjects.map((proj) => {
              const p =
                ASSET_COLOR_PALETTES[proj.colorTheme] || ASSET_COLOR_PALETTES.sky;
              return (
                <div
                  key={proj.id}
                  onClick={() => {
                    setActiveProjectId(proj.id);
                    navigate(`/projects/${proj.id}`);
                  }}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card hover:border-muted-foreground/40 hover:shadow-xs transition-all cursor-pointer h-16 overflow-hidden"
                >
                  <div
                    className="self-stretch w-16 flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: isDarkMode ? p.darkTileBg : p.tileBg,
                    }}
                  >
                    <ProjectColoredIcon
                      colorTheme={proj.colorTheme}
                      className="w-6 h-6"
                    />
                  </div>
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="text-[14px] font-semibold text-foreground truncate">
                      {proj.name}
                    </div>
                    <div className="text-[12px] font-medium text-muted-foreground tabular-nums">
                      项目 · {proj.updatedAt}
                    </div>
                  </div>
                </div>
              );
            })}

            {wsApps.map((app) => {
              const p =
                ASSET_COLOR_PALETTES[app.colorTheme] ||
                ASSET_COLOR_PALETTES.indigo;
              return (
                <div
                  key={app.id}
                  onClick={() =>
                    navigate(`/apps/${app.id}/pages/${app.defaultPageId}`)
                  }
                  className="flex items-center gap-3 rounded-xl border border-border bg-card hover:border-muted-foreground/40 hover:shadow-xs transition-all cursor-pointer h-16 overflow-hidden"
                >
                  <div
                    className="self-stretch w-16 flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: isDarkMode ? p.darkTileBg : p.tileBg,
                    }}
                  >
                    <AppColoredIcon
                      colorTheme={app.colorTheme}
                      className="w-6 h-6"
                    />
                  </div>
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="text-[14px] font-semibold text-foreground truncate">
                      {app.name}
                    </div>
                    <div className="text-[12px] font-medium text-muted-foreground tabular-nums">
                      应用 · {app.updatedAt}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceHomePage;
