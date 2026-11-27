import { createFileRoute } from '@tanstack/react-router'
import ProjectSettingsPage from '@/features/project/pages/ProjectSettingsPage'

export const Route = createFileRoute('/_authenticated/projects/$projectId/settings')({
  component: ProjectSettingsPage,
})
