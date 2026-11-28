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
import { WorkspaceLogoIcon } from '@/components/common/YunpuIcons'

export const railItems = [
  {
    key: 'overview',
    label: '概览',
    to: '/projects/:projectId',
    icon: LayoutDashboard,
  },
  {
    key: 'lineage',
    label: '谱系',
    to: '/projects/:projectId/lineage',
    icon: GitBranch,
  },
  {
    key: 'articles',
    label: '谱文',
    to: '/projects/:projectId/articles',
    icon: BookOpenText,
  },
  {
    key: 'books',
    label: '谱书',
    to: '/projects/:projectId/books',
    icon: LibraryBig,
  },
  {
    key: 'settings',
    label: '家族设置',
    to: '/projects/:projectId/settings',
    icon: Settings2,
  },
] as const

type ProjectMiniRailProps = {
  projectId: string
}

export function ProjectMiniRail({ projectId }: ProjectMiniRailProps) {
  const pathname = useLocation({ select: (location) => location.pathname })
  const basePath = `/projects/${projectId}`
  const section = pathname.startsWith(`${basePath}/`)
    ? (pathname.split('/')[3] ?? '')
    : ''
  const activeKey = section === '' ? 'overview' : section

  return (
    <aside
      data-testid='nc-mini-sidebar-v2'
      data-panel='mini-rail'
      className='flex h-full w-[75px] shrink-0 flex-col items-center border-r border-border bg-[hsl(var(--surface-subtle))] py-2 select-none'
    >
      <Link
        to='/home'
        title='返回组织空间'
        aria-label='返回组织空间'
        data-testid='nc-mini-sidebar-back'
        className='group relative flex h-12 w-[59px] shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-[hsl(var(--surface-hover))] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
      >
        <WorkspaceLogoIcon className='h-7 w-7' />
        <ArrowLeft className='absolute h-3.5 w-3.5 rounded-full bg-background text-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100' />
      </Link>

      <div className='my-2 h-px w-10 shrink-0 bg-border' />

      <nav className='flex min-h-0 flex-1 flex-col items-center gap-1'>
        {railItems.map((item) => {
          const Icon = item.icon
          const active = activeKey === item.key
          const url = item.to.replace(':projectId', projectId)

          return (
            <Link
              key={item.key}
              to={url}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              data-testid={`nc-mini-sidebar-${item.key}`}
              className={cn(
                'relative flex min-h-[60px] w-[59px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-lg py-2 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                active
                  ? 'bg-[hsl(var(--surface-active))] text-primary'
                  : 'text-muted-foreground hover:bg-[hsl(var(--surface-hover))] hover:text-foreground'
              )}
            >
              <span
                className={cn(
                  'absolute top-1/2 left-0 h-8 w-[2px] -translate-y-1/2 rounded-r-full bg-primary transition-opacity',
                  active ? 'opacity-100' : 'opacity-0'
                )}
              />
              <Icon className='h-[25px] w-[25px]' />
              <span className='text-[11px] leading-none'>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
