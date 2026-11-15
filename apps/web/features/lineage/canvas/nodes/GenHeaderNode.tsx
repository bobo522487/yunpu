import React, { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import { GenHeaderFlowNode } from '../types';

export const GenHeaderNode: React.FC<NodeProps<GenHeaderFlowNode>> = memo(
  ({ data }) => {
    const { generation, label, count } = data;

    return (
      <div
        className="w-[84px] select-none flex flex-col items-center justify-center cursor-default group"
        title={`第 ${generation} 世 (共 ${count ?? 0} 人)`}
      >
        <div className="w-full flex items-center justify-center px-3 py-1 rounded-md bg-card text-foreground font-serif text-xs font-bold tracking-wider shadow-xs border border-border transition-transform group-hover:scale-105 group-hover:border-primary/50 tabular-nums">
          {label || `${generation}世`}
        </div>
        <div className="w-[1.5px] h-3 mt-1 bg-primary/60 transition-colors" />
      </div>
    );
  }
);

GenHeaderNode.displayName = 'GenHeaderNode';
