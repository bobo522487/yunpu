import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type AppTheme, type ThemeMode } from '../types';
import {
  type BiographyPreviewPreferences,
  type DrawerLayoutMode,
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
  profileBio: string;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  setAppTheme: (theme: AppTheme) => void;
  setProjectSidebarCollapsed: (collapsed: boolean) => void;
  toggleProjectSidebar: () => void;
  setLineageDrawerMode: (mode: DrawerLayoutMode) => void;
  updateBiographyPreviewPrefs: (
    updates: Partial<BiographyPreviewPreferences>
  ) => void;
  setProfileBio: (bio: string) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      themeMode: 'light',
      isDarkMode: false,
      theme: 'default',
      isProjectSidebarCollapsed: false,
      lineageDrawerMode: 'narrow',
      biographyPreviewPrefs: DEFAULT_BIOGRAPHY_PREVIEW_PREFS,
      profileBio: '',
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
      setProfileBio: (profileBio) => set({ profileBio }),
    }),
    {
      name: 'yunpu:preferences',
      version: 6,
      storage: createAppStorage(),
      migrate: (persistedState: unknown, version: number) => {
        const state = (persistedState ?? {}) as Record<string, unknown>;
        if (version < 5) {
          const legacyUser = state.user as { bio?: string } | undefined;
          const { isAuthenticated: _removedAuth, user: _removedUser, ...rest } =
            state;
          return {
            ...rest,
            theme: 'default',
            profileBio:
              typeof state.profileBio === 'string'
                ? state.profileBio
                : legacyUser?.bio || '',
          } as unknown as PreferencesState;
        }
        if (version < 6 && state.theme === 'archival') {
          state.theme = 'default';
        }
        return state as unknown as PreferencesState;
      },
    }
  )
);
