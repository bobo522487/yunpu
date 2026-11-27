import React, { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Columns3,
  Download,
  Eye,
  Upload,
  Italic,
  List,
  ListOrdered,
  Minus,
  Palette,
  Pencil,
  Printer,
  Quote,
  Redo2,
  RemoveFormatting,
  Rows3,
  Strikethrough,
  Table as TableIcon,
  Trash2,
  Underline,
  Undo2,
} from 'lucide-react';

interface WordToolbarProps {
  editor: Editor | null;
  isPreview: boolean;
  onTogglePreview: () => void;
  onExportWord: () => void;
  onImportWord: (file: File) => void;
  onPrint: () => void;
}

const DOCX_ACCEPT =
  '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const WordDocxActions: React.FC<{
  onExportWord: () => void;
  onImportWord: (file: File) => void;
  exportLabel?: string;
  className?: string;
}> = ({ onExportWord, onImportWord, exportLabel = '导出 Word', className }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
  <div className={`flex items-center gap-2 ${className ?? ''}`}>
    <input
      ref={fileInputRef}
      type="file"
      accept={DOCX_ACCEPT}
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) onImportWord(file);
        e.target.value = '';
      }}
    />
    <button
      type="button"
      title="导入 Word 文档 (.docx)"
      onClick={() => fileInputRef.current?.click()}
      className="h-7 px-2.5 rounded-md border border-border bg-background hover:bg-muted text-[12px] font-medium text-foreground flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
    >
      <Upload size={13} />
      <span>导入 Word</span>
    </button>
    <button
      type="button"
      onClick={onExportWord}
      title="导出 Word 文档 (.docx)"
      className="h-7 px-2.5 rounded-md border border-border bg-background hover:bg-muted text-[12px] font-medium text-foreground flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
    >
      <Download size={13} />
      <span>{exportLabel}</span>
    </button>
  </div>
);
};

const FONT_FAMILIES = [
  { label: '宋体（默认）', value: "'Noto Serif SC', 'Songti SC', 'SimSun', serif" },
  { label: '楷体', value: "'Kaiti SC', 'KaiTi', 'STKaiti', 'Noto Serif SC', serif" },
  { label: '仿宋', value: "'FangSong', 'STFangsong', 'Noto Serif SC', serif" },
  { label: '黑体', value: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif" },
  { label: '等宽体', value: "'JetBrains Mono', monospace" },
];

const FONT_SIZES = [
  { label: '12px (小五)', value: '12px' },
  { label: '14px (五号)', value: '14px' },
  { label: '15px (小四)', value: '15px' },
  { label: '16px (四号)', value: '16px' },
  { label: '18px (小三)', value: '18px' },
  { label: '20px (三号)', value: '20px' },
  { label: '24px (二号)', value: '24px' },
  { label: '28px (一号)', value: '28px' },
  { label: '32px (小初)', value: '32px' },
];

const TEXT_COLORS = [
  { label: '默认墨色', value: '' },
  { label: '深黑', value: '#111827' },
  { label: '石青灰', value: '#4B5563' },
  { label: '朱砂红', value: '#991B1B' },
  { label: '赭石棕', value: '#92400E' },
  { label: '松烟绿', value: '#065F46' },
  { label: '靛蓝', value: '#1E40AF' },
  { label: '紫檀', value: '#6B21A8' },
];

interface ToolbarButtonProps {
  active?: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  active,
  disabled,
  title,
  onClick,
  children,
}) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    aria-pressed={active}
    disabled={disabled}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className={`h-7 min-w-7 px-1.5 rounded-md flex items-center justify-center gap-1 text-[12px] transition-colors shrink-0 whitespace-nowrap ${
      disabled
        ? 'opacity-40 cursor-not-allowed text-muted-foreground'
        : active
          ? 'bg-primary/12 text-primary font-semibold'
          : 'text-foreground/80 hover:text-foreground hover:bg-muted cursor-pointer'
    }`}
  >
    {children}
  </button>
);

