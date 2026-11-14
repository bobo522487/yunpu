
import React from 'react';
import { Tag } from 'lucide-react';
import { Badge } from "../../components/ui/badge";
import { WidgetDefinition, WidgetProps } from '../types';

const BadgeComponent: React.FC<WidgetProps> = ({ label, variant }) => {
  return (
    <div className="w-full h-full flex items-center justify-center p-2 pointer-events-none">
      <Badge variant={variant || 'default'}>
        {label || '状态'}
      </Badge>
    </div>
  );
};

export const BadgeWidget: WidgetDefinition = {
  manifest: {
    type: 'badge',
    name: '徽章标签',
    icon: Tag,
    category: '数据展示',
    defaultSize: { w: 2, h: 1 },
    properties: [
      {
        name: 'label',
        label: '标签文本',
        type: 'string',
        defaultValue: '现货充足',
        group: '基础',
        setter: { component: 'text' }
      },
      {
          name: 'w',
          label: '宽度占比',
          type: 'number',
          target: 'root',
          defaultValue: 2,
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
        name: 'variant',
        label: '样式风格',
        type: 'string',
        defaultValue: 'default',
        group: '样式',
        setter: {
          component: 'select',
          props: {
            options: [
              { label: '默认', value: 'default' },
              { label: '次要', value: 'secondary' },
              { label: '告警', value: 'destructive' },
              { label: '描边', value: 'outline' }
            ]
          }
        }
      }
    ]
  },
  component: BadgeComponent
};
