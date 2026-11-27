import { createFileRoute } from '@tanstack/react-router'
import MembersPage from '@/features/dashboard/pages/MembersPage'

export const Route = createFileRoute('/_authenticated/members')({
  component: MembersPage,
})
