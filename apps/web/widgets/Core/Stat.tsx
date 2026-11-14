
import React from 'react';
import { TrendingUp } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { WidgetDefinition, WidgetProps } from '../types';

const StatComponent: React.FC<WidgetProps> = ({ title, value, trend, showIcon, data }) => {
  
  // Calculate value from data if available
  let displayValue = value;
  if (data) {
      if (Array.isArray(data)) {
          displayValue = data.length.toString(); // Default to count
      } else if (typeof data === 'object') {
          // If query returned a single object (e.g. aggregation result in future)
          displayValue = Object.values(data)[0] as string;
      }
  }

  return (
    <Card className="h-full w-full flex flex-col justify-between shadow-none border-0 bg-transparent pointer-events-none">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">{title || '指标统计'}</CardTitle>
            {showIcon !== false && <TrendingUp className="h-4 w-4 text-muted-foreground" />}
        </CardHeader>
        <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold tabular-nums">{displayValue || '0'}</div>
            <p className="text-xs text-muted-foreground tabular-nums">
                {trend || (data ? '总记录数' : '较上月 +0%')}
            </p>
        </CardContent>
    </Card>
  );
};

export const StatWidget: WidgetDefinition = {
  manifest: {
    type: 'stat',
    name: '指标卡',
    icon: TrendingUp,
    category: '数据展示',
    defaultSize: { w: 3, h: 3 },
    properties: [
      { 
          name: 'title', 
          label: '指标名称', 
          type: 'string', 
          defaultValue: '总销售额', 
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
          name: 'value', 
          label: '当前数值', 
          type: 'string', 
          defaultValue: '¥0.00', 
          group: '数据',
          setter: { component: 'text' }
      },
      { 
          name: 'trend', 
          label: '趋势说明', 
          type: 'string', 
          defaultValue: '+0%', 
          group: '数据',
          setter: { component: 'text' }
      },
      {
          name: 'showIcon',
          label: '显示图标',
          type: 'boolean',
          defaultValue: true,
          group: '样式',
          setter: { component: 'switch' }
      }
    ],
    data: {
        hasDataSource: true,
        dataType: 'object'
    },
    events: [
        { name: 'click', label: '点击时' }
    ]
  },
  component: StatComponent
};
