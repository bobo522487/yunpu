import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, ScrollText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PRIVACY_LABELS, STATUS_LABELS } from '../articleLabels';
import { ARTICLE_TEMPLATES } from '../domain/articleTemplates';
import type { ArticleMetaInput, ArticlePrivacy, ArticleStatus } from '../types';

export interface ArticleMetaModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialValue?: Partial<ArticleMetaInput>;
  onClose: () => void;
  onSubmit: (values: ArticleMetaInput) => void;
}

export const ArticleMetaModal: React.FC<ArticleMetaModalProps> = ({
  open,
  mode,
  initialValue,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [author, setAuthor] = useState('');
  const [templateId, setTemplateId] = useState('blank');
  const [status, setStatus] = useState<ArticleStatus>('draft');
  const [privacy, setPrivacy] = useState<ArticlePrivacy>('clan');
  const [titleError, setTitleError] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitleError('');
    setTitle(initialValue?.title ?? '');
    setSubtitle(initialValue?.subtitle ?? '');
    setAuthor(initialValue?.author ?? '家族编委会');
    setTemplateId(initialValue?.templateId ?? 'blank');
    setStatus(initialValue?.status ?? 'draft');
    setPrivacy(initialValue?.privacy ?? 'clan');
  }, [open, initialValue]);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setTitleError('请输入谱文标题');
      return;
    }
    const template = ARTICLE_TEMPLATES.find((t) => t.id === templateId);
    onSubmit({
      title: title.trim(),
      subtitle:
        subtitle.trim() ||
        (mode === 'create' ? template?.defaultSubtitle : undefined) ||
        undefined,
      author: author.trim() || undefined,
      status,
      privacy,
      ...(mode === 'create'
        ? {
            templateId,
            docType: template?.docType ?? 'custom',
          }
        : {}),
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="articleMetaModalTitle"
    >
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-xs"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-[460px] rounded-xl border border-border bg-card text-card-foreground shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-card">
          <h3
            id="articleMetaModalTitle"
            className="text-[15px] font-semibold text-foreground flex items-center gap-2.5 min-w-0"
          >
            <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              {mode === 'create' ? (
                <ScrollText className="w-4 h-4" />
              ) : (
                <Pencil className="w-3.5 h-3.5" />
              )}
            </span>
            <span className="truncate">
              {mode === 'create' ? '新建谱文' : '编辑谱文属性'}
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
                htmlFor="articleMetaTitle"
                className="flex items-center gap-1"
              >
                <span>篇名标题</span>
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="articleMetaTitle"
                placeholder="例如：重修族谱序、家训十则"
                type="text"
                autoFocus
                autoComplete="off"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (titleError) setTitleError('');
                }}
                className={
                  titleError
                    ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20'
                    : ''
                }
              />
              {titleError && (
                <p className="text-[12px] text-destructive">{titleError}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="articleMetaSubtitle" className="block">
                副标题 / 卷次题注
              </Label>
              <Input
                id="articleMetaSubtitle"
                placeholder="例如：卷首 · 编修缘起"
                type="text"
                autoComplete="off"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="articleMetaStatus" className="block">
                  审校状态
                </Label>
                <select
                  id="articleMetaStatus"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ArticleStatus)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {(Object.keys(STATUS_LABELS) as ArticleStatus[]).map((key) => (
                    <option key={key} value={key}>
                      {STATUS_LABELS[key]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="articleMetaPrivacy" className="block">
                  可见范围
                </Label>
                <select
                  id="articleMetaPrivacy"
                  value={privacy}
                  onChange={(e) => setPrivacy(e.target.value as ArticlePrivacy)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {(Object.keys(PRIVACY_LABELS) as ArticlePrivacy[]).map((key) => (
                    <option key={key} value={key}>
                      {PRIVACY_LABELS[key]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="articleMetaAuthor" className="block">
                撰稿 / 编修落款
              </Label>
              <Input
                id="articleMetaAuthor"
                placeholder="例如：家族编委会"
                type="text"
                autoComplete="off"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
              />
            </div>

            {mode === 'create' && (
              <div className="space-y-2">
                <Label className="block">篇目模板</Label>
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {ARTICLE_TEMPLATES.map((tpl) => (
                    <label
                      key={tpl.id}
                      className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                        templateId === tpl.id
                          ? 'border-primary bg-primary/8'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="articleTemplate"
                        value={tpl.id}
                        checked={templateId === tpl.id}
                        onChange={() => {
                          setTemplateId(tpl.id);
                          if (!subtitle.trim() && tpl.defaultSubtitle) {
                            setSubtitle(tpl.defaultSubtitle);
                          }
                        }}
                        className="mt-0.5 shrink-0"
                      />
                      <span className="min-w-0">
                        <span className="text-[13px] font-medium text-foreground block">
                          {tpl.name}
                        </span>
                        <span className="text-[12px] text-muted-foreground leading-snug">
                          {tpl.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
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
              确认
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
