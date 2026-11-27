import type { UniqueIdentifier } from '@dnd-kit/core';
import type { TreeItem } from '../components/common/Tree/types';
import { createEntityId } from './id';

export function findTreeNode(
  items: TreeItem[],
  targetId: UniqueIdentifier
): TreeItem | undefined {
  for (const item of items) {
    if (item.id === targetId) return item;
    if (item.children?.length) {
      const found = findTreeNode(item.children, targetId);
      if (found) return found;
    }
  }
  return undefined;
}

export function findFirstTreeNodeByType(
  items: TreeItem[],
  type: NonNullable<TreeItem['type']>
): TreeItem | null {
  for (const item of items) {
    if (item.type === type) return item;
    if (item.children?.length) {
      const hit = findFirstTreeNodeByType(item.children, type);
      if (hit) return hit;
    }
  }
  return null;
}

export function countTreeNodesByType(
  items: TreeItem[],
  type: NonNullable<TreeItem['type']>
): number {
  let count = 0;
  for (const item of items) {
    if (item.type === type) count += 1;
    if (item.children?.length) {
      count += countTreeNodesByType(item.children, type);
    }
  }
  return count;
}

export function collectTreeNodesByType(
  items: TreeItem[],
  type: NonNullable<TreeItem['type']>
): TreeItem[] {
  const out: TreeItem[] = [];
  for (const item of items) {
    if (item.type === type) out.push(item);
    if (item.children?.length) {
      out.push(...collectTreeNodesByType(item.children, type));
    }
  }
  return out;
}

export function collectSubtreeIdsByType(
  node: TreeItem,
  type: NonNullable<TreeItem['type']>
): string[] {
  const ids: string[] = [];
  if (node.type === type) ids.push(String(node.id));
  for (const child of node.children || []) {
    ids.push(...collectSubtreeIdsByType(child, type));
  }
  return ids;
}

function indexTreeById(
  items: TreeItem[],
  map: Map<UniqueIdentifier, TreeItem> = new Map()
): Map<UniqueIdentifier, TreeItem> {
  for (const item of items) {
    map.set(item.id, item);
    if (item.children?.length) {
      indexTreeById(item.children, map);
    }
  }
  return map;
}

/**
 * When dnd-kit commits a flattened tree back into nested form, collapsed folders
 * may temporarily present `children: []`. Preserve their prior nested children in O(N).
 */
export function preserveCollapsedChildren(
  prevItems: TreeItem[],
  nextItems: TreeItem[]
): TreeItem[] {
  const prevById = indexTreeById(prevItems);
  const merge = (nodes: TreeItem[]): TreeItem[] =>
    nodes.map((item) => {
      const prevNode = prevById.get(item.id);
      const restoredChildren =
        item.collapsed &&
        item.children.length === 0 &&
        prevNode?.children?.length
          ? prevNode.children
          : merge(item.children || []);
      return {
        ...item,
        children: restoredChildren,
      };
    });
  return merge(nextItems);
}

export function insertTreeNode(
  items: TreeItem[],
  newNode: TreeItem,
  parentId?: UniqueIdentifier
): TreeItem[] {
  if (!parentId) return [...items, newNode];
  return items.map((item) => {
    if (item.id === parentId) {
      return {
        ...item,
        collapsed: false,
        children: [...(item.children || []), newNode],
      };
    }
    if (item.children?.length) {
      return { ...item, children: insertTreeNode(item.children, newNode, parentId) };
    }
    return item;
  });
}

export function updateTreeNodeData(
  items: TreeItem[],
  targetId: UniqueIdentifier,
  updater: (data: NonNullable<TreeItem['data']>) => NonNullable<TreeItem['data']>
): TreeItem[] {
  return items.map((item) => {
    const isMatch = item.id === targetId;
    const nextChildren = item.children?.length
      ? updateTreeNodeData(item.children, targetId, updater)
      : item.children;
    if (!isMatch && nextChildren === item.children) return item;
    return {
      ...item,
      ...(isMatch ? { data: updater(item.data || {}) } : {}),
      children: nextChildren,
    };
  });
}

function cloneSubtreeWithIds(
  node: TreeItem,
  suffix: string,
  onNodeCloned?: (sourceId: string, clonedId: string, node: TreeItem) => void
): TreeItem {
  const newId = `${String(node.id)}-copy-${suffix}-${Math.random().toString(36).slice(2, 6)}`;
  onNodeCloned?.(String(node.id), newId, node);
  return {
    ...node,
    id: newId,
    data: {
      ...node.data,
      name: `${node.data?.name || String(node.id)} (副本)`,
    },
    children: (node.children || []).map((child) =>
      cloneSubtreeWithIds(child, suffix, onNodeCloned)
    ),
  };
}

export function duplicateTreeNode(
  items: TreeItem[],
  targetId: UniqueIdentifier,
  onNodeCloned?: (sourceId: string, clonedId: string, node: TreeItem) => void
): TreeItem[] {
  const suffix = createEntityId('copy').slice(-6);
  const walk = (nodes: TreeItem[]): TreeItem[] => {
    const result: TreeItem[] = [];
    for (const item of nodes) {
      if (item.id === targetId) {
        result.push(item);
        result.push(cloneSubtreeWithIds(item, suffix, onNodeCloned));
      } else if (item.children?.length) {
        result.push({ ...item, children: walk(item.children) });
      } else {
        result.push(item);
      }
    }
    return result;
  };
  return walk(items);
}

export function removeTreeNode(
  items: TreeItem[],
  targetId: UniqueIdentifier
): TreeItem[] {
  const next: TreeItem[] = [];
  for (const item of items) {
    if (item.id === targetId) continue;
    next.push(
      item.children?.length
        ? { ...item, children: removeTreeNode(item.children, targetId) }
        : item
    );
  }
  return next;
}
