import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  fetchAccount,
  fetchInvites,
  fetchMembers,
  fetchOrganization,
  fetchProject,
  fetchProjects,
} from './api';

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
) {
  return useQuery({
    queryKey: dashboardKeys.projects(organizationId, params),
    queryFn: () => fetchProjects(organizationId, params),
    enabled: Boolean(organizationId),
  });
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
