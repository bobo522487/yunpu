import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HelpTipButton } from '../HelpTipButton';

interface ChapterModalProps {
  open: boolean;
  mode: 'create' | 'rename';
  sectionLabel?: string;
  initialTitle?: string;
  onClose: () => void;
  onSubmit: (title: string) => void;
}

export const AddChapterModal: React.FC<ChapterModalProps> = ({
  open,
  mode,
  sectionLabel,
  initialTitle = '',
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setTitle(initialTitle);
  }, [open, initialTitle]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('请输入章节名称');
      return;
    }
    onSubmit(title.trim());
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
      <div className="relative z-10 w-full max-w-[420px] rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
            <span>{mode === 'create' ? '添加章节' : '修改章节名称'}</span>
            {sectionLabel && (
              <span className="text-[12px] font-normal text-muted-foreground">
                · {sectionLabel}
              </span>
            )}
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

        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-2">
            <Label htmlFor="chapterTitleInput" className="flex items-center gap-1.5">
              <span>章节名称</span>
              <span className="text-destructive">*</span>
              <HelpTipButton tipKey="chapter-name" />
            </Label>
            <Input
              id="chapterTitleInput"
              autoFocus
              placeholder="例如：谱序凡例、先贤传略"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError('');
              }}
            />
            {error && <p className="text-[12px] text-destructive">{error}</p>}
          </div>

          <div className="px-5 py-3 border-t border-border bg-[var(--surface-subtle)] flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" size="sm">
              {mode === 'create' ? '确认添加' : '保存名称'}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
};
