
import React from 'react';
import { BarChart3 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { WidgetDefinition, WidgetProps } from '../types';

const ChartComponent: React.FC<WidgetProps> = ({ title, barColor, data, _query }) => {
  // If data exists, we try to find a numeric column to plot
  const rows = Array.isArray(data) ? data : [];
  const selectedColumns = _query?.definition?.select || [];
  
  // Find first numeric-like column for values, and string column for labels
  let valueKey = '';
  
  if (rows.length > 0) {
      // Try to find a key in selected columns that is numeric in the first row
      valueKey = selectedColumns.find((key: string) => {
          const val = rows[0][key];
          return typeof val === 'number' || (!isNaN(parseFloat(val)) && isFinite(val));
      }) || '';
      
      // If not found in selected, try any key
      if (!valueKey) {
          valueKey = Object.keys(rows[0]).find(key => {
             const val = rows[0][key];
             return typeof val === 'number';
          }) || '';
      }
  }

  // Generate normalized data for bars (0-100%)
  const chartData = rows.length > 0 && valueKey 
    ? rows.map((r: any) => {
        const val = parseFloat(r[valueKey]);
        return isNaN(val) ? 0 : val;
    }) 
    : [40, 65, 30, 70, 45, 80, 55, 30, 60, 45, 85, 50]; // Mock

  const maxVal = Math.max(...chartData, 1);
  const normalizedData = chartData.map(v => (v / maxVal) * 100);

  return (
    <Card className="h-full w-full flex flex-col shadow-none border-0 bg-transparent pointer-events-none">
        <CardHeader className="p-4">
            <CardTitle className="text-base">{title || '统计图表'}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 flex-1">
             <div className="w-full h-full flex items-end justify-between gap-2 px-2 pb-2">
                {normalizedData.map((h, i) => (
                    <div 
                        key={i} 
                        className="transition-all duration-500 rounded-t-sm w-full opacity-80 hover:opacity-100 relative group"
                        style={{ height: `${h}%`, backgroundColor: barColor || 'hsl(var(--primary))', }}
                    >
                        {/* Simple Tooltip */}
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-[var(--shadow-popover)] border border-border pointer-events-none z-10 tabular-nums">
                            {rows[i] ? rows[i][valueKey] : h.toFixed(0)}
                        </div>
                    </div>
                ))}
             </div>
             {valueKey && (
                 <div className="text-[10px] text-center text-muted-foreground mt-2 font-medium uppercase tracking-wider">
                     {valueKey}
                 </div>
             )}
        </CardContent>
    </Card>
  );
};

export const ChartWidget: WidgetDefinition = {
  manifest: {
    type: 'chart',
    name: '柱状图表',
    icon: BarChart3,
    category: '数据展示',
    defaultSize: { w: 6, h: 5 },
    properties: [
      { 
          name: 'title', 
          label: '图表标题', 
          type: 'string', 
          defaultValue: '营收概览', 
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
          name: 'barColor',
          label: '柱状颜色',
          type: 'string',
          defaultValue: '',
          group: '样式',
          setter: { component: 'color' }
      }
    ],
    data: {
        hasDataSource: true,
        dataType: 'array'
    },
    events: [
        { name: 'pointClick', label: '点击数据柱时' }
    ]
  },
  component: ChartComponent
};
