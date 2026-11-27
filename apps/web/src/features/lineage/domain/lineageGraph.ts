import type { PersonRecord, RelationKind } from '../types';
import {
  getSpouseSortScore,
  sortChildrenChronologically,
} from '../utils/personSort';

export interface FamilyChildEdge {
  childId: string;
  relationType?: RelationKind;
  order?: number;
}

/**
 * Orthogonal family union connecting 1 or 2 partners with their children.
 * Eliminates the need for fabricating placeholder "unknown father" records
 * when a single mother or maternal branch is recorded.
 */
export interface FamilyUnion {
  id: string;
  partnerIds: string[];
  childEdges: FamilyChildEdge[];
}

export interface LineageGraph {
  personById: Map<string, PersonRecord>;
  unionsById: Map<string, FamilyUnion>;
  unionsByPartnerId: Map<string, FamilyUnion[]>;
  parentUnionByChildId: Map<string, FamilyUnion>;
  /** O(1) primary parent -> ordered children (supports both paternal and single-mother lines without double-counting) */
  childrenByFatherId: Map<string, PersonRecord[]>;
  /** O(1) any parent (fatherId or motherId) -> ordered children for kinship queries */
  childrenByAnyParentId: Map<string, PersonRecord[]>;
  /** O(1) partner -> ordered spouse nodes */
  spousesByPartnerId: Map<string, PersonRecord[]>;
}

const lineageGraphCache = new WeakMap<
  PersonRecord[],
  { length: number; graph: LineageGraph }
>();

/**
 * Return a WeakMap-memoized LineageGraph for immutable PersonRecord[] arrays.
 * Falls back cleanly to a fresh build when array length mutates.
 */
export function getLineageGraph(persons: PersonRecord[]): LineageGraph {
  const cached = lineageGraphCache.get(persons);
  if (cached && cached.length === persons.length) {
    return cached.graph;
  }
  const graph = buildLineageGraph(persons);
  lineageGraphCache.set(persons, { length: persons.length, graph });
  return graph;
}

/**
 * Build an O(N) orthogonal graph + adjacency index over PersonRecord[].
 */
export function buildLineageGraph(persons: PersonRecord[]): LineageGraph {
  const personById = new Map<string, PersonRecord>();
  const childrenByFatherId = new Map<string, PersonRecord[]>();
  const childrenByAnyParentId = new Map<string, PersonRecord[]>();
  const spousesByPartnerId = new Map<string, PersonRecord[]>();
  const unionsById = new Map<string, FamilyUnion>();
  const unionsByPartnerId = new Map<string, FamilyUnion[]>();
  const parentUnionByChildId = new Map<string, FamilyUnion>();

  for (const p of persons) {
    personById.set(p.id, p);
  }

  for (const p of persons) {
    if (p.spouseOfId) {
      const list = spousesByPartnerId.get(p.spouseOfId);
      if (list) list.push(p);
      else spousesByPartnerId.set(p.spouseOfId, [p]);
      continue;
    }

    // Primary parent anchor: fatherId if present, else motherId (single-mother support)
    const primaryParentId = p.fatherId || p.motherId || null;
    if (primaryParentId && personById.has(primaryParentId)) {
      const list = childrenByFatherId.get(primaryParentId);
      if (list) list.push(p);
      else childrenByFatherId.set(primaryParentId, [p]);
    }

    if (p.fatherId) {
      const fList = childrenByAnyParentId.get(p.fatherId);
      if (fList) fList.push(p);
      else childrenByAnyParentId.set(p.fatherId, [p]);
    }
    if (p.motherId && p.motherId !== p.fatherId) {
      const mList = childrenByAnyParentId.get(p.motherId);
      if (mList) mList.push(p);
      else childrenByAnyParentId.set(p.motherId, [p]);
    }
  }

  for (const [parentId, list] of childrenByFatherId.entries()) {
    childrenByFatherId.set(parentId, sortChildrenChronologically(list));
  }

  for (const [parentId, list] of childrenByAnyParentId.entries()) {
    childrenByAnyParentId.set(parentId, sortChildrenChronologically(list));
  }

  for (const list of spousesByPartnerId.values()) {
    list.sort((a, b) => getSpouseSortScore(a) - getSpouseSortScore(b));
  }

  const getOrCreateUnion = (
    unionId: string,
    partnerIds: string[]
  ): FamilyUnion => {
    const existing = unionsById.get(unionId);
    if (existing) return existing;
    const union: FamilyUnion = { id: unionId, partnerIds, childEdges: [] };
    unionsById.set(unionId, union);
    for (const pid of partnerIds) {
      const list = unionsByPartnerId.get(pid);
      if (list) list.push(union);
      else unionsByPartnerId.set(pid, [union]);
    }
    return union;
  };

  for (const p of persons) {
    if (p.spouseOfId) {
      const unionId = `union:${p.spouseOfId}:${p.id}`;
      getOrCreateUnion(unionId, [p.spouseOfId, p.id]);
    }
  }

  for (const [parentId, children] of childrenByFatherId.entries()) {
    for (const child of children) {
      const unionId =
        child.fatherId && child.motherId
          ? `union:${child.fatherId}:${child.motherId}`
          : child.fatherId
            ? `union:${child.fatherId}`
            : `union:${parentId}`;
      const partnerIds =
        child.fatherId && child.motherId
          ? [child.fatherId, child.motherId]
          : [parentId];
      const union = getOrCreateUnion(unionId, partnerIds);
      union.childEdges.push({
        childId: child.id,
        relationType: child.relationType,
        order: child.siblingOrder,
      });
      parentUnionByChildId.set(child.id, union);
    }
  }

  return {
    personById,
    unionsById,
    unionsByPartnerId,
    parentUnionByChildId,
    childrenByFatherId,
    childrenByAnyParentId,
    spousesByPartnerId,
  };
}

