import { createFileRoute } from '@tanstack/react-router'
import OnboardingPage from '@/features/auth/pages/OnboardingPage'
import { parseInviteSearch } from '@/features/auth/redirect'

export const Route = createFileRoute('/_authenticated/onboarding')({
  validateSearch: parseInviteSearch,
  component: OnboardingPage,
})
