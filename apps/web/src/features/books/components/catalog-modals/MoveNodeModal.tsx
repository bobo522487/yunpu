import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, FolderOpen, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { BookRecord, CatalogSectionCode } from '../../types';

interface MoveNodeModalProps {
  open: boolean;
  book: BookRecord;
  sourceNodeId: string | null;
  sourceNodeType: 'chapter' | 'article' | 'lineage' | null;
  sourceNodeTitle: string;
  onClose: () => void;
  onConfirm: (
    targetSectionCode: CatalogSectionCode,
    targetChapterId?: string,
  ) => void;
}

export const MoveNodeModal: React.FC<MoveNodeModalProps> = ({
  open,
  book,
  sourceNodeId,
  sourceNodeType,
  sourceNodeTitle,
  onClose,
  onConfirm,
}) => {
  const [selectedKey, setSelectedKey] = useState<string>('body::');

  useEffect(() => {
    if (!open) return;
    setSelectedKey('body::');
  }, [open]);

  if (!open || !sourceNodeId) return null;

  const sections = (
    ['preface', 'body', 'lineage', 'appendix'] as CatalogSectionCode[]
  ).map((code) => book.sections[code]);

  const handleConfirm = () => {
    const [secCode, chId] = selectedKey.split('::');
    onConfirm(secCode as CatalogSectionCode, chId || undefined);
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
      <div className="relative z-10 w-full max-w-[460px] rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-foreground truncate">
              迁出「{sourceNodeTitle}」
            </h3>
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

        <div className="p-4 max-h-[360px] overflow-y-auto space-y-2">
          <p className="text-[12px] text-muted-foreground mb-2">
            请选择目标栏目或章节位置：
          </p>
          {sections.map((sec) => {
            const isSecDisabled =
              sourceNodeType === 'lineage' && sec.code === 'preface';
            const secKey = `${sec.code}::`;
            return (
              <div key={sec.code} className="space-y-1">
                <label
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-[13px] transition-colors ${
                    isSecDisabled
                      ? 'opacity-40 cursor-not-allowed border-border bg-muted/30'
                      : selectedKey === secKey
                        ? 'border-primary bg-primary/[0.08] font-medium cursor-pointer'
                        : 'border-border hover:bg-[var(--surface-hover)] cursor-pointer'
                  }`}
                >
                  <input
                    type="radio"
                    name="moveTarget"
                    disabled={isSecDisabled}
                    checked={selectedKey === secKey}
                    onChange={() => setSelectedKey(secKey)}
                    className="accent-[var(--primary)]"
                  />
                  <FolderOpen size={14} className="text-primary shrink-0" />
                  <span className="truncate">{sec.label}（顶级目录）</span>
                </label>

                {sourceNodeType !== 'chapter' &&
                  sec.items
                    .filter((n) => n.nodeType === 'chapter')
                    .map((ch) => {
                      const chKey = `${sec.code}::${ch.id}`;
                      const disabled = isSecDisabled || ch.id === sourceNodeId;
                      return (
                        <label
                          key={ch.id}
                          className={`ml-5 flex items-center gap-2.5 px-3 py-1.5 rounded-lg border text-[12px] transition-colors ${
                            disabled
                              ? 'opacity-40 cursor-not-allowed border-border'
                              : selectedKey === chKey
                                ? 'border-primary bg-primary/[0.08] font-medium cursor-pointer'
                                : 'border-border/70 hover:bg-[var(--surface-hover)] cursor-pointer'
                          }`}
                        >
                          <input
                            type="radio"
                            name="moveTarget"
                            disabled={disabled}
                            checked={selectedKey === chKey}
                            onChange={() => setSelectedKey(chKey)}
                            className="accent-[var(--primary)]"
                          />
                          <ArrowRight
                            size={12}
                            className="text-muted-foreground shrink-0"
                          />
                          <span className="truncate">
                            {ch.nodeType === 'chapter' ? ch.title : ''}
                          </span>
                        </label>
                      );
                    })}
              </div>
            );
          })}
        </div>

        <div className="px-5 py-3 border-t border-border bg-[var(--surface-subtle)] flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button type="button" size="sm" onClick={handleConfirm}>
            确认迁出
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
