import { type ReactNode } from 'react'
import '@/styles/index.css'
import { clearCookies } from '@/test-utils/cookies'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'
import { getCookie } from '@/lib/cookies'
import { LayoutProvider } from '@/context/layout-provider'
import { dashboardKeys } from '@/features/dashboard/queries'
import { SidebarProvider, useSidebar } from '@/components/ui/sidebar'
import { usePreferencesStore } from '@/store/usePreferencesStore'
import { useWorkspaceStore } from '@/store/useWorkspaceStore'
import { ProjectShellLayout } from './project-shell-layout'

const mocks = vi.hoisted(() => ({
  pathname: '/projects/p1/lineage',
  navigate: vi.fn(),
  openSearch: vi.fn(),
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useLocation: ({
      select,
    }: {
      select?: (loc: { pathname: string }) => unknown
    } = {}) =>
      select ? select({ pathname: mocks.pathname }) : { pathname: mocks.pathname },
    useNavigate: () => mocks.navigate,
    useParams: () => {
      const match = mocks.pathname.match(/^\/projects\/([^/]+)/)
      return match ? { projectId: match[1] } : {}
    },
    useMatchRoute:
      () =>
      ({ to, params }: { to: string; params?: { projectId?: string } }) => {
        const expected = params?.projectId
          ? to.replace('$projectId', params.projectId)
          : to
        return mocks.pathname === expected ? {} : false
      },
    Outlet: () => <div data-testid='mock-outlet' />,
    Link: ({
      to,
      children,
      className,
    }: {
      to: string
      children: ReactNode
      className?: string
    }) => (
      <a href={to} className={className}>
        {children}
      </a>
    ),
  }
})

vi.mock('@/context/search-provider', () => ({
  useSearch: () => ({ open: false, setOpen: mocks.openSearch }),
}))

vi.mock('@/features/project/components/LineageTreePanel', () => ({
  LineageTreePanel: () => <div data-testid='mock-lineage-panel'>lineage</div>,
}))

vi.mock('@/features/project/components/ArticleTreePanel', () => ({
  ArticleTreePanel: () => <div data-testid='mock-article-panel'>articles</div>,
}))

vi.mock('@/features/books/components/BookListPanel', () => ({
  BookListPanel: () => <div data-testid='mock-book-panel'>books</div>,
}))

vi.mock('@/features/lineage/components/LineageStatsModal', () => ({
  LineageStatsModal: () => null,
}))

vi.mock('@/components/layout/project-mini-rail', () => ({
  ProjectMiniRail: () => (
    <aside data-testid='nc-mini-sidebar-v2' className='w-[75px] shrink-0' />
  ),
}))

vi.mock('@/components/config-drawer', () => ({
  ConfigDrawer: () => <div data-testid='mock-config-drawer' />,
}))

vi.mock('@/components/profile-dropdown', () => ({
  ProfileDropdown: () => <div data-testid='mock-profile-dropdown' />,
}))

vi.mock('@/components/theme-switch', () => ({
  ThemeSwitch: () => <div data-testid='mock-theme-switch' />,
}))

vi.mock('@/components/search', () => ({
  Search: ({ className }: { className?: string }) => (
    <div data-testid='mock-search' className={className} />
  ),
}))

function OrgSidebarProbe() {
  const { open } = useSidebar()
  return (
    <span data-testid='org-sidebar-open' className='sr-only'>
      {String(open)}
    </span>
  )
}

let testQueryClient: QueryClient

async function renderProjectShell({
  pathname = '/projects/p1/lineage',
  shortcutEnabled = false,
}: {
  pathname?: string
  shortcutEnabled?: boolean
} = {}) {
  mocks.pathname = pathname
  return await render(
    <QueryClientProvider client={testQueryClient}>
      <LayoutProvider>
        <SidebarProvider defaultOpen={true} shortcutEnabled={shortcutEnabled}>
          <OrgSidebarProbe />
          <ProjectShellLayout>
            <div data-testid='mock-main-content'>main</div>
          </ProjectShellLayout>
        </SidebarProvider>
      </LayoutProvider>
    </QueryClientProvider>
  )
}

