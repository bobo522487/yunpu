import React from 'react';
import { WidgetDefinition } from './types';
import { GridItemData } from '../types';
import { useWidgetQuery } from './utils/queryEngine';

interface BaseWidgetProps {
  definition: WidgetDefinition;
  item: GridItemData;
}

const BaseWidget: React.FC<BaseWidgetProps> = ({ definition, item }) => {
  const Component = definition.component;
  const resolvedData = useWidgetQuery(item.content?._query);

  return (
    <div className="w-full h-full relative">
      <Component
        item={item}
        {...(item.content || {})}
        title={item.title}
        data={resolvedData}
      />
    </div>
  );
};

export default BaseWidget;
