import { create } from 'zustand';
import { errorMessage } from '../../lib/api';
import { usePreferencesStore } from '../../store/usePreferencesStore';
import {
  fetchSession,
  signInRequest,
  signOutRequest,
  signUpRequest,
  type AuthUser,
  type OrganizationSummary,
  type SignInPayload,
  type SignUpPayload,
} from './api';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

function roleLabel(organization: OrganizationSummary | null): string {
  if (!organization) return '成员';
  if (organization.isOwner) return '工作区管理员';
  if (organization.role === 'admin') return '管理员';
  if (organization.role === 'editor') return '编辑者';
  return '查看者';
}

function syncProfile(user: AuthUser, organization: OrganizationSummary | null): void {
  usePreferencesStore.getState().updateUser({
    name: user.name || user.email,
    email: user.email,
    role: roleLabel(organization),
  });
}

function clearProfile(): void {
  usePreferencesStore.getState().updateUser({
    name: '',
    email: '',
    role: '',
    bio: '',
  });
}

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  defaultOrganization: OrganizationSummary | null;
  onboarding: boolean;
  error: string | null;
  bootstrapped: boolean;

  bootstrap: () => Promise<void>;
  refreshSession: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<SignInPayload>;
  signUp: (
    email: string,
    password: string,
    inviteToken?: string,
  ) => Promise<SignUpPayload>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  status: 'loading',
  user: null,
  defaultOrganization: null,
  onboarding: false,
  error: null,
  bootstrapped: false,

  bootstrap: async () => {
    if (get().bootstrapped) return;
    set({ bootstrapped: true });
    await get().refreshSession();
  },

  refreshSession: async () => {
    try {
      const session = await fetchSession();
      if (!session.user) {
        set({
          status: 'anonymous',
          user: null,
          defaultOrganization: null,
          onboarding: false,
          error: null,
        });
        clearProfile();
        return;
      }

      syncProfile(session.user, session.defaultOrganization);
      set({
        status: 'authenticated',
        user: session.user,
        defaultOrganization: session.defaultOrganization,
        onboarding: session.onboarding,
        error: null,
      });
    } catch (error) {
      set({
        status: 'anonymous',
        user: null,
        defaultOrganization: null,
        onboarding: false,
        error: errorMessage(error),
      });
      clearProfile();
    }
  },

  signIn: async (email, password) => {
    set({ error: null });
    try {
      const payload = await signInRequest(email, password);
      syncProfile(payload.user, payload.defaultOrganization);
      set({
        status: 'authenticated',
        user: payload.user,
        defaultOrganization: payload.defaultOrganization,
        onboarding: payload.onboarding,
        error: null,
      });
      return payload;
    } catch (error) {
      set({ error: errorMessage(error) });
      throw error;
    }
  },

  signUp: async (email, password, inviteToken) => {
    set({ error: null });
    try {
      const payload = await signUpRequest(email, password, inviteToken);
      syncProfile(payload.user, payload.defaultOrganization);
      set({
        status: 'authenticated',
        user: payload.user,
        defaultOrganization: payload.defaultOrganization,
        onboarding: false,
        error: null,
      });
      return payload;
    } catch (error) {
      set({ error: errorMessage(error) });
      throw error;
    }
  },

  signOut: async () => {
    try {
      await signOutRequest();
    } finally {
      set({
        status: 'anonymous',
        user: null,
        defaultOrganization: null,
        onboarding: false,
        error: null,
      });
      clearProfile();
    }
  },

  clearError: () => set({ error: null }),
}));
