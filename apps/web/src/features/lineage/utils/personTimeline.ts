import { formatGenealogyDate, getPersonDateDisplay } from '../../date-input';
import type { GenealogyDate } from '../../date-input/date.types';
import { formatGenealogyPlace, getPersonPlaceDisplay } from '../../place-input';
import type { GenealogyPlace } from '../../place-input/place.types';
import { getLineageGraph } from '../domain/lineageGraph';
import type { PersonEventType, PersonRecord } from '../types';
import {
  extractGregorianYear,
  extractYearDisplay,
  extractYearLabel,
} from './dateRange';
import { resolvePersonDisplayName } from './personDisplay';
import {
  buildCoupleMarriageEventId,
  matchMarriageEventOnRecord,
} from './personMarriageEvents';
import { normalizeEventType } from './personNormalization';

export { extractGregorianYear, extractYearDisplay, extractYearLabel };
export {
  buildImmediateFamilyGroups,
  calculateAgeDisplay,
  formatHeaderBirthLine,
  formatPersonGregorianLifespan,
  formatPersonYearsSummary,
  resolvePersonDisplayName,
  resolvePersonRelationshipHeader,
  resolveRomanizedDisplayName,
  type FamilyMemberRow,
  type ImmediateFamilyGroups,
} from './personDisplay';
export {
  buildCoupleMarriageEventId,
  findCoupleMarriageInfo,
  matchMarriageEventOnRecord,
  type CoupleMarriageInfo,
} from './personMarriageEvents';
export {
  applyCoupleMarriageEvent,
  applyUnifiedEventToPerson,
  removeUnifiedEventFromPerson,
  type EventEditContext,
  type UnifiedEventSubmitPayload,
} from './personEventMutations';

export const EVENT_TYPE_OPTIONS: ReadonlyArray<{
  value: PersonEventType;
  label: string;
}> = [
  { value: 'birth', label: '出生' },
  { value: 'education', label: '求学' },
  { value: 'career', label: '任职' },
  { value: 'marriage', label: '婚姻' },
  { value: 'residence', label: '迁居' },
  { value: 'death', label: '卒葬' },
  { value: 'other', label: '其他' },
];

export const EVENT_TYPE_LABELS: Record<PersonEventType, string> = {
  birth: '出生',
  education: '求学',
  career: '任职',
  marriage: '婚姻',
  residence: '迁居',
  death: '卒葬',
  other: '其他',
};

export type TimelineSectionTarget = 'vital' | 'other' | 'family' | 'biography';

export type TimelineSourceKind =
  | 'birth'
  | 'death'
  | 'burial'
  | 'marriage_node'
  | 'child_birth'
  | 'custom_event';

export interface TimelineRelatedPerson {
  personId?: string;
  displayName: string;
  avatarUrl?: string;
  gender: 'male' | 'female' | 'unknown';
}

export interface PersonTimelineEvent {
  id: string;
  eventType: PersonEventType;
  sourceKind: TimelineSourceKind;
  sourceId?: string;
  targetPersonId: string;
  sortYear: number;
  sortOrder: number;
  yearLabel: string;
  ageLabel?: string;
  title: string;
  dateText?: string;
  structuredDate?: GenealogyDate | null;
  placeText?: string;
  structuredPlace?: GenealogyPlace | null;
  detailText?: string;
  description?: string;
  relatedPerson?: TimelineRelatedPerson;
  editTargetSection: TimelineSectionTarget;
  jumpPersonId?: string;
}

