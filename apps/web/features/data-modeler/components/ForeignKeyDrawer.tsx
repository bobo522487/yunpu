
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink, Trash2, Save, Check, ChevronDown, Link2, ArrowRight, Settings2, Info, ArrowRightLeft } from 'lucide-react';
import { Button } from "../../../components/ui/button";
import { DbTable } from "../../../types";
import Dropdown from "../../../components/common/Dropdown";

interface ForeignKeyDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sourceTableName: string;
  sourceColumnName: string;
  tables: DbTable[];
  getTargetColumns: (tableId: string) => { id: string; name: string }[];
  onSave: (config: ForeignKeyConfig) => void;
  onDelete: () => void;
  baseZIndex?: number;
}

export interface ForeignKeyConfig {
  targetTableId: string;
  targetColumnId: string;
  onUpdate: string;
  onDelete: string;
}

const ForeignKeyDrawer: React.FC<ForeignKeyDrawerProps> = ({
  isOpen,
  onClose,
  sourceTableName,
  sourceColumnName,
  tables,
  getTargetColumns,
  onSave,
  onDelete,
  baseZIndex = 60
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const [config, setConfig] = useState<ForeignKeyConfig>({
    targetTableId: '',
    targetColumnId: '',
    onUpdate: 'RESTRICT',
    onDelete: 'RESTRICT'
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Reset config when drawer opens or source changes
  useEffect(() => {
    if (isOpen) {
      // Initialize with defaults or existing values if we had them
      // For now, default to empty/RESTRICT
      setConfig(prev => ({
        ...prev,
        targetTableId: prev.targetTableId || (tables.length > 0 ? tables[0].id : ''),
        targetColumnId: '', // Reset column when opening fresh usually
        onUpdate: 'RESTRICT',
        onDelete: 'RESTRICT'
      }));
    }
  }, [isOpen, tables]);

  // Update target columns when target table changes
  const targetColumns = config.targetTableId ? getTargetColumns(config.targetTableId) : [];
  
  // Auto-select first column if none selected
  useEffect(() => {
      if (config.targetTableId && !config.targetColumnId && targetColumns.length > 0) {
          setConfig(prev => ({ ...prev, targetColumnId: targetColumns[0].id }));
      }
  }, [config.targetTableId, targetColumns, config.targetColumnId]);

  if (!isMounted) return null;

  const ACTION_OPTIONS = [
      { id: 'RESTRICT', label: 'RESTRICT' },
      { id: 'CASCADE', label: 'CASCADE' },
      { id: 'SET NULL', label: 'SET NULL' },
      { id: 'NO ACTION', label: 'NO ACTION' },
  ];

  const content = (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ zIndex: baseZIndex }}
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div 
        className={`fixed inset-y-0 right-0 w-[560px] max-w-full bg-background shadow-[var(--shadow-popover)] transform transition-transform duration-200 flex flex-col border-l border-border ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ zIndex: baseZIndex + 10 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
            <h3 className="text-base font-semibold text-foreground tracking-tight">配置外键关联</h3>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full">
                <X size={16} />
            </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
            
            {/* TYPE Section */}
            <div className="mb-8">
                 <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                    <Link2 size={15} />
                    <span className="text-xs font-semibold tracking-wide">关联类型</span>
                 </div>
                 <div className="border border-input rounded-md px-3 py-1.5 bg-[hsl(var(--surface-subtle))] text-[13px] font-medium text-foreground inline-block min-w-[100px] text-center">
                    一对一 / 多对一 (Single)
                 </div>
            </div>

            {/* SOURCE Section */}
            <div className="mb-8">
                <div className="flex items-center gap-2 mb-1 text-muted-foreground">
                    <ArrowRightLeft size={15} />
                    <span className="text-xs font-semibold tracking-wide">源表 (SOURCE)</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">当前需要添加外键约束的数据表与字段</p>
                
                <div className="space-y-4 pl-1">
                    {/* Source Table */}
                    <div className="flex items-center justify-between">
                        <span className="text-[13px] font-medium text-foreground/85 w-24">数据表</span>
                        <div className="flex-1">
                            <div className="w-full border border-input bg-[hsl(var(--surface-subtle))] text-muted-foreground rounded-md px-3 py-2 text-[13px] flex justify-between items-center cursor-not-allowed">
                                <span>{sourceTableName}</span>
                                <ChevronDown size={14} className="opacity-50" />
                            </div>
                        </div>
                    </div>

                    {/* Source Column */}
                    <div className="flex items-center justify-between">
                        <span className="text-[13px] font-medium text-foreground/85 w-24">源字段</span>
                        <div className="flex-1">
                            <div className="w-full border border-input bg-[hsl(var(--surface-subtle))] text-muted-foreground rounded-md px-3 py-2 text-[13px] flex justify-between items-center cursor-not-allowed">
                                <span>{sourceColumnName || '新字段'}</span>
                                <ChevronDown size={14} className="opacity-50" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* TARGET Section */}
            <div className="mb-8">
                <div className="flex items-center gap-2 mb-1 text-muted-foreground">
                    <ArrowRight size={15} />
                    <span className="text-xs font-semibold tracking-wide">目标表 (TARGET)</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">被外键引用的主数据表与关联字段</p>

                <div className="space-y-4 pl-1">
                    {/* Target Table */}
                    <div className="flex items-center justify-between">
                        <span className="text-[13px] font-medium text-foreground/85 w-24">目标表</span>
                        <div className="flex-1 relative">
                             <Dropdown
                                triggerLabel={tables.find(t => t.id === config.targetTableId)?.name || '选择目标表'}
                                items={tables.map(t => ({ id: t.id, label: t.name }))}
                                onSelect={(item) => setConfig(prev => ({ ...prev, targetTableId: item.id, targetColumnId: '' }))}
                                selectedId={config.targetTableId}
                                className="w-full justify-between border border-input bg-background shadow-[var(--shadow-control)] rounded-md px-3 py-2 text-[13px] font-normal hover:border-[hsl(var(--border-strong))]"
                                width={380}
                             />
                        </div>
                    </div>

                    {/* Target Column */}
                    <div className="flex items-center justify-between">
                        <span className="text-[13px] font-medium text-foreground/85 w-24">目标字段</span>
                        <div className="flex-1 relative">
                            <Dropdown
                                triggerLabel={targetColumns.find(c => c.id === config.targetColumnId)?.name || '选择目标字段'}
                                items={targetColumns.map(c => ({ id: c.id, label: c.name }))}
                                onSelect={(item) => setConfig(prev => ({ ...prev, targetColumnId: item.id }))}
                                selectedId={config.targetColumnId}
                                className="w-full justify-between border border-input bg-background shadow-[var(--shadow-control)] rounded-md px-3 py-2 text-[13px] font-normal hover:border-[hsl(var(--border-strong))]"
                                width={380}
                                searchPlaceholder="搜索字段..."
                             />
                        </div>
                    </div>
                </div>
            </div>

            {/* ACTIONS Section */}
            <div className="mb-8">
                <div className="flex items-center gap-2 mb-1 text-muted-foreground">
                    <Settings2 size={15} />
                    <span className="text-xs font-semibold tracking-wide">级联规则 (ACTIONS)</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">当目标表记录发生更新或删除时，源表记录的联动策略</p>

                <div className="space-y-4 pl-1">
                    {/* On Update */}
                    <div className="flex items-center justify-between">
                        <span className="text-[13px] font-medium text-foreground/85 w-24">更新时</span>
                        <div className="flex-1 relative">
                             <Dropdown
                                triggerLabel={config.onUpdate}
                                items={ACTION_OPTIONS}
                                onSelect={(item) => setConfig(prev => ({ ...prev, onUpdate: item.id }))}
                                selectedId={config.onUpdate}
                                className="w-full justify-between border border-input bg-background shadow-[var(--shadow-control)] rounded-md px-3 py-2 text-[13px] font-normal hover:border-[hsl(var(--border-strong))]"
                                width={380}
                             />
                        </div>
                    </div>

                    {/* On Remove */}
                    <div className="flex items-center justify-between">
                        <span className="text-[13px] font-medium text-foreground/85 w-24">删除时</span>
                        <div className="flex-1 relative">
                            <Dropdown
                                triggerLabel={config.onDelete}
                                items={ACTION_OPTIONS}
                                onSelect={(item) => setConfig(prev => ({ ...prev, onDelete: item.id }))}
                                selectedId={config.onDelete}
                                className="w-full justify-between border border-input bg-background shadow-[var(--shadow-control)] rounded-md px-3 py-2 text-[13px] font-normal hover:border-[hsl(var(--border-strong))]"
                                width={380}
                             />
                        </div>
                    </div>
                </div>
            </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-background flex justify-between items-center shrink-0">
             <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                 <Info size={13} />
                 外键约束将自动校验引用完整性
             </span>
             
             <div className="flex items-center gap-2.5">
                 <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                    onClick={onDelete}
                 >
                     <Trash2 size={14} /> 移除关联
                 </Button>
                 <Button 
                    size="sm"
                    onClick={() => onSave(config)}
                    className="gap-1.5"
                 >
                     <Save size={14} /> 保存配置
                 </Button>
             </div>
        </div>
      </div>
    </>
  );

  return createPortal(content, document.body);
};

export default ForeignKeyDrawer;
