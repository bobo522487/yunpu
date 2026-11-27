import type { ApiRelationKind } from '@yunpu/shared';
import {
  aliasTypeToPersonNameKind,
  buildUpdatePersonInput,
  chineseRelationToApiKind,
  cleanBirthInfo,
  cleanDeathInfo,
  composeDisplayName,
  nonEmptyOrNull,
  nonEmptyOrUndefined,
  PARENT_API_RELATION_KINDS,
} from './adapter';
import {
  createPersonEventRequest,
  createPersonNameRequest,
  createPersonRequest,
  createRelationRequest,
  deletePersonEventRequest,
  deletePersonNameRequest,
  deleteRelationRequest,
  type LineageGraphPayload,
  type PersonDto,
  type RelationDto,
  updatePersonEventRequest,
  updatePersonNameRequest,
  updatePersonRequest,
  updateRelationRequest,
} from './api';
import type {
  AddRelativeContext,
  AddRelativeSubmitPayload,
} from './domain/addRelativeTypes';
import type { PersonRecord } from './types';
import { normalizeAliasItems } from './utils/personAliases';

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function syncParentEdge(
  projectId: string,
  childId: string,
  sexFilter: 'female' | 'male_or_other',
  targetParentId: string | null | undefined,
  roleLabel: string | undefined,
  relations: RelationDto[],
  personById: Map<string, PersonDto>,
) {
  const existing = relations.filter((r) => {
    if (r.toPersonId !== childId || !PARENT_API_RELATION_KINDS.has(r.kind)) {
      return false;
    }
    const p = personById.get(r.fromPersonId);
    const isMother = p?.sex === 'female';
    return sexFilter === 'female' ? isMother : !isMother;
  });

  if (!targetParentId) {
    for (const rel of existing) {
      await deleteRelationRequest(projectId, rel.id);
    }
    return;
  }

  const desiredKind = chineseRelationToApiKind(roleLabel);
  const matching = existing.find((r) => r.fromPersonId === targetParentId);
  for (const rel of existing) {
    if (rel.id !== matching?.id) {
      await deleteRelationRequest(projectId, rel.id);
    }
  }

  if (matching) {
    const cleanRole = nonEmptyOrNull(roleLabel);
    if (matching.kind !== desiredKind || matching.toRoleLabel !== cleanRole) {
      await updateRelationRequest(projectId, matching.id, {
        kind: desiredKind,
        toRoleLabel: cleanRole,
      });
    }
    return;
  }

  await createRelationRequest(projectId, {
    fromPersonId: targetParentId,
    toPersonId: childId,
    kind: desiredKind,
    ...(nonEmptyOrUndefined(roleLabel)
      ? { toRoleLabel: nonEmptyOrUndefined(roleLabel) }
      : {}),
  });
}

async function syncAliasesDiff(
  projectId: string,
  dto: PersonDto,
  nextRecord: PersonRecord,
) {
  const existingSecondary = (dto.names ?? []).filter((n) => !n.isPrimary);
  const nextItems = normalizeAliasItems(nextRecord.aliasItems);
  const nextById = new Map(nextItems.map((item) => [item.id, item]));

  for (const oldName of existingSecondary) {
    const updated = nextById.get(oldName.id);
    if (!updated) {
      await deletePersonNameRequest(projectId, dto.id, oldName.id);
      continue;
    }
    const nextKind = aliasTypeToPersonNameKind(updated.type);
    const nextLabel = nonEmptyOrNull(updated.type);
    const nextSurname = nonEmptyOrNull(updated.surname);
    const nextRSurname = nonEmptyOrNull(updated.romanizedName?.surname);
    const nextRName = nonEmptyOrNull(updated.romanizedName?.name);
    if (
      oldName.kind !== nextKind ||
      oldName.value !== updated.name ||
      oldName.label !== nextLabel ||
      oldName.surname !== nextSurname ||
      oldName.romanizedSurname !== nextRSurname ||
      oldName.romanizedName !== nextRName
    ) {
      await updatePersonNameRequest(projectId, dto.id, oldName.id, {
        kind: nextKind,
        value: updated.name,
        label: nextLabel,
        surname: nextSurname,
        romanizedSurname: nextRSurname,
        romanizedName: nextRName,
      });
    }
  }

  const existingIds = new Set(existingSecondary.map((n) => n.id));
  for (const item of nextItems) {
    if (isUuid(item.id) && existingIds.has(item.id)) continue;
    await createPersonNameRequest(projectId, dto.id, {
      kind: aliasTypeToPersonNameKind(item.type),
      value: item.name,
      ...(nonEmptyOrUndefined(item.type) ? { label: item.type!.trim() } : {}),
      ...(nonEmptyOrUndefined(item.surname)
        ? { surname: item.surname!.trim() }
        : {}),
      ...(nonEmptyOrUndefined(item.romanizedName?.surname)
        ? { romanizedSurname: item.romanizedName!.surname!.trim() }
        : {}),
      ...(nonEmptyOrUndefined(item.romanizedName?.name)
        ? { romanizedName: item.romanizedName!.name!.trim() }
        : {}),
    });
  }
}

