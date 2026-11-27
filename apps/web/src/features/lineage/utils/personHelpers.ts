import { getLineageGraph } from '../domain/lineageGraph';
import type { PersonRecord, RelationKind } from '../types';

export {
  getBirthComparableRange,
  getComparableDateRange,
  toSortableDateNumber,
  type ComparableDateRange,
} from './dateRange';
export {
  getSpouseSortScore,
  sortChildrenChronologically,
} from './personSort';
export {
  ALIAS_TYPE_OPTIONS,
  formatAliasItemDisplayName,
  formatAliasItemRomanized,
  formatAliasItemToSummaryString,
  formatPersonAliases,
  getPersonAliases,
  getPersonAliasItems,
  normalizeAliasItems,
  parseAliasInput,
  parseLegacyAliasString,
  syncAliasesFromItems,
} from './personAliases';
export {
  buildBiographyPreviewData,
  type LiveBiographySummary,
} from './personBiography';

export const RELATION_TYPE_OPTIONS: RelationKind[] = [
  '生子',
  '抚子',
  '养子',
  '继子',
  '赘子',
  '义子',
  '出继',
  '出嗣',
  '承嗣',
  '出祧',
  '兼祧',
  '出绍',
  '过继',
  '承继',
  '奉祀',
  '无(断代)',
];

export const FEMALE_RELATION_TYPE_OPTIONS: RelationKind[] = [
  '生女',
  '继女',
  '养女',
];

export const SPOUSE_TYPE_OPTIONS = ['妻子', '丈夫', '配偶'] as const;

export const SPOUSE_RANK_OPTIONS = ['原配', '继配', '三配', '四配'] as const;

export const SPOUSE_RANK_ORDER: Record<string, number> = {
  原配: 1,
  元配: 1,
  正室: 1,
  继配: 2,
  次配: 2,
  再配: 2,
  三配: 3,
  四配: 4,
  五配: 5,
  六配: 6,
};

export interface LineageGraphIndex {
  personById: Map<string, PersonRecord>;
  childrenByFatherId: Map<string, PersonRecord[]>;
  spousesByPartnerId: Map<string, PersonRecord[]>;
}

/**
 * Return the WeakMap-cached O(N) adjacency index over PersonRecord[] for fast lookups
 * across tables, grids, stats, book compilation, and canvas layout.
 */
export function buildLineageGraphIndex(
  persons: PersonRecord[]
): LineageGraphIndex {
  return getLineageGraph(persons);
}

/**
 * Derive children from the cached LineageGraph index using fatherId or motherId,
 * sorted chronologically by birth date when available (with siblingOrder fallback).
 */
export function getDerivedChildren(
  allPersons: PersonRecord[],
  parentId: string
): PersonRecord[] {
  const list = getLineageGraph(allPersons).childrenByAnyParentId.get(parentId);
  return list ? [...list] : [];
}

/**
 * Derive ordered spouse nodes for a partner, sorted by siblingOrder / biographyOrder.
 */
export function getDerivedSpouses(
  allPersons: PersonRecord[],
  partnerId: string
): PersonRecord[] {
  const list = getLineageGraph(allPersons).spousesByPartnerId.get(partnerId);
  return list ? [...list] : [];
}

/**
 * Compute 1-based sequence order for a spouse node among all spouses of the same partner.
 */
export function computeSpouseOrderIndex(
  person: PersonRecord,
  allPersons: PersonRecord[]
): number {
  if (!person.spouseOfId) return person.siblingOrder || 1;
  const spouses =
    getLineageGraph(allPersons).spousesByPartnerId.get(person.spouseOfId) || [];
  const idx = spouses.findIndex((s) => s.id === person.id);
  return idx >= 0 ? idx + 1 : person.siblingOrder || 1;
}

/**
 * Collect self + all descendants via O(subtree) BFS on the cached LineageGraph
 * to prevent circular parent assignments.
 */
