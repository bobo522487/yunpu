import { apiRequest } from '../../lib/api';

// 载荷形状权威：specs/003-workspace-console/contracts/console-api.md
// 端点路径/权限权威：docs/architecture/api/endpoints.md §2.1–§2.3

export type OrganizationListItem = {
  id: string;
  name: string;
  role: string;
  isOwner: boolean;
  lastUsedAt: string | null;
};

export type OrganizationsPayload = {
  organizations: OrganizationListItem[];
  defaultOrganizationId: string | null;
};

export type OrganizationSummary = {
  id: string;
  name: string;
  role: string;
  isOwner: boolean;
};

export type OrgDetail = {
  id: string;
  name: string;
  status: 'active' | 'suspended' | 'archived';
  ownerUserId: string;
  myRole: 'admin' | 'editor' | 'viewer';
  isOwner: boolean;
  memberCount: number;
  pendingInviteCount: number;
  projectCount: number;
};

export type ProjectStatus = 'planning' | 'in_progress' | 'completed';

export type ProjectColorTheme =
  | 'sky'
  | 'pink'
  | 'orange'
  | 'indigo'
  | 'emerald'
  | 'violet';

export type ProjectRecord = {
  id: string;
  organizationId: string;
  name: string;
  status: ProjectStatus;
  surname: string | null;
  hallName: string | null;
  originText: string | null;
  description: string | null;
  colorTheme: ProjectColorTheme;
  projectLevel: number;
  createdAt: string;
  updatedAt: string;
};

export type MemberRecord = {
  userId: string;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  isOwner: boolean;
  joinedAt: string;
};

export type InviteRecord = {
  id: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  status: 'pending' | 'accepted' | 'revoked';
  expiresAt: string;
  createdAt: string;
};

export type AccountRecord = {
  id: string;
  email: string;
  name: string;
};

export type Page<T> = {
  items: T[];
  nextCursor: string | null;
};

export type CreateProjectPayload = {
  name: string;
  status?: ProjectStatus;
  surname?: string;
  hallName?: string;
  originText?: string;
  description?: string;
  colorTheme?: ProjectColorTheme;
  projectLevel?: number;
};

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

// ---- 组织 ----

export const fetchOrganizations = () =>
  apiRequest<OrganizationsPayload>('/api/v1/organizations');

export const fetchOrganization = (organizationId: string) =>
  apiRequest<{ organization: OrgDetail }>(
    `/api/v1/organizations/${organizationId}`,
  );

export const createOrganizationRequest = (name: string) =>
  apiRequest<{ organization: OrganizationSummary }>('/api/v1/organizations', {
    method: 'POST',
    body: { name },
  });

export const updateOrganizationRequest = (
  organizationId: string,
  patch: { name?: string; status?: 'archived' },
) =>
  apiRequest<{ organization: OrgDetail }>(
    `/api/v1/organizations/${organizationId}`,
    { method: 'PATCH', body: patch },
  );

export const activateOrganizationRequest = (organizationId: string) =>
  apiRequest<{ organization: OrganizationSummary }>(
    `/api/v1/organizations/${organizationId}/activate`,
    { method: 'POST' },
  );

export const leaveOrganizationRequest = (organizationId: string) =>
  apiRequest<{ left: boolean }>(
    `/api/v1/organizations/${organizationId}/leave`,
    { method: 'POST' },
  );

// ---- 成员 ----

export const fetchMembers = (
  organizationId: string,
  page: { cursor?: string; limit?: number } = {},
) =>
  apiRequest<Page<MemberRecord>>(
    `/api/v1/organizations/${organizationId}/members${query(page)}`,
  );

export const updateMemberRoleRequest = (
  organizationId: string,
  userId: string,
  role: 'admin' | 'editor' | 'viewer',
) =>
  apiRequest<{ member: MemberRecord }>(
    `/api/v1/organizations/${organizationId}/members/${userId}`,
    { method: 'PATCH', body: { role } },
  );

export const removeMemberRequest = (organizationId: string, userId: string) =>
  apiRequest<{ removed: boolean }>(
    `/api/v1/organizations/${organizationId}/members/${userId}`,
    { method: 'DELETE' },
  );

// ---- 邀请 ----

export const fetchInvites = (
  organizationId: string,
  page: { cursor?: string; limit?: number } = {},
) =>
  apiRequest<Page<InviteRecord>>(
    `/api/v1/organizations/${organizationId}/invites${query(page)}`,
  );

export const createInviteRequest = (
  organizationId: string,
  payload: { email: string; role: 'admin' | 'editor' | 'viewer' },
) =>
  apiRequest<{ invite: InviteRecord; inviteUrl: string }>(
    `/api/v1/organizations/${organizationId}/invites`,
    { method: 'POST', body: payload },
  );

export const revokeInviteRequest = (organizationId: string, inviteId: string) =>
  apiRequest<{ revoked: boolean }>(
    `/api/v1/organizations/${organizationId}/invites/${inviteId}`,
    { method: 'DELETE' },
  );

// ---- 所有权 ----

export const transferOwnerRequest = (
  organizationId: string,
  newOwnerUserId: string,
) =>
  apiRequest<{ ownerUserId: string }>(
    `/api/v1/organizations/${organizationId}/owner`,
    { method: 'PUT', body: { newOwnerUserId } },
  );

// ---- 项目 ----

export const fetchProjects = (
  organizationId: string,
  page: { cursor?: string; limit?: number; sort?: 'recent' } = {},
) =>
  apiRequest<Page<ProjectRecord>>(
    `/api/v1/organizations/${organizationId}/projects${query(page)}`,
  );

export const fetchProject = (projectId: string) =>
  apiRequest<{ project: ProjectRecord }>(`/api/v1/projects/${projectId}`);

export const createProjectRequest = (
  organizationId: string,
  payload: CreateProjectPayload,
) =>
  apiRequest<{ project: ProjectRecord }>(
    `/api/v1/organizations/${organizationId}/projects`,
    { method: 'POST', body: payload },
  );

export const updateProjectRequest = (
  projectId: string,
  payload: Partial<CreateProjectPayload> & { expectedUpdatedAt: string },
) =>
  apiRequest<{ project: ProjectRecord }>(`/api/v1/projects/${projectId}`, {
    method: 'PATCH',
    body: payload,
  });

export const deleteProjectRequest = (projectId: string) =>
  apiRequest<{ deleted: boolean }>(`/api/v1/projects/${projectId}`, {
    method: 'DELETE',
  });

// ---- 账号 ----

export const fetchAccount = () =>
  apiRequest<AccountRecord>('/api/v1/account');

export const updateAccountRequest = (name: string) =>
  apiRequest<AccountRecord>('/api/v1/account', {
    method: 'PATCH',
    body: { name },
  });

export const changePasswordRequest = (
  currentPassword: string,
  newPassword: string,
) =>
  apiRequest<{ changed: true }>('/api/v1/account/password', {
    method: 'POST',
    body: { currentPassword, newPassword },
  });