async function syncEventsDiff(
  projectId: string,
  dto: PersonDto,
  nextEventsInput: PersonRecord['events'],
) {
  const existingEvents = dto.events ?? [];
  const nextEvents = nextEventsInput ?? [];
  const nextById = new Map(nextEvents.map((e) => [e.id, e]));

  for (const oldEv of existingEvents) {
    const matched = nextById.get(oldEv.id);
    if (!matched) {
      await deletePersonEventRequest(projectId, dto.id, oldEv.id);
      continue;
    }
    const idx = nextEvents.findIndex((e) => e.id === matched.id);
    const nextDesc = nonEmptyOrNull(matched.description);
    if (
      oldEv.type !== matched.type ||
      oldEv.description !== nextDesc ||
      oldEv.sortOrder !== idx ||
      JSON.stringify(oldEv.structuredDate) !==
        JSON.stringify(matched.structuredDate ?? null) ||
      JSON.stringify(oldEv.structuredPlace) !==
        JSON.stringify(matched.structuredPlace ?? null)
    ) {
      await updatePersonEventRequest(projectId, dto.id, oldEv.id, {
        type: matched.type,
        structuredDate: matched.structuredDate ?? null,
        structuredPlace: matched.structuredPlace ?? null,
        description: nextDesc,
        sortOrder: idx >= 0 ? idx : 0,
      });
    }
  }

  const existingIds = new Set(existingEvents.map((e) => e.id));
  for (const [idx, item] of nextEvents.entries()) {
    if (isUuid(item.id) && existingIds.has(item.id)) continue;
    await createPersonEventRequest(projectId, dto.id, {
      type: item.type,
      structuredDate: item.structuredDate ?? null,
      structuredPlace: item.structuredPlace ?? null,
      ...(nonEmptyOrUndefined(item.description)
        ? { description: item.description!.trim() }
        : {}),
      sortOrder: idx,
    });
  }
}

export async function syncPersonUpdatesToApi(
  projectId: string,
  graph: LineageGraphPayload,
  currentPersons: PersonRecord[],
  personId: string,
  updates: Partial<PersonRecord>,
): Promise<void> {
  const current = currentPersons.find((p) => p.id === personId);
  const dto = graph.persons.find((p) => p.id === personId);
  if (!current || !dto) return;

  const personById = new Map(graph.persons.map((p) => [p.id, p]));
  const nextRecord: PersonRecord = { ...current, ...updates };

  // 1. Update scalar/vital/bio fields
  const scalarPayload = buildUpdatePersonInput(current, updates);
  if (scalarPayload) {
    await updatePersonRequest(projectId, personId, scalarPayload);
  }

  // 2. Sync spouse siblingOrder onto spouse relation
  if (current.spouseOfId && updates.siblingOrder !== undefined) {
    const spouseEdge = graph.relations.find(
      (r) =>
        (r.kind === 'spouse' || r.kind === 'partner') &&
        ((r.fromPersonId === current.spouseOfId && r.toPersonId === personId) ||
          (r.toPersonId === current.spouseOfId && r.fromPersonId === personId)),
    );
    if (spouseEdge) {
      await updateRelationRequest(projectId, spouseEdge.id, {
        sortOrder: Math.max(0, Number(updates.siblingOrder) - 1),
      });
    }
  }

  // 3. Sync aliases
  if (updates.aliasItems !== undefined || updates.aliases !== undefined) {
    await syncAliasesDiff(projectId, dto, nextRecord);
  }

  // 4. Sync custom events
  if (updates.events !== undefined) {
    await syncEventsDiff(projectId, dto, updates.events);
  }

  // 5. Sync parent-child relations
  if (
    updates.fatherId !== undefined ||
    updates.fatherRelationType !== undefined
  ) {
    await syncParentEdge(
      projectId,
      personId,
      'male_or_other',
      nextRecord.fatherId,
      nextRecord.fatherRelationType ?? nextRecord.relationType,
      graph.relations,
      personById,
    );
  }

  if (
    updates.motherId !== undefined ||
    updates.motherRelationType !== undefined
  ) {
    await syncParentEdge(
      projectId,
      personId,
      'female',
      nextRecord.motherId,
      nextRecord.motherRelationType ?? nextRecord.relationType,
      graph.relations,
      personById,
    );
  }
}

