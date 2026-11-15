import { PersonRecord } from '../../types';
import { GenealogyFlowNode, GenealogyFlowEdge, PersonFlowNode } from '../types';

export interface BookLayoutOptions {
  onSelectPerson?: (id: string) => void;
  onAddChild?: (fatherId: string) => void;
  onAddSpouse?: (personId: string) => void;
  onDeletePerson?: (id: string) => void;
  onToggleCollapse?: (personId: string) => void;
  collapsedNodeIds?: Set<string>;
  selectedPersonId?: string | null;
  clanSurname?: string;
  colWidth?: number;
  rowHeight?: number;
  startX?: number;
  startY?: number;
}

const RANK_MAP: Record<string, number> = {
  '长子': 1, '长女': 1, '长': 1, '大子': 1, '嗣长子': 1, '长房': 1, '始祖': 1,
  '次子': 2, '次女': 2, '次': 2, '二子': 2, '二女': 2, '二房': 2,
  '三子': 3, '三女': 3, '三': 3, '三房': 3,
  '四子': 4, '四女': 4, '四': 4, '四房': 4,
  '五子': 5, '五女': 5, '五': 5, '五房': 5,
  '六子': 6, '六女': 6, '六': 6, '六房': 6,
  '七子': 7, '七女': 7, '七': 7, '七房': 7,
  '八子': 8, '八女': 8, '八': 8, '八房': 8,
  '九子': 9, '九女': 9, '九': 9, '九房': 9,
  '十子': 10, '十女': 10, '十': 10, '十房': 10,
  '幼子': 99, '幼女': 99, '幼': 99,
};

function getPersonRankScore(person: PersonRecord): number {
  if (person.siblingOrder !== undefined) return person.siblingOrder;
  if (person.biographyOrder !== undefined) return person.biographyOrder;
  if (person.rank && RANK_MAP[person.rank] !== undefined) return RANK_MAP[person.rank];
  return 50;
}

const NODE_WIDTH = 112;
const HEADER_WIDTH = 84;

