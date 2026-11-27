import { useEffect } from 'react'
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useWorkspaceStore } from '@/store/useWorkspaceStore'

export const Route = createFileRoute('/_authenticated/projects/$projectId')({
  component: ProjectBridge,
})

function ProjectBridge() {
  const { projectId } = Route.useParams()
  const activeProjectId = useWorkspaceStore((s) => s.activeProjectId)
  const setActiveProjectId = useWorkspaceStore((s) => s.setActiveProjectId)

  useEffect(() => {
    if (projectId && projectId !== activeProjectId) {
      setActiveProjectId(projectId)
    }
  }, [projectId, activeProjectId, setActiveProjectId])

  return <Outlet />
}
