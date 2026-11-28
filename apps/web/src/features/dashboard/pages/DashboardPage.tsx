import React, { useEffect, useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { FolderPlus, X } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { useWorkspaceStore } from '../../../store/useWorkspaceStore';
import { useCurrentUserProfile } from '../../../hooks/useCurrentUserProfile';
import { articleDirectoryToTreeItems } from '../../articles/adapter';
import { fetchArticlesDirectory } from '../../articles/api';
import { articlesKeys } from '../../articles/queries';
import { fetchBooks } from '../../books/api';
import { booksKeys } from '../../books/queries';
import { errorMessage } from '../../../lib/api';
import { directoryToTreeItems, graphToPersonRecords } from '../../lineage/adapter';
import { fetchLineageDirectory, fetchLineageGraph } from '../../lineage/api';
import { lineageKeys } from '../../lineage/queries';
import { type ProjectRecord } from '../api';
import {
  useCurrentOrganizationId,
  useOrganizationProjectActions,
  useOrganizationQuery,
  useProjectsInfiniteQuery,
} from '../queries';
import { toCreateProjectPayload } from '../projectPayload';
import PageSkeleton from '../components/PageSkeleton';
import PageError from '../components/PageError';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  AssetEditorModal,
  type AssetEditorSubmitValues,
} from '../components/AssetEditorModal';
import { FamilyCard, type FamilyCardMetrics } from '../components/FamilyCard';
import { ZibeiSettingsModal } from '../components/ZibeiSettingsModal';

