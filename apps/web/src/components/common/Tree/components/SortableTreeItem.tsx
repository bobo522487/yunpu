import { type CSSProperties } from 'react';
import { type AnimateLayoutChanges, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TreeItem, type TreeItemProps } from './TreeItem';
import { iOS } from '../utilities';
import { type FlattenedItem } from '../types';

interface SortableTreeItemProps extends Omit<TreeItemProps, 'item'> {
  id: string;
  item: FlattenedItem;
}

const animateLayoutChanges: AnimateLayoutChanges = ({
  isSorting,
  wasDragging,
}) => !(isSorting || wasDragging);

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