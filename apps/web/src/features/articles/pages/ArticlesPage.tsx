import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  FolderOpen,
  FolderPlus,
  Plus,
  ScrollText,
  Settings,
} from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { findItemDeep } from '../../../components/common/Tree/utilities';
import { useActiveProject } from '../../../hooks/useActiveProject';
import { useArticleStore } from '../../../store/useArticleStore';
import {
  DOC_TYPE_LABELS,
  STATUS_LABELS,
  filterArticlesByStatus,
} from '../articleLabels';
import {
  extractPlainTextFromHtml,
  findFirstArticleId,
} from '../articleData';
import { getArticleTemplate } from '../domain/articleTemplates';
import {
  useArticleActions,
  useProjectArticlesSnapshot,
} from '../queries';
import type { ArticleStatus } from '../types';
import { WordArticleEditor } from '../components/WordArticleEditor';
import { ArticleConflictDialog } from '../components/ArticleConflictDialog';
import { ArticleMetaModal } from '../components/ArticleMetaModal';

const ArticlesPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    projectId: activeProjectId,
    project: activeProject,
    articleSeedContext: seedContext,
  } = useActiveProject();

  const [isCreateArticleOpen, setIsCreateArticleOpen] = useState(false);
  const [volumeStatusFilter, setVolumeStatusFilter] = useState<
    ArticleStatus | 'all'
  >('all');

  const selectedArticleNodeIdByProject = useArticleStore(
    (s) => s.selectedNodeIdByProject,
  );
  const selectArticleNode = useArticleStore((s) => s.selectNode);
  const articleConflict = useArticleStore((s) => s.articleConflict);
  const saveError = useArticleStore((s) => s.saveError);
  const clearSaveError = useArticleStore((s) => s.clearSaveError);

  const { articleTree, articlesById } =
    useProjectArticlesSnapshot(activeProjectId);
  const {
    addFolder: addArticleFolder,
    addArticle,
    updateArticleContent,
    chooseArticleConflictResolution,
  } = useArticleActions(activeProjectId);

  useEffect(() => {
    if (!saveError) return;
    toast.error(`谱文保存失败：${saveError}`);
    clearSaveError();
  }, [saveError, clearSaveError]);

  const defaultArticleId = useMemo(
    () =>
      findFirstArticleId(articleTree) ||
      (articleTree[0]?.id ? String(articleTree[0].id) : ''),
    [articleTree],
  );

  const selectedArticleNodeId =
    selectedArticleNodeIdByProject[activeProjectId] ?? defaultArticleId;

  const selectedArticleNode = useMemo(
    () =>
      (selectedArticleNodeId
        ? findItemDeep(articleTree, selectedArticleNodeId)
        : null) ||
      (defaultArticleId ? findItemDeep(articleTree, defaultArticleId) : null) ||
      articleTree[0] ||
      null,
    [articleTree, selectedArticleNodeId, defaultArticleId],
  );

  const filteredVolumeChildren = useMemo(() => {
    if (!selectedArticleNode?.children?.length) return [];
    const withDocs = selectedArticleNode.children.map((child) => {
      const childId = String(child.id);
      const doc = articlesById.get(childId);
      return { child, doc };
    });
    if (volumeStatusFilter === 'all') {
      return withDocs;
    }
    const matching = new Set(
      filterArticlesByStatus(
        withDocs
          .map((item) => item.doc)
          .filter((doc): doc is NonNullable<typeof doc> => Boolean(doc)),
        volumeStatusFilter,
      ).map((doc) => doc.id),
    );
    return withDocs.filter(
      (item) => item.doc && matching.has(item.doc.id),
    );
  }, [selectedArticleNode, articlesById, volumeStatusFilter]);

  const activeArticleDoc = useMemo(() => {
    if (!selectedArticleNode || selectedArticleNode.type !== 'article') {
      return null;
    }
    const id = String(selectedArticleNode.id);
    return articlesById.get(id) ?? null;
  }, [selectedArticleNode, articlesById]);

  if (activeArticleDoc) {
    return (
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-background">
        <WordArticleEditor
          article={activeArticleDoc}
          familyName={activeProject?.name}
          hallName={activeProject?.hallName ?? undefined}
          onUpdateArticle={(updates) =>
            updateArticleContent(activeArticleDoc.id, updates)
          }
        />
        {articleConflict ? (
          <ArticleConflictDialog
            open
            local={articleConflict.local}
            server={articleConflict.server}
            onChoose={chooseArticleConflictResolution}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex-1 h-full overflow-y-auto bg-background">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-7 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl border border-border bg-[var(--surface-subtle)] flex items-center justify-center text-primary shrink-0">
              <ScrollText size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="yp-h2 text-foreground truncate">谱文</h1>
                <span className="text-[12px] text-muted-foreground truncate">
                  {activeProject?.hallName || activeProject?.name}
                </span>
              </div>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                编修序言、凡例、姓氏源流、家训族规与人物传记。
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void navigate({
                  to: '/projects/$projectId',
                  params: { projectId: activeProjectId },
                })
              }
              className="h-8 gap-1.5 text-[13px] whitespace-nowrap"
            >
              <ArrowLeft size={14} /> 返回工作台概览
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                void navigate({
                  to: '/projects/$projectId/settings',
                  params: { projectId: activeProjectId },
                })
              }
              className="h-8 gap-1.5 text-[13px] whitespace-nowrap"
            >
              <Settings size={14} /> 家族设置
            </Button>
          </div>
        </div>

        {selectedArticleNode?.type === 'folder' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-foreground min-w-0">
                <FolderOpen size={16} className="text-primary shrink-0" />
                <span className="truncate">
                  {selectedArticleNode.data?.name || '谱文卷目'}
                </span>
                <span className="text-[12px] font-medium text-muted-foreground tabular-nums shrink-0">
                  ({selectedArticleNode.children?.length || 0} 篇)
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsCreateArticleOpen(true)}
                className="h-8 gap-1.5 text-[13px] whitespace-nowrap shrink-0"
              >
                <Plus size={14} /> 新建谱文
              </Button>
            </div>

            {selectedArticleNode.children?.length ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="volumeStatusFilter"
                    className="text-[12px] text-muted-foreground shrink-0"
                  >
                    审校状态
                  </label>
                  <select
                    id="volumeStatusFilter"
                    value={volumeStatusFilter}
                    onChange={(e) =>
                      setVolumeStatusFilter(
                        e.target.value as ArticleStatus | 'all'
                      )
                    }
                    className="h-8 pl-2 pr-7 rounded-md border border-border bg-background text-[12px] font-medium text-foreground appearance-none cursor-pointer"
                  >
                    <option value="all">全部</option>
                    <option value="draft">草稿</option>
                    <option value="review">待校</option>
                    <option value="approved">定稿</option>
                  </select>
                </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredVolumeChildren.map(({ child, doc }) => {
                  const childId = String(child.id);
                  const snippet = extractPlainTextFromHtml(
                    doc?.contentHtml || ''
                  ).slice(0, 88);
                  return (
                    <button
                      key={childId}
                      type="button"
                      onClick={() =>
                        selectArticleNode(activeProjectId, childId)
                      }
                      className="flex flex-col justify-between gap-3 p-4 rounded-xl border border-border bg-card hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-card-hover)] transition-all text-left cursor-pointer group"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <FileText
                              size={15}
                              className="text-primary shrink-0"
                            />
                            <span className="text-[14px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                              {doc?.title || child.data?.name || childId}
                            </span>
                            {doc && (
                              <>
                                <span className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted/50 text-muted-foreground shrink-0">
                                  {DOC_TYPE_LABELS[doc.docType]}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted/50 text-muted-foreground shrink-0">
                                  {STATUS_LABELS[doc.status]}
                                </span>
                              </>
                            )}
                          </div>
                          <ArrowRight
                            size={14}
                            className="text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0"
                          />
                        </div>
                        {snippet && (
                          <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2">
                            {snippet}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[12px] text-muted-foreground tabular-nums pt-2 border-t border-border/60">
                        <span>{doc?.author || '家族编委会'}</span>
                        <span aria-hidden="true">·</span>
                        <span>{doc?.wordCount ?? 0} 字</span>
                        {doc?.updatedAt && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="truncate">{doc.updatedAt}</span>
                          </>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-card/50 py-12 px-6 text-center space-y-3">
                <p className="text-[13px] text-muted-foreground">
                  该卷目下暂无谱文，点击右上角「新建谱文」或从左侧目录拖拽篇章移入。
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsCreateArticleOpen(true)}
                  className="h-8 gap-1.5 text-[13px]"
                >
                  <Plus size={14} /> 新建谱文
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-card/60 py-12 px-6 text-center space-y-4">
            <div className="w-11 h-11 rounded-xl bg-[var(--surface-subtle)] border border-border mx-auto flex items-center justify-center text-primary">
              <ScrollText size={20} />
            </div>
            <div className="space-y-1">
              <h2 className="yp-h2 text-foreground">开始编修家族谱文</h2>
              <p className="text-[13px] text-muted-foreground max-w-md mx-auto leading-relaxed">
                可在左侧谱文目录中新建卷目与谱文篇章，使用右侧简易 Word 编辑器撰写谱序、凡例、家训与传记。
              </p>
            </div>
            <div className="flex items-center justify-center gap-2.5">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void addArticleFolder().catch((err) =>
                    toast.error(`新建卷目失败：${err instanceof Error ? err.message : '未知错误'}`),
                  );
                }}
                className="h-8 gap-1.5 text-[13px]"
              >
                <FolderPlus size={14} /> 新建卷目
              </Button>
              <Button
                size="sm"
                onClick={() => setIsCreateArticleOpen(true)}
                className="h-8 gap-1.5 text-[13px]"
              >
                <Plus size={14} /> 新建谱文
              </Button>
            </div>
          </div>
        )}
      </div>

      {articleConflict ? (
        <ArticleConflictDialog
          open
          local={articleConflict.local}
          server={articleConflict.server}
          onChoose={chooseArticleConflictResolution}
        />
      ) : null}

      <ArticleMetaModal
        open={isCreateArticleOpen}
        mode="create"
        initialValue={{
          title: '',
          subtitle:
            selectedArticleNode?.type === 'folder'
              ? selectedArticleNode.data?.name
              : '',
          author: activeProject?.hallName
            ? `${activeProject.hallName}编委会`
            : '家族编委会',
        }}
        onClose={() => setIsCreateArticleOpen(false)}
        onSubmit={(values) => {
          const targetParentId =
            selectedArticleNode?.type === 'folder'
              ? String(selectedArticleNode.id)
              : undefined;
          const template = values.templateId
            ? getArticleTemplate(values.templateId)
            : undefined;
          const contentHtml = template
            ? template.buildContent(seedContext)
            : undefined;
          void addArticle(targetParentId, {
            ...values,
            docType: template?.docType ?? 'custom',
            contentHtml,
          }).catch((err) =>
            toast.error(`创建谱文失败：${err instanceof Error ? err.message : '未知错误'}`),
          );
          setIsCreateArticleOpen(false);
        }}
      />
    </div>
  );
};

export default ArticlesPage;
