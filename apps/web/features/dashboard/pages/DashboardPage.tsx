import React, { useCallback, useEffect, useState } from 'react';
import { FolderPlus, MoreVertical, Pencil, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ProjectColoredIcon } from '../../../components/common/NocoIcons';
import { Button } from '../../../components/ui/button';
import { useWorkspaceStore } from '../../../store/useWorkspaceStore';
import { errorMessage } from '../../../lib/api';
import {
  createProjectRequest,
  deleteProjectRequest,
  fetchOrganization,
  fetchProjects,
  updateProjectRequest,
  type OrgDetail,
  type ProjectColorTheme,
  type ProjectRecord,
  type ProjectStatus,
} from '../api';
import PageSkeleton from '../components/PageSkeleton';
import PageError from '../components/PageError';
import ConfirmDialog from '../components/ConfirmDialog';
import { AssetEditorModal } from '../components/AssetEditorModal';
import { DEFAULT_REGION_PATH } from '../data/regions';

const STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: '规划中',
  in_progress: '进行中',
  completed: '已完成',
};

/** 弹窗状态 ↔ API 状态：'1'已完成；'0'进行中（编辑时保留原有“规划中”，不静默升级）。 */
const statusFromState = (
  state: '0' | '1',
  original?: ProjectStatus,
): ProjectStatus =>
  state === '1' ? 'completed' : original === 'planning' ? 'planning' : 'in_progress';

type PageState = {
  loading: boolean;
  error: string | null;
  detail: OrgDetail | null;
  projects: ProjectRecord[];
  nextCursor: string | null;
};

