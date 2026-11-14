import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Switch } from "../../../components/ui/switch";
import { SchemaField, DbTable, SchemaFieldType } from '../../../types';
import Dropdown from '../../../components/common/Dropdown';
import { Database, ShieldCheck, Globe, Save, Trash2, ArrowRight, Settings2, X } from 'lucide-react';
import ForeignKeyDrawer, { ForeignKeyConfig } from './ForeignKeyDrawer';
import { DRAWER_DATA_TYPES, getIconKeyForType } from '../utils/fieldIcons';

export interface ColumnDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialField?: SchemaField | null;
  onSave: (field: SchemaField | (Partial<SchemaField> & { targetTableId?: string; foreignKeyConfig?: ForeignKeyConfig })) => void;
  onDelete?: (id: string) => void;
  tables: DbTable[];
  activeTableName: string;
  getTargetColumns: (tableId: string) => { id: string; name: string }[];
}

export const DATA_TYPES = DRAWER_DATA_TYPES;

export const TIMEZONES = [
    { id: 'UTC', label: 'UTC', offset: 'UTC+00:00' },
    { id: 'America/New_York', label: 'America/New_York', offset: 'UTC-05:00' },
    { id: 'America/Los_Angeles', label: 'America/Los_Angeles', offset: 'UTC-08:00' },
    { id: 'Europe/London', label: 'Europe/London', offset: 'UTC+00:00' },
    { id: 'Europe/Paris', label: 'Europe/Paris', offset: 'UTC+01:00' },
    { id: 'Asia/Tokyo', label: 'Asia/Tokyo', offset: 'UTC+09:00' },
    { id: 'Asia/Shanghai', label: 'Asia/Shanghai', offset: 'UTC+08:00' },
    { id: 'Australia/Sydney', label: 'Australia/Sydney', offset: 'UTC+11:00' },
];

