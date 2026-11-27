import React from 'react';
import { BookOpen, Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProjectId } from '../../../hooks/useProjectId';
import { useBookActions } from '../queries';
import {
  BINDING_LABELS,
  formatPageNumberLabel,
  LINEAGE_STYLE_LABELS,
  PAPER_SIZE_LABELS,
} from '../bookCompiler';
import type {
  BookBindingStyle,
  BookBorderStyle,
  BookDensity,
  BookFishtailStyle,
  BookFontFamily,
  BookLayoutConfig,
  BookLineageStyle,
  BookPageNumberStyle,
  BookPaperSize,
  BookRecord,
} from '../types';
import { FishtailOrnament } from './BookCoverThumb';

interface BookLayoutStepProps {
  book: BookRecord;
  onSaveAndGenerate: () => void;
}

const FONT_LABELS: Record<BookFontFamily, string> = {
  song: '宋体（典雅古籍）',
  kai: '楷体（清秀儒雅）',
  fangsong: '仿宋（隽永清晰）',
  hei: '黑体（现代明快）',
};

const BORDER_LABELS: Record<BookBorderStyle, string> = {
  double: '双边乌丝栏',
  single: '单边细线',
  none: '无边框留白',
};

const DENSITY_LABELS: Record<BookDensity, string> = {
  loose: '舒朗（大字疏行）',
  standard: '标准（均衡适中）',
  compact: '紧凑（高密度排印）',
};

const FISHTAIL_LABELS: Record<BookFishtailStyle, string> = {
  black: '黑鱼尾',
  white: '白鱼尾',
  double: '双鱼尾',
  none: '无鱼尾',
};

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

