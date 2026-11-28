import { Link, useLocation } from '@tanstack/react-router'
import {
  ArrowLeft,
  BookOpenText,
  GitBranch,
  LayoutDashboard,
  LibraryBig,
  Settings2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProjectQuery } from '@/features/dashboard/queries'
import { FamilyIcon } from '@/components/common/FamilyIcon'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export const railItems = [
  {
    key: 'overview',
    label: '概览',
    accessibleLabel: '概览',
    to: '/projects/:projectId',
    icon: LayoutDashboard,
  },
  {
    key: 'lineage',
    label: '谱系',
    accessibleLabel: '谱系',
    to: '/projects/:projectId/lineage',
    icon: GitBranch,
  },
  {
    key: 'articles',
    label: '谱文',
    accessibleLabel: '谱文',
    to: '/projects/:projectId/articles',
    icon: BookOpenText,
  },
  {
    key: 'books',
    label: '谱书',
    accessibleLabel: '谱书',
    to: '/projects/:projectId/books',
    icon: LibraryBig,
  },
  {
    key: 'settings',
    label: '设置',
    accessibleLabel: '家族设置',
    to: '/projects/:projectId/settings',
    icon: Settings2,
  },
] as const

type ProjectMiniRailProps = {
  projectId: string
}

export function ProjectMiniRail({ projectId }: ProjectMiniRailProps) {
  const pathname = useLocation({ select: (location) => location.pathname })
  const { data: activeProject } = useProjectQuery(projectId)

  const basePath = `/projects/${projectId}`
  const section = pathname.startsWith(`${basePath}/`)
    ? (pathname.split('/')[3] ?? '')
    : ''
  const activeKey = section === '' ? 'overview' : section

  const primaryItems = railItems.slice(0, 4)
  const settingsItem = railItems[4]

  const renderNavItem = (item: (typeof railItems)[number]) => {
    const Icon = item.icon
    const active = activeKey === item.key
    const url = item.to.replace(':projectId', projectId)

    return (
      <Link
        key={item.key}
        to={url}
        title={item.accessibleLabel}
        aria-label={item.accessibleLabel}
        aria-current={active ? 'page' : undefined}
        data-testid={`nc-mini-sidebar-${item.key}`}
        className={cn(
          'flex h-[52px] w-[58px] shrink-0 flex-col items-center justify-center gap-1 rounded-lg border transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          active
            ? 'border-primary/20 bg-[var(--surface-active)] font-semibold text-accent-foreground'
            : 'border-transparent font-medium text-muted-foreground hover:bg-[var(--surface-hover)] hover:text-foreground'
        )}
      >
        <Icon
          className='h-5 w-5'
          strokeWidth={active ? 2.1 : 1.7}
          aria-hidden='true'
        />
        <span className='text-[11px] leading-none tracking-[0.02em]'>
          {item.label}
        </span>
      </Link>
    )
  }

  return (
    <aside
      data-testid='nc-mini-sidebar-v2'
      data-panel='mini-rail'
      className='flex h-full w-[75px] shrink-0 flex-col items-center border-r border-border bg-[var(--surface-subtle)] select-none'
    >
      <div className='flex h-12 w-full shrink-0 items-center justify-center border-b border-border md:h-14'>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to='/home'
              aria-label='返回组织空间'
              data-testid='nc-mini-sidebar-back'
              className='group relative flex h-10 w-10 items-center justify-center rounded-lg border border-transparent transition-colors duration-150 hover:bg-[var(--surface-hover)] focus-visible:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
            >
              <span className='flex items-center justify-center transition-all duration-150 group-hover:scale-90 group-hover:opacity-0 group-focus-visible:scale-90 group-focus-visible:opacity-0'>
                <FamilyIcon project={activeProject} size='md' />
              </span>
              <ArrowLeft
                className='absolute h-[18px] w-[18px] translate-x-1 text-accent-foreground opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100'
                strokeWidth={2.1}
                aria-hidden='true'
              />
            </Link>
          </TooltipTrigger>
          <TooltipContent side='right' sideOffset={8}>
            返回组织空间{activeProject?.name ? ` · ${activeProject.name}` : ''}
          </TooltipContent>
        </Tooltip>
      </div>

      <nav
        aria-label='家族项目导航'
        className='no-scrollbar flex min-h-0 w-full flex-1 flex-col items-center overflow-y-auto px-2 py-2.5'
      >
        <div className='flex w-full flex-col items-center gap-2'>
          {primaryItems.map(renderNavItem)}
        </div>

        <div className='mt-auto flex w-full flex-col items-center gap-2 pt-2'>
          <div className='h-px w-7 bg-border' aria-hidden='true' />
          {renderNavItem(settingsItem)}
        </div>
      </nav>
    </aside>
  )
}
