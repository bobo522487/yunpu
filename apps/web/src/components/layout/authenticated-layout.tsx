import { useEffect } from 'react'
import { Outlet, useLocation } from '@tanstack/react-router'
import { getCookie } from '@/lib/cookies'
import { cn } from '@/lib/utils'
import { LayoutProvider } from '@/context/layout-provider'
import { SearchProvider } from '@/context/search-provider'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { useWorkspaceStore } from '@/store/useWorkspaceStore'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { AppHeader } from '@/components/layout/app-header'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { ProjectShellLayout } from '@/components/layout/project-shell-layout'
import { SkipToMain } from '@/components/skip-to-main'

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const defaultOpen = getCookie('sidebar_state') !== 'false'
  const pathname = useLocation({ select: (location) => location.pathname })
  const isProjectWorkspace = /^\/projects\/[^/]+(?:\/|$)/.test(pathname)
  const authStatus = useAuthStore((s) => s.status)
  const authUserId = useAuthStore((s) => s.user?.id ?? '')
  const defaultOrgId = useAuthStore((s) => s.defaultOrganization?.id ?? '')
  const onboarding = useAuthStore((s) => s.onboarding)

  useEffect(() => {
    if (authStatus !== 'authenticated' || !authUserId || onboarding) return
    void useWorkspaceStore.getState().hydrateFromApi().catch(() => {})
  }, [authStatus, authUserId, defaultOrgId, onboarding])

  return (
    <SearchProvider>
      <LayoutProvider>
        <SidebarProvider defaultOpen={defaultOpen}>
          <SkipToMain />
          {isProjectWorkspace ? (
            <ProjectShellLayout>{children}</ProjectShellLayout>
          ) : (
            <>
              <AppSidebar />
              <SidebarInset
                className={cn(
                  // Set content container, so we can use container queries
                  '@container/content',

                  // If layout is fixed, set the height
                  // to 100svh to prevent overflow
                  'has-data-[layout=fixed]:h-svh',

                  // If layout is fixed and sidebar is inset,
                  // set the height to 100svh - spacing (total margins) to prevent overflow
                  'peer-data-[variant=inset]:has-data-[layout=fixed]:h-[calc(100svh-(var(--spacing)*4))]'
                )}
              >
                <AppHeader
                  leading={<SidebarTrigger className='-ml-1 md:hidden' />}
                />
                {children ?? <Outlet />}
              </SidebarInset>
            </>
          )}
        </SidebarProvider>
      </LayoutProvider>
    </SearchProvider>
  )
}
