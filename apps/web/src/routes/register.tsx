import { createFileRoute } from '@tanstack/react-router'
import RegisterPage from '@/features/auth/pages/RegisterPage'
import { parseInviteSearch } from '@/features/auth/redirect'

export const Route = createFileRoute('/register')({
  validateSearch: parseInviteSearch,
  component: RegisterPage,
})
