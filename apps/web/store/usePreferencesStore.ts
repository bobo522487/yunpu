import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppTheme, DeviceType, ThemeMode, UserProfile } from '../types';
import { createAppStorage } from './storageAdapter';

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
  activeDevice: DeviceType;
  isProjectSidebarCollapsed: boolean;
  user: UserProfile;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  setAppTheme: (theme: AppTheme) => void;
  setActiveDevice: (device: DeviceType) => void;
  setProjectSidebarCollapsed: (collapsed: boolean) => void;
  toggleProjectSidebar: () => void;
  updateUser: (updates: Partial<UserProfile>) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      themeMode: 'light',
      isDarkMode: false,
      theme: 'vscode',
      activeDevice: 'desktop',
      isProjectSidebarCollapsed: false,
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
      setActiveDevice: (activeDevice) => set({ activeDevice }),
      setProjectSidebarCollapsed: (isProjectSidebarCollapsed) =>
        set({ isProjectSidebarCollapsed }),
      toggleProjectSidebar: () =>
        set((state) => ({
          isProjectSidebarCollapsed: !state.isProjectSidebarCollapsed,
        })),
      updateUser: (updates) =>
        set((state) => ({ user: { ...state.user, ...updates } })),
    }),
    {
      name: 'nocoapp:preferences',
      version: 3,
      storage: createAppStorage(),
    }
  )
);
