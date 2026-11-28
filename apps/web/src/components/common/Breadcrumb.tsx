import React, { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useMatchRoute, useNavigate, useParams } from '@tanstack/react-router'
import {
  BookOpen,
  Check,
  ChevronsUpDown,
  Compass,
  Copy,
  GitFork,
  Home,
  Layers,
  Plus,
  ScrollText,
  Search,
  Settings,
  Users,
} from 'lucide-react'
import type { AssetEditorSubmitValues } from '../../features/dashboard/components/AssetEditorModal'
import { toCreateProjectPayload } from '../../features/dashboard/projectPayload'
import {
  useCurrentOrganizationId,
  useOrganizationProjectActions,
  useProjectQuery,
  useProjectSwitcherQuery,
} from '../../features/dashboard/queries'
import { useProjectId } from '../../hooks/useProjectId'
import { errorMessage } from '../../lib/api'
import { FamilyIcon } from './FamilyIcon'
import { ProjectColoredIcon } from './YunpuIcons'

const AssetEditorModal = lazy(() =>
  import('../../features/dashboard/components/AssetEditorModal').then((m) => ({
    default: m.AssetEditorModal,
  }))
)

interface ViewBadgeConfig {
  label: string
  icon: React.ElementType
  mutedIcon?: boolean
}

const Separator: React.FC = () => (
  <span className='mx-1 shrink-0 text-[15px] font-light text-muted-foreground/45 select-none'>
    /
  </span>
)

