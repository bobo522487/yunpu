import React, { lazy, Suspense, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpen,
  GitFork,
  Pencil,
  ScrollText,
  Settings,
} from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { ProjectColoredIcon } from '../../../components/common/YunpuIcons';
import { Button } from '@/components/ui/button';
import type { AssetEditorSubmitValues } from '../../dashboard/components/AssetEditorModal';
import { useProjectId } from '../../../hooks/useProjectId';
import { usePreferencesStore } from '../../../store/usePreferencesStore';

const AssetEditorModal = lazy(() =>
  import('../../dashboard/components/AssetEditorModal').then((m) => ({
    default: m.AssetEditorModal,
  }))
);
import {
  ASSET_COLOR_PALETTES,
  useWorkspaceStore,
} from '../../../store/useWorkspaceStore';
import { useArticleStore } from '../../../store/useArticleStore';
import { countArticlesInTree } from '../../articles/articleData';
import { useBookStore } from '../../../store/useBookStore';
import {
  fetchProject,
  updateProjectRequest,
} from '../../dashboard/api';
import { dashboardKeys, useProjectQuery } from '../../dashboard/queries';
import { toCreateProjectPayload } from '../../dashboard/projectPayload';
import { errorMessage } from '../../../lib/api';
import {
  formatGenealogyPlace,
  parsePlaceText,
} from '../../place-input';
import {
  formatProjectUpdatedAt,
  surnameOf,
} from '../../dashboard/projectView';

