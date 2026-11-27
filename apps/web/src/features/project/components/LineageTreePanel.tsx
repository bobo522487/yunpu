import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Folder, FolderOpen, FolderPlus, GitFork, Plus } from 'lucide-react';
import { Tree } from '../../../components/common/Tree/Tree';
import { type FlattenedItem, type TreeItem } from '../../../components/common/Tree/types';
import { findItemDeep } from '../../../components/common/Tree/utilities';
import { useActiveProject } from '../../../hooks/useActiveProject';
import { errorMessage } from '../../../lib/api';
import {
  findFirstChartId,
  type LineageChartMeta,
  useLineageStore,
} from '../../../store/useLineageStore';
import { directoryToTreeItems } from '../../lineage/adapter';
import {
  createFolderRequest,
  createLineageRequest,
  deleteFolderRequest,
  deleteLineageRequest,
  type FolderDto,
  type LineageDto,
  updateFolderRequest,
  updateLineageRequest,
} from '../../lineage/api';
import {
  invalidateLineageDirectory,
  invalidateLineageGraph,
  useLineageDirectoryQuery,
} from '../../lineage/queries';
import { parsePlaceText } from '../../place-input';
import { LineageEditorModal } from './LineageEditorModal';

interface LineageModalState {
  open: boolean;
  mode: 'create' | 'edit';
  parentId?: string;
  chartId?: string;
  version?: number;
  initialValue?: Partial<LineageChartMeta>;
}

const EMPTY_COLLAPSED: Record<string, boolean> = {};

function nextDefaultFolderName(existing: FolderDto[]): string {
  const taken = new Set(existing.map((f) => f.name));
  const base = '新建世系分组';
  if (!taken.has(base)) return base;
  let seq = 2;
  while (taken.has(`${base} ${seq}`)) {
    seq += 1;
  }
  return `${base} ${seq}`;
}

