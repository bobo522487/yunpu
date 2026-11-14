
import React, { useRef, useMemo, useState, useCallback, useEffect, useContext } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  ColumnDef,
  flexRender,
  Row,
  getSortedRowModel,
  SortingState,
  getPaginationRowModel,
  ColumnFiltersState,
  getFilteredRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  GroupingState,
  ExpandedState,
} from '@tanstack/react-table';
import { useVirtualizer, VirtualItem } from '@tanstack/react-virtual';
import { Checkbox } from "../../../../components/ui/checkbox";
import { Button } from "../../../../components/ui/button";
import { SchemaField } from '../../../../types';
import GridHeader from './GridHeader';
import { GridToolbar } from './GridToolbar';
import { CellFactory } from './CellFactory';
import { cn } from '../../../../lib/utils';
import { resolveFieldIcon } from '../../utils/fieldIcons';
import { Plus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, MoreHorizontal, GripVertical, ChevronDown } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SmartGridProps<T> {
  data: T[];
  schema: SchemaField[]; // Used to generate columns
  onCellEdit?: (rowId: string | number, colId: string, value: any) => void;
  onAddColumn?: () => void;
  onEditColumn?: (field: SchemaField) => void;
  onDeleteColumn?: (id: string) => void;
  onAddRow?: () => void;
  onRowSelect?: (selectedIds: (string | number)[]) => void;
  onRowReorder?: (activeId: string, overId: string) => void;
  onEditRow?: (id: string | number) => void;
  onDeleteRows?: (ids: (string | number)[]) => void;
  onImport?: (file: File) => void;
  onExport?: (type: 'csv' | 'excel') => void;
  isLoading?: boolean;
}

// --- Drag Context & Components ---

const RowDragContext = React.createContext<{ attributes: any; listeners: any }>({ attributes: {}, listeners: {} });

const DragHandleCell = () => {
    const { attributes, listeners } = useContext(RowDragContext);
    return (
       <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-0.5 -ml-1 rounded hover:bg-muted text-muted-foreground/40 hover:text-foreground">
          <GripVertical size={12} />
       </div>
    );
};

interface SortableRowProps {
    key?: React.Key;
    row: Row<any>;
    virtualRow: VirtualItem;
    children?: React.ReactNode;
}

const SortableRow = ({ row, virtualRow, children }: SortableRowProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: row.original.id });

    const transformState = CSS.Translate.toString(transform);
    const translateY = `translateY(${virtualRow.start}px)`;
    
    // Combine absolute positioning from virtualization with dnd transform
    const combinedTransform = transformState ? `${translateY} ${transformState}` : translateY;

    const style: React.CSSProperties = {
        transform: combinedTransform,
        transition,
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: `${virtualRow.size}px`,
        zIndex: isDragging ? 1 : 'auto', // Lower z-index for the placeholder
    };

    return (
        <RowDragContext.Provider value={{ attributes, listeners }}>
            <div 
                ref={setNodeRef} 
                style={style} 
                className={cn(
                    "flex w-full border-b border-border transition-colors box-border group",
                    // Placeholder Styling when dragging
                    isDragging 
                        ? "bg-muted/30 opacity-50 border-dashed border-primary/50 z-0" 
                        : "hover:bg-muted/20 bg-background",
                    row.getIsSelected() && !isDragging && "bg-muted/40"
                )}
            >
                {children}
            </div>
        </RowDragContext.Provider>
    );
};

