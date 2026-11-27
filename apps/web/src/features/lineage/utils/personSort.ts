import type { PersonRecord } from '../types';
import { getBirthComparableRange } from './dateRange';

function getRankScore(p: PersonRecord): number {
  if (p.siblingOrder !== undefined) return p.siblingOrder;
  if (p.biographyOrder !== undefined) return p.biographyOrder;
  return 50;
}

export function getSpouseSortScore(person: PersonRecord): number {
  if (person.siblingOrder !== undefined) return person.siblingOrder;
  if (person.biographyOrder !== undefined) return person.biographyOrder;
  return 50;
}

/**
 * Sort children chronologically by birth date when comparable (oldest first),
 * preserving siblingOrder / biographyOrder for undated or overlapping dates.
 */
export function sortChildrenChronologically(
  children: PersonRecord[]
): PersonRecord[] {
  const baseSorted = [...children].sort(
    (a, b) => getRankScore(a) - getRankScore(b)
  );
  if (baseSorted.length <= 1) return baseSorted;

  const datedSlots: number[] = [];
  const datedItems: Array<{
    person: PersonRecord;
    range: { start: number; end: number };
    baseIdx: number;
  }> = [];

  baseSorted.forEach((person, idx) => {
    const range = getBirthComparableRange(person);
    if (range) {
      datedSlots.push(idx);
      datedItems.push({ person, range, baseIdx: idx });
    }
  });

  if (datedItems.length <= 1) return baseSorted;

  // Topological sort on strict chronological order (a.end < b.start) with baseIdx tie-breaker
  const n = datedItems.length;
  const inDegree = new Array<number>(n).fill(0);
  const adj: number[][] = Array.from({ length: n }, () => []);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j && datedItems[i].range.end < datedItems[j].range.start) {
        adj[i].push(j);
        inDegree[j] += 1;
      }
    }
  }

  const orderedDated: PersonRecord[] = [];
  const available: number[] = [];
  for (let i = 0; i < n; i++) {
    if (inDegree[i] === 0) available.push(i);
  }

  while (available.length > 0) {
    available.sort((i, j) => datedItems[i].baseIdx - datedItems[j].baseIdx);
    const cur = available.shift()!;
    orderedDated.push(datedItems[cur].person);
    for (const nxt of adj[cur]) {
      inDegree[nxt] -= 1;
      if (inDegree[nxt] === 0) available.push(nxt);
    }
  }

  if (orderedDated.length !== n) return baseSorted;

  const result = [...baseSorted];
  datedSlots.forEach((slotIdx, i) => {
    result[slotIdx] = orderedDated[i];
  });
  return result;
}
