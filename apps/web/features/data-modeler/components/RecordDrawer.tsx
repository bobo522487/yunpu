import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save } from 'lucide-react';
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Switch } from "../../../components/ui/switch";
import { SchemaField } from '../../../types';
import { cn } from '../../../lib/utils';
import { resolveFieldIcon } from '../utils/fieldIcons';

export interface RecordDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialRecord?: Record<string, any> | null;
  onSave: (record: Record<string, any>) => void;
  schema: SchemaField[];
}

export const RecordDrawer: React.FC<RecordDrawerProps> = ({ 
    isOpen, 
    onClose, 
    initialRecord, 
    onSave, 
    schema
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const isEditMode = Boolean(initialRecord);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [nullStates, setNullStates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
        const initialData: Record<string, any> = initialRecord ? { ...initialRecord } : {};
        const initialNulls: Record<string, boolean> = {};

        schema.forEach(field => {
            if (field.type === 'serial') return;

            if (initialRecord) {
                const val = initialRecord[field.id];
                if (val === null) {
                    initialNulls[field.id] = true;
                    initialData[field.id] = null;
                } else {
                    initialNulls[field.id] = false;
                    if (val === undefined) {
                        initialData[field.id] = field.type === 'boolean' ? false : '';
                    }
                }
            } else {
                let val: any = field.defaultValue;
                if (field.type === 'boolean') {
                    val = val === 'true' || val === true;
                }

                if (val !== undefined && val !== null && val !== '' && val !== 'null') {
                    initialData[field.id] = val;
                    initialNulls[field.id] = false;
                } else if (field.isNullable) {
                    initialData[field.id] = null;
                    initialNulls[field.id] = true;
                } else {
                    initialData[field.id] = field.type === 'boolean' ? false : '';
                    initialNulls[field.id] = false;
                }
            }
        });

        setFormData(initialData);
        setNullStates(initialNulls);
    }
  }, [isOpen, initialRecord, schema]);

  if (!isMounted) return null;

  const handleChange = (id: string, value: any) => {
      setFormData(prev => ({ ...prev, [id]: value }));
      if (nullStates[id]) {
          setNullStates(prev => ({ ...prev, [id]: false }));
      }
  };

  const handleSetNull = (id: string) => {
      setNullStates(prev => ({ ...prev, [id]: true }));
      setFormData(prev => ({ ...prev, [id]: null }));
  };

  const handleSetCustom = (id: string) => {
      setNullStates(prev => ({ ...prev, [id]: false }));
      const field = schema.find(f => f.id === id);
      if (formData[id] === null) {
          const defaultVal = field?.type === 'boolean' ? false : '';
          setFormData(prev => ({ ...prev, [id]: defaultVal }));
      }
  };

  const handleSubmit = () => {
      onSave(formData);
      onClose();
  };

  const renderInput = (field: SchemaField) => {
      const value = formData[field.id];
      const isNullMode = nullStates[field.id];
      const inputValue = isNullMode ? '' : (value === null || value === undefined ? '' : value);
      const placeholderValue = isNullMode 
        ? '' 
        : (field.type === 'jsonb' ? '{ "key": "value" }' : "请输入值");

      if (field.type === 'serial') {
          return (
              <div className="relative">
                  <Input 
                      disabled 
                      value={isEditMode ? inputValue : "自动生成"} 
                      className="bg-[hsl(var(--surface-subtle))] text-muted-foreground"
                  />
              </div>
          );
      }

      let inputElement;

      if (field.type === 'boolean') {
          inputElement = (
              <div className="flex items-center h-10 px-1">
                  {!isNullMode && (
                      <Switch 
                          checked={!!inputValue}
                          onCheckedChange={(checked) => handleChange(field.id, checked)}
                      />
                  )}
              </div>
          );
      } else if (field.type === 'date with time') {
           inputElement = (
              <Input 
                  type={isNullMode ? "text" : "datetime-local"}
                  value={inputValue}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  className="bg-background"
                  placeholder=""
              />
           );
      } else if (field.type === 'int' || field.type === 'float' || field.type === 'bigint') {
          inputElement = (
              <Input 
                  type={isNullMode ? "text" : "number"}
                  placeholder={placeholderValue}
                  value={inputValue}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  className="bg-background"
              />
          );
      } else {
          inputElement = (
              <Input 
                  type="text"
                  placeholder={placeholderValue}
                  value={inputValue}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  className="bg-background"
              />
          );
      }

      return (
          <div className="relative">
              {inputElement}
              {isNullMode && (
                  <div 
                      style={{
                          position: 'absolute', 
                          top: '0px', 
                          left: '0px', 
                          width: '100%', 
                          height: '100%', 
                          zIndex: 1, 
                          cursor: 'pointer', 
                          backgroundColor: 'transparent'
                      }}
                      onClick={() => handleSetCustom(field.id)}
                  >
                      <div className="absolute top-1/2 left-3 -translate-y-1/2 pointer-events-none">
                          <span className="text-xs text-muted-foreground bg-muted/80 px-2 py-0.5 rounded border border-border shadow-sm">Null</span>
                      </div>
                  </div>
              )}
          </div>
      );
  };

  const content = (
    <>
      <div 
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      
      <div 
        className={`fixed inset-y-0 right-0 w-[480px] max-w-full bg-background shadow-[var(--shadow-popover)] transform transition-transform duration-200 z-[70] flex flex-col border-l border-border ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
            <h3 className="text-base font-semibold text-foreground tracking-tight">
                {isEditMode ? '编辑记录' : '新增记录'}
            </h3>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full">
                <X size={16} />
            </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-background">
            <div className="space-y-5">
                {schema.map(field => {
                    const isNullMode = nullStates[field.id];
                    const IconComponent = resolveFieldIcon(field);
                    
                    return (
                        <div key={field.id} className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
                                    <div className="w-5 h-5 flex items-center justify-center">
                                        {IconComponent && <IconComponent size={15} className="text-muted-foreground" />}
                                    </div>
                                    <span className="text-foreground">{field.name}</span>
                                </div>
                                
                                {field.type !== 'serial' && (
                                    <div className="flex bg-[hsl(var(--surface-subtle))] border border-border rounded-md p-0.5">
                                        <button 
                                            type="button"
                                            onClick={() => handleSetNull(field.id)}
                                            className={cn(
                                                "text-[11px] px-2.5 py-0.5 rounded transition-all font-medium",
                                                isNullMode 
                                                    ? "bg-background text-foreground shadow-[var(--shadow-control)]"
                                                    : "text-muted-foreground hover:text-foreground bg-transparent"
                                            )}
                                        >
                                            空值 (Null)
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => handleSetCustom(field.id)}
                                            className={cn(
                                                "text-[11px] px-2.5 py-0.5 rounded transition-all font-medium",
                                                !isNullMode 
                                                    ? "bg-background text-primary shadow-[var(--shadow-control)]"
                                                    : "text-muted-foreground hover:text-foreground bg-transparent"
                                            )}
                                        >
                                            自定义
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div>
                                {renderInput(field)}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

        <div className="p-4 border-t border-border bg-background mt-auto flex justify-between items-center shrink-0">
             <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                 <span className="bg-[hsl(var(--surface-subtle))] px-1.5 py-0.5 rounded border border-border font-mono text-[11px]">Enter</span>
                 <span>提交</span>
             </div>
             
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
                    onClick={handleSubmit}
                    className="px-4"
                 >
                     {isEditMode ? (
                         <>
                             <Save size={14} className="mr-1.5" /> 保存更改
                         </>
                     ) : '创建记录'}
                 </Button>
             </div>
        </div>
      </div>
    </>
  );

  return createPortal(content, document.body);
};

export default RecordDrawer;
