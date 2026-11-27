import { createFileRoute } from '@tanstack/react-router'
import WorkspaceHomePage from '@/features/dashboard/pages/WorkspaceHomePage'

export const Route = createFileRoute('/_authenticated/home')({
  component: WorkspaceHomePage,
})
