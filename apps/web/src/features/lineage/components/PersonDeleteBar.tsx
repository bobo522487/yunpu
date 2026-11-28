import React from 'react';
import { Trash2 } from 'lucide-react';

interface PersonDeleteBarProps {
  isRoot: boolean;
  displayName: string;
  confirming: boolean;
  onStartConfirm: () => void;
  onCancelConfirm: () => void;
  onConfirmDelete: () => void;
}

export const PersonDeleteBar: React.FC<PersonDeleteBarProps> = ({
  isRoot,
  displayName,
  confirming,
  onStartConfirm,
  onCancelConfirm,
  onConfirmDelete,
}) => {
  return (
    <div className="shrink-0 border-t border-border bg-[var(--surface-subtle)] px-5 py-3.5">
      {isRoot ? (
        <p className="text-center text-[12px] text-muted-foreground select-none">
          开基始祖节点不可从谱系中删除
        </p>
      ) : !confirming ? (
        <button
          type="button"
          data-testid="drawer-delete-person-button"
          onClick={onStartConfirm}
          className="w-full h-9 rounded-md border border-destructive/30 bg-card text-[13px] font-semibold text-destructive hover:bg-destructive/10 hover:border-destructive/60 transition-colors flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
        >
          <Trash2 size={14} aria-hidden="true" />
          <span>删除此人</span>
        </button>
      ) : (
        <div className="space-y-2.5">
          <p className="text-[13px] text-center font-medium text-destructive">
            确认从谱系中删除「{displayName}」？
          </p>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onCancelConfirm}
              className="flex-1 h-9 rounded-md border border-border bg-card text-[13px] font-semibold text-foreground hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              data-testid="drawer-confirm-delete-person-button"
              onClick={onConfirmDelete}
              className="flex-1 h-9 rounded-md bg-destructive hover:bg-destructive/90 text-[13px] font-semibold text-destructive-foreground shadow-xs transition-colors cursor-pointer"
            >
              确认删除
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
