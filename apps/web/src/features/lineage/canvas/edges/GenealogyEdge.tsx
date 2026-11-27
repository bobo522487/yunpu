import React from 'react';
import { BaseEdge, type EdgeProps } from '@xyflow/react';

type EdgeRelationship =
  | 'marriage'
  | 'bloodline'
  | 'bloodline_stem'
  | 'adoption'
  | 'ghost_marriage'
  | 'ghost_bloodline';

export const GenealogyEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style = {},
  markerEnd,
  selected,
  data,
}) => {
  const relationship =
    (data as { relationship?: EdgeRelationship } | undefined)?.relationship ||
    'bloodline';

  let edgePath: string;

  if (relationship === 'marriage') {
    // Drop 32px below spouse card bottom into horizontal marriage bar, then into UnionNode (or back up to partner bottom when childless)
    const marriageBarY = sourceY + 32;
    edgePath = [
      `M ${sourceX} ${sourceY}`,
      `L ${sourceX} ${marriageBarY}`,
      `L ${targetX} ${marriageBarY}`,
      `L ${targetX} ${targetY}`,
    ].join(' ');
  } else if (relationship === 'bloodline_stem') {
    // Straight vertical stem from single parent card bottom into UnionNode top
    if (Math.abs(targetX - sourceX) < 1) {
      edgePath = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
    } else {
      const midY = sourceY + (targetY - sourceY) / 2;
      edgePath = [
        `M ${sourceX} ${sourceY}`,
        `L ${sourceX} ${midY}`,
        `L ${targetX} ${midY}`,
        `L ${targetX} ${targetY}`,
      ].join(' ');
    }
  } else {
    // Sharp orthogonal (0px corner radius) parent-to-child horizontal distribution bus
    const dx = targetX - sourceX;
    if (Math.abs(dx) < 1) {
      edgePath = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
    } else {
      // UnionNode source handle sits at bus center (targetY - 36); fallback gracefully after ELK
      const dy = targetY - sourceY;
      const busY = dy >= 20 && dy <= 48 ? sourceY : Math.min(sourceY, targetY - 24);
      edgePath = [
        `M ${sourceX} ${sourceY}`,
        `L ${sourceX} ${busY}`,
        `L ${targetX} ${busY}`,
        `L ${targetX} ${targetY}`,
      ].join(' ');
    }
  }

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        strokeWidth: selected ? 2.5 : 2,
        stroke: selected
          ? 'var(--primary)'
          : 'var(--fs-edge-stroke, #9EA1A3)',
        filter: selected
          ? 'drop-shadow(0 0 3px color-mix(in oklab, var(--primary) 32%, transparent))'
          : undefined,
        ...style,
      }}
    />
  );
};
