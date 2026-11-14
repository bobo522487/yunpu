
import React from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { WidgetDefinition, WidgetProps } from '../types';

const ImageComponent: React.FC<WidgetProps> = ({ src, alt, objectFit, borderRadius }) => {
  return (
    <div className="w-full h-full overflow-hidden bg-muted/20 flex items-center justify-center" style={{ borderRadius: `${borderRadius || 0}px` }}>
      {src ? (
        <img 
            src={src} 
            alt={alt || '图片'}
            className="w-full h-full pointer-events-none block"
            style={{ objectFit: objectFit || 'cover' }}
        />
      ) : (
        <div className="flex flex-col items-center text-muted-foreground p-4 text-center">
            <ImageIcon size={24} className="mb-2 opacity-50" />
            <span className="text-[10px]">请设置图片地址</span>
        </div>
      )}
    </div>
  );
};

export const ImageWidget: WidgetDefinition = {
  manifest: {
    type: 'image',
    name: '图片',
    icon: ImageIcon,
    category: '媒体展示',
    defaultSize: { w: 4, h: 4 },
    properties: [
      {
        name: 'src',
        label: '图片地址',
        type: 'string',
        defaultValue: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600',
        group: '基础',
        setter: { component: 'text' }
      },
      {
        name: 'alt',
        label: '替代文本',
        type: 'string',
        defaultValue: '产品图片',
        group: '基础',
        setter: { component: 'text' }
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
        name: 'objectFit',
        label: '填充模式',
        type: 'string',
        defaultValue: 'cover',
        group: '样式',
        setter: {
          component: 'select',
          props: {
            options: [
              { label: '裁剪填充 (Cover)', value: 'cover' },
              { label: '完整适应 (Contain)', value: 'contain' },
              { label: '拉伸填满 (Fill)', value: 'fill' }
            ]
          }
        }
      },
      {
        name: 'borderRadius',
        label: '圆角大小 (px)',
        type: 'number',
        defaultValue: 8,
        group: '样式',
        setter: { component: 'number' }
      }
    ]
  },
  component: ImageComponent
};
