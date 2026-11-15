import React, { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  GitFork,
  Pencil,
  ScrollText,
  Settings,
  Star,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ProjectColoredIcon } from '../../../components/common/NocoIcons';
import { Button } from '../../../components/ui/button';
import {
  AssetEditorModal,
  AssetEditorSubmitValues,
} from '../../dashboard/components/AssetEditorModal';
import { useRouteContext } from '../../../hooks/useRouteContext';
import { usePreferencesStore } from '../../../store/usePreferencesStore';
import {
  ASSET_COLOR_PALETTES,
  useWorkspaceStore,
} from '../../../store/useWorkspaceStore';

const ProjectHomePage: React.FC = () => {
  const navigate = useNavigate();
  const { activeProjectId } = useRouteContext();

  const isDarkMode = usePreferencesStore((s) => s.isDarkMode);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const projects = useWorkspaceStore((s) => s.projects);
  const updateProject = useWorkspaceStore((s) => s.updateProject);

  const [isEditOpen, setIsEditOpen] = useState(false);

  const activeProject =
    projects.find((p) => p.id === activeProjectId) ||
    projects.find((p) => p.workspaceId === activeWorkspaceId) ||
    projects[0];

  const palette =
    ASSET_COLOR_PALETTES[activeProject?.colorTheme || 'sky'] ||
    ASSET_COLOR_PALETTES.sky;

  const projectStateLabel =
    activeProject?.projectState === '1' ? '已完成' : '进行中';
  const projectLevel = activeProject?.projectLevel || 1;

  const workbenchModules = [
    {
      id: 'lineage',
      title: '谱系',
      desc: '维护家族世代脉络、支派分房与成员关系图谱。',
      status: '已启用',
      path: `/projects/${activeProjectId}/lineage`,
      icon: GitFork,
    },
    {
      id: 'articles',
      title: '谱文',
      desc: '编修谱序、凡例、姓氏源流、家训与先贤传记。',
      status: '占位模块',
      path: `/projects/${activeProjectId}/articles`,
      icon: ScrollText,
    },
    {
      id: 'books',
      title: '谱书',
      desc: '组织分卷目录、题签封面与线装成书版式预览。',
      status: '占位模块',
      path: `/projects/${activeProjectId}/books`,
      icon: BookOpen,
    },
  ];

  const handleSaveProject = (values: AssetEditorSubmitValues) => {
    if (!activeProject) return;
    updateProject(activeProject.id, {
      name: values.name,
      description: values.description,
      colorTheme: values.colorTheme,
      primarySurname: values.primarySurname,
      region: values.region,
      primaryName: values.primaryName,
      projectState: values.projectState,
      projectLevel: values.projectLevel,
    });
    setIsEditOpen(false);
  };

  return (
    <>
      <div className="flex-1 h-full overflow-y-auto bg-background">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-7 space-y-7">
          {/* Project Identity Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
            <div className="flex items-center gap-4 min-w-0">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border border-black/[0.04] dark:border-white/[0.06]"
                style={{
                  backgroundColor: isDarkMode
                    ? palette.darkTileBg
                    : palette.tileBg,
                }}
              >
                <ProjectColoredIcon
                  colorTheme={activeProject?.colorTheme || 'sky'}
                  className="w-6 h-6"
                />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <h1 className="text-[20px] font-semibold text-foreground truncate tracking-tight">
                    {activeProject?.name || '云谱项目工作台'}
                  </h1>
                  {activeProject?.primaryName && (
                    <span className="text-[13px] font-medium text-muted-foreground whitespace-nowrap">
                      · {activeProject.primaryName}
                    </span>
                  )}
                  <span className="text-[12px] font-medium text-muted-foreground tabular-nums whitespace-nowrap">
                    · 更新于 {activeProject?.updatedAt || '刚刚'}
                  </span>
                </div>
                <p className="text-[13px] text-muted-foreground mt-0.5 truncate">
                  {activeProject?.description ||
                    '围绕谱系梳理、谱文编修与谱书排版开展家族谱牒协作。'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditOpen(true)}
                className="h-8 gap-1.5 text-[13px] font-medium whitespace-nowrap shrink-0"
              >
                <Pencil size={13} /> 编辑云谱信息
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  navigate(`/projects/${activeProjectId}/settings`)
                }
                className="h-8 gap-1.5 text-[13px] font-medium whitespace-nowrap shrink-0"
              >
                <Settings size={14} /> 项目设置
              </Button>
            </div>
          </div>

          {/* 3-Column Cloud Genealogy Core Modules: 谱系 / 谱文 / 谱书 */}
          <section className="space-y-3">
            <h2 className="text-[15px] font-semibold text-foreground">
              云谱编修工作区
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {workbenchModules.map((mod) => {
                const Icon = mod.icon;
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => navigate(mod.path)}
                    className="flex flex-col justify-between gap-4 p-5 rounded-xl border border-border bg-card hover:border-[hsl(var(--border-strong))] hover:shadow-[var(--shadow-card-hover)] transition-all duration-150 text-left cursor-pointer group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="w-10 h-10 rounded-lg bg-[hsl(var(--surface-subtle))] border border-border flex items-center justify-center text-primary shrink-0">
                          <Icon size={18} />
                        </div>
                        <span className="text-[12px] font-medium text-muted-foreground">
                          {mod.status}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="text-[15px] font-semibold text-foreground group-hover:text-primary transition-colors">
                          {mod.title}
                        </div>
                        <p className="text-[13px] text-muted-foreground leading-relaxed">
                          {mod.desc}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-[12px] font-medium text-primary pt-2 border-t border-border/60">
                      <span>进入{mod.title}</span>
                      <ArrowRight
                        size={13}
                        className="group-hover:translate-x-0.5 transition-transform"
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Project Profile Summary */}
          <section className="space-y-3">
            <h2 className="text-[15px] font-semibold text-foreground">
              云谱档案摘要
            </h2>
            <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
                <div className="p-4 space-y-1">
                  <div className="text-[12px] text-muted-foreground">主姓氏</div>
                  <div className="text-[14px] font-semibold text-foreground">
                    {activeProject?.primarySurname || '未填写'}
                  </div>
                </div>
                <div className="p-4 space-y-1">
                  <div className="text-[12px] text-muted-foreground">主题名</div>
                  <div className="text-[14px] font-semibold text-foreground">
                    {activeProject?.primaryName || '未填写'}
                  </div>
                </div>
                <div className="p-4 space-y-1">
                  <div className="text-[12px] text-muted-foreground">所属地区</div>
                  <div className="text-[14px] font-semibold text-foreground">
                    {activeProject?.region
                      ? activeProject.region.split('/').join(' / ')
                      : '未填写'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
                <div className="p-4 space-y-1">
                  <div className="text-[12px] text-muted-foreground">编修状态</div>
                  <div className="text-[14px] font-semibold text-foreground">
                    {projectStateLabel}
                  </div>
                </div>
                <div className="p-4 space-y-1">
                  <div className="text-[12px] text-muted-foreground">重要等级</div>
                  <div className="flex items-center gap-1 pt-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={14}
                        className={
                          star <= projectLevel
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-muted-foreground/30'
                        }
                      />
                    ))}
                    <span className="text-[12px] text-muted-foreground ml-1.5 tabular-nums">
                      {projectLevel} 星
                    </span>
                  </div>
                </div>
                <div className="p-4 space-y-1">
                  <div className="text-[12px] text-muted-foreground">备注说明</div>
                  <div className="text-[13px] text-foreground truncate">
                    {activeProject?.description || '暂无备注'}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <AssetEditorModal
        open={isEditOpen}
        mode="edit"
        kind="project"
        initialValue={
          activeProject
            ? {
                name: activeProject.name,
                description: activeProject.description,
                colorTheme: activeProject.colorTheme,
                primarySurname: activeProject.primarySurname,
                region: activeProject.region,
                primaryName: activeProject.primaryName,
                projectState: activeProject.projectState,
                projectLevel: activeProject.projectLevel,
              }
            : undefined
        }
        onClose={() => setIsEditOpen(false)}
        onSubmit={handleSaveProject}
      />
    </>
  );
};

export default ProjectHomePage;
