import { createFileRoute } from '@tanstack/react-router'
import ProjectHomePage from '@/features/project/pages/ProjectHomePage'

export const Route = createFileRoute('/_authenticated/projects/$projectId/')({
  component: ProjectHomePage,
})