/**
 * O(N) BFS traversal of a person, their spouses, and all descendant subtrees.
 */
export function collectSubtreeIds(
  graphOrPersons: LineageGraph | PersonRecord[],
  rootId: string
): Set<string> {
  const graph = Array.isArray(graphOrPersons)
    ? getLineageGraph(graphOrPersons)
    : graphOrPersons;

  const visited = new Set<string>();
  const queue: string[] = [rootId];

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const spouses = graph.spousesByPartnerId.get(id) || [];
    for (const sp of spouses) {
      if (!visited.has(sp.id)) queue.push(sp.id);
    }

    const children = graph.childrenByFatherId.get(id) || [];
    for (const child of children) {
      if (!visited.has(child.id)) queue.push(child.id);
    }
  }

  return visited;
}

export function deleteSubtreeFromPersons(
  persons: PersonRecord[],
  rootId: string
): { persons: PersonRecord[]; deletedIds: Set<string> } {
  const deletedIds = collectSubtreeIds(persons, rootId);
  const remaining = persons
    .filter((p) => !deletedIds.has(p.id))
    .map((p) =>
      p.motherId && deletedIds.has(p.motherId) ? { ...p, motherId: undefined } : p
    );
  return { persons: remaining, deletedIds };
}

export function detachPersonFromPersons(
  persons: PersonRecord[],
  personId: string
): PersonRecord[] {
  const graph = getLineageGraph(persons);
  const target = graph.personById.get(personId);
  if (!target) return persons;

  const directChildren = graph.childrenByFatherId.get(personId) || [];
  const remaining = persons.filter((p) => p.id !== personId);
  const hasOtherGen1 = remaining.some(
    (p) => (p.generation || 1) <= 1 && !p.spouseOfId
  );

  const shouldShiftBack =
    (target.generation || 1) === 1 &&
    directChildren.length > 0 &&
    !hasOtherGen1;

  const shiftIds = new Set<string>();
  if (shouldShiftBack) {
    const remainingGraph = getLineageGraph(remaining);
    for (const child of directChildren) {
      for (const id of collectSubtreeIds(remainingGraph, child.id)) {
        shiftIds.add(id);
      }
    }
  }

  return remaining.map((p) => {
    const isFatherChild = p.fatherId === personId;
    const isMotherChild = p.motherId === personId;
    const shiftUp = shouldShiftBack && shiftIds.has(p.id) ? -1 : 0;
    if (!isFatherChild && !isMotherChild && shiftUp === 0) return p;
    return {
      ...p,
      ...(isFatherChild ? { fatherId: null } : {}),
      ...(isMotherChild ? { motherId: undefined } : {}),
      ...(shiftUp !== 0
        ? { generation: Math.max(1, (p.generation || 2) + shiftUp) }
        : {}),
    };
  });
}

