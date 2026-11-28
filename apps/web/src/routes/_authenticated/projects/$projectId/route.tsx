import { useEffect } from 'react'
import { createFileRoute, Outlet } from '@tanstack/react-router'
import {
  useCurrentOrganizationId,
  useProjectQuery,
} from '@/features/dashboard/queries'
import { useWorkspaceStore } from '@/store/useWorkspaceStore'

export const Route = createFileRoute('/_authenticated/projects/$projectId')({
  component: ProjectBridge,
})

function ProjectBridge() {
  const { projectId } = Route.useParams()
  const activeProjectId = useWorkspaceStore((s) => s.activeProjectId)
  const setActiveProjectId = useWorkspaceStore((s) => s.setActiveProjectId)
  const setActiveOrganizationId = useWorkspaceStore(
    (s) => s.setActiveOrganizationId,
  )
  const currentOrganizationId = useCurrentOrganizationId()
  const projectQuery = useProjectQuery(projectId)

  useEffect(() => {
    if (projectId && projectId !== activeProjectId) {
      setActiveProjectId(projectId)
    }
  }, [projectId, activeProjectId, setActiveProjectId])

  useEffect(() => {
    const projectOrgId = projectQuery.data?.organizationId
    if (projectOrgId && projectOrgId !== currentOrganizationId) {
      // 冷直链跨组织打开家族项目时仅对齐前端当前会话组织，不写服务端默认组织。
      setActiveOrganizationId(projectOrgId)
    }
  }, [
    projectQuery.data?.organizationId,
    currentOrganizationId,
    setActiveOrganizationId,
  ])

  return <Outlet />
}
