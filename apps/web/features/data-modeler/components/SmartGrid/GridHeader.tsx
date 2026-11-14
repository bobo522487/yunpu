import React from 'react';
import { flexRender, HeaderGroup } from '@tanstack/react-table';
import { Plus, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { SchemaField } from '../../../../types';
import Dropdown from '../../../../components/common/Dropdown';

interface GridHeaderProps<T> {
  headerGroups: HeaderGroup<T>[];
  onAddColumn?: () => void;
  onEditColumn?: (field: SchemaField) => void;
  onDeleteColumn?: (id: string) => void;
}

const GridHeader = <T,>({
  headerGroups,
  onAddColumn,
  onEditColumn,
  onDeleteColumn,
}: GridHeaderProps<T>) => {
  return (
    <div className="flex flex-col bg-[hsl(var(--surface-subtle))] border-b border-border">
      {headerGroups.map((headerGroup) => (
        <div key={headerGroup.id} className="flex w-full">
          {headerGroup.headers.map((header) => {
            const isResizing = header.column.getIsResizing();
            const fieldDef = (header.column.columnDef.meta as any)
              ?.fieldDef as SchemaField;
            const isSelectColumn = header.id === 'select';

            return (
              <div
                key={header.id}
                className={cn(
                  'relative flex items-center border-r border-border bg-[hsl(var(--surface-subtle))] px-2.5 h-9 text-[13px] font-semibold text-foreground select-none group box-border',
                  header.column.getIsPinned() &&
                    'sticky left-0 z-10 shadow-[1px_0_0_hsl(var(--border))]'
                )}
                style={{
                  width: header.getSize(),
                  flex: `0 0 ${header.getSize()}px`,
                }}
              >
                <div className="flex-1 truncate flex items-center gap-1.5">
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
                </div>

                {/* Column Actions */}
                {!isSelectColumn && fieldDef && (onEditColumn || onDeleteColumn) && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute right-1">
                    <Dropdown
                      triggerLabel=""
                      triggerIcon={MoreVertical}
                      items={[
                        { id: 'edit', label: '编辑字段', icon: Pencil },
                        { id: 'delete', label: '删除字段', icon: Trash2 },
                      ]}
                      onSelect={(item) => {
                        if (item.id === 'edit' && onEditColumn) {
                          onEditColumn(fieldDef);
                        } else if (item.id === 'delete' && onDeleteColumn) {
                          onDeleteColumn(fieldDef.id);
                        }
                      }}
                      className="h-6 w-6 p-0 justify-center hover:bg-[hsl(var(--surface-hover))] rounded-sm"
                      width={156}
                      align="start"
                      searchPlaceholder=""
                      showChevron={false}
                      iconSize={14}
                    />
                  </div>
                )}

                {/* Resizer Handle */}
                <div
                  onMouseDown={header.getResizeHandler()}
                  onTouchStart={header.getResizeHandler()}
                  className={cn(
                    'absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none select-none opacity-0 group-hover:opacity-100 transition-opacity bg-primary/25 hover:bg-primary z-20',
                    isResizing && 'bg-primary opacity-100 w-1'
                  )}
                />
              </div>
            );
          })}

          {/* Add Column Button */}
          {onAddColumn && (
            <button
              type="button"
              className="flex items-center justify-center w-10 border-r border-border bg-[hsl(var(--surface-subtle))] h-9 cursor-pointer hover:bg-[hsl(var(--surface-hover))] transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
              onClick={onAddColumn}
              title="添加字段"
            >
              <Plus size={14} className="text-muted-foreground hover:text-foreground" />
            </button>
          )}

          {/* Spacer */}
          <div className="flex-1 bg-[hsl(var(--surface-subtle))] min-w-0" />
        </div>
      ))}
    </div>
  );
};

export default GridHeader;
