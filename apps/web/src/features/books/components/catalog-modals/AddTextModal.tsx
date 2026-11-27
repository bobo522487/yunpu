import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, Plus, ScrollText, Search, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useActiveProject } from '../../../../hooks/useActiveProject';
import { useProjectArticlesSnapshot } from '../../../articles/queries';
import { type ArticleListItem, flattenArticleTree } from './articleTreeUtils';

interface AddTextModalProps {
  open: boolean;
  targetLabel: string;
  onClose: () => void;
  onConfirm: (
    selected: Array<{ sourceArticleId: string; sourceTitle: string }>,
  ) => void;
}

export const AddTextModal: React.FC<AddTextModalProps> = ({
  open,
  targetLabel,
  onClose,
  onConfirm,
}) => {
  const { projectId: activeProjectId } = useActiveProject();
  const { articleTree, articlesByKey } =
    useProjectArticlesSnapshot(activeProjectId);

  const [search, setSearch] = useState('');
  const [queue, setQueue] = useState<ArticleListItem[]>([]);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setQueue([]);
  }, [open]);

  const allArticles = useMemo(
    () => flattenArticleTree(articleTree, articlesByKey, activeProjectId),
    [articleTree, activeProjectId, articlesByKey],
  );

  const filteredArticles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allArticles;
    return allArticles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.folderName.toLowerCase().includes(q),
    );
  }, [allArticles, search]);

  if (!open) return null;

  const addToQueue = (art: ArticleListItem) => {
    setQueue((prev) => [...prev, art]);
  };

  const moveQueueItem = (index: number, dir: -1 | 1) => {
    const nextIdx = index + dir;
    if (nextIdx < 0 || nextIdx >= queue.length) return;
    setQueue((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIdx, 0, item);
      return copy;
    });
  };

  const removeQueueItem = (index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-xs"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-[780px] rounded-xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <ScrollText size={16} className="text-primary shrink-0" />
            <h3 className="text-[15px] font-semibold text-foreground truncate">
              选择谱文加入目录
            </h3>
            <span className="text-[12px] text-muted-foreground truncate">
              · {targetLabel}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={onClose}
          >
            <X size={15} />
          </Button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border overflow-hidden">
          <div className="flex flex-col min-h-[280px] overflow-hidden">
            <div className="p-3 border-b border-border bg-[var(--surface-subtle)] space-y-2 shrink-0">
              <div className="text-[12px] font-semibold text-foreground">
                家族谱文库 ({allArticles.length} 篇)
              </div>
              <div className="relative">
                <Search
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  placeholder="搜索谱文标题或卷目..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-[12px]"
                />
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
              {filteredArticles.map((art) => (
                <button
                  key={art.id}
                  type="button"
                  onClick={() => addToQueue(art)}
                  className="w-full text-left px-3 py-2 rounded-lg border border-transparent hover:border-border hover:bg-[var(--surface-hover)] transition-colors flex items-center justify-between gap-2 cursor-pointer group"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-foreground truncate">
                      {art.title}
                    </div>
                    <div className="text-[12px] text-muted-foreground font-mono tabular-nums truncate">
                      {art.folderName} · {art.wordCount} 字
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[12px] font-medium text-primary opacity-80 group-hover:opacity-100 shrink-0">
                    <Plus size={13} />
                    添加
                  </span>
                </button>
              ))}
              {filteredArticles.length === 0 && (
                <div className="py-10 text-center text-[12px] text-muted-foreground">
                  暂无匹配的谱文
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col min-h-[280px] overflow-hidden bg-background/40">
            <div className="px-3.5 py-3 border-b border-border bg-[var(--surface-subtle)] flex items-center justify-between shrink-0">
              <span className="text-[12px] font-semibold text-foreground">
                已选谱文队列
              </span>
              <span className="text-[12px] text-muted-foreground font-mono tabular-nums">
                {queue.length} 篇
              </span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
              {queue.map((item, idx) => (
                <div
                  key={`${item.id}-${idx}`}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border bg-card"
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="text-[12px] font-medium text-muted-foreground font-mono tabular-nums w-5 shrink-0">
                      {idx + 1}.
                    </span>
                    <span className="text-[13px] font-medium text-foreground truncate">
                      {item.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveQueueItem(idx, -1)}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 cursor-pointer"
                      title="上移"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === queue.length - 1}
                      onClick={() => moveQueueItem(idx, 1)}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 cursor-pointer"
                      title="下移"
                    >
                      <ArrowDown size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeQueueItem(idx)}
                      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                      title="移除"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
              {queue.length === 0 && (
                <div className="h-full flex items-center justify-center text-[12px] text-muted-foreground py-12 px-4 text-center">
                  点击左侧任意谱文即可按顺序加入右侧编排队列
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border bg-[var(--surface-subtle)] flex justify-end gap-2 shrink-0">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={queue.length === 0}
            onClick={() =>
              onConfirm(
                queue.map((q) => ({
                  sourceArticleId: q.id,
                  sourceTitle: q.title,
                })),
              )
            }
          >
            确认加入 ({queue.length})
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
