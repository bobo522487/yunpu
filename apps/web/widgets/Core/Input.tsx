
import React, { useState, useEffect } from 'react';
import { TextCursor, AlignLeft, AlignRight, AlignVerticalJustifyStart, X, Info, Mail, Lock } from 'lucide-react';
import { Input } from "../../components/ui/input";
import { WidgetDefinition, WidgetProps, PropDefinition } from '../types';
import { cn } from '../../lib/utils';

const InputComponent: React.FC<WidgetProps> = ({ 
    label, 
    placeholder, 
    defaultValue,
    showLabel = true, 
    labelPosition = 'top',
    labelTextColor,
    fieldTextColor,
    fieldBackgroundColor,
    fieldBorderColor,
    required,
    tooltip,
    disabled,
    readOnly,
    inputType,
    maxLength,
    allowClear
}) => {
  // Use local state to allow interaction within the builder/preview
  const [internalValue, setInternalValue] = useState(defaultValue || '');

  // Sync with property updates
  useEffect(() => {
      setInternalValue(defaultValue || '');
  }, [defaultValue]);

  const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      setInternalValue('');
  };

  const renderLabel = () => (
      <div className="flex items-center gap-1 mb-1.5" style={{ color: labelTextColor }}>
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 whitespace-nowrap">
            {label}
        </label>
        {required && <span className="text-destructive text-xs">*</span>}
        {tooltip && (
            <div title={tooltip} className="cursor-help">
                <Info size={12} className="text-muted-foreground" />
            </div>
        )}
      </div>
  );

  return (
    <div className={cn(
        "p-4 w-full h-full flex pointer-events-auto", 
        labelPosition === 'top' ? 'flex-col' : 'flex-row items-center gap-4'
    )}>
        {showLabel && label && (
            <div className={cn(
                labelPosition === 'top' ? 'w-full' : 'w-1/3 flex-shrink-0',
                labelPosition === 'right' ? 'order-last' : ''
            )}>
               {renderLabel()}
            </div>
        )}
        
        <div className="flex-1 w-full relative group">
            <Input 
                type={inputType || 'text'}
                placeholder={placeholder} 
                value={internalValue}
                onChange={(e) => setInternalValue(e.target.value)}
                disabled={disabled}
                readOnly={readOnly}
                maxLength={maxLength}
                className="w-full pr-8"
                style={{
                    color: fieldTextColor,
                    backgroundColor: fieldBackgroundColor,
                    borderColor: fieldBorderColor
                }}
            />
            {allowClear && internalValue && !disabled && !readOnly && (
                <div 
                    onClick={handleClear}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer z-10 p-1 hover:bg-muted/50 rounded-full transition-all"
                >
                    <X size={12} />
                </div>
            )}
        </div>
    </div>
  );
};

