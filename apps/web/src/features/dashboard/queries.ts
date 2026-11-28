import { useMemo } from 'react';
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import type { OrganizationSummary } from '../auth/api';
import { useAuthStore } from '../auth/useAuthStore';
import {
  fetchAccount,
  fetchInvites,
  fetchMembers,
  fetchOrganization,
  fetchOrganizations,
  fetchProject,
  fetchProjects,
} from './api';
import {
  createOrganizationProjectController,
  dashboardKeys,
  PROJECT_SWITCHER_LIMIT,
  resolveCurrentOrganizationId,
  type OrganizationProjectController,
} from './organizationProjectModule';

export {
  dashboardKeys,
  PROJECT_SWITCHER_LIMIT,
  resolveCurrentOrganizationId,
  type OrganizationProjectController,
};

export function useOrganizationsQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: dashboardKeys.organizations(),
    queryFn: () => fetchOrganizations(),
    enabled: options?.enabled ?? true,
  });
}

export function useOrganizationQuery(organizationId: string) {
  return useQuery({
    queryKey: dashboardKeys.organization(organizationId),
    queryFn: async () => (await fetchOrganization(organizationId)).organization,
    enabled: Boolean(organizationId),
  });
}

export function useProjectsQuery(
  organizationId: string,
  params: { limit?: number; sort?: 'recent' } = {},
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: dashboardKeys.projects(organizationId, params),
    queryFn: () => fetchProjects(organizationId, params),
    enabled: Boolean(organizationId) && (options?.enabled ?? true),
  });
}

export function useProjectSwitcherQuery(
  organizationId: string,
  enabled = true,
) {
  return useProjectsQuery(
    organizationId,
    { limit: PROJECT_SWITCHER_LIMIT, sort: 'recent' },
    { enabled },
  );
}

export function useProjectsInfiniteQuery(
  organizationId: string,
  params: { limit?: number; sort?: 'recent' } = {},
) {
  return useInfiniteQuery({
    queryKey: dashboardKeys.projects(organizationId, params),
    queryFn: ({ pageParam }) =>
      fetchProjects(organizationId, { ...params, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(organizationId),
  });
}

export function useProjectQuery(
  projectId: string,
  options?: { enabled?: boolean; retry?: boolean | number },
) {
  return useQuery({
    queryKey: dashboardKeys.project(projectId),
    queryFn: async () => (await fetchProject(projectId)).project,
    enabled: Boolean(projectId) && (options?.enabled ?? true),
    retry: options?.retry,
  });
}

export function useMembersInfiniteQuery(
  organizationId: string,
  params: { limit?: number } = {},
) {
  return useInfiniteQuery({
    queryKey: dashboardKeys.members(organizationId, params),
    queryFn: ({ pageParam }) =>
      fetchMembers(organizationId, { ...params, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(organizationId),
  });
}

export function useInvitesQuery(
  organizationId: string,
  params: { limit?: number; enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: dashboardKeys.invites(organizationId, { limit: params.limit }),
    queryFn: () => fetchInvites(organizationId, { limit: params.limit }),
    enabled: Boolean(organizationId) && (params.enabled ?? true),
  });
}

export function useAccountQuery() {
  return useQuery({
    queryKey: dashboardKeys.account(),
    queryFn: () => fetchAccount(),
  });
}

export function useCurrentOrganizationId(): string {
  const sessionOrganizationId = useWorkspaceStore(
    (s) => s.activeOrganizationId,
  );
  const defaultOrganizationId = useAuthStore(
    (s) => s.defaultOrganization?.id ?? null,
  );
  return resolveCurrentOrganizationId(
    sessionOrganizationId,
    defaultOrganizationId,
  );
}

export function useCurrentOrganization(): OrganizationSummary | null {
  const organizationId = useCurrentOrganizationId();
  const defaultOrganization = useAuthStore((s) => s.defaultOrganization);
  const orgQuery = useOrganizationQuery(organizationId);
  const orgsQuery = useOrganizationsQuery({
    enabled:
      Boolean(organizationId) &&
      defaultOrganization?.id !== organizationId &&
      !orgQuery.data,
  });

  return useMemo(() => {
    if (!organizationId) return defaultOrganization;
    if (orgQuery.data) {
      return {
        id: orgQuery.data.id,
        name: orgQuery.data.name,
        role: orgQuery.data.myRole,
        isOwner: orgQuery.data.isOwner,
      };
    }
    const listed = orgsQuery.data?.organizations.find(
      (org) => org.id === organizationId,
    );
    if (listed) {
      return {
        id: listed.id,
        name: listed.name,
        role: listed.role,
        isOwner: listed.isOwner,
      };
    }
    if (defaultOrganization?.id === organizationId) {
      return defaultOrganization;
    }
    return null;
  }, [organizationId, defaultOrganization, orgQuery.data, orgsQuery.data]);
}

export function useOrganizationProjectActions(): OrganizationProjectController {
  const queryClient = useQueryClient();
  return useMemo(
    () => createOrganizationProjectController({ queryClient }),
    [queryClient],
  );
}
