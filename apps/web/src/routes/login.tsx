import { createFileRoute } from '@tanstack/react-router'
import LoginPage from '@/features/auth/pages/LoginPage'
import { sanitizeRedirectPath } from '@/features/auth/redirect'

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: sanitizeRedirectPath(search.redirect),
  }),
  component: LoginPage,
})
