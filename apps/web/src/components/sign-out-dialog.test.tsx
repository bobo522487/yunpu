import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { SignOutDialog } from './sign-out-dialog'

const navigate = vi.fn()
const signOut = vi.fn().mockResolvedValue(undefined)

const MOCK_HREF = 'https://app.test/dashboard?tab=1'

vi.mock('@/features/auth/useAuthStore', () => ({
  useAuthStore: (selector: (state: { signOut: typeof signOut }) => unknown) =>
    selector({ signOut }),
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => navigate,
    useLocation: () => ({ href: MOCK_HREF }),
  }
})

describe('SignOutDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signOut.mockResolvedValue(undefined)
  })

  it('calls signOut and navigates to login with current location as redirect', async () => {
    const { getByRole } = await render(
      <SignOutDialog open onOpenChange={vi.fn()} />
    )

    await userEvent.click(getByRole('button', { name: /^退出登录$/i }))
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledOnce())

    expect(signOut).toHaveBeenCalledOnce()
    expect(navigate).toHaveBeenCalledWith({
      to: '/login',
      search: { redirect: MOCK_HREF },
      replace: true,
    })
  })

  it('does not call signOut or navigate when Cancel is clicked', async () => {
    const { getByRole } = await render(
      <SignOutDialog open onOpenChange={vi.fn()} />
    )

    await userEvent.click(getByRole('button', { name: /^Cancel$/i }))

    expect(signOut).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })
})
