import { type PersonRecord } from '../../types';
import { formatGivenName } from '../../utils/nameUtils';
import { getLineageGraph } from '../../domain/lineageGraph';
import { getSpouseSortScore } from '../../utils/personHelpers';
import {
  type ClanHeaderFlowNode,
  type GenealogyFlowEdge,
  type GenealogyFlowNode,
  type PersonFlowNode,
  type UnionFlowNode,
} from '../types';

export interface LayoutOptions {
  onSelectPerson?: (id: string) => void;
  onAddChild?: (fatherId: string, gender?: 'male' | 'female') => void;
  onAddSibling?: (refPersonId: string, gender?: 'male' | 'female') => void;
  onAddSpouse?: (personId: string) => void;
  onAddParent?: (personId: string) => void;
  onDeletePerson?: (id: string) => void;
  onToggleCollapse?: (personId: string) => void;
  onToggleAddMenu?: (personId: string | null) => void;
  collapsedNodeIds?: Set<string>;
  selectedPersonId?: string | null;
  openMenuPersonId?: string | null;
  clanSurname?: string;
}

export const FS_CARD_W = 123;
export const FS_CARD_H = 220;
export const FS_SPOUSE_GAP = 16;
export const FS_SPOUSE_STEP_X = FS_CARD_W + FS_SPOUSE_GAP; // 139px
export const FS_SIBLING_STEP_X = FS_CARD_W + 28; // 151px
export const FS_BRANCH_GAP = 48;
export const FS_GEN_STEP_Y = 320;
export const FS_JUNCTION_OFFSET_Y = FS_CARD_H + 64; // 284px from card top (32px couple drop + 32px stem)

