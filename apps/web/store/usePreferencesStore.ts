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
  isAuthenticated: boolean;
  themeMode: ThemeMode;
  isDarkMode: boolean;
  theme: AppTheme;
  activeDevice: DeviceType;
  isProjectSidebarCollapsed: boolean;
  user: UserProfile;
  login: (payload?: { email?: string; name?: string }) => void;
  logout: () => void;
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
      isAuthenticated: false,
      themeMode: 'light',
      isDarkMode: false,
      theme: 'vscode',
      activeDevice: 'desktop',
      isProjectSidebarCollapsed: false,
      user: {
        name: '电波',
        email: 'bobo522487@gmail.com',
        role: '工作区管理员',
        bio: '专注于数据建模与低代码应用构建。',
      },
      login: (payload) =>
        set((state) => ({
          isAuthenticated: true,
          user: {
            ...state.user,
            email: payload?.email?.trim() || state.user.email,
            name: payload?.name?.trim() || state.user.name,
          },
        })),
      logout: () => set({ isAuthenticated: false }),
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
      version: 2,
      storage: createAppStorage(),
    }
  )
);
