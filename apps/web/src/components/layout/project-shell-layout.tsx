import {
  lazy,
  Suspense,
  useSyncExternalStore,
  type ReactNode,
  useState,
} from 'react'
import { Outlet, useLocation } from '@tanstack/react-router'
import { usePreferencesStore } from '@/store/usePreferencesStore'
import { BarChart3, PanelLeft, PanelLeftOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useResizable } from '@/hooks/useResizable'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { AppHeader } from './app-header'
import { ProjectMiniRail } from './project-mini-rail'
import { ProjectSidebar } from './project-sidebar'

const LineageStatsModal = lazy(() =>
  import('@/features/lineage/components/LineageStatsModal').then((module) => ({
    default: module.LineageStatsModal,
  }))
)

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
  const setCollapsed = usePreferencesStore((s) => s.setProjectSidebarCollapsed)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const { width, isResizing, startResizing } = useResizable({
    initialWidth: 252,
    minWidth: 220,
    maxWidth: 380,
    edge: 'left',
    leftOffset: 75,
  })

  const headerLeading =
    hasBusinessSidebar && !isDesktop ? (
      <button
        type='button'
        title='打开侧边栏'
        aria-label='打开侧边栏'
        onClick={() => setDrawerOpen(true)}
        className='flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-[var(--surface-hover)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:hidden'
      >
        <PanelLeft size={16} />
      </button>
    ) : null

  const headerActions = (
    <>
      {hasBusinessSidebar && isDesktop && isCollapsed && (
        <button
          type='button'
          title='显示侧边栏'
          aria-label='显示侧边栏'
          onClick={() => setCollapsed(false)}
          className='flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-[var(--surface-hover)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
        >
          <PanelLeftOpen size={16} />
        </button>
      )}
      {showStats && (
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
      )}
    </>
  )

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
          <ProjectSidebar projectId={projectId} width={width} />
          <div
            role='separator'
            aria-orientation='vertical'
            aria-label='调整侧边栏宽度'
            onMouseDown={startResizing}
            className='group relative w-1 shrink-0 cursor-col-resize bg-transparent'
          >
            <span className='absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border transition-colors group-hover:bg-primary/40' />
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
          <SheetContent side='left' className='w-[min(84vw,320px)] p-0'>
            <ProjectSidebar
              projectId={projectId}
              width='100%'
              onClose={() => setDrawerOpen(false)}
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
