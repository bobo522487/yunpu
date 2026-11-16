import React, { useState } from 'react';
import { Plus, Copy, Check, FolderKanban } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Dropdown, { DropdownItem } from './Dropdown';
import CreateWorkspaceDialog from '../../features/workspace/components/CreateWorkspaceDialog';
import { ViewMode } from '../../types';
import { useRouteContext } from '../../hooks/useRouteContext';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';

const SECTION_LABELS: Partial<Record<ViewMode, string>> = {
  [ViewMode.HOME]: '首页',
  [ViewMode.PROJECTS]: '项目',
  [ViewMode.MEMBERS]: '成员和团队',
  [ViewMode.WORKSPACE_SETTINGS]: '设置',
  [ViewMode.PROJECT_HOME]: '项目首页',
  [ViewMode.PROJECT_SETTINGS]: '项目设置',
  [ViewMode.LINEAGE]: '世系',
  [ViewMode.ARTICLES]: '人物传记',
  [ViewMode.BOOKS]: '宗谱',
};

const Separator: React.FC = () => (
  <span className="text-muted-foreground/40 mx-1 text-base font-light">/</span>
);

const Breadcrumb: React.FC = () => {
  const navigate = useNavigate();
  const { activeView, isWorkspaceShell } = useRouteContext();

  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const switchWorkspace = useWorkspaceStore((s) => s.switchWorkspace);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const members = useWorkspaceStore((s) => s.members);
  const projects = useWorkspaceStore((s) => s.projects);
  const activeProjectId = useWorkspaceStore((s) => s.activeProjectId);

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  const activeProject = projects.find((p) => p.id === activeProjectId);
  const workspaceMembersCount = members.filter(
    (m) => m.workspaceId === activeWorkspace?.id
  ).length;

  // Workspace Shell mode (NocoDB style: 个人空间 / 项目)
  if (isWorkspaceShell) {
    return (
      <div
        className="flex items-center gap-1.5 min-w-0 text-[14px] leading-5"
        data-testid="nc-ws-home-topbar-breadcrumb"
      >
        <span
          className="font-medium text-muted-foreground truncate cursor-pointer hover:text-foreground transition-colors"
          onClick={() => navigate('/')}
          data-testid="nc-ws-home-topbar-title"
        >
          {activeWorkspace?.name || '个人空间'}
        </span>
        <Separator />
        <span className="font-semibold text-foreground truncate">
          {SECTION_LABELS[activeView] || '项目'}
        </span>
      </div>
    );
  }

  const orgItems: DropdownItem[] = workspaces.map((w) => ({
    id: w.id,
    label: w.name,
    group: w.kind === 'personal' ? '个人工作区' : '团队工作区',
    description: w.plan,
    avatar: (
      <div
        className="w-7 h-7 rounded-md flex items-center justify-center text-white font-semibold text-xs"
        style={{ backgroundColor: w.color }}
      >
        {w.name.slice(0, 1)}
      </div>
    ),
  }));

  const renderOrgHeader = () => (
    <div className="px-3 py-3">
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-semibold shadow-xs"
          style={{ backgroundColor: activeWorkspace?.color || '#3B5BDB' }}
        >
          {activeWorkspace?.name.slice(0, 1)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate text-foreground">
            {activeWorkspace?.name}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {activeWorkspace?.plan} · {workspaceMembersCount} 位成员
          </div>
        </div>
      </div>
      <div className="mt-2.5 flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-md border border-border/50">
        <span className="font-mono truncate">ID: {activeWorkspace?.id}</span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(activeWorkspace?.id || '');
            setCopiedId(true);
            setTimeout(() => setCopiedId(false), 1500);
          }}
          className="ml-auto hover:text-foreground transition-colors"
          title="复制工作区 ID"
        >
          {copiedId ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex items-center text-sm min-w-0">
      <Dropdown
        triggerLabel={activeWorkspace?.name || '个人空间'}
        triggerIcon={FolderKanban}
        items={orgItems}
        selectedId={activeWorkspace?.id}
        onSelect={(item) => switchWorkspace(item.id)}
        width={260}
        header={renderOrgHeader()}
        searchPlaceholder="搜索工作区..."
        open={activeDropdown === 'org'}
        onOpenChange={(isOpen) => setActiveDropdown(isOpen ? 'org' : null)}
        footer={
          <div
            className="relative flex select-none items-center rounded-md px-2 py-2 text-xs outline-none hover:bg-muted cursor-pointer w-full text-foreground gap-2 transition-colors"
            onClick={() => {
              setActiveDropdown(null);
              setIsCreateWorkspaceOpen(true);
            }}
          >
            <div className="w-6 h-6 rounded-md border border-dashed border-muted-foreground/50 flex items-center justify-center">
              <Plus size={14} className="text-muted-foreground" />
            </div>
            <span className="font-medium">新建工作区</span>
          </div>
        }
      />

      <Separator />
      <span className="font-semibold text-foreground truncate px-1.5">
        {activeProject?.name || '项目'}
      </span>

      {activeView !== ViewMode.PROJECT_HOME && (
        <>
          <Separator />
          <span className="text-muted-foreground font-medium truncate px-1.5">
            {SECTION_LABELS[activeView] || ''}
          </span>
        </>
      )}

      <CreateWorkspaceDialog
        isOpen={isCreateWorkspaceOpen}
        onClose={() => setIsCreateWorkspaceOpen(false)}
        onCreate={(name) => createWorkspace(name)}
      />
    </div>
  );
};

export default Breadcrumb;
