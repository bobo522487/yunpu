import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  Columns,
  MoreHorizontal,
  Plus,
  X,
  Check,
  MoveVertical,
  ListTree,
  Maximize,
  Minimize,
  Pencil,
  Trash2,
  Upload,
  Download,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Separator } from '../../../../components/ui/separator';
import { Table, Column } from '@tanstack/react-table';
import { createPortal } from 'react-dom';
import { cn } from '../../../../lib/utils';
import { DensityState } from './SmartGrid';

interface GridToolbarProps<T> {
  table: Table<T>;
  onSearch: (value: string) => void;
  onAddRecord?: () => void;
  density: DensityState;
  setDensity: (d: DensityState) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onEditRow?: (id: string | number) => void;
  onDeleteRows?: (ids: (string | number)[]) => void;
  onImport?: (file: File) => void;
  onExport?: (type: 'csv' | 'excel') => void;
}

const ToolbarPopover = ({
  trigger,
  children,
  isOpen,
  onOpenChange,
  width = 240,
}: {
  trigger: React.ReactNode;
  children?: React.ReactNode;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  width?: number;
}) => {
  const triggerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const left = Math.min(rect.left, Math.max(8, window.innerWidth - width - 12));
      setCoords({ top: rect.bottom + 4, left });
    }
  }, [isOpen, width]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        contentRef.current &&
        !contentRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        onOpenChange(false);
      }
    };
    const handleScroll = (e: Event) => {
      if (contentRef.current && contentRef.current.contains(e.target as Node)) {
        return;
      }
      if (isOpen) onOpenChange(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen, onOpenChange]);

  return (
    <div className="relative">
      <div ref={triggerRef} onClick={() => onOpenChange(!isOpen)}>
        {trigger}
      </div>
      {isOpen &&
        createPortal(
          <div
            ref={contentRef}
            className="fixed z-50 bg-popover text-popover-foreground border border-border rounded-lg shadow-[var(--shadow-popover)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100"
            style={{ top: coords.top, left: coords.left, width }}
          >
            {children}
          </div>,
          document.body
        )}
    </div>
  );
};

