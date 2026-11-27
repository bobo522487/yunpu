import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  FolderPlus,
  GitFork,
  Pencil,
  Plus,
  ScrollText,
  Settings2,
  Trash2,
} from 'lucide-react';
import { useProjectId } from '../../../hooks/useProjectId';
import { useBookStore } from '../../../store/useBookStore';
import ConfirmDialog from '../../dashboard/components/ConfirmDialog';
import type { BookArticleAuditIssue } from '../domain/bookArticleAudit';
import type {
  BookRecord,
  CatalogArticleNode,
  CatalogChapterNode,
  CatalogLeafNode,
  CatalogLineageNode,
  CatalogNode,
  CatalogSectionCode,
} from '../types';
import {
  AddChapterModal,
  AddLineageModal,
  AddTextModal,
  CatalogBlockedModal,
  EditCatalogDocModal,
  LineageSettingsModal,
  MoveNodeModal,
} from './catalog-modals';
import { LineageQuickPanel } from './LineageQuickPanel';

interface BookCatalogStepProps {
  book: BookRecord;
  auditIssues?: BookArticleAuditIssue[];
}

function describeLineageScope(node: CatalogLineageNode): string {
  const parts: string[] = [`起：${node.startMemberName}`];
  if (node.descendantScope === 'all') {
    parts.push('全部后代');
  } else if (node.descendantScope === 'generations') {
    parts.push(`限 ${node.maxGenerations || 5} 世`);
  } else if (node.descendantScope === 'member') {
    parts.push(`止：${node.endMemberName || '指定族丁'}(不含)`);
  } else if (node.descendantScope === 'member_inclusive') {
    parts.push(`止：${node.endMemberName || '指定族丁'}(含)`);
  }
  const tables: string[] = [];
  if (node.indexConfig.enabled) tables.push('检索表');
  if (node.diaoxianConfig.enabled) tables.push('吊线图');
  if (node.shixiConfig.enabled) tables.push('世系表');
  parts.push(tables.join(' / ') || '未勾选附表');
  return parts.join(' · ');
}