// --- Helper to generate React Table columns from Schema ---
const generateColumns = (schema: SchemaField[]): ColumnDef<any>[] => {
    // Selection Column with Row Number / Drag Handle / Checkbox
    const selectCol: ColumnDef<any> = {
        id: 'select',
        header: ({ table }) => {
            const isAllSelected = table.getIsAllRowsSelected();
            const isSomeSelected = table.getIsSomeRowsSelected();
            const isSelectionActive = isAllSelected || isSomeSelected;

            return (
                <div className="flex items-center w-full h-full relative group justify-center">
                    <span className={cn(
                        "text-[11px] text-muted-foreground font-mono tabular-nums select-none text-left absolute left-2",
                        isSelectionActive ? "hidden" : "group-hover:hidden"
                    )}>
                        #
                    </span>
                    <div className={cn(
                        "items-center justify-center w-full",
                        isSelectionActive ? "flex" : "hidden group-hover:flex"
                    )}>
                        <Checkbox
                            checked={isAllSelected || (isSomeSelected ? "indeterminate" : false)}
                            onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
                            aria-label="全选"
                            className="h-3.5 w-3.5 border-[hsl(var(--border-strong))] data-[state=checked]:border-primary bg-background"
                        />
                    </div>
                </div>
            );
        },
        cell: ({ row }) => (
            <div className="flex items-center w-full h-full relative pl-2 pr-1.5 group">
                {/* Default: Number (Left Aligned) */}
                <span className={cn(
                    "text-[11px] text-muted-foreground font-mono tabular-nums transition-opacity select-none text-left flex-1",
                    row.getIsSelected() ? "hidden" : "group-hover:hidden"
                )}>
                    {row.index + 1}
                </span>

                {/* Hover/Selected: Controls */}
                <div className={cn(
                    "items-center justify-between w-full",
                    row.getIsSelected() ? "flex" : "hidden group-hover:flex"
                )}>
                    <DragHandleCell />
                    <Checkbox
                        checked={row.getIsSelected()}
                        onCheckedChange={(value) => row.toggleSelected(!!value)}
                        aria-label="选择行"
                        className="h-3.5 w-3.5 border-[hsl(var(--border-strong))] data-[state=checked]:border-primary bg-background"
                    />
                </div>
            </div>
        ),
        size: 50,
        enableResizing: false,
    };

    // Data Columns
    const dataCols: ColumnDef<any>[] = schema.map((field) => {
        const FieldIcon = resolveFieldIcon(field);
        return {
            accessorKey: field.id,
            header: () => (
                <div className="flex items-center gap-2">
                    <FieldIcon size={13} className="text-muted-foreground shrink-0" />
                    <span className="truncate">{field.name}</span>
                </div>
            ),
        size: field.width || 150,
        minSize: 60,
        maxSize: 800,
        meta: {
            fieldDef: field
        }
        };
    });

    return [selectCol, ...dataCols];
};

export type DensityState = 'short' | 'medium' | 'tall' | 'extra';