function getRequiredRect(selector: string): DOMRect {
  const el = document.querySelector(selector)
  if (!el) {
    throw new Error(`Expected element matching ${selector} to exist`)
  }
  return el.getBoundingClientRect()
}

describe('ProjectShellLayout business sidebar toggle', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    clearCookies()
    await page.viewport(1280, 800)

    usePreferencesStore.setState({
      isProjectSidebarCollapsed: false,
    })

    useWorkspaceStore.setState({
      activeOrganizationId: 'org-1',
      activeProjectId: 'p1',
    })

    testQueryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    testQueryClient.setQueryData(dashboardKeys.project('p1'), {
      id: 'p1',
      organizationId: 'org-1',
      name: '陈氏宗谱',
      status: 'in_progress',
      surname: '陈',
      ancestor: null,
      hallName: null,
      originText: null,
      description: null,
      colorTheme: 'sky',
      projectLevel: 1,
      iconKey: null,
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
  })

  it.each([
    { path: '/projects/p1/lineage', title: '谱系导航' },
    { path: '/projects/p1/articles', title: '谱文导航' },
    { path: '/projects/p1/books', title: '谱书目录' },
  ])(
    'renders paired toggle to the left of Breadcrumb and toggles sidebar on $path',
    async ({ path, title }) => {
      const screen = await renderProjectShell({ pathname: path })

      const toggleBtn = screen.getByTestId('nc-sidebar-toggle-btn')
      const breadcrumb = screen.getByTestId('nc-project-topbar-breadcrumb')
      const sidebar = screen.getByTestId('nc-sidebar')

      await expect.element(toggleBtn).toBeVisible()
      await expect.element(toggleBtn).toHaveAttribute('aria-label', '收起业务侧栏')
      await expect.element(toggleBtn).toHaveAttribute('aria-expanded', 'true')
      await expect.element(breadcrumb.getByText('陈氏宗谱')).toBeVisible()
      await expect.element(sidebar).toBeVisible()
      await expect.element(screen.getByText(title)).toBeVisible()
      expect(
        document.querySelector('[data-testid="nc-sidebar-collapse-btn"]')
      ).toBeNull()
      expect(
        document.querySelector(
          '[data-testid="nc-sidebar-toggle-btn"] svg.lucide-panel-left-close'
        )
      ).not.toBeNull()

      const expandedToggleRect = getRequiredRect(
        '[data-testid="nc-sidebar-toggle-btn"]'
      )
      const expandedBreadcrumbRect = getRequiredRect(
        '[data-testid="nc-project-topbar-breadcrumb"]'
      )
      expect(expandedToggleRect.right).toBeLessThanOrEqual(
        expandedBreadcrumbRect.left
      )

      await userEvent.click(toggleBtn)

      await expect.element(sidebar).not.toBeInTheDocument()
      await expect.element(toggleBtn).toHaveAttribute('aria-label', '展开业务侧栏')
      await expect.element(toggleBtn).toHaveAttribute('aria-expanded', 'false')
      expect(
        document.querySelector(
          '[data-testid="nc-sidebar-toggle-btn"] svg.lucide-panel-left-open'
        )
      ).not.toBeNull()

      const collapsedToggleRect = getRequiredRect(
        '[data-testid="nc-sidebar-toggle-btn"]'
      )
      const collapsedBreadcrumbRect = getRequiredRect(
        '[data-testid="nc-project-topbar-breadcrumb"]'
      )
      expect(collapsedToggleRect.right).toBeLessThanOrEqual(
        collapsedBreadcrumbRect.left
      )

      await userEvent.click(toggleBtn)

      await expect.element(screen.getByTestId('nc-sidebar')).toBeVisible()
      await expect.element(toggleBtn).toHaveAttribute('aria-expanded', 'true')
      expect(
        document.querySelector(
          '[data-testid="nc-sidebar-toggle-btn"] svg.lucide-panel-left-close'
        )
      ).not.toBeNull()
      await expect.element(breadcrumb).toBeVisible()
    }
  )

  it.each(['/projects/p1', '/projects/p1/settings'])(
    'does not render toggle button on %s',
    async (path) => {
      await renderProjectShell({ pathname: path })

      expect(
        document.querySelector('[data-testid="nc-sidebar-toggle-btn"]')
      ).toBeNull()
      expect(document.querySelector('[data-testid="nc-sidebar"]')).toBeNull()
    }
  )

  it('toggles business sidebar with Control+\\ and ignores Control+b when org shortcut is disabled', async () => {
    const screen = await renderProjectShell({
      pathname: '/projects/p1/lineage',
      shortcutEnabled: false,
    })

    const sidebar = screen.getByTestId('nc-sidebar')
    const toggleBtn = screen.getByTestId('nc-sidebar-toggle-btn')
    await expect.element(sidebar).toBeVisible()

    await userEvent.keyboard('{Control>}\\{/Control}')
    await expect.element(sidebar).not.toBeInTheDocument()
    await expect.element(toggleBtn).toHaveAttribute('aria-expanded', 'false')

    await userEvent.keyboard('{Control>}\\{/Control}')
    await expect.element(screen.getByTestId('nc-sidebar')).toBeVisible()
    await expect.element(toggleBtn).toHaveAttribute('aria-expanded', 'true')

    await userEvent.keyboard('{Control>}b{/Control}')
    await expect.element(screen.getByTestId('nc-sidebar')).toBeVisible()
    await expect
      .element(screen.getByTestId('org-sidebar-open'))
      .toHaveTextContent('true')
    expect(getCookie('sidebar_state')).toBeUndefined()
  })

  it('toggles business sidebar with Control+\\ on articles route', async () => {
    const screen = await renderProjectShell({
      pathname: '/projects/p1/articles',
      shortcutEnabled: false,
    })

    await expect.element(screen.getByTestId('nc-sidebar')).toBeVisible()
    await userEvent.keyboard('{Control>}\\{/Control}')
    await expect.element(screen.getByTestId('nc-sidebar')).not.toBeInTheDocument()
  })

  it('uses mobile drawer with paired icons, isolated state, and non-overlapping Search & Close buttons', async () => {
    await page.viewport(390, 844)
    const screen = await renderProjectShell({
      pathname: '/projects/p1/lineage',
    })

    const toggleBtn = screen.getByTestId('nc-sidebar-toggle-btn')
    await expect.element(toggleBtn).toBeVisible()
    await expect.element(toggleBtn).toHaveAttribute('aria-expanded', 'false')
    expect(
      document.querySelector(
        '[data-testid="nc-sidebar-toggle-btn"] svg.lucide-panel-left-open'
      )
    ).not.toBeNull()
    expect(document.querySelector('[data-testid="nc-sidebar"]')).toBeNull()

    const initialToggleRect = getRequiredRect(
      '[data-testid="nc-sidebar-toggle-btn"]'
    )
    const initialBreadcrumbRect = getRequiredRect(
      '[data-testid="nc-project-topbar-breadcrumb"]'
    )
    expect(initialToggleRect.right).toBeLessThanOrEqual(
      initialBreadcrumbRect.left
    )

    await userEvent.click(toggleBtn)

    await expect.element(screen.getByTestId('nc-sidebar')).toBeVisible()
    await expect.element(toggleBtn).toHaveAttribute('aria-expanded', 'true')
    expect(usePreferencesStore.getState().isProjectSidebarCollapsed).toBe(false)

    const searchRect = getRequiredRect(
      '[data-testid="nc-sidebar-header"] button[aria-label="快速搜索"]'
    )
    const closeBtn = Array.from(
      document.querySelectorAll('[data-slot="sheet-content"] button')
    ).find((btn) => btn.textContent?.includes('Close'))
    expect(closeBtn).toBeDefined()
    const closeRect = closeBtn!.getBoundingClientRect()
    expect(searchRect.right).toBeLessThanOrEqual(closeRect.left)

    await userEvent.click(closeBtn!)
    await expect.element(screen.getByTestId('nc-sidebar')).not.toBeInTheDocument()
    await expect.element(toggleBtn).toHaveAttribute('aria-expanded', 'false')
    expect(usePreferencesStore.getState().isProjectSidebarCollapsed).toBe(false)
  })

  it('draws exactly one crisp line: sidebar owns no border and the separator line is a single untranslated 1px edge', async () => {
    await renderProjectShell({ pathname: '/projects/p1/lineage' })

    const sidebar = document.querySelector('[data-testid="nc-sidebar"]')
    expect(sidebar).not.toBeNull()
    expect(getComputedStyle(sidebar!).borderRightWidth).toBe('0px')

    const separator = getRequiredRect(
      '[data-testid="nc-business-sidebar-separator"]'
    )
    const sidebarRect = getRequiredRect('[data-testid="nc-sidebar"]')
    const lineEl = document.querySelector(
      '[data-testid="nc-business-sidebar-separator"] span'
    )
    expect(lineEl).not.toBeNull()
    const line = lineEl!.getBoundingClientRect()

    expect(separator.width).toBe(8)
    expect(line.width).toBe(1)
    // 线必须与侧栏右边缘严丝合缝：不重叠（不再重复描边）、不留缝、不半像素偏移。
    expect(separator.left).toBe(sidebarRect.right)
    expect(line.left).toBe(separator.left)
    expect(line.right).toBe(separator.left + 1)
    // 不允许再用 translate 把线推到半像素上（那正是它被摊成两列的根因）。
    expect(getComputedStyle(lineEl!).transform).toBe('none')

    // 分隔线与界面其余边框共用 --border，不得自造颜色。
    const headerEl = document.querySelector('[data-testid="nc-sidebar-header"]')
    expect(headerEl).not.toBeNull()
    expect(getComputedStyle(lineEl!).backgroundColor).toBe(
      getComputedStyle(headerEl!).borderBottomColor
    )
  })

  it('resizes with ArrowLeft/ArrowRight/Home/End and reports aria-valuenow', async () => {
    const screen = await renderProjectShell({ pathname: '/projects/p1/lineage' })

    const separator = screen.getByTestId('nc-business-sidebar-separator')
    await expect.element(separator).toHaveAttribute('aria-valuenow', '252')
    await expect.element(separator).toHaveAttribute('aria-valuemin', '220')
    await expect.element(separator).toHaveAttribute('aria-valuemax', '380')
    await expect.element(separator).toHaveAttribute('aria-orientation', 'vertical')

    await userEvent.click(separator)
    await expect.element(separator).toHaveFocus()

    await userEvent.keyboard('{ArrowLeft}')
    await expect.element(separator).toHaveAttribute('aria-valuenow', '236')
    expect(getRequiredRect('[data-testid="nc-sidebar"]').width).toBe(236)

    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    await expect.element(separator).toHaveAttribute('aria-valuenow', '268')

    await userEvent.keyboard('{Home}')
    await expect.element(separator).toHaveAttribute('aria-valuenow', '220')

    await userEvent.keyboard('{ArrowLeft}')
    await expect.element(separator).toHaveAttribute('aria-valuenow', '220')

    await userEvent.keyboard('{End}')
    await expect.element(separator).toHaveAttribute('aria-valuenow', '380')

    await userEvent.keyboard('{ArrowRight}')
    await expect.element(separator).toHaveAttribute('aria-valuenow', '380')
  })
})
