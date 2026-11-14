
import React, { useMemo, useState } from 'react';
import { List, X, ChevronDown, Loader2, Info } from 'lucide-react';
import { WidgetDefinition, WidgetProps } from '../types';
import { cn } from '../../lib/utils';

const SelectComponent: React.FC<WidgetProps> = ({ 
  // Data Group
  label, 
  placeholder,
  isDynamic,
  options,
  data,
  labelField,
  valueField,
  sortOptions,

  // Advanced Group
  required,
  allowClear,
  loading,
  disabled,
  tooltip,

  // Widget Props
  width
}) => {
  // Internal state for controlled component (if not fully controlled by parent)
  const [internalValue, setInternalValue] = useState<string>('');

  const finalOptions = useMemo(() => {
      let items: { label: string; value: string }[] = [];

      // 1. Dynamic Data
      if (isDynamic && Array.isArray(data)) {
          items = data.map((item: any) => {
              const lbl = labelField ? item[labelField] : (item.name || item.label || item.title || Object.values(item)[0]);
              const val = valueField ? item[valueField] : (item.id || item.value || item.key || Object.values(item)[0]);
              
              return { 
                  label: String(lbl !== undefined && lbl !== null ? lbl : '选项'), 
                  value: String(val !== undefined && val !== null ? val : 'item') 
              };
          });
      } 
      // 2. Static Data
      else if (options && typeof options === 'string') {
          items = options.split(',').map((o: string) => {
              const parts = o.split(':');
              if (parts.length >= 2) {
                  return { label: parts[0].trim(), value: parts[1].trim() };
              }
              return { label: o.trim(), value: o.trim() };
          });
      } else {
          // Default Fallback
          items = [
              { label: '选项 1', value: '1' }, 
              { label: '选项 2', value: '2' }
          ];
      }

      // 3. Sorting
      if (sortOptions === 'asc') {
          items.sort((a, b) => a.label.localeCompare(b.label));
      } else if (sortOptions === 'desc') {
          items.sort((a, b) => b.label.localeCompare(a.label));
      }

      return items;
  }, [isDynamic, data, options, labelField, valueField, sortOptions]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      setInternalValue(e.target.value);
  };

  const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      setInternalValue('');
  };

  const showClear = allowClear && internalValue && !disabled && !loading;

  return (
    <div className={cn("p-4 w-full h-full flex flex-col gap-2 pointer-events-auto", disabled && "opacity-60 pointer-events-none")}>
        {label && (
            <div className="flex items-center gap-1">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {label}
                </label>
                {required && <span className="text-destructive text-xs">*</span>}
                {tooltip && (
                    <div title={tooltip} className="cursor-help">
                        <Info size={12} className="text-muted-foreground" />
                    </div>
                )}
            </div>
        )}
        <div className="relative group">
            <select 
                value={internalValue}
                onChange={handleChange}
                disabled={disabled || loading}
                className={cn(
                    "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-[var(--shadow-control)] ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 appearance-none text-foreground transition-all hover:border-[hsl(var(--border-strong))]",
                    !internalValue && "text-muted-foreground"
                )}
            >
                <option value="" disabled>{placeholder || '请选择...'}</option>
                {finalOptions.map((opt: any, idx: number) => (
                    <option key={`${opt.value}-${idx}`} value={opt.value} className="text-foreground">{opt.label}</option>
                ))}
            </select>
            
            {/* Icons Area */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none gap-2">
                {loading ? (
                    <Loader2 size={14} className="animate-spin text-muted-foreground" />
                ) : (
                    <>
                        {/* Clear Button (Interactive via pointer-events-auto) */}
                        {showClear && (
                            <div 
                                onClick={handleClear}
                                className="pointer-events-auto cursor-pointer p-0.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X size={12} />
                            </div>
                        )}
                        <ChevronDown size={14} className="text-muted-foreground opacity-50" />
                    </>
                )}
            </div>
        </div>
    </div>
  );
};

