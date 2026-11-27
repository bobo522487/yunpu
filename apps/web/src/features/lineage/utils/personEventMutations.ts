import { createEntityId } from '../../../lib/id';
import type { GenealogyDate } from '../../date-input/date.types';
import type { GenealogyPlace } from '../../place-input/place.types';
import { getLineageGraph } from '../domain/lineageGraph';
import type { PersonEventType, PersonLifeEvent, PersonRecord } from '../types';
import { normalizeEventType, normalizePersonForSave } from './personNormalization';
import { buildCoupleMarriageEventId } from './personMarriageEvents';
import type { TimelineSourceKind } from './personTimeline';

export interface UnifiedEventSubmitPayload {
  type: PersonEventType;
  structuredDate: GenealogyDate | null;
  structuredPlace: GenealogyPlace | null;
  description: string;
}

export interface EventEditContext {
  mode: 'create' | 'edit';
  sourceKind?: TimelineSourceKind;
  sourceId?: string;
  targetPersonId: string;
  initialEvent: UnifiedEventSubmitPayload;
  canDelete?: boolean;
  coupleMeta?: {
    partnerId: string;
    spouseId: string;
    partnerEventId?: string;
    spouseEventId?: string;
  };
}

/**
 * Apply a unified 4-field event save payload onto the target PersonRecord cleanly and normalize.
 */
export function applyUnifiedEventToPerson(
  targetPerson: PersonRecord,
  allPersons: PersonRecord[],
  payload: UnifiedEventSubmitPayload,
  context: EventEditContext
): Partial<PersonRecord> {
  const desc = payload.description.trim();
  const normalizedType = normalizeEventType(payload.type);

  const hasExistingBirth = Boolean(
    targetPerson.birth?.structuredDate ||
      targetPerson.birth?.structuredPlace ||
      targetPerson.birth?.summary?.trim()
  );

  // 1. Vital Birth (editing vital/child birth, or creating birth when vital birth is empty)
  if (
    context.sourceKind === 'birth' ||
    context.sourceKind === 'child_birth' ||
    (context.mode === 'create' && normalizedType === 'birth' && !hasExistingBirth)
  ) {
    const nextBirth = {
      ...(targetPerson.birth || {}),
      structuredDate: payload.structuredDate ?? undefined,
      structuredPlace: payload.structuredPlace ?? undefined,
      summary: desc || undefined,
    };
    return normalizePersonForSave(
      {
        ...targetPerson,
        birth: nextBirth,
      },
      allPersons
    );
  }

  const hasExistingDeath = Boolean(
    targetPerson.status === 'deceased' &&
      (targetPerson.death?.structuredDate ||
        targetPerson.death?.structuredPlace ||
        targetPerson.death?.summary?.trim())
  );

  // 2. Vital Death (editing vital death, or creating death when vital death is empty)
  if (
    context.sourceKind === 'death' ||
    (context.mode === 'create' && normalizedType === 'death' && !hasExistingDeath)
  ) {
    const nextDeath = {
      ...(targetPerson.death || {}),
      structuredDate: payload.structuredDate ?? undefined,
      structuredPlace: payload.structuredPlace ?? undefined,
      summary: desc || undefined,
    };
    return normalizePersonForSave(
      {
        ...targetPerson,
        status: 'deceased',
        death: nextDeath,
      },
      allPersons
    );
  }

  // 3. Vital Burial
  if (context.sourceKind === 'burial') {
    const nextDeath = {
      ...(targetPerson.death || {}),
      structuredBurialDate: payload.structuredDate ?? undefined,
      structuredBurialPlace: payload.structuredPlace ?? undefined,
      summary: desc || targetPerson.death?.summary || undefined,
    };
    return normalizePersonForSave(
      {
        ...targetPerson,
        status: 'deceased',
        death: nextDeath,
      },
      allPersons
    );
  }

  // 4. Unified Events (education, career, marriage, residence, other, or additional birth/death records)
  const existingEvents: PersonLifeEvent[] = [...(targetPerson.events || [])];
  const eventId =
    context.mode === 'edit' && context.sourceId
      ? context.sourceId
      : createEntityId('ev');

  const nextLifeEvent: PersonLifeEvent = {
    id: eventId,
    type: normalizedType,
    structuredDate: payload.structuredDate ?? undefined,
    structuredPlace: payload.structuredPlace ?? undefined,
    description: desc || undefined,
  };

  const idx = existingEvents.findIndex((e) => e.id === eventId);
  const nextEvents =
    idx >= 0
      ? existingEvents.map((e, i) => (i === idx ? nextLifeEvent : e))
      : [...existingEvents, nextLifeEvent];

  return normalizePersonForSave(
    {
      ...targetPerson,
      events: nextEvents,
    },
    allPersons
  );
}

/**
 * Atomically synchronize a couple's shared marriage event across both partners in one pass,
 * preserving legacy event IDs when present and defaulting to deterministic couple event IDs.
 */
export function applyCoupleMarriageEvent(
  allPersons: PersonRecord[],
  coupleMeta: NonNullable<EventEditContext['coupleMeta']>,
  payload: UnifiedEventSubmitPayload,
  context: EventEditContext
): PersonRecord[] {
  const { personById } = getLineageGraph(allPersons);
  const partner = personById.get(coupleMeta.partnerId);
  const spouse = personById.get(coupleMeta.spouseId);
  if (!partner && !spouse) return allPersons;

  const canonicalCoupleId = buildCoupleMarriageEventId(
    coupleMeta.partnerId,
    coupleMeta.spouseId
  );

  const patches = new Map<string, Partial<PersonRecord>>();
  if (partner) {
    patches.set(
      partner.id,
      applyUnifiedEventToPerson(partner, allPersons, payload, {
        ...context,
        mode: 'edit',
        sourceId: coupleMeta.partnerEventId || canonicalCoupleId,
        targetPersonId: partner.id,
      })
    );
  }
  if (spouse) {
    patches.set(
      spouse.id,
      applyUnifiedEventToPerson(spouse, allPersons, payload, {
        ...context,
        mode: 'edit',
        sourceId: coupleMeta.spouseEventId || canonicalCoupleId,
        targetPersonId: spouse.id,
      })
    );
  }

  return allPersons.map((p) => {
    const patch = patches.get(p.id);
    return patch ? { ...p, ...patch } : p;
  });
}

/**
 * Remove a removable event (custom_event or burial) from PersonRecord.
 */
export function removeUnifiedEventFromPerson(
  targetPerson: PersonRecord,
  allPersons: PersonRecord[],
  context: EventEditContext
): Partial<PersonRecord> | null {
  if (context.sourceKind === 'custom_event' && context.sourceId) {
    const nextEvents = (targetPerson.events || []).filter(
      (e) => e.id !== context.sourceId
    );
    return normalizePersonForSave(
      {
        ...targetPerson,
        events: nextEvents,
      },
      allPersons
    );
  }

  if (context.sourceKind === 'burial') {
    return normalizePersonForSave(
      {
        ...targetPerson,
        death: targetPerson.death
          ? {
              ...targetPerson.death,
              structuredBurialDate: undefined,
              structuredBurialPlace: undefined,
            }
          : undefined,
      },
      allPersons
    );
  }

  return null;
}
