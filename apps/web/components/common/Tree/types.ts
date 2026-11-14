import { UniqueIdentifier } from '@dnd-kit/core';
import { MutableRefObject } from 'react';

export interface TreeItem {
  id: UniqueIdentifier;
  children: TreeItem[];
  collapsed?: boolean;
  type?: string;
  data?: any;
}

export interface TreeItemData {
  id: UniqueIdentifier;
  parentId: UniqueIdentifier | null;
  depth: number;
  index: number;
  children: TreeItem[];
  collapsed?: boolean;
  type?: string;
  data?: any;
}

export interface FlattenedItem extends TreeItemData {
  parentId: UniqueIdentifier | null;
  depth: number;
  index: number;
}

export type SensorContext = MutableRefObject<{
  items: FlattenedItem[];
  offset: number;
}>;