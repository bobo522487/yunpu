import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useActiveProject } from '../../../../hooks/useActiveProject';
import { useArticleStore } from '../../../../store/useArticleStore';
import type { CatalogArticleNode } from '../../types';
import { flattenArticleTree } from './articleTreeUtils';

interface EditCatalogDocModalProps {
  open: boolean;
  node: CatalogArticleNode | null;
  onClose: () => void;
  onSubmit: (updates: {
    displayTitle: string;
    sourceArticleId: string;
    sourceTitle: string;
  }) => void;
}

export const EditCatalogDocModal: React.FC<EditCatalogDocModalProps> = ({
  open,
  node,
  onClose,
  onSubmit,
}) => {
  const { projectId: activeProjectId } = useActiveProject();
  const articleTreesByProject = useArticleStore((s) => s.treesByProject);
  const articlesByKey = useArticleStore((s) => s.articlesByKey);

  const [displayTitle, setDisplayTitle] = useState('');
  const [selectedSourceId, setSelectedSourceId] = useState('');

  const allArticles = useMemo(() => {
    const tree = articleTreesByProject[activeProjectId] || [];
    return flattenArticleTree(tree, articlesByKey, activeProjectId);
  }, [articleTreesByProject, activeProjectId, articlesByKey]);

  useEffect(() => {
    if (!open || !node) return;
    setDisplayTitle(node.displayTitle);
    setSelectedSourceId(node.sourceArticleId);
  }, [open, node]);

  if (!open || !node) return null;

  const pickedSource = allArticles.find((a) => a.id === selectedSourceId);
  const currentSourceTitle = pickedSource?.title || node.sourceTitle;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      displayTitle: displayTitle.trim() || currentSourceTitle,
      sourceArticleId: selectedSourceId || node.sourceArticleId,
      sourceTitle: currentSourceTitle,
    });
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
      <div className="relative z-10 w-full max-w-[480px] rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <h3 className="text-[15px] font-semibold text-foreground">
            编辑谱文目录条目
          </h3>
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

        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="catalogDocTitle">目录显示标题</Label>
              <Input
                id="catalogDocTitle"
                value={displayTitle}
                onChange={(e) => setDisplayTitle(e.target.value)}
                placeholder="输入在谱书目录中显示的标题"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="catalogDocSource">引用谱文来源</Label>
              <select
                id="catalogDocSource"
                value={selectedSourceId}
                onChange={(e) => setSelectedSourceId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-card px-3 text-[13px] text-foreground transition-all duration-150 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary focus:shadow-[var(--shadow-focus-halo)]"
              >
                {allArticles.map((art) => (
                  <option key={art.id} value={art.id}>
                    {art.folderName} / {art.title}
                  </option>
                ))}
                {!allArticles.some((a) => a.id === node.sourceArticleId) && (
                  <option value={node.sourceArticleId}>
                    {node.sourceTitle}
                  </option>
                )}
              </select>
              <p className="text-[12px] text-muted-foreground">
                当前引用：{currentSourceTitle}
              </p>
            </div>
          </div>

          <div className="px-5 py-3 border-t border-border bg-[var(--surface-subtle)] flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" size="sm">
              保存修改
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
};
