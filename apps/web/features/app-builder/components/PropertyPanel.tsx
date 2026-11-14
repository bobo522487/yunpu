
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  MoreVertical, 
  ChevronDown, 
  ChevronRight, 
  LayoutGrid,
  Database,
  Zap,
  Palette,
  Plus,
  Trash2,
  Check,
  SlidersHorizontal
} from 'lucide-react';
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Button } from "../../../components/ui/button";
import { Textarea } from "../../../components/ui/textarea";
import { Switch } from "../../../components/ui/switch";
import { Checkbox } from "../../../components/ui/checkbox";
import {
  GridItemData,
  LayoutItem,
  Page,
  QueryConfig,
  WidgetInstance,
} from '../../../types';
import { registry } from '../../../widgets/registry';
import { PropDefinition } from '../../../widgets/types';
import { useDataStore } from '../../../store/useDataStore';
import { cn } from '../../../lib/utils';

// --- Types ---

type PanelTab = 'PROPERTIES' | 'STYLES' | 'DATA' | 'BEHAVIOR';

// --- Shared Components ---

const FxButton = ({ active = false }: { active?: boolean }) => (
  <Button 
    variant="ghost"
    size="sm"
    className={`ml-auto h-5 px-1 text-[10px] font-mono font-medium ${
        active 
        ? 'text-primary' 
        : 'text-muted-foreground'
    }`}
    title="切换动态表达式"
  >
    Fx
  </Button>
);

const ControlHeader = ({ label, fx = false }: { label: string, fx?: boolean }) => (
  <div className="flex items-center justify-between mb-2">
    <Label className="text-[12px] text-muted-foreground font-medium">{label}</Label>
    {fx && <FxButton />}
  </div>
);

const Accordion: React.FC<{ title: string, children?: React.ReactNode, defaultOpen?: boolean }> = ({ title, children, defaultOpen = true }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border">
      <Button 
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2.5 h-auto hover:bg-[hsl(var(--surface-hover))] rounded-none group"
      >
        <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors">{title}</span>
        </div>
        {isOpen ? (
            <ChevronDown size={14} className="text-muted-foreground" />
        ) : (
            <ChevronRight size={14} className="text-muted-foreground" />
        )}
      </Button>
      {isOpen && (
        <div className="px-4 pb-4 pt-1 animate-in slide-in-from-top-1 duration-200">
          {children}
        </div>
      )}
    </div>
  );
};

// --- Setter Controls ---

interface ControlProps {
  value: any;
  onChange: (val: any) => void;
  propDef: PropDefinition;
}

const TextControl: React.FC<ControlProps> = ({ value, onChange, propDef }) => (
  <div className="relative">
    <Input 
        type="text" 
        value={value ?? ''} 
        onChange={(e) => onChange(e.target.value)}
        placeholder={propDef.description}
        className="h-8 text-xs bg-background"
    />
  </div>
);

const NumberControl: React.FC<ControlProps> = ({ value, onChange, propDef }) => (
    <div className="relative">
      <Input 
          type="number" 
          value={value ?? 0} 
          onChange={(e) => onChange(Number(e.target.value))}
          placeholder={propDef.description}
          className="h-8 text-xs bg-background tabular-nums"
      />
    </div>
);

const TextareaControl: React.FC<ControlProps> = ({ value, onChange, propDef }) => (
    <Textarea
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={propDef.description}
        className="text-xs min-h-[80px] bg-background"
    />
);