export const GridToolbar = <T extends { id: string | number }>({
  table,
  onSearch,
  density,
  setDensity,
  isFullscreen,
  onToggleFullscreen,
  onEditRow,
  onDeleteRows,
  onImport,
  onExport,
}: GridToolbarProps<T>) => {
  const [activePopover, setActivePopover] = useState<
    'fields' | 'filter' | 'sort' | 'height' | 'group' | 'export' | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleToggleColumn = (columnId: string) => {
    const col = table.getColumn(columnId);
    col?.toggleVisibility();
  };

  const handleAddSort = (columnId: string, desc: boolean) => {
    table.setSorting([{ id: columnId, desc }]);
    setActivePopover(null);
  };

  const handleRemoveSort = () => {
    table.setSorting([]);
  };

  const handleAddFilter = (columnId: string, value: string) => {
    table.setColumnFilters([{ id: columnId, value }]);
  };

  const handleRemoveFilter = (columnId: string) => {
    table.setColumnFilters((prev) => prev.filter((f) => f.id !== columnId));
  };

  const clearAllFilters = () => {
    table.setColumnFilters([]);
    setActivePopover(null);
  };

  const handleAddGroup = (columnId: string) => {
    const current = table.getState().grouping;
    if (!current.includes(columnId)) {
      table.setGrouping([...current, columnId]);
    }
    setActivePopover(null);
  };

  const handleRemoveGroup = (columnId: string) => {
    const current = table.getState().grouping;
    table.setGrouping(current.filter((c) => c !== columnId));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImport) {
      onImport(file);
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  const selectedRows = table.getSelectedRowModel().rows;
  const selectionCount = selectedRows.length;
  const isSelectionActive = selectionCount > 0;

  const getColumnLabel = (col: Column<T, unknown>) => {
    const meta = col.columnDef.meta as any;
    return meta?.fieldDef?.name || col.id;
  };

  const getColumnLabelById = (colId: string) => {
    const col = table.getColumn(colId);
    return col ? getColumnLabel(col) : colId;
  };

  const allColumns = table.getAllLeafColumns().filter((c) => c.id !== 'select');
  const visibleColumns = table.getVisibleLeafColumns().filter((c) => c.id !== 'select');
  const sortState = table.getState().sorting;
  const filterState = table.getState().columnFilters;
  const groupState = table.getState().grouping;

  const densityOptions: {
    id: DensityState;
    label: string;
    iconPath1: string;
    iconPath2: string;
  }[] = [
    {
      id: 'short',
      label: '紧凑',
      iconPath1:
        'M3 6H12.75M3 6V5H12.75V6M3 6V7H12.75V6M3 10.5H12.75M3 15H12.75M3 19.5H12.75',
      iconPath2:
        'M18.5 5V19.5M18.5 5L15.5 8M18.5 5L21.5 8M18.5 19.5L15.5 16.5M18.5 19.5L21.5 16.5',
    },
    {
      id: 'medium',
      label: '适中',
      iconPath1:
        'M3 6H12.75M3 6V5H12.75V6M3 6V7M12.75 6V7M3 15H12.75M3 19.5H12.75M3 7H12.75M3 7V7.875M12.75 7V7.875M12.75 8.75H3M12.75 8.75V7.875M12.75 8.75V9.625M3 8.75V7.875M3 8.75V9.625M3 7.875H12.75M12.75 9.625V10.5H3V9.625M12.75 9.625H3',
      iconPath2:
        'M18.5 5V19.5M18.5 5L15.5 8M18.5 5L21.5 8M18.5 19.5L15.5 16.5M18.5 19.5L21.5 16.5',
    },
    {
      id: 'tall',
      label: '宽松',
      iconPath1:
        'M3 6H12.75M3 6V5H12.75V6M3 6V7M12.75 6V7M3 10.5H12.75M3 10.5V9.625M3 10.5V11.625M12.75 10.5V9.625M12.75 10.5V11.625M3 19.5H12.75M3 7H12.75M3 7V7.875M12.75 7V7.875M12.75 8.75H3M12.75 8.75V7.875M12.75 8.75V9.625M3 8.75V7.875M3 8.75V9.625M3 7.875H12.75M12.75 9.625V10.5H3V9.625M12.75 9.625H3M12.75 12.75H3M12.75 12.75V11.625M12.75 12.75V13.875M3 12.75V11.625M3 12.75V14M3 11.625H12.75M12.75 13.875L3 14',
      iconPath2:
        'M18.5 5V19.5M18.5 5L15.5 8M18.5 5L21.5 8M18.5 19.5L15.5 16.5M18.5 19.5L21.5 16.5',
    },
    {
      id: 'extra',
      label: '超高',
      iconPath1:
        'M3 6H12.75M3 6V5H12.75V6M3 6V7M12.75 6V7M3 10.5H12.75M3 10.5V9.625M3 10.5V11.625M12.75 10.5V9.625M12.75 10.5V11.625M3 15H12.75M3 15V14M3 15V16.125M12.75 15V13.875M12.75 15V16.125M3 7H12.75M3 7V7.875M12.75 7V7.875M12.75 8.75H3M12.75 8.75V7.875M12.75 8.75V9.625M3 8.75V7.875M3 8.75V9.625M3 7.875H12.75M12.75 9.625H3M12.75 12.75H3M12.75 12.75V11.625M12.75 12.75V13.875M3 12.75V11.625M3 12.75V14M3 11.625H12.75M12.75 13.875L3 14M12.75 17.25H3M12.75 17.25V16.125M12.75 17.25V18.375M3 17.25V16.125M3 17.25V18.375M3 16.125H12.75M12.75 18.375V19.5H3V18.375M12.75 18.375H3',
      iconPath2:
        'M18.5 5V19.5M18.5 5L15.5 8M18.5 5L21.5 8M18.5 19.5L15.5 16.5M18.5 19.5L21.5 16.5',
    },
  ];

  return (
    <div
      className={cn(
        'h-10 border-b border-border bg-background flex items-center justify-between px-2.5 shrink-0 select-none z-30 transition-colors',
        isSelectionActive && 'bg-primary/[0.06] border-primary/25'
      )}
    >
      <div className="flex items-center gap-1 min-w-0">
        {isSelectionActive ? (
          <div className="flex items-center gap-2">
            {selectionCount === 1 && onEditRow && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs font-medium gap-1.5"
                onClick={() => {
                  const rowId = selectedRows[0].original.id;
                  onEditRow(rowId);
                }}
              >
                <Pencil size={13} />
                <span>编辑行</span>
              </Button>
            )}

            {onDeleteRows && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs font-medium text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive gap-1.5"
                onClick={() => {
                  const ids = selectedRows.map((r) => r.original.id);
                  onDeleteRows(ids);
                  table.resetRowSelection();
                }}
              >
                <Trash2 size={13} />
                <span className="tabular-nums">
                  {selectionCount > 1 ? `删除所选 ${selectionCount} 行` : '删除行'}
                </span>
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Fields Menu */}
            <ToolbarPopover
              isOpen={activePopover === 'fields'}
              onOpenChange={(open) => setActivePopover(open ? 'fields' : null)}
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-7 px-2 text-[13px] font-medium text-foreground/85 hover:text-foreground gap-1.5',
                    (activePopover === 'fields' || allColumns.length > visibleColumns.length) &&
                      'bg-primary/[0.08] dark:bg-primary/15 text-primary border border-primary/25'
                  )}
                >
                  <Columns size={13} />
                  <span>字段</span>
                  {allColumns.length > visibleColumns.length && (
                    <span className="bg-primary/15 text-primary text-[11px] font-semibold px-1 rounded tabular-nums">
                      {visibleColumns.length}
                    </span>
                  )}
                </Button>
              }
            >
              <div className="p-2 space-y-1 max-h-[300px] overflow-y-auto">
                <div className="px-2 py-1 text-[12px] font-semibold text-muted-foreground">
                  显示 / 隐藏字段
                </div>
                {allColumns.map((col) => (
                  <div
                    key={col.id}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-[hsl(var(--surface-hover))] rounded-md cursor-pointer transition-colors"
                    onClick={() => handleToggleColumn(col.id)}
                  >
                    <div
                      className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center transition-colors',
                        col.getIsVisible()
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-[hsl(var(--border-strong))]'
                      )}
                    >
                      {col.getIsVisible() && <Check size={10} />}
                    </div>
                    <span className="text-xs text-foreground truncate">
                      {getColumnLabel(col)}
                    </span>
                  </div>
                ))}
              </div>
            </ToolbarPopover>

            {/* Filter Menu */}
            <ToolbarPopover
              isOpen={activePopover === 'filter'}
              onOpenChange={(open) => setActivePopover(open ? 'filter' : null)}
              width={320}
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-7 px-2 text-[13px] font-medium text-foreground/85 hover:text-foreground gap-1.5',
                    (activePopover === 'filter' || filterState.length > 0) &&
                      'bg-primary/[0.08] dark:bg-primary/15 text-primary border border-primary/25'
                  )}
                >
                  <Filter size={13} />
                  <span>筛选</span>
                  {filterState.length > 0 && (
                    <span className="bg-primary/15 text-primary text-[11px] font-semibold px-1 rounded tabular-nums">
                      {filterState.length}
                    </span>
                  )}
                </Button>
              }
            >
              <div className="p-3 space-y-3">
                <div className="text-[12px] font-semibold text-muted-foreground flex justify-between items-center">
                  <span>当前筛选条件</span>
                  {filterState.length > 0 && (
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="text-[11px] text-destructive hover:underline"
                    >
                      清空全部
                    </button>
                  )}
                </div>

                {filterState.length === 0 && (
                  <div className="text-xs text-muted-foreground py-2 text-center">
                    暂无筛选条件
                  </div>
                )}

                {filterState.map((filter) => (
                  <div
                    key={filter.id}
                    className="flex items-center gap-1.5 bg-[hsl(var(--surface-subtle))] p-1.5 rounded-md border border-border"
                  >
                    <span className="text-xs font-medium text-foreground px-1 truncate max-w-[90px]">
                      {getColumnLabelById(filter.id)}
                    </span>
                    <span className="text-[11px] text-muted-foreground shrink-0">包含</span>
                    <span className="text-xs font-medium bg-background px-1.5 py-0.5 rounded border border-border text-foreground truncate">
                      {filter.value as string}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFilter(filter.id)}
                      className="ml-auto text-muted-foreground hover:text-foreground p-0.5"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}

                <Separator />

                <div className="space-y-2">
                  <div className="text-xs font-medium text-foreground">添加筛选</div>
                  <div className="flex gap-1.5">
                    <select
                      className="h-7 w-1/3 rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-[var(--shadow-control)] focus:outline-none focus:ring-1 focus:ring-ring"
                      id="new-filter-col"
                    >
                      {allColumns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {getColumnLabel(c)}
                        </option>
                      ))}
                    </select>
                    <Input
                      className="h-7 flex-1 text-xs text-foreground"
                      placeholder="输入筛选值..."
                      id="new-filter-val"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const col = (
                            document.getElementById('new-filter-col') as HTMLSelectElement
                          ).value;
                          const val = e.currentTarget.value;
                          if (col && val) {
                            handleAddFilter(col, val);
                            e.currentTarget.value = '';
                          }
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      className="h-7 w-7 p-0 shrink-0"
                      onClick={() => {
                        const col = (
                          document.getElementById('new-filter-col') as HTMLSelectElement
                        ).value;
                        const val = (
                          document.getElementById('new-filter-val') as HTMLInputElement
                        ).value;
                        if (col && val) {
                          handleAddFilter(col, val);
                          (
                            document.getElementById('new-filter-val') as HTMLInputElement
                          ).value = '';
                        }
                      }}
                    >
                      <Plus size={14} />
                    </Button>
                  </div>
                </div>
              </div>
            </ToolbarPopover>

            {/* Sort Menu */}
            <ToolbarPopover
              isOpen={activePopover === 'sort'}
              onOpenChange={(open) => setActivePopover(open ? 'sort' : null)}
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-7 px-2 text-[13px] font-medium text-foreground/85 hover:text-foreground gap-1.5',
                    (activePopover === 'sort' || sortState.length > 0) &&
                      'bg-primary/[0.08] dark:bg-primary/15 text-primary border border-primary/25'
                  )}
                >
                  <ArrowUpDown size={13} />
                  <span>排序</span>
                  {sortState.length > 0 && (
                    <span className="bg-primary/15 text-primary text-[11px] font-semibold px-1 rounded tabular-nums">
                      {sortState.length}
                    </span>
                  )}
                </Button>
              }
            >
              <div className="p-2 space-y-1">
                {sortState.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {sortState.map((sort) => (
                      <div
                        key={sort.id}
                        className="flex items-center justify-between text-xs px-2 py-1.5 bg-[hsl(var(--surface-subtle))] border border-border rounded-md text-foreground"
                      >
                        <span className="truncate">
                          {getColumnLabelById(sort.id)} ({sort.desc ? '降序' : '升序'})
                        </span>
                        <button
                          type="button"
                          onClick={handleRemoveSort}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    <Separator className="my-2" />
                  </div>
                )}

                <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                  排序字段
                </div>
                {allColumns.map((col) => (
                  <div
                    key={col.id}
                    className="flex items-center justify-between px-2 py-1.5 hover:bg-[hsl(var(--surface-hover))] rounded-md cursor-pointer group transition-colors"
                  >
                    <span
                      className="text-xs text-foreground flex-1 truncate"
                      onClick={() => handleAddSort(col.id, false)}
                    >
                      {getColumnLabel(col)}
                    </span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleAddSort(col.id, false)}
                        className="text-[10px] text-muted-foreground hover:text-foreground bg-background border border-border px-1.5 py-0.5 rounded"
                      >
                        升序
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddSort(col.id, true)}
                        className="text-[10px] text-muted-foreground hover:text-foreground bg-background border border-border px-1.5 py-0.5 rounded"
                      >
                        降序
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </ToolbarPopover>

            <div className="h-4 w-px bg-border mx-0.5" />

            {/* Group */}
            <ToolbarPopover
              isOpen={activePopover === 'group'}
              onOpenChange={(open) => setActivePopover(open ? 'group' : null)}
              width={240}
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-7 px-2 text-[13px] font-medium text-foreground/85 hover:text-foreground gap-1.5 hidden sm:flex',
                    (activePopover === 'group' || groupState.length > 0) &&
                      'bg-primary/[0.08] dark:bg-primary/15 text-primary border border-primary/25'
                  )}
                >
                  <ListTree size={13} />
                  <span>分组</span>
                  {groupState.length > 0 && (
                    <span className="bg-primary/15 text-primary text-[11px] font-semibold px-1 rounded tabular-nums">
                      {groupState.length}
                    </span>
                  )}
                </Button>
              }
            >
              <div className="p-3 space-y-3">
                <div className="text-[11px] font-semibold text-muted-foreground">
                  分组字段
                </div>

                {groupState.length > 0 ? (
                  <div className="space-y-1">
                    {groupState.map((groupId) => (
                      <div
                        key={groupId}
                        className="flex items-center justify-between bg-[hsl(var(--surface-subtle))] p-1.5 rounded-md border border-border"
                      >
                        <span className="text-xs font-medium text-foreground px-1 truncate">
                          {getColumnLabelById(groupId)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveGroup(groupId)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground text-center py-1">
                    暂无分组规则
                  </div>
                )}

                <Separator />

                <div className="space-y-1">
                  <div className="px-2 py-1 text-[11px] text-muted-foreground">
                    选择分组字段
                  </div>
                  {allColumns
                    .filter((c) => !groupState.includes(c.id))
                    .map((col) => (
                      <div
                        key={col.id}
                        className="flex items-center justify-between px-2 py-1.5 hover:bg-[hsl(var(--surface-hover))] rounded-md cursor-pointer transition-colors"
                        onClick={() => handleAddGroup(col.id)}
                      >
                        <span className="text-xs text-foreground truncate">
                          {getColumnLabel(col)}
                        </span>
                        <Plus size={12} className="text-muted-foreground shrink-0" />
                      </div>
                    ))}
                </div>
              </div>
            </ToolbarPopover>

            <div className="h-4 w-px bg-border mx-0.5 hidden sm:block" />

            {onImport && (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[13px] font-medium text-foreground/85 hover:text-foreground gap-1.5"
                  onClick={() => fileInputRef.current?.click()}
                  title="导入 CSV / Excel"
                >
                  <Upload size={13} />
                  <span className="hidden xl:inline">导入</span>
                </Button>
              </>
            )}

            {onExport && (
              <ToolbarPopover
                isOpen={activePopover === 'export'}
                onOpenChange={(open) => setActivePopover(open ? 'export' : null)}
                width={168}
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'h-7 px-2 text-[13px] font-medium text-foreground/85 hover:text-foreground gap-1.5',
                      activePopover === 'export' &&
                        'bg-[hsl(var(--surface-hover))] text-foreground'
                    )}
                  >
                    <Download size={13} />
                    <span className="hidden xl:inline">导出</span>
                  </Button>
                }
              >
                <div className="p-1 space-y-0.5">
                  <div
                    className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-[hsl(var(--surface-hover))] rounded-md cursor-pointer text-xs transition-colors"
                    onClick={() => {
                      onExport('csv');
                      setActivePopover(null);
                    }}
                  >
                    <FileText size={14} className="text-blue-500 shrink-0" />
                    <span>导出为 CSV</span>
                  </div>
                  <div
                    className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-[hsl(var(--surface-hover))] rounded-md cursor-pointer text-xs transition-colors"
                    onClick={() => {
                      onExport('excel');
                      setActivePopover(null);
                    }}
                  >
                    <FileSpreadsheet size={14} className="text-emerald-600 shrink-0" />
                    <span>导出为 Excel</span>
                  </div>
                </div>
              </ToolbarPopover>
            )}

            {/* Height (Density) */}
            <ToolbarPopover
              isOpen={activePopover === 'height'}
              onOpenChange={(open) => setActivePopover(open ? 'height' : null)}
              width={160}
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-7 w-7 p-0 text-foreground/80 hover:text-foreground',
                    activePopover === 'height' &&
                      'bg-[hsl(var(--surface-hover))] text-foreground'
                  )}
                  title="行高密度"
                >
                  <MoveVertical size={13} />
                </Button>
              }
            >
              <div className="flex flex-col w-full text-xs p-1">
                <div className="text-[11px] text-muted-foreground px-2.5 pt-1.5 pb-1 select-none font-semibold">
                  行高密度
                </div>
                {densityOptions.map((opt) => (
                  <div
                    key={opt.id}
                    onClick={() => {
                      setDensity(opt.id);
                      setActivePopover(null);
                    }}
                    className="flex items-center justify-between px-2.5 py-1.5 hover:bg-[hsl(var(--surface-hover))] rounded-md cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <svg
                        className="text-muted-foreground"
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d={opt.iconPath1}
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d={opt.iconPath2}
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span className="text-foreground">{opt.label}</span>
                    </div>
                    {density === opt.id && <Check size={13} className="text-primary" />}
                  </div>
                ))}
              </div>
            </ToolbarPopover>

            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-foreground/75 hover:text-foreground"
              title="更多选项"
            >
              <MoreHorizontal size={13} />
            </Button>
          </>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <div className="relative group">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none"
          />
          <Input
            placeholder="搜索记录..."
            className="h-7 w-40 sm:w-48 pl-8 text-xs"
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          onClick={onToggleFullscreen}
          title={isFullscreen ? '退出全屏' : '全屏查看'}
        >
          {isFullscreen ? <Minimize size={13} /> : <Maximize size={13} />}
        </Button>
      </div>
    </div>
  );
};