export const SelectWidget: WidgetDefinition = {
  manifest: {
    type: 'select',
    name: '下拉选择',
    icon: List,
    category: '表单控件',
    defaultSize: { w: 6, h: 2 },
    traits: { isFormItem: true },
    properties: [
      // --- Group: 基础 ---
      {
        name: 'name',
        label: '字段标识',
        type: 'string',
        defaultValue: 'select1',
        group: '基础',
        setter: { component: 'text' }
      },
      {
        name: 'label',
        label: '字段名称',
        type: 'string',
        defaultValue: '选择项',
        group: '基础',
        setter: { component: 'text' }
      },
      {
        name: 'placeholder',
        label: '占位提示',
        type: 'string',
        defaultValue: '请选择...',
        group: '基础',
        setter: { component: 'text' }
      },
      { 
          name: 'tooltip', 
          label: '提示信息', 
          type: 'string', 
          defaultValue: '', 
          group: '基础',
          setter: { component: 'text' }
      },
      {
          name: 'w',
          label: '宽度占比',
          type: 'number',
          target: 'root',
          defaultValue: 6,
          group: '基础',
          setter: {
              component: 'buttonGroup',
              props: {
                  options: [
                      { label: '1/4', value: 3 },
                      { label: '1/3', value: 4 },
                      { label: '1/2', value: 6 },
                      { label: '2/3', value: 8 },
                      { label: '3/4', value: 9 },
                      { label: '整行', value: 12 },
                  ]
              }
          }
      },

      // --- Group: 数据 ---
      {
        name: 'isDynamic',
        label: '使用动态选项',
        type: 'boolean',
        defaultValue: false,
        group: '数据',
        setter: { component: 'switch' }
      },
      {
        name: 'options',
        label: '静态选项配置',
        type: 'string',
        defaultValue: '选项 1:1, 选项 2:2',
        description: '格式："显示名:值, 显示名2:值2"',
        group: '数据',
        setter: { component: 'textarea' }
      },
      {
        name: 'labelField',
        label: '显示字段键名',
        type: 'string',
        defaultValue: 'name',
        description: '用于选项展示文本的字段名',
        group: '数据',
        setter: { component: 'text' }
      },
      {
        name: 'valueField',
        label: '取值字段键名',
        type: 'string',
        defaultValue: 'id',
        description: '用于选项提交值的字段名',
        group: '数据',
        setter: { component: 'text' }
      },
      {
        name: 'sortOptions',
        label: '选项排序',
        type: 'string',
        defaultValue: 'none',
        group: '数据',
        setter: { 
            component: 'select',
            props: {
                options: [
                    { label: '默认顺序', value: 'none' },
                    { label: '升序 (A-Z)', value: 'asc' },
                    { label: '降序 (Z-A)', value: 'desc' }
                ]
            }
        }
      },

      // --- Group: 高级 ---
      {
        name: 'required',
        label: '必填项',
        type: 'boolean',
        defaultValue: false,
        group: '高级',
        setter: { component: 'switch' }
      },
      {
        name: 'allowClear',
        label: '允许清空',
        type: 'boolean',
        defaultValue: true,
        group: '高级',
        setter: { component: 'switch' }
      },
      {
        name: 'loading',
        label: '加载状态',
        type: 'boolean',
        defaultValue: false,
        group: '高级',
        setter: { component: 'switch' }
      },
      {
        name: 'disabled',
        label: '禁用状态',
        type: 'boolean',
        defaultValue: false,
        group: '高级',
        setter: { component: 'switch' }
      }
    ],
    data: {
        hasDataSource: true,
        dataType: 'array'
    },
    events: [
        { name: 'change', label: '值变化时' },
        { name: 'focus', label: '获得焦点时' },
        { name: 'blur', label: '失去焦点时' }
    ]
  },
  component: SelectComponent
};
