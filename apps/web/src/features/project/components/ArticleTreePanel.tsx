import React, { useMemo, useState } from 'react';
import { FileText, Folder, FolderOpen, FolderPlus, Plus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Tree } from '../../../components/common/Tree/Tree';
import type { FlattenedItem, TreeItem } from '../../../components/common/Tree/types';
import { findItemDeep } from '../../../components/common/Tree/utilities';
import { useActiveProject } from '../../../hooks/useActiveProject';
import { errorMessage } from '../../../lib/api';
import { useArticleStore } from '../../../store/useArticleStore';
import { findFirstArticleId } from '../../articles/articleData';
import { updateArticleRequest } from '../../articles/api';
import {
  invalidateArticlesDirectory,
  useArticleActions,
  useProjectArticlesSnapshot,
} from '../../articles/queries';
import type { ArticleMetaInput } from '../../articles/types';
import { ArticleMetaModal } from '../../articles/components/ArticleMetaModal';
import { updateFolderRequest } from '../../lineage/api';

interface ArticleModalState {
  open: boolean;
  mode: 'create' | 'edit';
  parentId?: string;
  articleId?: string;
  initialValue?: Partial<ArticleMetaInput>;
}

const EMPTY_COLLAPSED: Record<string, boolean> = {};

export const ArticleTreePanel: React.FC = () => {
  const queryClient = useQueryClient();
  const { projectId: activeProjectId, project: activeProject } =
    useActiveProject();

  const selectedNodeIdByProject = useArticleStore(
    (s) => s.selectedNodeIdByProject,
  );
  const collapsedFolders = useArticleStore(
    (s) => s.collapsedFoldersByProject[activeProjectId] ?? EMPTY_COLLAPSED,
  );
  const selectNode = useArticleStore((s) => s.selectNode);
  const setCollapsedFolders = useArticleStore((s) => s.setCollapsedFolders);

  const {
    articleTree: treeItems,
    articlesById,
    foldersById,
    isLoading,
  } = useProjectArticlesSnapshot(activeProjectId);
  const {
    addFolder,
    addArticle,
    updateArticleMeta,
    renameNode,
    duplicateNode,
    removeNode,
  } = useArticleActions(activeProjectId);

  const [actionError, setActionError] = useState<string | null>(null);
  const [modalState, setModalState] = useState<ArticleModalState>({
    open: false,
    mode: 'create',
  });

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
    const doc = articlesById.get(articleId);
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

  const handleModalSubmit = async (values: ArticleMetaInput) => {
    setActionError(null);
    try {
      if (modalState.mode === 'create') {
        await addArticle(modalState.parentId, values);
      } else if (modalState.articleId) {
        await updateArticleMeta(modalState.articleId, values);
      }
      setModalState((prev) => ({ ...prev, open: false }));
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  const handleTreeChange = async (nextItems: TreeItem[]) => {
    if (!activeProjectId) return;

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

    const updates: Promise<unknown>[] = [];
    nextItems.forEach((item, topIdx) => {
      const id = String(item.id);
      if (item.type === 'folder') {
        const folder = foldersById.get(id);
        if (folder && folder.seq !== topIdx) {
          updates.push(
            updateFolderRequest(activeProjectId, id, { seq: topIdx }),
          );
        }
        item.children.forEach((child, childIdx) => {
          const childId = String(child.id);
          const doc = articlesById.get(childId);
          if (doc && (doc.folderId !== id || doc.seq !== childIdx)) {
            updates.push(
              updateArticleRequest(activeProjectId, childId, {
                folderId: id,
                seq: childIdx,
                version: doc.version,
              }),
            );
          }
        });
      } else {
        const doc = articlesById.get(id);
        if (doc && (doc.folderId !== null || doc.seq !== topIdx)) {
          updates.push(
            updateArticleRequest(activeProjectId, id, {
              folderId: null,
              seq: topIdx,
              version: doc.version,
            }),
          );
        }
      }
    });

    if (updates.length > 0) {
      setActionError(null);
      try {
        await Promise.all(updates);
        await invalidateArticlesDirectory(queryClient, activeProjectId);
      } catch (err) {
        setActionError(errorMessage(err));
        await invalidateArticlesDirectory(queryClient, activeProjectId);
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
    return <FileText size={14} className="text-primary/80" />;
  };

  const folderLabel = useMemo(
    () => (isLoading && treeItems.length === 0 ? '正在加载谱文目录...' : '暂无谱文目录'),
    [isLoading, treeItems.length],
  );

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
              onClick={() => {
                setActionError(null);
                void addFolder().catch((err) => setActionError(errorMessage(err)));
              }}
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

        {actionError && (
          <div className="mx-3 mb-2 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive">
            {actionError}
          </div>
        )}

        {/* Draggable Tree */}
        <div className="flex-1 overflow-y-auto px-1.5 pb-3">
          {treeItems.length > 0 ? (
            <Tree
              items={treeItems}
              onItemsChange={(next) => {
                void handleTreeChange(next);
              }}
              activeId={activeNodeId}
              onSelect={handleSelect}
              onEdit={openEditModal}
              editLabel="编辑属性"
              canEdit={(item) => item.type === 'article'}
              onRename={(id, name) => {
                setActionError(null);
                void renameNode(id, name).catch((err) =>
                  setActionError(errorMessage(err)),
                );
              }}
              onRemove={(id) => {
                setActionError(null);
                void removeNode(id).catch((err) =>
                  setActionError(errorMessage(err)),
                );
              }}
              onAdd={(id) => openCreateModal(id)}
              onDuplicate={(id) => {
                setActionError(null);
                void duplicateNode(id).catch((err) =>
                  setActionError(errorMessage(err)),
                );
              }}
              renderIcon={renderIcon}
              collapsible
              removable
              indicator
              canHaveChildren={(item) => item.type === 'folder'}
            />
          ) : (
            <div className="px-3 py-8 text-center space-y-2">
              <p className="text-[12px] text-muted-foreground">{folderLabel}</p>
              {!isLoading && (
                <button
                  type="button"
                  onClick={() => openCreateModal()}
                  className="text-[12px] font-medium text-primary hover:underline cursor-pointer"
                >
                  + 新建首篇谱文
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <ArticleMetaModal
        open={modalState.open}
        mode={modalState.mode}
        initialValue={modalState.initialValue}
        onClose={() => setModalState((prev) => ({ ...prev, open: false }))}
        onSubmit={(values) => {
          void handleModalSubmit(values);
        }}
      />
    </>
  );
};
