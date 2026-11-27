import { createFileRoute } from '@tanstack/react-router'
import LineagePage from '@/features/lineage/pages/LineagePage'

export const Route = createFileRoute('/_authenticated/projects/$projectId/lineage')({
  component: LineagePage,
})