export async function syncCoupleMarriageEventToApi(
  projectId: string,
  graph: LineageGraphPayload,
  prevPersons: PersonRecord[],
  nextPersons: PersonRecord[],
): Promise<void> {
  for (const next of nextPersons) {
    const prev = prevPersons.find((p) => p.id === next.id);
    const dto = graph.persons.find((p) => p.id === next.id);
    if (!prev || !dto || prev.events === next.events) continue;
    await syncEventsDiff(projectId, dto, next.events);
  }
}

export async function createDirectPersonViaApi(
  projectId: string,
  lineageId: string,
  effectiveSurname: string,
  existingCount: number,
  initialData: Partial<PersonRecord>,
): Promise<PersonDto> {
  const surname = nonEmptyOrUndefined(initialData.surname ?? effectiveSurname);
  const name = nonEmptyOrUndefined(initialData.name) ?? '新录族人';
  const { person } = await createPersonRequest(projectId, {
    lineageId,
    displayName: composeDisplayName(surname, name),
    ...(surname ? { surname } : {}),
    givenName: name,
    sex: initialData.gender ?? 'male',
    isLiving: (initialData.status ?? 'living') === 'living',
    siblingOrder: Math.max(0, existingCount),
  });
  return person;
}

function buildVitalFieldsFromRelativePayload(
  payload: AddRelativeSubmitPayload,
) {
  const birthInfo = cleanBirthInfo(
    payload.birthDate || payload.birthPlace
      ? {
          structuredDate: payload.birthDate ?? undefined,
          structuredPlace: payload.birthPlace ?? undefined,
        }
      : undefined,
  );

  const deathInfo =
    payload.status === 'deceased'
      ? cleanDeathInfo(
          payload.deathDate ||
            payload.deathPlace ||
            payload.deathCause ||
            payload.burialPlace
            ? {
                structuredDate: payload.deathDate ?? undefined,
                structuredPlace: payload.deathPlace ?? undefined,
                cause: payload.deathCause,
                structuredBurialPlace: payload.burialPlace ?? undefined,
              }
            : undefined,
        )
      : null;

  return { birthInfo, deathInfo };
}

