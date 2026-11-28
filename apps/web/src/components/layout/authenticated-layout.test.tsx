import '@/styles/index.css'
import { clearCookies } from '@/test-utils/cookies'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'
import { getCookie, setCookie } from '@/lib/cookies'
import { useWorkspaceStore } from '@/store/useWorkspaceStore'
import { AuthenticatedLayout } from './authenticated-layout'

const mocks = vi.hoisted(() => ({
  pathname: '/projects',
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useLocation: ({
      select,
    }: {
      select?: (loc: { pathname: string; href: string }) => unknown
    } = {}) => {
      const location = { pathname: mocks.pathname, href: mocks.pathname }
      return select ? select(location) : location
    },
    useNavigate: () => vi.fn(),
    useParams: () => ({}),
    useMatchRoute: () => () => false,
    Outlet: () => <div data-testid='mock-outlet' />,
    Link: ({
      to,
      children,
      className,
    }: {
      to: string
      children: React.ReactNode
      className?: string
    }) => (
      <a href={to} className={className}>
        {children}
      </a>
    ),
  }
})

vi.mock('@/components/common/Breadcrumb', () => ({
  default: () => <nav data-testid='mock-breadcrumb' />,
}))

vi.mock('@/context/search-provider', () => ({
  SearchProvider: ({ children }: { children: React.ReactNode }) => children,
  useSearch: () => ({ open: false, setOpen: vi.fn() }),
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
  Search: () => <div data-testid='mock-search' />,
}))

vi.mock('@/components/layout/project-shell-layout', () => ({
  ProjectShellLayout: () => <div data-testid='mock-project-shell' />,
}))

function getRequiredRect(selector: string): DOMRect {
  const el = document.querySelector(selector)
  if (!el) throw new Error(`Expected element matching ${selector} to exist`)
  return el.getBoundingClientRect()
}

async function renderOrgLayout() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return await render(
    <QueryClientProvider client={client}>
      <AuthenticatedLayout>
        <div data-testid='mock-main-content'>main</div>
      </AuthenticatedLayout>
    </QueryClientProvider>
  )
}