const ProjectHomePage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const activeProjectId = useProjectId();

  const isDarkMode = usePreferencesStore((s) => s.isDarkMode);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const projects = useWorkspaceStore((s) => s.projects);
  const syncProject = useWorkspaceStore((s) => s.syncProject);
  const articleTreesByProject = useArticleStore((s) => s.treesByProject);

  const booksByProject = useBookStore((s) => s.booksByProject);
  const projectBooks = booksByProject[activeProjectId];

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const cachedProject =
    projects.find((p) => p.id === activeProjectId) ||
    projects.find((p) => p.organizationId === activeWorkspaceId) ||
    projects[0];
  const targetProjectId = cachedProject?.id || activeProjectId;

  // 本地种子或离线项目未能命中服务端时保留本地展示。
  const projectQuery = useProjectQuery(targetProjectId, { retry: false });

  useEffect(() => {
    if (projectQuery.data) {
      syncProject(projectQuery.data);
    }
  }, [projectQuery.data, syncProject]);

  const activeProject = projectQuery.data ?? cachedProject;
  const expectedVersion = projectQuery.data?.version ?? null;
  const projectStatus = projectQuery.data?.status ?? null;

  const palette =
    ASSET_COLOR_PALETTES[activeProject?.colorTheme || 'sky'] ||
    ASSET_COLOR_PALETTES.sky;

  const projectArticleTree = articleTreesByProject[activeProjectId];
  const articleCount = projectArticleTree
    ? countArticlesInTree(projectArticleTree)
    : null;

  const workbenchModules: {
    id: string;
    title: string;
    desc: string;
    status: string;
    to:
      | '/projects/$projectId/lineage'
      | '/projects/$projectId/articles'
      | '/projects/$projectId/books';
    icon: React.ElementType;
  }[] = [
    {
      id: 'lineage',
      title: '世系',
      desc: '维护家族世代脉络、支派分房与成员关系图谱。',
      status: '已启用',
      to: '/projects/$projectId/lineage',
      icon: GitFork,
    },
    {
      id: 'articles',
      title: '谱文',
      desc: '编修谱序、凡例、姓氏源流、家训与先贤传记。',
      status: articleCount !== null ? `已收录 ${articleCount} 篇` : '已启用',
      to: '/projects/$projectId/articles',
      icon: ScrollText,
    },
    {
      id: 'books',
      title: '谱书',
      desc: '组织分卷目录、题签封面与线装成书版式预览。',
      status:
        projectBooks !== undefined ? `已建 ${projectBooks.length} 册` : '已启用',
      to: '/projects/$projectId/books',
      icon: BookOpen,
    },
  ];

  const handleSaveProject = async (values: AssetEditorSubmitValues) => {
    if (!targetProjectId) return;
    setSaving(true);
    setEditError(null);
    try {
      let versionStamp = expectedVersion;
      if (versionStamp == null) {
        const latest = await fetchProject(targetProjectId);
        versionStamp = latest.project.version;
      }
      const payload = toCreateProjectPayload(values);
      const { status: _formStatus, ...payloadWithoutStatus } = payload;
      const { project } = await updateProjectRequest(targetProjectId, {
        ...payloadWithoutStatus,
        ...(projectStatus !== null ? { status: projectStatus } : {}),
        surname: payload.surname ?? null,
        ancestor: payload.ancestor ?? null,
        hallName: payload.hallName ?? null,
        originText: payload.originText ?? null,
        description: payload.description ?? null,
        version: versionStamp,
      });
      syncProject(project);
      queryClient.setQueryData(
        dashboardKeys.project(targetProjectId),
        project,
      );
      await queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      setIsEditOpen(false);
    } catch (err) {
      setEditError(errorMessage(err));
    } finally {
      setSaving(false);
    }
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
                  <h1 className="yp-h1 text-foreground truncate">
                    {activeProject?.name || '家族工作台'}
                  </h1>
                  {activeProject?.hallName && (
                    <span className="text-[13px] font-medium text-muted-foreground whitespace-nowrap">
                      · {activeProject.hallName}
                    </span>
                  )}
                  <span className="text-[12px] font-medium text-muted-foreground tabular-nums whitespace-nowrap">
                    · 更新于{' '}
                    {activeProject?.updatedAt
                      ? formatProjectUpdatedAt(activeProject.updatedAt)
                      : '刚刚'}
                  </span>
                </div>
                <p className="text-[13px] text-muted-foreground mt-0.5 truncate">
                  {activeProject?.description ||
                    '围绕世系梳理、谱文编修与谱书排版开展家族谱牒协作。'}
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
                  void navigate({
                    to: '/projects/$projectId/settings',
                    params: { projectId: activeProjectId },
                  })
                }
                className="h-8 gap-1.5 text-[13px] font-medium whitespace-nowrap shrink-0"
              >
                <Settings size={14} /> 家族设置
              </Button>
            </div>
          </div>

          {/* 3-Column Cloud Genealogy Core Modules: 世系 / 谱文 / 谱书 */}
          <section className="space-y-3">
            <h2 className="yp-h3 text-foreground">
              云谱编修工作区
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {workbenchModules.map((mod) => {
                const Icon = mod.icon;
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() =>
                      void navigate({
                        to: mod.to,
                        params: { projectId: activeProjectId },
                      })
                    }
                    className="flex flex-col justify-between gap-4 p-5 rounded-xl border border-border bg-card hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-card-hover)] transition-all duration-150 text-left cursor-pointer group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="w-10 h-10 rounded-lg bg-[var(--surface-subtle)] border border-border flex items-center justify-center text-primary shrink-0">
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
            <h2 className="yp-h3 text-foreground">
              云谱档案摘要
            </h2>
            <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden shadow-[var(--shadow-card)]">
              <div className="grid grid-cols-1 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border">
                <div className="p-4 space-y-1">
                  <div className="text-[12px] text-muted-foreground">家族姓氏</div>
                  <div className="text-[14px] font-semibold text-foreground">
                    {surnameOf(activeProject) || '未填写'}
                  </div>
                </div>
                <div className="p-4 space-y-1">
                  <div className="text-[12px] text-muted-foreground">始迁祖</div>
                  <div className="text-[14px] font-semibold text-foreground">
                    {activeProject?.ancestor || '未填写'}
                  </div>
                </div>
                <div className="p-4 space-y-1">
                  <div className="text-[12px] text-muted-foreground">堂号</div>
                  <div className="text-[14px] font-semibold text-foreground">
                    {activeProject?.hallName || '未填写'}
                  </div>
                </div>
                <div className="p-4 space-y-1">
                  <div className="text-[12px] text-muted-foreground">所在地区</div>
                  <div className="text-[14px] font-semibold text-foreground">
                    {formatGenealogyPlace(
                      parsePlaceText(activeProject?.originText ?? undefined),
                    ) || '未填写'}
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-1">
                <div className="text-[12px] text-muted-foreground">家族简介</div>
                <div className="text-[13px] text-foreground leading-relaxed">
                  {activeProject?.description || '暂无家族简介'}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {isEditOpen && (
        <Suspense fallback={null}>
          <AssetEditorModal
            open={isEditOpen}
            mode="edit"
            kind="project"
            submitting={saving}
            error={editError}
            initialValue={
              activeProject
                ? {
                    name: activeProject.name,
                    description: activeProject.description ?? '',
                    colorTheme: activeProject.colorTheme,
                    surname: activeProject.surname ?? '',
                    ancestor: activeProject.ancestor ?? undefined,
                    originText: activeProject.originText ?? '',
                    hallName: activeProject.hallName ?? '',
                    status: projectStatus ?? activeProject.status,
                    projectLevel: activeProject.projectLevel,
                  }
                : undefined
            }
            onClose={() => {
              if (saving) return;
              setIsEditOpen(false);
              setEditError(null);
            }}
            onSubmit={(values) => void handleSaveProject(values)}
          />
        </Suspense>
      )}
    </>
  );
};

export default ProjectHomePage;
