import { useLocation } from '@tanstack/react-router'
import { usePreferencesStore } from '@/store/usePreferencesStore'
import { ChevronsLeft, Search, X } from 'lucide-react'
import { useSearch } from '@/context/search-provider'
import { BookListPanel } from '@/features/books/components/BookListPanel'
import { ArticleTreePanel } from '@/features/project/components/ArticleTreePanel'
import { LineageTreePanel } from '@/features/project/components/LineageTreePanel'

type ProjectSidebarProps = {
  projectId: string
  width?: number | string
  onClose?: () => void
}

const sectionTitles: Record<string, string> = {
  lineage: '谱系导航',
  articles: '谱文导航',
  books: '谱书目录',
}

export function ProjectSidebar({
  projectId,
  width,
  onClose,
}: ProjectSidebarProps) {
  const pathname = useLocation({ select: (location) => location.pathname })
  const section = pathname.startsWith(`/projects/${projectId}/`)
    ? (pathname.split('/')[3] ?? '')
    : ''
  const { setOpen: openSearch } = useSearch()
  const setCollapsed = usePreferencesStore((s) => s.setProjectSidebarCollapsed)

  const collapse = () => {
    setCollapsed(true)
    onClose?.()
  }

  const panel =
    section === 'lineage' ? (
      <LineageTreePanel />
    ) : section === 'articles' ? (
      <ArticleTreePanel />
    ) : section === 'books' ? (
      <BookListPanel />
    ) : null

  if (!panel) return null

  return (
    <aside
      data-testid='nc-sidebar'
      data-panel='business-sidebar'
      style={{ width }}
      className='relative z-30 flex h-full shrink-0 flex-col border-r border-border bg-background select-none'
    >
      <div
        data-testid='nc-sidebar-header'
        className='relative flex h-13 shrink-0 items-center justify-between gap-2 border-b border-border bg-[var(--surface-subtle)] px-3.5'
      >
        <span className='truncate text-[14px] font-semibold text-foreground'>
          {sectionTitles[section]}
        </span>
        <div className='flex shrink-0 items-center gap-0.5'>
          <button
            type='button'
            title='快速搜索 (Ctrl K)'
            aria-label='快速搜索'
            onClick={() => openSearch(true)}
            className='flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-[var(--surface-hover)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
          >
            <Search size={14} />
          </button>
          <button
            type='button'
            title='隐藏侧边栏'
            aria-label='隐藏侧边栏'
            data-testid='nc-sidebar-collapse-btn'
            onClick={collapse}
            className='flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-[var(--surface-hover)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
          >
            <ChevronsLeft size={15} />
          </button>
          {onClose && (
            <button
              type='button'
              title='关闭侧边栏'
              aria-label='关闭侧边栏'
              onClick={onClose}
              className='flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-[var(--surface-hover)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
      <div className='flex min-h-0 flex-1 flex-col overflow-hidden bg-background'>
        {panel}
      </div>
    </aside>
  )
}