const Divider: React.FC = () => (
  <div className="h-4 w-px bg-border mx-1 shrink-0" aria-hidden="true" />
);

export const WordToolbar: React.FC<WordToolbarProps> = ({
  editor,
  isPreview,
  onTogglePreview,
  onExportWord,
  onImportWord,
  onPrint,
}) => {
  const [showColorMenu, setShowColorMenu] = useState(false);
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [hoverGrid, setHoverGrid] = useState<{ rows: number; cols: number }>({
    rows: 3,
    cols: 3,
  });

  const colorMenuRef = useRef<HTMLDivElement>(null);
  const tablePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        colorMenuRef.current &&
        !colorMenuRef.current.contains(e.target as Node)
      ) {
        setShowColorMenu(false);
      }
      if (
        tablePickerRef.current &&
        !tablePickerRef.current.contains(e.target as Node)
      ) {
        setShowTablePicker(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  if (isPreview) {
    return (
      <div
        data-no-print="true"
        className="h-11 px-4 border-b border-border bg-background flex items-center justify-between gap-3 shrink-0"
      >
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <Eye size={14} className="text-primary" />
          <span>成文预览模式</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <WordDocxActions
            onExportWord={onExportWord}
            onImportWord={onImportWord}
          />
          <button
            type="button"
            onClick={onPrint}
            className="h-7 px-2.5 rounded-md border border-border bg-background hover:bg-muted text-[12px] font-medium text-foreground flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Printer size={13} />
            <span>打印 / PDF</span>
          </button>
          <button
            type="button"
            onClick={onTogglePreview}
            className="h-7 px-3 rounded-md bg-primary text-primary-foreground hover:opacity-90 text-[12px] font-medium flex items-center gap-1.5 transition-opacity cursor-pointer whitespace-nowrap"
          >
            <Pencil size={13} />
            <span>返回编辑</span>
          </button>
        </div>
      </div>
    );
  }

  const currentHeadingValue = editor?.isActive('heading', { level: 1 })
    ? 'h1'
    : editor?.isActive('heading', { level: 2 })
      ? 'h2'
      : editor?.isActive('heading', { level: 3 })
        ? 'h3'
        : 'p';

  const currentFontFamily =
    (editor?.getAttributes('textStyle')?.fontFamily as string) || '';
  const currentFontSize =
    (editor?.getAttributes('textStyle')?.fontSize as string) || '16px';
  const currentColor =
    (editor?.getAttributes('textStyle')?.color as string) || '';
  const isInTable = Boolean(editor?.isActive('table'));

  const handleHeadingChange = (val: string) => {
    if (!editor) return;
    if (val === 'p') {
      editor.chain().focus().setParagraph().run();
    } else if (val === 'h1') {
      editor.chain().focus().setHeading({ level: 1 }).run();
    } else if (val === 'h2') {
      editor.chain().focus().setHeading({ level: 2 }).run();
    } else if (val === 'h3') {
      editor.chain().focus().setHeading({ level: 3 }).run();
    }
  };

  const handleFontFamilyChange = (val: string) => {
    if (!editor) return;
    if (!val) {
      editor.chain().focus().unsetFontFamily().run();
    } else {
      editor.chain().focus().setFontFamily(val).run();
    }
  };

  const handleFontSizeChange = (val: string) => {
    if (!editor) return;
    if (!val) {
      editor.chain().focus().unsetFontSize().run();
    } else {
      editor.chain().focus().setFontSize(val).run();
    }
  };

  return (
    <div
      data-no-print="true"
      data-testid="word-editor-toolbar"
      className="border-b border-border bg-background px-3 py-1.5 flex items-center justify-between gap-2 flex-wrap shrink-0 z-20"
    >
      <div className="flex items-center gap-0.5 flex-wrap">
        {/* Undo / Redo */}
        <ToolbarButton
          title="撤销 (Ctrl+Z)"
          disabled={!editor?.can().undo()}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <Undo2 size={14} />
        </ToolbarButton>
        <ToolbarButton
          title="重做 (Ctrl+Y)"
          disabled={!editor?.can().redo()}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <Redo2 size={14} />
        </ToolbarButton>

        <Divider />

        {/* Block Style (Paragraph / Headings) */}
        <div className="relative flex items-center">
          <select
            aria-label="段落样式"
            title="段落样式"
            value={currentHeadingValue}
            onChange={(e) => handleHeadingChange(e.target.value)}
            className="h-7 pl-2 pr-6 rounded-md border border-border bg-background hover:bg-muted/60 text-[12px] font-medium text-foreground appearance-none cursor-pointer transition-all duration-150 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary focus:shadow-[var(--shadow-focus-halo)]"
          >
            <option value="p">正文</option>
            <option value="h1">标题 1</option>
            <option value="h2">标题 2</option>
            <option value="h3">标题 3</option>
          </select>
          <ChevronDown
            size={12}
            className="pointer-events-none absolute right-1.5 text-muted-foreground"
          />
        </div>

        {/* Font Family */}
        <div className="relative flex items-center ml-1">
          <select
            aria-label="字体"
            title="字体"
            value={currentFontFamily}
            onChange={(e) => handleFontFamilyChange(e.target.value)}
            className="h-7 pl-2 pr-6 rounded-md border border-border bg-background hover:bg-muted/60 text-[12px] font-medium text-foreground appearance-none cursor-pointer transition-all duration-150 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary focus:shadow-[var(--shadow-focus-halo)] max-w-[116px]"
          >
            <option value="">宋体（默认）</option>
            {FONT_FAMILIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={12}
            className="pointer-events-none absolute right-1.5 text-muted-foreground"
          />
        </div>

        {/* Font Size */}
        <div className="relative flex items-center ml-1">
          <select
            aria-label="字号"
            title="字号"
            value={currentFontSize}
            onChange={(e) => handleFontSizeChange(e.target.value)}
            className="h-7 pl-2 pr-6 rounded-md border border-border bg-background hover:bg-muted/60 text-[12px] font-medium text-foreground appearance-none cursor-pointer transition-all duration-150 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary focus:shadow-[var(--shadow-focus-halo)] tabular-nums"
          >
            {FONT_SIZES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={12}
            className="pointer-events-none absolute right-1.5 text-muted-foreground"
          />
        </div>

        <Divider />

        {/* Character Formatting */}
        <ToolbarButton
          title="加粗 (Ctrl+B)"
          active={editor?.isActive('bold')}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold size={14} />
        </ToolbarButton>
        <ToolbarButton
          title="斜体 (Ctrl+I)"
          active={editor?.isActive('italic')}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic size={14} />
        </ToolbarButton>
        <ToolbarButton
          title="下划线 (Ctrl+U)"
          active={editor?.isActive('underline')}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          <Underline size={14} />
        </ToolbarButton>
        <ToolbarButton
          title="删除线"
          active={editor?.isActive('strike')}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        >
          <Strikethrough size={14} />
        </ToolbarButton>

        {/* Text Color Picker */}
        <div ref={colorMenuRef} className="relative">
          <ToolbarButton
            title="文字颜色"
            active={showColorMenu || Boolean(currentColor)}
            onClick={() => setShowColorMenu((v) => !v)}
          >
            <Palette size={14} />
            <span
              className="w-2.5 h-2.5 rounded-xs border border-border shrink-0"
              style={{
                backgroundColor: currentColor || 'currentColor',
              }}
            />
          </ToolbarButton>

          {showColorMenu && (
            <div className="absolute top-9 left-0 z-50 w-44 rounded-lg border border-border bg-popover p-2 shadow-[var(--shadow-popover)]">
              <div className="text-[12px] font-medium text-muted-foreground px-1 pb-1.5">
                文字墨色
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {TEXT_COLORS.map((c) => {
                  const isSel = currentColor === c.value;
                  return (
                    <button
                      key={c.label}
                      type="button"
                      title={c.label}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        if (!editor) return;
                        if (!c.value) {
                          editor.chain().focus().unsetColor().run();
                        } else {
                          editor.chain().focus().setColor(c.value).run();
                        }
                        setShowColorMenu(false);
                      }}
                      className={`h-7 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${
                        isSel
                          ? 'border-primary ring-1 ring-primary'
                          : 'border-border hover:border-foreground/40'
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-xs border border-black/10"
                        style={{
                          backgroundColor: c.value || 'var(--foreground)',
                        }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <ToolbarButton
          title="清除格式"
          onClick={() =>
            editor?.chain().focus().unsetAllMarks().clearNodes().run()
          }
        >
          <RemoveFormatting size={14} />
        </ToolbarButton>

        <Divider />

        {/* First-line indent */}
        <div className="relative flex items-center ml-1">
          <select
            aria-label="首行缩进"
            title="首行缩进"
            defaultValue=""
            onChange={(e) => {
              if (!editor) return;
              const value = (e.target.value || '0') as '0' | '2em';
              editor.chain().focus().setTextIndent(value).run();
            }}
            className="h-7 pl-2 pr-6 rounded-md border border-border bg-background hover:bg-muted/60 text-[12px] font-medium text-foreground appearance-none cursor-pointer transition-all duration-150 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary focus:shadow-[var(--shadow-focus-halo)]"
          >
            <option value="0">无缩进</option>
            <option value="2em">首行 2 字</option>
          </select>
          <ChevronDown
            size={12}
            className="pointer-events-none absolute right-1.5 text-muted-foreground"
          />
        </div>

        {/* Line height */}
        <div className="relative flex items-center ml-1">
          <select
            aria-label="行距"
            title="行距"
            defaultValue="1.8"
            onChange={(e) => {
              if (!editor) return;
              const value = e.target.value as '1.5' | '1.8' | '2.0';
              editor.chain().focus().setLineHeight(value).run();
            }}
            className="h-7 pl-2 pr-6 rounded-md border border-border bg-background hover:bg-muted/60 text-[12px] font-medium text-foreground appearance-none cursor-pointer transition-all duration-150 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary focus:shadow-[var(--shadow-focus-halo)] tabular-nums"
          >
            <option value="1.5">行距 1.5</option>
            <option value="1.8">行距 1.8</option>
            <option value="2.0">行距 2.0</option>
          </select>
          <ChevronDown
            size={12}
            className="pointer-events-none absolute right-1.5 text-muted-foreground"
          />
        </div>

        <Divider />

        {/* Alignment */}
        <ToolbarButton
          title="左对齐"
          active={editor?.isActive({ textAlign: 'left' })}
          onClick={() => editor?.chain().focus().setTextAlign('left').run()}
        >
          <AlignLeft size={14} />
        </ToolbarButton>
        <ToolbarButton
          title="居中对齐"
          active={editor?.isActive({ textAlign: 'center' })}
          onClick={() => editor?.chain().focus().setTextAlign('center').run()}
        >
          <AlignCenter size={14} />
        </ToolbarButton>
        <ToolbarButton
          title="右对齐"
          active={editor?.isActive({ textAlign: 'right' })}
          onClick={() => editor?.chain().focus().setTextAlign('right').run()}
        >
          <AlignRight size={14} />
        </ToolbarButton>
        <ToolbarButton
          title="两端对齐"
          active={editor?.isActive({ textAlign: 'justify' })}
          onClick={() => editor?.chain().focus().setTextAlign('justify').run()}
        >
          <AlignJustify size={14} />
        </ToolbarButton>

        <Divider />

        {/* Lists & Block Elements */}
        <ToolbarButton
          title="无序列表"
          active={editor?.isActive('bulletList')}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List size={14} />
        </ToolbarButton>
        <ToolbarButton
          title="有序列表"
          active={editor?.isActive('orderedList')}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered size={14} />
        </ToolbarButton>
        <ToolbarButton
          title="引用块"
          active={editor?.isActive('blockquote')}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        >
          <Quote size={14} />
        </ToolbarButton>
        <ToolbarButton
          title="插入分割线"
          onClick={() => editor?.chain().focus().setHorizontalRule().run()}
        >
          <Minus size={14} />
        </ToolbarButton>

        {/* Table Grid Picker */}
        <div ref={tablePickerRef} className="relative">
          <ToolbarButton
            title="插入表格"
            active={showTablePicker || isInTable}
            onClick={() => setShowTablePicker((v) => !v)}
          >
            <TableIcon size={14} />
          </ToolbarButton>

          {showTablePicker && (
            <div className="absolute top-9 left-0 z-50 rounded-lg border border-border bg-popover p-2.5 shadow-[var(--shadow-popover)] w-44">
              <div className="flex items-center justify-between text-[12px] font-medium text-muted-foreground pb-2">
                <span>插入表格</span>
                <span className="tabular-nums text-foreground">
                  {hoverGrid.rows} × {hoverGrid.cols}
                </span>
              </div>
              <div className="grid grid-cols-6 gap-1">
                {Array.from({ length: 6 }).map((_, rIdx) =>
                  Array.from({ length: 6 }).map((__, cIdx) => {
                    const r = rIdx + 1;
                    const c = cIdx + 1;
                    const active = r <= hoverGrid.rows && c <= hoverGrid.cols;
                    return (
                      <button
                        key={`${r}-${c}`}
                        type="button"
                        onMouseEnter={() => setHoverGrid({ rows: r, cols: c })}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          editor
                            ?.chain()
                            .focus()
                            .insertTable({
                              rows: r,
                              cols: c,
                              withHeaderRow: true,
                            })
                            .run();
                          setShowTablePicker(false);
                        }}
                        aria-label={`插入 ${r} 行 ${c} 列表格`}
                        className={`w-5 h-5 rounded-[3px] border transition-colors cursor-pointer ${
                          active
                            ? 'bg-primary/20 border-primary'
                            : 'bg-background border-border hover:border-foreground/40'
                        }`}
                      />
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Contextual Table Row/Col Controls when inside a table */}
        {isInTable && (
          <>
            <Divider />
            <ToolbarButton
              title="下方插入行"
              onClick={() => editor?.chain().focus().addRowAfter().run()}
            >
              <Rows3 size={13} />
              <span>+行</span>
            </ToolbarButton>
            <ToolbarButton
              title="删除当前行"
              onClick={() => editor?.chain().focus().deleteRow().run()}
            >
              <span>-行</span>
            </ToolbarButton>
            <ToolbarButton
              title="右侧插入列"
              onClick={() => editor?.chain().focus().addColumnAfter().run()}
            >
              <Columns3 size={13} />
              <span>+列</span>
            </ToolbarButton>
            <ToolbarButton
              title="删除当前列"
              onClick={() => editor?.chain().focus().deleteColumn().run()}
            >
              <span>-列</span>
            </ToolbarButton>
            <ToolbarButton
              title="删除整个表格"
              onClick={() => editor?.chain().focus().deleteTable().run()}
            >
              <Trash2 size={13} className="text-destructive" />
            </ToolbarButton>
          </>
        )}
      </div>

      {/* Right Action Zone */}
      <div className="flex items-center gap-1.5 shrink-0 ml-auto">
        <button
          type="button"
          onClick={onTogglePreview}
          title="成文预览"
          className="h-7 px-2.5 rounded-md border border-border bg-background hover:bg-muted text-[12px] font-medium text-foreground flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
        >
          <Eye size={13} />
          <span>预览</span>
        </button>
        <WordDocxActions
          onExportWord={onExportWord}
          onImportWord={onImportWord}
          exportLabel="导出"
          className="gap-1.5"
        />
        <button
          type="button"
          onClick={onPrint}
          title="打印或另存为 PDF"
          className="h-7 px-2.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 text-[12px] font-medium flex items-center gap-1.5 transition-opacity cursor-pointer whitespace-nowrap"
        >
          <Printer size={13} />
          <span>打印</span>
        </button>
      </div>
    </div>
  );
};
