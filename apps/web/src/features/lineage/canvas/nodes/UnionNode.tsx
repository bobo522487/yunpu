import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { type UnionFlowNode } from '../types';

export const UnionNode: React.FC<NodeProps<UnionFlowNode>> = memo(({ data }) => {
  const {
    fatherId,
    fatherName,
    spouseName,
    hasChildren = false,
    isCollapsed = false,
    childrenCount = 0,
    onToggleCollapse,
  } = data;

  const coupleLabel =
    fatherName && spouseName
      ? `${fatherName}和${spouseName}`
      : fatherName || spouseName || '该成员';

  const actionLabel = isCollapsed
    ? `显示${coupleLabel}的子女`
    : `隐藏${coupleLabel}的子女`;

  return (
    <div
      className="relative w-8 h-8 flex items-center justify-center"
      title={spouseName ? `联姻：${spouseName}` : undefined}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="union-top"
        style={{
          top: 0,
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
        className="!w-1 !h-1 !min-w-0 !min-h-0 !opacity-0 pointer-events-none"
      />

      {hasChildren ? (
        <button
          type="button"
          data-testid={`expand-down-arrow-${fatherId}`}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse?.(fatherId);
          }}
          aria-expanded={!isCollapsed}
          aria-label={actionLabel}
          title={`${actionLabel} (${childrenCount}人)`}
          className="nodrag nopan nowheel pointer-events-auto relative z-10 w-8 h-8 rounded-full bg-card hover:bg-[var(--surface-hover)] active:bg-[var(--surface-active)] active:scale-95 text-primary border border-[var(--border-strong)] shadow-[var(--shadow-card)] flex items-center justify-center transition-all duration-150 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:shadow-[var(--shadow-focus-halo)]"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="currentColor"
            role="presentation"
            className={`transition-transform duration-150 ${
              isCollapsed ? 'rotate-90' : '-rotate-90'
            }`}
          >
            <path d="M9.4 17.17 14.68 12 9.4 6.83l1.4-1.43 6.73 6.6-6.73 6.6zM6.47 12" />
          </svg>
        </button>
      ) : (
        <span className="w-2 h-2 rounded-full bg-lineage-edge pointer-events-none" />
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        id="union-children-out"
        style={{
          top: '50%',
          bottom: 'auto',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
        className="!w-1 !h-1 !min-w-0 !min-h-0 !opacity-0 pointer-events-none"
      />
    </div>
  );
});

UnionNode.displayName = 'UnionNode';
