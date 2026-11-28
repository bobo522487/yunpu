import type { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../../lib/api';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import type { OrganizationSummary } from '../auth/api';
import { useAuthStore } from '../auth/useAuthStore';
import { lineageKeys } from '../lineage/queries';
import {
  activateOrganizationRequest,
  createProjectRequest,
  deleteProjectRequest,
  fetchOrganization,
  fetchOrganizations,
  fetchProject,
  fetchProjects,
  updateOrganizationRequest,
  updateProjectRequest,
  type CreateProjectPayload,
  type OrgDetail,
  type OrganizationsPayload,
  type Page,
  type ProjectRecord,
  type UpdateProjectPayload,
} from './api';

/** 家族切换下拉框拉取上限，与后端 ListProjectsQuerySchema 最大值保持一致。 */
export const PROJECT_SWITCHER_LIMIT = 200;

export const dashboardKeys = {
  all: ['dashboard'] as const,
  organizations: () => [...dashboardKeys.all, 'organizations'] as const,
  organization: (orgId: string) =>
    [...dashboardKeys.all, 'organization', orgId] as const,
  projects: (orgId: string, params?: { limit?: number; sort?: 'recent' }) =>
    [...dashboardKeys.all, 'projects', orgId, params ?? {}] as const,
  project: (projectId: string) =>
    [...dashboardKeys.all, 'project', projectId] as const,
  members: (orgId: string, params?: { limit?: number }) =>
    [...dashboardKeys.all, 'members', orgId, params ?? {}] as const,
  invites: (orgId: string, params?: { limit?: number }) =>
    [...dashboardKeys.all, 'invites', orgId, params ?? {}] as const,
  account: () => [...dashboardKeys.all, 'account'] as const,
};

export interface OrganizationProjectTransport {
  fetchOrganizations: () => Promise<OrganizationsPayload>;
  fetchOrganization: (organizationId: string) => Promise<{ organization: OrgDetail }>;
  updateOrganization: (
    organizationId: string,
    patch: { name?: string; status?: 'archived' },
  ) => Promise<{ organization: OrgDetail }>;
  activateOrganization: (
    organizationId: string,
  ) => Promise<{ organization: OrganizationSummary }>;
  fetchProjects: (
    organizationId: string,
    page?: { cursor?: string; limit?: number; sort?: 'recent' },
  ) => Promise<Page<ProjectRecord>>;
  fetchProject: (projectId: string) => Promise<{ project: ProjectRecord }>;
  createProject: (
    organizationId: string,
    payload: CreateProjectPayload,
  ) => Promise<{ project: ProjectRecord }>;
  updateProject: (
    projectId: string,
    payload: UpdateProjectPayload & { version: number },
  ) => Promise<{ project: ProjectRecord }>;
  deleteProject: (projectId: string) => Promise<{ deleted: boolean }>;
}

export interface OrganizationProjectSessionAdapter {
  getActiveOrganizationId: () => string;
  setActiveOrganizationId: (organizationId: string) => void;
  getActiveProjectId: () => string;
  setActiveProjectId: (projectId: string) => void;
  getDefaultOrganization: () => OrganizationSummary | null;
  setDefaultOrganization: (org: OrganizationSummary | null) => void;
  isAuthenticated: () => boolean;
  refreshSession?: () => Promise<void>;
}

export const defaultOrganizationProjectTransport: OrganizationProjectTransport = {
  fetchOrganizations,
  fetchOrganization,
  updateOrganization: updateOrganizationRequest,
  activateOrganization: activateOrganizationRequest,
  fetchProjects,
  fetchProject,
  createProject: createProjectRequest,
  updateProject: updateProjectRequest,
  deleteProject: deleteProjectRequest,
};

export const defaultOrganizationProjectSession: OrganizationProjectSessionAdapter = {
  getActiveOrganizationId: () => useWorkspaceStore.getState().activeOrganizationId,
  setActiveOrganizationId: (organizationId) =>
    useWorkspaceStore.getState().setActiveOrganizationId(organizationId),
  getActiveProjectId: () => useWorkspaceStore.getState().activeProjectId,
  setActiveProjectId: (projectId) =>
    useWorkspaceStore.getState().setActiveProjectId(projectId),
  getDefaultOrganization: () => useAuthStore.getState().defaultOrganization,
  setDefaultOrganization: (org) =>
    useAuthStore.getState().setDefaultOrganization(org),
  isAuthenticated: () => useAuthStore.getState().status === 'authenticated',
  refreshSession: () => useAuthStore.getState().refreshSession(),
};

/**
 * 解析 Current Organization ID：优先当前会话选中态，首帧回退至服务端 Default Organization。
 */
export function resolveCurrentOrganizationId(
  sessionOrganizationId: string,
  defaultOrganizationId: string | null | undefined,
): string {
  return sessionOrganizationId || defaultOrganizationId || '';
}

export function isVersionConflictError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 409 || error.code === 'VERSION_CONFLICT')
  );
}

export interface OrganizationProjectController {
  primeProjectCache: (project: ProjectRecord) => void;
  createProject: (
    organizationId: string,
    payload: CreateProjectPayload,
    options?: { selectProject?: boolean },
  ) => Promise<ProjectRecord>;
  updateProject: (
    projectId: string,
    input: UpdateProjectPayload & { version?: number },
  ) => Promise<ProjectRecord>;
  duplicateProject: (projectId: string) => Promise<ProjectRecord>;
  deleteProject: (projectId: string) => Promise<void>;
  switchOrganization: (organizationId: string) => Promise<OrganizationSummary>;
  renameOrganization: (organizationId: string, name: string) => Promise<OrgDetail>;
  archiveOrganization: (
    organizationId: string,
  ) => Promise<{ nextOrganization: OrganizationSummary | null }>;
}