export function normalizeSpouseOrderInPersons(
  persons: PersonRecord[],
  partnerId: string,
  targetId: string,
  desiredOrder: number
): PersonRecord[] {
  const graph = getLineageGraph(persons);
  const target = graph.personById.get(targetId);
  if (!target) return persons;

  const otherSpouses = (graph.spousesByPartnerId.get(partnerId) || []).filter(
    (p) => p.id !== targetId
  );

  const desiredIdx = Math.max(
    0,
    Math.min(otherSpouses.length, Math.round(desiredOrder || 1) - 1)
  );
  const orderedSpouses = [...otherSpouses];
  orderedSpouses.splice(desiredIdx, 0, target);

  const orderMap = new Map<string, number>();
  orderedSpouses.forEach((sp, idx) => orderMap.set(sp.id, idx + 1));

  return persons.map((p) => {
    const newOrder = orderMap.get(p.id);
    return newOrder !== undefined ? { ...p, siblingOrder: newOrder } : p;
  });
}

export function reorderSiblingInPersons(
  persons: PersonRecord[],
  parentId: string,
  childId: string,
  direction: 'up' | 'down'
): PersonRecord[] {
  const graph = getLineageGraph(persons);
  const siblings = [...(graph.childrenByAnyParentId.get(parentId) || [])].sort(
    (a, b) => {
      const orderA = a.siblingOrder ?? a.biographyOrder ?? 50;
      const orderB = b.siblingOrder ?? b.biographyOrder ?? 50;
      return orderA - orderB;
    }
  );

  const idx = siblings.findIndex((s) => s.id === childId);
  if (idx < 0) return persons;
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= siblings.length) return persons;

  const reordered = [...siblings];
  const [moved] = reordered.splice(idx, 1);
  reordered.splice(targetIdx, 0, moved);

  const orderMap = new Map<string, number>();
  reordered.forEach((sib, index) => orderMap.set(sib.id, index + 1));

  return persons.map((p) => {
    const newOrder = orderMap.get(p.id);
    if (newOrder === undefined) return p;
    return { ...p, siblingOrder: newOrder, biographyOrder: newOrder };
  });
}

export function addParentToPersons(
  persons: PersonRecord[],
  childId: string,
  parentPerson: PersonRecord
): { persons: PersonRecord[]; addedParentId: string | null } {
  const graph = getLineageGraph(persons);
  const child = graph.personById.get(childId);
  if (!child || child.spouseOfId) {
    return { persons, addedParentId: null };
  }

  const needShiftDown = (child.generation || 1) <= 1;
  const subtreeIds = needShiftDown
    ? collectSubtreeIds(graph, childId)
    : new Set<string>();

  const resolvedParent: PersonRecord = {
    ...parentPerson,
    generation: needShiftDown ? 1 : Math.max(1, (child.generation || 2) - 1),
    fatherId: null,
  };

  const updatedPersons = persons.map((p) => {
    const genBump = needShiftDown && subtreeIds.has(p.id) ? 1 : 0;
    if (p.id === childId) {
      return {
        ...p,
        generation: (p.generation || 1) + genBump,
        fatherId: resolvedParent.id,
        relationTitle:
          p.relationTitle === '始迁祖' ? undefined : p.relationTitle,
      };
    }
    if (genBump > 0) {
      return { ...p, generation: (p.generation || 1) + genBump };
    }
    return p;
  });

  return {
    persons: [resolvedParent, ...updatedPersons],
    addedParentId: resolvedParent.id,
  };
}