describe('组织侧栏分隔线', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    clearCookies()
    mocks.pathname = '/projects'
    await page.viewport(1280, 800)
    useWorkspaceStore.setState({
      activeOrganizationId: '',
      activeProjectId: '',
    })
  })

  it('贴边展开时只画一条线，单击分隔线不会收起组织侧栏', async () => {
    const screen = await renderOrgLayout()

    const sidebar = document.querySelector('[data-testid="nc-org-sidebar"]')
    expect(sidebar).not.toBeNull()
    expect(getComputedStyle(sidebar!).borderRightWidth).toBe('0px')
    expect(document.querySelector('[data-sidebar="rail"]')).toBeNull()

    const separator = screen.getByTestId('nc-org-sidebar-separator')
    await expect.element(separator).toHaveAttribute('aria-label', '调整组织侧栏宽度')
    await expect.element(separator).toHaveAttribute('aria-valuenow', '256')

    const sidebarRect = getRequiredRect('[data-testid="nc-org-sidebar"]')
    const separatorRect = getRequiredRect('[data-testid="nc-org-sidebar-separator"]')
    const lineEl = document.querySelector(
      '[data-testid="nc-org-sidebar-separator"] span'
    )
    expect(lineEl).not.toBeNull()
    const line = lineEl!.getBoundingClientRect()

    expect(separatorRect.width).toBe(8)
    expect(line.width).toBe(1)
    expect(separatorRect.left).toBe(sidebarRect.right)
    expect(line.left).toBe(separatorRect.left)
    expect(getComputedStyle(lineEl!).transform).toBe('none')

    const toggle = screen.getByTestId('nc-org-sidebar-toggle')
    await expect.element(toggle).toHaveAttribute('aria-label', '收起组织侧栏')
    await expect.element(toggle).toHaveAttribute('aria-expanded', 'true')

    await userEvent.click(separator)
    await expect.element(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect.element(separator).toHaveAttribute('aria-valuenow', '256')
    expect(getRequiredRect('[data-testid="nc-org-sidebar"]').width).toBe(256)
  })

  it('用方向键、Home、End 调整宽度，并在下次进入时恢复', async () => {
    const screen = await renderOrgLayout()
    const separator = screen.getByTestId('nc-org-sidebar-separator')

    await userEvent.click(separator)
    await userEvent.keyboard('{ArrowLeft}')
    await expect.element(separator).toHaveAttribute('aria-valuenow', '240')
    expect(getCookie('sidebar_width')).toBe('240')
    await vi.waitFor(() => {
      expect(getRequiredRect('[data-testid="nc-org-sidebar"]').width).toBe(240)
    })

    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    await expect.element(separator).toHaveAttribute('aria-valuenow', '272')

    await userEvent.keyboard('{Home}')
    await expect.element(separator).toHaveAttribute('aria-valuenow', '220')
    await userEvent.keyboard('{ArrowLeft}')
    await expect.element(separator).toHaveAttribute('aria-valuenow', '220')

    await userEvent.keyboard('{End}')
    await expect.element(separator).toHaveAttribute('aria-valuenow', '380')
    await userEvent.keyboard('{ArrowRight}')
    await expect.element(separator).toHaveAttribute('aria-valuenow', '380')
    expect(getCookie('sidebar_width')).toBe('380')
  })

  it('下次进入时恢复记住的宽度', async () => {
    setCookie('sidebar_width', '380')
    const screen = await renderOrgLayout()
    await expect
      .element(screen.getByTestId('nc-org-sidebar-separator'))
      .toHaveAttribute('aria-valuenow', '380')
    expect(getRequiredRect('[data-testid="nc-org-sidebar"]').width).toBe(380)
  })

  it('拖拽时立即改宽度，并且不播宽度动画', async () => {
    await renderOrgLayout()
    const separator = document.querySelector(
      '[data-testid="nc-org-sidebar-separator"]'
    )
    expect(separator).not.toBeNull()

    separator!.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, clientX: 256 })
    )
    await vi.waitFor(() => {
      expect(
        document
          .querySelector('[data-slot="sidebar-wrapper"]')
          ?.getAttribute('data-resizing')
      ).toBe('true')
    })
    expect(
      getComputedStyle(document.querySelector('[data-slot="sidebar-gap"]')!)
        .transitionProperty
    ).toBe('none')

    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300 }))
    await vi.waitFor(() => {
      expect(separator!.getAttribute('aria-valuenow')).toBe('300')
    })
    expect(getCookie('sidebar_width')).toBe('300')

    window.dispatchEvent(new MouseEvent('mouseup'))
    await vi.waitFor(() => {
      expect(
        document
          .querySelector('[data-slot="sidebar-wrapper"]')
          ?.hasAttribute('data-resizing')
      ).toBe(false)
    })
  })

  it('收成图标时分隔线消失，并由组织侧栏自己画右边框', async () => {
    const screen = await renderOrgLayout()

    await userEvent.click(screen.getByTestId('nc-org-sidebar-toggle'))
    await expect
      .element(screen.getByTestId('nc-org-sidebar-toggle'))
      .toHaveAttribute('aria-label', '展开组织侧栏')
    expect(
      document.querySelector('[data-testid="nc-org-sidebar-separator"]')
    ).toBeNull()
    expect(
      getComputedStyle(document.querySelector('[data-testid="nc-org-sidebar"]')!)
        .borderRightWidth
    ).toBe('1px')

    await userEvent.keyboard('{Control>}b{/Control}')
    await expect
      .element(screen.getByTestId('nc-org-sidebar-separator'))
      .toBeVisible()
    expect(
      getComputedStyle(document.querySelector('[data-testid="nc-org-sidebar"]')!)
        .borderRightWidth
    ).toBe('0px')
  })

  it('完全收起时不画右边框，也不出现分隔线', async () => {
    setCookie('layout_collapsible', 'offcanvas')
    setCookie('sidebar_state', 'false')
    const screen = await renderOrgLayout()

    await expect
      .element(screen.getByTestId('nc-org-sidebar-toggle'))
      .toHaveAttribute('aria-label', '展开组织侧栏')
    expect(
      document.querySelector('[data-testid="nc-org-sidebar-separator"]')
    ).toBeNull()
    expect(
      getComputedStyle(document.querySelector('[data-testid="nc-org-sidebar"]')!)
        .borderRightWidth
    ).toBe('0px')
  })

  it.each(['inset', 'floating'])(
    '%s 外观不画分隔线，宽度固定为 256，且不擦掉已记住的宽度',
    async (variant) => {
      setCookie('sidebar_width', '300')
      setCookie('layout_variant', variant)
      const screen = await renderOrgLayout()

      expect(
        document.querySelector('[data-testid="nc-org-sidebar-separator"]')
      ).toBeNull()
      expect(document.querySelector('[data-sidebar="rail"]')).toBeNull()
      expect(getCookie('sidebar_width')).toBe('300')
      expect(
        getComputedStyle(
          document.querySelector('[data-slot="sidebar-wrapper"]')!
        )
          .getPropertyValue('--sidebar-width')
          .trim()
      ).toBe('16rem')
      expect(getRequiredRect('[data-testid="nc-org-sidebar"]').width).toBe(256)
      await expect
        .element(screen.getByTestId('nc-org-sidebar-toggle'))
        .toHaveAttribute('aria-label', '收起组织侧栏')
    }
  )

  it('窄屏只用抽屉开关，不出现组织侧栏分隔线', async () => {
    await page.viewport(390, 844)
    const screen = await renderOrgLayout()

    expect(
      document.querySelector('[data-testid="nc-org-sidebar-separator"]')
    ).toBeNull()
    expect(document.querySelector('[data-testid="nc-org-sidebar-toggle"]')).toBeNull()
    await expect
      .element(screen.getByRole('button', { name: 'Toggle Sidebar' }))
      .toBeVisible()
  })

  it('家族项目里不出现组织侧栏分隔线', async () => {
    mocks.pathname = '/projects/p1/lineage'
    await renderOrgLayout()

    expect(document.querySelector('[data-testid="mock-project-shell"]')).not.toBeNull()
    expect(
      document.querySelector('[data-testid="nc-org-sidebar-separator"]')
    ).toBeNull()
    expect(document.querySelector('[data-testid="nc-org-sidebar-toggle"]')).toBeNull()
  })
})
