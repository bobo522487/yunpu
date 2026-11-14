import React, { useState, useRef, useEffect } from 'react';
import {
  Check,
  ChevronsLeft,
  ChevronsUpDown,
  Code2,
  Copy,
  Database,
  File as FileIcon,
  Folder as FolderIcon,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  Plus,
  PlusCircle,
  Search,
  Settings,
  Sliders,
  Table,
  Filter,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FileSystemNode, FileType, SchemaField, ViewMode } from '../../types';
import { ProjectColoredIcon } from '../common/NocoIcons';
import TablePanel from '../../features/data-modeler/components/TablePanel';
import PagesPanel from '../../features/app-builder/components/PagesPanel';
import DataSourcePanel from '../../features/datasource/components/DataSourcePanel';
import { CreateTableDrawer } from '../../features/data-modeler/components/CreateTableDrawer';
import { useCommandPalette } from './CommandPaletteModal';
import { useRouteContext } from '../../hooks/useRouteContext';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { useDataStore } from '../../store/useDataStore';
import { useEditorStore } from '../../store/useEditorStore';
import { usePreferencesStore } from '../../store/usePreferencesStore';

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
        <FileIcon size={14} className="mr-2 text-blue-500 shrink-0" />
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
          <FolderOpen size={14} className="mr-2 text-yellow-500 shrink-0" />
        ) : (
          <FolderIcon size={14} className="mr-2 text-yellow-500 shrink-0" />
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

interface ProjectSidebarProps {
  width: number;
}

const ProjectSidebar: React.FC<ProjectSidebarProps> = ({ width }) => {
  const navigate = useNavigate();
  const { activeView, activeProjectId, activeTableId } = useRouteContext();
  const { openPalette } = useCommandPalette();

  const isCollapsed = usePreferencesStore((s) => s.isProjectSidebarCollapsed);
  const setCollapsed = usePreferencesStore((s) => s.setProjectSidebarCollapsed);

  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const projects = useWorkspaceStore((s) => s.projects);
  const apps = useWorkspaceStore((s) => s.apps);
  const setActiveProjectId = useWorkspaceStore((s) => s.setActiveProjectId);
  const createProject = useWorkspaceStore((s) => s.createProject);
  const duplicateProject = useWorkspaceStore((s) => s.duplicateProject);

  const tables = useDataStore((s) => s.tables);
  const views = useDataStore((s) => s.views);
  const schemas = useDataStore((s) => s.schemas);
  const addTable = useDataStore((s) => s.addTable);
  const addView = useDataStore((s) => s.addView);

  const files = useEditorStore((s) => s.files);
  const toggleFolder = useEditorStore((s) => s.toggleFolder);
  const selectFile = useEditorStore((s) => s.selectFile);
  const selectedFileId = useEditorStore((s) => {
    const activeTab = s.tabs.find((t) => t.id === s.editorActiveTabId);
    return activeTab?.fileId || null;
  });

  const [isProjMenuOpen, setIsProjMenuOpen] = useState(false);
  const [projSearch, setProjSearch] = useState('');
  const [copiedId, setCopiedId] = useState(false);
  const [isNewMenuOpen, setIsNewMenuOpen] = useState(false);
  const [isCreateTableOpen, setIsCreateTableOpen] = useState(false);

  const projDropdownRef = useRef<HTMLDivElement>(null);
  const newMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        projDropdownRef.current &&
        !projDropdownRef.current.contains(e.target as Node)
      ) {
        setIsProjMenuOpen(false);
      }
      if (
        newMenuRef.current &&
        !newMenuRef.current.contains(e.target as Node)
      ) {
        setIsNewMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsProjMenuOpen(false);
        setIsNewMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  const workspaceProjects = projects.filter(
    (p) => p.workspaceId === activeWorkspaceId
  );
  const activeProject =
    projects.find((p) => p.id === activeProjectId) ||
    workspaceProjects[0] ||
    projects[0];

  const filteredProjects = workspaceProjects.filter((p) =>
    p.name.toLowerCase().includes(projSearch.toLowerCase())
  );

  const projectTables = tables.filter(
    (t) => !t.projectId || t.projectId === activeProjectId
  );

  if (isCollapsed) {
    return null;
  }

  const handleConfirmCreateTable = (tableName: string, columns: SchemaField[]) => {
    const timestamp = Date.now();
    const newId = `table_${timestamp}`;
    addTable(
      {
        id: newId,
        projectId: activeProjectId,
        name: tableName,
        code: tableName.toLowerCase().replace(/\s+/g, '_'),
        kind: 'table',
      },
      columns,
      []
    );
    navigate(`/projects/${activeProjectId}/data/${newId}`);
  };

  const handleCreateQuickView = () => {
    const targetTable =
      projectTables.find((t) => t.id === activeTableId) || projectTables[0];
    if (!targetTable) {
      setIsCreateTableOpen(true);
      return;
    }
    const count = views.filter((v) => v.tableId === targetTable.id).length;
    addView({
      id: `view_${Date.now()}`,
      tableId: targetTable.id,
      name: `视图 ${count + 1}`,
      config: { filters: [], sort: null, hiddenFields: [] },
    });
    navigate(`/projects/${activeProjectId}/data/${targetTable.id}`);
  };

  const handleOpenApps = () => {
    const firstApp =
      apps.find((a) => a.workspaceId === activeWorkspaceId) || apps[0];
    navigate(
      `/projects/${activeProjectId}/apps/${
        firstApp?.id || 'app-order-mgmt'
      }/pages/${firstApp?.defaultPageId || 'page-1'}`
    );
  };

  const isSettingsMode =
    activeView === ViewMode.PROJECT_SETTINGS ||
    activeView === ViewMode.DATASOURCE ||
    activeView === ViewMode.SETTINGS;

  return (
    <>
      <aside
        style={{ width }}
        data-testid="nc-sidebar"
        className="flex flex-col bg-background h-full shrink-0 border-r border-border select-none relative z-30"
      >
        {/* Project Header (h-12 matching ProjectTopbar) */}
        <div
          ref={projDropdownRef}
          data-testid="nc-sidebar-header"
          className="relative h-12 px-2 flex items-center justify-between gap-1 border-b border-border shrink-0"
        >
          <button
            type="button"
            onClick={() => setIsProjMenuOpen((v) => !v)}
            data-testid="nc-sidebar-project-selector"
            className="flex flex-1 items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-muted/80 transition-colors min-w-0 text-left cursor-pointer"
          >
            <ProjectColoredIcon
              colorTheme={activeProject?.colorTheme || 'sky'}
              className="w-5 h-5 shrink-0"
            />
            <span className="flex-1 truncate text-[14px] font-semibold text-foreground">
              {activeProject?.name || '项目'}
            </span>
            <ChevronsUpDown
              size={13}
              className="text-muted-foreground shrink-0"
            />
          </button>

          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => openPalette()}
              title="快速搜索 (Ctrl K)"
              className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <Search size={14} />
            </button>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              title="隐藏侧边栏"
              data-testid="nc-sidebar-collapse-btn"
              className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <ChevronsLeft size={15} />
            </button>
          </div>

          {/* Project Switcher & Context Menu Popover */}
          {isProjMenuOpen && (
            <div className="absolute top-12 left-2 right-2 rounded-xl border border-border bg-popover text-popover-foreground shadow-[var(--shadow-popover)] z-[75] p-1.5">
              {/* Active Project Identity + ID Copy */}
              <div className="px-2 py-1.5 mb-1 border-b border-border/70">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-foreground truncate">
                    {activeProject?.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(activeProject?.id || '');
                      setCopiedId(true);
                      setTimeout(() => setCopiedId(false), 1500);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded bg-muted/60"
                    title="复制项目 ID"
                  >
                    <span>ID</span>
                    {copiedId ? (
                      <Check size={11} className="text-emerald-500" />
                    ) : (
                      <Copy size={11} />
                    )}
                  </button>
                </div>
              </div>

              {/* Project Filter */}
              <div className="relative mb-1.5">
                <Search
                  size={12}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="text"
                  value={projSearch}
                  onChange={(e) => setProjSearch(e.target.value)}
                  placeholder="切换项目..."
                  className="w-full h-7.5 pl-7 pr-2 text-xs rounded-md border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                />
              </div>

              {/* Project List */}
              <div className="max-h-44 overflow-y-auto space-y-0.5">
                {filteredProjects.map((proj) => {
                  const isCurrent = proj.id === activeProject?.id;
                  return (
                    <button
                      key={proj.id}
                      type="button"
                      onClick={() => {
                        setIsProjMenuOpen(false);
                        setActiveProjectId(proj.id);
                        navigate(`/projects/${proj.id}`);
                      }}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-[13px] transition-colors ${
                        isCurrent
                          ? 'bg-accent text-accent-foreground font-semibold'
                          : 'text-foreground hover:bg-muted font-medium'
                      }`}
                    >
                      <ProjectColoredIcon
                        colorTheme={proj.colorTheme}
                        className="w-4 h-4 shrink-0"
                      />
                      <span className="flex-1 truncate">{proj.name}</span>
                      {isCurrent && <Check size={13} className="text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-border mt-1.5 pt-1.5 space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsProjMenuOpen(false);
                    navigate(`/projects/${activeProjectId}/settings`);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <Settings size={13} className="text-muted-foreground" />
                  <span>项目设置</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!activeProject) return;
                    const copy = duplicateProject(activeProject.id);
                    setIsProjMenuOpen(false);
                    if (copy) navigate(`/projects/${copy.id}`);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <Copy size={13} className="text-muted-foreground" />
                  <span>复制当前项目</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const created = createProject({
                      name: `新项目 ${workspaceProjects.length + 1}`,
                      colorTheme: 'indigo',
                    });
                    setIsProjMenuOpen(false);
                    navigate(`/projects/${created.id}`);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] font-medium text-primary hover:bg-primary/10 transition-colors"
                >
                  <Plus size={13} />
                  <span>新建项目</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Body Content based on Active Rail Panel */}
        {activeView === ViewMode.APPS ? (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <PagesPanel />
          </div>
        ) : isSettingsMode ? (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="px-2 py-2.5 space-y-0.5 border-b border-border shrink-0">
              <div className="px-2 pb-1 text-[12px] font-semibold text-muted-foreground">
                项目与开发配置
              </div>
              <button
                type="button"
                onClick={() => navigate(`/projects/${activeProjectId}/settings`)}
                className={`w-full h-8 px-2.5 rounded-lg flex items-center gap-2.5 text-[13px] transition-colors whitespace-nowrap ${
                  activeView === ViewMode.PROJECT_SETTINGS
                    ? 'bg-primary/[0.08] dark:bg-primary/15 text-foreground font-semibold'
                    : 'text-foreground/85 font-medium hover:bg-muted/70'
                }`}
              >
                <Sliders size={14} className="shrink-0" />
                <span>基本设置</span>
              </button>
              <button
                type="button"
                onClick={() => navigate(`/projects/${activeProjectId}/datasources`)}
                className={`w-full h-8 px-2.5 rounded-lg flex items-center gap-2.5 text-[13px] transition-colors whitespace-nowrap ${
                  activeView === ViewMode.DATASOURCE
                    ? 'bg-primary/[0.08] dark:bg-primary/15 text-foreground font-semibold'
                    : 'text-foreground/85 font-medium hover:bg-muted/70'
                }`}
              >
                <Database size={14} className="shrink-0" />
                <span>数据源管理</span>
              </button>
              <button
                type="button"
                onClick={() => navigate(`/projects/${activeProjectId}/files`)}
                className={`w-full h-8 px-2.5 rounded-lg flex items-center gap-2.5 text-[13px] transition-colors whitespace-nowrap ${
                  activeView === ViewMode.SETTINGS
                    ? 'bg-primary/[0.08] dark:bg-primary/15 text-foreground font-semibold'
                    : 'text-foreground/85 font-medium hover:bg-muted/70'
                }`}
              >
                <Code2 size={14} className="shrink-0" />
                <span>代码文件</span>
              </button>
            </div>

            {activeView === ViewMode.DATASOURCE ? (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <DataSourcePanel />
              </div>
            ) : activeView === ViewMode.SETTINGS ? (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <div className="px-4 py-2 text-[12px] font-semibold text-muted-foreground border-b border-border/60 shrink-0">
                  文件资源管理器
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
            ) : (
              <div className="p-3.5 text-[12px] text-muted-foreground leading-relaxed">
                在此可调整当前项目名称、主题色调、默认入口数据表，或快速进入数据源与代码编辑器。
              </div>
            )}
          </div>
        ) : (
          /* Data Panel (Create New + Table Tree) */
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Create New Quick Section */}
            <div className="px-2 pt-2.5 pb-2 shrink-0 border-b border-border/70">
              <div ref={newMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsNewMenuOpen((v) => !v)}
                  data-testid="nc-home-create-new-btn"
                  className="w-full h-8 px-2.5 rounded-lg flex items-center gap-2.5 text-[14px] font-medium text-foreground hover:bg-muted/70 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <PlusCircle size={16} className="text-primary shrink-0" />
                  <span>新建</span>
                </button>

                {isNewMenuOpen && (
                  <div className="absolute left-0 top-9 w-48 rounded-xl border border-border bg-popover text-popover-foreground shadow-[var(--shadow-popover)] z-[75] p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsNewMenuOpen(false);
                        setIsCreateTableOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] font-medium text-foreground hover:bg-muted transition-colors text-left"
                    >
                      <Table size={14} className="text-primary" />
                      <span>新建数据表</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsNewMenuOpen(false);
                        handleCreateQuickView();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] font-medium text-foreground hover:bg-muted transition-colors text-left"
                    >
                      <Filter size={14} className="text-muted-foreground" />
                      <span>新建视图</span>
                    </button>
                    <div className="h-px bg-border my-1" />
                    <button
                      type="button"
                      onClick={() => {
                        setIsNewMenuOpen(false);
                        navigate(`/projects/${activeProjectId}/datasources`);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] font-medium text-foreground hover:bg-muted transition-colors text-left"
                    >
                      <Database size={14} className="text-muted-foreground" />
                      <span>连接数据源</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsNewMenuOpen(false);
                        handleOpenApps();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] font-medium text-foreground hover:bg-muted transition-colors text-left"
                    >
                      <LayoutGrid size={14} className="text-muted-foreground" />
                      <span>前往应用设计</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Project Data Tables & Views Tree */}
            <TablePanel compactHeader />
          </div>
        )}
      </aside>

      <CreateTableDrawer
        isOpen={isCreateTableOpen}
        onClose={() => setIsCreateTableOpen(false)}
        onCreate={handleConfirmCreateTable}
        tables={tables}
        getTargetColumns={(tId) =>
          (schemas[tId] || []).map((f) => ({ id: f.id, name: f.name }))
        }
      />
    </>
  );
};

export default ProjectSidebar;
