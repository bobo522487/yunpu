import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  Eye,
  Info,
  Printer,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProjectId } from '../../../hooks/useProjectId';
import ConfirmDialog from '../../dashboard/components/ConfirmDialog';
import { useBookActions, useBookEditionsQuery } from '../queries';
import {
  BINDING_LABELS,
  generateProofHtmlDocument,
  LINEAGE_STYLE_LABELS,
  PAPER_SIZE_LABELS,
} from '../bookCompiler';
import type { BookArticleAuditIssue } from '../domain/bookArticleAudit';
import type { BookEdition, BookRecord } from '../types';
import { BookCoverThumb } from './BookCoverThumb';
import { BookReaderModal } from './BookReaderModal';
import { HelpTipButton } from './HelpTipButton';

const EMPTY_EDITIONS: BookEdition[] = [];

interface BookEditionsStepProps {
  book: BookRecord;
  auditIssues?: BookArticleAuditIssue[];
  onGenerateNewEdition: () => void;
}

function triggerHtmlDownload(filename: string, html: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const BookEditionsStep: React.FC<BookEditionsStepProps> = ({
  book,
  auditIssues = [],
  onGenerateNewEdition,
}) => {
  const activeProjectId = useProjectId();
  const { deleteEdition, finalizeEditionPrint } =
    useBookActions(activeProjectId);
  const { data: editions = EMPTY_EDITIONS } = useBookEditionsQuery(
    activeProjectId,
    book.id,
  );

  const [readerEdition, setReaderEdition] = useState<BookEdition | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BookEdition | null>(null);
  const [actionToast, setActionToast] = useState<string>('');

  const notify = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => {
      setActionToast((curr) => (curr === msg ? '' : curr));
    }, 2600);
  };

  const handleDownloadProof = (edition: BookEdition) => {
    const html = generateProofHtmlDocument(book, edition, 'proof');
    triggerHtmlDownload(`${book.bookName}-校对稿-${edition.createdAt.slice(0, 10)}.html`, html);
    notify('已导出校对稿文件');
  };

  const handleGeneratePrint = (edition: BookEdition) => {
    void finalizeEditionPrint(book.id, edition.id);
    const html = generateProofHtmlDocument(book, edition, 'print');
    triggerHtmlDownload(`${book.bookName}-高清印刷版-${edition.createdAt.slice(0, 10)}.html`, html);
    notify('已生成高清印刷版并开始下载');
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="yp-h2 text-foreground truncate">
              {book.bookName} · 谱例明细
            </h2>
            <span className="text-[13px] font-medium text-muted-foreground tabular-nums shrink-0">
              {editions.length} / 9
            </span>
            {actionToast && (
              <span className="text-[12px] text-primary font-medium truncate">
                {actionToast}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {auditIssues.length > 0 && (
              <span className="text-[12px] text-amber-700 dark:text-amber-300 font-medium">
                有 {auditIssues.length} 篇谱文尚未定稿或已删除
              </span>
            )}
            <Button
              type="button"
              size="sm"
              onClick={onGenerateNewEdition}
              disabled={editions.length >= 9}
              className="gap-1.5 whitespace-nowrap shrink-0"
            >
              <Sparkles size={14} />
              <span>生成新谱例</span>
            </Button>
          </div>
        </div>

        {/* Notice Banner */}
        <div className="rounded-xl border border-border bg-[var(--surface-subtle)] px-4 py-3 flex items-start gap-2.5 text-[12px] text-muted-foreground">
          <Info size={15} className="text-primary shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            每次点击「生成新谱例」，系统会将当前目录结构、谱文正文、谱系范围与版式参数固化为独立快照（单本谱书最多保留 9 份谱例）。若修改了目录或原谱文内容，请重新生成新谱例以查看最新成书效果。
          </p>
        </div>

        {/* Edition Cards */}
        {editions.length > 0 ? (
          <div className="space-y-3.5">
            {editions.map((edition, idx) => (
              <div
                key={edition.id}
                className="rounded-xl border border-border bg-card p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-[var(--border-strong)] transition-colors"
              >
                <div className="flex items-start gap-4 min-w-0">
                  <BookCoverThumb
                    bookName={book.bookName}
                    volumeNo={book.volumeNo}
                    bindingStyle={edition.bindingStyle}
                    size="md"
                  />

                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-semibold text-foreground">
                        谱例 #{editions.length - idx}
                      </span>
                      <span className="text-[12px] text-muted-foreground">
                        · {BINDING_LABELS[edition.bindingStyle]} ·{' '}
                        {LINEAGE_STYLE_LABELS[edition.lineageStyle]}
                      </span>
                      {edition.printStatus === 'finalized' && (
                        <span className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 size={13} />
                          <span>已出印刷版</span>
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground tabular-nums">
                      <span>
                        尺寸规格：{PAPER_SIZE_LABELS[edition.paperSize]}
                      </span>
                      <span>总页数：{edition.pageCount} 页</span>
                      <span className="inline-flex items-center gap-1">
                        <span>谱系人数：{edition.memberCount} 人</span>
                        <HelpTipButton tipKey="book-member-count" />
                      </span>
                      <span>
                        总字数：{edition.wordCount.toLocaleString()} 字
                      </span>
                    </div>

                    <div className="text-[12px] text-muted-foreground font-mono tabular-nums">
                      生成时间：{edition.createdAt}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 shrink-0 md:justify-end">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setReaderEdition(edition)}
                    className="h-8 gap-1.5 text-[12px] whitespace-nowrap"
                  >
                    <Eye size={13} />
                    <span>在线预览</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadProof(edition)}
                    className="h-8 gap-1.5 text-[12px] whitespace-nowrap"
                  >
                    <Download size={13} />
                    <span>下载校对稿</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleGeneratePrint(edition)}
                    className="h-8 gap-1.5 text-[12px] whitespace-nowrap"
                  >
                    <Printer size={13} />
                    <span>生成高清印刷版</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title="删除谱例"
                    onClick={() => setDeleteTarget(edition)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-card/60 py-14 px-6 text-center space-y-3">
            <p className="text-[13px] text-muted-foreground">
              当前谱书尚未生成谱例快照，点击上方「生成新谱例」即可实时编排并在线翻页阅读。
            </p>
            <Button
              type="button"
              size="sm"
              onClick={onGenerateNewEdition}
              className="gap-1.5"
            >
              <Sparkles size={14} />
              <span>立即生成首份谱例</span>
            </Button>
          </div>
        )}
      </div>

      <BookReaderModal
        open={Boolean(readerEdition)}
        book={book}
        edition={readerEdition}
        onClose={() => setReaderEdition(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="删除谱例"
        description={`确定要删除生成于 ${deleteTarget?.createdAt || ''} 的谱例快照吗？删除后不会影响当前目录编排与版式设置。`}
        confirmLabel="确认删除"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            void deleteEdition(book.id, deleteTarget.id);
          }
          setDeleteTarget(null);
        }}
      />
    </div>
  );
};
