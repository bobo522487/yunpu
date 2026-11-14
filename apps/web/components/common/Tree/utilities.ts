import { arrayMove } from '@dnd-kit/sortable';
import { FlattenedItem, TreeItem } from './types';
import { UniqueIdentifier } from '@dnd-kit/core';

export const iOS = /iPad|iPhone|iPod/.test(navigator.platform);

function getDragDepth(offset: number, indentationWidth: number) {
  return Math.round(offset / indentationWidth);
}

export function getProjection(
  items: FlattenedItem[],
  activeId: UniqueIdentifier,
  overId: UniqueIdentifier,
  dragOffset: number,
  indentationWidth: number,
  canHaveChildren?: (item: FlattenedItem) => boolean,
  validateParent?: (item: FlattenedItem, parentId: UniqueIdentifier | null) => boolean
) {
  const overItemIndex = items.findIndex(({ id }) => id === overId);
  const activeItemIndex = items.findIndex(({ id }) => id === activeId);
  const activeItem = items[activeItemIndex];
  const newItems = arrayMove(items, activeItemIndex, overItemIndex);
  const previousItem = newItems[overItemIndex - 1];
  const nextItem = newItems[overItemIndex + 1];
  const dragDepth = getDragDepth(dragOffset, indentationWidth);
  const projectedDepth = activeItem.depth + dragDepth;
  const maxDepth = previousItem ? previousItem.depth + 1 : 0;
  const minDepth = nextItem ? nextItem.depth : 0;
  let depth = projectedDepth;

  if (projectedDepth >= maxDepth) {
    depth = maxDepth;
  } else if (projectedDepth < minDepth) {
    depth = minDepth;
  }

  // Constraint: Check if previous item can have children
  if (previousItem && depth > previousItem.depth) {
    if (canHaveChildren && !canHaveChildren(previousItem)) {
        // If the previous item cannot have children, force depth to match previous item (sibling)
        depth = previousItem.depth;
    }
  }

  let parentId = getParentId();

  // Constraint: Validate Parent (Strict Hierarchy)
  if (validateParent) {
      if (!validateParent(activeItem, parentId)) {
          // If the projected parent is invalid, snap back to original hierarchy level
          depth = activeItem.depth;
          parentId = activeItem.parentId;
      }
  }

  return { depth, maxDepth, minDepth, parentId };

  function getParentId() {
    if (depth === 0 || !previousItem) {
      return null;
    }

    if (depth === previousItem.depth) {
      return previousItem.parentId;
    }

    if (depth > previousItem.depth) {
      return previousItem.id;
    }

    const newParent = newItems
      .slice(0, overItemIndex)
      .reverse()
      .find((item) => item.depth === depth)?.parentId;

    return newParent ?? null;
  }
}

export function flatten(
  items: TreeItem[],
  parentId: UniqueIdentifier | null = null,
  depth = 0
): FlattenedItem[] {
  return items.reduce<FlattenedItem[]>((acc, item, index) => {
    return [
      ...acc,
      { ...item, parentId, depth, index },
      ...(item.children && !item.collapsed
        ? flatten(item.children, item.id, depth + 1)
        : []),
    ];
  }, []);
}

export function flattenTree(items: TreeItem[]): FlattenedItem[] {
  return flatten(items);
}

export function buildTree(flattenedItems: FlattenedItem[]): TreeItem[] {
  const root: TreeItem = { id: 'root', children: [] };
  const nodes: Record<string, TreeItem> = { [root.id]: root };
  const items = flattenedItems.map((item) => ({ ...item, children: [] }));

  for (const item of items) {
    const { id, children, collapsed, ...rest } = item;
    const parentId = item.parentId ?? 'root';
    const parent = nodes[parentId] ?? nodes['root'];

    nodes[id] = { id, children, collapsed, ...rest };
    parent.children.push(nodes[id]);
  }

  return root.children;
}

export function findItem(items: TreeItem[], itemId: UniqueIdentifier) {
  return items.find(({ id }) => id === itemId);
}

export function findItemDeep(
  items: TreeItem[],
  itemId: UniqueIdentifier
): TreeItem | undefined {
  for (const item of items) {
    const { id, children } = item;

    if (id === itemId) {
      return item;
    }

    if (children.length) {
      const child = findItemDeep(children, itemId);

      if (child) {
        return child;
      }
    }
  }

  return undefined;
}

export function removeItem(items: TreeItem[], id: UniqueIdentifier) {
  const newItems = [];

  for (const item of items) {
    if (item.id === id) {
      continue;
    }

    if (item.children.length) {
      item.children = removeItem(item.children, id);
    }

    newItems.push(item);
  }

  return newItems;
}

export function setProperty<T extends keyof TreeItem>(
  items: TreeItem[],
  id: UniqueIdentifier,
  property: T,
  setter: (value: TreeItem[T]) => TreeItem[T]
) {
  for (const item of items) {
    if (item.id === id) {
      item[property] = setter(item[property]);
      continue;
    }

    if (item.children.length) {
      item.children = setProperty(item.children, id, property, setter);
    }
  }

  return [...items];
}

export function getChildCount(items: TreeItem[], id: UniqueIdentifier) {
  const item = findItemDeep(items, id);

  return item ? countChildren(item.children) : 0;
}

function countChildren(items: TreeItem[]) {
  return items.reduce((acc, item) => {
    if (item.children.length) {
      return acc + 1 + countChildren(item.children);
    }
    return acc + 1;
  }, 0);
}