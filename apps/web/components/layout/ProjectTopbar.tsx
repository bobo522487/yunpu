import React, { useState } from 'react';
import {
  BookOpen,
  Compass,
  GitFork,
  PanelLeftOpen,
  ScrollText,
  Settings,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Dropdown from '../common/Dropdown';
import { Button } from '../ui/button';
import { ProjectColoredIcon } from '../common/NocoIcons';
import { ViewMode } from '../../types';
import { useRouteContext } from '../../hooks/useRouteContext';
import { usePreferencesStore } from '../../store/usePreferencesStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';

const ProjectTopbar: React.FC = () => {
  const navigate = useNavigate();
  const { activeView, activeProjectId } = useRouteContext();

  const isCollapsed = usePreferencesStore((s) => s.isProjectSidebarCollapsed);
  const setCollapsed = usePreferencesStore((s) => s.setProjectSidebarCollapsed);

  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const projects = useWorkspaceStore((s) => s.projects);
  const setActiveProjectId = useWorkspaceStore((s) => s.setActiveProjectId);

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const workspaceProjects = projects.filter(
    (p) => p.workspaceId === activeWorkspaceId
  );
  const activeProject =
    projects.find((p) => p.id === activeProjectId) ||
    workspaceProjects[0] ||
    projects[0];

  const projectItems = workspaceProjects.map((p) => ({
    id: p.id,
    label: p.name,
    group: '工作区云谱项目',
    avatar: <ProjectColoredIcon colorTheme={p.colorTheme} className="w-4 h-4" />,
  }));

  const Separator = () => (
    <span className="text-muted-foreground/45 mx-1 text-[15px] font-light select-none">
      /
    </span>
  );

  return (
    <header
      data-testid="nc-table-topbar"
      className="h-12 w-full border-b border-border bg-background flex items-center justify-between gap-3 px-3 shrink-0 z-20"
    >
      {/* Left: Sidebar Expand Toggle (when collapsed) + Project Breadcrumb */}
      <div className="flex items-center gap-1 min-w-0 flex-1 overflow-x-auto no-scrollbar">
        {isCollapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            title="展开侧边栏"
            data-testid="nc-topbar-expand-sidebar"
            className="w-8 h-8 mr-1 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 cursor-pointer"
          >
            <PanelLeftOpen size={16} />
          </button>
        )}

        {/* Active Project Dropdown */}
        <Dropdown
          triggerLabel={activeProject?.name || '云谱项目'}
          items={projectItems}
          selectedId={activeProject?.id}
          onSelect={(item) => {
            setActiveProjectId(item.id);
            navigate(`/projects/${item.id}`);
          }}
          searchPlaceholder="切换云谱项目..."
          open={activeDropdown === 'project'}
          onOpenChange={(isOpen) => setActiveDropdown(isOpen ? 'project' : null)}
          width={230}
          footer={
            <div
              onClick={() => {
                setActiveDropdown(null);
                navigate(`/projects/${activeProjectId}`);
              }}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium text-foreground hover:bg-muted cursor-pointer"
            >
              <Compass size={13} className="text-primary" />
              <span>打开工作台概览</span>
            </div>
          }
        />

        {activeView === ViewMode.PROJECT_HOME && (
          <>
            <Separator />
            <div className="flex items-center gap-1.5 px-1.5 py-1 text-[14px] font-semibold text-foreground whitespace-nowrap">
              <Compass size={14} className="text-primary" />
              <span>首页概览</span>
            </div>
          </>
        )}

        {activeView === ViewMode.LINEAGE && (
          <>
            <Separator />
            <div className="flex items-center gap-1.5 px-1.5 py-1 text-[14px] font-semibold text-foreground whitespace-nowrap">
              <GitFork size={14} className="text-primary" />
              <span>谱系</span>
            </div>
          </>
        )}

        {activeView === ViewMode.ARTICLES && (
          <>
            <Separator />
            <div className="flex items-center gap-1.5 px-1.5 py-1 text-[14px] font-semibold text-foreground whitespace-nowrap">
              <ScrollText size={14} className="text-primary" />
              <span>谱文</span>
            </div>
          </>
        )}

        {activeView === ViewMode.BOOKS && (
          <>
            <Separator />
            <div className="flex items-center gap-1.5 px-1.5 py-1 text-[14px] font-semibold text-foreground whitespace-nowrap">
              <BookOpen size={14} className="text-primary" />
              <span>谱书</span>
            </div>
          </>
        )}

        {activeView === ViewMode.PROJECT_SETTINGS && (
          <>
            <Separator />
            <span className="inline-flex items-center gap-1.5 px-1.5 text-[14px] font-semibold text-foreground whitespace-nowrap">
              <Settings size={14} className="text-muted-foreground" />
              项目设置
            </span>
          </>
        )}
      </div>

      {/* Right: Single-line module switch pills */}
      <div className="flex items-center gap-1 shrink-0">
        <div className="hidden sm:flex items-center gap-0.5 p-0.5 rounded-lg bg-[hsl(var(--surface-subtle))] border border-border">
          {[
            {
              id: ViewMode.LINEAGE,
              label: '谱系',
              path: `/projects/${activeProjectId}/lineage`,
            },
            {
              id: ViewMode.ARTICLES,
              label: '谱文',
              path: `/projects/${activeProjectId}/articles`,
            },
            {
              id: ViewMode.BOOKS,
              label: '谱书',
              path: `/projects/${activeProjectId}/books`,
            },
          ].map((tab) => {
            const active = activeView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => navigate(tab.path)}
                className={`h-7 px-2.5 rounded-md text-[12px] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-card text-foreground font-semibold shadow-xs border border-border/60'
                    : 'text-muted-foreground font-medium hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/projects/${activeProjectId}/settings`)}
          className="h-8 gap-1.5 px-2.5 text-[12px] font-medium whitespace-nowrap shrink-0"
        >
          <Settings size={13} />
          <span className="hidden md:inline">设置</span>
        </Button>
      </div>
    </header>
  );
};

export default ProjectTopbar;
