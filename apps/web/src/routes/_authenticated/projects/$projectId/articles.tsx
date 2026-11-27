import { createFileRoute } from '@tanstack/react-router'
import ArticlesPage from '@/features/articles/pages/ArticlesPage'

export const Route = createFileRoute('/_authenticated/projects/$projectId/articles')({
  component: ArticlesPage,
})