export function getDescendantExclusionSet(
  allPersons: PersonRecord[],
  personId: string
): Set<string> {
  const graph = getLineageGraph(allPersons);
  const excluded = new Set<string>([personId]);
  const queue: string[] = [personId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = graph.childrenByAnyParentId.get(currentId) || [];
    for (const child of children) {
      if (!excluded.has(child.id)) {
        excluded.add(child.id);
        queue.push(child.id);
      }
    }
  }

  return excluded;
}

const CHINESE_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

function toChineseNumber(num: number): string {
  if (num <= 0) return String(num);
  if (num < 10) return CHINESE_DIGITS[num];
  if (num === 10) return '十';
  if (num < 20) return `十${CHINESE_DIGITS[num % 10]}`;
  if (num < 100) {
    const tens = Math.floor(num / 10);
    const ones = num % 10;
    return `${CHINESE_DIGITS[tens]}十${ones > 0 ? CHINESE_DIGITS[ones] : ''}`;
  }
  return String(num);
}

export function toChineseOrderPrefix(orderNum: number): string {
  if (orderNum === 1) return '长';
  if (orderNum === 2) return '次';
  return toChineseNumber(orderNum);
}

export function formatSpouseSequenceLabel(orderNum: number): string {
  if (orderNum === 1) return '原配';
  if (orderNum === 2) return '继配';
  return `${toChineseNumber(orderNum)}配`;
}

export function getDefaultRelationType(
  person: Pick<PersonRecord, 'gender' | 'spouseOfId'>,
  partnerGender?: 'male' | 'female' | 'unknown'
): RelationKind {
  if (person.spouseOfId) {
    if (person.gender === 'male') return '丈夫';
    if (person.gender === 'female') return '妻子';
    if (partnerGender === 'male') return '妻子';
    if (partnerGender === 'female') return '丈夫';
    return '配偶';
  }
  return person.gender === 'female' ? '生女' : '生子';
}

export function getExtraRelationBadge(
  person: Pick<PersonRecord, 'gender' | 'spouseOfId' | 'relationType'>,
  partnerGender?: 'male' | 'female' | 'unknown'
): string | undefined {
  const rel = person.relationType?.trim();
  if (!rel) return undefined;
  const defaultRel = getDefaultRelationType(person, partnerGender);
  if (rel === defaultRel) return undefined;
  if (person.spouseOfId && (rel === '妻子' || rel === '丈夫' || rel === '配偶')) {
    return undefined;
  }
  return rel;
}

/**
 * Compute automatic rank label from topology & birth dates:
 * - Spouses: omitted (returns '')
 * - Root: 始祖 / 首节点
 * - Children (sorted by birth date with siblingOrder fallback, split by gender):
 *   - 1 male -> 之男; 2+ males -> 长子 / 次子 / 三子...
 *   - 1 female -> 之女; 2+ females -> 长女 / 次女 / 三女...
 */
export function computeAutoRankLabel(
  person: PersonRecord,
  allPersons: PersonRecord[]
): string {
  if (person.spouseOfId) {
    return '';
  }
  const primaryParentId = person.fatherId || person.motherId;
  if (!primaryParentId) {
    return person.generation === 1 ? '始祖' : '首节点';
  }
  if (person.gender === 'unknown') {
    return '';
  }
  const allChildren =
    getLineageGraph(allPersons).childrenByAnyParentId.get(primaryParentId) || [];
  const isFemale = person.gender === 'female';
  const sameGenderGroup = allChildren.filter((c) => c.gender === person.gender);

  if (sameGenderGroup.length <= 1) {
    return isFemale ? '之女' : '之男';
  }

  const idx = sameGenderGroup.findIndex((s) => s.id === person.id);
  const orderNum = idx >= 0 ? idx + 1 : 1;
  return `${toChineseOrderPrefix(orderNum)}${isFemale ? '女' : '子'}`;
}

export function computeRankDisplay(
  person: PersonRecord,
  allPersons: PersonRecord[]
): string {
  return computeAutoRankLabel(person, allPersons);
}

export {
  getPersonPrimaryTitle,
  hydratePersonDraft,
  normalizeEventType,
  normalizePersonForSave,
} from './personNormalization';