export function buildPersonTimelineEvents(
  person: PersonRecord,
  allPersons: PersonRecord[],
  clanSurname: string = ''
): PersonTimelineEvent[] {
  const graph = getLineageGraph(allPersons);
  const events: PersonTimelineEvent[] = [];
  const birthYear = extractGregorianYear(person.birth?.structuredDate);

  const computeAgeAt = (year: number | null): string | undefined => {
    if (birthYear === null || year === null) return undefined;
    const age = year - birthYear;
    if (age < 0 || age > 130) return undefined;
    return `年龄 ${age}`;
  };

  // 1. Birth
  const birthDateText = getPersonDateDisplay(person, 'birth').trim();
  const birthPlaceText = getPersonPlaceDisplay(person, 'birth').trim();
  if (birthDateText || birthPlaceText || person.birth?.summary?.trim()) {
    events.push({
      id: `tl-birth-${person.id}`,
      eventType: 'birth',
      sourceKind: 'birth',
      targetPersonId: person.id,
      sortYear: birthYear ?? -99999,
      sortOrder: 10,
      yearLabel:
        birthYear !== null
          ? String(birthYear)
          : extractYearDisplay(person.birth?.structuredDate) || '出生',
      title: '出生',
      dateText: birthDateText || undefined,
      structuredDate: person.birth?.structuredDate ?? null,
      placeText: birthPlaceText || undefined,
      structuredPlace: person.birth?.structuredPlace ?? null,
      detailText: person.birth?.summary?.trim() || undefined,
      description: person.birth?.summary?.trim() || undefined,
      editTargetSection: 'vital',
    });
  }

  // 2. Marriage Events (independent spouse PersonRecord nodes + unified marriage events)
  const customEvents = person.events || [];
  const consumedMarriageEventIds = new Set<string>();

  const isSpouseNode = Boolean(person.spouseOfId);
  if (isSpouseNode) {
    const partner = person.spouseOfId
      ? graph.personById.get(person.spouseOfId)
      : undefined;
    if (partner) {
      const partnerName = resolvePersonDisplayName(partner, clanSurname);
      const matchedEv = matchMarriageEventOnRecord(
        customEvents.filter((ce) => !consumedMarriageEventIds.has(ce.id)),
        partner.id,
        partner.name,
        partnerName,
        1,
        partner.id,
        person.id
      );
      if (matchedEv) consumedMarriageEventIds.add(matchedEv.id);
      const mDateText = matchedEv?.structuredDate
        ? formatGenealogyDate(matchedEv.structuredDate).trim()
        : '';
      const mPlaceText = matchedEv?.structuredPlace
        ? formatGenealogyPlace(matchedEv.structuredPlace).trim()
        : '';
      const mYear = extractGregorianYear(matchedEv?.structuredDate);

      events.push({
        id: `tl-marriage-${partner.id}`,
        eventType: 'marriage',
        sourceKind: 'marriage_node',
        sourceId:
          matchedEv?.id || buildCoupleMarriageEventId(partner.id, person.id),
        targetPersonId: person.id,
        sortYear: mYear ?? (birthYear !== null ? birthYear + 24 : 90200),
        sortOrder: 40,
        yearLabel:
          mYear !== null
            ? String(mYear)
            : extractYearDisplay(matchedEv?.structuredDate) || '婚姻',
        ageLabel: computeAgeAt(mYear),
        title: '婚姻',
        dateText: mDateText || undefined,
        structuredDate: matchedEv?.structuredDate ?? null,
        placeText: mPlaceText || undefined,
        structuredPlace: matchedEv?.structuredPlace ?? null,
        detailText: matchedEv?.description?.trim() || undefined,
        description: matchedEv?.description?.trim() || undefined,
        relatedPerson: {
          personId: partner.id,
          displayName: partnerName,
          avatarUrl: partner.avatarUrl,
          gender: partner.gender,
        },
        editTargetSection: 'family',
        jumpPersonId: partner.id,
      });
    }
  } else {
    const spouseNodes = graph.spousesByPartnerId.get(person.id) || [];
    spouseNodes.forEach((sp, idx) => {
      const name = resolvePersonDisplayName(sp, clanSurname);
      const matchedEv = matchMarriageEventOnRecord(
        customEvents.filter((ce) => !consumedMarriageEventIds.has(ce.id)),
        sp.id,
        sp.name,
        name,
        spouseNodes.length,
        person.id,
        sp.id
      );
      if (matchedEv) consumedMarriageEventIds.add(matchedEv.id);
      const mDateText = matchedEv?.structuredDate
        ? formatGenealogyDate(matchedEv.structuredDate).trim()
        : '';
      const mPlaceText = matchedEv?.structuredPlace
        ? formatGenealogyPlace(matchedEv.structuredPlace).trim()
        : '';
      const mYear = extractGregorianYear(matchedEv?.structuredDate);

      events.push({
        id: `tl-marriage-${sp.id}`,
        eventType: 'marriage',
        sourceKind: 'marriage_node',
        sourceId:
          matchedEv?.id || buildCoupleMarriageEventId(person.id, sp.id),
        targetPersonId: person.id,
        sortYear:
          mYear ?? (birthYear !== null ? birthYear + 25 + idx : 90200 + idx),
        sortOrder: 40 + idx,
        yearLabel:
          mYear !== null
            ? String(mYear)
            : extractYearDisplay(matchedEv?.structuredDate) || '婚姻',
        ageLabel: computeAgeAt(mYear),
        title: '婚姻',
        dateText: mDateText || undefined,
        structuredDate: matchedEv?.structuredDate ?? null,
        placeText: mPlaceText || undefined,
        structuredPlace: matchedEv?.structuredPlace ?? null,
        detailText: matchedEv?.description?.trim() || undefined,
        description: matchedEv?.description?.trim() || undefined,
        relatedPerson: {
          personId: sp.id,
          displayName: name,
          avatarUrl: sp.avatarUrl,
          gender: sp.gender,
        },
        editTargetSection: 'family',
        jumpPersonId: sp.id,
      });
    });
  }

  // 3. Children Births
  const primaryId = person.spouseOfId || person.id;
  const primarySpouses = isSpouseNode
    ? graph.spousesByPartnerId.get(primaryId) || []
    : [];
  const derivedChildren = (
    graph.childrenByAnyParentId.get(primaryId) || []
  ).filter((child) => {
    if (!isSpouseNode) return true;
    if (child.motherId) return child.motherId === person.id;
    return primarySpouses[0]?.id === person.id;
  });

  derivedChildren.forEach((child, idx) => {
    const cDateText = getPersonDateDisplay(child, 'birth').trim();
    const cPlaceText = getPersonPlaceDisplay(child, 'birth').trim();
    const cYear = extractGregorianYear(child.birth?.structuredDate);
    events.push({
      id: `tl-child-${child.id}`,
      eventType: 'birth',
      sourceKind: 'child_birth',
      sourceId: child.id,
      targetPersonId: child.id,
      sortYear:
        cYear ?? (birthYear !== null ? birthYear + 27 + idx : 90300 + idx),
      sortOrder: 50 + idx,
      yearLabel:
        cYear !== null
          ? String(cYear)
          : extractYearDisplay(child.birth?.structuredDate) || '子嗣',
      ageLabel: computeAgeAt(cYear),
      title: child.gender === 'female' ? '女儿出生' : '儿子出生',
      dateText: cDateText || undefined,
      structuredDate: child.birth?.structuredDate ?? null,
      placeText: cPlaceText || undefined,
      structuredPlace: child.birth?.structuredPlace ?? null,
      detailText: child.birth?.summary?.trim() || undefined,
      description: child.birth?.summary?.trim() || undefined,
      relatedPerson: {
        personId: child.id,
        displayName: resolvePersonDisplayName(child, clanSurname),
        avatarUrl: child.avatarUrl,
        gender: child.gender,
      },
      editTargetSection: 'family',
      jumpPersonId: child.id,
    });
  });

  // 4. Unified Life Events (from person.events[])
  const FALLBACK_OFFSET_BY_TYPE: Record<PersonEventType, number> = {
    birth: -99990,
    education: 18,
    career: 24,
    marriage: 25,
    residence: 30,
    death: 99050,
    other: 35,
  };

  customEvents.forEach((ev, idx) => {
    if (consumedMarriageEventIds.has(ev.id)) return;
    const evType = normalizeEventType(ev.type);
    const evDateText = ev.structuredDate
      ? formatGenealogyDate(ev.structuredDate).trim()
      : '';
    const evPlaceText = ev.structuredPlace
      ? formatGenealogyPlace(ev.structuredPlace).trim()
      : '';
    const evYear = extractGregorianYear(ev.structuredDate);
    const title = EVENT_TYPE_LABELS[evType] || '其他';
    const desc = ev.description?.trim() || undefined;

    const fallbackSortYear =
      evType === 'birth'
        ? -99990
        : evType === 'death'
          ? 99050
          : birthYear !== null
            ? birthYear + FALLBACK_OFFSET_BY_TYPE[evType] + idx * 0.01
            : 90400 + idx;

    events.push({
      id: `tl-ev-${ev.id}`,
      eventType: evType,
      sourceKind: 'custom_event',
      sourceId: ev.id,
      targetPersonId: person.id,
      sortYear: evYear ?? fallbackSortYear,
      sortOrder: 60 + idx,
      yearLabel:
        evYear !== null
          ? String(evYear)
          : extractYearDisplay(ev.structuredDate) || title,
      ageLabel: computeAgeAt(evYear),
      title,
      dateText: evDateText || undefined,
      structuredDate: ev.structuredDate ?? null,
      placeText: evPlaceText || undefined,
      structuredPlace: ev.structuredPlace ?? null,
      detailText: desc,
      description: desc,
      editTargetSection: 'other',
    });
  });

  // 5. Death & Burial (when deceased)
  if (person.status === 'deceased') {
    const deathDateText = getPersonDateDisplay(person, 'death').trim();
    const deathPlaceText = getPersonPlaceDisplay(person, 'death').trim();
    const deathCauseText = person.death?.cause?.trim() || '';
    const deathYear = extractGregorianYear(person.death?.structuredDate);
    const deathAgeVal =
      person.death?.manualAge ??
      (deathYear !== null && birthYear !== null ? deathYear - birthYear : null);

    if (
      deathDateText ||
      deathPlaceText ||
      deathCauseText ||
      person.death?.summary?.trim()
    ) {
      events.push({
        id: `tl-death-${person.id}`,
        eventType: 'death',
        sourceKind: 'death',
        targetPersonId: person.id,
        sortYear: deathYear ?? 99000,
        sortOrder: 80,
        yearLabel:
          deathYear !== null
            ? String(deathYear)
            : extractYearDisplay(person.death?.structuredDate) || '卒葬',
        ageLabel:
          typeof deathAgeVal === 'number' && deathAgeVal >= 0
            ? `享寿 ${deathAgeVal}`
            : undefined,
        title: '卒葬',
        dateText: deathDateText || undefined,
        structuredDate: person.death?.structuredDate ?? null,
        placeText: deathPlaceText || undefined,
        structuredPlace: person.death?.structuredPlace ?? null,
        detailText:
          [
            deathCauseText ? `死因：${deathCauseText}` : '',
            person.death?.summary?.trim() || '',
          ]
            .filter(Boolean)
            .join(' · ') || undefined,
        description: person.death?.summary?.trim() || undefined,
        editTargetSection: 'vital',
      });
    }

    const burialDateText = getPersonDateDisplay(person, 'burial').trim();
    const burialPlaceText = getPersonPlaceDisplay(person, 'burial').trim();
    const burialYear = extractGregorianYear(person.death?.structuredBurialDate);

    if (burialDateText || burialPlaceText) {
      events.push({
        id: `tl-burial-${person.id}`,
        eventType: 'death',
        sourceKind: 'burial',
        targetPersonId: person.id,
        sortYear: burialYear ?? (deathYear !== null ? deathYear : 99100),
        sortOrder: 90,
        yearLabel:
          burialYear !== null
            ? String(burialYear)
            : extractYearDisplay(person.death?.structuredBurialDate) || '卒葬',
        ageLabel: computeAgeAt(burialYear),
        title: '卒葬（安葬）',
        dateText: burialDateText || undefined,
        structuredDate: person.death?.structuredBurialDate ?? null,
        placeText: burialPlaceText || undefined,
        structuredPlace: person.death?.structuredBurialPlace ?? null,
        editTargetSection: 'vital',
      });
    }
  }

  return events.sort((a, b) => {
    if (a.sortYear !== b.sortYear) return a.sortYear - b.sortYear;
    return a.sortOrder - b.sortOrder;
  });
}
