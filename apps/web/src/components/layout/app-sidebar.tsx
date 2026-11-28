import { useMemo } from 'react'
import { useLayout } from '@/context/layout-provider'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { useWorkspaceStore } from '@/store/useWorkspaceStore'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar'
import { ORG_SIDEBAR_ID } from './org-sidebar-separator'
import { AppTitle } from './app-title'
import { sidebarData } from './data/sidebar-data'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'
import { type NavGroup as NavGroupData } from './types'

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const { isMobile } = useSidebar()
  const activeProjectId = useWorkspaceStore((s) => s.activeProjectId)
  const user = useAuthStore((s) => s.user)

  const navGroups = useMemo<NavGroupData[]>(() => {
    const fillProjectId = (value: string) =>
      value.replaceAll(':projectId', activeProjectId)

    const fillItem = <T extends { url?: unknown; items?: T[] }>(item: T): T =>
      ({
        ...item,
        url:
          typeof item.url === 'string' ? fillProjectId(item.url) : item.url,
        items: item.items?.map(fillItem),
      }) as T

    return sidebarData.navGroups.map((group) => ({
      ...group,
      items: group.items.map(fillItem),
    }))
  }, [activeProjectId])

  const sidebarUser = {
    name: user?.name || '云谱用户',
    email: user?.email || '',
    avatar: '',
  }

  return (
    <Sidebar
      collapsible={collapsible}
      variant={variant}
      {...(isMobile
        ? {}
        : { id: ORG_SIDEBAR_ID, 'data-testid': 'nc-org-sidebar' })}
    >
      <SidebarHeader>
        <AppTitle />
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={sidebarUser} />
      </SidebarFooter>
    </Sidebar>
  )
}
