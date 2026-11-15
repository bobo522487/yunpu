import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  Copy,
  ExternalLink,
  MoreVertical,
  Pencil,
  Trash2,
} from 'lucide-react';
import { AppItem, AssetColorTheme, ProjectItem } from '../../../types';
import {
  ASSET_COLOR_PALETTES,
  useWorkspaceStore as _wsStore,
} from '../../../store/useWorkspaceStore';
import { usePreferencesStore } from '../../../store/usePreferencesStore';
import { AppColoredIcon, ProjectColoredIcon } from '../../../components/common/NocoIcons';

void _wsStore;

export interface AssetCardProps {
  kind: 'project' | 'app';
  item: ProjectItem | AppItem;
  metaDetail?: string;
  showOwnerHint?: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onChangeColor: (colorTheme: AssetColorTheme) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export const AssetCard: React.FC<AssetCardProps> = ({
  kind,
  item,
  metaDetail,
  showOwnerHint = false,
  onOpen,
  onEdit,
  onChangeColor,
  onDuplicate,
  onDelete,
}) => {
  const isDarkMode = usePreferencesStore((s) => s.isDarkMode);
  const palette =
    ASSET_COLOR_PALETTES[item.colorTheme] ||
    (kind === 'project' ? ASSET_COLOR_PALETTES.sky : ASSET_COLOR_PALETTES.indigo);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [isColorOpen, setIsColorOpen] = useState(false);
  const [colorPos, setColorPos] = useState<{ top: number; left: number } | null>(null);

  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const menuPopoverRef = useRef<HTMLDivElement>(null);
  const colorTriggerRef = useRef<HTMLButtonElement>(null);
  const colorPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen && !isColorOpen) return;

    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        isMenuOpen &&
        menuBtnRef.current &&
        !menuBtnRef.current.contains(target) &&
        menuPopoverRef.current &&
        !menuPopoverRef.current.contains(target)
      ) {
        setIsMenuOpen(false);
      }
      if (
        isColorOpen &&
        colorTriggerRef.current &&
        !colorTriggerRef.current.contains(target) &&
        colorPopoverRef.current &&
        !colorPopoverRef.current.contains(target)
      ) {
        setIsColorOpen(false);
      }
    };

    const handleEscOrScroll = (e: Event) => {
      if (e.type === 'keydown' && (e as KeyboardEvent).key !== 'Escape') return;
      setIsMenuOpen(false);
      setIsColorOpen(false);
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscOrScroll);
    window.addEventListener('resize', handleEscOrScroll);
    window.addEventListener('scroll', handleEscOrScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscOrScroll);
      window.removeEventListener('resize', handleEscOrScroll);
      window.removeEventListener('scroll', handleEscOrScroll, true);
    };
  }, [isMenuOpen, isColorOpen]);

  const handleToggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsColorOpen(false);
    if (isMenuOpen) {
      setIsMenuOpen(false);
      return;
    }
    const rect = menuBtnRef.current?.getBoundingClientRect();
    if (rect) {
      const menuHeight = 168;
      const menuWidth = 160;
      const openUpward = window.innerHeight - rect.bottom < menuHeight + 12;
      const top = openUpward
        ? Math.max(8, rect.top - menuHeight - 4)
        : rect.bottom + 4;
      const left = Math.max(
        8,
        Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8)
      );
      setMenuPos({ top, left });
    }
    setIsMenuOpen(true);
  };

  const handleToggleColorPicker = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    if (isColorOpen) {
      setIsColorOpen(false);
      return;
    }
    const rect = colorTriggerRef.current?.getBoundingClientRect();
    if (rect) {
      const popWidth = 224;
      const popHeight = 84;
      const openUpward = window.innerHeight - rect.bottom < popHeight + 16;
      const top = openUpward
        ? Math.max(8, rect.top - popHeight - 6)
        : rect.bottom + 6;
      const left = Math.max(
        8,
        Math.min(rect.left, window.innerWidth - popWidth - 8)
      );
      setColorPos({ top, left });
    }
    setIsColorOpen(true);
  };

  const tileBg = isDarkMode ? palette.darkTileBg : palette.tileBg;

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen();
          }
        }}
        title={item.description || item.name}
        data-testid={`nc-asset-card-${item.name}`}
        className="group relative flex items-center gap-3 p-0 overflow-hidden rounded-xl cursor-pointer border border-border bg-card shadow-[var(--shadow-control)] hover:border-[hsl(var(--border-strong))] hover:shadow-[var(--shadow-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 transition-all duration-150 h-16"
      >
        {/* Left Flush Pastel Tile */}
        <div
          className="self-stretch w-16 flex-none flex items-center justify-center border-r border-black/[0.04] dark:border-white/[0.06] transition-colors"
          style={{ backgroundColor: tileBg }}
        >
          <button
            ref={colorTriggerRef}
            type="button"
            onClick={handleToggleColorPicker}
            title="更换图标配色"
            aria-label={`更换 ${item.name} 的图标配色`}
            data-testid="nc-base-node-icon-picker-trigger"
            className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-black/[0.05] dark:hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors cursor-pointer"
          >
            {kind === 'project' ? (
              <ProjectColoredIcon colorTheme={item.colorTheme} className="w-6 h-6" />
            ) : (
              <AppColoredIcon colorTheme={item.colorTheme} className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Middle Title & Clean Unboxed Metadata */}
        <div className="flex-1 min-w-0 py-2.5 flex flex-col justify-center gap-0.5">
          <div className="min-w-0 truncate text-[14px] font-semibold text-foreground group-hover:text-primary transition-colors">
            {item.name}
          </div>
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground tabular-nums min-w-0">
            <span className="whitespace-nowrap shrink-0">
              {kind === 'project' ? '云谱' : '应用'}
            </span>
            {kind === 'project' && (item as ProjectItem).primaryName && (
              <>
                <span aria-hidden="true" className="text-muted-foreground/45">
                  ·
                </span>
                <span className="truncate max-w-[96px]">
                  {(item as ProjectItem).primaryName}
                </span>
              </>
            )}
            {metaDetail && (
              <>
                <span aria-hidden="true" className="text-muted-foreground/45">
                  ·
                </span>
                <span className="whitespace-nowrap shrink-0">{metaDetail}</span>
              </>
            )}
            {kind === 'project' && (item as ProjectItem).projectState && (
              <>
                <span aria-hidden="true" className="text-muted-foreground/45">
                  ·
                </span>
                <span className="whitespace-nowrap shrink-0">
                  {(item as ProjectItem).projectState === '1' ? '已完成' : '进行中'}
                </span>
              </>
            )}
            {showOwnerHint && item.ownerType === 'shared' && (
              <>
                <span aria-hidden="true" className="text-muted-foreground/45">
                  ·
                </span>
                <span className="whitespace-nowrap shrink-0">共享</span>
              </>
            )}
            {item.updatedAt && (
              <>
                <span aria-hidden="true" className="text-muted-foreground/45">
                  ·
                </span>
                <span className="truncate">{item.updatedAt}</span>
              </>
            )}
          </div>
        </div>

        {/* Right 3-Dot Action Menu Trigger */}
        <div className="pr-2.5 flex items-center shrink-0">
          <button
            ref={menuBtnRef}
            type="button"
            onClick={handleToggleMenu}
            aria-label="更多操作"
            aria-expanded={isMenuOpen}
            className={`h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--surface-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-all duration-150 cursor-pointer ${
              isMenuOpen
                ? 'opacity-100 bg-[hsl(var(--surface-hover))] text-foreground'
                : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100'
            }`}
            title="更多操作"
          >
            <MoreVertical size={15} />
          </button>
        </div>
      </div>

      {/* Portal: Quick Color Theme Picker */}
      {isColorOpen &&
        colorPos &&
        createPortal(
          <div
            ref={colorPopoverRef}
            onClick={(e) => e.stopPropagation()}
            style={{ top: colorPos.top, left: colorPos.left }}
            className="fixed z-[95] w-56 rounded-xl border border-border bg-popover text-popover-foreground shadow-[var(--shadow-popover)] p-2.5 animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="text-[11px] font-semibold text-muted-foreground mb-2 px-0.5">
              选择图标配色
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {(Object.keys(ASSET_COLOR_PALETTES) as AssetColorTheme[]).map((key) => {
                const p = ASSET_COLOR_PALETTES[key];
                const selected = item.colorTheme === key;
                return (
                  <button
                    key={key}
                    type="button"
                    title={p.label}
                    onClick={() => {
                      onChangeColor(key);
                      setIsColorOpen(false);
                    }}
                    className={`relative w-8 h-8 rounded-lg flex items-center justify-center border transition-all cursor-pointer ${
                      selected
                        ? 'border-primary ring-2 ring-primary/25 scale-105'
                        : 'border-black/[0.05] dark:border-white/[0.08] hover:scale-105'
                    }`}
                    style={{
                      backgroundColor: isDarkMode ? p.darkTileBg : p.tileBg,
                    }}
                  >
                    {kind === 'project' ? (
                      <ProjectColoredIcon colorTheme={key} className="w-4 h-4" />
                    ) : (
                      <AppColoredIcon colorTheme={key} className="w-4 h-4" />
                    )}
                    {selected && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                        <Check size={9} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}

      {/* Portal: Card Context Menu */}
      {isMenuOpen &&
        menuPos &&
        createPortal(
          <div
            ref={menuPopoverRef}
            onClick={(e) => e.stopPropagation()}
            style={{ top: menuPos.top, left: menuPos.left }}
            className="fixed z-[95] w-40 rounded-lg border border-border bg-popover text-popover-foreground shadow-[var(--shadow-popover)] p-1 animate-in fade-in zoom-in-95 duration-100"
          >
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                onOpen();
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <ExternalLink size={13} className="text-muted-foreground" />
              <span>打开</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                onEdit();
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <Pencil size={13} className="text-muted-foreground" />
              <span>重命名与编辑</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                onDuplicate();
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <Copy size={13} className="text-muted-foreground" />
              <span>复制</span>
            </button>
            <div className="h-px bg-border my-1" />
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                onDelete();
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] font-medium text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
            >
              <Trash2 size={13} />
              <span>删除</span>
            </button>
          </div>,
          document.body
        )}
    </>
  );
};