export function createOrganizationProjectController({
  queryClient,
  transport = defaultOrganizationProjectTransport,
  session = defaultOrganizationProjectSession,
}: {
  queryClient: QueryClient;
  transport?: OrganizationProjectTransport;
  session?: OrganizationProjectSessionAdapter;
}): OrganizationProjectController {
  const primeProjectCache = (project: ProjectRecord) => {
    queryClient.setQueryData(dashboardKeys.project(project.id), project);
    session.setActiveProjectId(project.id);
  };

  const createProject = async (
    organizationId: string,
    payload: CreateProjectPayload,
    options?: { selectProject?: boolean },
  ): Promise<ProjectRecord> => {
    const { project } = await transport.createProject(organizationId, payload);
    queryClient.setQueryData(dashboardKeys.project(project.id), project);
    if (options?.selectProject ?? true) {
      session.setActiveProjectId(project.id);
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
      queryClient.invalidateQueries({
        queryKey: lineageKeys.directory(project.id),
      }),
    ]);
    return project;
  };

  const updateProject = async (
    projectId: string,
    input: UpdateProjectPayload & { version?: number },
  ): Promise<ProjectRecord> => {
    const { version: explicitVersion, ...patch } = input;
    const cached = queryClient.getQueryData<ProjectRecord>(
      dashboardKeys.project(projectId),
    );
    const version =
      explicitVersion ??
      cached?.version ??
      (await transport.fetchProject(projectId)).project.version;

    try {
      const { project } = await transport.updateProject(projectId, {
        ...patch,
        version,
      });
      queryClient.setQueryData(dashboardKeys.project(projectId), project);
      await queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      return project;
    } catch (error) {
      if (isVersionConflictError(error)) {
        // CAS 冲突后立即刷新服务端最新状态，同时显式向调用方抛出错误。
        await queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      }
      throw error;
    }
  };

  const duplicateProject = async (projectId: string): Promise<ProjectRecord> => {
    const cached = queryClient.getQueryData<ProjectRecord>(
      dashboardKeys.project(projectId),
    );
    const source = cached ?? (await transport.fetchProject(projectId)).project;

    // 遵循 ADR-0022：复制家族时不跨项目透传 iconKey（媒体路径受源项目隔离保护）。
    return createProject(
      source.organizationId,
      {
        name: `${source.name} (副本)`,
        status: source.status,
        surname: source.surname ?? undefined,
        ancestor: source.ancestor ?? undefined,
        hallName: source.hallName ?? undefined,
        originText: source.originText ?? undefined,
        description: source.description ?? undefined,
        colorTheme: source.colorTheme,
        projectLevel: source.projectLevel,
      },
      { selectProject: true },
    );
  };

  const deleteProject = async (projectId: string): Promise<void> => {
    await transport.deleteProject(projectId);
    if (session.getActiveProjectId() === projectId) {
      session.setActiveProjectId('');
    }
    queryClient.removeQueries({ queryKey: dashboardKeys.project(projectId) });
    await queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
  };

  const switchOrganization = async (
    organizationId: string,
  ): Promise<OrganizationSummary> => {
    const result = await transport.activateOrganization(organizationId);
    session.setActiveOrganizationId(result.organization.id);
    session.setActiveProjectId('');
    if (session.isAuthenticated()) {
      session.setDefaultOrganization(result.organization);
    }
    await queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    return result.organization;
  };

  const renameOrganization = async (
    organizationId: string,
    name: string,
  ): Promise<OrgDetail> => {
    const { organization } = await transport.updateOrganization(organizationId, {
      name: name.trim(),
    });
    queryClient.setQueryData(
      dashboardKeys.organization(organizationId),
      organization,
    );
    const prevDefault = session.getDefaultOrganization();
    if (session.isAuthenticated() && prevDefault?.id === organizationId) {
      session.setDefaultOrganization({
        ...prevDefault,
        name: organization.name,
      });
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: dashboardKeys.organizations() }),
      queryClient.invalidateQueries({
        queryKey: dashboardKeys.organization(organizationId),
      }),
    ]);
    return organization;
  };

  const archiveOrganization = async (
    organizationId: string,
  ): Promise<{ nextOrganization: OrganizationSummary | null }> => {
    await transport.updateOrganization(organizationId, { status: 'archived' });
    const payload = await transport.fetchOrganizations();
    queryClient.setQueryData(dashboardKeys.organizations(), payload);

    if (payload.organizations.length === 0) {
      session.setActiveOrganizationId('');
      session.setActiveProjectId('');
      session.setDefaultOrganization(null);
      if (session.refreshSession) {
        await session.refreshSession();
      }
      await queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      return { nextOrganization: null };
    }

    const next =
      payload.organizations.find(
        (org) => org.id === payload.defaultOrganizationId,
      ) ?? payload.organizations[0];
    const activated = await switchOrganization(next.id);
    return { nextOrganization: activated };
  };

  return {
    primeProjectCache,
    createProject,
    updateProject,
    duplicateProject,
    deleteProject,
    switchOrganization,
    renameOrganization,
    archiveOrganization,
  };
}
