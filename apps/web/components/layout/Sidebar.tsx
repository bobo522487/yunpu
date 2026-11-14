import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  File as FileIcon,
  Folder as FolderIcon,
  FolderOpen,
  Home,
  Users,
  Settings,
  ArrowLeft,
  Check,
  Plus,
  Search,
  Database,
  Table,
  Code2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FileSystemNode, FileType, ViewMode } from '../../types';
import PagesPanel from '../../features/app-builder/components/PagesPanel';
import TablePanel from '../../features/data-modeler/components/TablePanel';
import DataSourcePanel from '../../features/datasource/components/DataSourcePanel';
import CreateWorkspaceDialog from '../../features/workspace/components/CreateWorkspaceDialog';
import UserAvatarMenu from './UserAvatarMenu';
import { ProjectLayersOutlineIcon, WorkspaceLogoIcon } from '../common/NocoIcons';
import { useRouteContext } from '../../hooks/useRouteContext';
import { useEditorStore } from '../../store/useEditorStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';

interface FileTreeProps {
  node: FileSystemNode;
  depth: number;
  onToggleFolder: (id: string) => void;
  onSelectFile: (node: FileSystemNode) => void;
  selectedFileId: string | null;
}

const FileTree: React.FC<FileTreeProps> = ({
  node,
  depth,
  onToggleFolder,
  onSelectFile,
  selectedFileId,
}) => {
  const isSelected = node.id === selectedFileId;
  const paddingLeft = `${depth * 12 + 12}px`;

  if (node.type === FileType.FILE) {
    return (
      <div
        onClick={() => onSelectFile(node)}
        className={`flex items-center py-1.5 cursor-pointer text-[13px] select-none transition-colors rounded-sm mx-1 ${
          isSelected
            ? 'bg-accent text-accent-foreground font-semibold'
            : 'text-foreground/85 font-medium hover:bg-muted/50 hover:text-foreground'
        }`}
        style={{ paddingLeft }}
      >
        <FileIcon size={14} className="mr-2 text-blue-500" />
        <span className="truncate">{node.name}</span>
      </div>
    );
  }

  return (
    <div>
      <div
        onClick={() => onToggleFolder(node.id)}
        className="flex items-center py-1.5 cursor-pointer text-[13px] font-medium text-foreground/85 hover:text-foreground hover:bg-muted/50 select-none transition-colors rounded-sm mx-1"
        style={{ paddingLeft }}
      >
        <span className="mr-1 opacity-70">
          {node.isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        {node.isOpen ? (
          <FolderOpen size={14} className="mr-2 text-yellow-500" />
        ) : (
          <FolderIcon size={14} className="mr-2 text-yellow-500" />
        )}
        <span className="font-medium truncate">{node.name}</span>
      </div>
      {node.isOpen &&
        node.children?.map((child) => (
          <FileTree
            key={child.id}
            node={child}
            depth={depth + 1}
            onToggleFolder={onToggleFolder}
            onSelectFile={onSelectFile}
            selectedFileId={selectedFileId}
          />
        ))}
    </div>
  );
};

interface SidebarProps {
  width: number;
}

const Sidebar: React.FC<SidebarProps> = ({ width }) => {
  const navigate = useNavigate();
  const { activeView, isWorkspaceShell } = useRouteContext();

  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const switchWorkspace = useWorkspaceStore((s) => s.switchWorkspace);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const projects = useWorkspaceStore((s) => s.projects);
  const members = useWorkspaceStore((s) => s.members);

  const files = useEditorStore((s) => s.files);
  const toggleFolder = useEditorStore((s) => s.toggleFolder);
  const selectFile = useEditorStore((s) => s.selectFile);
  const selectedFileId = useEditorStore((s) => {
    const activeTab = s.tabs.find((t) => t.id === s.editorActiveTabId);
    return activeTab?.fileId || null;
  });

  const [isWsDropdownOpen, setIsWsDropdownOpen] = useState(false);
  const [wsSearch, setWsSearch] = useState('');
  const [isCreateWsOpen, setIsCreateWsOpen] = useState(false);
  const wsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        wsDropdownRef.current &&
        !wsDropdownRef.current.contains(e.target as Node)
      ) {
        setIsWsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  const workspaceProjectsCount = projects.filter(
    (p) => p.workspaceId === activeWorkspace?.id
  ).length;
  const workspaceMembersCount = members.filter(
    (m) => m.workspaceId === activeWorkspace?.id
  ).length;

  const filteredWorkspaces = workspaces.filter((w) =>
    w.name.toLowerCase().includes(wsSearch.toLowerCase())
  );

  // NocoDB Pure Workspace Navigation Mode
  if (isWorkspaceShell) {
    const navItems: {
      id: ViewMode;
      label: string;
      path: string;
      icon: React.ReactNode;
      count?: number;
    }[] = [
      {
        id: ViewMode.HOME,
        label: '首页',
        path: '/home',
        icon: <Home size={16} strokeWidth={1.5} />,
      },
      {
        id: ViewMode.PROJECTS,
        label: '项目',
        path: '/',
        icon: <ProjectLayersOutlineIcon className="w-4 h-4" />,
        count: workspaceProjectsCount,
      },
      {
        id: ViewMode.MEMBERS,
        label: '成员和团队',
        path: '/members',
        icon: <Users size={16} strokeWidth={1.5} />,
        count: workspaceMembersCount,
      },
      {
        id: ViewMode.WORKSPACE_SETTINGS,
        label: '设置',
        path: '/settings',
        icon: <Settings size={16} strokeWidth={1.5} />,
      },
    ];

    return (
      <>
        <aside
          style={{ width }}
          className="flex flex-col bg-background h-full shrink-0 border-r border-border select-none relative z-30"
        >
          {/* Top Workspace Switcher (h-14) */}
          <div
            ref={wsDropdownRef}
            className="relative h-14 px-2 flex items-center flex-none border-b border-border"
          >
            <button
              type="button"
              onClick={() => setIsWsDropdownOpen((v) => !v)}
              data-testid="nc-ws-sidebar-selector"
              className="flex flex-1 items-center gap-2.5 pl-1.5 pr-2 py-1 rounded-lg cursor-pointer min-w-0 transition-colors hover:bg-muted/80 text-left"
            >
              <WorkspaceLogoIcon className="w-7 h-7" />
              <div className="flex-1 min-w-0">
                <div className="truncate text-[14px] leading-5 font-semibold text-foreground">
                  {activeWorkspace?.name || '个人空间'}
                </div>
              </div>
              <ChevronsUpDown
                size={14}
                className="flex-none text-muted-foreground"
              />
            </button>

            {isWsDropdownOpen && (
              <div className="absolute top-13 left-2 right-2 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl z-[70] p-1.5">
                <div className="relative mb-1.5">
                  <Search
                    size={13}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    type="text"
                    value={wsSearch}
                    onChange={(e) => setWsSearch(e.target.value)}
                    placeholder="搜索工作区..."
                    className="w-full h-8 pl-8 pr-2 text-xs rounded-md border border-border bg-muted/40 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    autoFocus
                  />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  {filteredWorkspaces.map((ws) => {
                    const isSelected = ws.id === activeWorkspace?.id;
                    return (
                      <button
                        key={ws.id}
                        type="button"
                        onClick={() => {
                          switchWorkspace(ws.id);
                          setIsWsDropdownOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left text-[13px] transition-colors ${
                          isSelected
                            ? 'bg-accent text-accent-foreground font-medium'
                            : 'text-foreground hover:bg-muted'
                        }`}
                      >
                        <div
                          className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[11px] font-semibold shrink-0"
                          style={{ backgroundColor: ws.color }}
                        >
                          {ws.name.slice(0, 1)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{ws.name}</div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {ws.plan}
                          </div>
                        </div>
                        {isSelected && <Check size={14} className="text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                <div className="border-t border-border mt-1.5 pt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsWsDropdownOpen(false);
                      setIsCreateWsOpen(true);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] text-foreground hover:bg-muted transition-colors"
                  >
                    <Plus size={14} className="text-muted-foreground" />
                    <span>新建工作区</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Middle Workspace Navigation */}
          <div className="flex-1 flex flex-col overflow-hidden pt-2">
            <div className="px-4 py-1.5 text-[12px] leading-4 font-semibold text-muted-foreground">
              工作区
            </div>
            <nav className="flex-1 overflow-y-auto px-2 space-y-1">
              {navItems.map((item) => {
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.path)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`w-full h-8 px-2.5 rounded-lg flex items-center gap-2.5 text-[14px] leading-5 transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-primary/[0.08] dark:bg-primary/15 text-foreground font-semibold'
                        : 'text-foreground font-medium hover:bg-muted/70'
                    }`}
                  >
                    <span
                      className={`flex-none ${
                        isActive ? 'text-foreground' : 'text-foreground/85'
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span className="flex-1 text-left truncate">{item.label}</span>
                    {typeof item.count === 'number' && (
                      <span className="text-[12px] leading-4 tabular-nums font-medium text-muted-foreground mr-1">
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom User Info & Notification */}
          <UserAvatarMenu />
        </aside>

        <CreateWorkspaceDialog
          isOpen={isCreateWsOpen}
          onClose={() => setIsCreateWsOpen(false)}
          onCreate={(name) => createWorkspace(name)}
        />
      </>
    );
  }

  // Context Panel Mode (Inside Project / App / Datasource / Files)
  const renderContextContent = () => {
    switch (activeView) {
      case ViewMode.APPS:
        return <PagesPanel />;
      case ViewMode.DATA:
        return <TablePanel />;
      case ViewMode.DATASOURCE:
        return <DataSourcePanel />;
      case ViewMode.SETTINGS:
      default:
        return (
          <div className="flex flex-col h-full">
            <div className="h-10 px-4 border-b border-border flex items-center shrink-0 bg-background">
              <span className="font-semibold text-[13px] text-foreground">
                文件资源管理器
              </span>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {files.map((node) => (
                <FileTree
                  key={node.id}
                  node={node}
                  depth={0}
                  onToggleFolder={toggleFolder}
                  onSelectFile={selectFile}
                  selectedFileId={selectedFileId}
                />
              ))}
            </div>
          </div>
        );
    }
  };

  return (
    <aside
      style={{ width }}
      className="flex flex-col bg-background h-full shrink-0 border-r border-border relative z-30 overflow-visible"
    >
      {/* Back to Workspace Header (h-14) */}
      <div className="h-14 px-2 flex items-center justify-between gap-2 border-b border-border flex-none">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[14px] font-semibold text-foreground hover:bg-muted transition-colors min-w-0 flex-1"
        >
          <ArrowLeft size={15} className="text-muted-foreground shrink-0" />
          <span className="truncate">返回工作区</span>
        </button>
        <WorkspaceLogoIcon className="w-6 h-6 mr-1 shrink-0" />
      </div>

      {/* Sub-navigation tabs for Project Data / Datasources / Files (since ActivityBar is removed) */}
      {activeView !== ViewMode.APPS && (
        <div className="px-2 py-2 border-b border-border bg-muted/20 flex items-center gap-1 flex-none">
          <button
            type="button"
            onClick={() => navigate('/data')}
            className={`flex-1 h-7 rounded-md text-[13px] font-medium flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
              activeView === ViewMode.DATA
                ? 'bg-background text-foreground font-semibold shadow-xs border border-border'
                : 'text-foreground/75 hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <Table size={12} /> 数据表
          </button>
          <button
            type="button"
            onClick={() => navigate('/datasources')}
            className={`flex-1 h-7 rounded-md text-[13px] font-medium flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
              activeView === ViewMode.DATASOURCE
                ? 'bg-background text-foreground font-semibold shadow-xs border border-border'
                : 'text-foreground/75 hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <Database size={12} /> 数据源
          </button>
          <button
            type="button"
            onClick={() => navigate('/files')}
            className={`flex-1 h-7 rounded-md text-[13px] font-medium flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
              activeView === ViewMode.SETTINGS
                ? 'bg-background text-foreground font-semibold shadow-xs border border-border'
                : 'text-foreground/75 hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <Code2 size={12} /> 文件
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {renderContextContent()}
      </div>

      <UserAvatarMenu />
    </aside>
  );
};

export default Sidebar;