
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface DropdownItem {
  id: string;
  label: string;
  icon?: React.ElementType;
  group?: string;
  description?: React.ReactNode;
  avatar?: React.ReactNode;
}

interface DropdownProps {
  triggerLabel: React.ReactNode;
  triggerIcon?: React.ElementType;
  items: DropdownItem[];
  selectedId?: string;
  onSelect: (item: DropdownItem) => void;
  searchPlaceholder?: string;
  width?: number | string;
  footer?: React.ReactNode;
  header?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  anchorRef?: React.RefObject<HTMLElement>;
  align?: 'start' | 'end';
  showChevron?: boolean;
  iconSize?: number;
}

const Dropdown: React.FC<DropdownProps> = ({
  triggerLabel,
  triggerIcon: Icon,
  items,
  selectedId,
  onSelect,
  searchPlaceholder = "搜索...",
  width = 240,
  footer,
  header,
  className = "",
  contentClassName = "",
  open,
  onOpenChange,
  anchorRef,
  align = 'start',
  showChevron = true,
  iconSize = 16
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalIsOpen;

  const handleOpenChange = (newOpen: boolean) => {
    if (isControlled) {
      onOpenChange?.(newOpen);
    } else {
      setInternalIsOpen(newOpen);
    }
  };

  useEffect(() => {
    if (isOpen) {
        const target = anchorRef?.current || triggerRef.current;
        if (target) {
            const rect = target.getBoundingClientRect();
            // Only update if we have valid coordinates
            if (rect.width > 0 || rect.height > 0) {
                let left = rect.left;
                
                // Align end logic
                if (align === 'end') {
                    left = rect.right - (typeof width === 'number' ? width : 240);
                }

                // Simple collision detection for right edge (approximate)
                const viewportWidth = window.innerWidth;
                const menuWidth = typeof width === 'number' ? width : 240;
                
                if (align === 'start' && left + menuWidth > viewportWidth) {
                    left = rect.right - menuWidth;
                } else if (align === 'end' && left < 0) {
                    left = rect.left;
                }

                setPosition({
                    top: rect.bottom + 4,
                    left: left
                });
                setSearchTerm('');
            }
        }
    }
  }, [isOpen, anchorRef, align, width]);

  const toggleDropdown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isOpen && !anchorRef && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      let left = rect.left;
      const menuWidth = typeof width === 'number' ? width : 240;
      
      if (align === 'end') {
          left = rect.right - menuWidth;
      }
       // Simple collision detection
       const viewportWidth = window.innerWidth;
       if (align === 'start' && left + menuWidth > viewportWidth) {
           left = rect.right - menuWidth;
       }

      setPosition({
        top: rect.bottom + 4,
        left: left
      });
      setSearchTerm('');
    }
    handleOpenChange(!isOpen);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        (!anchorRef || (anchorRef.current && !anchorRef.current.contains(event.target as Node)))
      ) {
        handleOpenChange(false);
      }
    };

    const handleScroll = (event: Event) => {
      if (dropdownRef.current && dropdownRef.current.contains(event.target as Node)) {
        return;
      }
      if (isOpen) handleOpenChange(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleScroll);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isOpen, onOpenChange, anchorRef]);

  const filteredItems = items.filter(item => 
    item.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedItems = filteredItems.reduce((acc, item) => {
    const group = item.group || 'General';
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {} as Record<string, DropdownItem[]>);

  const DropdownContent = (
    <div 
      ref={dropdownRef}
      className={cn(
        "fixed z-[100] bg-popover text-popover-foreground border border-border rounded-xl shadow-[var(--shadow-popover)] overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col",
        contentClassName
      )}
      style={{ 
        top: position.top, 
        left: position.left,
        width: width
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {header && (
        <div className="border-b border-border bg-[hsl(var(--surface-subtle))]">
            {header}
        </div>
      )}

      {/* Only show search if there are enough items or explicitly desired, defaulting to show for now */}
      {items.length > 5 && (
        <div className="flex items-center px-3 border-b border-[hsl(var(--border-subtle))]">
            <Search size={14} className="shrink-0 opacity-60 text-muted-foreground" />
            <input 
            className="flex h-9 w-full rounded-md bg-transparent py-2 px-2 text-[13px] outline-none placeholder:text-muted-foreground border-none focus:ring-0 text-foreground" 
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
            />
        </div>
      )}

      <div className="max-h-[300px] overflow-y-auto p-1.5 space-y-1">
        {Object.entries(groupedItems).map(([group, groupItems]: [string, DropdownItem[]]) => (
          <div key={group}>
             {group !== 'General' && groupItems.length > 0 && (
                <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground tracking-wide">
                  {group}
                </div>
              )}
              {groupItems.map(item => (
               <div 
                 key={item.id}
                 onClick={(e) => {
                   e.stopPropagation();
                   onSelect(item);
                   handleOpenChange(false);
                 }}
                 className={cn(
                   "relative flex items-center gap-3 rounded-lg px-2 py-2 text-[13px] outline-none cursor-pointer select-none transition-colors group",
                   selectedId === item.id 
                   ? "bg-muted text-foreground font-semibold" 
                   : "text-foreground font-medium hover:bg-muted/70"
                 )}
               >
                 {item.avatar ? (
                     <div className="shrink-0">{item.avatar}</div>
                 ) : item.icon ? (
                     <item.icon size={16} className="text-muted-foreground group-hover:text-foreground" />
                 ) : null}
                 
                 <div className="flex-1 flex flex-col min-w-0">
                    <span className="truncate">{item.label}</span>
                    {item.description && (
                        <span className="text-[12px] text-muted-foreground truncate font-normal">{item.description}</span>
                    )}
                 </div>

                 {selectedId === item.id && <Check size={16} className="text-primary shrink-0" />}
               </div>
             ))}
          </div>
        ))}
        {filteredItems.length === 0 && (
            <div className="px-2 py-4 text-center text-[13px] text-muted-foreground">未找到匹配项</div>
        )}
      </div>

      {footer && (
        <div className="border-t border-border p-1 bg-muted/20">
           {footer}
        </div>
      )}
    </div>
  );

  return (
    <>
      <div 
        ref={triggerRef}
        onMouseDown={toggleDropdown}
        className={cn(
            "flex items-center gap-2 hover:bg-muted/50 px-2 py-1.5 rounded-md cursor-pointer transition-colors group select-none",
            isOpen && "bg-muted/50",
            className
        )}
      >
         {Icon && <Icon size={iconSize} className="text-muted-foreground group-hover:text-foreground transition-colors" />}
         {triggerLabel && (
             <span className="text-[14px] font-medium text-foreground/85 group-hover:text-foreground transition-colors truncate max-w-[150px]">
                 {triggerLabel}
             </span>
         )}
         {showChevron && <ChevronDown size={14} className="text-muted-foreground group-hover:text-foreground shrink-0 transition-colors" />}
      </div>
      {isOpen && createPortal(DropdownContent, document.body)}
    </>
  );
};

export default Dropdown;
