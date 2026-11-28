import { useLocation } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSearch } from '@/context/search-provider'
import { BookListPanel } from '@/features/books/components/BookListPanel'
import { ArticleTreePanel } from '@/features/project/components/ArticleTreePanel'
import { LineageTreePanel } from '@/features/project/components/LineageTreePanel'

type ProjectSidebarProps = {
  projectId: string
  width?: number | string
  id?: string
  inDrawer?: boolean
}

const sectionTitles: Record<string, string> = {
  lineage: '谱系导航',
  articles: '谱文导航',
  books: '谱书目录',
}

export function ProjectSidebar({
  projectId,
  width,
  id,
  inDrawer = false,
}: ProjectSidebarProps) {
  const pathname = useLocation({ select: (location) => location.pathname })
  const section = pathname.startsWith(`/projects/${projectId}/`)
    ? (pathname.split('/')[3] ?? '')
    : ''
  const { setOpen: openSearch } = useSearch()

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
      id={id}
      data-testid='nc-sidebar'
      data-panel='business-sidebar'
      style={{ width }}
      className={cn(
        'relative flex h-full shrink-0 flex-col bg-background select-none',
        !inDrawer && 'z-30'
      )}
    >
      <div
        data-testid='nc-sidebar-header'
        className={cn(
          'relative flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border bg-[var(--surface-subtle)] ps-3.5 md:h-14',
          inDrawer ? 'pe-11' : 'pe-3.5'
        )}
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
            <Search size={14} aria-hidden='true' />
          </button>
        </div>
      </div>
      <div className='flex min-h-0 flex-1 flex-col overflow-hidden bg-background'>
        {panel}
      </div>
    </aside>
  )
}
