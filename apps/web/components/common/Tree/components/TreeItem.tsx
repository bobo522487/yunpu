
import React, { forwardRef, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../../../lib/utils';
import { ChevronRight, ChevronDown, Pencil, Trash2, File, Folder, Plus, MoreVertical, Copy } from 'lucide-react';
import { FlattenedItem } from '../types';

export interface TreeItemProps extends Omit<React.HTMLAttributes<HTMLLIElement>, 'onClick'> {
  childCount?: number;
  clone?: boolean;
  collapsed?: boolean;
  depth: number;
  disableInteraction?: boolean;
  disableSelection?: boolean;
  ghost?: boolean;
  handleProps?: any;
  indicator?: boolean;
  indentationWidth: number;
  item: FlattenedItem;
  onCollapse?: (id: string) => void;
  onRemove?: (id: string) => void;
  onRename?: (id: string, name: string) => void;
  onAdd?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  renderIcon?: (item: FlattenedItem) => React.ReactNode;
  renderActions?: (item: FlattenedItem) => React.ReactNode;
  activeId?: string | null;
  onClick?: (item: FlattenedItem) => void;
  hideCollapseButton?: boolean;
}

export const TreeItem = forwardRef<HTMLLIElement, TreeItemProps>(
  (
    {
      childCount,
      clone,
      depth,
      disableSelection,
      disableInteraction,
      ghost,
      handleProps,
      indentationWidth,
      indicator,
      collapsed,
      onCollapse,
      onRemove,
      onRename,
      onAdd,
      onDuplicate,
      renderIcon,
      renderActions,
      style,
      item,
      activeId,
      onClick,
      hideCollapseButton,
      ...props
    },
    ref
  ) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(item.data?.name || '');
    const inputRef = useRef<HTMLInputElement>(null);
    
    // Menu State
    const [showMenu, setShowMenu] = useState(false);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
    const menuTriggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    // Close menu on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                menuRef.current && 
                !menuRef.current.contains(event.target as Node) &&
                menuTriggerRef.current && 
                !menuTriggerRef.current.contains(event.target as Node)
            ) {
                setShowMenu(false);
            }
        };

        const handleScroll = () => {
            if (showMenu) setShowMenu(false);
        };

        if (showMenu) {
            document.addEventListener('mousedown', handleClickOutside);
            window.addEventListener('scroll', handleScroll, true);
            window.addEventListener('resize', handleScroll);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleScroll);
        };
    }, [showMenu]);

    const handleSave = () => {
        if (onRename && editName.trim()) {
            onRename(item.id as string, editName);
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') setIsEditing(false);
    };

    const handleMenuOpen = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (menuTriggerRef.current) {
            const rect = menuTriggerRef.current.getBoundingClientRect();
            setMenuPos({ 
                top: rect.bottom + 4, 
                left: rect.left // Align with the left edge of the icon as requested
            });
            setShowMenu(!showMenu);
        }
    };

    // --- Ghost / Indicator State ---
    if (ghost) {
      return (
        <li
          ref={ref}
          className="list-none fade-in relative"
          style={{
            ...style,
            marginBottom: -1,
            paddingLeft: depth * indentationWidth,
          }}
          {...props}
        >
           <div className="relative py-1 z-50">
               <div className="h-[2px] w-full bg-primary rounded-full shadow-[0_0_4px_rgba(var(--primary),0.6)]" />
               <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 border-2 border-primary bg-background rounded-full" />
           </div>
        </li>
      );
    }

    const isClone = clone;
    const isSelected = activeId === item.id;

    return (
      <li
        ref={ref}
        className={cn(
            "list-none my-0.5",
            disableSelection && "select-none",
            disableInteraction && "pointer-events-none"
        )}
        style={{
          ...style,
          paddingLeft: clone ? undefined : depth * indentationWidth,
        }}
        {...props}
      >
        <div 
            className={cn(
                "group relative flex items-center h-8 px-2 rounded-md transition-colors border border-transparent",
                isSelected && !isClone ? "bg-accent text-accent-foreground font-semibold" : "hover:bg-muted/50 text-foreground/85 font-medium hover:text-foreground",
                isClone && "bg-background border-border shadow-xl opacity-90"
            )}
            onClick={(e) => {
                onClick?.(item);
            }}
            {...(!disableInteraction ? handleProps : {})}
        >
            {/* Collapse/Expand Arrow - Only if not hidden */}
            {!hideCollapseButton && (
                <div 
                    className={cn(
                        "flex items-center justify-center w-5 h-5 mr-1 rounded-sm transition-colors cursor-pointer hover:bg-muted-foreground/10",
                        (!childCount && !item.children?.length) && "invisible"
                    )}
                    onClick={(e) => {
                        e.stopPropagation();
                        onCollapse?.(item.id as string);
                    }}
                    onPointerDown={(e) => e.stopPropagation()} // Prevent drag when clicking collapse
                >
                    {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </div>
            )}

            {/* Icon */}
            <div className={cn("text-muted-foreground shrink-0", hideCollapseButton ? "mr-2 ml-1" : "mr-2")}>
                {renderIcon ? renderIcon(item) : (childCount ? <Folder size={16} /> : <File size={16} />)}
            </div>

            {/* Label / Edit Mode */}
            <div className="flex-1 truncate text-[13px] select-none" onDoubleClick={() => !disableInteraction && onRename && setIsEditing(true)}>
                {isEditing ? (
                    <input 
                        ref={inputRef}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={handleKeyDown}
                        className="w-full bg-background border border-input rounded-sm px-1 text-[13px] h-6 focus:outline-none focus:ring-1 focus:ring-ring"
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()} // Prevent drag on input
                    />
                ) : (
                    <span>{item.data?.name || item.id}</span>
                )}
            </div>

            {/* Actions (Hover) */}
            {!isClone && !disableInteraction && (
                <div className={cn(
                    "flex items-center gap-1 transition-opacity",
                    showMenu ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}>
                    {renderActions ? renderActions(item) : (
                        <>
                            {onAdd && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onAdd(item.id as string); }}
                                    onPointerDown={(e) => e.stopPropagation()} // Prevent drag
                                    className="p-1 rounded-sm hover:bg-[hsl(var(--surface-hover))] text-muted-foreground hover:text-foreground transition-colors"
                                    title="新建"
                                >
                                    <Plus size={14} />
                                </button>
                            )}
                            
                            {(onRename || onRemove || onDuplicate) && (
                                <>
                                    <button 
                                        ref={menuTriggerRef}
                                        onClick={handleMenuOpen}
                                        onPointerDown={(e) => e.stopPropagation()} // Prevent drag
                                        className={cn(
                                            "p-1 rounded-sm hover:bg-[hsl(var(--surface-hover))] text-muted-foreground hover:text-foreground transition-colors",
                                            showMenu && "bg-[hsl(var(--surface-hover))] text-foreground"
                                        )}
                                        title="更多操作"
                                    >
                                        <MoreVertical size={14} />
                                    </button>

                                    {showMenu && createPortal(
                                        <div 
                                            ref={menuRef}
                                            className="fixed z-[9999] w-36 bg-popover text-popover-foreground border border-border rounded-lg shadow-[var(--shadow-popover)] p-1 animate-in fade-in zoom-in-95 duration-100 flex flex-col"
                                            style={{ top: menuPos.top, left: menuPos.left }}
                                            onMouseDown={(e) => e.stopPropagation()} // Prevent drag/click outside during interaction
                                        >
                                            {onRename && (
                                                <button 
                                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] font-medium hover:bg-[hsl(var(--surface-hover))] text-left w-full transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setShowMenu(false);
                                                        setIsEditing(true);
                                                    }}
                                                >
                                                    <Pencil size={12} className="text-muted-foreground" />
                                                    重命名
                                                </button>
                                            )}
                                            {onDuplicate && (
                                                <button 
                                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] font-medium hover:bg-[hsl(var(--surface-hover))] text-left w-full transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setShowMenu(false);
                                                        onDuplicate(item.id as string);
                                                    }}
                                                >
                                                    <Copy size={12} className="text-muted-foreground" />
                                                    复制
                                                </button>
                                            )}
                                            {onRemove && (
                                                <button 
                                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] font-medium hover:bg-destructive/10 text-destructive text-left w-full transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setShowMenu(false);
                                                        onRemove(item.id as string);
                                                    }}
                                                >
                                                    <Trash2 size={12} />
                                                    删除
                                                </button>
                                            )}
                                        </div>,
                                        document.body
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>
            )}
            
            {clone && childCount && childCount > 0 ? (
                <span className="ml-auto bg-primary text-primary-foreground text-[10px] rounded-full px-1.5 min-w-[20px] text-center">
                    {childCount}
                </span>
            ) : null}
        </div>
      </li>
    );
  }
);
