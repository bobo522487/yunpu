import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { getCookie, removeCookie, setCookie } from '@/lib/cookies'
import { useResizable } from '@/hooks/useResizable'

export type Collapsible = 'offcanvas' | 'icon' | 'none'
type Variant = 'inset' | 'sidebar' | 'floating'

// Cookie constants following the pattern from sidebar.tsx
const LAYOUT_COLLAPSIBLE_COOKIE_NAME = 'layout_collapsible'
const LAYOUT_VARIANT_COOKIE_NAME = 'layout_variant'
const SIDEBAR_WIDTH_COOKIE_NAME = 'sidebar_width'
const LAYOUT_COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

// Default values
const DEFAULT_VARIANT = 'sidebar'
const DEFAULT_COLLAPSIBLE = 'icon'
export const ORG_SIDEBAR_DEFAULT_WIDTH = 256
export const ORG_SIDEBAR_MIN_WIDTH = 220
export const ORG_SIDEBAR_MAX_WIDTH = 380

function readOrgSidebarWidth(): number {
  const raw = getCookie(SIDEBAR_WIDTH_COOKIE_NAME)
  if (raw === undefined) return ORG_SIDEBAR_DEFAULT_WIDTH
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return ORG_SIDEBAR_DEFAULT_WIDTH
  return Math.min(
    ORG_SIDEBAR_MAX_WIDTH,
    Math.max(ORG_SIDEBAR_MIN_WIDTH, Math.round(parsed))
  )
}

type LayoutContextType = {
  resetLayout: () => void

  defaultCollapsible: Collapsible
  collapsible: Collapsible
  setCollapsible: (collapsible: Collapsible) => void

  defaultVariant: Variant
  variant: Variant
  setVariant: (variant: Variant) => void

  sidebarWidth: number
  defaultSidebarWidth: number
  minSidebarWidth: number
  maxSidebarWidth: number
  setSidebarWidth: (width: number) => void
  resetSidebarWidth: () => void
  isSidebarResizing: boolean
  startSidebarResizing: () => void
}

const LayoutContext = createContext<LayoutContextType | null>(null)

type LayoutProviderProps = {
  children: React.ReactNode
}

export function LayoutProvider({ children }: LayoutProviderProps) {
  const [collapsible, _setCollapsible] = useState<Collapsible>(() => {
    const saved = getCookie(LAYOUT_COLLAPSIBLE_COOKIE_NAME)
    return (saved as Collapsible) || DEFAULT_COLLAPSIBLE
  })

  const [variant, _setVariant] = useState<Variant>(() => {
    const saved = getCookie(LAYOUT_VARIANT_COOKIE_NAME)
    return (saved as Variant) || DEFAULT_VARIANT
  })

  const setCollapsible = (newCollapsible: Collapsible) => {
    _setCollapsible(newCollapsible)
    setCookie(
      LAYOUT_COLLAPSIBLE_COOKIE_NAME,
      newCollapsible,
      LAYOUT_COOKIE_MAX_AGE
    )
  }

  const setVariant = (newVariant: Variant) => {
    _setVariant(newVariant)
    setCookie(LAYOUT_VARIANT_COOKIE_NAME, newVariant, LAYOUT_COOKIE_MAX_AGE)
  }

  const skipWidthPersist = useRef(false)
  const persistSidebarWidth = useCallback((next: number) => {
    if (skipWidthPersist.current) return
    setCookie(SIDEBAR_WIDTH_COOKIE_NAME, String(next), LAYOUT_COOKIE_MAX_AGE)
  }, [])

  const {
    width: sidebarWidth,
    setWidth: setSidebarWidth,
    isResizing: isSidebarResizing,
    startResizing: startSidebarResizing,
  } = useResizable({
    initialWidth: readOrgSidebarWidth(),
    minWidth: ORG_SIDEBAR_MIN_WIDTH,
    maxWidth: ORG_SIDEBAR_MAX_WIDTH,
    edge: 'left',
    onWidthChange: persistSidebarWidth,
  })

  const resetSidebarWidth = useCallback(() => {
    skipWidthPersist.current = true
    setSidebarWidth(ORG_SIDEBAR_DEFAULT_WIDTH)
    skipWidthPersist.current = false
    removeCookie(SIDEBAR_WIDTH_COOKIE_NAME)
  }, [setSidebarWidth])

  const resetLayout = () => {
    setCollapsible(DEFAULT_COLLAPSIBLE)
    setVariant(DEFAULT_VARIANT)
    resetSidebarWidth()
  }

  const contextValue: LayoutContextType = {
    resetLayout,
    defaultCollapsible: DEFAULT_COLLAPSIBLE,
    collapsible,
    setCollapsible,
    defaultVariant: DEFAULT_VARIANT,
    variant,
    setVariant,
    sidebarWidth,
    defaultSidebarWidth: ORG_SIDEBAR_DEFAULT_WIDTH,
    minSidebarWidth: ORG_SIDEBAR_MIN_WIDTH,
    maxSidebarWidth: ORG_SIDEBAR_MAX_WIDTH,
    setSidebarWidth,
    resetSidebarWidth,
    isSidebarResizing,
    startSidebarResizing,
  }

  return <LayoutContext value={contextValue}>{children}</LayoutContext>
}

// Define the hook for the provider
// eslint-disable-next-line react-refresh/only-export-components
export function useLayout() {
  const context = useContext(LayoutContext)
  if (!context) {
    throw new Error('useLayout must be used within a LayoutProvider')
  }
  return context
}