// Reusable properties for input variants
const getInputProperties = (defaultLabel: string, defaultPlaceholder: string, defaultType: string): PropDefinition[] => [
      // --- Group: 基础 ---
      { 
          name: 'name', 
          label: '字段标识', 
          type: 'string', 
          defaultValue: 'input1', 
          group: '基础',
          description: '表单字段唯一标识',
          setter: { component: 'text' }
      },
      { 
          name: 'label', 
          label: '字段名称', 
          type: 'string', 
          defaultValue: defaultLabel, 
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
          target: 'root', // Updates the GridItemData directly
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
      {
          name: 'inputType',
          label: '输入类型',
          type: 'string',
          defaultValue: defaultType,
          group: '基础',
          setter: {
              component: 'select',
              props: {
                  options: [
                      { label: '文本', value: 'text' },
                      { label: '邮箱', value: 'email' },
                      { label: '密码', value: 'password' },
                      { label: '数字', value: 'number' },
                      { label: '时间', value: 'time' },
                      { label: '日期', value: 'date' },
                      { label: '月份', value: 'month' },
                      { label: '日期时间', value: 'datetime-local' },
                  ]
              }
          }
      },
      { 
          name: 'placeholder', 
          label: '占位提示', 
          type: 'string', 
          defaultValue: defaultPlaceholder, 
          group: '基础',
          setter: { component: 'text' }
      },
      {
        name: 'required',
        label: '必填项',
        type: 'boolean',
        defaultValue: false,
        group: '基础',
        setter: { component: 'switch' }
      },

      // --- Group: 高级 ---
      {
          name: 'disabled',
          label: '禁用状态',
          type: 'boolean',
          defaultValue: false,
          group: '高级',
          setter: { component: 'switch' }
      },
      {
          name: 'readOnly',
          label: '只读模式',
          type: 'boolean',
          defaultValue: false,
          group: '高级',
          setter: { component: 'switch' }
      },
      {
          name: 'maxLength',
          label: '最大长度',
          type: 'number',
          group: '高级',
          setter: { component: 'number' }
      },
      {
          name: 'allowClear',
          label: '允许清空',
          type: 'boolean',
          defaultValue: false,
          group: '高级',
          setter: { component: 'switch' }
      },

      // --- Group: 标签 (Styles) ---
      {
          name: 'showLabel',
          label: '显示标签',
          type: 'boolean',
          defaultValue: true,
          group: '标签',
          setter: { component: 'switch' }
      },
      {
          name: 'labelPosition',
          label: '标签位置',
          type: 'string',
          defaultValue: 'top',
          group: '标签',
          setter: {
              component: 'buttonGroup',
              props: {
                  options: [
                      { label: '顶部', value: 'top', icon: AlignVerticalJustifyStart },
                      { label: '左侧', value: 'left', icon: AlignLeft },
                      { label: '右侧', value: 'right', icon: AlignRight },
                  ]
              }
          }
      },
      {
          name: 'labelTextColor',
          label: '文字颜色',
          type: 'string',
          defaultValue: '',
          group: '标签',
          setter: { component: 'color' }
      },

      // --- Group: 输入框 (Styles) ---
      {
          name: 'fieldTextColor',
          label: '文字颜色',
          type: 'string',
          defaultValue: '',
          group: '输入框',
          setter: { component: 'color' }
      },
      {
          name: 'fieldBackgroundColor',
          label: '背景色',
          type: 'string',
          defaultValue: '',
          group: '输入框',
          setter: { component: 'color' }
      },
      {
          name: 'fieldBorderColor',
          label: '边框颜色',
          type: 'string',
          defaultValue: '',
          group: '输入框',
          setter: { component: 'color' }
      },
];

const commonEvents = [
    { name: 'change', label: '值变化时' },
    { name: 'focus', label: '获得焦点时' },
    { name: 'blur', label: '失去焦点时' }
];

export const InputWidget: WidgetDefinition = {
  manifest: {
    type: 'input',
    name: '单行输入',
    icon: TextCursor,
    category: '文本输入',
    defaultSize: { w: 6, h: 2 },
    traits: { isFormItem: true },
    properties: getInputProperties('字段标签', '请输入内容...', 'text'),
    events: commonEvents
  },
  component: InputComponent
};

export const EmailWidget: WidgetDefinition = {
  manifest: {
    type: 'email_input',
    name: '邮箱输入',
    icon: Mail,
    category: '文本输入',
    defaultSize: { w: 6, h: 2 },
    traits: { isFormItem: true },
    properties: getInputProperties('电子邮箱', 'example@domain.com', 'email'),
    events: commonEvents
  },
  component: InputComponent
};

export const PasswordWidget: WidgetDefinition = {
  manifest: {
    type: 'password_input',
    name: '密码输入',
    icon: Lock,
    category: '文本输入',
    defaultSize: { w: 6, h: 2 },
    traits: { isFormItem: true },
    properties: getInputProperties('登录密码', '请输入密码', 'password'),
    events: commonEvents
  },
  component: InputComponent
};
