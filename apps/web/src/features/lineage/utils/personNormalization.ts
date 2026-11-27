import { getLineageGraph } from '../domain/lineageGraph';
import type {
  PersonEventType,
  PersonLifeEvent,
  PersonRecord,
} from '../types';
import {
  getPersonAliases,
  normalizeAliasItems,
  syncAliasesFromItems,
} from './personAliases';

const VALID_EVENT_TYPES: ReadonlySet<PersonEventType> = new Set([
  'birth',
  'education',
  'career',
  'marriage',
  'residence',
  'death',
  'other',
]);

export function normalizeEventType(rawType: unknown): PersonEventType {
  if (rawType === 'burial') return 'death';
  if (rawType === 'honor') return 'career';
  if (
    typeof rawType === 'string' &&
    VALID_EVENT_TYPES.has(rawType as PersonEventType)
  ) {
    return rawType as PersonEventType;
  }
  return 'other';
}

export function getPersonPrimaryTitle(
  person: Pick<PersonRecord, 'events'> | null | undefined
): string {
  const firstCareer = person?.events?.find((ev) => ev.type === 'career');
  return firstCareer?.description?.trim() || '';
}

/**
 * Hydrate draft form data cleanly from canonical PersonRecord.
 */
export function hydratePersonDraft(
  person: PersonRecord,
  clanSurname: string = ''
): PersonRecord {
  const resolvedAliases = getPersonAliases(person);
  const resolvedAliasItems = normalizeAliasItems(person.aliasItems);
  const hydratedEvents: PersonLifeEvent[] = (person.events || []).map(
    (ev, idx) => ({
      id: ev.id || `ev-${idx + 1}`,
      type: normalizeEventType(ev.type),
      structuredDate: ev.structuredDate ?? undefined,
      structuredPlace: ev.structuredPlace ?? undefined,
      description: ev.description ?? '',
    })
  );

  return {
    ...person,
    surname: person.spouseOfId
      ? (person.surname ?? '')
      : (person.surname ?? clanSurname),
    aliases: resolvedAliases,
    ...(person.aliasItems !== undefined
      ? { aliasItems: resolvedAliasItems }
      : {}),
    nameSuffix: person.nameSuffix ?? '',
    romanizedName: {
      surname: person.romanizedName?.surname ?? '',
      name: person.romanizedName?.name ?? '',
      suffix: person.romanizedName?.suffix ?? '',
    },
    relationType:
      person.relationType ??
      (person.spouseOfId
        ? person.gender === 'male'
          ? '丈夫'
          : '妻子'
        : person.gender === 'female'
          ? '生女'
          : '生子'),
    birth: {
      structuredDate: person.birth?.structuredDate ?? undefined,
      structuredPlace: person.birth?.structuredPlace ?? undefined,
      summary: person.birth?.summary ?? '',
    },
    death: {
      structuredDate: person.death?.structuredDate ?? undefined,
      structuredPlace: person.death?.structuredPlace ?? undefined,
      structuredBurialDate: person.death?.structuredBurialDate ?? undefined,
      structuredBurialPlace: person.death?.structuredBurialPlace ?? undefined,
      cause: person.death?.cause ?? '',
      summary: person.death?.summary ?? '',
      manualAge: person.death?.manualAge,
    },
    events: hydratedEvents,
    sequenceMeta: {
      mainLabel: person.sequenceMeta?.mainLabel ?? '',
      mainNumber: person.sequenceMeta?.mainNumber,
      subLabel: person.sequenceMeta?.subLabel ?? '',
      subNumber: person.sequenceMeta?.subNumber,
      originalPage: person.sequenceMeta?.originalPage,
    },
    privateInfo: {
      idCardNum: person.privateInfo?.idCardNum ?? '',
      mobile: person.privateInfo?.mobile ?? '',
      address: person.privateInfo?.address ?? '',
    },
  };
}

/**
 * Normalize draft before committing to the lineage store using canonical SSOT fields only.
 */
