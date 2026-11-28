import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { Outlet, useLocation } from '@tanstack/react-router'
import { usePreferencesStore } from '@/store/usePreferencesStore'
import { BarChart3, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useResizable } from '@/hooks/useResizable'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { AppHeader } from './app-header'
import { ProjectMiniRail } from './project-mini-rail'
import { ProjectSidebar } from './project-sidebar'

const LineageStatsModal = lazy(() =>
  import('@/features/lineage/components/LineageStatsModal').then((module) => ({
    default: module.LineageStatsModal,
  }))
)

const BUSINESS_SIDEBAR_ID = 'project-business-sidebar'
const BUSINESS_SIDEBAR_INITIAL_WIDTH = 252
const BUSINESS_SIDEBAR_MIN_WIDTH = 220
const BUSINESS_SIDEBAR_MAX_WIDTH = 380

type ProjectShellLayoutProps = {
  children?: ReactNode
}

const desktopQuery = '(min-width: 768px)'

function subscribeToDesktop(callback: () => void) {
  if (typeof window === 'undefined') return () => {}
  const media = window.matchMedia(desktopQuery)
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}

function getDesktopSnapshot() {
  return (
    typeof window !== 'undefined' && window.matchMedia(desktopQuery).matches
  )
}

export function ProjectShellLayout({ children }: ProjectShellLayoutProps) {
  const pathname = useLocation({ select: (location) => location.pathname })
  const segments = pathname.split('/').filter(Boolean)
  const projectId = segments[1] ?? ''
  const section = segments[2] ?? ''
  const hasBusinessSidebar =
    section === 'lineage' || section === 'articles' || section === 'books'
  const showStats = section === '' || section === 'lineage'

  const isDesktop = useSyncExternalStore(
    subscribeToDesktop,
    getDesktopSnapshot,
    () => true
  )
  const isCollapsed = usePreferencesStore((s) => s.isProjectSidebarCollapsed)
  const toggleProjectSidebar = usePreferencesStore((s) => s.toggleProjectSidebar)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const { width, setWidth, isResizing, startResizing } = useResizable({
    initialWidth: BUSINESS_SIDEBAR_INITIAL_WIDTH,
    minWidth: BUSINESS_SIDEBAR_MIN_WIDTH,
    maxWidth: BUSINESS_SIDEBAR_MAX_WIDTH,
    edge: 'left',
    leftOffset: 75,
  })

  const isSidebarOpen = isDesktop ? !isCollapsed : drawerOpen

  const toggleBusinessSidebar = useCallback(() => {
    if (isDesktop) {
      toggleProjectSidebar()
    } else {
      setDrawerOpen((open) => !open)
    }
  }, [isDesktop, toggleProjectSidebar])

  const handleSeparatorKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const step = 16
      let next: number | null = null
      if (event.key === 'ArrowLeft') next = width - step
      else if (event.key === 'ArrowRight') next = width + step
      else if (event.key === 'Home') next = BUSINESS_SIDEBAR_MIN_WIDTH
      else if (event.key === 'End') next = BUSINESS_SIDEBAR_MAX_WIDTH
      if (next === null) return
      event.preventDefault()
      setWidth(next)
    },
    [width, setWidth]
  )

  useEffect(() => {
    if (!hasBusinessSidebar) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        !event.shiftKey &&
        (event.key === '\\' || event.code === 'Backslash')
      ) {
        event.preventDefault()
        toggleBusinessSidebar()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [hasBusinessSidebar, toggleBusinessSidebar])

  const shortcutLabel =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)
      ? '⌘\\'
      : 'Ctrl+\\'

  const ToggleIcon = isSidebarOpen ? PanelLeftClose : PanelLeftOpen
  const toggleLabel = isSidebarOpen ? '收起业务侧栏' : '展开业务侧栏'

  const headerLeading = hasBusinessSidebar ? (
    <div className='flex shrink-0 items-center gap-2'>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type='button'
            aria-label={toggleLabel}
            aria-expanded={isSidebarOpen}
            aria-controls={BUSINESS_SIDEBAR_ID}
            aria-keyshortcuts='Meta+\ Control+\'
            data-testid='nc-sidebar-toggle-btn'
            data-state={isSidebarOpen ? 'open' : 'closed'}
            onClick={toggleBusinessSidebar}
            className='flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
          >
            <ToggleIcon size={16} strokeWidth={1.5} aria-hidden='true' />
          </button>
        </TooltipTrigger>
        <TooltipContent side='bottom' align='start' sideOffset={6}>
          <span className='inline-flex items-center gap-1.5'>
            <span>{toggleLabel}</span>
            <kbd className='rounded bg-primary-foreground/15 px-1 py-0.5 font-mono text-[10px] leading-none text-primary-foreground/90'>
              {shortcutLabel}
            </kbd>
          </span>
        </TooltipContent>
      </Tooltip>
      <span aria-hidden='true' className='h-4 w-px shrink-0 bg-border' />
    </div>
  ) : null

  const headerActions = showStats ? (
    <button
      type='button'
      title='统计'
      aria-label='统计'
      onClick={() => setStatsOpen(true)}
      className='hidden h-7 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-[var(--surface-hover)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:flex'
    >
      <BarChart3 size={14} />
      <span className='hidden lg:inline'>统计</span>
    </button>
  ) : null

  return (
    <div
      className={cn(
        'flex h-svh w-full overflow-hidden bg-background text-foreground',
        isResizing && 'cursor-col-resize select-none'
      )}
    >
      <ProjectMiniRail projectId={projectId} />

      {hasBusinessSidebar && isDesktop && !isCollapsed && (
        <>
          <ProjectSidebar
            id={BUSINESS_SIDEBAR_ID}
            projectId={projectId}
            width={width}
          />
          <div
            role='separator'
            aria-orientation='vertical'
            aria-label='调整业务侧栏宽度'
            aria-controls={BUSINESS_SIDEBAR_ID}
            aria-valuenow={width}
            aria-valuemin={BUSINESS_SIDEBAR_MIN_WIDTH}
            aria-valuemax={BUSINESS_SIDEBAR_MAX_WIDTH}
            tabIndex={0}
            data-testid='nc-business-sidebar-separator'
            onMouseDown={startResizing}
            onKeyDown={handleSeparatorKeyDown}
            className='group relative w-2 shrink-0 cursor-col-resize bg-transparent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none'
          >
            <span
              aria-hidden='true'
              className={cn(
                'pointer-events-none absolute inset-y-0 left-0 w-px bg-border transition-colors group-hover:bg-primary group-focus-visible:bg-primary',
                isResizing && 'bg-primary'
              )}
            />
          </div>
        </>
      )}

      <div className='flex min-w-0 flex-1 flex-col overflow-hidden'>
        <AppHeader leading={headerLeading} actions={headerActions} />
        <main
          id='content'
          className='@container/content flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'
        >
          {children ?? <Outlet />}
        </main>
      </div>

      {hasBusinessSidebar && !isDesktop && (
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side='left' className='w-[min(84vw,320px)] gap-0 p-0'>
            <SheetTitle className='sr-only'>业务侧栏</SheetTitle>
            <SheetDescription className='sr-only'>
              当前视图的目录与导航
            </SheetDescription>
            <ProjectSidebar
              id={BUSINESS_SIDEBAR_ID}
              projectId={projectId}
              width='100%'
              inDrawer
            />
          </SheetContent>
        </Sheet>
      )}

      {showStats && (
        <Suspense fallback={null}>
          <LineageStatsModal
            open={statsOpen}
            projectId={projectId}
            onClose={() => setStatsOpen(false)}
          />
        </Suspense>
      )}
    </div>
  )
}
