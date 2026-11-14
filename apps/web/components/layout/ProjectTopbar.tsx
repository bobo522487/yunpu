import React, { useState } from 'react';
import {
  Compass,
  Database,
  Eye,
  File,
  Filter,
  LayoutGrid,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Settings,
  Table,
  TableIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Dropdown from '../common/Dropdown';
import { Button } from '../ui/button';
import { ProjectColoredIcon } from '../common/NocoIcons';
import { CreateTableDrawer } from '../../features/data-modeler/components/CreateTableDrawer';
import { SchemaField, ViewMode } from '../../types';
import { useRouteContext } from '../../hooks/useRouteContext';
import { usePreferencesStore } from '../../store/usePreferencesStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { useDataStore } from '../../store/useDataStore';
import { useBuilderStore } from '../../store/useBuilderStore';

const ProjectTopbar: React.FC = () => {
  const navigate = useNavigate();
  const { activeView, activeProjectId, appId, activePageId, activeTableId } =
    useRouteContext();

  const isCollapsed = usePreferencesStore((s) => s.isProjectSidebarCollapsed);
  const setCollapsed = usePreferencesStore((s) => s.setProjectSidebarCollapsed);

  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const projects = useWorkspaceStore((s) => s.projects);
  const apps = useWorkspaceStore((s) => s.apps);
  const setActiveProjectId = useWorkspaceStore((s) => s.setActiveProjectId);

  const tables = useDataStore((s) => s.tables);
  const views = useDataStore((s) => s.views);
  const schemas = useDataStore((s) => s.schemas);
  const activeViewId = useDataStore((s) => s.activeViewId);
  const setActiveViewId = useDataStore((s) => s.setActiveViewId);
  const dataViewMode = useDataStore((s) => s.dataViewMode);
  const setDataViewMode = useDataStore((s) => s.setDataViewMode);
  const addTable = useDataStore((s) => s.addTable);

  const pages = useBuilderStore((s) => s.pages);

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreateTableOpen, setIsCreateTableOpen] = useState(false);

  const workspaceProjects = projects.filter(
    (p) => p.workspaceId === activeWorkspaceId
  );
  const activeProject =
    projects.find((p) => p.id === activeProjectId) ||
    workspaceProjects[0] ||
    projects[0];

  const projectTables = tables.filter(
    (t) => !t.projectId || t.projectId === activeProjectId
  );
  const activeTableItem = tables.find((t) => t.id === activeTableId);
  const activeViewItem = views.find((v) => v.id === activeViewId);
  const currentTableViews = views
    .filter((v) => v.tableId === activeTableId)
    .map((v) => ({
      id: v.id,
      label: v.name,
      group: v.isDefault ? '默认视图' : '自定义视图',
      icon: Filter,
    }));

  const projectItems = workspaceProjects.map((p) => ({
    id: p.id,
    label: p.name,
    group: '工作区项目',
    avatar: <ProjectColoredIcon colorTheme={p.colorTheme} className="w-4 h-4" />,
  }));

  const tableItems = projectTables.map((t) => ({
    id: t.id,
    label: t.name,
    group: t.kind === 'view' ? '视图' : '数据表',
    icon: t.kind === 'view' ? Eye : Table,
  }));

  const workspaceApps = apps
    .filter((a) => a.workspaceId === activeWorkspaceId)
    .map((a) => ({
      id: a.id,
      label: a.name,
      group: '应用',
      icon: LayoutGrid,
      defaultPageId: a.defaultPageId,
    }));
  const currentApp =
    apps.find((a) => a.id === appId) ||
    apps.find((a) => a.workspaceId === activeWorkspaceId) ||
    apps[0];
  const activePage = pages.find((p) => p.id === activePageId);
  const pageItems = pages
    .filter((p) => p.type === 'page')
    .map((p) => ({
      id: p.id,
      label: p.name,
      group: '页面',
      icon: File,
    }));

  const Separator = () => (
    <span className="text-muted-foreground/45 mx-1 text-[15px] font-light select-none">
      /
    </span>
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 450);
  };

  const handleConfirmCreateTable = (tableName: string, columns: SchemaField[]) => {
    const newId = `table_${Date.now()}`;
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

  return (
    <>
      <header
        data-testid="nc-table-topbar"
        className="h-12 w-full border-b border-border bg-background flex items-center justify-between gap-3 px-3 shrink-0 z-20"
      >
        {/* Left: Sidebar Expand Toggle (when collapsed) + Project Breadcrumb */}
        <div className="flex items-center gap-1 min-w-0 flex-1 overflow-x-auto no-scrollbar">
          {isCollapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              title="展开侧边栏"
              data-testid="nc-topbar-expand-sidebar"
              className="w-8 h-8 mr-1 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 cursor-pointer"
            >
              <PanelLeftOpen size={16} />
            </button>
          )}

          {/* Active Project Dropdown */}
          <Dropdown
            triggerLabel={activeProject?.name || '项目'}
            items={projectItems}
            selectedId={activeProject?.id}
            onSelect={(item) => {
              setActiveProjectId(item.id);
              navigate(`/projects/${item.id}`);
            }}
            searchPlaceholder="切换项目..."
            open={activeDropdown === 'project'}
            onOpenChange={(isOpen) => setActiveDropdown(isOpen ? 'project' : null)}
            width={230}
            footer={
              <div
                onClick={() => {
                  setActiveDropdown(null);
                  navigate(`/projects/${activeProjectId}`);
                }}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium text-foreground hover:bg-muted cursor-pointer"
              >
                <Compass size={13} className="text-primary" />
                <span>打开项目首页概览</span>
              </div>
            }
          />

          {activeView === ViewMode.PROJECT_HOME && (
            <>
              <Separator />
              <div className="flex items-center gap-1.5 px-1.5 py-1 text-[14px] font-semibold text-foreground whitespace-nowrap">
                <Compass size={14} className="text-primary" />
                <span>首页概览</span>
              </div>
            </>
          )}

          {activeView === ViewMode.DATA && (
            <>
              <Separator />
              <Dropdown
                triggerLabel={activeTableItem?.name || activeTableId || '选择数据表'}
                triggerIcon={activeTableItem?.kind === 'view' ? Eye : Table}
                items={tableItems}
                selectedId={activeTableId}
                onSelect={(item) =>
                  navigate(`/projects/${activeProjectId}/data/${item.id}`)
                }
                searchPlaceholder="查找数据表..."
                open={activeDropdown === 'table'}
                onOpenChange={(isOpen) => setActiveDropdown(isOpen ? 'table' : null)}
                footer={
                  <div
                    onClick={() => {
                      setActiveDropdown(null);
                      setIsCreateTableOpen(true);
                    }}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium text-primary hover:bg-primary/10 cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>新建数据表</span>
                  </div>
                }
              />

              {activeViewId && activeTableId && (
                <>
                  <Separator />
                  <Dropdown
                    triggerLabel={activeViewItem?.name || '视图'}
                    triggerIcon={Filter}
                    items={currentTableViews}
                    selectedId={activeViewId}
                    onSelect={(item) => setActiveViewId(item.id)}
                    searchPlaceholder="查找视图..."
                    open={activeDropdown === 'view'}
                    onOpenChange={(isOpen) => setActiveDropdown(isOpen ? 'view' : null)}
                    width={200}
                  />
                </>
              )}

              <button
                type="button"
                onClick={handleRefresh}
                title="刷新数据"
                className="w-7 h-7 ml-0.5 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 cursor-pointer"
              >
                <RefreshCw
                  size={13}
                  className={isRefreshing ? 'animate-spin text-primary' : ''}
                />
              </button>
            </>
          )}

          {activeView === ViewMode.APPS && (
            <>
              <Separator />
              <Dropdown
                triggerLabel={currentApp?.name || '应用'}
                triggerIcon={LayoutGrid}
                items={workspaceApps}
                selectedId={currentApp?.id}
                onSelect={(item) => {
                  const target = apps.find((a) => a.id === item.id);
                  navigate(
                    `/projects/${activeProjectId}/apps/${item.id}/pages/${
                      target?.defaultPageId || 'page-1'
                    }`
                  );
                }}
                searchPlaceholder="查找应用..."
                open={activeDropdown === 'app'}
                onOpenChange={(isOpen) => setActiveDropdown(isOpen ? 'app' : null)}
              />
              <Separator />
              <Dropdown
                triggerLabel={activePage?.name || '选择页面'}
                triggerIcon={File}
                items={pageItems}
                selectedId={activePageId}
                onSelect={(item) =>
                  navigate(`/projects/${activeProjectId}/apps/${appId}/pages/${item.id}`)
                }
                searchPlaceholder="查找页面..."
                open={activeDropdown === 'page'}
                onOpenChange={(isOpen) => setActiveDropdown(isOpen ? 'page' : null)}
              />
            </>
          )}

          {activeView === ViewMode.PROJECT_SETTINGS && (
            <>
              <Separator />
              <span className="inline-flex items-center gap-1.5 px-1.5 text-[14px] font-semibold text-foreground whitespace-nowrap">
                <Settings size={14} className="text-muted-foreground" />
                项目设置
              </span>
            </>
          )}

          {activeView === ViewMode.DATASOURCE && (
            <>
              <Separator />
              <span
                onClick={() => navigate(`/projects/${activeProjectId}/settings`)}
                className="text-[13px] font-medium text-muted-foreground hover:text-foreground cursor-pointer whitespace-nowrap px-1"
              >
                设置
              </span>
              <Separator />
              <span className="inline-flex items-center gap-1.5 px-1 text-[14px] font-semibold text-foreground whitespace-nowrap">
                <Database size={14} className="text-muted-foreground" />
                数据源管理
              </span>
            </>
          )}

          {activeView === ViewMode.SETTINGS && (
            <>
              <Separator />
              <span
                onClick={() => navigate(`/projects/${activeProjectId}/settings`)}
                className="text-[13px] font-medium text-muted-foreground hover:text-foreground cursor-pointer whitespace-nowrap px-1"
              >
                设置
              </span>
              <Separator />
              <span className="text-[14px] font-semibold text-foreground whitespace-nowrap px-1">
                代码文件
              </span>
            </>
          )}
        </div>

        {/* Right: Single-line contextual actions */}
        <div className="flex items-center gap-2 shrink-0">
          {activeView === ViewMode.DATA && activeTableId && (
            <div className="flex bg-[hsl(var(--surface-subtle))] p-0.5 rounded-lg border border-border">
              <Button
                variant={dataViewMode === 'DATA' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setDataViewMode('DATA')}
                className="h-7 text-[12px] font-medium gap-1.5 px-2.5 whitespace-nowrap shrink-0"
              >
                <TableIcon size={12} /> 数据
              </Button>
              <Button
                variant={dataViewMode === 'MODEL' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setDataViewMode('MODEL')}
                className="h-7 text-[12px] font-medium gap-1.5 px-2.5 whitespace-nowrap shrink-0"
              >
                <Database size={12} /> 模型
              </Button>
            </div>
          )}

          {activeView === ViewMode.PROJECT_HOME && (
            <Button
              size="sm"
              onClick={() => setIsCreateTableOpen(true)}
              className="h-8 gap-1.5 px-3 text-[13px] font-medium whitespace-nowrap shrink-0"
            >
              <Plus size={14} /> 新建数据表
            </Button>
          )}
        </div>
      </header>

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

export default ProjectTopbar;
