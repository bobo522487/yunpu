import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppTheme, ThemeMode, UserProfile } from '../types';
import {
  BiographyPreviewPreferences,
  DrawerLayoutMode,
} from '../features/lineage/types';
import { createAppStorage } from './storageAdapter';

export const DEFAULT_BIOGRAPHY_PREVIEW_PREFS: BiographyPreviewPreferences = {
  showBirth: true,
  showBirthDetail: true,
  showLife: true,
  showDeath: true,
  showDeathDetail: true,
  showBiography: true,
  showChildren: true,
  showRemarks: true,
  showPrivateInfo: true,
};

export const resolveIsDarkMode = (mode: ThemeMode): boolean => {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
};

interface PreferencesState {
  themeMode: ThemeMode;
  isDarkMode: boolean;
  theme: AppTheme;
  isProjectSidebarCollapsed: boolean;
  lineageDrawerMode: DrawerLayoutMode;
  biographyPreviewPrefs: BiographyPreviewPreferences;
  user: UserProfile;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  setAppTheme: (theme: AppTheme) => void;
  setProjectSidebarCollapsed: (collapsed: boolean) => void;
  toggleProjectSidebar: () => void;
  setLineageDrawerMode: (mode: DrawerLayoutMode) => void;
  updateBiographyPreviewPrefs: (
    updates: Partial<BiographyPreviewPreferences>
  ) => void;
  updateUser: (updates: Partial<UserProfile>) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      themeMode: 'light',
      isDarkMode: false,
      theme: 'vscode',
      isProjectSidebarCollapsed: false,
      lineageDrawerMode: 'narrow',
      biographyPreviewPrefs: DEFAULT_BIOGRAPHY_PREVIEW_PREFS,
      user: {
        name: '',
        email: '',
        role: '',
        bio: '',
      },
      setThemeMode: (themeMode) =>
        set({
          themeMode,
          isDarkMode: resolveIsDarkMode(themeMode),
        }),
      toggleTheme: () => {
        const nextMode: ThemeMode = get().isDarkMode ? 'light' : 'dark';
        set({
          themeMode: nextMode,
          isDarkMode: nextMode === 'dark',
        });
      },
      setAppTheme: (theme) => set({ theme }),
      setProjectSidebarCollapsed: (isProjectSidebarCollapsed) =>
        set({ isProjectSidebarCollapsed }),
      toggleProjectSidebar: () =>
        set((state) => ({
          isProjectSidebarCollapsed: !state.isProjectSidebarCollapsed,
        })),
      setLineageDrawerMode: (lineageDrawerMode) => set({ lineageDrawerMode }),
      updateBiographyPreviewPrefs: (updates) =>
        set((state) => ({
          biographyPreviewPrefs: {
            ...(state.biographyPreviewPrefs || DEFAULT_BIOGRAPHY_PREVIEW_PREFS),
            ...updates,
          },
        })),
      updateUser: (updates) =>
        set((state) => ({ user: { ...state.user, ...updates } })),
    }),
    {
      name: 'nocoapp:preferences',
      version: 3,
      storage: createAppStorage(),
      migrate: (persistedState: unknown, version: number) => {
        const state = (persistedState ?? {}) as Record<string, unknown>;
        if (version < 3) {
          const { isAuthenticated: _removed, ...rest } = state;
          return rest as unknown as PreferencesState;
        }
        return state as unknown as PreferencesState;
      },
    }
  )
);
