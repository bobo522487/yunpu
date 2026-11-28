import { type Node, type Edge } from '@xyflow/react';
import { type PersonRecord } from '../types';

export interface PersonNodeData extends Record<string, unknown> {
  person: PersonRecord;
  generation: number;
  clanSurname?: string;
  isSelected?: boolean;
  isFirstAncestor?: boolean;
  canAddParent?: boolean;
  isAddMenuOpen?: boolean;
  hasChildren?: boolean;
  isCollapsed?: boolean;
  childrenCount?: number;
  biographyOrder?: number;
  onSelect?: (personId: string) => void;
  onAddChild?: (personId: string, gender?: 'male' | 'female') => void;
  onAddSibling?: (personId: string, gender?: 'male' | 'female') => void;
  onAddSpouse?: (personId: string) => void;
  onAddParent?: (personId: string) => void;
  onToggleAddMenu?: (personId: string | null) => void;
  onDelete?: (personId: string) => void;
  onToggleCollapse?: (personId: string) => void;
}

export interface UnionNodeData extends Record<string, unknown> {
  unionId: string;
  fatherId: string;
  fatherName?: string;
  spouseName?: string;
  spouseId?: string;
  generation: number;
  hasChildren?: boolean;
  isCollapsed?: boolean;
  childrenCount?: number;
  onToggleCollapse?: (personId: string) => void;
}

export type PersonFlowNode = Node<PersonNodeData, 'person'>;
export type UnionFlowNode = Node<UnionNodeData, 'union'>;

export type GenealogyFlowNode = PersonFlowNode | UnionFlowNode;

export type GenealogyFlowEdge = Edge<{
  relationship?:
    | 'marriage'
    | 'bloodline'
    | 'bloodline_stem'
    | 'adoption'
    | 'ghost_marriage'
    | 'ghost_bloodline';
  color?: string;
}>;
