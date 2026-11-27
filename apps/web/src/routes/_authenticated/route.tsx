import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { useAuthStore } from '@/features/auth/useAuthStore'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ location }) => {
    const { status, onboarding } = useAuthStore.getState()

    if (status === 'anonymous') {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
        replace: true,
      })
    }

    if (
      status === 'authenticated' &&
      onboarding &&
      location.pathname !== '/onboarding'
    ) {
      throw redirect({ to: '/onboarding', replace: true })
    }
  },
  component: AuthGate,
})

function AuthGate() {
  const status = useAuthStore((s) => s.status)

  if (status === 'loading') {
    return (
      <div className='flex h-screen items-center justify-center text-sm text-muted-foreground'>
        正在检查登录状态...
      </div>
    )
  }

  return <AuthenticatedLayout />
}
