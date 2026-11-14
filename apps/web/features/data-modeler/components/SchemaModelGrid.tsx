import React from 'react';
import { Link2, Settings2, Plus, Trash2, Edit3 } from 'lucide-react';
import { SchemaField, DbTable, SchemaFieldType } from '../../../types';
import { Switch } from '../../../components/ui/switch';
import { Checkbox } from '../../../components/ui/checkbox';
import { Button } from '../../../components/ui/button';
import Dropdown from '../../../components/common/Dropdown';
import { ForeignKeyConfig } from './ForeignKeyDrawer';
import {
  DRAWER_DATA_TYPES,
  TYPE_CONSTRAINTS,
  getIconKeyForType,
  resolveFieldIcon,
} from '../utils/fieldIcons';

interface SchemaModelGridProps {
  schema: SchemaField[];
  tables: DbTable[];
  onAddColumn: () => void;
  onEditColumn: (field: SchemaField) => void;
  onDeleteColumn: (id: string) => void;
  onUpdateField: (fieldId: string, updates: Partial<SchemaField>) => void;
  onOpenRelation: (field: SchemaField) => void;
}

export const SchemaModelGrid: React.FC<SchemaModelGridProps> = ({
  schema,
  tables,
  onAddColumn,
  onEditColumn,
  onDeleteColumn,
  onUpdateField,
  onOpenRelation,
}) => {
  const handleTypeChange = (field: SchemaField, newType: SchemaFieldType) => {
    const config = TYPE_CONSTRAINTS[newType] || TYPE_CONSTRAINTS.varchar;
    const updates: Partial<SchemaField> = {
      type: newType,
      iconName: getIconKeyForType(newType),
    };

    if (!config.pk && field.isPrimary) updates.isPrimary = false;
    if (!config.unique && field.isUnique) updates.isUnique = false;
    if (!config.fk && field.isForeignKey) {
      updates.isForeignKey = false;
      updates.foreignKeyConfig = undefined;
    }

    onUpdateField(field.id, updates);
  };

  return (
    <div className="flex flex-col h-full w-full bg-background select-none text-sm font-sans overflow-auto">
      <div className="h-10 border-b border-border bg-background px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[13px] text-foreground tabular-nums">
            表结构定义（共 {schema.length} 个字段）
          </span>
        </div>
        <Button
          size="sm"
          onClick={onAddColumn}
          className="h-7 text-[13px] gap-1.5"
        >
          <Plus size={13} /> 添加字段
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-[hsl(var(--surface-subtle))] z-10 border-b border-border text-[13px] font-semibold text-foreground/85">
            <tr>
              <th className="py-2.5 px-4 w-12 text-center tabular-nums">#</th>
              <th className="py-2.5 px-4 min-w-[200px]">字段名称</th>
              <th className="py-2.5 px-4 w-44">数据类型</th>
              <th className="py-2.5 px-4 w-36">默认值</th>
              <th className="py-2.5 px-4 w-24 text-center">主键</th>
              <th className="py-2.5 px-4 w-24 text-center">唯一</th>
              <th className="py-2.5 px-4 w-24 text-center">允许为空</th>
              <th className="py-2.5 px-4 min-w-[180px]">外键关联</th>
              <th className="py-2.5 px-4 w-24 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {schema.map((field, idx) => {
              const FieldIcon = resolveFieldIcon(field);
              const config = TYPE_CONSTRAINTS[field.type] || TYPE_CONSTRAINTS.varchar;
              const fkConfig = field.foreignKeyConfig as ForeignKeyConfig | undefined;
              const targetTable = fkConfig?.targetTableId
                ? tables.find((t) => t.id === fkConfig.targetTableId)
                : null;

              return (
                <tr
                  key={field.id}
                  className="hover:bg-[hsl(var(--surface-subtle))] transition-colors group h-10 text-[13px]"
                >
                  <td className="py-2 px-4 text-center text-muted-foreground font-mono tabular-nums">
                    {idx + 1}
                  </td>
                  <td className="py-2 px-4 font-semibold text-foreground">
                    <div
                      className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors"
                      onClick={() => onEditColumn(field)}
                    >
                      <FieldIcon size={14} className="text-muted-foreground shrink-0" />
                      <span className="truncate">{field.name}</span>
                      {field.isPrimary && (
                        <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono px-1.5 py-0.5 rounded border border-amber-500/20">
                          PK
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-4">
                    <Dropdown
                      triggerLabel={
                        DRAWER_DATA_TYPES.find((t) => t.id === field.type)?.label ||
                        field.type
                      }
                      triggerIcon={FieldIcon}
                      items={DRAWER_DATA_TYPES.map((t) => ({
                        id: t.id,
                        label: t.label,
                        icon: t.icon,
                      }))}
                      selectedId={field.type}
                      onSelect={(item) =>
                        handleTypeChange(field, item.id as SchemaFieldType)
                      }
                      className="h-7 text-xs border border-transparent hover:border-border rounded px-2 w-full justify-between"
                      width={180}
                    />
                  </td>
                  <td className="py-2 px-4 font-mono text-muted-foreground">
                    {field.defaultValue || (
                      <span className="text-muted-foreground/60">无</span>
                    )}
                  </td>
                  <td className="py-2 px-4 text-center">
                    <div className="flex justify-center">
                      <Checkbox
                        checked={field.isPrimary}
                        disabled={!config.pk}
                        onCheckedChange={(checked) =>
                          onUpdateField(field.id, { isPrimary: Boolean(checked) })
                        }
                        className="h-3.5 w-3.5"
                      />
                    </div>
                  </td>
                  <td className="py-2 px-4 text-center">
                    <div className="flex justify-center">
                      <Switch
                        checked={field.isUnique}
                        disabled={!config.unique}
                        onCheckedChange={(checked) =>
                          onUpdateField(field.id, { isUnique: Boolean(checked) })
                        }
                        className="scale-75"
                      />
                    </div>
                  </td>
                  <td className="py-2 px-4 text-center">
                    <div className="flex justify-center">
                      <Switch
                        checked={field.isNullable}
                        disabled={!config.notNull}
                        onCheckedChange={(checked) =>
                          onUpdateField(field.id, { isNullable: Boolean(checked) })
                        }
                        className="scale-75"
                      />
                    </div>
                  </td>
                  <td className="py-2 px-4">
                    {field.isForeignKey && fkConfig ? (
                      <div
                        className="inline-flex items-center gap-1.5 text-xs text-primary bg-primary/[0.08] dark:bg-primary/15 border border-primary/25 hover:bg-primary/15 px-2 py-0.5 rounded-md cursor-pointer transition-colors"
                        onClick={() => onOpenRelation(field)}
                      >
                        <Link2 size={11} />
                        <span>{targetTable?.name || fkConfig.targetTableId}</span>
                      </div>
                    ) : (
                      <div
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                        onClick={() => onOpenRelation(field)}
                      >
                        <Settings2 size={11} />
                        <span>配置关联</span>
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => onEditColumn(field)}
                        title="编辑字段"
                      >
                        <Edit3 size={13} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => onDeleteColumn(field.id)}
                        title="删除字段"
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div
          className="flex items-center gap-2 px-4 py-2.5 border-b border-border text-xs text-muted-foreground hover:text-primary hover:bg-[hsl(var(--surface-subtle))] cursor-pointer transition-colors"
          onClick={onAddColumn}
        >
          <Plus size={14} className="text-primary" />
          <span className="font-medium">新增字段到当前表结构...</span>
        </div>
      </div>
    </div>
  );
};

export default SchemaModelGrid;
