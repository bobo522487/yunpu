import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import LoginPage from '@/features/auth/pages/LoginPage'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  signIn: vi.fn(),
  clearError: vi.fn(),
  authState: {
    status: 'anonymous' as 'anonymous' | 'authenticated',
    onboarding: false,
    error: null as string | null,
  },
  search: {} as { redirect?: string },
}))

vi.mock('@/features/auth/useAuthStore', () => ({
  useAuthStore: (
    selector: (state: {
      status: typeof mocks.authState.status
      onboarding: boolean
      error: string | null
      signIn: typeof mocks.signIn
      clearError: typeof mocks.clearError
    }) => unknown,
  ) =>
    selector({
      ...mocks.authState,
      signIn: mocks.signIn,
      clearError: mocks.clearError,
    }),
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  const { createElement } = await import('react')
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useSearch: () => mocks.search,
    Link: ({
      to,
      children,
      className,
    }: {
      to: string
      children: ReactNode
      className?: string
    }) => createElement('a', { href: to, className }, children),
  }
})

describe('LoginPage 登录后跳转', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.authState.status = 'anonymous'
    mocks.authState.onboarding = false
    mocks.authState.error = null
    mocks.search = {}
  })

  it('无显式 redirect 且非新用户时默认跳转到家族列表 /projects', async () => {
    mocks.authState.status = 'authenticated'

    await render(<LoginPage />)

    await vi.waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({ to: '/projects', replace: true })
    )
  })

  it('显式 redirect 优先于默认落点', async () => {
    mocks.authState.status = 'authenticated'
    mocks.search = { redirect: '/members' }

    await render(<LoginPage />)

    await vi.waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({ href: '/members', replace: true })
    )
    expect(mocks.navigate).not.toHaveBeenCalledWith({ to: '/projects', replace: true })
  })

  it('新用户 onboarding 优先于显式 redirect 与默认落点', async () => {
    mocks.authState.status = 'authenticated'
    mocks.authState.onboarding = true
    mocks.search = { redirect: '/members' }

    await render(<LoginPage />)

    await vi.waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({ to: '/onboarding', replace: true })
    )
    expect(mocks.navigate).not.toHaveBeenCalledWith({ href: '/members', replace: true })
  })
})