export const BookCatalogStep: React.FC<BookCatalogStepProps> = ({
  book,
  auditIssues = [],
}) => {
  const activeProjectId = useProjectId();

  const toggleSectionCollapsed = useBookStore((s) => s.toggleSectionCollapsed);
  const toggleChapterCollapsed = useBookStore((s) => s.toggleChapterCollapsed);
  const addChapter = useBookStore((s) => s.addChapter);
  const renameChapter = useBookStore((s) => s.renameChapter);
  const addArticleRefs = useBookStore((s) => s.addArticleRefs);
  const updateArticleRef = useBookStore((s) => s.updateArticleRef);
  const addLineageRef = useBookStore((s) => s.addLineageRef);
  const updateLineageRefSettings = useBookStore(
    (s) => s.updateLineageRefSettings
  );
  const removeCatalogNode = useBookStore((s) => s.removeCatalogNode);
  const moveCatalogNodeOrder = useBookStore((s) => s.moveCatalogNodeOrder);
  const transferCatalogNode = useBookStore((s) => s.transferCatalogNode);

  // Modal states
  const [chapterModal, setChapterModal] = useState<{
    open: boolean;
    mode: 'create' | 'rename';
    sectionCode: CatalogSectionCode;
    sectionLabel: string;
    chapterId?: string;
    initialTitle?: string;
  }>({
    open: false,
    mode: 'create',
    sectionCode: 'body',
    sectionLabel: '正文',
  });

  const [addTextTarget, setAddTextTarget] = useState<{
    open: boolean;
    sectionCode: CatalogSectionCode;
    chapterId?: string;
    label: string;
  }>({
    open: false,
    sectionCode: 'body',
    label: '正文',
  });

  const [addLineageTarget, setAddLineageTarget] = useState<{
    open: boolean;
    sectionCode: CatalogSectionCode;
    chapterId?: string;
    label: string;
  }>({
    open: false,
    sectionCode: 'lineage',
    label: '世系',
  });

  const [editDocNode, setEditDocNode] = useState<CatalogArticleNode | null>(
    null
  );
  const [lineageSettingsNode, setLineageSettingsNode] =
    useState<CatalogLineageNode | null>(null);

  const [moveModal, setMoveModal] = useState<{
    open: boolean;
    nodeId: string | null;
    nodeType: 'chapter' | 'article' | 'lineage' | null;
    title: string;
  }>({ open: false, nodeId: null, nodeType: null, title: '' });

  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    title: string;
    isChapter: boolean;
  } | null>(null);

  const [blockedAlert, setBlockedAlert] = useState<{
    open: boolean;
    message: string;
  }>({ open: false, message: '' });

  const sections = (
    ['preface', 'body', 'lineage', 'appendix'] as CatalogSectionCode[]
  ).map((code) => book.sections[code]);

  const handleRequestDelete = (
    node: CatalogNode,
    title: string
  ) => {
    if (node.nodeType === 'chapter' && node.children.length > 0) {
      setBlockedAlert({
        open: true,
        message: '该目录下已有内容，请先迁出或删除内容后再删除目录。',
      });
      return;
    }
    setDeleteTarget({
      id: node.id,
      title,
      isChapter: node.nodeType === 'chapter',
    });
  };

  const renderLeafCard = (
    leaf: CatalogLeafNode,
    sectionCode: CatalogSectionCode,
    parentChapterId: string | undefined,
    index: number,
    totalCount: number
  ) => {
    const isArticle = leaf.nodeType === 'article';
    const title = isArticle ? leaf.displayTitle : leaf.eyebrowTitle;
    const isFirst = index === 0;
    const isLast = index === totalCount - 1;

    return (
      <div
        key={leaf.id}
        className="group flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border border-border bg-card hover:border-[var(--border-strong)] transition-colors"
      >
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-md bg-[var(--surface-subtle)] border border-border flex items-center justify-center text-primary shrink-0 mt-0.5">
            {isArticle ? <ScrollText size={14} /> : <GitFork size={14} />}
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-foreground truncate">
              {title}
            </div>
            <div className="text-[11px] text-muted-foreground truncate mt-0.5">
              {isArticle
                ? `引自：${leaf.sourceTitle}`
                : describeLineageScope(leaf)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            disabled={isFirst}
            title="上移"
            onClick={() =>
              moveCatalogNodeOrder(
                activeProjectId,
                book.id,
                sectionCode,
                parentChapterId,
                leaf.id,
                'up'
              )
            }
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <ArrowUp size={13} />
          </button>
          <button
            type="button"
            disabled={isLast}
            title="下移"
            onClick={() =>
              moveCatalogNodeOrder(
                activeProjectId,
                book.id,
                sectionCode,
                parentChapterId,
                leaf.id,
                'down'
              )
            }
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <ArrowDown size={13} />
          </button>
          <button
            type="button"
            title="迁出"
            onClick={() =>
              setMoveModal({
                open: true,
                nodeId: leaf.id,
                nodeType: leaf.nodeType,
                title,
              })
            }
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <ArrowRightLeft size={13} />
          </button>
          <button
            type="button"
            title={isArticle ? '编辑谱文引用' : '世系详细设置'}
            onClick={() => {
              if (isArticle) {
                setEditDocNode(leaf);
              } else {
                setLineageSettingsNode(leaf);
              }
            }}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            {isArticle ? <Pencil size={13} /> : <Settings2 size={13} />}
          </button>
          <button
            type="button"
            title="删除"
            onClick={() => handleRequestDelete(leaf, title)}
            className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    );
  };

  const renderChapterBlock = (
    chapter: CatalogChapterNode,
    sectionCode: CatalogSectionCode,
    index: number,
    totalCount: number
  ) => {
    const isFirst = index === 0;
    const isLast = index === totalCount - 1;

    return (
      <div
        key={chapter.id}
        className="rounded-xl border border-border bg-[var(--surface-subtle)] overflow-hidden"
      >
        {/* Chapter Header */}
        <div className="px-3.5 py-2.5 flex items-center justify-between gap-2 border-b border-border/70 bg-card/80">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() =>
                toggleChapterCollapsed(
                  activeProjectId,
                  book.id,
                  sectionCode,
                  chapter.id
                )
              }
              className="p-0.5 rounded text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
              aria-label={chapter.collapsed ? '展开章节' : '折叠章节'}
            >
              {chapter.collapsed ? (
                <ChevronRight size={15} />
              ) : (
                <ChevronDown size={15} />
              )}
            </button>
            <FolderOpen size={15} className="text-amber-500 shrink-0" />
            <span className="text-[13px] font-semibold text-foreground truncate">
              {chapter.title}
            </span>
            <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
              ({chapter.children.length})
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() =>
                setAddTextTarget({
                  open: true,
                  sectionCode,
                  chapterId: chapter.id,
                  label: chapter.title,
                })
              }
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus size={12} />
              <span>添加谱文</span>
            </button>
            {sectionCode === 'lineage' && (
              <button
                type="button"
                onClick={() =>
                  setAddLineageTarget({
                    open: true,
                    sectionCode,
                    chapterId: chapter.id,
                    label: chapter.title,
                  })
                }
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus size={12} />
                <span>添加世系</span>
              </button>
            )}
            <button
              type="button"
              disabled={isFirst}
              title="上移"
              onClick={() =>
                moveCatalogNodeOrder(
                  activeProjectId,
                  book.id,
                  sectionCode,
                  undefined,
                  chapter.id,
                  'up'
                )
              }
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 cursor-pointer"
            >
              <ArrowUp size={13} />
            </button>
            <button
              type="button"
              disabled={isLast}
              title="下移"
              onClick={() =>
                moveCatalogNodeOrder(
                  activeProjectId,
                  book.id,
                  sectionCode,
                  undefined,
                  chapter.id,
                  'down'
                )
              }
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 cursor-pointer"
            >
              <ArrowDown size={13} />
            </button>
            <button
              type="button"
              title="迁出"
              onClick={() =>
                setMoveModal({
                  open: true,
                  nodeId: chapter.id,
                  nodeType: 'chapter',
                  title: chapter.title,
                })
              }
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
            >
              <ArrowRightLeft size={13} />
            </button>
            <button
              type="button"
              title="重命名章节"
              onClick={() =>
                setChapterModal({
                  open: true,
                  mode: 'rename',
                  sectionCode,
                  sectionLabel: book.sections[sectionCode].label,
                  chapterId: chapter.id,
                  initialTitle: chapter.title,
                })
              }
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              title="删除章节"
              onClick={() => handleRequestDelete(chapter, chapter.title)}
              className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Chapter Children */}
        {!chapter.collapsed && (
          <div className="p-2.5 space-y-2">
            {chapter.children.length > 0 ? (
              chapter.children.map((child, childIdx) =>
                renderLeafCard(
                  child,
                  sectionCode,
                  chapter.id,
                  childIdx,
                  chapter.children.length
                )
              )
            ) : (
              <div className="py-4 text-center text-[12px] text-muted-foreground border border-dashed border-border rounded-lg bg-background/40">
                本章节暂无内容，请点击上方「添加谱文」加入篇目
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 p-4 md:p-5 overflow-hidden">
      {/* Left 2/3: 4-Section Catalog Tree */}
      <div className="min-h-0 overflow-y-auto pr-1 space-y-4">
        {auditIssues.length > 0 && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[12px] text-amber-950 dark:text-amber-100 space-y-1.5">
            <p className="font-semibold">
              有 {auditIssues.length} 篇谱文尚未定稿或已删除
            </p>
            <ul className="list-disc list-inside text-amber-900/90 dark:text-amber-50/90 space-y-0.5">
              {auditIssues.map((issue) => (
                <li key={`${issue.sourceArticleId}-${issue.reason}`}>
                  {issue.displayTitle}
                </li>
              ))}
            </ul>
          </div>
        )}
        {sections.map((sec) => (
          <section
            key={sec.code}
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            {/* Primary Section Header */}
            <div className="px-4 py-3 border-b border-border bg-[var(--surface-subtle)] flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() =>
                  toggleSectionCollapsed(activeProjectId, book.id, sec.code)
                }
                className="flex items-center gap-2 min-w-0 text-left cursor-pointer"
              >
                {sec.collapsed ? (
                  <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown size={16} className="text-muted-foreground shrink-0" />
                )}
                <span className="text-[14px] font-semibold text-foreground">
                  {sec.label}
                </span>
                {sec.hint && (
                  <span className="text-[12px] text-muted-foreground truncate">
                    {sec.hint}
                  </span>
                )}
              </button>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setChapterModal({
                      open: true,
                      mode: 'create',
                      sectionCode: sec.code,
                      sectionLabel: sec.label,
                      initialTitle: '',
                    })
                  }
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-border bg-background hover:bg-muted text-[12px] font-medium text-foreground transition-colors cursor-pointer whitespace-nowrap"
                >
                  <FolderPlus size={13} />
                  <span>添加章节</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setAddTextTarget({
                      open: true,
                      sectionCode: sec.code,
                      label: sec.label,
                    })
                  }
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-border bg-background hover:bg-muted text-[12px] font-medium text-foreground transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Plus size={13} />
                  <span>添加谱文</span>
                </button>
                {sec.code === 'lineage' && (
                  <button
                    type="button"
                    onClick={() =>
                      setAddLineageTarget({
                        open: true,
                        sectionCode: sec.code,
                        label: sec.label,
                      })
                    }
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-primary/40 bg-primary/[0.08] hover:bg-primary/15 text-[12px] font-medium text-primary transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <GitFork size={13} />
                    <span>添加世系</span>
                  </button>
                )}
              </div>
            </div>

            {/* Section Body */}
            {!sec.collapsed && (
              <div className="p-3.5 space-y-2.5">
                {sec.items.length > 0 ? (
                  sec.items.map((node, idx) =>
                    node.nodeType === 'chapter'
                      ? renderChapterBlock(
                          node,
                          sec.code,
                          idx,
                          sec.items.length
                        )
                      : renderLeafCard(
                          node,
                          sec.code,
                          undefined,
                          idx,
                          sec.items.length
                        )
                  )
                ) : (
                  <div className="py-6 text-center text-[12px] text-muted-foreground border border-dashed border-border rounded-lg">
                    「{sec.label}」暂无编排内容，请点击右上角按钮添加章节或谱文
                  </div>
                )}
              </div>
            )}
          </section>
        ))}
      </div>

      {/* Right 1/3: Real-time Lineage Info Quick Panel */}
      <div className="min-h-[360px] lg:min-h-0 overflow-hidden">
        <LineageQuickPanel mode="browse" className="h-full" />
      </div>

      {/* Modals */}
      <AddChapterModal
        open={chapterModal.open}
        mode={chapterModal.mode}
        sectionLabel={chapterModal.sectionLabel}
        initialTitle={chapterModal.initialTitle}
        onClose={() =>
          setChapterModal((prev) => ({ ...prev, open: false }))
        }
        onSubmit={(title) => {
          if (chapterModal.mode === 'create') {
            addChapter(
              activeProjectId,
              book.id,
              chapterModal.sectionCode,
              title
            );
          } else if (chapterModal.chapterId) {
            renameChapter(
              activeProjectId,
              book.id,
              chapterModal.chapterId,
              title
            );
          }
          setChapterModal((prev) => ({ ...prev, open: false }));
        }}
      />

      <AddTextModal
        open={addTextTarget.open}
        targetLabel={addTextTarget.label}
        onClose={() =>
          setAddTextTarget((prev) => ({ ...prev, open: false }))
        }
        onConfirm={(selected) => {
          addArticleRefs(
            activeProjectId,
            book.id,
            addTextTarget.sectionCode,
            addTextTarget.chapterId,
            selected
          );
          setAddTextTarget((prev) => ({ ...prev, open: false }));
        }}
      />

      <EditCatalogDocModal
        open={Boolean(editDocNode)}
        node={editDocNode}
        onClose={() => setEditDocNode(null)}
        onSubmit={(updates) => {
          if (editDocNode) {
            updateArticleRef(
              activeProjectId,
              book.id,
              editDocNode.id,
              updates
            );
          }
          setEditDocNode(null);
        }}
      />

      <AddLineageModal
        open={addLineageTarget.open}
        book={book}
        targetLabel={addLineageTarget.label}
        onClose={() =>
          setAddLineageTarget((prev) => ({ ...prev, open: false }))
        }
        onSubmit={(payload) => {
          addLineageRef(
            activeProjectId,
            book.id,
            addLineageTarget.sectionCode,
            addLineageTarget.chapterId,
            payload
          );
          setAddLineageTarget((prev) => ({ ...prev, open: false }));
        }}
      />

      <LineageSettingsModal
        open={Boolean(lineageSettingsNode)}
        node={lineageSettingsNode}
        onClose={() => setLineageSettingsNode(null)}
        onSave={(updates) => {
          if (lineageSettingsNode) {
            updateLineageRefSettings(
              activeProjectId,
              book.id,
              lineageSettingsNode.id,
              updates
            );
          }
          setLineageSettingsNode(null);
        }}
      />

      <MoveNodeModal
        open={moveModal.open}
        book={book}
        sourceNodeId={moveModal.nodeId}
        sourceNodeType={moveModal.nodeType}
        sourceNodeTitle={moveModal.title}
        onClose={() =>
          setMoveModal((prev) => ({ ...prev, open: false }))
        }
        onConfirm={(targetSectionCode, targetChapterId) => {
          if (moveModal.nodeId) {
            transferCatalogNode(
              activeProjectId,
              book.id,
              moveModal.nodeId,
              targetSectionCode,
              targetChapterId
            );
          }
          setMoveModal((prev) => ({ ...prev, open: false }));
        }}
      />

      <CatalogBlockedModal
        open={blockedAlert.open}
        message={blockedAlert.message}
        onClose={() => setBlockedAlert({ open: false, message: '' })}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget?.isChapter ? '删除空章节' : '移出目录条目'}
        description={`确定要从谱书目录中移除「${deleteTarget?.title || ''}」吗？此操作仅影响当前谱书编排，不会删除原谱文库或世系图中的数据。`}
        confirmLabel="确认移除"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            const res = removeCatalogNode(
              activeProjectId,
              book.id,
              deleteTarget.id
            );
            if (res.blocked && res.reason) {
              setBlockedAlert({ open: true, message: res.reason });
            }
          }
          setDeleteTarget(null);
        }}
      />
    </div>
  );
};
