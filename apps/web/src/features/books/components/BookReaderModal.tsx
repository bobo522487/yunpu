import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Columns2,
  List,
  Printer,
  Square,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  formatPageNumberLabel,
  LINEAGE_STYLE_LABELS,
  toChineseNumeral,
} from '../bookCompiler';
import type {
  BookEdition,
  BookFontFamily,
  BookRecord,
  CompiledPage,
} from '../types';
import { FishtailOrnament } from './BookCoverThumb';

interface BookReaderModalProps {
  open: boolean;
  book: BookRecord;
  edition: BookEdition | null;
  onClose: () => void;
}

function getFontStack(font: BookFontFamily): string {
  switch (font) {
    case 'kai':
      return '"Kaiti SC", "STKaiti", "KaiTi", serif';
    case 'fangsong':
      return '"FangSong", "STFangsong", serif';
    case 'hei':
      return '"PingFang SC", "Microsoft YaHei", sans-serif';
    default:
      return '"Noto Serif SC", "Songti SC", "SimSun", serif';
  }
}

export const BookReaderModal: React.FC<BookReaderModalProps> = ({
  open,
  book,
  edition,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [spreadMode, setSpreadMode] = useState(false);
  const [showToc, setShowToc] = useState(true);
  const [zoom, setZoom] = useState(1);

  const pages = useMemo(() => edition?.pages ?? [], [edition?.pages]);

  useEffect(() => {
    if (!open) return;
    setCurrentIndex(0);
    setZoom(1);
  }, [open, edition?.id]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        setCurrentIndex((idx) =>
          Math.min(pages.length - 1, idx + (spreadMode ? 2 : 1))
        );
      } else if (e.key === 'ArrowLeft') {
        setCurrentIndex((idx) =>
          Math.max(0, idx - (spreadMode ? 2 : 1))
        );
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, pages.length, spreadMode, onClose]);

  const tocItems = useMemo(() => {
    const tocPage = pages.find((p) => p.type === 'toc');
    return tocPage?.tocEntries || [];
  }, [pages]);

  if (!open || !edition) return null;

  const layout = edition.layoutSnapshot;
  const borderClass =
    layout.borderStyle === 'double'
      ? 'border-[3px] border-double border-[#057091]/55 dark:border-[#58B1CD]/50'
      : layout.borderStyle === 'single'
        ? 'border border-[#057091]/55 dark:border-[#58B1CD]/50'
        : 'border border-transparent';

  const densityClass =
    layout.density === 'loose'
      ? 'text-[15px] leading-[2]'
      : layout.density === 'compact'
        ? 'text-[13px] leading-[1.65]'
        : 'text-[14px] leading-[1.85]';

  const visiblePages: CompiledPage[] = spreadMode
    ? pages.slice(currentIndex, currentIndex + 2)
    : pages.slice(currentIndex, currentIndex + 1);

  const jumpToPageNumber = (pageNo: number) => {
    const idx = pages.findIndex((p) => p.pageNo === pageNo);
    if (idx >= 0) {
      setCurrentIndex(spreadMode && idx % 2 === 1 ? idx - 1 : idx);
    }
  };

  const renderPageContent = (page: CompiledPage) => {
    if (page.type === 'cover') {
      const isThread = layout.bindingStyle === 'thread';
      return (
        <div
          className={`flex-1 flex flex-col justify-between p-8 rounded-sm relative overflow-hidden ${
            isThread
              ? 'bg-[#055873] text-[#F1F5F9]'
              : 'bg-[#057091] text-[#F1F5F9]'
          }`}
        >
          {isThread && (
            <div className="absolute right-4 top-6 bottom-6 w-1 flex flex-col justify-between items-center">
              {[0, 1, 2, 3].map((dot) => (
                <span
                  key={dot}
                  className="w-2 h-3 rounded-full bg-[#D9EEF4]/85"
                />
              ))}
            </div>
          )}

          <div className="flex justify-between items-start">
            <div className="text-[13px] tracking-[0.2em] opacity-85">
              {page.hallName} · {book.volumeNo || '卷一'}
            </div>
            <div className="bg-[#F7FAFA] text-[#1E293B] border-2 border-[#057091]/40 px-4 py-8 shadow-md">
              <div
                className="text-[24px] font-bold tracking-[0.22em]"
                style={{
                  writingMode: 'vertical-rl',
                  textOrientation: 'upright',
                }}
              >
                {book.bookName}
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-white/20 flex items-center justify-between text-[13px] opacity-90">
            <span>{book.editor || '家族编委会'} 编修</span>
            <span className="tabular-nums">{book.compilationDate}</span>
          </div>
        </div>
      );
    }

    if (page.type === 'toc') {
      return (
        <div className="flex-1 flex flex-col">
          <div className="text-center pb-3 mb-4 border-b border-[#057091]/35 dark:border-[#58B1CD]/35">
            <h2 className="text-[20px] font-bold tracking-[0.2em] text-[#1E293B] dark:text-slate-100">
              谱 书 总 目
            </h2>
          </div>
          <div className="space-y-2 flex-1 overflow-y-auto pr-1">
            {(page.tocEntries || []).length > 0 ? (
              (page.tocEntries || []).map((entry, i) => (
                <button
                  key={`${entry.title}-${entry.pageNo}-${i}`}
                  type="button"
                  onClick={() => jumpToPageNumber(entry.pageNo)}
                  className={`w-full flex items-baseline justify-between gap-3 py-1.5 border-b border-dashed border-[#CBD5E1] dark:border-slate-700 hover:text-[#057091] dark:hover:text-[#58B1CD] transition-colors text-left cursor-pointer ${
                    entry.level === 2 ? 'pl-5 text-[13px]' : 'font-semibold text-[14px]'
                  }`}
                >
                  <span className="truncate">
                    {entry.sectionLabel && entry.level === 1
                      ? `[${entry.sectionLabel}] `
                      : ''}
                    {entry.title}
                  </span>
                  <span className="text-[12px] text-[#64748B] dark:text-slate-400 tabular-nums shrink-0">
                    {formatPageNumberLabel(entry.pageNo, layout.pageNumberStyle)}
                  </span>
                </button>
              ))
            ) : (
              <div className="py-12 text-center text-[13px] text-[#64748B] dark:text-slate-400">
                暂无目录条目
              </div>
            )}
          </div>
        </div>
      );
    }

    if (page.type === 'article') {
      return (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="mb-4 pb-2 border-b border-[#CBD5E1] dark:border-slate-700">
            <h2 className="text-[19px] font-bold text-[#057091] dark:text-[#58B1CD]">
              {page.title}
            </h2>
            {page.author && (
              <div className="text-[12px] text-[#64748B] dark:text-slate-400 mt-1">
                {page.author}
              </div>
            )}
          </div>
          <div
            className={`flex-1 overflow-y-auto pr-1 prose prose-sm dark:prose-invert max-w-none text-[#1E293B] dark:text-slate-200 ${densityClass}`}
            dangerouslySetInnerHTML={{ __html: page.contentHtml || '' }}
          />
        </div>
      );
    }

    if (page.type === 'lineage_index') {
      return (
        <div className="flex-1 flex flex-col overflow-hidden">
          <h2 className="text-[17px] font-bold text-[#057091] dark:text-[#58B1CD] mb-3 pb-1.5 border-b border-[#CBD5E1] dark:border-slate-700">
            {page.title || '族丁检索表'}
          </h2>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="border-b-2 border-[#057091]/45 dark:border-[#58B1CD]/40 text-[#475569] dark:text-slate-300">
                  <th className="text-left py-1.5 px-2">世次</th>
                  <th className="text-left py-1.5 px-2">谱名</th>
                  <th className="text-left py-1.5 px-2">父讳</th>
                  <th className="text-right py-1.5 px-2">谱系页码</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] dark:divide-slate-700/80">
                {(page.indexRows || []).map((row, idx) => (
                  <tr key={`${row.name}-${idx}`}>
                    <td className="py-1.5 px-2 text-[#057091] dark:text-[#58B1CD] tabular-nums">
                      第{toChineseNumeral(row.generation)}世
                    </td>
                    <td className="py-1.5 px-2 font-semibold">{row.name}</td>
                    <td className="py-1.5 px-2 text-[#475569] dark:text-slate-300">
                      {row.fatherName}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums">
                      <button
                        type="button"
                        onClick={() => jumpToPageNumber(row.pageRef)}
                        className="text-[#057091] dark:text-[#58B1CD] hover:underline cursor-pointer"
                      >
                        {formatPageNumberLabel(
                          row.pageRef,
                          layout.pageNumberStyle
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (page.type === 'lineage_tree') {
      const persons = page.treePersons || [];
      const minGen = persons.reduce(
        (min, p) => Math.min(min, p.generation),
        persons[0]?.generation || 1
      );
      return (
        <div className="flex-1 flex flex-col overflow-hidden">
          <h2 className="text-[17px] font-bold text-[#057091] dark:text-[#58B1CD] mb-3 pb-1.5 border-b border-[#CBD5E1] dark:border-slate-700">
            {page.title || '吊线图'}
          </h2>
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {persons.map((tp) => {
              const offset = Math.max(0, tp.generation - minGen);
              return (
                <div
                  key={tp.id}
                  style={{ marginLeft: `${offset * 20}px` }}
                  className="flex items-center gap-2 py-1 px-2.5 rounded border border-[#CBD5E1] dark:border-slate-700 bg-[#EFF5F7] dark:bg-[#232A33] text-[12px]"
                >
                  {offset > 0 && (
                    <span className="text-[#64748B] dark:text-slate-400" aria-hidden="true">
                      └─
                    </span>
                  )}
                  <span className="text-[#057091] dark:text-[#58B1CD] font-semibold tabular-nums">
                    [{toChineseNumeral(tp.generation)}世]
                  </span>
                  <span className="font-bold text-[#1E293B] dark:text-slate-100">{tp.name}</span>
                  {tp.rank && (
                    <span className="text-[11px] text-[#64748B] dark:text-slate-400">
                      {tp.rank}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // lineage_table (欧式 / 苏式 / 现代双栏)
    const entries = page.lineageEntries || [];
    const style = page.lineageStyle || layout.lineageStyle;

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-3 pb-1.5 border-b border-[#CBD5E1] dark:border-slate-700">
          <h2 className="text-[17px] font-bold text-[#057091] dark:text-[#58B1CD]">
            {page.title || '谱系表'}
          </h2>
          <span className="text-[11px] text-[#64748B] dark:text-slate-400">
            {LINEAGE_STYLE_LABELS[style]}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          {style === 'modern_double' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="p-2.5 border border-[#CBD5E1] dark:border-slate-700 bg-[#EFF5F7]/75 dark:bg-[#232A33]/75 space-y-1"
                >
                  <div className="font-bold text-[14px] text-[#057091] dark:text-[#58B1CD]">
                    [第{toChineseNumeral(entry.generation)}世] {entry.name}
                  </div>
                  {entry.fatherName && (
                    <div className="text-[11px] text-[#64748B] dark:text-slate-400">
                      父：{entry.fatherName}
                    </div>
                  )}
                  <p className="text-[12px] leading-relaxed text-[#334155] dark:text-slate-200">
                    {entry.summaryText}
                  </p>
                </div>
              ))}
            </div>
          ) : style === 'su' ? (
            <div className="space-y-3">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="border-r-2 border-[#057091]/45 dark:border-[#58B1CD]/45 pr-3 py-1.5 border-b border-dashed border-[#CBD5E1] dark:border-slate-700"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[14px] text-[#1E293B] dark:text-slate-100">
                      {entry.name}
                      {entry.aliasesText ? `（${entry.aliasesText}）` : ''}
                    </span>
                    <span className="text-[11px] text-[#057091] dark:text-[#58B1CD] font-semibold">
                      第{toChineseNumeral(entry.generation)}世
                    </span>
                  </div>
                  <p className="text-[12px] leading-relaxed text-[#334155] dark:text-slate-300 mt-1">
                    {entry.fatherName ? `${entry.fatherName}之子。` : ''}
                    {entry.summaryText}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            // Euler 5-tier row style
            <div className="divide-y divide-[#CBD5E1] dark:divide-slate-700 border border-[#CBD5E1] dark:border-slate-700">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="grid grid-cols-[72px_1fr] divide-x divide-[#CBD5E1] dark:divide-slate-700"
                >
                  <div className="p-2 bg-[#EFF5F7] dark:bg-[#232A33] flex flex-col items-center justify-center text-center">
                    <span className="text-[11px] font-bold text-[#057091] dark:text-[#58B1CD]">
                      第{toChineseNumeral(entry.generation)}世
                    </span>
                    <span className="text-[14px] font-bold text-[#1E293B] dark:text-slate-100 mt-0.5">
                      {entry.name}
                    </span>
                  </div>
                  <div className="p-2.5 text-[12px] leading-relaxed text-[#334155] dark:text-slate-200">
                    {entry.fatherName && (
                      <span className="font-semibold text-[#475569] dark:text-slate-300">
                        {entry.fatherName}之子。
                      </span>
                    )}
                    {entry.summaryText}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex flex-col bg-background/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`${book.bookName} 在线翻页阅读器`}
    >
      {/* Top Reader Bar */}
      <header className="h-13 px-4 border-b border-border bg-card flex items-center justify-between gap-3 shrink-0 print:hidden">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowToc((v) => !v)}
            className="h-8 gap-1.5 text-[12px]"
          >
            <List size={14} />
            <span className="hidden sm:inline">目录</span>
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen size={15} className="text-primary shrink-0" />
            <span className="text-[14px] font-semibold text-foreground truncate">
              {book.bookName}
            </span>
            <span className="text-[12px] text-muted-foreground tabular-nums shrink-0">
              {currentIndex + 1} / {pages.length} 页
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            variant={spreadMode ? 'outline' : 'secondary'}
            size="sm"
            onClick={() => setSpreadMode(false)}
            className="h-8 px-2.5 gap-1 text-[12px]"
            title="单页阅读"
          >
            <Square size={13} />
            <span className="hidden md:inline">单页</span>
          </Button>
          <Button
            type="button"
            variant={spreadMode ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => {
              setSpreadMode(true);
              setCurrentIndex((idx) => (idx % 2 === 1 ? idx - 1 : idx));
            }}
            className="h-8 px-2.5 gap-1 text-[12px]"
            title="双页对开"
          >
            <Columns2 size={13} />
            <span className="hidden md:inline">对开</span>
          </Button>

          <div className="h-4 w-px bg-border mx-1" />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setZoom((z) => Math.max(0.75, +(z - 0.1).toFixed(2)))}
            title="缩小"
          >
            <ZoomOut size={14} />
          </Button>
          <span className="text-[12px] text-muted-foreground tabular-nums w-11 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setZoom((z) => Math.min(1.3, +(z + 0.1).toFixed(2)))}
            title="放大"
          >
            <ZoomIn size={14} />
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="h-8 gap-1 text-[12px] ml-1"
          >
            <Printer size={13} />
            <span className="hidden sm:inline">打印当前页</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 ml-1"
            onClick={onClose}
            aria-label="关闭阅读器"
          >
            <X size={16} />
          </Button>
        </div>
      </header>

      {/* Main Reader Body */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left TOC Sidebar */}
        {showToc && (
          <aside className="w-64 border-r border-border bg-card overflow-y-auto p-3 space-y-1 shrink-0 print:hidden">
            <div className="px-2 py-1.5 text-[12px] font-semibold text-muted-foreground">
              全书目录跳转
            </div>
            <button
              type="button"
              onClick={() => setCurrentIndex(0)}
              className={`w-full text-left px-2.5 py-1.5 rounded-md text-[12px] flex items-center justify-between transition-colors cursor-pointer ${
                currentIndex === 0
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'hover:bg-muted text-foreground/85'
              }`}
            >
              <span>封面题签</span>
              <span className="text-[12px] text-muted-foreground font-mono tabular-nums">
                1
              </span>
            </button>
            {tocItems.map((item, idx) => (
              <button
                key={`${item.title}-${idx}`}
                type="button"
                onClick={() => jumpToPageNumber(item.pageNo)}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-[12px] flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                  item.level === 2 ? 'pl-5' : 'font-medium'
                } ${
                  pages[currentIndex]?.pageNo === item.pageNo
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'hover:bg-muted text-foreground/85'
                }`}
              >
                <span className="truncate">{item.title}</span>
                <span className="text-[12px] text-muted-foreground font-mono tabular-nums shrink-0">
                  {item.pageNo}
                </span>
              </button>
            ))}
          </aside>
        )}

        {/* Center Page Stage */}
        <div className="flex-1 min-w-0 overflow-auto bg-[var(--surface-subtle)] p-4 md:p-8 flex flex-col items-center justify-center relative">
          <div
            className="flex items-stretch justify-center gap-4 transition-transform origin-center"
            style={{
              transform: `scale(${zoom})`,
              fontFamily: getFontStack(layout.fontFamily),
            }}
          >
            {visiblePages.map((page) => (
              <article
                key={page.pageNo}
                className="w-[540px] min-h-[720px] max-h-[760px] bg-[#F8FAFB] dark:bg-[#1A2129] text-[#1E293B] dark:text-slate-100 rounded-sm border border-[#CBD5E1] dark:border-slate-700 shadow-xl p-6 flex flex-col overflow-hidden"
              >
                {page.type === 'cover' ? (
                  renderPageContent(page)
                ) : (
                  <div className={`${borderClass} flex-1 p-5 flex flex-col overflow-hidden`}>
                    {/* Running Header with Fishtail */}
                    <div className="flex items-center justify-between gap-2 pb-2 mb-4 border-b border-[#057091]/35 dark:border-[#58B1CD]/35 text-[11px] text-[#64748B] dark:text-slate-400 shrink-0">
                      <span className="truncate">
                        {layout.showHeaderName ? page.headerTitle : ''}
                      </span>
                      <span className="flex items-center gap-1.5 text-[#057091] dark:text-[#58B1CD] font-semibold shrink-0">
                        <FishtailOrnament style={layout.fishtailStyle} className="text-[#057091] dark:text-[#58B1CD]" />
                        <span>{page.eyebrowTitle}</span>
                      </span>
                      <span className="truncate">
                        {layout.showHallName ? page.hallName : ''}
                      </span>
                    </div>

                    {renderPageContent(page)}

                    {/* Footer Page Number */}
                    <div className="pt-2 mt-4 border-t border-[#057091]/25 dark:border-[#58B1CD]/25 text-center text-[11px] text-[#64748B] dark:text-slate-400 tabular-nums shrink-0">
                      {formatPageNumberLabel(
                        page.pageNo,
                        layout.pageNumberStyle
                      )}
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>

          {/* Floating Prev / Next Controls */}
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-card/95 border border-border rounded-full px-3 py-1.5 shadow-lg print:hidden">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={currentIndex <= 0}
              onClick={() =>
                setCurrentIndex((idx) =>
                  Math.max(0, idx - (spreadMode ? 2 : 1))
                )
              }
              className="h-7 px-2 gap-1 text-[12px] rounded-full"
            >
              <ChevronLeft size={14} />
              <span>上一页</span>
            </Button>
            <span className="text-[12px] text-muted-foreground tabular-nums px-1">
              {currentIndex + 1} / {pages.length}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={currentIndex >= pages.length - (spreadMode ? 2 : 1)}
              onClick={() =>
                setCurrentIndex((idx) =>
                  Math.min(pages.length - 1, idx + (spreadMode ? 2 : 1))
                )
              }
              className="h-7 px-2 gap-1 text-[12px] rounded-full"
            >
              <span>下一页</span>
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