export const BookLayoutStep: React.FC<BookLayoutStepProps> = ({
  book,
  onSaveAndGenerate,
}) => {
  const activeProjectId = useProjectId();
  const { updateLayoutConfig } = useBookActions(activeProjectId);

  const cfg = book.layoutConfig;
  const patch = (updates: Partial<BookLayoutConfig>) => {
    void updateLayoutConfig(book.id, updates);
  };

  const borderClass =
    cfg.borderStyle === 'double'
      ? 'border-[3px] border-double border-[#057091]/60'
      : cfg.borderStyle === 'single'
        ? 'border border-[#057091]/60'
        : 'border border-transparent';

  const densityBodyClass =
    cfg.density === 'loose'
      ? 'text-[12px] leading-[1.9]'
      : cfg.density === 'compact'
        ? 'text-[10px] leading-[1.45]'
        : 'text-[11px] leading-[1.68]';

  return (
    <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[1.15fr_1fr] gap-5 p-4 md:p-5 overflow-hidden">
      {/* Left Settings Panel */}
      <div className="min-h-0 overflow-y-auto pr-1 space-y-5">
        {/* Group 1: 装帧与世系体例 */}
        <section className="rounded-xl border border-border bg-card p-4 space-y-4">
          <h3 className="text-[14px] font-semibold text-foreground">
            装帧与体例
          </h3>

          <div className="space-y-2">
            <div className="text-[12px] font-medium text-muted-foreground">
              装帧风格
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {(['thread', 'hardcover'] as BookBindingStyle[]).map((style) => {
                const active = cfg.bindingStyle === style;
                return (
                  <button
                    key={style}
                    type="button"
                    onClick={() => patch({ bindingStyle: style })}
                    className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                      active
                        ? 'border-primary bg-primary/[0.08]'
                        : 'border-border bg-background hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-foreground">
                        {BINDING_LABELS[style]}
                      </span>
                      {active && <Check size={14} className="text-primary" />}
                    </div>
                    <p className="text-[12px] text-muted-foreground mt-1">
                      {style === 'thread'
                        ? '右侧四眼订线与白色题签，还原传统古籍风貌'
                        : '硬壳精装书脊封面，适合现代家谱馆藏翻阅'}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[12px] font-medium text-muted-foreground">
              世系排法体例
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {(
                ['euler', 'su', 'modern_double'] as BookLineageStyle[]
              ).map((style) => {
                const active = cfg.lineageStyle === style;
                return (
                  <button
                    key={style}
                    type="button"
                    onClick={() => patch({ lineageStyle: style })}
                    className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                      active
                        ? 'border-primary bg-primary/[0.08]'
                        : 'border-border bg-background hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[13px] font-semibold text-foreground">
                        {LINEAGE_STYLE_LABELS[style]}
                      </span>
                      {active && <Check size={14} className="text-primary" />}
                    </div>
                    <p className="text-[12px] text-muted-foreground mt-1">
                      {style === 'euler'
                        ? '横格五世分栏，世次清晰'
                        : style === 'su'
                          ? '竖式宝塔承袭，古韵浓厚'
                          : '双栏人物行传，易读现代'}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Group 2: 纸张、边框与字体 */}
        <section className="rounded-xl border border-border bg-card p-4 space-y-4">
          <h3 className="text-[14px] font-semibold text-foreground">
            纸张规格与字体版心
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-muted-foreground block">
                纸张规格
              </label>
              <select
                value={cfg.paperSize}
                onChange={(e) =>
                  patch({ paperSize: e.target.value as BookPaperSize })
                }
                className="w-full h-9 rounded-md border border-input bg-card px-3 text-[13px] text-foreground transition-all duration-150 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary focus:shadow-[var(--shadow-focus-halo)]"
              >
                {(Object.keys(PAPER_SIZE_LABELS) as BookPaperSize[]).map(
                  (key) => (
                    <option key={key} value={key}>
                      {PAPER_SIZE_LABELS[key]}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-muted-foreground block">
                正文字体
              </label>
              <select
                value={cfg.fontFamily}
                onChange={(e) =>
                  patch({ fontFamily: e.target.value as BookFontFamily })
                }
                className="w-full h-9 rounded-md border border-input bg-card px-3 text-[13px] text-foreground transition-all duration-150 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary focus:shadow-[var(--shadow-focus-halo)]"
              >
                {(Object.keys(FONT_LABELS) as BookFontFamily[]).map((key) => (
                  <option key={key} value={key}>
                    {FONT_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-muted-foreground block">
                版心边框
              </label>
              <select
                value={cfg.borderStyle}
                onChange={(e) =>
                  patch({ borderStyle: e.target.value as BookBorderStyle })
                }
                className="w-full h-9 rounded-md border border-input bg-card px-3 text-[13px] text-foreground transition-all duration-150 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary focus:shadow-[var(--shadow-focus-halo)]"
              >
                {(Object.keys(BORDER_LABELS) as BookBorderStyle[]).map((key) => (
                  <option key={key} value={key}>
                    {BORDER_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-muted-foreground block">
                字号与行距密度
              </label>
              <select
                value={cfg.density}
                onChange={(e) =>
                  patch({ density: e.target.value as BookDensity })
                }
                className="w-full h-9 rounded-md border border-input bg-card px-3 text-[13px] text-foreground transition-all duration-150 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary focus:shadow-[var(--shadow-focus-halo)]"
              >
                {(Object.keys(DENSITY_LABELS) as BookDensity[]).map((key) => (
                  <option key={key} value={key}>
                    {DENSITY_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Group 3: 页眉页脚装饰（鱼尾/堂号/页码） */}
        <section className="rounded-xl border border-border bg-card p-4 space-y-4">
          <h3 className="text-[14px] font-semibold text-foreground">
            页眉页脚与版心装饰
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-muted-foreground block">
                书口鱼尾样式
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {(Object.keys(FISHTAIL_LABELS) as BookFishtailStyle[]).map(
                  (key) => {
                    const active = cfg.fishtailStyle === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => patch({ fishtailStyle: key })}
                        className={`h-8 rounded-md border text-[12px] font-medium transition-colors cursor-pointer ${
                          active
                            ? 'border-primary bg-primary/[0.08] text-primary'
                            : 'border-border bg-background text-foreground hover:bg-muted'
                        }`}
                      >
                        {FISHTAIL_LABELS[key]}
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-muted-foreground block">
                页码编号样式
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { value: 'chinese', label: '汉字页码（第一页）' },
                    { value: 'arabic', label: '阿拉伯数字（第 1 页）' },
                  ] as Array<{ value: BookPageNumberStyle; label: string }>
                ).map((opt) => {
                  const active = cfg.pageNumberStyle === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => patch({ pageNumberStyle: opt.value })}
                      className={`h-8 px-2 rounded-md border text-[12px] font-medium transition-colors cursor-pointer truncate ${
                        active
                          ? 'border-primary bg-primary/[0.08] text-primary'
                          : 'border-border bg-background text-foreground hover:bg-muted'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-1">
            <label className="flex items-center gap-2 text-[13px] text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={cfg.showHeaderName}
                onChange={(e) => patch({ showHeaderName: e.target.checked })}
                className="accent-[var(--primary)]"
              />
              <span>显示谱眉名称（{book.headerName || book.bookName}）</span>
            </label>

            <label className="flex items-center gap-2 text-[13px] text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={cfg.showHallName}
                onChange={(e) => patch({ showHallName: e.target.checked })}
                className="accent-[var(--primary)]"
              />
              <span>显示堂号边栏（{book.hallName || '宗亲堂'}）</span>
            </label>
          </div>
        </section>

        <div className="flex items-center justify-end gap-2.5 pb-2">
          <Button
            type="button"
            onClick={onSaveAndGenerate}
            className="gap-1.5 whitespace-nowrap"
          >
            <Sparkles size={14} />
            <span>保存版式并生成新谱例</span>
          </Button>
        </div>
      </div>

      {/* Right Live Spread Preview */}
      <div className="min-h-[380px] rounded-xl border border-border bg-[var(--surface-subtle)] p-4 md:p-6 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
            <BookOpen size={15} className="text-primary" />
            <span>实时版式对页预览</span>
          </div>
          <span className="text-[12px] text-muted-foreground font-mono tabular-nums">
            {BINDING_LABELS[cfg.bindingStyle]} ·{' '}
            {LINEAGE_STYLE_LABELS[cfg.lineageStyle]} ·{' '}
            {PAPER_SIZE_LABELS[cfg.paperSize].split(' ')[0]}
          </span>
        </div>

        <div className="flex-1 min-h-0 flex items-center justify-center overflow-auto">
          <div
            className="w-full max-w-[560px] aspect-[1.42/1] bg-[#F8FAFB] text-[#1E293B] rounded-md border border-[#CBD5E1] shadow-lg grid grid-cols-[1fr_28px_1fr] p-3 md:p-4 select-none overflow-hidden"
            style={{ fontFamily: getFontStack(cfg.fontFamily) }}
          >
            {/* Left Page: Lineage Layout Sample */}
            <div className={`${borderClass} p-2.5 flex flex-col overflow-hidden`}>
              <div className="flex items-center justify-between text-[9px] text-[#64748B] border-b border-[#057091]/30 pb-1 mb-2 shrink-0">
                <span>{cfg.showHeaderName ? book.headerName : ''}</span>
                <span className="font-semibold text-[#057091]">
                  {LINEAGE_STYLE_LABELS[cfg.lineageStyle]}世系示例
                </span>
              </div>

              {cfg.lineageStyle === 'euler' && (
                <div className="flex-1 grid grid-rows-4 divide-y divide-[#CBD5E1] text-[10px]">
                  {[
                    ['一世', '始祖公 · 字承先，居清河。'],
                    ['二世', '长房祖 · 始祖长子，配李氏。'],
                    ['三世', '仲房公 · 勤耕传家，子二。'],
                    ['四世', '文远公 · 庠生，修筑宗祠。'],
                  ].map(([gen, desc]) => (
                    <div key={gen} className="flex items-center gap-2 py-1">
                      <span className="text-[#057091] font-bold shrink-0">
                        {gen}
                      </span>
                      <span className="text-[#334155] truncate">{desc}</span>
                    </div>
                  ))}
                </div>
              )}

              {cfg.lineageStyle === 'su' && (
                <div className="flex-1 flex flex-col justify-between py-1 text-[10px]">
                  <div className="text-center border border-[#94A3B8] py-1 font-bold text-[#057091]">
                    一世 始祖公
                  </div>
                  <div className="h-3 w-px bg-[#057091]/60 mx-auto" />
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="border border-[#94A3B8] p-1">
                      二世 长房公
                    </div>
                    <div className="border border-[#94A3B8] p-1">
                      二世 次房公
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-center text-[9px]">
                    <div className="border border-[#CBD5E1] p-1">三世 甲</div>
                    <div className="border border-[#CBD5E1] p-1">三世 乙</div>
                    <div className="border border-[#CBD5E1] p-1">三世 丙</div>
                  </div>
                </div>
              )}

              {cfg.lineageStyle === 'modern_double' && (
                <div className="flex-1 grid grid-cols-2 gap-2.5 text-[9.5px] leading-relaxed overflow-hidden">
                  <div className="border-r border-dashed border-[#CBD5E1] pr-2 space-y-1.5">
                    <div className="font-bold text-[#057091]">[一世] 始祖公</div>
                    <p className="text-[#334155]">
                      字承先，勤俭持家，肇基一方，垂训后昆。
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <div className="font-bold text-[#057091]">[二世] 长房公</div>
                    <p className="text-[#334155]">
                      始祖长子，敦厚崇礼，乡里推重，子孙繁衍。
                    </p>
                  </div>
                </div>
              )}

              <div className="pt-1 mt-auto text-center text-[9px] text-[#64748B] border-t border-[#057091]/25 shrink-0">
                {formatPageNumberLabel(2, cfg.pageNumberStyle)}
              </div>
            </div>

            {/* Center 版心 (Book Fold Spine) */}
            <div className="border-y border-[#057091]/40 bg-[#EEF5F7] flex flex-col items-center justify-between py-3 px-0.5 text-[9px] text-[#1E293B]">
              <span
                className="font-bold truncate max-h-20"
                style={{
                  writingMode: 'vertical-rl',
                  textOrientation: 'upright',
                }}
              >
                {cfg.showHeaderName ? book.headerName : ''}
              </span>

              <FishtailOrnament style={cfg.fishtailStyle} />

              <span
                className="text-[#057091] truncate max-h-16"
                style={{
                  writingMode: 'vertical-rl',
                  textOrientation: 'upright',
                }}
              >
                {cfg.showHallName ? book.hallName || '宗亲堂' : ''}
              </span>

              <span className="text-[8px] text-[#64748B]">
                {book.volumeNo || '卷一'}
              </span>
            </div>

            {/* Right Page: Article Typography Sample */}
            <div className={`${borderClass} p-2.5 flex flex-col overflow-hidden`}>
              <div className="flex items-center justify-between text-[9px] text-[#64748B] border-b border-[#057091]/30 pb-1 mb-2 shrink-0">
                <span>谱序凡例</span>
                <span>{cfg.showHallName ? book.hallName : ''}</span>
              </div>

              <div className={`flex-1 overflow-hidden ${densityBodyClass}`}>
                <h4 className="font-bold text-[#057091] mb-1.5 text-[13px]">
                  重修族谱序
                </h4>
                <p className="indent-4 text-[#334155]">
                  夫木有本而枝叶茂，水有源而流泽长。人之有谱，犹国之有史，所以明世次、序昭穆、联宗谊而启后人也。兹依古礼体例，汇辑先世渊源与房支传略，谨成是编，以垂永久。
                </p>
              </div>

              <div className="pt-1 mt-auto text-center text-[9px] text-[#64748B] border-t border-[#057091]/25 shrink-0">
                {formatPageNumberLabel(1, cfg.pageNumberStyle)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