export const LineageTreePanel: React.FC = () => {
  const queryClient = useQueryClient();
  const {
    projectId: activeProjectId,
    project: activeProject,
    surname: projectSurname,
  } = useActiveProject();

  const selectedNodeIdByProject = useLineageStore(
    (s) => s.selectedNodeIdByProject,
  );
  const collapsedFolders = useLineageStore(
    (s) => s.collapsedFoldersByProject[activeProjectId] ?? EMPTY_COLLAPSED,
  );
  const selectNode = useLineageStore((s) => s.selectNode);
  const setFolderCollapsed = useLineageStore((s) => s.setFolderCollapsed);
  const setCollapsedFolders = useLineageStore((s) => s.setCollapsedFolders);

  const directoryQuery = useLineageDirectoryQuery(activeProjectId);

  const [modalState, setModalState] = useState<LineageModalState>({
    open: false,
    mode: 'create',
  });
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const folders = useMemo(
    () => directoryQuery.data?.folders ?? [],
    [directoryQuery.data],
  );
  const lineages = useMemo(
    () => directoryQuery.data?.lineages ?? [],
    [directoryQuery.data],
  );

  const folderById = useMemo(
    () => new Map<string, FolderDto>(folders.map((f) => [f.id, f])),
    [folders],
  );
  const lineageById = useMemo(
    () => new Map<string, LineageDto>(lineages.map((l) => [l.id, l])),
    [lineages],
  );

  const treeItems = useMemo(
    () => directoryToTreeItems(folders, lineages, collapsedFolders),
    [folders, lineages, collapsedFolders],
  );

  const activeNodeId =
    selectedNodeIdByProject[activeProjectId] ??
    (findFirstChartId(treeItems) || String(treeItems[0]?.id || ''));

  const handleSelect = (item: FlattenedItem) => {
    selectNode(activeProjectId, String(item.id));
  };

  const openCreateModal = (parentId?: string) => {
    setModalError(null);
    setModalState({
      open: true,
      mode: 'create',
      parentId,
      initialValue: {
        name: '',
        surname: projectSurname,
        hallName: activeProject?.hallName || '',
        progenitor: '',
        region: null,
      },
    });
  };

  const openEditModal = (chartId: string) => {
    const lin = lineageById.get(chartId);
    const node = findItemDeep(treeItems, chartId);
    if (!lin && !node) return;
    setModalError(null);
    setModalState({
      open: true,
      mode: 'edit',
      chartId,
      version: lin?.version,
      initialValue: {
        name: lin?.name ?? node?.data?.name ?? '',
        surname: lin?.surname ?? projectSurname,
        hallName: lin?.hallName ?? '',
        progenitor: lin?.progenitor ?? '',
        region: parsePlaceText(lin?.region ?? node?.data?.region) ?? null,
      },
    });
  };

  const handleAddGroup = async () => {
    if (!activeProjectId) return;
    setActionError(null);
    try {
      const { folder } = await createFolderRequest(activeProjectId, {
        name: nextDefaultFolderName(folders),
        seq: folders.length,
      });
      await invalidateLineageDirectory(queryClient, activeProjectId);
      selectNode(activeProjectId, folder.id);
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  const handleModalSubmit = async (values: LineageChartMeta) => {
    if (!activeProjectId) return;
    setModalSaving(true);
    setModalError(null);
    try {
      if (modalState.mode === 'create') {
        const created = await createLineageRequest(activeProjectId, {
          name: values.name,
          folderId: modalState.parentId ?? null,
          surname: values.surname?.trim() || undefined,
          hallName: values.hallName?.trim() || undefined,
          progenitor: values.progenitor?.trim() || undefined,
          region: values.region ?? null,
          seq: lineages.length,
        });
        await invalidateLineageDirectory(queryClient, activeProjectId);
        selectNode(activeProjectId, created.lineage.id);
      } else if (modalState.chartId) {
        const version =
          modalState.version ?? lineageById.get(modalState.chartId)?.version ?? 1;
        await updateLineageRequest(activeProjectId, modalState.chartId, {
          name: values.name,
          surname: values.surname?.trim() || null,
          hallName: values.hallName?.trim() || null,
          progenitor: values.progenitor?.trim() || null,
          region: values.region ?? null,
          version,
        });
        await Promise.all([
          invalidateLineageDirectory(queryClient, activeProjectId),
          invalidateLineageGraph(queryClient, activeProjectId, modalState.chartId),
        ]);
      }
      setModalState((prev) => ({ ...prev, open: false }));
    } catch (err) {
      setModalError(errorMessage(err));
    } finally {
      setModalSaving(false);
    }
  };

  const handleRenameNode = async (id: string, name: string) => {
    const clean = name.trim();
    if (!clean || !activeProjectId) return;
    setActionError(null);
    try {
      if (folderById.has(id)) {
        await updateFolderRequest(activeProjectId, id, { name: clean });
        await invalidateLineageDirectory(queryClient, activeProjectId);
        return;
      }
      const lin = lineageById.get(id);
      if (!lin) return;
      await updateLineageRequest(activeProjectId, id, {
        name: clean,
        version: lin.version,
      });
      await Promise.all([
        invalidateLineageDirectory(queryClient, activeProjectId),
        invalidateLineageGraph(queryClient, activeProjectId, id),
      ]);
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  const handleRemoveNode = async (id: string) => {
    if (!activeProjectId) return;
    setActionError(null);
    try {
      if (folderById.has(id)) {
        await deleteFolderRequest(activeProjectId, id);
      } else {
        await deleteLineageRequest(activeProjectId, id);
      }
      await invalidateLineageDirectory(queryClient, activeProjectId);
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  const handleTreeChange = async (nextItems: TreeItem[]) => {
    if (!activeProjectId) return;

    // 1. Check if only folder collapse state toggled
    const nextCollapsed: Record<string, boolean> = {};
    let collapseChanged = false;
    for (const item of nextItems) {
      if (item.type === 'folder') {
        const isCollapsed = Boolean(item.collapsed);
        nextCollapsed[String(item.id)] = isCollapsed;
        if (Boolean(collapsedFolders[String(item.id)]) !== isCollapsed) {
          collapseChanged = true;
        }
      }
    }
    if (collapseChanged) {
      setCollapsedFolders(activeProjectId, nextCollapsed);
    }

    // 2. Persist structural/seq changes to folders and lineages
    const updates: Promise<unknown>[] = [];
    nextItems.forEach((item, topIdx) => {
      const id = String(item.id);
      if (item.type === 'folder') {
        const folder = folderById.get(id);
        if (folder && folder.seq !== topIdx) {
          updates.push(updateFolderRequest(activeProjectId, id, { seq: topIdx }));
        }
        item.children.forEach((child, childIdx) => {
          const childId = String(child.id);
          const lin = lineageById.get(childId);
          if (lin && (lin.folderId !== id || lin.seq !== childIdx)) {
            updates.push(
              updateLineageRequest(activeProjectId, childId, {
                folderId: id,
                seq: childIdx,
                version: lin.version,
              }),
            );
          }
        });
      } else {
        const lin = lineageById.get(id);
        if (lin && (lin.folderId !== null || lin.seq !== topIdx)) {
          updates.push(
            updateLineageRequest(activeProjectId, id, {
              folderId: null,
              seq: topIdx,
              version: lin.version,
            }),
          );
        }
      }
    });

    if (updates.length > 0) {
      setActionError(null);
      try {
        await Promise.all(updates);
        await invalidateLineageDirectory(queryClient, activeProjectId);
      } catch (err) {
        setActionError(errorMessage(err));
        await invalidateLineageDirectory(queryClient, activeProjectId);
      }
    }
  };

  const renderIcon = (item: FlattenedItem) => {
    if (item.type === 'folder') {
      return item.collapsed ? (
        <Folder size={15} className="text-primary/85" />
      ) : (
        <FolderOpen size={15} className="text-primary/85" />
      );
    }
    return <GitFork size={14} className="text-primary/80" />;
  };

  return (
    <>
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden select-none">
        {/* Tree Section Header */}
        <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between gap-2 shrink-0">
          <span className="text-[12px] font-semibold text-muted-foreground">
            世系目录
          </span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => void handleAddGroup()}
              title="新建分组"
              aria-label="新建分组"
              className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
            >
              <FolderPlus size={13} />
            </button>
            <button
              type="button"
              onClick={() => openCreateModal()}
              title="新建世系"
              aria-label="新建世系"
              className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {actionError && (
          <div
            role="alert"
            className="mx-2.5 mb-2 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive"
          >
            {actionError}
          </div>
        )}

        {/* Flat 1-level Draggable Tree */}
        <div className="flex-1 overflow-y-auto px-1.5 pb-3">
          {directoryQuery.isPending ? (
            <div className="px-3 py-6 text-center text-[12px] text-muted-foreground">
              正在加载世系目录...
            </div>
          ) : treeItems.length === 0 ? (
            <div className="px-2.5 py-6 text-center space-y-2.5">
              <p className="text-[12px] text-muted-foreground">暂无世系图</p>
              <button
                type="button"
                onClick={() => openCreateModal()}
                className="w-full h-7 rounded-md bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 transition-colors cursor-pointer"
              >
                新建世系图
              </button>
            </div>
          ) : (
            <Tree
              items={treeItems}
              onItemsChange={(next) => void handleTreeChange(next)}
              activeId={activeNodeId}
              onSelect={(item) => {
                if (item.type === 'folder' && selectedNodeIdByProject[activeProjectId] === String(item.id)) {
                  setFolderCollapsed(
                    activeProjectId,
                    String(item.id),
                    !item.collapsed,
                  );
                }
                handleSelect(item);
              }}
              onEdit={openEditModal}
              canEdit={(item) => item.type === 'chart'}
              onRename={(id, name) => void handleRenameNode(id, name)}
              onRemove={(id) => void handleRemoveNode(id)}
              onAdd={(id) => openCreateModal(id)}
              renderIcon={renderIcon}
              collapsible
              removable
              indicator
              canHaveChildren={(item) => item.type === 'folder'}
              validateParent={(item, parentId) => {
                if (item.type === 'folder') {
                  return parentId === null;
                }
                return parentId === null || folderById.has(String(parentId));
              }}
            />
          )}
        </div>
      </div>

      <LineageEditorModal
        open={modalState.open}
        mode={modalState.mode}
        initialValue={modalState.initialValue}
        saving={modalSaving}
        submitError={modalError}
        onClose={() => setModalState((prev) => ({ ...prev, open: false }))}
        onSubmit={handleModalSubmit}
      />
    </>
  );
};
