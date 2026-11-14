import React, { useState } from 'react';
import {
  LayoutGrid,
  Database,
  Table,
  Plus,
  File,
  Eye,
  Filter,
  TableIcon,
  Server,
  Copy,
  Check,
  FolderKanban,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Dropdown, { DropdownItem } from './Dropdown';
import { Button } from '../ui/button';
import CreateWorkspaceDialog from '../../features/workspace/components/CreateWorkspaceDialog';
import { ViewMode } from '../../types';
import { useRouteContext } from '../../hooks/useRouteContext';
import { useBuilderStore } from '../../store/useBuilderStore';
import { useDataStore } from '../../store/useDataStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';

const Breadcrumb: React.FC = () => {
  const navigate = useNavigate();
  const { activeView, appId, activePageId, activeTableId, isWorkspaceShell } =
    useRouteContext();

  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const switchWorkspace = useWorkspaceStore((s) => s.switchWorkspace);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const apps = useWorkspaceStore((s) => s.apps);
  const members = useWorkspaceStore((s) => s.members);

  const pages = useBuilderStore((s) => s.pages);
  const tables = useDataStore((s) => s.tables);
  const views = useDataStore((s) => s.views);
  const activeViewId = useDataStore((s) => s.activeViewId);
  const setActiveViewId = useDataStore((s) => s.setActiveViewId);
  const dataViewMode = useDataStore((s) => s.dataViewMode);
  const setDataViewMode = useDataStore((s) => s.setDataViewMode);

  const [selectedSource, setSelectedSource] = useState({
    id: 'src-1',
    label: 'nocoapp-db',
  });
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  const workspaceMembersCount = members.filter(
    (m) => m.workspaceId === activeWorkspace?.id
  ).length;

  // In Workspace Shell mode (NocoDB style: 个人空间 / 项目)
  if (isWorkspaceShell) {
    const sectionLabelMap: Partial<Record<ViewMode, string>> = {
      [ViewMode.HOME]: '首页',
      [ViewMode.PROJECTS]: '项目',
      [ViewMode.MEMBERS]: '成员和团队',
      [ViewMode.WORKSPACE_SETTINGS]: '设置',
      [ViewMode.PROJECT_HOME]: '项目首页',
      [ViewMode.PROJECT_SETTINGS]: '项目设置',
      [ViewMode.APPS]: '应用',
      [ViewMode.DATA]: '数据表',
      [ViewMode.DATASOURCE]: '数据源',
      [ViewMode.SETTINGS]: '文件',
    };

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
        <span className="text-muted-foreground/70">/</span>
        <span className="font-semibold text-foreground truncate">
          {sectionLabelMap[activeView] || '项目'}
        </span>
      </div>
    );
  }

  const sources = [
    { id: 'src-1', label: 'nocoapp-db', group: '数据源', icon: Database },
    { id: 'src-2', label: 'production-analytics', group: '数据源', icon: Database },
  ];

  const workspaceApps = apps
    .filter((a) => a.workspaceId === activeWorkspace?.id)
    .map((a) => ({
      id: a.id,
      label: a.name,
      group: '应用',
      icon: LayoutGrid,
      defaultPageId: a.defaultPageId,
    }));

  const currentApp =
    apps.find((a) => a.id === appId) ||
    apps.find((a) => a.workspaceId === activeWorkspace?.id) ||
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

  const activeTableItem = tables.find((t) => t.id === activeTableId);
  const tableItems = tables.map((t) => ({
    id: t.id,
    label: t.name,
    group: t.kind === 'view' ? '视图' : '数据表',
    icon: t.kind === 'view' ? Eye : Table,
  }));

  const activeViewItem = views.find((v) => v.id === activeViewId);
  const currentTableViews = views
    .filter((v) => v.tableId === activeTableId)
    .map((v) => ({
      id: v.id,
      label: v.name,
      group: v.isDefault ? '默认视图' : '自定义视图',
      icon: Filter,
    }));

  const Separator = () => (
    <span className="text-muted-foreground/40 mx-1 text-base font-light">/</span>
  );

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
              navigate(`/apps/${item.id}/pages/${target?.defaultPageId || 'page-1'}`);
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
            onSelect={(item) => navigate(`/apps/${appId}/pages/${item.id}`)}
            searchPlaceholder="查找页面..."
            open={activeDropdown === 'page'}
            onOpenChange={(isOpen) => setActiveDropdown(isOpen ? 'page' : null)}
          />
        </>
      )}

      {activeView === ViewMode.DATA && (
        <>
          <Separator />
          <Dropdown
            triggerLabel={selectedSource.label}
            triggerIcon={Database}
            items={sources}
            selectedId={selectedSource.id}
            onSelect={(item) => setSelectedSource({ id: item.id, label: item.label })}
            searchPlaceholder="查找数据源..."
            open={activeDropdown === 'source'}
            onOpenChange={(isOpen) => setActiveDropdown(isOpen ? 'source' : null)}
            footer={
              <div
                className="relative flex select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-muted cursor-pointer w-full text-foreground gap-2 transition-colors"
                onClick={() => {
                  setActiveDropdown(null);
                  navigate('/datasources');
                }}
              >
                <Plus size={14} className="text-muted-foreground" />
                <span>新建数据源</span>
              </div>
            }
          />
          <Separator />
          <Dropdown
            triggerLabel={activeTableItem?.name || activeTableId || '选择数据表'}
            triggerIcon={activeTableItem?.kind === 'view' ? Eye : Table}
            items={tableItems}
            selectedId={activeTableId}
            onSelect={(item) => navigate(`/data/${item.id}`)}
            searchPlaceholder="查找数据表..."
            open={activeDropdown === 'table'}
            onOpenChange={(isOpen) => setActiveDropdown(isOpen ? 'table' : null)}
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

          {activeTableId && (
            <>
              <div className="h-4 w-px bg-border mx-2" />
              <div className="flex bg-muted/60 p-0.5 rounded-md border border-border/50">
                <Button
                  variant={dataViewMode === 'DATA' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setDataViewMode('DATA')}
                  className="h-6 text-xs gap-1.5 px-2 whitespace-nowrap"
                >
                  <TableIcon size={12} /> 数据
                </Button>
                <Button
                  variant={dataViewMode === 'MODEL' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setDataViewMode('MODEL')}
                  className="h-6 text-xs gap-1.5 px-2 whitespace-nowrap"
                >
                  <Database size={12} /> 模型
                </Button>
              </div>
            </>
          )}
        </>
      )}

      {activeView === ViewMode.DATASOURCE && (
        <>
          <Separator />
          <div className="flex items-center gap-1.5 text-foreground font-semibold px-1.5 py-1 rounded text-[14px]">
            <Server size={14} className="text-muted-foreground" />
            <span>数据源</span>
          </div>
          <Separator />
          <span className="text-muted-foreground font-medium text-[14px]">连接配置</span>
        </>
      )}

      {activeView === ViewMode.SETTINGS && (
        <>
          <Separator />
          <span className="font-semibold text-foreground text-[14px]">代码文件</span>
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
