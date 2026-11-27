import { useMemo } from 'react';
import { useAuthStore } from '../features/auth/useAuthStore';
import { usePreferencesStore } from '../store/usePreferencesStore';
import type { OrganizationSummary } from '../features/auth/api';
import type { UserProfile } from '../types';

function roleLabel(organization: OrganizationSummary | null): string {
  if (!organization) return '成员';
  if (organization.isOwner) return '工作区管理员';
  if (organization.role === 'admin') return '管理员';
  if (organization.role === 'editor') return '编辑者';
  return '查看者';
}

export function useCurrentUserProfile(): UserProfile {
  const authUser = useAuthStore((s) => s.user);
  const organization = useAuthStore((s) => s.defaultOrganization);
  const profileBio = usePreferencesStore((s) => s.profileBio);

  return useMemo(
    () => ({
      name: authUser ? authUser.name || authUser.email : '',
      email: authUser?.email || '',
      role: authUser ? roleLabel(organization) : '',
      bio: authUser ? profileBio : '',
    }),
    [authUser, organization, profileBio]
  );
}
