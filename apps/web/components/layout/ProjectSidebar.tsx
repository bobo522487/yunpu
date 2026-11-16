import React, { useState, useRef, useEffect } from 'react';
import {
  BookOpen,
  Check,
  ChevronsLeft,
  ChevronsUpDown,
  Compass,
  Copy,
  GitFork,
  Plus,
  ScrollText,
  Search,
  Settings,
  Sliders,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ViewMode } from '../../types';
import { ProjectColoredIcon } from '../common/NocoIcons';
import {
  AssetEditorModal,
  AssetEditorSubmitValues,
} from '../../features/dashboard/components/AssetEditorModal';
import { LineageTreePanel } from '../../features/project/components/LineageTreePanel';
import { useCommandPalette } from './CommandPaletteModal';
import { useRouteContext } from '../../hooks/useRouteContext';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { usePreferencesStore } from '../../store/usePreferencesStore';

interface ProjectSidebarProps {
  width: number;
}

const ProjectSidebar: React.FC<ProjectSidebarProps> = ({ width }) => {
  const navigate = useNavigate();
  const { activeView, activeProjectId } = useRouteContext();
  const { openPalette } = useCommandPalette();

  const isCollapsed = usePreferencesStore((s) => s.isProjectSidebarCollapsed);
  const setCollapsed = usePreferencesStore((s) => s.setProjectSidebarCollapsed);

  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const projects = useWorkspaceStore((s) => s.projects);
  const setActiveProjectId = useWorkspaceStore((s) => s.setActiveProjectId);
  const createProject = useWorkspaceStore((s) => s.createProject);
  const duplicateProject = useWorkspaceStore((s) => s.duplicateProject);

  const [isProjMenuOpen, setIsProjMenuOpen] = useState(false);
  const [projSearch, setProjSearch] = useState('');
  const [copiedId, setCopiedId] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);

  const projDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        projDropdownRef.current &&
        !projDropdownRef.current.contains(e.target as Node)
      ) {
        setIsProjMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsProjMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  const workspaceProjects = projects.filter(
    (p) => p.workspaceId === activeWorkspaceId
  );
  const activeProject =
    projects.find((p) => p.id === activeProjectId) ||
    workspaceProjects[0] ||
    projects[0];

  const filteredProjects = workspaceProjects.filter((p) =>
    p.name.toLowerCase().includes(projSearch.toLowerCase())
  );

  if (isCollapsed) {
    return null;
  }

  const isSettingsMode = activeView === ViewMode.PROJECT_SETTINGS;

  const moduleItems = [
    {
      id: ViewMode.PROJECT_HOME,
      label: '首页概览',
      path: `/projects/${activeProjectId}`,
      icon: Compass,
    },
    {
      id: ViewMode.LINEAGE,
      label: '谱系',
      path: `/projects/${activeProjectId}/lineage`,
      icon: GitFork,
    },
    {
      id: ViewMode.ARTICLES,
      label: '谱文',
      path: `/projects/${activeProjectId}/articles`,
      icon: ScrollText,
    },
    {
      id: ViewMode.BOOKS,
      label: '谱书',
      path: `/projects/${activeProjectId}/books`,
      icon: BookOpen,
    },
  ];

  const sectionSubOutline: Record<string, string[]> = {
    [ViewMode.LINEAGE]: ['世系总图', '房支管理', '成员名录'],
    [ViewMode.ARTICLES]: ['谱序与凡例', '源流与家训', '传记与艺文'],
    [ViewMode.BOOKS]: ['封面与题签', '分卷目录', '版式与印制'],
  };

  const currentOutline = sectionSubOutline[activeView] || [];

  return (
    <>
      <aside
        style={{ width }}
        data-testid="nc-sidebar"
        className="flex flex-col bg-background h-full shrink-0 border-r border-border select-none relative z-30"
      >
        {/* Project Header (h-12 matching ProjectTopbar) */}
        <div
          ref={projDropdownRef}
          data-testid="nc-sidebar-header"
          className="relative h-12 px-2 flex items-center justify-between gap-1 border-b border-border shrink-0"
        >
          <button
            type="button"
            onClick={() => setIsProjMenuOpen((v) => !v)}
            data-testid="nc-sidebar-project-selector"
            className="flex flex-1 items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-muted/80 transition-colors min-w-0 text-left cursor-pointer"
          >
            <ProjectColoredIcon
              colorTheme={activeProject?.colorTheme || 'sky'}
              className="w-5 h-5 shrink-0"
            />
            <span className="flex-1 truncate text-[14px] font-semibold text-foreground">
              {activeProject?.name || '云谱项目'}
            </span>
            <ChevronsUpDown
              size={13}
              className="text-muted-foreground shrink-0"
            />
          </button>

          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => openPalette()}
              title="快速搜索 (Ctrl K)"
              className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <Search size={14} />
            </button>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              title="隐藏侧边栏"
              data-testid="nc-sidebar-collapse-btn"
              className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <ChevronsLeft size={15} />
            </button>
          </div>

          {/* Project Switcher & Context Menu Popover */}
          {isProjMenuOpen && (
            <div className="absolute top-12 left-2 right-2 rounded-xl border border-border bg-popover text-popover-foreground shadow-[var(--shadow-popover)] z-[75] p-1.5">
              {/* Active Project Identity + ID Copy */}
              <div className="px-2 py-1.5 mb-1 border-b border-border/70">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-foreground truncate">
                    {activeProject?.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(activeProject?.id || '');
                      setCopiedId(true);
                      setTimeout(() => setCopiedId(false), 1500);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded bg-muted/60"
                    title="复制项目 ID"
                  >
                    <span>ID</span>
                    {copiedId ? (
                      <Check size={11} className="text-emerald-500" />
                    ) : (
                      <Copy size={11} />
                    )}
                  </button>
                </div>
              </div>

              {/* Project Filter */}
              <div className="relative mb-1.5">
                <Search
                  size={12}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="text"
                  value={projSearch}
                  onChange={(e) => setProjSearch(e.target.value)}
                  placeholder="切换云谱项目..."
                  className="w-full h-7.5 pl-7 pr-2 text-xs rounded-md border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                />
              </div>

              {/* Project List */}
              <div className="max-h-44 overflow-y-auto space-y-0.5">
                {filteredProjects.map((proj) => {
                  const isCurrent = proj.id === activeProject?.id;
                  return (
                    <button
                      key={proj.id}
                      type="button"
                      onClick={() => {
                        setIsProjMenuOpen(false);
                        setActiveProjectId(proj.id);
                        navigate(`/projects/${proj.id}`);
                      }}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-[13px] transition-colors ${
                        isCurrent
                          ? 'bg-accent text-accent-foreground font-semibold'
                          : 'text-foreground hover:bg-muted font-medium'
                      }`}
                    >
                      <ProjectColoredIcon
                        colorTheme={proj.colorTheme}
                        className="w-4 h-4 shrink-0"
                      />
                      <span className="flex-1 truncate">{proj.name}</span>
                      {isCurrent && (
                        <Check size={13} className="text-primary shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-border mt-1.5 pt-1.5 space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsProjMenuOpen(false);
                    navigate(`/projects/${activeProjectId}/settings`);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <Settings size={13} className="text-muted-foreground" />
                  <span>项目设置</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!activeProject) return;
                    const copy = duplicateProject(activeProject.id);
                    setIsProjMenuOpen(false);
                    if (copy) navigate(`/projects/${copy.id}`);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <Copy size={13} className="text-muted-foreground" />
                  <span>复制当前项目</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsProjMenuOpen(false);
                    setIsCreateProjectOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                >
                  <Plus size={13} />
                  <span>新建项目</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Body Content */}
        {isSettingsMode ? (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="px-2 py-2.5 space-y-0.5 border-b border-border shrink-0">
              <div className="px-2 pb-1 text-[12px] font-semibold text-muted-foreground">
                云谱项目配置
              </div>
              <button
                type="button"
                onClick={() => navigate(`/projects/${activeProjectId}/settings`)}
                className={`w-full h-8 px-2.5 rounded-lg flex items-center gap-2.5 text-[13px] transition-colors whitespace-nowrap ${
                  activeView === ViewMode.PROJECT_SETTINGS
                    ? 'bg-primary/[0.08] dark:bg-primary/15 text-foreground font-semibold'
                    : 'text-foreground/85 font-medium hover:bg-muted/70'
                }`}
              >
                <Sliders size={14} className="shrink-0" />
                <span>基本设置</span>
              </button>
            </div>
            <div className="p-3.5 text-[12px] text-muted-foreground leading-relaxed">
              在此可维护当前云谱项目的名称、主题名、所属地区、编修状态与重要等级。
            </div>
          </div>
        ) : activeView === ViewMode.LINEAGE ? (
          <LineageTreePanel />
        ) : (
          <div className="flex-1 min-h-0 flex flex-col overflow-y-auto py-3 px-2 space-y-5">
            {/* Core Modules Navigation */}
            <div className="space-y-1">
              <div className="px-2.5 pb-1 text-[12px] font-semibold text-muted-foreground">
                工作台模块
              </div>
              {moduleItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.path)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`w-full h-8.5 px-2.5 rounded-lg flex items-center gap-2.5 text-[13px] transition-colors whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-primary/[0.08] dark:bg-primary/15 text-foreground font-semibold'
                        : 'text-foreground/85 font-medium hover:bg-muted/70'
                    }`}
                  >
                    <Icon
                      size={15}
                      className={`shrink-0 ${
                        isActive ? 'text-primary' : 'text-muted-foreground'
                      }`}
                    />
                    <span className="flex-1 text-left truncate">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Contextual Placeholder Outline */}
            {currentOutline.length > 0 && (
              <div className="space-y-1 pt-3 border-t border-border/70">
                <div className="px-2.5 pb-1 text-[12px] font-semibold text-muted-foreground">
                  模块目录预览
                </div>
                {currentOutline.map((title, idx) => (
                  <div
                    key={title}
                    className="px-2.5 py-1.5 rounded-md text-[12px] text-muted-foreground flex items-center justify-between gap-2"
                  >
                    <span className="truncate">
                      0{idx + 1}. {title}
                    </span>
                    <span className="text-[11px] text-muted-foreground/65 shrink-0">
                      占位
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Quick Project Metadata Summary */}
            <div className="mt-auto pt-3 border-t border-border/70 px-2.5 space-y-1.5">
              <div className="text-[11px] font-semibold text-muted-foreground">
                当前云谱信息
              </div>
              <div className="text-[12px] text-foreground/85 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">主题名</span>
                  <span className="truncate font-medium">
                    {activeProject?.primaryName || '未设置'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">主姓氏</span>
                  <span className="truncate font-medium">
                    {activeProject?.primarySurname || '未设置'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">状态</span>
                  <span className="truncate font-medium">
                    {activeProject?.projectState === '1' ? '已完成' : '进行中'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>

      <AssetEditorModal
        open={isCreateProjectOpen}
        mode="create"
        kind="project"
        onClose={() => setIsCreateProjectOpen(false)}
        onSubmit={(values: AssetEditorSubmitValues) => {
          const created = createProject({
            name: values.name,
            description: values.description,
            colorTheme: values.colorTheme,
            primarySurname: values.primarySurname,
            region: values.region,
            primaryName: values.primaryName,
            projectState: values.projectState,
            projectLevel: values.projectLevel,
          });
          setIsCreateProjectOpen(false);
          navigate(`/projects/${created.id}`);
        }}
      />
    </>
  );
};

export default ProjectSidebar;
