
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, FileKey, Trash2, Link2, HelpCircle, Info } from 'lucide-react';
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Switch } from "../../../components/ui/switch";
import { Checkbox } from "../../../components/ui/checkbox";
import { SchemaField, DbTable, SchemaFieldType } from '../../../types';
import Dropdown from '../../../components/common/Dropdown';
import { cn } from '../../../lib/utils';
import ForeignKeyDrawer, { ForeignKeyConfig } from './ForeignKeyDrawer';
import { DRAWER_DATA_TYPES, getIconKeyForType } from '../utils/fieldIcons';

interface CreateTableDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (tableName: string, columns: SchemaField[]) => void;
  tables: DbTable[];
  getTargetColumns: (tableId: string) => { id: string; name: string }[];
}

const DATA_TYPES = DRAWER_DATA_TYPES;

export const CreateTableDrawer: React.FC<CreateTableDrawerProps> = ({ 
    isOpen, 
    onClose, 
    onCreate, 
    tables, 
    getTargetColumns 
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const [tableName, setTableName] = useState('table1');
  const [columns, setColumns] = useState<SchemaField[]>([]);
  const [showFKDrawer, setShowFKDrawer] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
        // Reset state on open
        setTableName(`table_${Date.now().toString().slice(-4)}`);
        setColumns([
            { 
                id: 'id', 
                name: 'id', 
                type: 'serial', 
                isPrimary: true, 
                isUnique: true, 
                isNullable: false, 
                defaultValue: 'auto-inc',
                width: 100,
                iconName: 'key',
                flex: false
            },
            { 
                id: 'name', 
                name: 'name', 
                type: 'varchar', 
                isPrimary: false, 
                isUnique: false, 
                isNullable: false, 
                defaultValue: '',
                width: 200,
                iconName: 'text',
                flex: true
            }
        ]);
        setShowFKDrawer(false);
    }
  }, [isOpen]);

  if (!isMounted) return null;

  const handleAddColumn = () => {
      const newId = `col_${Date.now()}`;
      setColumns([...columns, {
          id: newId,
          name: '',
          type: 'varchar',
          isPrimary: false,
          isUnique: false,
          isNullable: true,
          defaultValue: '',
          width: 150,
          iconName: 'text',
          flex: true
      }]);
  };

  const handleColumnChange = (id: string, field: keyof SchemaField, value: any) => {
      setColumns(prev => prev.map(col => {
          if (col.id === id) {
              const updates: Partial<SchemaField> = { [field]: value };
              if (field === 'type') {
                  updates.iconName = getIconKeyForType(value as SchemaFieldType);
              }
              return { ...col, ...updates };
          }
          return col;
      }));
  };

  const handleRemoveColumn = (id: string) => {
      setColumns(prev => prev.filter(col => col.id !== id));
  };

  const handleCreate = () => {
      if (!tableName.trim()) return;
      // Filter out empty column names or provide defaults
      const finalColumns = columns.map(c => ({
          ...c,
          name: c.name.trim() || `col_${c.id.split('_')[1] || Math.floor(Math.random() * 1000)}`
      }));
      onCreate(tableName, finalColumns);
      onClose();
  };

  const handleFKSave = (config: ForeignKeyConfig) => {
      const targetTable = tables.find(t => t.id === config.targetTableId);
      const targetTableName = targetTable ? targetTable.name.toLowerCase() : 'table';
      // Sanitize name
      const cleanTargetName = targetTableName.replace(/[^a-z0-9_]/g, '_');
      const newColName = `${cleanTargetName}_id`;
      
      // Check if column exists, if so append random
      let finalName = newColName;
      if (columns.some(c => c.name === finalName)) {
          finalName = `${newColName}_${Math.floor(Math.random()*100)}`;
      }

      const newColumn: SchemaField = {
          id: `col_${Date.now()}`,
          name: finalName,
          type: 'int',
          isPrimary: false,
          isUnique: false,
          isNullable: true,
          defaultValue: '',
          width: 150,
          iconName: 'hash',
          flex: true,
          isForeignKey: true,
          foreignKeyConfig: config,
      };

      setColumns([...columns, newColumn]);
      setShowFKDrawer(false);
  };

  const fkColumns = columns.filter(c => c.isForeignKey);

  const content = (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div 
        className={`fixed inset-y-0 right-0 w-[600px] max-w-full bg-background shadow-[var(--shadow-popover)] transform transition-transform duration-200 z-[70] flex flex-col border-l border-border ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
            <h3 className="text-base font-semibold text-foreground tracking-tight">新建数据表</h3>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full">
                <X size={16} />
            </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-background">
            
            {/* Table Name */}
            <div className="mb-6">
                <div className="text-[13px] font-medium text-foreground mb-2">数据表名称</div>
                <Input 
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                    placeholder="请输入数据表名称"
                    className="h-9 text-[13px]"
                    autoFocus
                />
            </div>

            {/* Schema Section */}
            <div className="mb-6">
                <div className="text-xs font-semibold text-muted-foreground mb-3 tracking-wide">字段结构</div>
                
                {/* Column Headers */}
                <div className="flex items-center mb-2 px-1">
                    <div className="flex items-center w-[30%] text-xs font-medium text-muted-foreground">
                        <Info size={12} className="mr-1.5 opacity-0" />
                        字段名称
                    </div>
                    <div className="flex items-center w-[25%] text-xs font-medium text-muted-foreground pl-2">
                        类型
                    </div>
                    <div className="flex items-center w-[25%] text-xs font-medium text-muted-foreground pl-2">
                        默认值
                    </div>
                    <div className="flex items-center justify-center w-[10%] text-xs font-medium text-muted-foreground">
                        主键
                    </div>
                    <div className="flex items-center justify-center w-[10%] text-xs font-medium text-muted-foreground">
                        非空
                    </div>
                </div>

                <div className="space-y-2">
                    {columns.map((col) => {
                        const isIdRow = col.id === 'id';
                        const typeObj = DATA_TYPES.find(t => t.id === col.type);

                        return (
                            <div key={col.id} className="flex items-center bg-card border border-border rounded-md p-1.5 group hover:border-[hsl(var(--border-strong))] transition-colors">
                                {/* Name */}
                                <div className="w-[30%] pr-2 flex items-center">
                                    <span className="mr-1 opacity-0">
                                        <Info size={12} />
                                    </span>
                                    <Input 
                                        value={col.name}
                                        onChange={(e) => handleColumnChange(col.id, 'name', e.target.value)}
                                        placeholder="字段名"
                                        disabled={isIdRow}
                                        className={cn("h-8 text-xs border-transparent shadow-none bg-transparent focus-visible:bg-[hsl(var(--surface-subtle))] focus-visible:ring-0 focus-visible:border-input px-2", isIdRow && "opacity-70")}
                                    />
                                </div>

                                {/* Type */}
                                <div className="w-[25%] px-1 relative">
                                    {isIdRow ? (
                                        <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground opacity-70">
                                            <FileKey size={14} />
                                            <span>serial</span>
                                        </div>
                                    ) : (
                                        <Dropdown 
                                            triggerLabel={typeObj?.label || col.type}
                                            triggerIcon={typeObj?.icon}
                                            items={DATA_TYPES.map(t => ({ id: t.id, label: t.label, icon: t.icon }))}
                                            selectedId={col.type}
                                            onSelect={(item) => handleColumnChange(col.id, 'type', item.id)}
                                            width={160}
                                            className="h-8 w-full justify-start px-2 border-transparent hover:bg-[hsl(var(--surface-hover))] text-xs"
                                        />
                                    )}
                                </div>

                                {/* Default Value */}
                                <div className="w-[25%] px-1">
                                    <Input 
                                        value={col.defaultValue}
                                        onChange={(e) => handleColumnChange(col.id, 'defaultValue', e.target.value)}
                                        placeholder={isIdRow ? "自增" : "默认值"}
                                        disabled={isIdRow}
                                        className={cn("h-8 text-xs border-transparent shadow-none bg-transparent focus-visible:bg-[hsl(var(--surface-subtle))] focus-visible:ring-0 focus-visible:border-input px-2", isIdRow && "opacity-70")}
                                    />
                                </div>

                                {/* Primary Checkbox */}
                                <div className="w-[10%] flex justify-center">
                                    <Checkbox 
                                        checked={col.isPrimary}
                                        disabled
                                        className="h-4 w-4 rounded-sm border-input opacity-50 cursor-not-allowed"
                                    />
                                </div>

                                {/* Actions / Nullable */}
                                <div className="w-[10%] flex items-center justify-center gap-1">
                                    {isIdRow ? (
                                        <Switch checked disabled className="scale-75 opacity-70" />
                                    ) : (
                                        <>
                                            <div className="flex items-center" title="切换是否必填">
                                                <Switch 
                                                    checked={!col.isNullable} 
                                                    onCheckedChange={(c) => handleColumnChange(col.id, 'isNullable', !c)}
                                                    className="scale-75"
                                                />
                                            </div>
                                            <button 
                                                type="button"
                                                onClick={() => handleRemoveColumn(col.id)}
                                                className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                                                title="移除字段"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <Button 
                    variant="ghost" 
                    className="mt-3 text-primary hover:text-primary hover:bg-primary/10 w-auto h-8 text-xs font-medium px-3 ml-1"
                    onClick={handleAddColumn}
                >
                    <Plus size={14} className="mr-1.5" /> 添加更多字段
                </Button>
            </div>

            {/* Foreign Key Relation */}
            <div className="mb-6">
                <div className="mb-2">
                    <span className="text-[13px] font-medium text-foreground">外键关联</span>
                    <p className="text-xs text-muted-foreground mt-1">通过公共字段将当前表记录关联至已有数据表。</p>
                </div>
                
                {fkColumns.length > 0 ? (
                    <div className="space-y-2 mb-4">
                        {fkColumns.map(col => {
                            const config = (col as any).foreignKeyConfig as ForeignKeyConfig;
                            const targetTable = tables.find(t => t.id === config?.targetTableId);
                            return (
                                <div key={col.id} className="flex items-center justify-between p-2.5 bg-[hsl(var(--surface-subtle))] border border-border rounded-md text-xs group">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <Link2 size={14} className="text-primary shrink-0" />
                                        <div className="flex flex-col truncate">
                                            <span className="font-medium text-foreground">{col.name}</span>
                                            <span className="text-[11px] text-muted-foreground truncate">
                                                引用表：{targetTable?.name || config.targetTableId}
                                            </span>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveColumn(col.id)}>
                                        <Trash2 size={12} />
                                    </Button>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="flex items-center justify-center rounded-md border border-dashed border-border bg-[hsl(var(--surface-subtle))] p-4 mt-2 mb-3">
                        <div className="flex items-center text-muted-foreground">
                            <Link2 size={15} className="mr-2 opacity-60" />
                            <span className="text-xs">暂未添加外键关联</span>
                        </div>
                    </div>
                )}

                <Button 
                    variant="ghost" 
                    className="mt-1 text-primary hover:text-primary hover:bg-primary/10 w-auto h-8 text-xs font-medium px-3"
                    onClick={() => setShowFKDrawer(true)}
                >
                    <Plus size={14} className="mr-1.5" /> 添加关联
                </Button>
            </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-background flex justify-between items-center shrink-0">
             <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                 <HelpCircle size={14} />
                 默认自动包含自增主键 id 字段
             </span>
             
             <div className="flex gap-2.5">
                 <Button 
                    variant="outline" 
                    size="sm"
                    onClick={onClose}
                 >
                     取消
                 </Button>
                 <Button 
                    size="sm"
                    onClick={handleCreate}
                    className="px-5"
                    disabled={!tableName.trim()}
                 >
                     立即创建
                 </Button>
             </div>
        </div>
      </div>

      <ForeignKeyDrawer
          isOpen={showFKDrawer}
          onClose={() => setShowFKDrawer(false)}
          sourceTableName={tableName}
          sourceColumnName="新关联字段"
          tables={tables}
          getTargetColumns={getTargetColumns}
          onSave={handleFKSave}
          onDelete={() => setShowFKDrawer(false)}
          baseZIndex={80}
      />
    </>
  );

  return createPortal(content, document.body);
};

export default CreateTableDrawer;
