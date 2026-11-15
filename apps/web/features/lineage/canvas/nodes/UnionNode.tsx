import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { UnionFlowNode } from '../types';
import { Heart } from 'lucide-react';

export const UnionNode: React.FC<NodeProps<UnionFlowNode>> = memo(({ data }) => {
  const { spouseName } = data;

  return (
    <div className="group relative flex items-center justify-center">
      <Handle
        type="target"
        position={Position.Top}
        id="union-father-in"
        className="!w-2 !h-2 !bg-primary/80 !border !border-background -top-1"
      />

      <div
        className="w-4 h-4 rounded-full bg-pink-500/20 border border-pink-500/50 flex items-center justify-center transition-transform group-hover:scale-125 shadow-xs"
        title={spouseName ? `配偶联姻点: ${spouseName}` : '联姻节点'}
      >
        <Heart
          size={8}
          className="text-pink-600 dark:text-pink-400 fill-pink-500/40"
        />
      </div>

      {spouseName && (
        <div className="absolute top-5 bg-popover text-popover-foreground text-[10px] px-1.5 py-0.5 rounded shadow-sm border border-border whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30 font-medium">
          合婚: {spouseName}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        id="union-children-out"
        className="!w-2.5 !h-2.5 !bg-primary !border-2 !border-background -bottom-1"
      />
    </div>
  );
});

UnionNode.displayName = 'UnionNode';