export function buildBookLtrGenealogyGraph(
  persons: PersonRecord[],
  options: BookLayoutOptions = {}
): {
  nodes: GenealogyFlowNode[];
  edges: GenealogyFlowEdge[];
  generationColumns: { generation: number; x: number; width: number }[];
  totalWidth: number;
  totalHeight: number;
} {
  if (!persons || persons.length === 0) {
    return {
      nodes: [],
      edges: [],
      generationColumns: [],
      totalWidth: 0,
      totalHeight: 0,
    };
  }

  const {
    collapsedNodeIds = new Set<string>(),
    onToggleCollapse,
    onSelectPerson,
    onAddChild,
    onAddSpouse,
    onDeletePerson,
    selectedPersonId,
    clanSurname = '',
    colWidth = 196,
    rowHeight = 64,
    startX = 60,
    startY = 110,
  } = options;

  const childrenMap = new Map<string, PersonRecord[]>();
  persons.forEach((p) => {
    if (p.fatherId) {
      if (!childrenMap.has(p.fatherId)) {
        childrenMap.set(p.fatherId, []);
      }
      childrenMap.get(p.fatherId)!.push(p);
    }
  });

  childrenMap.forEach((childrenList) => {
    childrenList.sort((a, b) => getPersonRankScore(a) - getPersonRankScore(b));
  });

  function countDescendants(personId: string): number {
    const children = childrenMap.get(personId) || [];
    let count = children.length;
    children.forEach((c) => {
      count += countDescendants(c.id);
    });
    return count;
  }

  const hiddenPersonIds = new Set<string>();
  function markDescendantsHidden(personId: string) {
    const children = childrenMap.get(personId) || [];
    children.forEach((c) => {
      hiddenPersonIds.add(c.id);
      markDescendantsHidden(c.id);
    });
  }

  collapsedNodeIds.forEach((collapsedId) => {
    markDescendantsHidden(collapsedId);
  });

  const visiblePersons = persons.filter((p) => !hiddenPersonIds.has(p.id));
  const allVisibleIds = new Set(visiblePersons.map((p) => p.id));
  const rootPersons = visiblePersons.filter(
    (p) => !p.fatherId || !allVisibleIds.has(p.fatherId)
  );
  const roots =
    rootPersons.length > 0
      ? rootPersons
      : visiblePersons.filter((p) => p.generation === 1);
  roots.sort((a, b) => getPersonRankScore(a) - getPersonRankScore(b));

  const positions = new Map<string, { x: number; y: number }>();
  let currentLeafY = startY;

  function layoutSubtree(person: PersonRecord, assignedY: number): void {
    const gen = person.generation || 1;
    const colCenter = startX + (gen - 1) * colWidth + colWidth / 2;
    const x = colCenter - NODE_WIDTH / 2;

    positions.set(person.id, { x, y: assignedY });

    const isCollapsed = collapsedNodeIds.has(person.id);
    const visibleChildren = isCollapsed
      ? []
      : (childrenMap.get(person.id) || []).filter((c) => !hiddenPersonIds.has(c.id));

    if (visibleChildren.length === 0) {
      currentLeafY = Math.max(currentLeafY, assignedY + rowHeight);
      return;
    }

    visibleChildren.forEach((child, index) => {
      if (index === 0) {
        layoutSubtree(child, assignedY);
      } else {
        const childY = currentLeafY;
        layoutSubtree(child, childY);
      }
    });
  }

  roots.forEach((root) => {
    const rootY = currentLeafY;
    layoutSubtree(root, rootY);
    currentLeafY += 24;
  });

  visiblePersons.forEach((person) => {
    if (!positions.has(person.id)) {
      const gen = person.generation || 1;
      const colCenter = startX + (gen - 1) * colWidth + colWidth / 2;
      const x = colCenter - NODE_WIDTH / 2;
      const y = currentLeafY;
      positions.set(person.id, { x, y });
      currentLeafY += rowHeight;
    }
  });

  const nodes: GenealogyFlowNode[] = [];
  const edges: GenealogyFlowEdge[] = [];

  let maxGen = 1;
  visiblePersons.forEach((p) => {
    maxGen = Math.max(maxGen, p.generation || 1);
  });

  // Generation Header Nodes (1世, 2世, 3世...)
  for (let g = 1; g <= maxGen; g++) {
    const colCenter = startX + (g - 1) * colWidth + colWidth / 2;
    const genCount = visiblePersons.filter((p) => (p.generation || 1) === g).length;

    nodes.push({
      id: `gen-header-${g}`,
      type: 'genHeader',
      position: {
        x: colCenter - HEADER_WIDTH / 2,
        y: startY - 56,
      },
      draggable: false,
      selectable: false,
      deletable: false,
      data: {
        generation: g,
        label: `${g}世`,
        count: genCount,
      },
    });
  }

  // Person Nodes
  visiblePersons.forEach((person) => {
    const pos = positions.get(person.id) || { x: 0, y: 0 };
    const allChildren = childrenMap.get(person.id) || [];
    const isCollapsed = collapsedNodeIds.has(person.id);
    const visibleChildren = isCollapsed
      ? []
      : allChildren.filter((c) => !hiddenPersonIds.has(c.id));
    const descendantsCount = countDescendants(person.id);

    const node: PersonFlowNode = {
      id: person.id,
      type: 'bookPerson',
      position: pos,
      data: {
        person,
        generation: person.generation,
        clanSurname,
        isSelected: person.id === selectedPersonId,
        hasChildren: allChildren.length > 0,
        isCollapsed,
        childrenCount: descendantsCount,
        biographyPage: person.biographyPage,
        biographyOrder: person.biographyOrder,
        onSelect: onSelectPerson,
        onAddChild,
        onAddSpouse,
        onDelete: onDeletePerson,
        onToggleCollapse,
      },
    };
    nodes.push(node);

    visibleChildren.forEach((child) => {
      edges.push({
        id: `e-${person.id}-${child.id}`,
        source: person.id,
        sourceHandle: 'child-out-ltr',
        target: child.id,
        targetHandle: 'parent-in-ltr',
        type: 'bookGenealogy',
        data: { relationship: 'bloodline' },
      });
    });
  });

  const generationColumns: { generation: number; x: number; width: number }[] = [];
  for (let g = 1; g <= maxGen; g++) {
    generationColumns.push({
      generation: g,
      x: startX + (g - 1) * colWidth,
      width: colWidth,
    });
  }

  const totalWidth = startX + maxGen * colWidth + 120;
  const totalHeight = currentLeafY + 100;

  return { nodes, edges, generationColumns, totalWidth, totalHeight };
}