const SelectControl: React.FC<ControlProps> = ({ value, onChange, propDef }) => {
  const options = propDef.setter?.props?.options || [];
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const handleOpen = () => {
      if (triggerRef.current) {
          const rect = triggerRef.current.getBoundingClientRect();
          setCoords({
              top: rect.bottom + 4,
              left: rect.left
          });
          setWidth(rect.width);
      }
      setIsOpen(true);
  };

  useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            if (
                popoverRef.current && 
                !popoverRef.current.contains(e.target as Node) &&
                triggerRef.current && 
                !triggerRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        const handleScroll = () => { if (isOpen) setIsOpen(false); };

        if (isOpen) {
            document.addEventListener('mousedown', handleMouseDown);
            window.addEventListener('scroll', handleScroll, true);
            window.addEventListener('resize', handleScroll);
        }
        return () => {
            document.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleScroll);
        };
  }, [isOpen]);

  const selectedOpt = options.find((o: any) => (typeof o === 'string' ? o : o.value) === value);
  const displayLabel = selectedOpt ? (typeof selectedOpt === 'string' ? selectedOpt : selectedOpt.label) : (value || '请选择...');

  return (
      <div className="relative">
          <div 
              ref={triggerRef}
              onClick={handleOpen}
              className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1.5 text-xs cursor-pointer hover:border-[hsl(var(--border-strong))] transition-colors shadow-[var(--shadow-control)]"
          >
              <span className="truncate text-foreground">{displayLabel}</span>
              <ChevronDown size={12} className="text-muted-foreground opacity-60 shrink-0 ml-2" />
          </div>
          
          {isOpen && createPortal(
              <div 
                  ref={popoverRef}
                  className="fixed z-[9999] bg-popover text-popover-foreground border border-border rounded-lg shadow-[var(--shadow-popover)] animate-in fade-in zoom-in-95 duration-100 p-1 overflow-y-auto max-h-[300px]"
                  style={{ top: coords.top, left: coords.left, width: width, minWidth: '120px' }}
              >
                  {options.map((opt: any) => {
                      const val = typeof opt === 'string' ? opt : opt.value;
                      const label = typeof opt === 'string' ? opt : opt.label;
                      const isSelected = val === value;
                      return (
                          <div 
                              key={val}
                              onClick={(e) => {
                                  e.stopPropagation();
                                  onChange(val); 
                                  setIsOpen(false); 
                              }}
                              className={cn(
                                  "flex items-center justify-between px-2 py-1.5 text-xs rounded-md cursor-pointer transition-colors",
                                  isSelected 
                                      ? "bg-primary text-primary-foreground font-medium" 
                                      : "hover:bg-[hsl(var(--surface-hover))] text-foreground"
                              )}
                          >
                              <span className="truncate">{label}</span>
                              {isSelected && <Check size={12} className="shrink-0 ml-2" />}
                          </div>
                      );
                  })}
              </div>,
              document.body
          )}
      </div>
  );
};

const SwitchControl: React.FC<ControlProps> = ({ value, onChange, propDef }) => {
    const isChecked = !!value;
    return (
        <div className="flex items-center justify-between mb-3">
            <Label className="text-[11px] text-muted-foreground font-medium cursor-pointer" onClick={() => onChange(!isChecked)}>
                {propDef.label}
            </Label>
            <div className="flex items-center gap-2">
                <Switch checked={isChecked} onCheckedChange={onChange} />
            </div>
        </div>
    );
};

// --- Enhanced Color Control ---

const THEME_COLORS = [
    { label: '品牌色 / 主色', value: 'hsl(var(--primary))', bg: 'bg-primary' },
    { label: '品牌色 / 辅色', value: 'hsl(var(--secondary))', bg: 'bg-secondary' },
    { label: '文本 / 主要', value: 'hsl(var(--foreground))', bg: 'bg-foreground' },
    { label: '文本 / 次要', value: 'hsl(var(--muted-foreground))', bg: 'bg-muted-foreground' },
    { label: '边框 / 默认', value: 'hsl(var(--border))', bg: 'bg-border' },
    { label: '背景 / 画布', value: 'hsl(var(--background))', bg: 'bg-background' },
    { label: '背景 / 卡片', value: 'hsl(var(--card))', bg: 'bg-card' },
    { label: '状态 / 危险', value: 'hsl(var(--destructive))', bg: 'bg-destructive' },
];