export function normalizePersonForSave(
  draft: PersonRecord,
  allPersons: PersonRecord[]
): PersonRecord {
  const { personById } = getLineageGraph(allPersons);
  const primaryParent = draft.fatherId
    ? personById.get(draft.fatherId) ?? null
    : draft.motherId
      ? personById.get(draft.motherId) ?? null
      : null;

  const hasStructuredAliasItems = draft.aliasItems !== undefined;
  const cleanedAliasItems = hasStructuredAliasItems
    ? normalizeAliasItems(draft.aliasItems)
    : undefined;
  const cleanedAliases = hasStructuredAliasItems
    ? syncAliasesFromItems(cleanedAliasItems || [])
    : getPersonAliases(draft);

  const cleanedEvents: PersonLifeEvent[] = (draft.events || [])
    .map((ev, idx) => {
      const desc = ev.description?.trim() || undefined;
      return {
        id: ev.id || `ev-${idx + 1}`,
        type: normalizeEventType(ev.type),
        ...(ev.structuredDate ? { structuredDate: ev.structuredDate } : {}),
        ...(ev.structuredPlace ? { structuredPlace: ev.structuredPlace } : {}),
        ...(desc ? { description: desc } : {}),
      };
    })
    .filter((ev) =>
      Boolean(ev.structuredDate || ev.structuredPlace || ev.description)
    );

  const romSurname = draft.romanizedName?.surname?.trim() || undefined;
  const romName = draft.romanizedName?.name?.trim() || undefined;
  const romSuffix = draft.romanizedName?.suffix?.trim() || undefined;
  const romanizedName =
    romSurname || romName || romSuffix
      ? {
          ...(romSurname ? { surname: romSurname } : {}),
          ...(romName ? { name: romName } : {}),
          ...(romSuffix ? { suffix: romSuffix } : {}),
        }
      : undefined;

  const birthObj =
    draft.birth?.structuredDate ||
    draft.birth?.structuredPlace ||
    draft.birth?.summary?.trim()
      ? {
          structuredDate: draft.birth.structuredDate ?? undefined,
          structuredPlace: draft.birth.structuredPlace ?? undefined,
          summary: draft.birth.summary?.trim() || undefined,
        }
      : undefined;

  const manualAge =
    typeof draft.death?.manualAge === 'number' &&
    Number.isFinite(draft.death.manualAge) &&
    draft.death.manualAge >= 0
      ? Math.round(draft.death.manualAge)
      : undefined;

  const deathObj =
    draft.death?.structuredDate ||
    draft.death?.structuredPlace ||
    draft.death?.structuredBurialDate ||
    draft.death?.structuredBurialPlace ||
    draft.death?.cause?.trim() ||
    draft.death?.summary?.trim() ||
    manualAge !== undefined
      ? {
          structuredDate: draft.death?.structuredDate ?? undefined,
          structuredPlace: draft.death?.structuredPlace ?? undefined,
          structuredBurialDate: draft.death?.structuredBurialDate ?? undefined,
          structuredBurialPlace: draft.death?.structuredBurialPlace ?? undefined,
          cause: draft.death?.cause?.trim() || undefined,
          summary: draft.death?.summary?.trim() || undefined,
          manualAge,
        }
      : undefined;

  const seqObj =
    draft.sequenceMeta?.mainLabel?.trim() ||
    draft.sequenceMeta?.mainNumber !== undefined ||
    draft.sequenceMeta?.subLabel?.trim() ||
    draft.sequenceMeta?.subNumber !== undefined ||
    draft.sequenceMeta?.originalPage !== undefined
      ? {
          mainLabel: draft.sequenceMeta?.mainLabel?.trim() || undefined,
          mainNumber: draft.sequenceMeta?.mainNumber,
          subLabel: draft.sequenceMeta?.subLabel?.trim() || undefined,
          subNumber: draft.sequenceMeta?.subNumber,
          originalPage: draft.sequenceMeta?.originalPage,
        }
      : undefined;

  const privObj =
    draft.privateInfo?.idCardNum?.trim() ||
    draft.privateInfo?.mobile?.trim() ||
    draft.privateInfo?.address?.trim()
      ? {
          idCardNum: draft.privateInfo?.idCardNum?.trim() || undefined,
          mobile: draft.privateInfo?.mobile?.trim() || undefined,
          address: draft.privateInfo?.address?.trim() || undefined,
        }
      : undefined;

  return {
    id: draft.id,
    branchId: draft.branchId,
    avatarUrl: draft.avatarUrl,
    surname: draft.surname?.trim() || undefined,
    name: draft.name.trim() || '未命名',
    nameSuffix: draft.nameSuffix?.trim() || undefined,
    romanizedName,
    legalName: draft.legalName?.trim() || undefined,
    aliases: cleanedAliases.length > 0 ? cleanedAliases : undefined,
    ...(cleanedAliasItems && cleanedAliasItems.length > 0
      ? { aliasItems: cleanedAliasItems }
      : {}),
    childhoodName: draft.childhoodName?.trim() || undefined,
    gender: draft.gender,
    status: draft.status,
    generation: draft.spouseOfId
      ? draft.generation
      : primaryParent
        ? primaryParent.generation + 1
        : draft.generation || 1,
    generationWord: draft.generationWord?.trim() || undefined,
    hangOrder: draft.hangOrder?.trim() || undefined,
    siblingOrder: draft.siblingOrder,
    fatherId: draft.fatherId ?? null,
    motherId: draft.motherId?.trim() || undefined,
    spouseOfId: draft.spouseOfId,
    relationType:
      draft.relationType !== undefined ? draft.relationType : undefined,
    fatherRelationType: draft.fatherRelationType,
    motherRelationType: draft.motherRelationType,
    relationTitle: draft.relationTitle?.trim() || undefined,
    relationPrefix: draft.relationPrefix?.trim() || undefined,
    relationNotes: draft.relationNotes?.trim() || undefined,
    lineageRemarks: draft.lineageRemarks?.trim() || undefined,
    branchLabel: draft.branchLabel?.trim() || undefined,
    headingLine: draft.headingLine?.trim() || undefined,
    birth: birthObj,
    death: deathObj,
    events: cleanedEvents.length > 0 ? cleanedEvents : undefined,
    sequenceMeta: seqObj,
    privateInfo: privObj,
    biography: draft.biography?.trim() || undefined,
    biographyOrder: draft.biographyOrder,
    notes: draft.notes?.trim() || undefined,
  };
}