const Breadcrumb: React.FC = () => {
  const navigate = useNavigate()
  const matchRoute = useMatchRoute()
  const params = useParams({ strict: false }) as { projectId?: string }
  const isWorkspaceShell = !params.projectId
  const activeProjectId = useProjectId()

  const activeOrgId = useCurrentOrganizationId()
  const projectQuery = useProjectQuery(activeProjectId, {
    enabled: !isWorkspaceShell && Boolean(activeProjectId),
  })
  const { createProject, duplicateProject, primeProjectCache } =
    useOrganizationProjectActions()

  const [isProjMenuOpen, setIsProjMenuOpen] = useState(false)
  const [projSearch, setProjSearch] = useState('')
  const [copiedId, setCopiedId] = useState(false)
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false)
  const [creatingProject, setCreatingProject] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [breadcrumbError, setBreadcrumbError] = useState<string | null>(null)

  const projDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        projDropdownRef.current &&
        !projDropdownRef.current.contains(e.target as Node)
      ) {
        setIsProjMenuOpen(false)
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsProjMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [])

  const switcherQuery = useProjectSwitcherQuery(activeOrgId, isProjMenuOpen)
  const workspaceProjects = switcherQuery.data?.items ?? []
  const activeProject = isWorkspaceShell ? undefined : projectQuery.data

  const filteredProjects = workspaceProjects.filter((p) =>
    p.name.toLowerCase().includes(projSearch.toLowerCase())
  )

  let viewBadge: ViewBadgeConfig | null = null
  if (isWorkspaceShell) {
    if (matchRoute({ to: '/home' })) {
      viewBadge = { label: '首页', icon: Home }
    } else if (matchRoute({ to: '/members' })) {
      viewBadge = { label: '成员', icon: Users }
    } else if (matchRoute({ to: '/settings' })) {
      viewBadge = { label: '设置', icon: Settings, mutedIcon: true }
    }
  } else if (activeProjectId) {
    if (
      matchRoute({
        to: '/projects/$projectId/lineage',
        params: { projectId: activeProjectId },
      })
    ) {
      viewBadge = { label: '谱系', icon: GitFork }
    } else if (
      matchRoute({
        to: '/projects/$projectId/articles',
        params: { projectId: activeProjectId },
      })
    ) {
      viewBadge = { label: '谱文', icon: ScrollText }
    } else if (
      matchRoute({
        to: '/projects/$projectId/books',
        params: { projectId: activeProjectId },
      })
    ) {
      viewBadge = { label: '谱书', icon: BookOpen }
    } else if (
      matchRoute({
        to: '/projects/$projectId/settings',
        params: { projectId: activeProjectId },
      })
    ) {
      viewBadge = { label: '家族设置', icon: Settings, mutedIcon: true }
    } else if (
      matchRoute({
        to: '/projects/$projectId',
        params: { projectId: activeProjectId },
      })
    ) {
      viewBadge = { label: '概览', icon: Compass }
    }
  }

  const handleCreateProject = async (values: AssetEditorSubmitValues) => {
    if (!activeOrgId) return
    setCreateError(null)
    setCreatingProject(true)
    try {
      const payload = toCreateProjectPayload(values)
      const created = await createProject(activeOrgId, payload)
      setIsCreateProjectOpen(false)
      void navigate({
        to: '/projects/$projectId',
        params: { projectId: created.id },
      })
    } catch (error) {
      setCreateError(errorMessage(error))
    } finally {
      setCreatingProject(false)
    }
  }

  return (
    <>
      <div
        className='flex min-w-0 items-center gap-1'
        data-testid={
          isWorkspaceShell
            ? 'nc-ws-home-topbar-breadcrumb'
            : 'nc-project-topbar-breadcrumb'
        }
      >
        <div
          ref={projDropdownRef}
          className='relative flex min-w-0 items-center'
        >
          <button
            type='button'
            onClick={() => {
              setProjSearch('')
              setIsProjMenuOpen((v) => !v)
            }}
            aria-expanded={isProjMenuOpen}
            data-testid='nc-sidebar-project-selector'
            className='flex max-w-[260px] min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-left transition-colors duration-150 hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
          >
            {isWorkspaceShell ? (
              <ProjectColoredIcon
                colorTheme='indigo'
                className='h-5 w-5 shrink-0'
              />
            ) : (
              <FamilyIcon project={activeProject} size='sm' />
            )}
            <span className='flex-1 truncate text-[14px] font-semibold whitespace-nowrap text-foreground'>
              {isWorkspaceShell ? '所有家族' : activeProject?.name || '家族'}
            </span>
            <ChevronsUpDown
              size={13}
              className='shrink-0 text-muted-foreground'
            />
          </button>

          {isProjMenuOpen && (
            <div className='absolute top-10 left-0 z-[85] w-[268px] rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-[var(--shadow-popover)]'>
              {/* Active Project Identity + ID Copy (only inside a specific project) */}
              {!isWorkspaceShell && activeProject && (
                <div className='mb-1 border-b border-border/70 px-2 py-1.5'>
                  <div className='flex items-center justify-between gap-2'>
                    <span className='truncate text-[12px] font-semibold text-foreground'>
                      {activeProject.name}
                    </span>
                    <button
                      type='button'
                      onClick={() => {
                        navigator.clipboard?.writeText(activeProject.id || '')
                        setCopiedId(true)
                        setTimeout(() => setCopiedId(false), 1500)
                      }}
                      className='inline-flex shrink-0 cursor-pointer items-center gap-1 rounded border border-border/70 bg-[var(--surface-subtle)] px-1.5 py-0.5 font-mono text-[12px] whitespace-nowrap text-muted-foreground hover:text-foreground'
                      title='复制家族 ID'
                    >
                      <span>{copiedId ? '已复制' : 'ID'}</span>
                      {copiedId ? (
                        <Check size={11} className='text-primary' />
                      ) : (
                        <Copy size={11} />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Search Filter */}
              <div className='relative mb-1.5'>
                <Search
                  size={12}
                  className='absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground'
                />
                <input
                  type='text'
                  value={projSearch}
                  onChange={(e) => setProjSearch(e.target.value)}
                  placeholder='切换家族...'
                  className='h-8 w-full rounded-md border border-input bg-card pr-2 pl-7 text-xs text-foreground transition-all duration-150 placeholder:text-muted-foreground focus:border-primary focus:shadow-[var(--shadow-focus-halo)] focus:ring-1 focus:ring-primary focus:outline-none'
                  autoFocus
                />
              </div>

              {/* All Projects Entry */}
              <button
                type='button'
                onClick={() => {
                  setIsProjMenuOpen(false)
                  void navigate({ to: '/' })
                }}
                className={`mb-1 flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors ${
                  isWorkspaceShell
                    ? 'bg-accent font-semibold text-accent-foreground'
                    : 'font-medium text-foreground hover:bg-[var(--surface-hover)]'
                }`}
              >
                <Layers size={14} className='shrink-0 text-primary' />
                <span className='flex-1 truncate'>所有家族</span>
                {isWorkspaceShell && (
                  <Check size={13} className='shrink-0 text-primary' />
                )}
              </button>

              <div className='my-1 border-t border-border/70' />

              {/* Project List */}
              <div className='max-h-48 space-y-0.5 overflow-y-auto'>
                {filteredProjects.map((proj) => {
                  const isCurrent =
                    !isWorkspaceShell && proj.id === activeProject?.id
                  return (
                    <button
                      key={proj.id}
                      type='button'
                      onClick={() => {
                        setIsProjMenuOpen(false)
                        primeProjectCache(proj)
                        void navigate({
                          to: '/projects/$projectId',
                          params: { projectId: proj.id },
                        })
                      }}
                      className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors ${
                        isCurrent
                          ? 'bg-accent font-semibold text-accent-foreground'
                          : 'font-medium text-foreground hover:bg-[var(--surface-hover)]'
                      }`}
                    >
                      <FamilyIcon project={proj} size='xs' />
                      <span className='flex-1 truncate'>{proj.name}</span>
                      {isCurrent && (
                        <Check size={13} className='shrink-0 text-primary' />
                      )}
                    </button>
                  )
                })}
                {switcherQuery.isPending && filteredProjects.length === 0 ? (
                  <div className='px-2 py-3 text-center text-[12px] text-muted-foreground'>
                    加载家族列表...
                  </div>
                ) : (
                  filteredProjects.length === 0 && (
                    <div className='px-2 py-3 text-center text-[12px] text-muted-foreground'>
                      未找到匹配家族
                    </div>
                  )
                )}
              </div>

              <div className='mt-1.5 space-y-0.5 border-t border-border pt-1.5'>
                {!isWorkspaceShell && activeProject && (
                  <>
                    <button
                      type='button'
                      onClick={() => {
                        setIsProjMenuOpen(false)
                        void navigate({
                          to: '/projects/$projectId/settings',
                          params: { projectId: activeProjectId },
                        })
                      }}
                      className='flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-[var(--surface-hover)]'
                    >
                      <Settings size={13} className='text-muted-foreground' />
                      <span>家族设置</span>
                    </button>
                    <button
                      type='button'
                      onClick={() => {
                        setIsProjMenuOpen(false)
                        void duplicateProject(activeProject.id)
                          .then((copy) => {
                            void navigate({
                              to: '/projects/$projectId',
                              params: { projectId: copy.id },
                            })
                          })
                          .catch((error: unknown) => {
                            setBreadcrumbError(errorMessage(error))
                          })
                      }}
                      className='flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-[var(--surface-hover)]'
                    >
                      <Copy size={13} className='text-muted-foreground' />
                      <span>复制当前家族</span>
                    </button>
                  </>
                )}
                <button
                  type='button'
                  onClick={() => {
                    setIsProjMenuOpen(false)
                    setCreateError(null)
                    setBreadcrumbError(null)
                    setIsCreateProjectOpen(true)
                  }}
                  className='flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12px] font-medium text-primary transition-colors hover:bg-accent/70'
                >
                  <Plus size={13} />
                  <span>新建家族</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {viewBadge && (
          <>
            <Separator />
            <div className='flex shrink-0 items-center gap-1.5 px-1.5 py-1 text-[14px] font-semibold whitespace-nowrap text-foreground'>
              <viewBadge.icon
                size={14}
                className={
                  viewBadge.mutedIcon ? 'text-muted-foreground' : 'text-primary'
                }
              />
              <span>{viewBadge.label}</span>
            </div>
          </>
        )}
        {breadcrumbError && (
          <p className='max-w-[240px] shrink-0 truncate text-[12px] text-destructive'>
            {breadcrumbError}
          </p>
        )}
      </div>

      {isCreateProjectOpen && (
        <Suspense fallback={null}>
          <AssetEditorModal
            open={isCreateProjectOpen}
            mode='create'
            kind='project'
            submitting={creatingProject}
            error={createError}
            onClose={() => {
              if (!creatingProject) {
                setIsCreateProjectOpen(false)
                setCreateError(null)
              }
            }}
            onSubmit={(values) => void handleCreateProject(values)}
          />
        </Suspense>
      )}
    </>
  )
}

export default Breadcrumb
