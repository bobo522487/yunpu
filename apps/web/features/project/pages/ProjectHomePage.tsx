import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Database,
  Filter,
  LayoutGrid,
  Plus,
  Search,
  Settings,
  Table,
  Columns,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ProjectColoredIcon } from '../../../components/common/NocoIcons';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { CreateTableDrawer } from '../../data-modeler/components/CreateTableDrawer';
import { SchemaField } from '../../../types';
import { useRouteContext } from '../../../hooks/useRouteContext';
import { usePreferencesStore } from '../../../store/usePreferencesStore';
import {
  ASSET_COLOR_PALETTES,
  useWorkspaceStore,
} from '../../../store/useWorkspaceStore';
import { useDataStore } from '../../../store/useDataStore';

const ProjectHomePage: React.FC = () => {
  const navigate = useNavigate();
  const { activeProjectId } = useRouteContext();

  const isDarkMode = usePreferencesStore((s) => s.isDarkMode);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const projects = useWorkspaceStore((s) => s.projects);
  const apps = useWorkspaceStore((s) => s.apps);

  const tables = useDataStore((s) => s.tables);
  const views = useDataStore((s) => s.views);
  const schemas = useDataStore((s) => s.schemas);
  const records = useDataStore((s) => s.records);
  const addTable = useDataStore((s) => s.addTable);
  const setDataViewMode = useDataStore((s) => s.setDataViewMode);
  const setActiveViewId = useDataStore((s) => s.setActiveViewId);

  const [tableSearch, setTableSearch] = useState('');
  const [isCreateTableOpen, setIsCreateTableOpen] = useState(false);

  const activeProject =
    projects.find((p) => p.id === activeProjectId) ||
    projects.find((p) => p.workspaceId === activeWorkspaceId) ||
    projects[0];

  const palette =
    ASSET_COLOR_PALETTES[activeProject?.colorTheme || 'sky'] ||
    ASSET_COLOR_PALETTES.sky;

  const projectTables = useMemo(
    () =>
      tables.filter(
        (t) => !t.projectId || t.projectId === activeProjectId
      ),
    [tables, activeProjectId]
  );

  const filteredTables = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    if (!q) return projectTables;
    return projectTables.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
    );
  }, [projectTables, tableSearch]);

  const workspaceApps = apps.filter(
    (a) => a.workspaceId === (activeProject?.workspaceId || activeWorkspaceId)
  );

  const stats = useMemo(() => {
    const tableIds = new Set(projectTables.map((t) => t.id));
    const totalViews = views.filter((v) => tableIds.has(v.tableId)).length;
    const totalRecords = projectTables.reduce(
      (sum, t) => sum + (records[t.id]?.length || 0),
      0
    );
    return {
      tablesCount: projectTables.length,
      viewsCount: totalViews,
      recordsCount: totalRecords,
      appsCount: workspaceApps.length,
    };
  }, [projectTables, views, records, workspaceApps.length]);

  const handleOpenTable = (tableId: string, mode: 'DATA' | 'MODEL' = 'DATA') => {
    const defaultView =
      views.find((v) => v.tableId === tableId && v.isDefault) ||
      views.find((v) => v.tableId === tableId);
    setActiveViewId(defaultView?.id || null);
    setDataViewMode(mode);
    navigate(`/projects/${activeProjectId}/data/${tableId}`);
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

  const firstApp = workspaceApps[0] || apps[0];

  return (
    <>
      <div className="flex-1 h-full overflow-y-auto bg-background">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-7 space-y-7">
          {/* Project Identity Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
            <div className="flex items-center gap-4 min-w-0">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border border-black/[0.04] dark:border-white/[0.06]"
                style={{
                  backgroundColor: isDarkMode
                    ? palette.darkTileBg
                    : palette.tileBg,
                }}
              >
                <ProjectColoredIcon
                  colorTheme={activeProject?.colorTheme || 'sky'}
                  className="w-6 h-6"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <h1 className="text-[20px] font-semibold text-foreground truncate tracking-tight">
                    {activeProject?.name || '项目概览'}
                  </h1>
                  <span className="text-[12px] font-medium text-muted-foreground tabular-nums whitespace-nowrap">
                    更新于 {activeProject?.updatedAt || '刚刚'}
                  </span>
                </div>
                <p className="text-[13px] text-muted-foreground mt-0.5 truncate">
                  {activeProject?.description ||
                    '管理当前项目的数据表结构、视图筛选与业务模型。'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  navigate(`/projects/${activeProjectId}/datasources`)
                }
                className="h-8 gap-1.5 text-[13px] font-medium whitespace-nowrap shrink-0"
              >
                <Database size={14} /> 管理数据源
              </Button>
              <Button
                size="sm"
                onClick={() => setIsCreateTableOpen(true)}
                className="h-8 gap-1.5 text-[13px] font-medium whitespace-nowrap shrink-0"
              >
                <Plus size={14} /> 新建数据表
              </Button>
            </div>
          </div>

          {/* 4-Column Flat Metrics Grid (Single-Elevation, Tabular Numerals) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 border border-border rounded-xl bg-card divide-y lg:divide-y-0 lg:divide-x divide-border overflow-hidden">
            <div className="p-4 flex flex-col gap-1">
              <span className="text-[12px] font-medium text-muted-foreground">
                数据表
              </span>
              <span className="text-[22px] font-semibold text-foreground tabular-nums leading-tight">
                {stats.tablesCount}
              </span>
            </div>
            <div className="p-4 flex flex-col gap-1">
              <span className="text-[12px] font-medium text-muted-foreground">
                视图总数
              </span>
              <span className="text-[22px] font-semibold text-foreground tabular-nums leading-tight">
                {stats.viewsCount}
              </span>
            </div>
            <div className="p-4 flex flex-col gap-1">
              <span className="text-[12px] font-medium text-muted-foreground">
                数据记录
              </span>
              <span className="text-[22px] font-semibold text-foreground tabular-nums leading-tight">
                {stats.recordsCount}
              </span>
            </div>
            <div className="p-4 flex flex-col gap-1">
              <span className="text-[12px] font-medium text-muted-foreground">
                工作区应用
              </span>
              <span className="text-[22px] font-semibold text-foreground tabular-nums leading-tight">
                {stats.appsCount}
              </span>
            </div>
          </div>

          {/* Data Tables Directory */}
          <section className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-semibold text-foreground">
                  项目数据表
                </h2>
                <span className="text-[12px] font-medium text-muted-foreground tabular-nums">
                  ({filteredTables.length})
                </span>
              </div>

              {projectTables.length > 0 && (
                <div className="relative w-full sm:w-64">
                  <Search
                    size={14}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                  />
                  <Input
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    placeholder="筛选数据表..."
                    className="h-8 pl-8 text-[13px]"
                  />
                </div>
              )}
            </div>

            {filteredTables.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card/50 py-12 px-6 text-center space-y-3">
                <div className="w-10 h-10 rounded-lg bg-muted mx-auto flex items-center justify-center text-muted-foreground">
                  <Table size={18} />
                </div>
                <div className="space-y-1">
                  <div className="text-[14px] font-semibold text-foreground">
                    {tableSearch ? '未找到匹配的数据表' : '当前项目还没有数据表'}
                  </div>
                  <p className="text-[13px] text-muted-foreground max-w-md mx-auto">
                    {tableSearch
                      ? '尝试调整筛选关键字，或清空搜索条件。'
                      : '创建首张数据表后，即可在网格中录入记录、配置视图筛选或建立外键关联。'}
                  </p>
                </div>
                {!tableSearch && (
                  <Button
                    size="sm"
                    onClick={() => setIsCreateTableOpen(true)}
                    className="h-8 gap-1.5 text-[13px] whitespace-nowrap"
                  >
                    <Plus size={14} /> 新建首张数据表
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
                {filteredTables.map((table) => {
                  const colCount = (schemas[table.id] || []).length;
                  const rowCount = (records[table.id] || []).length;
                  const viewCount = views.filter(
                    (v) => v.tableId === table.id
                  ).length;

                  return (
                    <div
                      key={table.id}
                      onClick={() => handleOpenTable(table.id, 'DATA')}
                      className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 hover:bg-[hsl(var(--surface-hover))] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg border border-border bg-background flex items-center justify-center text-primary shrink-0">
                          <Table size={15} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[14px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                              {table.name}
                            </span>
                            <span className="text-[12px] font-mono text-muted-foreground truncate">
                              {table.code}
                            </span>
                          </div>
                          {table.description && (
                            <p className="text-[12px] text-muted-foreground truncate mt-0.5">
                              {table.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 sm:gap-5 shrink-0 justify-between sm:justify-end">
                        <div className="flex items-center gap-4 text-[12px] font-medium text-muted-foreground tabular-nums">
                          <span className="inline-flex items-center gap-1 whitespace-nowrap">
                            <Columns size={12} /> {colCount} 字段
                          </span>
                          <span className="inline-flex items-center gap-1 whitespace-nowrap">
                            <Filter size={12} /> {viewCount} 视图
                          </span>
                          <span className="whitespace-nowrap">
                            {rowCount} 行
                          </span>
                        </div>

                        <div
                          className="flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenTable(table.id, 'MODEL')}
                            className="h-7 px-2.5 text-[12px] font-medium whitespace-nowrap"
                          >
                            模型
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenTable(table.id, 'DATA')}
                            className="h-7 px-2.5 text-[12px] font-medium gap-1 whitespace-nowrap"
                          >
                            打开 <ArrowRight size={12} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Quick Jump Row */}
          <section className="space-y-3">
            <h2 className="text-[15px] font-semibold text-foreground">
              快捷入口
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() =>
                  navigate(`/projects/${activeProjectId}/datasources`)
                }
                className="flex items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card hover:border-[hsl(var(--border-strong))] transition-colors text-left cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-[hsl(var(--surface-subtle))] border border-border flex items-center justify-center text-foreground shrink-0">
                    <Database size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-foreground truncate">
                      配置外部数据源
                    </div>
                    <div className="text-[12px] text-muted-foreground truncate">
                      PostgreSQL · MySQL · REST API
                    </div>
                  </div>
                </div>
                <ArrowRight
                  size={14}
                  className="text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0"
                />
              </button>

              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/projects/${activeProjectId}/apps/${
                      firstApp?.id || 'app-order-mgmt'
                    }/pages/${firstApp?.defaultPageId || 'page-1'}`
                  )
                }
                className="flex items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card hover:border-[hsl(var(--border-strong))] transition-colors text-left cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-[hsl(var(--surface-subtle))] border border-border flex items-center justify-center text-foreground shrink-0">
                    <LayoutGrid size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-foreground truncate">
                      应用可视化构建
                    </div>
                    <div className="text-[12px] text-muted-foreground truncate">
                      拖拽组件搭建业务门户页面
                    </div>
                  </div>
                </div>
                <ArrowRight
                  size={14}
                  className="text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0"
                />
              </button>

              <button
                type="button"
                onClick={() =>
                  navigate(`/projects/${activeProjectId}/settings`)
                }
                className="flex items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card hover:border-[hsl(var(--border-strong))] transition-colors text-left cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-[hsl(var(--surface-subtle))] border border-border flex items-center justify-center text-foreground shrink-0">
                    <Settings size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-foreground truncate">
                      项目设置与代码文件
                    </div>
                    <div className="text-[12px] text-muted-foreground truncate">
                      调整名称、图标配色与默认视图
                    </div>
                  </div>
                </div>
                <ArrowRight
                  size={14}
                  className="text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0"
                />
              </button>
            </div>
          </section>
        </div>
      </div>

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

export default ProjectHomePage;
