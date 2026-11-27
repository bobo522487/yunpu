import React, { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { type ClanHeaderFlowNode } from '../types';

export const ClanHeaderNode: React.FC<NodeProps<ClanHeaderFlowNode>> = memo(
  ({ data }) => {
    const { label } = data;
    if (!label?.trim()) return null;

    return (
      <div className="w-[240px] h-[42px] flex items-center justify-center pointer-events-none select-none">
        <h2 className="text-[35px] leading-[1.15] font-normal text-[#202121] dark:text-foreground tracking-[0.04em] whitespace-nowrap">
          {label}
        </h2>
      </div>
    );
  }
);

ClanHeaderNode.displayName = 'ClanHeaderNode';