export async function createRelativeViaApi(
  projectId: string,
  lineageId: string,
  graph: LineageGraphPayload,
  currentPersons: PersonRecord[],
  effectiveSurname: string,
  context: AddRelativeContext,
  payload: AddRelativeSubmitPayload,
): Promise<{ selectId: string }> {
  const { birthInfo, deathInfo } = buildVitalFieldsFromRelativePayload(payload);
  const cleanSurname = nonEmptyOrUndefined(payload.surname);
  const cleanName = nonEmptyOrUndefined(payload.name) ?? '未命名';
  const displayName = composeDisplayName(cleanSurname, cleanName);

  const created = await createPersonRequest(projectId, {
    lineageId,
    displayName,
    ...(cleanSurname ? { surname: cleanSurname } : {}),
    givenName: cleanName,
    ...(nonEmptyOrUndefined(payload.romanizedName?.surname)
      ? { romanizedSurname: payload.romanizedName!.surname!.trim() }
      : {}),
    ...(nonEmptyOrUndefined(payload.romanizedName?.name)
      ? { romanizedName: payload.romanizedName!.name!.trim() }
      : {}),
    ...(nonEmptyOrUndefined(payload.romanizedName?.suffix)
      ? { romanizedSuffix: payload.romanizedName!.suffix!.trim() }
      : {}),
    sex: payload.gender,
    isLiving: payload.status === 'living',
    ...(birthInfo ? { birthInfo } : {}),
    ...(deathInfo ? { deathInfo } : {}),
    siblingOrder: currentPersons.length,
  });
  const newPerson = created.person;
  const anchor = context.targetPerson;

  if (context.relation === 'child') {
    const isAnchorMother = Boolean(
      anchor.gender === 'female' && !anchor.spouseOfId,
    );
    const defaultRel = payload.gender === 'female' ? '生女' : '生子';
    const fatherRelLabel =
      payload.fatherRelationType || payload.relationType || defaultRel;
    const motherRelLabel =
      payload.motherRelationType || payload.relationType || defaultRel;

    if (isAnchorMother) {
      await createRelationRequest(projectId, {
        fromPersonId: anchor.id,
        toPersonId: newPerson.id,
        kind: chineseRelationToApiKind(motherRelLabel),
        toRoleLabel: motherRelLabel,
      });
    } else {
      await createRelationRequest(projectId, {
        fromPersonId: anchor.id,
        toPersonId: newPerson.id,
        kind: chineseRelationToApiKind(fatherRelLabel),
        toRoleLabel: fatherRelLabel,
      });

      let motherId = payload.motherId ?? context.motherInfo?.motherId;
      if (payload.shouldAutoCreateMother && !motherId) {
        const motherName = nonEmptyOrUndefined(payload.motherName) ?? '不详';
        const autoMother = await createPersonRequest(projectId, {
          lineageId,
          displayName: motherName,
          givenName: motherName,
          sex: 'female',
          isLiving: anchor.status === 'living',
        });
        motherId = autoMother.person.id;
        await createRelationRequest(projectId, {
          fromPersonId: anchor.id,
          toPersonId: motherId,
          kind: 'spouse',
          fromRoleLabel: '夫',
          toRoleLabel: '妻子',
        });
      }

      if (motherId) {
        await createRelationRequest(projectId, {
          fromPersonId: motherId,
          toPersonId: newPerson.id,
          kind: chineseRelationToApiKind(motherRelLabel),
          toRoleLabel: motherRelLabel,
        });
      }
    }
    return { selectId: newPerson.id };
  }

  if (context.relation === 'sibling') {
    const defaultRel = payload.gender === 'female' ? '生女' : '生子';
    if (anchor.fatherId) {
      await createRelationRequest(projectId, {
        fromPersonId: anchor.fatherId,
        toPersonId: newPerson.id,
        kind: 'biological_parent',
        toRoleLabel: defaultRel,
      });
    }
    if (anchor.motherId) {
      await createRelationRequest(projectId, {
        fromPersonId: anchor.motherId,
        toPersonId: newPerson.id,
        kind: 'biological_parent',
        toRoleLabel: defaultRel,
      });
    }
    return { selectId: newPerson.id };
  }

  if (context.relation === 'spouse') {
    const existingSpouses = currentPersons.filter(
      (p) => p.spouseOfId === anchor.id,
    ).length;
    const spouseRoleLabel =
      payload.gender === 'male'
        ? '丈夫'
        : payload.gender === 'female'
          ? '妻子'
          : '配偶';
    const anchorRoleLabel = anchor.gender === 'female' ? '妻' : '夫';
    await createRelationRequest(projectId, {
      fromPersonId: anchor.id,
      toPersonId: newPerson.id,
      kind: 'spouse',
      fromRoleLabel: anchorRoleLabel,
      toRoleLabel: spouseRoleLabel,
      sortOrder: existingSpouses,
    });

    if (payload.marriageDate || payload.marriagePlace) {
      const anchorName = composeDisplayName(
        anchor.surname || effectiveSurname,
        anchor.name,
      );
      await createPersonEventRequest(projectId, newPerson.id, {
        type: 'marriage',
        structuredDate: payload.marriageDate ?? null,
        structuredPlace: payload.marriagePlace ?? null,
        description: `与${anchorName}结缡`,
      });
      await createPersonEventRequest(projectId, anchor.id, {
        type: 'marriage',
        structuredDate: payload.marriageDate ?? null,
        structuredPlace: payload.marriagePlace ?? null,
        description: `与${displayName}结缡`,
      });
    }
    return { selectId: newPerson.id };
  }

  // parent
  const parentKind: ApiRelationKind = 'biological_parent';
  await createRelationRequest(projectId, {
    fromPersonId: newPerson.id,
    toPersonId: anchor.id,
    kind: parentKind,
    toRoleLabel: anchor.gender === 'female' ? '生女' : '生子',
  });
  if (payload.gender === 'female' && anchor.fatherId) {
    const existingPartnerSpouses = currentPersons.filter(
      (p) => p.spouseOfId === anchor.fatherId,
    ).length;
    await createRelationRequest(projectId, {
      fromPersonId: anchor.fatherId,
      toPersonId: newPerson.id,
      kind: 'spouse',
      fromRoleLabel: '夫',
      toRoleLabel: '妻子',
      sortOrder: existingPartnerSpouses,
    });
  } else if (
    payload.gender === 'male' &&
    anchor.motherId &&
    !graph.relations.some(
      (r) =>
        (r.kind === 'spouse' || r.kind === 'partner') &&
        ((r.fromPersonId === anchor.motherId && r.toPersonId === newPerson.id) ||
          (r.toPersonId === anchor.motherId && r.fromPersonId === newPerson.id)),
    )
  ) {
    await createRelationRequest(projectId, {
      fromPersonId: newPerson.id,
      toPersonId: anchor.motherId,
      kind: 'spouse',
      fromRoleLabel: '夫',
      toRoleLabel: '妻子',
      sortOrder: 0,
    });
  }
  return { selectId: newPerson.id };
}
