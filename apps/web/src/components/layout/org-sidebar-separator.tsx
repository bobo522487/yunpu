import { useCallback, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useLayout } from '@/context/layout-provider'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useSidebar } from '@/components/ui/sidebar'

export const ORG_SIDEBAR_ID = 'org-sidebar'

export function OrgSidebarSeparator() {
  const {
    sidebarWidth,
    setSidebarWidth,
    minSidebarWidth,
    maxSidebarWidth,
    isSidebarResizing,
    startSidebarResizing,
  } = useLayout()

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const step = 16
      let next: number | null = null
      if (event.key === 'ArrowLeft') next = sidebarWidth - step
      else if (event.key === 'ArrowRight') next = sidebarWidth + step
      else if (event.key === 'Home') next = minSidebarWidth
      else if (event.key === 'End') next = maxSidebarWidth
      if (next === null) return
      event.preventDefault()
      setSidebarWidth(next)
    },
    [sidebarWidth, setSidebarWidth, minSidebarWidth, maxSidebarWidth]
  )

  return (
    <div
      role='separator'
      aria-orientation='vertical'
      aria-label='调整组织侧栏宽度'
      aria-controls={ORG_SIDEBAR_ID}
      aria-valuenow={sidebarWidth}
      aria-valuemin={minSidebarWidth}
      aria-valuemax={maxSidebarWidth}
      tabIndex={0}
      data-testid='nc-org-sidebar-separator'
      onMouseDown={startSidebarResizing}
      onKeyDown={handleKeyDown}
      className='group relative z-20 w-2 shrink-0 cursor-col-resize bg-transparent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none'
    >
      <span
        aria-hidden='true'
        className={cn(
          'pointer-events-none absolute inset-y-0 left-0 w-px bg-border transition-colors group-hover:bg-primary group-focus-visible:bg-primary',
          isSidebarResizing && 'bg-primary'
        )}
      />
    </div>
  )
}

export function OrgSidebarToggle() {
  const { open, toggleSidebar, isMobile } = useSidebar()
  if (isMobile) return null

  const shortcutLabel =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)
      ? '⌘B'
      : 'Ctrl+B'
  const label = open ? '收起组织侧栏' : '展开组织侧栏'
  const ToggleIcon = open ? PanelLeftClose : PanelLeftOpen

  return (
    <div className='flex shrink-0 items-center gap-2'>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type='button'
            aria-label={label}
            aria-expanded={open}
            aria-controls={ORG_SIDEBAR_ID}
            aria-keyshortcuts='Meta+b Control+b'
            data-testid='nc-org-sidebar-toggle'
            data-state={open ? 'open' : 'closed'}
            onClick={toggleSidebar}
            className='flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
          >
            <ToggleIcon size={16} strokeWidth={1.5} aria-hidden='true' />
          </button>
        </TooltipTrigger>
        <TooltipContent side='bottom' align='start' sideOffset={6}>
          <span className='inline-flex items-center gap-1.5'>
            <span>{label}</span>
            <kbd className='rounded bg-primary-foreground/15 px-1 py-0.5 font-mono text-[10px] leading-none text-primary-foreground/90'>
              {shortcutLabel}
            </kbd>
          </span>
        </TooltipContent>
      </Tooltip>
      <span aria-hidden='true' className='h-4 w-px shrink-0 bg-border' />
    </div>
  )
}
