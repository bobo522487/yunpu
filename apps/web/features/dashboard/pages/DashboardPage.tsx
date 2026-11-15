import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FolderPlus, MoreVertical, Pencil, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ProjectColoredIcon } from '../../../components/common/NocoIcons';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { useWorkspaceStore } from '../../../store/useWorkspaceStore';
import { errorMessage } from '../../../lib/api';
import {
  createProjectRequest,
  deleteProjectRequest,
  fetchOrganization,
  fetchProjects,
  updateProjectRequest,
  type OrgDetail,
  type ProjectRecord,
  type ProjectStatus,
} from '../api';
import PageSkeleton from '../components/PageSkeleton';
import PageError from '../components/PageError';
import ConfirmDialog from '../components/ConfirmDialog';

const STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: '规划中',
  in_progress: '进行中',
  completed: '已完成',
};

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

function ProjectFormDialog(props: {
  mode: 'create' | 'edit';
  project?: ProjectRecord;
  onClose: () => void;
  onSaved: (project: ProjectRecord) => void;
}) {
  const { mode, project, onClose, onSaved } = props;
  const [name, setName] = useState(project?.name ?? '');
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? 'planning');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError(null);
    setSaving(true);
    try {
      if (mode === 'create') {
        const created = await createProjectRequest(
          useWorkspaceStore.getState().activeWorkspaceId,
          { name: name.trim(), status },
        );
        onSaved(created.project);
      } else if (project) {
        const updated = await updateProjectRequest(project.id, {
          name: name.trim(),
          status,
          expectedUpdatedAt: project.updatedAt,
        });
        onSaved(updated.project);
      }
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-foreground">
            {mode === 'create' ? '新建项目' : '编辑项目'}
          </h2>
          <button type="button" onClick={onClose} aria-label="关闭">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="project-name">项目名</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：李氏家谱"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project-status">状态</Label>
            <select
              id="project-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as ProjectStatus)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              {(Object.keys(STATUS_LABELS) as ProjectStatus[]).map((value) => (
                <option key={value} value={value}>
                  {STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-[13px] text-destructive">{error}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button size="sm" onClick={() => void submit()} disabled={saving || !name.trim()}>
            {saving ? '保存中…' : '保存'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

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
        <ProjectFormDialog
          mode={formDialog.mode}
          project={formDialog.project}
          onClose={() => setFormDialog(null)}
          onSaved={handleSaved}
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
