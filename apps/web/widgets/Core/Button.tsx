
import React from 'react';
import { MousePointerClick } from 'lucide-react';
import { Button as ShadButton } from "../../components/ui/button";
import { WidgetDefinition, WidgetProps } from '../types';

const ButtonComponent: React.FC<WidgetProps> = ({ label, variant, size, disabled }) => {
  return (
    <div className="p-4 w-full h-full flex items-center justify-center pointer-events-none">
        <ShadButton 
            className="w-full h-full" 
            variant={variant || 'default'}
            size={size || 'default'}
            disabled={disabled}
        >
            {label || '按钮'}
        </ShadButton>
    </div>
  );
};

export const ButtonWidget: WidgetDefinition = {
  manifest: {
    type: 'button',
    name: '按钮',
    icon: MousePointerClick,
    category: '常用组件',
    defaultSize: { w: 3, h: 2 },
    traits: {
        isResizable: true,
        isFormItem: false
    },
    properties: [
      { 
          name: 'label', 
          label: '按钮文本', 
          type: 'string', 
          defaultValue: '按钮',
          group: '基础',
          setter: { component: 'text' }
      },
      {
          name: 'w',
          label: '宽度占比',
          type: 'number',
          target: 'root',
          defaultValue: 3,
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
          name: 'disabled',
          label: '禁用状态',
          type: 'boolean',
          defaultValue: false,
          group: '基础',
          setter: { component: 'switch' }
      },
      { 
          name: 'variant', 
          label: '按钮样式', 
          type: 'string', 
          defaultValue: 'default',
          group: '样式',
          setter: { 
              component: 'select', 
              props: { 
                  options: [
                      { label: '主按钮', value: 'default' },
                      { label: '次按钮', value: 'secondary' },
                      { label: '危险按钮', value: 'destructive' },
                      { label: '描边按钮', value: 'outline' },
                      { label: '幽灵按钮', value: 'ghost' },
                      { label: '链接按钮', value: 'link' }
                  ] 
              } 
          }
      },
      {
          name: 'size',
          label: '尺寸大小',
          type: 'string',
          defaultValue: 'default',
          group: '样式',
          setter: {
              component: 'select',
              props: {
                  options: [
                      { label: '默认', value: 'default' },
                      { label: '紧凑', value: 'sm' },
                      { label: '宽松', value: 'lg' },
                      { label: '图标', value: 'icon' }
                  ]
              }
          }
      }
    ],
    events: [
      { name: 'click', label: '点击时' },
      { name: 'hover', label: '悬停时' }
    ]
  },
  component: ButtonComponent
};
