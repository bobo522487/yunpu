import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Folder, FolderOpen, FolderPlus, Plus } from 'lucide-react';
import { Tree } from '../../../components/common/Tree/Tree';
import type { FlattenedItem } from '../../../components/common/Tree/types';
import { findItemDeep } from '../../../components/common/Tree/utilities';
import { useActiveProject } from '../../../hooks/useActiveProject';
import { useArticleStore } from '../../../store/useArticleStore';
import {
  findFirstArticleId,
  makeArticleStorageKey,
} from '../../articles/articleData';
import type { ArticleMetaInput } from '../../articles/types';
import { ArticleMetaModal } from '../../articles/components/ArticleMetaModal';

interface ArticleModalState {
  open: boolean;
  mode: 'create' | 'edit';
  parentId?: string;
  articleId?: string;
  initialValue?: Partial<ArticleMetaInput>;
}

export const ArticleTreePanel: React.FC = () => {
  const {
    projectId: activeProjectId,
    project: activeProject,
    articleSeedContext,
  } = useActiveProject();

  const articleHydrated = useArticleStore((s) => s._hasHydrated);
  const treesByProject = useArticleStore((s) => s.treesByProject);
  const selectedNodeIdByProject = useArticleStore(
    (s) => s.selectedNodeIdByProject
  );
  const articlesByKey = useArticleStore((s) => s.articlesByKey);
  const ensureProjectInitialized = useArticleStore(
    (s) => s.ensureProjectInitialized
  );
  const setTree = useArticleStore((s) => s.setTree);
  const selectNode = useArticleStore((s) => s.selectNode);
  const addFolder = useArticleStore((s) => s.addFolder);
  const addArticle = useArticleStore((s) => s.addArticle);
  const updateArticleMeta = useArticleStore((s) => s.updateArticleMeta);
  const renameNode = useArticleStore((s) => s.renameNode);
  const duplicateNode = useArticleStore((s) => s.duplicateNode);
  const removeNode = useArticleStore((s) => s.removeNode);

  const [modalState, setModalState] = useState<ArticleModalState>({
    open: false,
    mode: 'create',
  });

  useEffect(() => {
    if (!activeProjectId || !articleHydrated) return;
    ensureProjectInitialized(activeProjectId, articleSeedContext);
  }, [
    activeProjectId,
    articleHydrated,
    articleSeedContext,
    ensureProjectInitialized,
  ]);

  const treeItems = useMemo(
    () => treesByProject[activeProjectId] || [],
    [treesByProject, activeProjectId]
  );

  const activeNodeId =
    selectedNodeIdByProject[activeProjectId] ??
    (findFirstArticleId(treeItems) || String(treeItems[0]?.id || ''));

  const handleSelect = (item: FlattenedItem) => {
    selectNode(activeProjectId, String(item.id));
  };

  const openCreateModal = (parentId?: string) => {
    setModalState({
      open: true,
      mode: 'create',
      parentId,
      initialValue: {
        title: '',
        subtitle: '',
        author: activeProject?.hallName
          ? `${activeProject.hallName}编委会`
          : '家族编委会',
      },
    });
  };

  const openEditModal = (articleId: string) => {
    const node = findItemDeep(treeItems, articleId);
    const key = makeArticleStorageKey(activeProjectId, articleId);
    const doc = articlesByKey[key];
    setModalState({
      open: true,
      mode: 'edit',
      articleId,
      initialValue: {
        title: doc?.title || node?.data?.name || '',
        subtitle: doc?.subtitle || '',
        author: doc?.author || '',
        status: doc?.status,
        privacy: doc?.privacy,
      },
    });
  };

  const handleModalSubmit = (values: ArticleMetaInput) => {
    if (modalState.mode === 'create') {
      addArticle(activeProjectId, modalState.parentId, values);
    } else if (modalState.articleId) {
      updateArticleMeta(activeProjectId, modalState.articleId, values);
    }
    setModalState((prev) => ({ ...prev, open: false }));
  };

  const renderIcon = (item: FlattenedItem) => {
    if (item.type === 'folder') {
      return item.collapsed ? (
        <Folder size={15} className="text-primary/85" />
      ) : (
        <FolderOpen size={15} className="text-primary/85" />
      );
    }
    return <FileText size={14} className="text-primary/80" />;
  };

  return (
    <>
      <div
        className="flex-1 min-h-0 flex flex-col overflow-hidden select-none"
        data-testid="article-tree-panel"
      >
        {/* Tree Section Header */}
        <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between gap-2 shrink-0">
          <span className="text-[12px] font-semibold text-muted-foreground">
            谱文目录
          </span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => addFolder(activeProjectId)}
              title="新建卷目"
              aria-label="新建卷目"
              className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
            >
              <FolderPlus size={13} />
            </button>
            <button
              type="button"
              onClick={() => openCreateModal()}
              title="新建谱文"
              aria-label="新建谱文"
              className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Draggable Tree */}
        <div className="flex-1 overflow-y-auto px-1.5 pb-3">
          {treeItems.length > 0 ? (
            <Tree
              items={treeItems}
              onItemsChange={(next) => setTree(activeProjectId, next)}
              activeId={activeNodeId}
              onSelect={handleSelect}
              onEdit={openEditModal}
              editLabel="编辑属性"
              canEdit={(item) => item.type === 'article'}
              onRename={(id, name) => renameNode(activeProjectId, id, name)}
              onRemove={(id) => removeNode(activeProjectId, id)}
              onAdd={(id) => openCreateModal(id)}
              onDuplicate={(id) => duplicateNode(activeProjectId, id)}
              renderIcon={renderIcon}
              collapsible
              removable
              indicator
              canHaveChildren={(item) => item.type === 'folder'}
            />
          ) : (
            <div className="px-3 py-8 text-center space-y-2">
              <p className="text-[12px] text-muted-foreground">暂无谱文目录</p>
              <button
                type="button"
                onClick={() => openCreateModal()}
                className="text-[12px] font-medium text-primary hover:underline cursor-pointer"
              >
                + 新建首篇谱文
              </button>
            </div>
          )}
        </div>
      </div>

      <ArticleMetaModal
        open={modalState.open}
        mode={modalState.mode}
        initialValue={modalState.initialValue}
        onClose={() => setModalState((prev) => ({ ...prev, open: false }))}
        onSubmit={handleModalSubmit}
      />
    </>
  );
};
