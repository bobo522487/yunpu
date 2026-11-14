import React, { CSSProperties } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TreeItem, TreeItemProps } from './TreeItem';
import { iOS } from '../utilities';
import { FlattenedItem } from '../types';

interface SortableTreeItemProps extends Omit<TreeItemProps, 'item'> {
  id: string;
  item: FlattenedItem;
}

const animateLayoutChanges = ({ isSorting, wasDragging }: any) =>
  isSorting || wasDragging ? false : true;

export const SortableTreeItem = ({
  id,
  depth,
  ...props
}: SortableTreeItemProps) => {
  const {
    attributes,
    isDragging,
    isSorting,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id,
    animateLayoutChanges,
  });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <TreeItem
      ref={setNodeRef}
      style={style}
      depth={depth}
      ghost={isDragging}
      disableSelection={iOS}
      disableInteraction={isSorting}
      handleProps={{
        ...attributes,
        ...listeners,
      }}
      {...props}
    />
  );
};