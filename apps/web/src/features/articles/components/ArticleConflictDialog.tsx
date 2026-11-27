import React, { useMemo, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModalShell } from '@/components/ui/modal';
import {
  diffArticleParagraphs,
  type ArticleBlockDiff,
} from '../domain/articleDiff';
import type { ArticleDocument } from '../types';

export interface ArticleConflictDialogProps {
  open: boolean;
  local: ArticleDocument;
  server: ArticleDocument;
  onChoose: (choice: 'keep-local' | 'take-server') => void;
}

export const ArticleConflictDialog: React.FC<ArticleConflictDialogProps> = ({
  open,
  local,
  server,
  onChoose,
}) => {
  const diffRef = useRef<HTMLDivElement>(null);

  const diff = useMemo(
    () =>
      diffArticleParagraphs(
        server.contentJson ?? { type: 'doc' },
        local.contentJson ?? { type: 'doc' },
      ),
    [server.contentJson, local.contentJson],
  );

  const scrollToDiff = () => {
    diffRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <ModalShell
      open={open}
      onClose={() => {}}
      size="2xl"
      zIndexClass="z-[97]"
      ariaLabelledBy="articleConflictDialogTitle"
      data-testid="article-conflict-dialog"
    >
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
        <h3
          id="articleConflictDialogTitle"
          className="text-[15px] font-semibold text-foreground flex items-center gap-2"
        >
          <AlertTriangle size={16} className="text-amber-500 shrink-0" />
          谱文版本冲突
        </h3>
        <span className="text-[12px] text-muted-foreground tabular-nums">
          本地 v{local.version} · 服务器 v{server.version}
        </span>
      </div>

      <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          保存时服务器已有更新的版本。请对比差异后选择保留本地副本（将以服务器版本号重新提交）或拉取最新内容。
        </p>

        <div ref={diffRef} className="space-y-2 border border-border rounded-lg p-4 bg-[var(--surface-subtle)]">
          <p className="text-[12px] font-medium text-foreground mb-2">
            段落差异（红=服务器 / 绿=本地）
          </p>
          {diff.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">段落内容无差异</p>
          ) : (
            diff.map((item, index) => (
              <DiffLine key={`${index}-${item.kind}`} item={item} />
            ))
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-3.5 border-t border-border shrink-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-[13px]"
          onClick={scrollToDiff}
        >
          对比差异
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-8 text-[13px]"
          onClick={() => onChoose('keep-local')}
        >
          保留我的副本
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8 text-[13px]"
          onClick={() => onChoose('take-server')}
        >
          拉取最新
        </Button>
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