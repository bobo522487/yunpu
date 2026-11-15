import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, FolderPlus, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePreferencesStore } from '../../../store/usePreferencesStore';
import { useWorkspaceStore } from '../../../store/useWorkspaceStore';
import { ProjectColoredIcon } from '../../../components/common/NocoIcons';
import { errorMessage } from '../../../lib/api';
import {
  fetchOrganization,
  fetchProjects,
  type OrgDetail,
  type ProjectRecord,
} from '../api';
import PageSkeleton from '../components/PageSkeleton';
import PageError from '../components/PageError';

type HomeState = {
  loading: boolean;
  error: string | null;
  detail: OrgDetail | null;
  projects: ProjectRecord[];
};

const EMPTY: HomeState = { loading: true, error: null, detail: null, projects: [] };

const WorkspaceHomePage: React.FC = () => {
  const navigate = useNavigate();
  const user = usePreferencesStore((s) => s.user);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const syncProject = useWorkspaceStore((s) => s.syncProject);
  const [state, setState] = useState<HomeState>(EMPTY);

  const load = useCallback(async () => {
    if (!activeWorkspaceId) {
      setState({ loading: false, error: null, detail: null, projects: [] });
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const [detailResult, projectsResult] = await Promise.all([
        fetchOrganization(activeWorkspaceId),
        fetchProjects(activeWorkspaceId, { limit: 5, sort: 'recent' }),
      ]);
      setState({
        loading: false,
        error: null,
        detail: detailResult.organization,
        projects: projectsResult.items,
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: errorMessage(error),
      }));
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.loading) {
    return (
      <div className="flex-1 h-full overflow-y-auto bg-background">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-7">
          <PageSkeleton variant="cards" />
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

  const detail = state.detail;
  const recentProjects = state.projects.slice(0, 5);

  return (
    <div className="flex-1 h-full overflow-y-auto bg-background">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-7 space-y-8">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            你好，{user.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            欢迎来到「{detail?.name ?? '当前组织'}」，管理你的谱项目与协作成员。
          </p>
        </div>

        {/* 组织概览 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="p-4 rounded-xl border border-border bg-card">
            <div className="text-[12px] font-medium text-muted-foreground">项目</div>
            <div className="text-2xl font-semibold text-foreground tabular-nums mt-1">
              {detail?.projectCount ?? 0}
            </div>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card">
            <div className="text-[12px] font-medium text-muted-foreground">成员</div>
            <div className="text-2xl font-semibold text-foreground tabular-nums mt-1">
              {detail?.memberCount ?? 0}
            </div>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card">
            <div className="text-[12px] font-medium text-muted-foreground">
              待处理邀请
            </div>
            <div className="text-2xl font-semibold text-foreground tabular-nums mt-1">
              {detail?.pendingInviteCount ?? 0}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-3.5 p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-xs transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-lg bg-accent text-accent-foreground flex items-center justify-center shrink-0">
              <FolderPlus size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold text-foreground">新建项目</div>
              <div className="text-[12px] font-medium text-muted-foreground mt-0.5 tabular-nums">
                创建一份新的谱
              </div>
            </div>
            <ArrowRight
              size={15}
              className="text-muted-foreground group-hover:translate-x-0.5 transition-transform"
            />
          </button>

          <button
            type="button"
            onClick={() => navigate('/members')}
            className="flex items-center gap-3.5 p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-xs transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <UserPlus size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold text-foreground">邀请成员</div>
              <div className="text-[12px] font-medium text-muted-foreground mt-0.5 tabular-nums">
                当前 {detail?.memberCount ?? 0} 名成员
                {detail && detail.pendingInviteCount > 0
                  ? ` · ${detail.pendingInviteCount} 个待处理邀请`
                  : ''}
              </div>
            </div>
            <ArrowRight
              size={15}
              className="text-muted-foreground group-hover:translate-x-0.5 transition-transform"
            />
          </button>
        </div>

        {/* Recent Projects */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-semibold text-foreground">最近项目</h2>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-[13px] font-medium text-primary hover:underline"
            >
              查看全部
            </button>
          </div>

          {recentProjects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
              <p className="text-sm text-muted-foreground">尚无项目</p>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
              >
                <FolderPlus size={14} />
                新建项目
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {recentProjects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => {
                    syncProject(project);
                    navigate(`/projects/${project.id}`);
                  }}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card hover:border-muted-foreground/40 hover:shadow-xs transition-all cursor-pointer h-16 overflow-hidden"
                >
                  <div className="self-stretch w-16 flex items-center justify-center shrink-0 bg-sky-50 dark:bg-sky-500/10">
                    <ProjectColoredIcon colorTheme="sky" className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="text-[14px] font-semibold text-foreground truncate">
                      {project.name}
                    </div>
                    <div className="text-[12px] font-medium text-muted-foreground tabular-nums">
                      项目 · {new Date(project.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkspaceHomePage;
