import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sanitizeVolumeNo } from '../bookCompiler';
import type { BookMetaInput } from '../types';
import { HelpTipButton } from './HelpTipButton';

interface BookMetaModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialValue?: Partial<BookMetaInput>;
  onClose: () => void;
  onSubmit: (values: BookMetaInput) => void;
}

export const BookMetaModal: React.FC<BookMetaModalProps> = ({
  open,
  mode,
  initialValue,
  onClose,
  onSubmit,
}) => {
  const [bookName, setBookName] = useState('');
  const [headerName, setHeaderName] = useState('');
  const [hallName, setHallName] = useState('');
  const [volumeNo, setVolumeNo] = useState('');
  const [editor, setEditor] = useState('');
  const [compilationDate, setCompilationDate] = useState('');
  const [errors, setErrors] = useState<{
    bookName?: string;
    headerName?: string;
  }>({});
  const isComposingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setBookName(initialValue?.bookName ?? '');
    setHeaderName(initialValue?.headerName ?? '');
    setHallName(initialValue?.hallName ?? '');
    setVolumeNo(initialValue?.volumeNo ?? '卷一');
    setEditor(initialValue?.editor ?? '');
    setCompilationDate(
      initialValue?.compilationDate || new Date().toISOString().slice(0, 10)
    );
  }, [open, initialValue]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: { bookName?: string; headerName?: string } = {};
    if (!bookName.trim()) nextErrors.bookName = '请输入谱书名称';
    if (!headerName.trim()) nextErrors.headerName = '请输入谱眉名称';
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    onSubmit({
      bookName: bookName.trim(),
      headerName: headerName.trim(),
      hallName: hallName.trim(),
      volumeNo: sanitizeVolumeNo(volumeNo),
      editor: editor.trim(),
      compilationDate:
        compilationDate || new Date().toISOString().slice(0, 10),
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bookMetaModalTitle"
    >
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-xs"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-[480px] rounded-xl border border-border bg-card text-card-foreground shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-card">
          <h3
            id="bookMetaModalTitle"
            className="text-[15px] font-semibold text-foreground flex items-center gap-2.5 min-w-0"
          >
            <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              {mode === 'create' ? (
                <BookOpen className="w-4 h-4" />
              ) : (
                <Pencil className="w-3.5 h-3.5" />
              )}
            </span>
            <span className="truncate">
              {mode === 'create' ? '新建谱书' : '修改谱书信息'}
            </span>
          </h3>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full shrink-0"
            onClick={onClose}
            aria-label="关闭弹窗"
          >
            <X size={15} />
          </Button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="bookMetaName"
                className="flex items-center gap-1.5"
              >
                <span>谱书名称</span>
                <span className="text-destructive">*</span>
                <HelpTipButton tipKey="book-name" />
              </Label>
              <Input
                id="bookMetaName"
                placeholder="例如：清河张氏宗谱"
                type="text"
                autoFocus
                autoComplete="off"
                value={bookName}
                onChange={(e) => {
                  const val = e.target.value;
                  setBookName(val);
                  if (mode === 'create' && !headerName) {
                    setHeaderName(val);
                  }
                  if (errors.bookName) {
                    setErrors((prev) => ({ ...prev, bookName: undefined }));
                  }
                }}
                className={
                  errors.bookName
                    ? 'border-destructive focus-visible:border-destructive'
                    : ''
                }
              />
              {errors.bookName && (
                <p className="text-[12px] text-destructive">{errors.bookName}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="bookMetaHeader"
                className="flex items-center gap-1.5"
              >
                <span>谱眉名称</span>
                <span className="text-destructive">*</span>
                <HelpTipButton tipKey="book-header" />
              </Label>
              <Input
                id="bookMetaHeader"
                placeholder="例如：张氏宗谱"
                type="text"
                autoComplete="off"
                value={headerName}
                onChange={(e) => {
                  setHeaderName(e.target.value);
                  if (errors.headerName) {
                    setErrors((prev) => ({ ...prev, headerName: undefined }));
                  }
                }}
                className={
                  errors.headerName
                    ? 'border-destructive focus-visible:border-destructive'
                    : ''
                }
              />
              {errors.headerName && (
                <p className="text-[12px] text-destructive">
                  {errors.headerName}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="bookMetaHall"
                  className="flex items-center gap-1.5"
                >
                  <span>堂号</span>
                  <HelpTipButton tipKey="book-hall" />
                </Label>
                <Input
                  id="bookMetaHall"
                  placeholder="例如：百忍堂、敦睦堂"
                  type="text"
                  autoComplete="off"
                  value={hallName}
                  onChange={(e) => setHallName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="bookMetaVolume"
                  className="flex items-center gap-1.5"
                >
                  <span>卷号</span>
                  <HelpTipButton tipKey="book-volume" />
                </Label>
                <Input
                  id="bookMetaVolume"
                  placeholder="限5字，如：卷一"
                  type="text"
                  autoComplete="off"
                  value={volumeNo}
                  onCompositionStart={() => {
                    isComposingRef.current = true;
                  }}
                  onCompositionEnd={(e) => {
                    isComposingRef.current = false;
                    setVolumeNo(sanitizeVolumeNo(e.currentTarget.value));
                  }}
                  onChange={(e) => {
                    if (isComposingRef.current) {
                      setVolumeNo(e.target.value);
                    } else {
                      setVolumeNo(sanitizeVolumeNo(e.target.value));
                    }
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="bookMetaEditor" className="block">
                  编者
                </Label>
                <Input
                  id="bookMetaEditor"
                  placeholder="例如：编修委员会"
                  type="text"
                  autoComplete="off"
                  value={editor}
                  onChange={(e) => setEditor(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bookMetaDate" className="block">
                  编修日期
                </Label>
                <Input
                  id="bookMetaDate"
                  type="date"
                  value={compilationDate}
                  onChange={(e) => setCompilationDate(e.target.value)}
                  className="tabular-nums"
                />
              </div>
            </div>
          </div>

          <div className="px-6 py-3.5 border-t border-border bg-[var(--surface-subtle)] flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 h-9 font-medium"
            >
              取消
            </Button>
            <Button type="submit" className="flex-1 h-9 font-medium">
              {mode === 'create' ? '确认创建' : '保存修改'}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