export function buildGenealogyGraph(
  persons: PersonRecord[],
  options: LayoutOptions = {}
): { nodes: GenealogyFlowNode[]; edges: GenealogyFlowEdge[] } {
  if (!persons || persons.length === 0) {
    return { nodes: [], edges: [] };
  }

  const {
    collapsedNodeIds = new Set<string>(),
    onToggleCollapse,
    onToggleAddMenu,
    onSelectPerson,
    onAddChild,
    onAddSibling,
    onAddSpouse,
    onAddParent,
    onDeletePerson,
    selectedPersonId,
    openMenuPersonId = null,
    clanSurname = '',
  } = options;

  const graphIndex = getLineageGraph(persons);
  const rawChildrenMap = graphIndex.childrenByFatherId;
  const allSpousesByPartner = graphIndex.spousesByPartnerId;

  function countDescendants(personId: string): number {
    const children = rawChildrenMap.get(personId) || [];
    let count = children.length;
    children.forEach((c) => {
      count += countDescendants(c.id);
    });
    return count;
  }

  const hiddenPersonIds = new Set<string>();
  function markDescendantsHidden(personId: string) {
    const children = rawChildrenMap.get(personId) || [];
    children.forEach((c) => {
      hiddenPersonIds.add(c.id);
      const childSpouses = allSpousesByPartner.get(c.id) || [];
      childSpouses.forEach((sp) => {
        hiddenPersonIds.add(sp.id);
        markDescendantsHidden(sp.id);
      });
      markDescendantsHidden(c.id);
    });
  }
  collapsedNodeIds.forEach((collapsedId) => {
    markDescendantsHidden(collapsedId);
  });

  const visiblePersons = persons.filter((p) => !hiddenPersonIds.has(p.id));
  const allVisibleIds = new Set(visiblePersons.map((p) => p.id));

  const spousesByPartnerId = new Map<string, PersonRecord[]>();
  allSpousesByPartner.forEach((list, partnerId) => {
    if (!allVisibleIds.has(partnerId)) return;
    const visibleSpouses = list.filter((sp) => allVisibleIds.has(sp.id));
    if (visibleSpouses.length > 0) {
      visibleSpouses.sort((a, b) => {
        const diff = getSpouseSortScore(a) - getSpouseSortScore(b);
        if (diff !== 0) return diff;
        const orderA = a.siblingOrder ?? a.biographyOrder ?? 50;
        const orderB = b.siblingOrder ?? b.biographyOrder ?? 50;
        return orderA - orderB;
      });
      spousesByPartnerId.set(partnerId, visibleSpouses);
    }
  });

  const rootPersons = visiblePersons.filter((p) => {
    if (p.spouseOfId && allVisibleIds.has(p.spouseOfId)) return false;
    const hasVisibleFather = Boolean(p.fatherId && allVisibleIds.has(p.fatherId));
    const hasVisibleMother = Boolean(
      !p.fatherId && p.motherId && allVisibleIds.has(p.motherId)
    );
    return !hasVisibleFather && !hasVisibleMother;
  });
  const roots =
    rootPersons.length > 0
      ? rootPersons
      : visiblePersons.filter(
          (p) =>
            p.generation === 1 &&
            !(p.spouseOfId && allVisibleIds.has(p.spouseOfId))
        );

  const getVisibleChildren = (person: PersonRecord): PersonRecord[] => {
    if (collapsedNodeIds.has(person.id)) return [];
    return (rawChildrenMap.get(person.id) || []).filter(
      (c) =>
        !hiddenPersonIds.has(c.id) &&
        !(c.spouseOfId && allVisibleIds.has(c.spouseOfId))
    );
  };

  const positions = new Map<string, { x: number; y: number }>();
  const subtreePlacedIds = new Map<string, string[]>();
  let currentLeafX = 0;

  function shiftSubtree(nodeId: string, deltaX: number) {
    if (Math.abs(deltaX) < 0.1) return;
    const pos = positions.get(nodeId);
    if (pos) {
      positions.set(nodeId, { x: pos.x + deltaX, y: pos.y });
    }
    const attached = spousesByPartnerId.get(nodeId) || [];
    attached.forEach((sp) => {
      const spPos = positions.get(sp.id);
      if (spPos) positions.set(sp.id, { x: spPos.x + deltaX, y: spPos.y });
    });
    const descendants = subtreePlacedIds.get(nodeId) || [];
    descendants.forEach((dId) => shiftSubtree(dId, deltaX));
  }

  /**
   * Layouts a person/couple block and its subtree, returning the horizontal center X
   * of this person/couple block for parent centering.
   */
  function layoutPersonBlock(person: PersonRecord): number {
    const y = ((person.generation || 1) - 1) * FS_GEN_STEP_Y;
    const attachedSpouses = spousesByPartnerId.get(person.id) || [];
    const spouseCount = attachedSpouses.length;
    const coupleWidth = FS_CARD_W + spouseCount * FS_SPOUSE_STEP_X;
    const occupiedWidth =
      spouseCount > 0 ? coupleWidth + 28 : FS_SIBLING_STEP_X;
    const visibleChildren = getVisibleChildren(person);

    const placeRowCards = (personX: number) => {
      positions.set(person.id, { x: personX, y });
      attachedSpouses.forEach((spouse, sIdx) => {
        positions.set(spouse.id, {
          x: personX + (sIdx + 1) * FS_SPOUSE_STEP_X,
          y,
        });
      });
    };

    if (visibleChildren.length === 0) {
      const x = currentLeafX;
      placeRowCards(x);
      currentLeafX += occupiedWidth;
      return x + coupleWidth / 2;
    }

    const subtreeStartX = currentLeafX;
    const childCenters: number[] = [];
    const childIds: string[] = [];
    visibleChildren.forEach((child) => {
      childCenters.push(layoutPersonBlock(child));
      childIds.push(child.id);
    });
    subtreePlacedIds.set(person.id, childIds);

    const minChildCenter = Math.min(...childCenters);
    const maxChildCenter = Math.max(...childCenters);
    const childrenMidCenter = (minChildCenter + maxChildCenter) / 2;

    let personX = childrenMidCenter - coupleWidth / 2;
    if (personX < subtreeStartX) {
      const shift = subtreeStartX - personX;
      childIds.forEach((cId) => shiftSubtree(cId, shift));
      currentLeafX += shift;
      personX = subtreeStartX;
    }

    placeRowCards(personX);
    currentLeafX = Math.max(currentLeafX, personX + occupiedWidth);
    return personX + coupleWidth / 2;
  }

  roots.forEach((root, idx) => {
    if (idx > 0) {
      currentLeafX += FS_BRANCH_GAP;
    }
    layoutPersonBlock(root);
  });

  // Fallback for any disconnected non-spouse visible nodes
  visiblePersons.forEach((person) => {
    if (!positions.has(person.id)) {
      const y = ((person.generation || 1) - 1) * FS_GEN_STEP_Y;
      positions.set(person.id, { x: currentLeafX, y });
      currentLeafX += FS_SIBLING_STEP_X;
    }
  });

  const nodes: GenealogyFlowNode[] = [];
  const edges: GenealogyFlowEdge[] = [];

  // Clan surname header above top-level root couple blocks (e.g. "陈 氏")
  roots.forEach((root) => {
    const rootPos = positions.get(root.id);
    if (!rootPos) return;
    const surname = root.surname?.trim() || clanSurname.trim();
    if (!surname) return;
    const attachedSpouses = spousesByPartnerId.get(root.id) || [];
    const coupleWidth = FS_CARD_W + attachedSpouses.length * FS_SPOUSE_STEP_X;
    const coupleCenterX = rootPos.x + coupleWidth / 2;
    const clanLabel = surname.endsWith('氏') ? surname : `${surname} 氏`;

    const clanHeaderNode: ClanHeaderFlowNode = {
      id: `clan-header-${root.id}`,
      type: 'clanHeader',
      initialWidth: 240,
      initialHeight: 42,
      position: {
        x: coupleCenterX - 120,
        y: rootPos.y - 58,
      },
      draggable: false,
      selectable: false,
      data: {
        label: clanLabel,
      },
    };
    nodes.push(clanHeaderNode);
  });

  const primaryRootId =
    roots.find((r) => (r.generation || 1) === 1)?.id ?? roots[0]?.id ?? null;

  visiblePersons.forEach((person) => {
    const pos = positions.get(person.id) || { x: 0, y: 0 };
    const allChildren = rawChildrenMap.get(person.id) || [];
    const isCollapsed = collapsedNodeIds.has(person.id);
    const descendantsCount = countDescendants(person.id);
    const isFirstAncestor =
      person.id === primaryRootId &&
      (person.generation || 1) === 1 &&
      !person.fatherId &&
      !person.motherId &&
      !person.spouseOfId;

    const canAddParent = true;

    const personNode: PersonFlowNode = {
      id: person.id,
      type: 'person',
      initialWidth: FS_CARD_W,
      initialHeight: FS_CARD_H,
      position: pos,
      zIndex: person.id === openMenuPersonId ? 1000 : undefined,
      data: {
        person,
        generation: person.generation,
        clanSurname,
        isSelected: person.id === selectedPersonId,
        isFirstAncestor,
        canAddParent,
        isAddMenuOpen: person.id === openMenuPersonId,
        hasChildren: allChildren.length > 0,
        isCollapsed,
        childrenCount: descendantsCount,
        onSelect: onSelectPerson,
        onAddChild,
        onAddSibling,
        onAddSpouse,
        onAddParent,
        onToggleAddMenu,
        onDelete: onDeletePerson,
        onToggleCollapse,
      },
    };
    nodes.push(personNode);

    if (person.spouseOfId && allVisibleIds.has(person.spouseOfId)) {
      return;
    }

    const attachedSpouses = spousesByPartnerId.get(person.id) || [];
    const visibleChildren = getVisibleChildren(person);
    const hasAnyChildren = allChildren.length > 0;
    const coupleWidth = FS_CARD_W + attachedSpouses.length * FS_SPOUSE_STEP_X;
    const coupleCenterX = pos.x + coupleWidth / 2;

    if (hasAnyChildren) {
      // Junction node at (coupleCenterX, y + 284) bearing the 32px collapse circle
      const unionId = `union-${person.id}`;
      const formatMemberName = (member: PersonRecord, isSpouse: boolean) => {
        const effSurname = isSpouse
          ? member.surname?.trim() || ''
          : member.surname?.trim() || clanSurname.trim();
        const given = isSpouse
          ? member.name.trim()
          : formatGivenName(member.name, effSurname);
        if (effSurname && given && !given.startsWith(effSurname)) {
          return `${effSurname}${given}`;
        }
        return given || effSurname || member.name;
      };
      const fatherDisplayName = formatMemberName(person, false);
      const spouseNames = attachedSpouses
        .map((s) => formatMemberName(s, true))
        .join('、');

      const unionNode: UnionFlowNode = {
        id: unionId,
        type: 'union',
        initialWidth: 32,
        initialHeight: 32,
        position: {
          x: coupleCenterX - 16,
          y: pos.y + FS_JUNCTION_OFFSET_Y - 16,
        },
        draggable: false,
        selectable: false,
        style: { pointerEvents: 'all' },
        zIndex: 20,
        data: {
          unionId,
          fatherId: person.id,
          fatherName: fatherDisplayName,
          spouseName: spouseNames || undefined,
          generation: person.generation,
          hasChildren: true,
          isCollapsed,
          childrenCount: descendantsCount,
          onToggleCollapse,
        },
      };
      nodes.push(unionNode);

      if (attachedSpouses.length > 0) {
        // Connect primary person and all spouses via 32px bottom drops into the UnionNode
        edges.push({
          id: `e-marriage-union-${person.id}`,
          source: person.id,
          sourceHandle: 'child-out',
          target: unionId,
          targetHandle: 'union-top',
          type: 'genealogy',
          data: { relationship: 'marriage' },
        });
        attachedSpouses.forEach((spouse) => {
          edges.push({
            id: `e-marriage-union-${spouse.id}`,
            source: spouse.id,
            sourceHandle: 'child-out',
            target: unionId,
            targetHandle: 'union-top',
            type: 'genealogy',
            data: { relationship: 'marriage' },
          });
        });
      } else {
        // Single parent vertical stem straight into the collapse junction
        edges.push({
          id: `e-stem-${person.id}`,
          source: person.id,
          sourceHandle: 'child-out',
          target: unionId,
          targetHandle: 'union-top',
          type: 'genealogy',
          data: { relationship: 'bloodline_stem' },
        });
      }

      visibleChildren.forEach((child) => {
        edges.push({
          id: `e-bloodline-${person.id}-${child.id}`,
          source: unionId,
          sourceHandle: 'union-children-out',
          target: child.id,
          targetHandle: 'parent-in',
          type: 'genealogy',
          data: { relationship: 'bloodline' },
        });
      });
    } else if (attachedSpouses.length > 0) {
      // Childless couple: clean 32px bottom-to-bottom U-bracket marriage line
      attachedSpouses.forEach((spouse, sIdx) => {
        const prevNodeId = sIdx === 0 ? person.id : attachedSpouses[sIdx - 1].id;
        edges.push({
          id: `e-marriage-${prevNodeId}-${spouse.id}`,
          source: prevNodeId,
          sourceHandle: 'child-out',
          target: spouse.id,
          targetHandle: 'spouse-bottom-in',
          type: 'genealogy',
          data: { relationship: 'marriage' },
        });
      });
    }
  });

  return { nodes, edges };
}