export const SmartGrid = <T extends { id: string | number }>({ 
    data, 
    schema,
    onCellEdit,
    onAddColumn,
    onEditColumn,
    onDeleteColumn,
    onAddRow,
    onRowSelect,
    onRowReorder,
    onEditRow,
    onDeleteRows,
    onImport,
    onExport
}: SmartGridProps<T>) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [rowSelection, setRowSelection] = useState({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [grouping, setGrouping] = useState<GroupingState>([]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 50,
  });
  const [density, setDensity] = useState<DensityState>('short');
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Drag State
  const [activeId, setActiveId] = useState<string | null>(null);
  
  // Cell Navigation & Editing State
  const [focusedCell, setFocusedCell] = useState<{ rowId: string, colId: string } | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowId: string, colId: string } | null>(null);

  const columns = useMemo(() => generateColumns(schema), [schema]);

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
        activationConstraint: {
            distance: 8,
        },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
      setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id && onRowReorder) {
          onRowReorder(active.id as string, over.id as string);
      }
      setActiveId(null);
  }, [onRowReorder]);

  // Fullscreen logic
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!rootRef.current) return;
    if (!document.fullscreenElement) {
      rootRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const table = useReactTable({
    data,
    columns,
    state: {
      rowSelection,
      sorting,
      columnFilters,
      globalFilter,
      grouping,
      expanded,
      pagination,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGroupingChange: setGrouping,
    onExpandedChange: setExpanded,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    columnResizeMode: 'onChange',
    defaultColumn: {
        size: 150,
        minSize: 50,
        maxSize: 800,
    }
  });

  // Notify parent of selection changes
  useEffect(() => {
      if (onRowSelect) {
          const selectedRows = table.getSelectedRowModel().rows.map(row => row.original.id);
          onRowSelect(selectedRows);
      }
  }, [rowSelection, onRowSelect, table]);

  const getRowHeight = () => {
      switch(density) {
          case 'short': return 32;
          case 'medium': return 40;
          case 'tall': return 56;
          case 'extra': return 80;
          default: return 32;
      }
  };
  const rowHeight = getRowHeight();

  // Virtualization
  const { rows } = table.getRowModel(); // These are the paginated, filtered, grouped rows
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => rowHeight,
    overscan: 20,
  });

  // Effect to force remeasure when rowHeight changes
  useEffect(() => {
      rowVirtualizer.measure();
  }, [rowHeight, rowVirtualizer]);

  // --- Interaction Handlers ---

  const handleCellClick = (rowId: string, colId: string) => {
      setFocusedCell({ rowId, colId });
      setEditingCell(null); 
  };

  const handleCellDoubleClick = (rowId: string, colId: string) => {
      setFocusedCell({ rowId, colId });
      setEditingCell({ rowId, colId });
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
      if (!focusedCell) return;
      if (editingCell) {
          if (e.key === 'Escape') {
              setEditingCell(null);
              tableContainerRef.current?.focus(); 
          } else if (e.key === 'Enter' && !e.shiftKey) {
              setEditingCell(null);
              const currentRowIdx = rows.findIndex(r => String(r.original.id) === String(focusedCell.rowId));
              if (currentRowIdx < rows.length - 1) {
                  setFocusedCell({ rowId: String(rows[currentRowIdx + 1].original.id), colId: focusedCell.colId });
              }
          }
          return;
      }

      const currentRowIdx = rows.findIndex(r => String(r.original.id) === String(focusedCell.rowId));
      const visibleCols = table.getVisibleLeafColumns();
      const currentColIdx = visibleCols.findIndex(c => c.id === focusedCell.colId);

      let nextRowIdx = currentRowIdx;
      let nextColIdx = currentColIdx;

      switch(e.key) {
          case 'ArrowUp':
              nextRowIdx = Math.max(0, currentRowIdx - 1);
              break;
          case 'ArrowDown':
              nextRowIdx = Math.min(rows.length - 1, currentRowIdx + 1);
              break;
          case 'ArrowLeft':
              nextColIdx = Math.max(1, currentColIdx - 1); // Skip select column 0
              break;
          case 'ArrowRight':
              nextColIdx = Math.min(visibleCols.length - 1, currentColIdx + 1);
              break;
          case 'Enter':
              setEditingCell(focusedCell);
              e.preventDefault(); 
              return;
          default:
              if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                  setEditingCell(focusedCell);
              }
              return; 
      }

      if (nextRowIdx !== currentRowIdx || nextColIdx !== currentColIdx) {
          e.preventDefault();
          const nextRow = rows[nextRowIdx];
          const nextCol = visibleCols[nextColIdx];
          if (nextRow && nextCol) {
              setFocusedCell({ rowId: String(nextRow.original.id), colId: nextCol.id });
          }
      }
  }, [focusedCell, editingCell, rows, table]);

  const activeRow = activeId ? rows.find(r => r.original.id === activeId) : null;

  return (
    <div 
        ref={rootRef}
        className="flex flex-col h-full w-full bg-background select-none text-sm font-sans relative" 
        tabIndex={0} 
        onKeyDown={handleKeyDown}
    >
        {/* Toolbar */}
        <GridToolbar 
            table={table} 
            onSearch={setGlobalFilter} 
            onAddRecord={onAddRow} 
            density={density}
            setDensity={setDensity}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            onEditRow={onEditRow}
            onDeleteRows={onDeleteRows}
            onImport={onImport}
            onExport={onExport}
        />

        {/* Scrollable Area (Header + Body) */}
        <div 
            ref={tableContainerRef} 
            className="flex-1 overflow-auto relative scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent"
        >
            <div style={{ width: table.getTotalSize() }} className="min-w-full">
                {/* Sticky Header */}
                <div className="sticky top-0 z-50">
                    <GridHeader 
                        headerGroups={table.getHeaderGroups()} 
                        onAddColumn={onAddColumn}
                        onEditColumn={onEditColumn}
                        onDeleteColumn={onDeleteColumn}
                    />
                </div>

                {/* Virtualized Rows */}
                <DndContext 
                    sensors={sensors} 
                    collisionDetection={closestCenter} 
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext 
                        items={rows.map(row => row.original.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div
                            style={{
                                height: `${rowVirtualizer.getTotalSize()}px`,
                                position: 'relative',
                            }}
                        >
                            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                const row = rows[virtualRow.index];
                                const isGrouped = row.getIsGrouped();
                                
                                // Group Header Row
                                if (isGrouped) {
                                    const groupColumn = table.getColumn(row.groupingColumnId);
                                    const groupLabel = (groupColumn?.columnDef.meta as any)?.fieldDef?.name || table.getColumn(row.groupingColumnId)?.id;

                                    return (
                                        <div
                                            key={row.id}
                                            data-index={virtualRow.index}
                                            className="absolute left-0 top-0 flex w-full border-b border-border bg-muted/10 transition-colors hover:bg-muted/20 items-center px-2 box-border"
                                            style={{
                                                transform: `translateY(${virtualRow.start}px)`,
                                                height: `${virtualRow.size}px`,
                                            }}
                                        >
                                            <div 
                                                className="flex items-center gap-2 cursor-pointer font-medium text-foreground w-full"
                                                style={{ paddingLeft: `${row.depth * 20}px` }}
                                                onClick={row.getToggleExpandedHandler()}
                                            >
                                                <div className="p-0.5 rounded-sm hover:bg-[hsl(var(--surface-hover))] transition-colors">
                                                    {row.getIsExpanded() ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                </div>
                                                <span className="text-muted-foreground text-xs">
                                                    {groupLabel}:
                                                </span>
                                                <span className="text-[13px]">{row.getValue(row.groupingColumnId) as string}</span>
                                                <span className="text-muted-foreground text-[11px] tabular-nums bg-[hsl(var(--surface-subtle))] border border-border px-1.5 rounded ml-1">
                                                    {row.subRows.length}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                }

                                // Sortable Standard Data Row wrapper
                                return (
                                    <SortableRow key={row.original.id} row={row} virtualRow={virtualRow}>
                                        {row.getVisibleCells().map((cell) => {
                                            const isFocused = focusedCell?.rowId === String(row.original.id) && focusedCell?.colId === cell.column.id;
                                            const isEditing = editingCell?.rowId === String(row.original.id) && editingCell?.colId === cell.column.id;
                                            const fieldDef = (cell.column.columnDef.meta as any)?.fieldDef;

                                            // For aggregated cells in grouping, or empty placeholders
                                            if (cell.getIsAggregated()) return null; 
                                            if (cell.getIsPlaceholder()) return (
                                                <div 
                                                    key={cell.id} 
                                                    className="flex items-center border-r border-border h-full bg-muted/5"
                                                    style={{ width: cell.column.getSize() }} 
                                                />
                                            );

                                            return (
                                                <div
                                                    key={cell.id}
                                                    className={cn(
                                                        "flex items-center border-r border-border h-full relative outline-none",
                                                        // Sticky - High Z
                                                        cell.column.getIsPinned() && "sticky left-0 bg-background z-40 shadow-[1px_0_0_hsl(var(--border))]",
                                                        // Focused - Med Z (above normal cells, below sticky if scrolling usually, but needs to pop)
                                                        !cell.column.getIsPinned() && isFocused && "z-30",
                                                        // Sticky + Focused - Top Z
                                                        cell.column.getIsPinned() && isFocused && "z-40",
                                                    )}
                                                    style={{
                                                        width: cell.column.getSize(),
                                                    }}
                                                    onClick={() => handleCellClick(String(row.original.id), cell.column.id)}
                                                    onDoubleClick={() => handleCellDoubleClick(String(row.original.id), cell.column.id)}
                                                >
                                                    {fieldDef ? (
                                                        <CellFactory
                                                            value={cell.getValue()}
                                                            columnDef={fieldDef}
                                                            isEditing={isEditing}
                                                            autoFocus={isEditing}
                                                            onValueChange={(val) => onCellEdit?.(row.original.id, fieldDef.id, val)}
                                                            onBlur={() => setEditingCell(null)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    setEditingCell(null);
                                                                }
                                                            }}
                                                        />
                                                    ) : (
                                                        flexRender(cell.column.columnDef.cell, cell.getContext())
                                                    )}

                                                    {/* Active Indicator Overlay - Rendered AFTER content to ensure visibility */}
                                                    {isFocused && (
                                                        <div className="absolute inset-0 z-50 ring-2 ring-primary ring-inset pointer-events-none" />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </SortableRow>
                                );
                            })}
                        </div>
                    </SortableContext>
                    
                    {/* Drag Overlay for smooth following */}
                    <DragOverlay>
                        {activeRow && (
                            <div 
                                className="flex w-full border border-primary bg-background shadow-xl opacity-95 items-center box-border overflow-hidden"
                                style={{ height: `${rowHeight}px` }}
                            >
                                {activeRow.getVisibleCells().map(cell => {
                                    if (cell.getIsAggregated() || cell.getIsPlaceholder()) return null;
                                    const fieldDef = (cell.column.columnDef.meta as any)?.fieldDef;
                                    return (
                                        <div 
                                            key={cell.id}
                                            className="flex items-center border-r border-border h-full px-2 overflow-hidden"
                                            style={{ width: cell.column.getSize() }}
                                        >
                                            {fieldDef ? (
                                                // Simplified Render for Drag Preview (non-interactive)
                                                <span className="truncate">{String(cell.getValue())}</span>
                                            ) : (
                                                flexRender(cell.column.columnDef.cell, cell.getContext())
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </DragOverlay>
                </DndContext>

                {/* Append Row (Ghost Row) */}
                <div 
                    className="flex w-full border-b border-border transition-colors cursor-pointer group relative"
                    style={{ height: `${rowHeight}px` }}
                    onClick={onAddRow}
                >
                    {/* Sticky Button Cell - Matches Select Column behavior */}
                    <div 
                        className={cn(
                            "sticky left-0 z-10 flex items-center justify-center border-r border-border h-full transition-colors",
                            "bg-background group-hover:bg-[hsl(var(--surface-hover))]"
                        )}
                        style={{ width: '50px', flex: '0 0 50px' }}
                    >
                        <Plus size={15} className="text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    
                    {/* Placeholder content for the rest of the row */}
                    <div className="flex-1 flex items-center px-2.5 text-[13px] font-medium text-muted-foreground group-hover:text-primary group-hover:bg-[hsl(var(--surface-subtle))] transition-colors">
                        点击新增一行
                    </div>
                </div>
            </div>
        </div>
        
        {/* Pagination Footer */}
        <div className="h-10 border-t border-border bg-background flex items-center justify-between px-4 text-[13px] text-muted-foreground shrink-0 select-none z-30">
            <div className="flex items-center gap-4 pl-1">
                <span className="text-foreground font-medium tabular-nums">
                    {Object.keys(rowSelection).length > 0
                        ? `已选 ${Object.keys(rowSelection).length} 条`
                        : `共 ${table.getFilteredRowModel().rows.length} 条记录`}
                </span>
            </div>

            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="font-medium">每页行数</span>
                    <select
                        value={table.getState().pagination.pageSize}
                        onChange={e => {
                            table.setPageSize(Number(e.target.value))
                        }}
                        className="h-6 rounded border border-input bg-background shadow-[var(--shadow-control)] px-2 text-[12px] font-medium text-foreground tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                        {[10, 20, 30, 40, 50, 100].map(pageSize => (
                            <option key={pageSize} value={pageSize}>
                                {pageSize}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-1">
                    <span className="mr-2 tabular-nums font-medium">
                        第 {table.getState().pagination.pageIndex + 1} /{' '}
                        {Math.max(1, table.getPageCount())} 页
                    </span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => table.setPageIndex(0)}
                        disabled={!table.getCanPreviousPage()}
                        title="首页"
                    >
                        <ChevronsLeft size={14} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                        title="上一页"
                    >
                        <ChevronLeft size={14} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                        title="下一页"
                    >
                        <ChevronRight size={14} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                        disabled={!table.getCanNextPage()}
                        title="末页"
                    >
                        <ChevronsRight size={14} />
                    </Button>
                </div>
            </div>
        </div>
    </div>
  );
};
