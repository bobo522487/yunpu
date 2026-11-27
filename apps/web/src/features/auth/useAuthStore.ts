import { create } from 'zustand';
import { errorMessage } from '../../lib/api';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
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
  /** 任意请求返回 401（会话失效）时调用：清会话，RequireAuth 随即跳转登录。 */
  markUnauthorized: () => void;
  setDefaultOrganization: (org: OrganizationSummary | null) => void;
  setUserName: (name: string) => void;
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
        return;
      }

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
    }
  },

  signIn: async (email, password) => {
    set({ error: null });
    try {
      const payload = await signInRequest(email, password);
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
      useWorkspaceStore.getState().resetWorkspaceSession();
      set({
        status: 'anonymous',
        user: null,
        defaultOrganization: null,
        onboarding: false,
        error: null,
      });
    }
  },

  markUnauthorized: () => {
    const { status } = get();
    if (status === 'anonymous') return;
    const wasAuthenticated = status === 'authenticated';
    useWorkspaceStore.getState().resetWorkspaceSession();
    set({
      status: 'anonymous',
      user: null,
      defaultOrganization: null,
      onboarding: false,
      error: wasAuthenticated
        ? '登录状态已失效或浏览器未保存会话 Cookie，请重新登录'
        : null,
    });
  },

  setDefaultOrganization: (defaultOrganization) => set({ defaultOrganization }),

  setUserName: (name) =>
    set((state) => ({
      user: state.user ? { ...state.user, name } : null,
    })),

  clearError: () => set({ error: null }),
}));