const EMPTY_ZIBEI_BY_PROJECT: Record<string, string[]> = {};

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useCurrentUserProfile();
  const activeWorkspaceId = useCurrentOrganizationId();
  const activeProjectId = useWorkspaceStore((s) => s.activeProjectId);
  const zibeiByProject = useWorkspaceStore(
    (s) => s.zibeiByProject ?? EMPTY_ZIBEI_BY_PROJECT,
  );
  const setProjectZibei = useWorkspaceStore((s) => s.setProjectZibei);
  const { createProject, updateProject, deleteProject, primeProjectCache } =
    useOrganizationProjectActions();

  const [formDialog, setFormDialog] = useState<{
    mode: 'create' | 'edit';
    project?: ProjectRecord;
  } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectRecord | null>(null);
  const [zibeiTarget, setZibeiTarget] = useState<ProjectRecord | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const orgQuery = useOrganizationQuery(activeWorkspaceId);
  const projectsQuery = useProjectsInfiniteQuery(activeWorkspaceId, {
    limit: 50,
    sort: 'recent',
  });

  const projects = useMemo(
    () => projectsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [projectsQuery.data],
  );

  const directoryQueries = useQueries({
    queries: projects.map((proj) => ({
      queryKey: lineageKeys.directory(proj.id),
      queryFn: () => fetchLineageDirectory(proj.id),
      enabled: Boolean(proj.id),
    })),
  });
  const directorySignature = directoryQueries
    .map((q) => `${q.dataUpdatedAt}:${q.data?.lineages.length ?? 0}`)
    .join('|');
  const directoryCounts = directoryQueries.map(
    (q) => q.data?.lineages.length ?? 0,
  );

  const articleDirQueries = useQueries({
    queries: projects.map((proj) => ({
      queryKey: articlesKeys.directory(proj.id),
      queryFn: () => fetchArticlesDirectory(proj.id),
      enabled: Boolean(proj.id),
    })),
  });
  const articleDirSignature = articleDirQueries
    .map((q) => `${q.dataUpdatedAt}:${q.data?.articles.length ?? 0}`)
    .join('|');
  const articleCounts = articleDirQueries.map(
    (q) => q.data?.articles.length ?? 0,
  );

  const booksQueries = useQueries({
    queries: projects.map((proj) => ({
      queryKey: booksKeys.list(proj.id),
      queryFn: () => fetchBooks(proj.id).then((res) => res.books),
      enabled: Boolean(proj.id),
    })),
  });
  const booksSignature = booksQueries
    .map((q) => `${q.dataUpdatedAt}:${q.data?.length ?? 0}`)
    .join('|');
  const bookCounts = booksQueries.map((q) => q.data?.length ?? 0);


  useEffect(() => {
    if (!actionNotice) return;
    const timer = setTimeout(() => setActionNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [actionNotice]);

  const detail = orgQuery.data ?? null;
  const myRole = detail?.myRole;
  const canCreate = myRole === 'admin' || myRole === 'editor';
  const canDelete = myRole === 'admin';

  const currentProjectId = useMemo(() => {
    if (activeProjectId && projects.some((p) => p.id === activeProjectId)) {
      return activeProjectId;
    }
    return projects[0]?.id ?? '';
  }, [activeProjectId, projects]);

  const metricsByProject = useMemo(() => {
    const map: Record<string, FamilyCardMetrics> = {};
    projects.forEach((project, idx) => {
      const lineageCount = directoryCounts[idx] ?? 0;
      const articleCount = articleCounts[idx] ?? 0;
      const bookCount = bookCounts[idx] ?? 0;

      map[project.id] = {
        lineageCount,
        personCount: 0,
        articleCount,
        bookCount,
      };
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    projects,
    directorySignature,
    articleDirSignature,
    booksSignature,
  ]);

  const handleOpen = (
    project: ProjectRecord,
    subPath: '' | '/lineage' | '/articles' | '/books' = ''
  ) => {
    primeProjectCache(project);
    const routeMap = {
      '': '/projects/$projectId',
      '/lineage': '/projects/$projectId/lineage',
      '/articles': '/projects/$projectId/articles',
      '/books': '/projects/$projectId/books',
    } as const;
    void navigate({
      to: routeMap[subPath],
      params: { projectId: project.id },
    });
  };

  const handleExportFamily = async (project: ProjectRecord) => {
    try {
      const [directory, articleDir, booksPayload] = await Promise.all([
        fetchLineageDirectory(project.id),
        fetchArticlesDirectory(project.id),
        fetchBooks(project.id),
      ]);
      const lineageTree = directoryToTreeItems(
        directory.folders,
        directory.lineages,
      );
      const graphs = await Promise.all(
        directory.lineages.map((lin) => fetchLineageGraph(project.id, lin.id)),
      );
      const lineageCharts: Record<string, unknown> = {};
      directory.lineages.forEach((lin, idx) => {
        const payload = graphs[idx];
        lineageCharts[lin.id] = {
          name: lin.name,
          persons: payload ? graphToPersonRecords(project.id, payload) : [],
        };
      });

      const backupPayload = {
        schema: 'yunpu-family-backup/v1',
        exportedAt: new Date().toISOString(),
        family: project,
        zibei: zibeiByProject[project.id] ?? [],
        lineageTree,
        lineageCharts,
        articleTree: articleDirectoryToTreeItems(
          articleDir.folders,
          articleDir.articles,
        ),
        articles: articleDir.articles,
        books: booksPayload.books,
      };

      const blob = new Blob([JSON.stringify(backupPayload, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${project.name}-家族备份-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setActionNotice(`已导出「${project.name}」家族完整备份文件`);
    } catch (error) {
      setActionError(`导出备份失败：${errorMessage(error)}`);
    }
  };

  // 家族建档弹窗提交：由服务端按 ancestor 原子初始化始迁祖世系节点。
  const handleEditorSubmit = async (values: AssetEditorSubmitValues) => {
    if (!formDialog) return;
    setFormError(null);
    setFormSaving(true);
    try {
      const payload = toCreateProjectPayload(values);
      if (formDialog.mode === 'create') {
        await createProject(activeWorkspaceId, payload, {
          selectProject: false,
        });
      } else if (formDialog.project) {
        const original = formDialog.project;
        await updateProject(original.id, {
          ...payload,
          surname: payload.surname ?? null,
          ancestor: payload.ancestor ?? null,
          hallName: payload.hallName ?? null,
          originText: payload.originText ?? null,
          description: payload.description ?? null,
          projectLevel: values.projectLevel ?? original.projectLevel,
          version: original.version,
        });
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
      await deleteProject(deleteTarget.id);
      setDeleteTarget(null);
    } catch (error) {
      setActionError(errorMessage(error));
      setDeleteTarget(null);
    }
  };

  const isLoading =
    Boolean(activeWorkspaceId) &&
    (orgQuery.isPending || projectsQuery.isPending);
  const queryError = orgQuery.error ?? projectsQuery.error;

  if (isLoading) {
    return (
      <div className="flex-1 h-full overflow-y-auto bg-background">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-7">
          <PageSkeleton variant="rows" />
        </div>
      </div>
    );
  }

  if (queryError) {
    return (
      <div className="flex-1 h-full overflow-y-auto bg-background">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-7">
          <PageError
            message={errorMessage(queryError)}
            onRetry={() => {
              void orgQuery.refetch();
              void projectsQuery.refetch();
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full overflow-y-auto bg-background">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-7 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="yp-h1 text-foreground">
              家族
            </h1>
            <p className="text-[14px] text-muted-foreground mt-1 tabular-nums">
              {detail?.name ?? '当前组织'} · 共 {projects.length} 个家族
            </p>
          </div>
          {canCreate && (
            <Button size="sm" onClick={() => setFormDialog({ mode: 'create' })}>
              <FolderPlus size={15} className="mr-1.5" />
              新建家族
            </Button>
          )}
        </div>

        {actionError && (
          <div
            role="alert"
            className="flex items-center justify-between rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-2.5 text-[13px] text-destructive"
          >
            <span>{actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              aria-label="关闭"
              className="cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {actionNotice && (
          <div
            role="status"
            className="flex items-center justify-between rounded-lg border border-primary/30 bg-[var(--surface-active)] px-4 py-2.5 text-[13px] text-foreground"
          >
            <span>{actionNotice}</span>
            <button
              type="button"
              onClick={() => setActionNotice(null)}
              aria-label="关闭"
              className="cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
            <p className="text-sm text-muted-foreground">尚无家族</p>
            {canCreate && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setFormDialog({ mode: 'create' })}
              >
                <FolderPlus size={14} className="mr-1.5" />
                新建家族
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {projects.map((project) => (
              <FamilyCard
                key={project.id}
                project={project}
                isCurrent={project.id === currentProjectId}
                metrics={
                  metricsByProject[project.id] ?? {
                    lineageCount: 0,
                    personCount: 0,
                    articleCount: 0,
                    bookCount: 0,
                  }
                }
                maintainerName={user?.name || '家族编委会'}
                zibeiWords={zibeiByProject[project.id] ?? []}
                canEdit={canCreate}
                canDelete={canDelete}
                onOpen={handleOpen}
                onExport={handleExportFamily}
                onEdit={(proj) => setFormDialog({ mode: 'edit', project: proj })}
                onDelete={(proj) => setDeleteTarget(proj)}
                onManageZibei={(proj) => setZibeiTarget(proj)}
              />
            ))}
          </div>
        )}

        {projectsQuery.hasNextPage && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              disabled={projectsQuery.isFetchingNextPage}
              onClick={() => void projectsQuery.fetchNextPage()}
            >
              {projectsQuery.isFetchingNextPage ? '加载中…' : '加载更多'}
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
                    id: p.id,
                    name: p.name,
                    description: p.description ?? '',
                    // 网络边界兜底：后端未返回新字段时避免预览组件读 undefined 崩溃。
                    colorTheme: p.colorTheme ?? 'sky',
                    iconKey: p.iconKey ?? null,
                    surname: p.surname ?? '',
                    ancestor: p.ancestor ?? '',
                    originText: p.originText ?? '',
                    hallName: p.hallName ?? '',
                    status: p.status,
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

      <ZibeiSettingsModal
        open={zibeiTarget !== null}
        familyName={zibeiTarget?.name ?? ''}
        surname={zibeiTarget?.surname}
        initialWords={zibeiTarget ? (zibeiByProject[zibeiTarget.id] ?? []) : []}
        onClose={() => setZibeiTarget(null)}
        onSave={(words) => {
          if (zibeiTarget) {
            setProjectZibei(zibeiTarget.id, words);
            setActionNotice(`已更新「${zibeiTarget.name}」字辈序列（共 ${words.length} 世）`);
          }
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除家族"
        description={`删除「${deleteTarget?.name ?? ''}」后，家族列表中将不再出现该记录，且不可撤销。`}
        confirmLabel="删除"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default DashboardPage;
