import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  LayoutGrid,
  Plus,
  MoreVertical,
  ChevronDown,
  ListFilter,
  User,
  Users,
  Pencil,
  Copy,
  Trash2,
  ExternalLink,
  X,
  Check,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  AppColoredIcon,
  ProjectColoredIcon,
  ProjectLayersOutlineIcon,
} from '../../../components/common/NocoIcons';
import {
  ASSET_COLOR_PALETTES,
  useWorkspaceStore,
} from '../../../store/useWorkspaceStore';
import { usePreferencesStore } from '../../../store/usePreferencesStore';
import { useDataStore } from '../../../store/useDataStore';
import { useBuilderStore } from '../../../store/useBuilderStore';
import { AppItem, AssetColorTheme, ProjectItem } from '../../../types';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';

type AssetTab = 'all' | 'apps' | 'projects';
type OwnerFilter = 'all' | 'owned' | 'shared';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  const isDarkMode = usePreferencesStore((s) => s.isDarkMode);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const projects = useWorkspaceStore((s) => s.projects);
  const apps = useWorkspaceStore((s) => s.apps);
  const searchQuery = useWorkspaceStore((s) => s.searchQuery);
  const setActiveProjectId = useWorkspaceStore((s) => s.setActiveProjectId);
  const createProject = useWorkspaceStore((s) => s.createProject);
  const renameProject = useWorkspaceStore((s) => s.renameProject);
  const duplicateProject = useWorkspaceStore((s) => s.duplicateProject);
  const deleteProject = useWorkspaceStore((s) => s.deleteProject);
  const createApp = useWorkspaceStore((s) => s.createApp);
  const renameApp = useWorkspaceStore((s) => s.renameApp);
  const duplicateApp = useWorkspaceStore((s) => s.duplicateApp);
  const deleteApp = useWorkspaceStore((s) => s.deleteApp);

  const tables = useDataStore((s) => s.tables);
  const pages = useBuilderStore((s) => s.pages);

  const [activeTab, setActiveTab] = useState<AssetTab>('all');
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('all');
  const [isOwnerMenuOpen, setIsOwnerMenuOpen] = useState(false);
  const [openCardMenuId, setOpenCardMenuId] = useState<string | null>(null);

  // Create Modal state
  const [createModalKind, setCreateModalKind] = useState<'project' | 'app' | null>(null);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newColor, setNewColor] = useState<AssetColorTheme>('sky');

  // Rename Modal state
  const [renameTarget, setRenameTarget] = useState<{
    kind: 'project' | 'app';
    id: string;
    name: string;
  } | null>(null);

  const ownerMenuRef = useRef<HTMLDivElement>(null);
  const cardMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        ownerMenuRef.current &&
        !ownerMenuRef.current.contains(e.target as Node)
      ) {
        setIsOwnerMenuOpen(false);
      }
      if (
        cardMenuRef.current &&
        !cardMenuRef.current.contains(e.target as Node)
      ) {
        setOpenCardMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const wsProjects = projects.filter((p) => p.workspaceId === activeWorkspaceId);
  const wsApps = apps.filter((a) => a.workspaceId === activeWorkspaceId);

  const q = searchQuery.trim().toLowerCase();

  const matchesFilter = (item: { name: string; ownerType: 'owned' | 'shared' }) => {
    const matchesSearch = !q || item.name.toLowerCase().includes(q);
    const matchesOwner =
      ownerFilter === 'all' || item.ownerType === ownerFilter;
    return matchesSearch && matchesOwner;
  };

  const filteredProjects = wsProjects.filter(matchesFilter);
  const filteredApps = wsApps.filter(matchesFilter);

  const totalCount = wsProjects.length + wsApps.length;

  const ownerFilterLabels: Record<OwnerFilter, string> = {
    all: '所有项目',
    owned: '我拥有的',
    shared: '与我共享',
  };

  const handleOpenProject = (proj: ProjectItem) => {
    setActiveProjectId(proj.id);
    navigate(`/projects/${proj.id}`);
  };

  const handleOpenApp = (app: AppItem) => {
    const targetPage =
      pages.find((p) => p.id === app.defaultPageId && p.type === 'page')?.id ||
      pages.find((p) => p.type === 'page')?.id ||
      'page-1';
    navigate(`/apps/${app.id}/pages/${targetPage}`);
  };

  const openCreateModal = (kind: 'project' | 'app') => {
    setCreateModalKind(kind);
    setNewName('');
    setNewDesc('');
    setNewColor(kind === 'project' ? 'sky' : 'indigo');
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !createModalKind) return;

    if (createModalKind === 'project') {
      const created = createProject({
        name: newName,
        description: newDesc,
        colorTheme: newColor,
        defaultTableId: tables[0]?.id || 'users',
      });
      setCreateModalKind(null);
      handleOpenProject(created);
    } else {
      const firstPageId = pages.find((p) => p.type === 'page')?.id || 'page-1';
      const created = createApp({
        name: newName,
        description: newDesc,
        colorTheme: newColor,
        defaultPageId: firstPageId,
      });
      setCreateModalKind(null);
      handleOpenApp(created);
    }
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || !renameTarget.name.trim()) return;
    if (renameTarget.kind === 'project') {
      renameProject(renameTarget.id, renameTarget.name);
    } else {
      renameApp(renameTarget.id, renameTarget.name);
    }
    setRenameTarget(null);
  };

  const renderAssetCard = (
    kind: 'project' | 'app',
    item: ProjectItem | AppItem
  ) => {
    const palette =
      ASSET_COLOR_PALETTES[item.colorTheme] || ASSET_COLOR_PALETTES.sky;
    const tileStyle = {
      backgroundColor: isDarkMode ? palette.darkTileBg : palette.tileBg,
    };
    const isMenuOpen = openCardMenuId === item.id;

    return (
      <div
        key={item.id}
        role="button"
        tabIndex={0}
        onClick={() =>
          kind === 'project'
            ? handleOpenProject(item as ProjectItem)
            : handleOpenApp(item as AppItem)
        }
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (kind === 'project') {
              handleOpenProject(item as ProjectItem);
            } else {
              handleOpenApp(item as AppItem);
            }
          }
        }}
        data-testid={`nc-asset-card-${item.name}`}
        className="group relative flex items-center gap-3 p-0 overflow-visible rounded-xl cursor-pointer border border-border bg-card shadow-[var(--shadow-control)] hover:border-[hsl(var(--border-strong))] hover:shadow-[var(--shadow-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 transition-all duration-150 h-16"
      >
        {/* Left Pastel Tile */}
        <div
          className="self-stretch w-16 flex-none flex items-center justify-center rounded-l-[11px] border-r border-black/[0.04] dark:border-white/[0.06]"
          style={tileStyle}
        >
          {kind === 'project' ? (
            <ProjectColoredIcon colorTheme={item.colorTheme} className="w-6 h-6" />
          ) : (
            <AppColoredIcon colorTheme={item.colorTheme} className="w-6 h-6" />
          )}
        </div>

        {/* Middle Title & Subtitle */}
        <div className="flex-1 min-w-0 py-2.5 flex flex-col justify-center gap-0.5">
          <div className="min-w-0 truncate text-[14px] font-semibold text-foreground group-hover:text-primary transition-colors">
            {item.name}
          </div>
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground tabular-nums">
            <span className="whitespace-nowrap">
              {kind === 'project' ? '项目' : '应用'}
            </span>
            {item.updatedAt && (
              <>
                <span className="text-muted-foreground/50">·</span>
                <span className="truncate">{item.updatedAt}</span>
              </>
            )}
          </div>
        </div>

        {/* Right 3-Dot Action Menu */}
        <div
          className="relative pr-2.5 flex items-center"
          ref={isMenuOpen ? cardMenuRef : undefined}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpenCardMenuId(isMenuOpen ? null : item.id);
            }}
            className={`h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--surface-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-all duration-150 ${
              isMenuOpen
                ? 'opacity-100 bg-[hsl(var(--surface-hover))] text-foreground'
                : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
            }`}
            title="更多操作"
          >
            <MoreVertical size={15} />
          </button>

          {isMenuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-2 top-9 w-40 rounded-lg border border-border bg-popover text-popover-foreground shadow-[var(--shadow-popover)] z-50 p-1 animate-in fade-in zoom-in-95 duration-100"
            >
              <button
                type="button"
                onClick={() => {
                  setOpenCardMenuId(null);
                  if (kind === 'project') {
                    handleOpenProject(item as ProjectItem);
                  } else {
                    handleOpenApp(item as AppItem);
                  }
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] font-medium text-foreground hover:bg-muted transition-colors"
              >
                <ExternalLink size={13} className="text-muted-foreground" />
                <span>打开</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpenCardMenuId(null);
                  setRenameTarget({ kind, id: item.id, name: item.name });
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] font-medium text-foreground hover:bg-muted transition-colors"
              >
                <Pencil size={13} className="text-muted-foreground" />
                <span>重命名</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpenCardMenuId(null);
                  if (kind === 'project') {
                    duplicateProject(item.id);
                  } else {
                    duplicateApp(item.id);
                  }
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] font-medium text-foreground hover:bg-muted transition-colors"
              >
                <Copy size={13} className="text-muted-foreground" />
                <span>复制</span>
              </button>
              <div className="h-px bg-border my-1" />
              <button
                type="button"
                onClick={() => {
                  setOpenCardMenuId(null);
                  if (kind === 'project') {
                    deleteProject(item.id);
                  } else {
                    deleteApp(item.id);
                  }
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] font-medium text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 size={13} />
                <span>删除</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSectionGroup = (
    kind: 'project' | 'app',
    items: (ProjectItem | AppItem)[]
  ) => {
    const ownedItems = items.filter((i) => i.ownerType === 'owned');
    const sharedItems = items.filter((i) => i.ownerType === 'shared');

    return (
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3.5 text-[14px] font-semibold text-foreground">
          {kind === 'project' ? (
            <ProjectLayersOutlineIcon className="w-4 h-4 text-foreground/75" />
          ) : (
            <LayoutGrid size={16} className="text-foreground/75" />
          )}
          <span>{kind === 'project' ? '项目' : '应用'}</span>
        </div>

        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-8 px-4 text-center">
            <p className="text-[13px] font-medium text-muted-foreground mb-3">
              {q
                ? `未找到匹配 “${searchQuery}” 的${kind === 'project' ? '项目' : '应用'}`
                : `当前工作区暂无${kind === 'project' ? '项目' : '应用'}`}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-[13px] gap-1.5"
              onClick={() => openCreateModal(kind)}
            >
              <Plus size={13} />
              新建{kind === 'project' ? '项目' : '应用'}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {ownedItems.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3 text-[13px] font-medium text-foreground/75">
                  <User size={13} />
                  <span>我拥有的</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {ownedItems.map((item) => renderAssetCard(kind, item))}
                </div>
              </div>
            )}

            {sharedItems.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3 text-[13px] font-medium text-foreground/75">
                  <Users size={13} />
                  <span>与我共享</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {sharedItems.map((item) => renderAssetCard(kind, item))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      {/* Top Tabs & Action Bar */}
      <div className="w-full max-w-6xl mx-auto px-4 md:px-6 pt-3 flex-none">
        <div className="flex items-center justify-between gap-3 border-b border-border">
          {/* Tabs: 全部 / 应用 / 项目 (NocoDB underline tab bar) */}
          <div className="flex items-center gap-1 -mb-px" role="tablist">
            {[
              { id: 'all' as const, label: '全部', count: totalCount },
              { id: 'apps' as const, label: '应用', count: wsApps.length },
              { id: 'projects' as const, label: '项目', count: wsProjects.length },
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative h-10 px-3 rounded-t-md text-[14px] flex items-center gap-1.5 transition-colors duration-150 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                    active
                      ? 'text-foreground font-semibold after:absolute after:bottom-0 after:left-1.5 after:right-1.5 after:h-[2px] after:rounded-full after:bg-primary'
                      : 'text-foreground/75 font-medium hover:text-foreground hover:bg-[hsl(var(--surface-subtle))]'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[12px] font-medium tabular-nums ${
                      active ? 'text-foreground/80' : 'text-muted-foreground'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right Filter & Create Actions */}
          <div className="flex items-center gap-2 shrink-0 pb-2">
            <div ref={ownerMenuRef} className="relative">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsOwnerMenuOpen((v) => !v)}
                className="h-8 text-[13px] gap-1.5 font-medium px-2.5 whitespace-nowrap"
              >
                <ListFilter size={14} className="text-muted-foreground" />
                <span className="hidden sm:inline">
                  {ownerFilterLabels[ownerFilter]}
                </span>
                <ChevronDown size={13} className="text-muted-foreground" />
              </Button>

              {isOwnerMenuOpen && (
                <div className="absolute right-0 top-9 w-36 rounded-lg border border-border bg-popover shadow-[var(--shadow-popover)] z-40 p-1 animate-in fade-in zoom-in-95 duration-100">
                  {(['all', 'owned', 'shared'] as OwnerFilter[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setOwnerFilter(key);
                        setIsOwnerMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[13px] transition-colors ${
                        ownerFilter === key
                          ? 'bg-accent text-accent-foreground font-semibold'
                          : 'text-foreground font-medium hover:bg-[hsl(var(--surface-hover))]'
                      }`}
                    >
                      <span>{ownerFilterLabels[key]}</span>
                      {ownerFilter === key && <Check size={12} className="text-primary" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openCreateModal('app')}
              className="h-8 text-[13px] font-medium gap-1.5 whitespace-nowrap hidden sm:inline-flex"
            >
              <Plus size={14} />
              <span>新建应用</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => openCreateModal('project')}
              data-testid="nc-sidebar-create-project-btn"
              className="h-8 text-[13px] font-medium gap-1.5 whitespace-nowrap"
            >
              <Plus size={14} />
              <span>新建项目</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Scrollable Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="w-full max-w-6xl mx-auto px-4 md:px-6 py-5">
          {(activeTab === 'all' || activeTab === 'projects') &&
            renderSectionGroup('project', filteredProjects)}

          {(activeTab === 'all' || activeTab === 'apps') &&
            renderSectionGroup('app', filteredApps)}
        </div>
      </div>

      {/* Create Project / App Modal */}
      {createModalKind &&
        createPortal(
          <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-xs"
              onClick={() => setCreateModalKind(null)}
            />
            <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">
                  {createModalKind === 'project' ? '新建项目' : '新建应用'}
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full"
                  onClick={() => setCreateModalKind(null)}
                >
                  <X size={14} />
                </Button>
              </div>

              <form onSubmit={handleCreateSubmit} className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="asset-name">
                    {createModalKind === 'project' ? '项目名称' : '应用名称'}
                  </Label>
                  <Input
                    id="asset-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={
                      createModalKind === 'project'
                        ? '例如：订单与仓储项目'
                        : '例如：售后工单门户'
                    }
                    autoFocus
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="asset-desc">简介（可选）</Label>
                  <Input
                    id="asset-desc"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="简要描述用途..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>图标配色</Label>
                  <div className="flex items-center gap-2">
                    {(Object.keys(ASSET_COLOR_PALETTES) as AssetColorTheme[]).map(
                      (key) => {
                        const p = ASSET_COLOR_PALETTES[key];
                        const selected = newColor === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setNewColor(key)}
                            title={p.label}
                            className={`w-9 h-9 rounded-lg flex items-center justify-center border-2 transition-all ${
                              selected
                                ? 'border-primary scale-105'
                                : 'border-transparent hover:border-border'
                            }`}
                            style={{ backgroundColor: p.tileBg }}
                          >
                            {createModalKind === 'project' ? (
                              <ProjectColoredIcon
                                colorTheme={key}
                                className="w-4 h-4"
                              />
                            ) : (
                              <AppColoredIcon colorTheme={key} className="w-4 h-4" />
                            )}
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCreateModalKind(null)}
                  >
                    取消
                  </Button>
                  <Button type="submit" size="sm" disabled={!newName.trim()}>
                    立即创建
                  </Button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Rename Modal */}
      {renameTarget &&
        createPortal(
          <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-xs"
              onClick={() => setRenameTarget(null)}
            />
            <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">
                  重命名{renameTarget.kind === 'project' ? '项目' : '应用'}
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full"
                  onClick={() => setRenameTarget(null)}
                >
                  <X size={14} />
                </Button>
              </div>
              <form onSubmit={handleRenameSubmit} className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="rename-input">名称</Label>
                  <Input
                    id="rename-input"
                    value={renameTarget.name}
                    onChange={(e) =>
                      setRenameTarget({ ...renameTarget, name: e.target.value })
                    }
                    autoFocus
                    required
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setRenameTarget(null)}
                  >
                    取消
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!renameTarget.name.trim()}
                  >
                    保存
                  </Button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default DashboardPage;