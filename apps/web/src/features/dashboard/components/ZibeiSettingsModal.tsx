import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalShell,
} from '@/components/ui/modal';

interface ZibeiSettingsModalProps {
  open: boolean;
  familyName: string;
  surname?: string | null;
  initialWords: string[];
  onClose: () => void;
  onSave: (words: string[]) => void;
}

function parseZibeiInput(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (/[\s,，、;；|/\n]+/.test(trimmed)) {
    return trimmed
      .split(/[\s,，、;；|/\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return Array.from(trimmed).filter((ch) => ch.trim().length > 0);
}

export const ZibeiSettingsModal: React.FC<ZibeiSettingsModalProps> = ({
  open,
  familyName,
  surname,
  initialWords,
  onClose,
  onSave,
}) => {
  const [rawText, setRawText] = useState('');

  useEffect(() => {
    if (open) {
      setRawText(initialWords.join(' '));
    }
  }, [open, initialWords]);

  const parsedWords = useMemo(() => parseZibeiInput(rawText), [rawText]);
  const surnameChar = (surname?.trim() || familyName.trim().slice(0, 1) || '谱').slice(0, 1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(parsedWords);
    onClose();
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      size="md"
      zIndexClass="z-[95]"
      ariaLabelledBy="zibei-modal-title"
    >
      <ModalHeader
        title={`设置字辈 · ${familyName}`}
        titleId="zibei-modal-title"
        icon={
          <div className="w-7 h-7 rounded-md bg-[var(--surface-active)] border border-primary/25 text-primary font-serif font-bold text-[15px] flex items-center justify-center shrink-0">
            {surnameChar}
          </div>
        }
        onClose={onClose}
      />

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <ModalBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="zibei-sequence-input">字辈排行序列</Label>
            <Textarea
              id="zibei-sequence-input"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={3}
              autoFocus
              placeholder="请输入字辈用字，可用空格或逗号分隔（例如：忠 厚 传 家 久 诗 书 继 世 长）"
              className="resize-none font-serif text-[15px] leading-relaxed"
            />
            <p className="text-[12px] text-muted-foreground">
              支持空格、逗号分隔或连续输入，系统将按输入顺序依次对应第一世至第{' '}
              <span className="font-mono tabular-nums">{Math.max(parsedWords.length, 1)}</span> 世。
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-[12px]">
              <span className="font-medium text-muted-foreground tabular-nums">
                世次对照预览（共 {parsedWords.length} 世）
              </span>
              {parsedWords.length > 0 && (
                <button
                  type="button"
                  onClick={() => setRawText('')}
                  className="text-muted-foreground hover:text-destructive cursor-pointer transition-colors"
                >
                  清空重填
                </button>
              )}
            </div>

            {parsedWords.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-[var(--surface-subtle)/0.6] px-4 py-6 text-center text-[13px] text-muted-foreground">
                暂未录入字辈，可在上方输入传统堂训或五言/七言字辈诗。
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-2 max-h-44 overflow-y-auto p-2.5 rounded-lg border border-border bg-[var(--surface-subtle)/0.55]">
                {parsedWords.map((word, idx) => (
                  <div
                    key={`${idx}-${word}`}
                    className="rounded-md border border-border bg-card px-2 py-1.5 text-center"
                  >
                    <div className="text-[12px] text-muted-foreground font-mono tabular-nums">
                      第{idx + 1}世
                    </div>
                    <div className="font-serif text-[15px] font-semibold text-foreground mt-0.5">
                      {word}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ModalBody>

        <ModalFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" size="sm">
            保存字辈
          </Button>
        </ModalFooter>
      </form>
    </ModalShell>
  );
};