const ColorControl: React.FC<ControlProps> = ({ value, onChange, propDef }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [mode, setMode] = useState<'theme' | 'custom'>('theme');
    const triggerRef = useRef<HTMLDivElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ top: 0, left: 0 });

    const handleOpen = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setPosition({
                top: rect.bottom + 6,
                left: Math.max(10, rect.left - 240 + rect.width) // Align roughly to right edge but keep on screen
            });
        }
        setIsOpen(true);
    };

    useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            if (
                popoverRef.current && 
                !popoverRef.current.contains(e.target as Node) &&
                triggerRef.current && 
                !triggerRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        const handleScroll = () => { if (isOpen) setIsOpen(false); };

        if (isOpen) {
            document.addEventListener('mousedown', handleMouseDown);
            window.addEventListener('scroll', handleScroll, true);
        }
        return () => {
            document.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [isOpen]);

    const activeThemeColor = THEME_COLORS.find(c => c.value === value);

    return (
        <div className="mb-2">
            {/* Trigger */}
            <div 
                ref={triggerRef} 
                onClick={handleOpen} 
                className="flex items-center gap-2 p-1.5 border border-input rounded-md cursor-pointer hover:border-[hsl(var(--border-strong))] transition-colors bg-background shadow-[var(--shadow-control)] group"
            >
                <div 
                    className="w-5 h-5 rounded-sm border border-border relative overflow-hidden"
                >
                    <div 
                        className="absolute inset-0"
                        style={{ backgroundColor: value || 'transparent' }} 
                    />
                    {!value && (
                        <div className="absolute inset-0 bg-muted/20 flex items-center justify-center">
                            <div className="w-full h-[1px] bg-destructive rotate-45 transform" />
                        </div>
                    )}
                </div>
                <span className="text-xs text-muted-foreground flex-1 truncate group-hover:text-foreground transition-colors">
                    {activeThemeColor ? activeThemeColor.label : (value || '选择颜色')}
                </span>
                <ChevronDown size={12} className="text-muted-foreground" />
            </div>

            {/* Popover */}
            {isOpen && createPortal(
                <div 
                    ref={popoverRef}
                    className="fixed z-[9999] w-64 bg-popover text-popover-foreground border border-border rounded-lg shadow-[var(--shadow-popover)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                    style={{ top: position.top, left: position.left }}
                >
                    {/* Tabs */}
                    <div className="flex border-b border-border">
                        <button 
                            className={`flex-1 py-2 text-xs font-medium transition-colors ${mode === 'theme' ? 'bg-background text-foreground border-b-2 border-primary' : 'bg-[hsl(var(--surface-subtle))] text-muted-foreground hover:text-foreground'}`}
                            onClick={() => setMode('theme')}
                        >
                            主题色
                        </button>
                        <button 
                            className={`flex-1 py-2 text-xs font-medium transition-colors ${mode === 'custom' ? 'bg-background text-foreground border-b-2 border-primary' : 'bg-[hsl(var(--surface-subtle))] text-muted-foreground hover:text-foreground'}`}
                            onClick={() => setMode('custom')}
                        >
                            自定义
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-2 max-h-[240px] overflow-y-auto">
                        {mode === 'theme' ? (
                            <div className="space-y-1">
                                {THEME_COLORS.map(color => (
                                    <div 
                                        key={color.label}
                                        onClick={() => { onChange(color.value); setIsOpen(false); }}
                                        className={cn(
                                            "flex items-center gap-3 p-1.5 rounded-md cursor-pointer hover:bg-[hsl(var(--surface-hover))] transition-colors",
                                            value === color.value && "bg-accent"
                                        )}
                                    >
                                        <div className={`w-5 h-5 rounded-full border border-border/60 ${color.bg}`} />
                                        <span className="text-xs text-foreground flex-1">{color.label}</span>
                                        {value === color.value && <Check size={12} className="text-primary" />}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-4 p-2">
                                <div className="space-y-2">
                                    <Label className="text-[11px] text-muted-foreground">十六进制色值</Label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">#</span>
                                            <Input 
                                                className="h-8 pl-5 text-xs font-mono"
                                                value={value?.replace('#', '') || ''}
                                                onChange={(e) => onChange(`#${e.target.value}`)}
                                                placeholder="000000"
                                            />
                                        </div>
                                        <div className="w-8 h-8 rounded border border-input overflow-hidden relative shrink-0">
                                            <input 
                                                type="color" 
                                                className="absolute inset-0 w-[150%] h-[150%] -top-1/4 -left-1/4 cursor-pointer p-0 border-0"
                                                value={value?.startsWith('#') ? value : '#000000'}
                                                onChange={(e) => onChange(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                                
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="w-full text-xs h-7"
                                    onClick={() => { onChange(''); setIsOpen(false); }}
                                >
                                    清除颜色
                                </Button>
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

const ButtonGroupControl: React.FC<ControlProps> = ({ value, onChange, propDef }) => {
    const options = propDef.setter?.props?.options || [];
    return (
        <div>
            <div className="flex flex-wrap gap-0.5 bg-[hsl(var(--surface-subtle))] p-0.5 rounded-lg border border-border">
                {options.map((opt: any) => {
                    const isActive = value === opt.value;
                    return (
                        <button
                            key={opt.value}
                            onClick={() => onChange(opt.value)}
                            className={cn(
                                "flex-1 px-2 py-1 text-[11px] rounded-md font-medium transition-all border min-w-[30px] flex items-center justify-center whitespace-nowrap",
                                isActive 
                                    ? "bg-background text-foreground border-border/60 shadow-[var(--shadow-control)]" 
                                    : "border-transparent text-muted-foreground hover:bg-[hsl(var(--surface-hover))] hover:text-foreground"
                            )}
                            title={opt.label}
                        >
                            {opt.icon ? <opt.icon size={14} /> : opt.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const SETTER_COMPONENTS: Record<string, React.FC<ControlProps>> = {
    text: TextControl,
    number: NumberControl,
    textarea: TextareaControl,
    select: SelectControl,
    switch: SwitchControl,
    color: ColorControl,
    buttonGroup: ButtonGroupControl
};

// --- Reusable Query Builder Component ---

interface QueryEditorProps {
    query: QueryConfig;
    onChange: (newQuery: QueryConfig) => void;
}

const QueryEditor: React.FC<QueryEditorProps> = ({ query, onChange }) => {
    const tables = useDataStore((s) => s.tables);
    const schemas = useDataStore((s) => s.schemas);
    const { definition } = query;

    const handleDefChange = (key: string, val: any) => {
        const newQuery = { 
            ...query, 
            definition: { ...definition, [key]: val } 
        };
        onChange(newQuery);
    };

    const tableSchema = definition.tableId ? schemas[definition.tableId] || [] : [];
    const columns = tableSchema.map((col) => col.id);

    return (
        <div className="space-y-4">
            <div>
                <ControlHeader label="数据源类型" fx={false} />
                <select 
                    className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground shadow-[var(--shadow-control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                    value={definition.source || 'managed'}
                    onChange={(e) => handleDefChange('source', e.target.value)}
                >
                    <option value="managed">托管数据库</option>
                    <option value="external">外部 API</option>
                </select>
            </div>

            {definition.source === 'managed' && (
                <div>
                    <ControlHeader label="数据表" fx={false} />
                    <select 
                        className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground shadow-[var(--shadow-control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                        value={definition.tableId || ''}
                        onChange={(e) => handleDefChange('tableId', e.target.value)}
                    >
                        <option value="">请选择数据表...</option>
                        {tables.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {definition.tableId && (
                <>
                    <div>
                        <ControlHeader label="展示字段" fx={false} />
                        <div className="border border-input rounded-md p-2 max-h-32 overflow-y-auto space-y-1.5 bg-background shadow-[var(--shadow-control)]">
                            {columns.map(col => {
                                const isSelected = definition.select?.includes(col);
                                return (
                                    <div key={col} className="flex items-center space-x-2">
                                        <Checkbox 
                                            id={`col-${col}`} 
                                            checked={isSelected}
                                            onCheckedChange={(checked) => {
                                                const current = definition.select || [];
                                                const next = checked 
                                                    ? [...current, col]
                                                    : current.filter((c: string) => c !== col);
                                                handleDefChange('select', next);
                                            }}
                                        />
                                        <label
                                            htmlFor={`col-${col}`}
                                            className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                        >
                                            {col}
                                        </label>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <div className="flex-1">
                            <ControlHeader label="排序字段" fx={false} />
                            <select 
                                className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground shadow-[var(--shadow-control)]"
                                value={definition.orderBy || ''}
                                onChange={(e) => handleDefChange('orderBy', e.target.value)}
                            >
                                <option value="">无</option>
                                {columns.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="w-24">
                            <ControlHeader label="排序方向" fx={false} />
                            <select 
                                className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground shadow-[var(--shadow-control)]"
                                value={definition.orderDir || 'asc'}
                                onChange={(e) => handleDefChange('orderDir', e.target.value)}
                            >
                                <option value="asc">升序 (ASC)</option>
                                <option value="desc">降序 (DESC)</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <ControlHeader label="返回条数 (Limit)" fx={false} />
                        <Input 
                            type="number" 
                            className="h-8 text-xs bg-background tabular-nums"
                            value={definition.limit}
                            onChange={(e) => handleDefChange('limit', parseInt(e.target.value))}
                        />
                    </div>
                </>
            )}

            <div className="p-3 bg-[hsl(var(--surface-subtle))] border border-border rounded-lg">
                <ControlHeader label="查询结构预览" fx={false} />
                <pre className="text-[10px] bg-background p-2 rounded border border-border overflow-x-auto text-muted-foreground font-mono">
                    {JSON.stringify(query, null, 2)}
                </pre>
            </div>
        </div>
    );
};

// --- Page Data Tab ---

const PageDataTab = ({ page, onUpdate }: { page: Page, onUpdate: (updates: Partial<Page>) => void }) => {
    const [activeQueryId, setActiveQueryId] = useState<string | null>(null);
    const content = page.content || {};
    const stateVars = content.state || {};
    const queries = content.queries || {};

    const handleAddVariable = () => {
        const key = `var${Object.keys(stateVars).length + 1}`;
        onUpdate({
            content: {
                ...content,
                state: { ...stateVars, [key]: '' }
            }
        });
    };

    const handleUpdateVariable = (oldKey: string, newKey: string, newVal: any) => {
        const newState = { ...stateVars };
        if (oldKey !== newKey) {
            delete newState[oldKey];
        }
        newState[newKey] = newVal;
        onUpdate({ content: { ...content, state: newState } });
    };

    const handleDeleteVariable = (key: string) => {
        const newState = { ...stateVars };
        delete newState[key];
        onUpdate({ content: { ...content, state: newState } });
    };

    const handleAddQuery = () => {
        const id = `query${Object.keys(queries).length + 1}`;
        onUpdate({
            content: {
                ...content,
                queries: {
                    ...queries,
                    [id]: { 
                        id, 
                        type: 'sql', 
                        definition: { source: 'managed', limit: 10 } 
                    }
                }
            }
        });
        setActiveQueryId(id);
    };

    const handleUpdateQuery = (query: QueryConfig) => {
        onUpdate({
            content: {
                ...content,
                queries: {
                    ...queries,
                    [query.id]: query
                }
            }
        });
    };

    if (activeQueryId && queries[activeQueryId]) {
        return (
            <div className="pb-8">
                <div className="p-3 border-b border-border flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setActiveQueryId(null)} title="返回">
                        <ChevronDown className="rotate-90" size={14} />
                    </Button>
                    <span className="text-xs font-semibold truncate">正在编辑：{activeQueryId}</span>
                </div>
                <div className="p-4">
                    <QueryEditor query={queries[activeQueryId]} onChange={handleUpdateQuery} />
                </div>
            </div>
        );
    }

    return (
        <div className="pb-8">
            <Accordion title="状态变量" defaultOpen={true}>
                <div className="space-y-2">
                    {Object.entries(stateVars).map(([key, val]) => (
                        <div key={key} className="flex items-center gap-2 mb-2">
                            <Input 
                                className="h-7 text-xs font-mono w-1/3 bg-background" 
                                value={key} 
                                onChange={(e) => handleUpdateVariable(key, e.target.value, val)}
                            />
                            <span className="text-muted-foreground text-xs">=</span>
                            <Input 
                                className="h-7 text-xs flex-1 bg-background" 
                                value={val as string} 
                                onChange={(e) => handleUpdateVariable(key, key, e.target.value)}
                                placeholder="值"
                            />
                            <button onClick={() => handleDeleteVariable(key)} className="text-muted-foreground hover:text-destructive transition-colors" title="删除变量">
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))}
                    <Button variant="outline" size="sm" className="w-full text-xs h-7 mt-2" onClick={handleAddVariable}>
                        <Plus size={12} className="mr-1" /> 添加变量
                    </Button>
                </div>
            </Accordion>

            <Accordion title="数据查询">
                <div className="space-y-1">
                    {Object.values(queries).map((q: any) => (
                        <div 
                            key={q.id} 
                            className="flex items-center justify-between p-2 rounded-md hover:bg-[hsl(var(--surface-hover))] cursor-pointer group"
                            onClick={() => setActiveQueryId(q.id)}
                        >
                            <div className="flex items-center gap-2">
                                <Database size={12} className="text-primary" />
                                <span className="text-xs font-medium">{q.id}</span>
                            </div>
                            <ChevronRight size={12} className="text-muted-foreground opacity-0 group-hover:opacity-100" />
                        </div>
                    ))}
                    <Button variant="outline" size="sm" className="w-full text-xs h-7 mt-2" onClick={handleAddQuery}>
                        <Plus size={12} className="mr-1" /> 新建查询
                    </Button>
                </div>
            </Accordion>
        </div>
    );
};

// --- Widget Data Tab ---

type WidgetUpdater = (id: string, updates: Partial<Omit<WidgetInstance, 'id'>>) => void;
type GeometryUpdater = (id: string, updates: Partial<Omit<LayoutItem, 'i'>>) => void;

const WidgetDataTab = ({ item, onUpdate }: { item: GridItemData, onUpdate: WidgetUpdater }) => {
    const widgetDef = registry.get(item.type);
    
    // Check if widget supports data
    if (!widgetDef?.manifest.data) {
        return (
            <div className="p-6 flex flex-col items-center justify-center text-center opacity-70">
                <Database size={28} className="mb-2 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">该组件暂不支持绑定数据源</p>
            </div>
        );
    }

    const query = item.content?._query || { type: 'sql', definition: { source: 'managed', limit: 50 } };

    const handleQueryUpdate = (newQuery: QueryConfig) => {
        onUpdate(item.i, { 
            content: { ...item.content, _query: newQuery } 
        });
    };

    return (
        <div className="pb-8">
            <Accordion title="数据源">
                <div className="space-y-4">
                    <QueryEditor query={query} onChange={handleQueryUpdate} />
                </div>
            </Accordion>
        </div>
    );
};

// --- Interaction Tab Components (Shared) ---

const InteractionList = ({ events, interactions, onAdd, onRemove, onUpdate }: any) => {
    if (events.length === 0) {
        return (
            <div className="p-6 flex flex-col items-center justify-center text-center opacity-70">
                <Zap size={28} className="mb-2 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">暂无可用交互事件</p>
            </div>
        );
    }

    return (
        <div className="pb-8">
            <div className="p-4 border-b border-border">
                <Button onClick={onAdd} size="sm" className="w-full gap-1.5 text-xs" variant="outline">
                    <Plus size={14} /> 添加事件处理
                </Button>
            </div>

            {interactions.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                    暂未配置交互动作
                </div>
            ) : (
                <div className="p-3 space-y-3">
                    {interactions.map((interaction: any, idx: number) => (
                        <div key={interaction.id} className="p-3 rounded-lg border border-border bg-[hsl(var(--surface-subtle))] space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-foreground tabular-nums">事件动作 #{idx + 1}</span>
                                <button onClick={() => onRemove(interaction.id)} className="text-muted-foreground hover:text-destructive transition-colors" title="删除动作">
                                    <Trash2 size={13} />
                                </button>
                            </div>
                            
                            <div className="space-y-3">
                                <div>
                                    <ControlHeader label="触发事件" fx={false} />
                                    <select 
                                        className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground shadow-[var(--shadow-control)]"
                                        value={interaction.event}
                                        onChange={(e) => onUpdate(interaction.id, 'event', e.target.value)}
                                    >
                                        {events.map((ev: any) => (
                                            <option key={ev.name} value={ev.name}>{ev.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <ControlHeader label="执行动作" fx={false} />
                                    <select 
                                        className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground shadow-[var(--shadow-control)]"
                                        value={interaction.action}
                                        onChange={(e) => onUpdate(interaction.id, 'action', e.target.value)}
                                    >
                                        <option value="navigate">跳转页面</option>
                                        <option value="showToast">弹出提示</option>
                                        <option value="runQuery">运行查询</option>
                                        <option value="setState">更新状态</option>
                                    </select>
                                </div>

                                {/* Param Config based on Action */}
                                {interaction.action === 'navigate' && (
                                    <div>
                                        <ControlHeader label="目标路径" />
                                        <Input 
                                            className="h-8 text-xs bg-background" 
                                            placeholder="/home"
                                            value={interaction.params?.url || ''}
                                            onChange={(e) => onUpdate(interaction.id, 'params', { ...interaction.params, url: e.target.value })}
                                        />
                                    </div>
                                )}
                                {interaction.action === 'showToast' && (
                                    <div>
                                        <ControlHeader label="提示文案" />
                                        <Input 
                                            className="h-8 text-xs bg-background" 
                                            placeholder="操作成功"
                                            value={interaction.params?.message || ''}
                                            onChange={(e) => onUpdate(interaction.id, 'params', { ...interaction.params, message: e.target.value })}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

const WidgetInteractionTab = ({ item, onUpdate }: { item: GridItemData, onUpdate: WidgetUpdater }) => {
    const widgetDef = registry.get(item.type);
    const events = widgetDef?.manifest.events || [];
    const interactions = item.content?._interactions || [];

    const handleAdd = () => {
        if (events.length === 0) return;
        const newInteraction = { id: `int_${Date.now()}`, event: events[0].name, action: 'navigate', params: {} };
        onUpdate(item.i, { content: { ...item.content, _interactions: [...interactions, newInteraction] } });
    };

    const handleRemove = (id: string) => {
        onUpdate(item.i, { content: { ...item.content, _interactions: interactions.filter((i: any) => i.id !== id) } });
    };

    const handleUpdateInteraction = (id: string, key: string, value: any) => {
        onUpdate(item.i, { content: { ...item.content, _interactions: interactions.map((i: any) => i.id === id ? { ...i, [key]: value } : i) } });
    };

    return <InteractionList events={events} interactions={interactions} onAdd={handleAdd} onRemove={handleRemove} onUpdate={handleUpdateInteraction} />;
};

const PageInteractionTab = ({ page, onUpdate }: { page: Page, onUpdate: (updates: Partial<Page>) => void }) => {
    const events = [{ name: 'onMount', label: '页面加载完成时' }];
    const content = page.content || {};
    const interactions = content.lifecycle?.onMount || [];

    const handleAdd = () => {
        const newInteraction = { id: `int_${Date.now()}`, event: 'onMount', action: 'showToast', params: { message: '页面加载成功' } };
        onUpdate({ 
            content: { 
                ...content, 
                lifecycle: { ...content.lifecycle, onMount: [...interactions, newInteraction] } 
            } 
        });
    };

    const handleRemove = (id: string) => {
        onUpdate({ 
            content: { 
                ...content, 
                lifecycle: { ...content.lifecycle, onMount: interactions.filter((i: any) => i.id !== id) } 
            } 
        });
    };

    const handleUpdateInteraction = (id: string, key: string, value: any) => {
        const updated = interactions.map((i: any) => i.id === id ? { ...i, [key]: value } : i);
        onUpdate({ 
            content: { 
                ...content, 
                lifecycle: { ...content.lifecycle, onMount: updated } 
            } 
        });
    };

    return <InteractionList events={events} interactions={interactions} onAdd={handleAdd} onRemove={handleRemove} onUpdate={handleUpdateInteraction} />;
};

// --- Main Panel ---

const GEOMETRY_KEYS = new Set(['x', 'y', 'w', 'h', 'minW', 'minH']);

interface PropertyPanelProps {
  width: number;
  selectedItem?: GridItemData | null;
  onUpdateWidget?: WidgetUpdater;
  onUpdateGeometry?: GeometryUpdater;
  pageSettings?: Page;
  onPageUpdate?: (updates: Partial<Page>) => void;
}

const PropertyPanel: React.FC<PropertyPanelProps> = ({ 
  width, 
  selectedItem, 
  onUpdateWidget,
  onUpdateGeometry,
  pageSettings,
  onPageUpdate
}) => {
  const [activeTab, setActiveTab] = useState<PanelTab>('PROPERTIES');

  const widgetDef = selectedItem ? registry.get(selectedItem.type) : null;
  
  const availableTabs = useMemo(() => {
      const tabs: { id: PanelTab; label: string; icon: any }[] = [
          { id: 'PROPERTIES', label: '属性', icon: SlidersHorizontal },
          { id: 'STYLES', label: '样式', icon: Palette }
      ];

      if (!selectedItem) {
          tabs.push({ id: 'DATA', label: '数据', icon: Database });
          tabs.push({ id: 'BEHAVIOR', label: '交互', icon: Zap });
      } else {
          // Always show Data tab, will be empty if no props, but consistent
          tabs.push({ id: 'DATA', label: '数据', icon: Database });
          
          if (widgetDef?.manifest.events && widgetDef.manifest.events.length > 0) {
              tabs.push({ id: 'BEHAVIOR', label: '交互', icon: Zap });
          }
      }

      return tabs;
  }, [widgetDef, selectedItem]);

  useEffect(() => {
      if (!availableTabs.some(t => t.id === activeTab)) {
          setActiveTab('PROPERTIES');
      }
  }, [selectedItem, availableTabs, activeTab]);

  const getTabForGroup = (group: string): PanelTab => {
      const lower = group.toLowerCase();
      if (['style', 'styles', 'label', 'field', 'container', 'typography', 'decoration', '样式', '标签', '输入框', '外观', '布局', '容器'].includes(lower)) return 'STYLES';
      if (['data', 'source', '数据', '数据源'].includes(lower)) return 'DATA';
      if (['interaction', 'behavior', 'events', '交互', '行为', '事件'].includes(lower)) return 'BEHAVIOR';
      // Default to PROPERTIES for 基础, 高级, Basic, Advanced, General, Properties, Validation, etc.
      return 'PROPERTIES';
  };

  const renderPageDesign = () => (
      <>
        {activeTab === 'PROPERTIES' && (
            <Accordion title="基础设置">
                <div className="space-y-4">
                    <div>
                        <ControlHeader label="页面名称" fx={false} />
                        <Input 
                            value={pageSettings?.name || ''} 
                            onChange={(e) => onPageUpdate && onPageUpdate({ name: e.target.value })}
                            className="h-8 text-xs bg-background"
                        />
                    </div>
                    <div className="pt-2 space-y-2.5">
                            <div className="flex items-center justify-between">
                            <Label className="text-[11px] text-muted-foreground">设为首页</Label>
                            <Switch 
                                checked={pageSettings?.isHome}
                                onCheckedChange={(checked) => onPageUpdate && onPageUpdate({ isHome: checked })}
                            />
                            </div>
                            <div className="flex items-center justify-between">
                            <Label className="text-[11px] text-muted-foreground">禁用页面</Label>
                            <Switch 
                                checked={pageSettings?.isDisabled}
                                onCheckedChange={(checked) => onPageUpdate && onPageUpdate({ isDisabled: checked })}
                            />
                            </div>
                    </div>
                </div>
            </Accordion>
        )}
        {activeTab === 'STYLES' && (
            <Accordion title="页面布局">
                <div>
                    <ControlHeader label="页面高度 (px)" fx={false} />
                    <Input 
                        value={pageSettings?.height} 
                        onChange={(e) => onPageUpdate && onPageUpdate({ height: e.target.value })}
                        className="h-8 text-xs bg-background tabular-nums"
                    />
                </div>
            </Accordion>
        )}
      </>
  );

  const renderWidgetDesign = () => {
      const properties = widgetDef ? widgetDef.manifest.properties : [];
      
      // Filter properties belonging to current tab
      const tabProperties = properties.filter(prop => {
          const groupName = prop.group || '通用';
          return getTabForGroup(groupName) === activeTab;
      });

      const groupedProps = tabProperties.reduce((acc, prop) => {
          const groupName = prop.group || '通用';
          if (!acc[groupName]) acc[groupName] = [];
          acc[groupName].push(prop);
          return acc;
      }, {} as Record<string, PropDefinition[]>);

      if (Object.keys(groupedProps).length === 0) {
          // If no specific props for this tab, show message unless it's Data/Behavior which have special components
          if (activeTab === 'DATA' && widgetDef?.manifest.data) return null; // Let WidgetDataTab handle it
          if (activeTab === 'BEHAVIOR') return null; // Let WidgetInteractionTab handle it
          return <div className="p-6 text-xs text-muted-foreground text-center">该分组暂无可配置属性</div>;
      }

      return Object.entries(groupedProps).map(([groupName, props]) => (
          <Accordion key={groupName} title={groupName}>
              <div className="space-y-4">
                  {props.map(prop => {
                      const Control = SETTER_COMPONENTS[prop.setter?.component || 'text'] || TextControl;
                      const isSwitch = prop.setter?.component === 'switch';
                      
                      let value;
                      if (prop.target === 'root') {
                          value = selectedItem ? (selectedItem as any)[prop.name] : prop.defaultValue;
                      } else {
                          value = selectedItem?.content?.[prop.name] ?? prop.defaultValue;
                      }

                      return (
                          <div key={prop.name}>
                              {!isSwitch && <ControlHeader label={prop.label} fx={false} />}
                              <Control 
                                  value={value}
                                  onChange={(val) => {
                                      if (!selectedItem) return;
                                      if (prop.target === 'root') {
                                          if (GEOMETRY_KEYS.has(prop.name)) {
                                              onUpdateGeometry?.(selectedItem.i, { [prop.name]: val });
                                          } else {
                                              onUpdateWidget?.(selectedItem.i, { [prop.name]: val });
                                          }
                                      } else {
                                          onUpdateWidget?.(selectedItem.i, {
                                              content: { ...selectedItem.content, [prop.name]: val }
                                          });
                                      }
                                  }}
                                  propDef={prop}
                              />
                          </div>
                      );
                  })}
              </div>
          </Accordion>
      ));
  };

  const panelTitle = selectedItem
    ? (selectedItem.title || widgetDef?.manifest.name || selectedItem.type)
    : (pageSettings?.name || '页面');

  return (
    <div 
      style={{ width }}
      className="bg-background flex flex-col h-full shrink-0 overflow-hidden transition-colors"
    >
      {/* Header */}
      <div className="p-3.5 border-b border-border bg-background shrink-0">
         <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 min-w-0">
                <div className="flex items-center bg-[hsl(var(--surface-subtle))] rounded-md border border-border px-2.5 py-1.5">
                    <span className="text-[13px] font-semibold truncate text-foreground">{panelTitle}</span>
                </div>
            </div>
            {selectedItem && (
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="更多操作">
                    <MoreVertical size={15} className="text-muted-foreground" />
                </Button>
            )}
         </div>

         {/* Tabs */}
         <div className="flex items-center bg-[hsl(var(--surface-subtle))] border border-border rounded-lg p-0.5 w-full gap-0.5">
            {availableTabs.map(tab => (
                <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as PanelTab)}
                    title={tab.label}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[11px] font-medium transition-all whitespace-nowrap ${
                        activeTab === tab.id 
                        ? 'bg-background text-foreground shadow-[var(--shadow-control)] border border-border/60' 
                        : 'border border-transparent text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--surface-hover))]'
                    }`}
                >
                    <tab.icon size={13} strokeWidth={1.75} />
                    <span>{tab.label}</span>
                </button>
            ))}
         </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent">
        {activeTab === 'PROPERTIES' && (
            <div className="pb-8">
                {selectedItem ? renderWidgetDesign() : renderPageDesign()}
            </div>
        )}
        
        {activeTab === 'STYLES' && (
            <div className="pb-8">
                {selectedItem ? renderWidgetDesign() : renderPageDesign()}
            </div>
        )}

        {activeTab === 'DATA' && (
            <>
                {/* Render any property in "Data" group first (e.g. static options) */}
                {selectedItem && renderWidgetDesign()}
                
                {selectedItem 
                    ? <WidgetDataTab item={selectedItem} onUpdate={onUpdateWidget!} />
                    : pageSettings && <PageDataTab page={pageSettings} onUpdate={onPageUpdate!} />
                }
            </>
        )}
        {activeTab === 'BEHAVIOR' && (
            selectedItem
                ? <WidgetInteractionTab item={selectedItem} onUpdate={onUpdateWidget!} />
                : pageSettings && <PageInteractionTab page={pageSettings} onUpdate={onPageUpdate!} />
        )}
      </div>
    </div>
  );
};

export default PropertyPanel;
