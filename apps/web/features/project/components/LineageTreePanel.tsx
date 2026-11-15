import React, { useMemo } from 'react';
import { Folder, FolderOpen, FolderPlus, GitFork, Plus } from 'lucide-react';
import { Tree } from '../../../components/common/Tree/Tree';
import { FlattenedItem } from '../../../components/common/Tree/types';
import { useRouteContext } from '../../../hooks/useRouteContext';
import {
  DEFAULT_LINEAGE_TREE,
  findFirstChartId,
  useLineageStore,
} from '../../../store/useLineageStore';

export const LineageTreePanel: React.FC = () => {
  const { activeProjectId } = useRouteContext();

  const treesByProject = useLineageStore((s) => s.treesByProject);
  const selectedNodeIdByProject = useLineageStore(
    (s) => s.selectedNodeIdByProject
  );
  const setTree = useLineageStore((s) => s.setTree);
  const selectNode = useLineageStore((s) => s.selectNode);
  const addGroup = useLineageStore((s) => s.addGroup);
  const addChart = useLineageStore((s) => s.addChart);
  const renameNode = useLineageStore((s) => s.renameNode);
  const duplicateNode = useLineageStore((s) => s.duplicateNode);
  const removeNode = useLineageStore((s) => s.removeNode);

  const treeItems = useMemo(
    () => treesByProject[activeProjectId] || DEFAULT_LINEAGE_TREE,
    [treesByProject, activeProjectId]
  );

  const activeNodeId =
    selectedNodeIdByProject[activeProjectId] ??
    (findFirstChartId(treeItems) || String(treeItems[0]?.id || 'lineage-group-royal'));

  const handleSelect = (item: FlattenedItem) => {
    selectNode(activeProjectId, String(item.id));
  };

  const renderIcon = (item: FlattenedItem) => {
    if (item.type === 'folder') {
      return item.collapsed ? (
        <Folder size={15} className="text-amber-500/85" />
      ) : (
        <FolderOpen size={15} className="text-amber-500/85" />
      );
    }
    return <GitFork size={14} className="text-primary/80" />;
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden select-none">
      {/* Tree Section Header */}
      <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between gap-2 shrink-0">
        <span className="text-[12px] font-semibold text-muted-foreground">
          世系目录
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => addGroup(activeProjectId)}
            title="新建分组"
            aria-label="新建分组"
            className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--surface-hover))] transition-colors cursor-pointer"
          >
            <FolderPlus size={13} />
          </button>
          <button
            type="button"
            onClick={() => addChart(activeProjectId)}
            title="新建世系图"
            aria-label="新建世系图"
            className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--surface-hover))] transition-colors cursor-pointer"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Draggable Tree */}
      <div className="flex-1 overflow-y-auto px-1.5 pb-3">
        <Tree
          items={treeItems}
          onItemsChange={(next) => setTree(activeProjectId, next)}
          activeId={activeNodeId}
          onSelect={handleSelect}
          onRename={(id, name) => renameNode(activeProjectId, id, name)}
          onRemove={(id) => removeNode(activeProjectId, id)}
          onAdd={(id) => addChart(activeProjectId, id)}
          onDuplicate={(id) => duplicateNode(activeProjectId, id)}
          renderIcon={renderIcon}
          collapsible
          removable
          indicator
          canHaveChildren={(item) => item.type === 'folder'}
        />
      </div>
    </div>
  );
};
