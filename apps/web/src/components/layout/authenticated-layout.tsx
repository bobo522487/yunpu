import { type CSSProperties, type ReactNode } from 'react'
import { Outlet, useLocation } from '@tanstack/react-router'
import { getCookie } from '@/lib/cookies'
import { cn } from '@/lib/utils'
import { LayoutProvider, useLayout } from '@/context/layout-provider'
import { SearchProvider } from '@/context/search-provider'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { AppHeader } from '@/components/layout/app-header'
import { AppSidebar } from '@/components/layout/app-sidebar'
import {
  OrgSidebarSeparator,
  OrgSidebarToggle,
} from '@/components/layout/org-sidebar-separator'
import { ProjectShellLayout } from '@/components/layout/project-shell-layout'
import { SkipToMain } from '@/components/skip-to-main'

type AuthenticatedLayoutProps = {
  children?: ReactNode
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const defaultOpen = getCookie('sidebar_state') !== 'false'
  const pathname = useLocation({ select: (location) => location.pathname })
  const isProjectWorkspace = /^\/projects\/[^/]+(?:\/|$)/.test(pathname)

  return (
    <SearchProvider>
      <LayoutProvider>
        <AuthenticatedFrame
          defaultOpen={defaultOpen}
          isProjectWorkspace={isProjectWorkspace}
        >
          {children}
        </AuthenticatedFrame>
      </LayoutProvider>
    </SearchProvider>
  )
}

function AuthenticatedFrame({
  defaultOpen,
  isProjectWorkspace,
  children,
}: {
  defaultOpen: boolean
  isProjectWorkspace: boolean
  children?: ReactNode
}) {
  const { variant, sidebarWidth, isSidebarResizing } = useLayout()
  const style =
    !isProjectWorkspace && variant === 'sidebar'
      ? ({ '--sidebar-width': `${sidebarWidth}px` } as CSSProperties)
      : undefined

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      shortcutEnabled={!isProjectWorkspace}
      resizing={isSidebarResizing}
      style={style}
      className={isSidebarResizing ? 'cursor-col-resize select-none' : undefined}
    >
      <SkipToMain />
      {isProjectWorkspace ? (
        <ProjectShellLayout>{children}</ProjectShellLayout>
      ) : (
        <OrgShell>{children}</OrgShell>
      )}
    </SidebarProvider>
  )
}

function OrgShell({ children }: { children?: ReactNode }) {
  const { variant } = useLayout()
  const { open, isMobile } = useSidebar()
  const showSeparator = variant === 'sidebar' && open && !isMobile

  return (
    <>
      <AppSidebar />
      {showSeparator ? <OrgSidebarSeparator /> : null}
      <SidebarInset
        className={cn(
          '@container/content',
          'has-data-[layout=fixed]:h-svh',
          'peer-data-[variant=inset]:has-data-[layout=fixed]:h-[calc(100svh-(var(--spacing)*4))]'
        )}
      >
        <AppHeader
          leading={
            <div className='flex shrink-0 items-center gap-2'>
              <SidebarTrigger className='-ml-1 md:hidden' />
              <OrgSidebarToggle />
            </div>
          }
        />
        {children ?? <Outlet />}
      </SidebarInset>
    </>
  )
}