export const ColumnDrawer: React.FC<ColumnDrawerProps> = ({ 
    isOpen, 
    onClose, 
    initialField,
    onSave, 
    onDelete,
    tables, 
    activeTableName, 
    getTargetColumns 
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const isEditMode = Boolean(initialField);
  
  // Form State
  const [columnName, setColumnName] = useState('');
  const [dataType, setDataType] = useState('varchar');
  const [defaultValue, setDefaultValue] = useState('');
  const [timeZone, setTimeZone] = useState('UTC');
  
  // Constraints
  const [isNotNull, setIsNotNull] = useState(false);
  const [isUnique, setIsUnique] = useState(false);
  const [isForeignKey, setIsForeignKey] = useState(false);

  // Foreign Key State
  const [showFKDrawer, setShowFKDrawer] = useState(false);
  const [fkConfig, setFkConfig] = useState<ForeignKeyConfig | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
        if (initialField) {
            setColumnName(initialField.name || '');
            setDataType(initialField.type || 'varchar');
            setDefaultValue(initialField.defaultValue || '');
            setTimeZone(initialField.timeZone || 'UTC');
            setIsNotNull(!initialField.isNullable);
            setIsUnique(Boolean(initialField.isUnique));
            const fkConf = (initialField as any).foreignKeyConfig;
            setIsForeignKey(Boolean(initialField.isForeignKey && fkConf));
            setFkConfig(fkConf || null);
        } else {
            setColumnName('');
            setDataType('varchar');
            setDefaultValue('');
            setTimeZone('UTC');
            setIsForeignKey(false);
            setFkConfig(null);
            setIsNotNull(false);
            setIsUnique(false);
        }
        setShowFKDrawer(false);
    }
  }, [isOpen, initialField]);

  if (!isMounted) return null;

  const handleSave = () => {
      if (!columnName.trim()) return;

      const typedDataType = dataType as SchemaFieldType;
      const iconName = getIconKeyForType(typedDataType);

      if (isEditMode && initialField) {
          const updatedField: SchemaField = {
              ...initialField,
              name: columnName,
              type: typedDataType,
              defaultValue,
              isForeignKey: isForeignKey && !!fkConfig,
              isNullable: !isNotNull,
              isUnique,
              timeZone: dataType === 'date with time' ? timeZone : undefined,
              iconName,
          };
          if (isForeignKey && fkConfig) {
              updatedField.foreignKeyConfig = fkConfig;
          } else {
              delete updatedField.foreignKeyConfig;
          }
          onSave(updatedField);
      } else {
          onSave({
              name: columnName,
              type: typedDataType,
              defaultValue,
              isForeignKey: isForeignKey && !!fkConfig,
              isNullable: !isNotNull,
              isUnique,
              isPrimary: dataType === 'serial',
              targetTableId: fkConfig?.targetTableId,
              foreignKeyConfig: fkConfig || undefined,
              timeZone: dataType === 'date with time' ? timeZone : undefined,
              iconName,
          });
      }
      onClose();
  };

  const handleFKSwitch = (checked: boolean) => {
      if (checked) {
          setShowFKDrawer(true);
          setIsForeignKey(true); 
      } else {
          setIsForeignKey(false);
          setFkConfig(null);
      }
  };

  const handleFKSave = (config: ForeignKeyConfig) => {
      setFkConfig(config);
      setIsForeignKey(true);
      setShowFKDrawer(false);
  };

  const handleFKDelete = () => {
      setFkConfig(null);
      setIsForeignKey(false);
      setShowFKDrawer(false);
  };

  const handleFKClose = () => {
      setShowFKDrawer(false);
      if (!fkConfig) {
          setIsForeignKey(false);
      }
  };

  const getFkDetails = () => {
    if (!fkConfig) return null;
    const table = tables.find(t => t.id === fkConfig.targetTableId);
    if (!table) return null;
    const cols = getTargetColumns(table.id);
    const col = cols.find(c => c.id === fkConfig.targetColumnId);
    return { 
        tableName: table.name, 
        colName: col?.name || 'Unknown' 
    };
  };

  const fkDetails = getFkDetails();
  const selectedTypeObj = DATA_TYPES.find(t => t.id === dataType);

  const getTzLabel = (id: string) => {
      const tz = TIMEZONES.find(t => t.id === id);
      if (!tz) return id;
      return `${tz.label} (${tz.offset})`;
  };

  const content = (
    <>
      <div 
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      
      <div 
        className={`fixed inset-y-0 right-0 w-[560px] max-w-full bg-background shadow-[var(--shadow-popover)] transform transition-transform duration-200 z-[70] flex flex-col border-l border-border ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
            <h3 className="text-base font-semibold text-foreground tracking-tight">
                {isEditMode ? '编辑字段' : '新建字段'}
            </h3>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full">
                <X size={16} />
            </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-background">
            <div className="mb-8">
                 <div className="flex items-center gap-2 mb-4 text-muted-foreground">
                    <Database size={15} />
                    <span className="text-xs font-semibold tracking-wide">基础配置</span>
                 </div>
                 
                 <div className="space-y-4 pl-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[13px] font-medium text-foreground/85 w-32">字段名称</span>
                        <div className="flex-1">
                            <Input 
                                value={columnName}
                                onChange={(e) => setColumnName(e.target.value)}
                                placeholder="请输入字段名称"
                                autoFocus
                                className="h-9 text-[13px]"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="text-[13px] font-medium text-foreground/85 w-32">数据类型</span>
                        <div className="flex-1 relative">
                            <Dropdown
                                triggerLabel={selectedTypeObj?.label || '选择数据类型'}
                                triggerIcon={selectedTypeObj?.icon}
                                items={DATA_TYPES.map(t => ({ id: t.id, label: t.label, icon: t.icon }))}
                                selectedId={dataType}
                                onSelect={(item) => setDataType(item.id)}
                                width={380}
                                className="w-full justify-between border border-input bg-background shadow-[var(--shadow-control)] rounded-md px-3 py-2 text-[13px] font-normal hover:border-[hsl(var(--border-strong))]"
                            />
                        </div>
                    </div>

                    {dataType === 'date with time' && (
                        <div className="flex items-center justify-between">
                            <span className="text-[13px] font-medium text-foreground/85 w-32">显示时区</span>
                            <div className="flex-1 relative">
                                <Dropdown
                                    triggerLabel={getTzLabel(timeZone)}
                                    triggerIcon={Globe}
                                    items={TIMEZONES.map(t => ({ id: t.id, label: `${t.label} (${t.offset})` }))}
                                    selectedId={timeZone}
                                    onSelect={(item) => setTimeZone(item.id)}
                                    width={380}
                                    className="w-full justify-between border border-input bg-background shadow-[var(--shadow-control)] rounded-md px-3 py-2 text-[13px] font-normal hover:border-[hsl(var(--border-strong))]"
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <span className="text-[13px] font-medium text-foreground/85 w-32">默认值</span>
                        <div className="flex-1">
                            <Input 
                                value={defaultValue}
                                onChange={(e) => setDefaultValue(e.target.value)}
                                placeholder="请输入默认值（可选）"
                                className="h-9 text-[13px]"
                            />
                        </div>
                    </div>
                 </div>
            </div>

            <div className="mb-8">
                <div className="flex items-center gap-2 mb-4 text-muted-foreground">
                    <ShieldCheck size={15} />
                    <span className="text-xs font-semibold tracking-wide">约束条件</span>
                </div>

                <div className="space-y-5 pl-1">
                    <div className="flex items-start justify-between">
                        <div className="flex flex-col gap-1 max-w-[350px]">
                             <div className="flex items-center gap-2">
                                <span className="text-[13px] font-medium text-foreground/85">外键关联 (Foreign Key)</span>
                                {isForeignKey && !fkConfig && (
                                     <span className="flex items-center text-[11px] text-primary bg-primary/10 px-1.5 py-0.5 rounded cursor-pointer hover:underline" onClick={() => setShowFKDrawer(true)}>
                                         <Settings2 size={10} className="mr-1" /> 去配置
                                     </span>
                                )}
                             </div>
                             <span className="text-xs text-muted-foreground">将此字段关联到其他数据表的记录</span>

                             {isForeignKey && fkConfig && fkDetails && (
                                <div className="mt-2 flex items-center gap-2 bg-[hsl(var(--surface-subtle))] border border-border rounded-md px-2.5 py-1.5 w-fit">
                                    <span className="text-xs font-medium text-foreground">{columnName || '当前字段'}</span>
                                    <div className="flex items-center justify-center text-muted-foreground">
                                        <ArrowRight size={12} />
                                    </div>
                                    <span className="text-xs font-medium text-foreground">{fkDetails.tableName}.{fkDetails.colName}</span>
                                    <div 
                                        className="ml-2 cursor-pointer flex items-center justify-center text-muted-foreground hover:text-foreground"
                                        onClick={() => setShowFKDrawer(true)}
                                    >
                                        <Settings2 size={12} />
                                    </div>
                                </div>
                             )}
                        </div>
                        <Switch 
                            checked={isForeignKey}
                            onCheckedChange={handleFKSwitch}
                        />
                    </div>

                    <div className="flex items-start justify-between">
                        <div className="flex flex-col gap-1 max-w-[350px]">
                             <span className="text-[13px] font-medium text-foreground/85">非空约束 (NOT NULL)</span>
                             <span className="text-xs text-muted-foreground">禁止在此字段中录入空值 (NULL)</span>
                        </div>
                        <Switch 
                            checked={isNotNull}
                            onCheckedChange={setIsNotNull}
                        />
                    </div>

                    <div className="flex items-start justify-between">
                        <div className="flex flex-col gap-1 max-w-[350px]">
                             <span className="text-[13px] font-medium text-foreground/85">唯一约束 (UNIQUE)</span>
                             <span className="text-xs text-muted-foreground">禁止在此字段中出现重复值</span>
                        </div>
                        <Switch 
                            checked={isUnique}
                            onCheckedChange={setIsUnique}
                        />
                    </div>
                </div>
            </div>
        </div>

        <div className="p-4 border-t border-border bg-background mt-auto flex justify-between items-center shrink-0">
             {isEditMode && onDelete && initialField ? (
                 <Button variant="ghost" onClick={() => { onDelete(initialField.id); onClose(); }} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                     <Trash2 size={14} className="mr-1.5" /> 删除字段
                 </Button>
             ) : (
                 <div />
             )}
             <div className="flex gap-2.5">
                 <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
                 <Button 
                    size="sm"
                    onClick={handleSave} 
                    disabled={!columnName.trim()}
                    className="gap-1.5"
                 >
                    {isEditMode ? (
                        <>
                            <Save size={14} /> 保存更改
                        </>
                    ) : (
                        <>
                            创建字段 <ArrowRight size={14} />
                        </>
                    )}
                 </Button>
             </div>
        </div>
      </div>

      <ForeignKeyDrawer
          isOpen={showFKDrawer}
          onClose={handleFKClose}
          sourceTableName={activeTableName}
          sourceColumnName={columnName}
          tables={tables}
          getTargetColumns={getTargetColumns}
          onSave={handleFKSave}
          onDelete={handleFKDelete}
          baseZIndex={80}
      />
    </>
  );

  return createPortal(content, document.body);
};

export default ColumnDrawer;
