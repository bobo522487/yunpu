import { Node, Edge } from '@xyflow/react';
import { PersonRecord } from '../types';

export interface PersonNodeData extends Record<string, unknown> {
  person: PersonRecord;
  generation: number;
  clanSurname?: string;
  isSelected?: boolean;
  hasChildren?: boolean;
  isCollapsed?: boolean;
  childrenCount?: number;
  biographyPage?: number;
  biographyOrder?: number;
  onSelect?: (personId: string) => void;
  onAddChild?: (personId: string) => void;
  onAddSpouse?: (personId: string) => void;
  onDelete?: (personId: string) => void;
  onToggleCollapse?: (personId: string) => void;
}

export interface UnionNodeData extends Record<string, unknown> {
  unionId: string;
  fatherId: string;
  spouseName?: string;
  spouseId?: string;
  generation: number;
}

export interface GenHeaderNodeData extends Record<string, unknown> {
  generation: number;
  label: string;
  count?: number;
  onFilterGeneration?: (gen: number) => void;
}

export type PersonFlowNode = Node<PersonNodeData, 'person' | 'bookPerson'>;
export type UnionFlowNode = Node<UnionNodeData, 'union'>;
export type GenHeaderFlowNode = Node<GenHeaderNodeData, 'genHeader'>;

export type GenealogyFlowNode = PersonFlowNode | UnionFlowNode | GenHeaderFlowNode;

export type GenealogyFlowEdge = Edge<{
  relationship?: 'marriage' | 'bloodline' | 'adoption';
  color?: string;
}>;
