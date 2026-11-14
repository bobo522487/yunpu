
import React, { useState, useEffect } from 'react';
import { FileText, AlignLeft, AlignRight, AlignVerticalJustifyStart, Info } from 'lucide-react';
import { Textarea } from "../../components/ui/textarea";
import { WidgetDefinition, WidgetProps } from '../types';
import { cn } from '../../lib/utils';

const TextAreaComponent: React.FC<WidgetProps> = ({ 
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
    maxLength,
    rows
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue || '');

  useEffect(() => {
      setInternalValue(defaultValue || '');
  }, [defaultValue]);

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
        labelPosition === 'top' ? 'flex-col' : 'flex-row items-start gap-4'
    )}>
        {showLabel && label && (
            <div className={cn(
                labelPosition === 'top' ? 'w-full' : 'w-1/3 flex-shrink-0 pt-2',
                labelPosition === 'right' ? 'order-last' : ''
            )}>
               {renderLabel()}
            </div>
        )}
        
        <div className="flex-1 w-full relative group">
            <Textarea 
                placeholder={placeholder} 
                value={internalValue}
                onChange={(e) => setInternalValue(e.target.value)}
                disabled={disabled}
                readOnly={readOnly}
                maxLength={maxLength}
                rows={rows || 3}
                className="w-full resize-none"
                style={{
                    color: fieldTextColor,
                    backgroundColor: fieldBackgroundColor,
                    borderColor: fieldBorderColor
                }}
            />
        </div>
    </div>
  );
};

export const TextAreaWidget: WidgetDefinition = {
  manifest: {
    type: 'textarea',
    name: '多行文本',
    icon: FileText,
    category: '文本输入',
    defaultSize: { w: 6, h: 3 },
    traits: { isFormItem: true },
    properties: [
      // --- Group: 基础 ---
      { 
          name: 'name', 
          label: '字段标识', 
          type: 'string', 
          defaultValue: 'textarea1', 
          group: '基础',
          description: '唯一字段标识',
          setter: { component: 'text' }
      },
      { 
          name: 'label', 
          label: '字段名称', 
          type: 'string', 
          defaultValue: '详细说明', 
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
      {
          name: 'rows',
          label: '默认行数',
          type: 'number',
          defaultValue: 3,
          group: '基础',
          setter: { component: 'number' }
      },
      { 
          name: 'placeholder', 
          label: '占位提示', 
          type: 'string', 
          defaultValue: '请输入详细内容...', 
          group: '基础',
          setter: { component: 'textarea' }
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
    ],
    events: [
        { name: 'change', label: '值变化时' },
        { name: 'focus', label: '获得焦点时' },
        { name: 'blur', label: '失去焦点时' }
    ]
  },
  component: TextAreaComponent
};
