import React, { useEffect, useMemo, useState } from 'react';
import { History, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModalShell } from '@/components/ui/modal';
import { useAuthStore } from '../../auth/useAuthStore';
import { useArticleActions, useArticleRevisionsQuery } from '../queries';
import {
  diffArticleParagraphs,
  type ArticleBlockDiff,
} from '../domain/articleDiff';
import type { ArticleDocument, ArticleRevision } from '../types';

const EMPTY_REVISIONS: ArticleRevision[] = [];

export interface ArticleRevisionModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  article: ArticleDocument;
  onFlushPendingSave?: () => void;
}

export const ArticleRevisionModal: React.FC<ArticleRevisionModalProps> = ({
  open,
  onClose,
  projectId,
  article,
  onFlushPendingSave,
}) => {
  const { data: revisions = EMPTY_REVISIONS } = useArticleRevisionsQuery(
    projectId,
    article.id,
    open,
  );
  const { restoreRevision } = useArticleActions(projectId);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const latest = revisions[revisions.length - 1];
    setSelectedId(latest?.id ?? null);
  }, [open, revisions]);

  const selected = useMemo(
    () => revisions.find((r) => r.id === selectedId) ?? null,
    [revisions, selectedId],
  );

  const diff = useMemo(() => {
    if (!selected?.contentJson || !article.contentJson) return [];
    return diffArticleParagraphs(selected.contentJson, article.contentJson);
  }, [selected, article.contentJson]);

  const handleRestore = () => {
    if (!selected) return;
    onFlushPendingSave?.();
    const authorName =
      useAuthStore.getState().user?.name || '家族编委会';
    void restoreRevision(article.id, selected.id, authorName);
    onClose();
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      size="2xl"
      zIndexClass="z-[96]"
      ariaLabelledBy="articleRevisionModalTitle"
      data-testid="article-revision-modal"
    >
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
        <h3
          id="articleRevisionModalTitle"
          className="text-[15px] font-semibold text-foreground flex items-center gap-2"
        >
          <History size={16} className="text-primary shrink-0" />
          修订历史
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full"
          onClick={onClose}
          aria-label="关闭"
        >
          <X size={15} />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] min-h-[360px] max-h-[70vh]">
        <aside className="border-b md:border-b-0 md:border-r border-border overflow-y-auto p-2 space-y-1">
          {revisions.length === 0 ? (
            <p className="text-[12px] text-muted-foreground px-2 py-4">
              尚无修订记录
            </p>
          ) : (
            revisions.map((rev) => (
              <button
                key={rev.id}
                type="button"
                onClick={() => setSelectedId(rev.id)}
                className={`w-full text-left rounded-lg px-3 py-2 transition-colors cursor-pointer ${
                  rev.id === selectedId
                    ? 'bg-primary/10 border border-primary/25'
                    : 'hover:bg-muted/60 border border-transparent'
                }`}
              >
                <p className="text-[12px] font-medium text-foreground truncate">
                  {rev.summary || `版本 ${rev.version}`}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {rev.createdAt} · {rev.authorName}
                </p>
              </button>
            ))
          )}
        </aside>

        <div className="flex flex-col min-h-0 overflow-hidden">
          {!selected ? (
            <div className="flex items-center justify-center p-8 text-[13px] text-muted-foreground flex-1">
              请选择一条修订
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between gap-3">
                <p className="text-[12px] text-muted-foreground min-w-0 truncate">
                  对比修订版本 {selected.version} 与当前正文（删除红 / 新增绿）
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0 h-8 gap-1.5"
                  onClick={handleRestore}
                >
                  <RotateCcw size={13} />
                  回滚到此版本
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {diff.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground">
                    段落内容无差异
                  </p>
                ) : (
                  diff.map((item, index) => (
                    <DiffLine key={`${index}-${item.kind}`} item={item} />
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </ModalShell>
  );
};

function DiffLine({ item }: { item: ArticleBlockDiff }) {
  if (item.kind === 'same') {
    return (
      <p className="text-[13px] text-foreground/80 leading-relaxed whitespace-pre-wrap">
        {item.text || '（空段）'}
      </p>
    );
  }
  const colorClass =
    item.kind === 'removed'
      ? 'text-red-600 dark:text-red-400 bg-red-500/10'
      : 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10';
  const prefix = item.kind === 'removed' ? '−' : '+';
  return (
    <p
      className={`text-[13px] leading-relaxed whitespace-pre-wrap rounded px-2 py-1 ${colorClass}`}
    >
      <span className="font-mono text-[11px] mr-1.5 opacity-70">{prefix}</span>
      {item.text || '（空段）'}
    </p>
  );
}