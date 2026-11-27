import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react'
import { usePreferencesStore } from '@/store/usePreferencesStore'
import type { AppTheme, ThemeMode } from '@/types'

export type Theme = ThemeMode
export type ThemePreset = AppTheme

const DEFAULT_THEME: Theme = 'system'
const DEFAULT_PRESET: ThemePreset = 'default'

type ThemeContextType = {
  theme: Theme
  setTheme: (theme: Theme) => void
  resetTheme: () => void
  defaultTheme: Theme
  preset: ThemePreset
  setPreset: (preset: ThemePreset) => void
  resetPreset: () => void
  defaultPreset: ThemePreset
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

function normalizeTheme(value: string): Theme {
  return value === 'light' || value === 'dark' || value === 'system'
    ? value
    : DEFAULT_THEME
}

function normalizePreset(value: string): ThemePreset {
  return value === 'solar-dusk' ? 'solar-dusk' : DEFAULT_PRESET
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const storedThemeMode = usePreferencesStore((s) => s.themeMode)
  const storedPreset = usePreferencesStore((s) => s.theme)
  const setStoredThemeMode = usePreferencesStore((s) => s.setThemeMode)
  const setStoredPreset = usePreferencesStore((s) => s.setAppTheme)

  const theme = normalizeTheme(storedThemeMode)
  const preset = normalizePreset(storedPreset)

  const applyTheme = useCallback((nextTheme: Theme) => {
    const root = window.document.documentElement
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
    const resolvedTheme = nextTheme === 'system' ? systemTheme : nextTheme

    root.classList.remove('light', 'dark')
    root.classList.add(resolvedTheme)
  }, [])

  const setTheme = useCallback(
    (nextTheme: Theme) => {
      setStoredThemeMode(nextTheme)
      applyTheme(nextTheme)
    },
    [applyTheme, setStoredThemeMode],
  )

  const resetTheme = useCallback(() => {
    setStoredThemeMode(DEFAULT_THEME)
    applyTheme(DEFAULT_THEME)
  }, [applyTheme, setStoredThemeMode])

  const setPreset = useCallback(
    (nextPreset: ThemePreset) => {
      setStoredPreset(nextPreset)
      window.document.documentElement.dataset.preset = nextPreset
    },
    [setStoredPreset],
  )

  const resetPreset = useCallback(() => {
    setStoredPreset(DEFAULT_PRESET)
    window.document.documentElement.dataset.preset = DEFAULT_PRESET
  }, [setStoredPreset])

  useEffect(() => {
    applyTheme(theme)
  }, [theme, applyTheme])

  useEffect(() => {
    window.document.documentElement.dataset.preset = preset
  }, [preset])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (theme === 'system') applyTheme('system')
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme, applyTheme])

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      resetTheme,
      defaultTheme: DEFAULT_THEME,
      preset,
      setPreset,
      resetPreset,
      defaultPreset: DEFAULT_PRESET,
    }),
    [theme, setTheme, resetTheme, preset, setPreset, resetPreset],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
