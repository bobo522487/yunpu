
import React from 'react';
import { Type } from 'lucide-react';
import { WidgetDefinition, WidgetProps } from '../types';

const TextComponent: React.FC<WidgetProps> = ({ content, fontSize, align, color }) => {
  return (
    <div className={`p-4 w-full h-full flex flex-col justify-center pointer-events-none text-${align || 'left'}`}>
        <p style={{ fontSize: `${fontSize || 14}px`, color: color }} className="text-foreground whitespace-pre-wrap">
            {content || '文本内容'}
        </p>
    </div>
  );
};

export const TextWidget: WidgetDefinition = {
  manifest: {
    type: 'text',
    name: '文本',
    icon: Type,
    category: '常用组件',
    defaultSize: { w: 4, h: 2 },
    properties: [
      { 
          name: 'content', 
          label: '文本内容', 
          type: 'string', 
          defaultValue: '文本内容', 
          group: '基础',
          setter: { component: 'textarea' }
      },
      {
          name: 'w',
          label: '宽度占比',
          type: 'number',
          target: 'root',
          defaultValue: 4,
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
          name: 'fontSize', 
          label: '字号大小', 
          type: 'number', 
          defaultValue: 14, 
          group: '样式',
          setter: { component: 'number' }
      },
      { 
          name: 'align', 
          label: '对齐方式', 
          type: 'string', 
          defaultValue: 'left', 
          group: '样式',
          setter: { 
              component: 'select',
              props: {
                  options: [
                      { label: '左对齐', value: 'left' },
                      { label: '居中', value: 'center' },
                      { label: '右对齐', value: 'right' }
                  ]
              }
          }
      },
      {
          name: 'color',
          label: '文字颜色',
          type: 'string',
          group: '样式',
          setter: { component: 'color' }
      }
    ]
  },
  component: TextComponent
};
