
import React from 'react';
import { SchemaField } from '../../../../types';
import { Checkbox } from "../../../../components/ui/checkbox";
import { Badge } from "../../../../components/ui/badge";
import { Calendar, Clock, Link2 } from 'lucide-react';

interface CellRendererProps {
  value: any;
  columnDef: SchemaField;
  isEditing: boolean;
  onValueChange: (val: any) => void;
  onBlur: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  autoFocus?: boolean;
}

// --- Specific Cell Renderers ---

const TextCell = ({ value, isEditing, onValueChange, onBlur, onKeyDown, autoFocus }: CellRendererProps) => {
  if (isEditing) {
    return (
      <input
        autoFocus={autoFocus}
        className="w-full h-full px-2.5 bg-background text-foreground border-none outline-none text-[13px] font-normal"
        value={value ?? ''}
        onChange={(e) => onValueChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />
    );
  }
  return (
    <div className="w-full h-full px-2.5 flex items-center text-[13px] font-normal text-foreground">
        <span className="truncate">{value}</span>
    </div>
  );
};

const NumberCell = ({ value, isEditing, onValueChange, onBlur, onKeyDown, autoFocus }: CellRendererProps) => {
  if (isEditing) {
    return (
      <input
        type="number"
        autoFocus={autoFocus}
        className="w-full h-full px-2.5 bg-background text-foreground border-none outline-none text-[13px] text-right font-mono tabular-nums font-normal"
        value={value ?? ''}
        onChange={(e) => onValueChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />
    );
  }
  return (
    <div className="w-full h-full px-2.5 flex items-center justify-end text-[13px] font-mono tabular-nums font-normal text-foreground">
        <span className="truncate">{value}</span>
    </div>
  );
};

const BooleanCell = ({ value, onValueChange }: CellRendererProps) => {
  const isChecked = Boolean(value);
  return (
    <div className="flex items-center justify-center w-full h-full pointer-events-auto">
      <Checkbox 
        checked={isChecked} 
        onCheckedChange={(checked) => onValueChange(!!checked)}
        className="h-4 w-4"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
};

const STATUS_LABELS: Record<string, string> = {
  Active: '启用中',
  Inactive: '已停用',
  Pending: '待处理',
  Draft: '草稿',
  Published: '已发布',
  Archived: '已归档',
  Deleted: '已删除',
  Banned: '已封禁',
};

const SelectCell = ({ value, isEditing, onValueChange, onBlur, onKeyDown, autoFocus }: CellRendererProps) => {
    if (isEditing) {
        return (
            <select
                autoFocus={autoFocus}
                value={value ?? ''}
                onChange={(e) => { onValueChange(e.target.value); onBlur(); }}
                onBlur={onBlur}
                onKeyDown={onKeyDown}
                className="w-full h-full px-1.5 bg-background text-foreground border-none outline-none text-xs font-normal"
            >
                <option value="Active">启用中 (Active)</option>
                <option value="Inactive">已停用 (Inactive)</option>
                <option value="Pending">待处理 (Pending)</option>
                <option value="Draft">草稿 (Draft)</option>
            </select>
        );
    }
    
    let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
    if (value === 'Active' || value === 'Published') variant = "default";
    else if (value === 'Inactive' || value === 'Archived') variant = "secondary";
    else if (value === 'Deleted' || value === 'Banned') variant = "destructive";

    return (
        <div className="w-full h-full px-2.5 flex items-center">
            <Badge variant={variant} className="text-[12px] h-5 px-2 font-medium rounded-md">
              {STATUS_LABELS[String(value)] || value}
            </Badge>
        </div>
    );
};

const DateCell = ({ value, isEditing, onValueChange, onBlur, onKeyDown, autoFocus }: CellRendererProps) => {
    if (isEditing) {
        return (
            <input
                type="datetime-local"
                autoFocus={autoFocus}
                className="w-full h-full px-1.5 bg-background text-foreground border-none outline-none text-[13px] font-normal tabular-nums"
                value={value ?? ''}
                onChange={(e) => onValueChange(e.target.value)}
                onBlur={onBlur}
                onKeyDown={onKeyDown}
            />
        );
    }
    return (
        <div className="w-full h-full px-2.5 flex items-center gap-1.5 text-[13px] font-normal text-muted-foreground tabular-nums">
            {value && <Calendar size={12} className="shrink-0" />}
            <span className="truncate text-foreground">{value}</span>
        </div>
    );
};

// --- Factory ---

export const CellFactory: React.FC<CellRendererProps> = (props) => {
  const { columnDef } = props;

  // Custom logic based on column name for mock purposes (e.g. 'status', 'role')
  if (columnDef.name.toLowerCase() === 'status' || columnDef.name.toLowerCase() === 'role') {
      return <SelectCell {...props} />;
  }

  switch (columnDef.type) {
    case 'int':
    case 'float':
    case 'bigint':
    case 'serial':
      return <NumberCell {...props} />;
    case 'boolean':
      return <BooleanCell {...props} />;
    case 'date with time':
      return <DateCell {...props} />;
    case 'varchar':
    default:
      return <TextCell {...props} />;
  }
};
