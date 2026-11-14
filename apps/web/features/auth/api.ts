import { apiRequest } from '../../lib/api';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

export type OrganizationSummary = {
  id: string;
  name: string;
  role: string;
  isOwner: boolean;
};

export type SessionPayload = {
  user: AuthUser | null;
  defaultOrganization: OrganizationSummary | null;
  onboarding: boolean;
};

export type InviteResult = {
  accepted: boolean;
  reason?: 'email_mismatch' | 'expired' | 'revoked' | 'already_used';
};

export type SignUpPayload = {
  user: AuthUser;
  defaultOrganization: OrganizationSummary;
  invite?: InviteResult;
};

export type SignInPayload = {
  user: AuthUser;
  defaultOrganization: OrganizationSummary | null;
  onboarding: boolean;
};

export const fetchSession = () =>
  apiRequest<SessionPayload>('/api/v1/auth/session');

export const signInRequest = (email: string, password: string) =>
  apiRequest<SignInPayload>('/api/v1/auth/sign-in', {
    method: 'POST',
    body: { email, password },
  });

export const signUpRequest = (
  email: string,
  password: string,
  inviteToken?: string,
) =>
  apiRequest<SignUpPayload>('/api/v1/auth/sign-up', {
    method: 'POST',
    body: { email, password, inviteToken: inviteToken || undefined },
  });

export const signOutRequest = () =>
  apiRequest<{ signedOut: boolean }>('/api/v1/auth/sign-out', {
    method: 'POST',
  });

export const createOrganizationRequest = (name: string) =>
  apiRequest<{ organization: OrganizationSummary }>('/api/v1/organizations', {
    method: 'POST',
    body: { name },
  });

export const acceptInviteRequest = (token: string) =>
  apiRequest<{ organization: OrganizationSummary; defaultOrganizationChanged: boolean }>(
    '/api/v1/invites/accept',
    {
      method: 'POST',
      body: { token },
    },
  );