const EMPTY: PageState = {
  loading: true,
  error: null,
  detail: null,
  projects: [],
  nextCursor: null,
};

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const syncProject = useWorkspaceStore((s) => s.syncProject);
  const dropProject = useWorkspaceStore((s) => s.dropProject);
  const setActiveProjectId = useWorkspaceStore((s) => s.setActiveProjectId);

  const [state, setState] = useState<PageState>(EMPTY);
  const [formDialog, setFormDialog] = useState<{
    mode: 'create' | 'edit';
    project?: ProjectRecord;
  } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectRecord | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeWorkspaceId) {
      setState({ ...EMPTY, loading: false });
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const [detailResult, projectsResult] = await Promise.all([
        fetchOrganization(activeWorkspaceId),
        fetchProjects(activeWorkspaceId, { limit: 50, sort: 'recent' }),
      ]);
      setState({
        loading: false,
        error: null,
        detail: detailResult.organization,
        projects: projectsResult.items,
        nextCursor: projectsResult.nextCursor,
      });
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false, error: errorMessage(error) }));
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    if (!state.nextCursor || !activeWorkspaceId) return;
    try {
      const page = await fetchProjects(activeWorkspaceId, {
        cursor: state.nextCursor,
        limit: 50,
        sort: 'recent',
      });
      setState((prev) => ({
        ...prev,
        projects: [...prev.projects, ...page.items],
        nextCursor: page.nextCursor,
      }));
    } catch (error) {
      setState((prev) => ({ ...prev, error: errorMessage(error) }));
    }
  };

  const myRole = state.detail?.myRole;
  const canCreate = myRole === 'admin' || myRole === 'editor';
  const canDelete = myRole === 'admin';

  const handleOpen = (project: ProjectRecord) => {
    syncProject(project);
    setActiveProjectId(project.id);
    navigate(`/projects/${project.id}`);
  };

  const handleSaved = (project: ProjectRecord) => {
    syncProject(project);
    setState((prev) => ({
      ...prev,
      projects: prev.projects.some((p) => p.id === project.id)
        ? prev.projects.map((p) => (p.id === project.id ? project : p))
        : [project, ...prev.projects],
    }));
  };

  // 富弹窗（远端仓库“新建云谱项目”界面）提交：映射到项目 API 载荷。
  const handleEditorSubmit = async (values: {
    name: string;
    description: string;
    colorTheme: ProjectColorTheme;
    primarySurname?: string;
    region?: string;
    primaryName?: string;
    projectState?: '0' | '1';
    projectLevel?: number;
  }) => {
    if (!formDialog) return;
    setFormError(null);
    setFormSaving(true);
    try {
      const state0 = values.projectState ?? '0';
      if (formDialog.mode === 'create') {
        const created = await createProjectRequest(activeWorkspaceId, {
          name: values.name.trim(),
          status: statusFromState(state0),
          surname: values.primarySurname?.trim(),
          hallName: values.primaryName?.trim(),
          originText: values.region?.trim(),
          description: values.description.trim() || undefined,
          colorTheme: values.colorTheme,
          projectLevel: values.projectLevel ?? 1,
        });
        handleSaved(created.project);
      } else if (formDialog.project) {
        const original = formDialog.project;
        const updated = await updateProjectRequest(original.id, {
          name: values.name.trim(),
          status: statusFromState(state0, original.status),
          surname: values.primarySurname?.trim() ?? null,
          hallName: values.primaryName?.trim() ?? null,
          originText: values.region?.trim() ?? null,
          description: values.description.trim() || null,
          colorTheme: values.colorTheme,
          projectLevel: values.projectLevel ?? original.projectLevel,
          expectedUpdatedAt: original.updatedAt,
        });
        handleSaved(updated.project);
      }
      setFormDialog(null);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setFormSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionError(null);
    try {
      await deleteProjectRequest(deleteTarget.id);
      dropProject(deleteTarget.id);
      setState((prev) => ({
        ...prev,
        projects: prev.projects.filter((p) => p.id !== deleteTarget.id),
      }));
      setDeleteTarget(null);
    } catch (error) {
      setActionError(errorMessage(error));
      setDeleteTarget(null);
    }
  };

  if (state.loading) {
    return (
      <div className="flex-1 h-full overflow-y-auto bg-background">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-7">
          <PageSkeleton variant="rows" />
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="flex-1 h-full overflow-y-auto bg-background">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-7">
          <PageError message={state.error} onRetry={() => void load()} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full overflow-y-auto bg-background">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-7 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">项目</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {state.detail?.name ?? '当前组织'} · 共 {state.projects.length} 个项目
            </p>
          </div>
          {canCreate && (
            <Button size="sm" onClick={() => setFormDialog({ mode: 'create' })}>
              <FolderPlus size={15} className="mr-1.5" />
              新建项目
            </Button>
          )}
        </div>

        {actionError && (
          <div
            role="alert"
            className="flex items-center justify-between rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-2.5 text-[13px] text-destructive"
          >
            <span>{actionError}</span>
            <button type="button" onClick={() => setActionError(null)} aria-label="关闭">
              <X size={14} />
            </button>
          </div>
        )}

        {state.projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
            <p className="text-sm text-muted-foreground">尚无项目</p>
            {canCreate && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setFormDialog({ mode: 'create' })}
              >
                <FolderPlus size={14} className="mr-1.5" />
                新建项目
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {state.projects.map((project) => (
              <div
                key={project.id}
                className="group relative flex items-center gap-3 rounded-xl border border-border bg-card hover:border-muted-foreground/40 hover:shadow-xs transition-all h-16 overflow-hidden"
              >
                <button
                  type="button"
                  className="flex flex-1 items-center gap-3 min-w-0 text-left h-full"
                  onClick={() => handleOpen(project)}
                >
                  <div className="self-stretch w-16 flex items-center justify-center shrink-0 bg-sky-50 dark:bg-sky-500/10">
                    <ProjectColoredIcon colorTheme="sky" className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="text-[14px] font-semibold text-foreground truncate">
                      {project.name}
                    </div>
                    <div className="text-[12px] font-medium text-muted-foreground tabular-nums">
                      {STATUS_LABELS[project.status]} ·{' '}
                      {new Date(project.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                </button>
                {(canCreate || canDelete) && (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted"
                    onClick={() => setMenuFor(menuFor === project.id ? null : project.id)}
                    aria-label="项目操作"
                  >
                    <MoreVertical size={15} />
                  </button>
                )}
                {menuFor === project.id && (
                  <div className="absolute right-2 top-11 z-20 w-32 rounded-md border border-border bg-card py-1 shadow-lg">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-[13px] text-foreground hover:bg-muted"
                      onClick={() => {
                        setMenuFor(null);
                        setFormDialog({ mode: 'edit', project });
                      }}
                    >
                      <Pencil size={13} />
                      编辑
                    </button>
                    {canDelete && (
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-[13px] text-destructive hover:bg-muted"
                        onClick={() => {
                          setMenuFor(null);
                          setDeleteTarget(project);
                        }}
                      >
                        <Trash2 size={13} />
                        删除
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {state.nextCursor && (
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={() => void loadMore()}>
              加载更多
            </Button>
          </div>
        )}
      </div>

      {formDialog && (
        <AssetEditorModal
          open
          mode={formDialog.mode}
          kind="project"
          submitting={formSaving}
          error={formError}
          initialValue={
            formDialog.mode === 'edit' && formDialog.project
              ? (() => {
                  const p = formDialog.project;
                  return {
                    name: p.name,
                    description: p.description ?? '',
                    // 网络边界兜底：后端未返回新字段时避免预览组件读 undefined 崩溃。
                    colorTheme: p.colorTheme ?? 'sky',
                    primarySurname: p.surname ?? '',
                    region: p.originText || DEFAULT_REGION_PATH,
                    primaryName: p.hallName ?? '',
                    projectState: (p.status === 'completed' ? '1' : '0') as '0' | '1',
                    projectLevel: p.projectLevel ?? 1,
                  };
                })()
              : undefined
          }
          onClose={() => {
            if (formSaving) return;
            setFormDialog(null);
            setFormError(null);
          }}
          onSubmit={(values) => void handleEditorSubmit(values)}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除项目"
        description={`删除「${deleteTarget?.name ?? ''}」后，项目列表中将不再出现该操作，且不可撤销。`}
        confirmLabel="删除"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default DashboardPage;
