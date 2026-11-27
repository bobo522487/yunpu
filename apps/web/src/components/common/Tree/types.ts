import { type UniqueIdentifier } from '@dnd-kit/core';
import { type MutableRefObject } from 'react';
import type { GenealogyPlace } from '../../../features/place-input/place.types';

export interface TreeItemDataPayload {
  name?: string;
  surname?: string;
  hallName?: string;
  progenitor?: string;
  region?: string | GenealogyPlace | null;
  [key: string]: unknown;
}

export interface TreeItem {
  id: UniqueIdentifier;
  children: TreeItem[];
  collapsed?: boolean;
  type?: string;
  data?: TreeItemDataPayload;
}

export interface TreeItemData {
  id: UniqueIdentifier;
  parentId: UniqueIdentifier | null;
  depth: number;
  index: number;
  children: TreeItem[];
  collapsed?: boolean;
  type?: string;
  data?: TreeItemDataPayload;
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
