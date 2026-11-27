import { createFileRoute } from '@tanstack/react-router'
import WorkspaceSettingsPage from '@/features/dashboard/pages/WorkspaceSettingsPage'

export const Route = createFileRoute('/_authenticated/settings')({
  component: WorkspaceSettingsPage,
})
