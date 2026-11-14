import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverlay,
  DragMoveEvent,
  DragEndEvent,
  DragOverEvent,
  MeasuringStrategy,
  DropAnimation,
  Modifier,
  defaultDropAnimationSideEffects,
  UniqueIdentifier
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import {
  buildTree,
  flattenTree,
  getProjection,
  getChildCount,
  removeItem,
  setProperty,
} from './utilities';
import { FlattenedItem, SensorContext, TreeItem as TreeItemType } from './types';
import { SortableTreeItem } from './components/SortableTreeItem';
import { TreeItem } from './components/TreeItem';

const indentationWidth = 20;

const dropAnimationConfig: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: '0.5',
      },
    },
  }),
};

interface TreeProps {
  items: TreeItemType[];
  onItemsChange: (items: TreeItemType[]) => void;
  renderIcon?: (item: FlattenedItem) => React.ReactNode;
  renderActions?: (item: FlattenedItem) => React.ReactNode;
  activeId?: string | null;
  onSelect?: (item: FlattenedItem) => void;
  onRename?: (id: string, name: string) => void;
  onRemove?: (id: string) => void;
  onAdd?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  collapsible?: boolean;
  removable?: boolean;
  indicator?: boolean;
  canHaveChildren?: (item: FlattenedItem) => boolean;
  validateParent?: (item: FlattenedItem, parentId: UniqueIdentifier | null) => boolean;
  hideCollapseButton?: boolean;
}

export function Tree({
  items: initialItems,
  onItemsChange,
  renderIcon,
  renderActions,
  activeId: selectedId,
  onSelect,
  onRename,
  onRemove,
  onAdd,
  onDuplicate,
  collapsible,
  removable,
  indicator = true,
  canHaveChildren,
  validateParent,
  hideCollapseButton
}: TreeProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [offsetLeft, setOffsetLeft] = useState(0);

  const flattenedItems = useMemo(() => {
    return flattenTree(initialItems);
  }, [initialItems]);

  const activeItem = activeId
    ? flattenedItems.find(({ id }) => id === activeId)
    : null;

  const sensorContext: SensorContext = useRef({
    items: flattenedItems,
    offset: offsetLeft,
  });
  
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 3, // Start dragging after moving 3px
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250, // Hold for 250ms to pick up
        tolerance: 3, // Tolerance of movement during hold
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: (event, { context: { active, droppableContainers, collisionRect } }) => {
          return { x: 0, y: 0 }; 
      }
    })
  );

  useEffect(() => {
    sensorContext.current = {
      items: flattenedItems,
      offset: offsetLeft,
    };
  }, [flattenedItems, offsetLeft]);

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(active.id as string);
    setOverId(active.id as string);
    document.body.style.cursor = 'grabbing';
  };

  const handleDragMove = ({ delta }: DragMoveEvent) => {
    setOffsetLeft(delta.x);
  };

  const handleDragOver = ({ over }: DragOverEvent) => {
    setOverId(over ? (over.id as string) : null);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    resetState();

    if (projected && over) {
      const { depth, parentId } = projected;
      const clonedItems: FlattenedItem[] = JSON.parse(
        JSON.stringify(flattenTree(initialItems))
      );
      const overIndex = clonedItems.findIndex(({ id }) => id === over.id);
      const activeIndex = clonedItems.findIndex(({ id }) => id === active.id);
      const activeTreeItem = clonedItems[activeIndex];

      clonedItems[activeIndex] = { ...activeTreeItem, depth, parentId };

      const sortedItems = arrayMove(clonedItems, activeIndex, overIndex);
      const newItems = buildTree(sortedItems);

      onItemsChange(newItems);
    }
  };

  const handleDragCancel = () => {
    resetState();
  };

  const resetState = () => {
    setOverId(null);
    setActiveId(null);
    setOffsetLeft(0);
    document.body.style.cursor = '';
  };

  const handleCollapse = (id: string) => {
    if (!collapsible) return;
    const newItems = setProperty(initialItems, id, 'collapsed', (value) => !value);
    onItemsChange(newItems);
  };

  const handleRemoveItem = (id: string) => {
    if(onRemove) {
        onRemove(id);
    } else if (removable) {
        const newItems = removeItem(initialItems, id);
        onItemsChange(newItems);
    }
  };

  const handleRenameItem = (id: string, name: string) => {
      if(onRename) {
          onRename(id, name);
      } else {
          const newItems = setProperty(initialItems, id, 'data', (data) => ({...data, name}));
          onItemsChange(newItems);
      }
  };

  const projected =
    activeId && overId && activeId !== overId
      ? getProjection(
          flattenedItems,
          activeId,
          overId,
          offsetLeft,
          indentationWidth,
          canHaveChildren,
          validateParent
        )
      : null;

  const sortedIds = useMemo(
    () => flattenedItems.map(({ id }) => id),
    [flattenedItems]
  );

  const adjustTranslate: Modifier = ({ transform }) => {
    return {
      ...transform,
      y: transform.y - 10,
    };
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      measuring={{
        droppable: {
          strategy: MeasuringStrategy.Always,
        },
      }}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={sortedIds} strategy={verticalListSortingStrategy}>
        <ul className="p-0 m-0">
          {flattenedItems.map((item) => {
            // Only show add button if allowed to have children, or if no constraint is provided
            const showAdd = onAdd && (!canHaveChildren || canHaveChildren(item));

            return (
              <SortableTreeItem
                key={item.id}
                id={item.id as string}
                item={item}
                depth={item.id === activeId && projected ? projected.depth : item.depth}
                indentationWidth={indentationWidth}
                indicator={indicator}
                collapsed={Boolean(item.collapsed && item.children.length)}
                onCollapse={handleCollapse}
                onRemove={removable || onRemove ? handleRemoveItem : undefined}
                onRename={onRename ? handleRenameItem : undefined}
                onAdd={showAdd ? onAdd : undefined}
                onDuplicate={onDuplicate}
                renderIcon={renderIcon}
                renderActions={renderActions}
                onClick={onSelect}
                activeId={selectedId}
                hideCollapseButton={hideCollapseButton}
              />
            );
          })}
        </ul>
      </SortableContext>

      {createPortal(
        <DragOverlay
          dropAnimation={dropAnimationConfig}
          modifiers={indicator ? [adjustTranslate] : undefined}
        >
          {activeId && activeItem ? (
            <TreeItem
              item={activeItem}
              depth={activeItem.depth}
              clone
              childCount={getChildCount(initialItems, activeId)}
              indentationWidth={indentationWidth}
              renderIcon={renderIcon}
              hideCollapseButton={hideCollapseButton}
            />
          ) : null}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  );
}