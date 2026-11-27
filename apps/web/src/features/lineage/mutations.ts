import type {
  CreatePersonInput, CreateRelationInput, CreateRelativeInput, CreateRelativeRelationInput,
  PersonAggregateRelationUpdateInput, UpdatePersonAggregateInput,
} from '@yunpu/shared';
import {
  aliasTypeToPersonNameKind, buildUpdatePersonInput, chineseRelationToApiKind,
  cleanBirthInfo, cleanDeathInfo, composeDisplayName, nonEmptyOrNull,
  nonEmptyOrUndefined, PARENT_API_RELATION_KINDS,
} from './adapter';
import {
  createPersonRequest, createRelativeRequest, type LineageGraphPayload,
  type PersonDto, type RelationDto, updatePersonAggregateRequest,
} from './api';
import type { AddRelativeContext, AddRelativeSubmitPayload } from './domain/addRelativeTypes';
import type { PersonRecord } from './types';
import { normalizeAliasItems } from './utils/personAliases';

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const nonEmptyOps = <C, U>(create: C[], update: U[], deleteIds: string[]) =>
  create.length || update.length || deleteIds.length
    ? { ...(create.length ? { create } : {}), ...(update.length ? { update } : {}), ...(deleteIds.length ? { deleteIds } : {}) }
    : undefined;

function diffCollection<E extends { id: string }, N extends { id: string }, C, U>(
  existing: E[], nextItems: N[],
  buildUpdate: (oldItem: E, nextItem: N, index: number) => U | null,
  buildCreate: (nextItem: N, index: number) => C,
) {
  const nextById = new Map(nextItems.map((item, index) => [item.id, { item, index }]));
  const existingIds = new Set(existing.map((item) => item.id));
  const deleteIds: string[] = [];
  const update: U[] = [];
  for (const oldItem of existing) {
    const matched = nextById.get(oldItem.id);
    if (!matched) { deleteIds.push(oldItem.id); continue; }
    const patch = buildUpdate(oldItem, matched.item, matched.index);
    if (patch) update.push(patch);
  }
  const create = nextItems.map((item, index) => ({ item, index }))
    .filter(({ item }) => !(isUuid(item.id) && existingIds.has(item.id)))
    .map(({ item, index }) => buildCreate(item, index));
  return nonEmptyOps(create, update, deleteIds);
}

const diffNames = (dto: PersonDto, nextRecord: PersonRecord): UpdatePersonAggregateInput['names'] =>
  diffCollection(
    (dto.names ?? []).filter((n) => !n.isPrimary), normalizeAliasItems(nextRecord.aliasItems),
    (old, next) => {
      const [kind, label, surname, romanizedSurname, romanizedName] = [
        aliasTypeToPersonNameKind(next.type), nonEmptyOrNull(next.type), nonEmptyOrNull(next.surname),
        nonEmptyOrNull(next.romanizedName?.surname), nonEmptyOrNull(next.romanizedName?.name),
      ];
      return old.kind !== kind || old.value !== next.name || old.label !== label ||
        old.surname !== surname || old.romanizedSurname !== romanizedSurname || old.romanizedName !== romanizedName
        ? { id: old.id, kind, value: next.name, label, surname, romanizedSurname, romanizedName } : null;
    },
    (item) => ({
      kind: aliasTypeToPersonNameKind(item.type), value: item.name,
      ...(nonEmptyOrUndefined(item.type) ? { label: item.type!.trim() } : {}),
      ...(nonEmptyOrUndefined(item.surname) ? { surname: item.surname!.trim() } : {}),
      ...(nonEmptyOrUndefined(item.romanizedName?.surname) ? { romanizedSurname: item.romanizedName!.surname!.trim() } : {}),
      ...(nonEmptyOrUndefined(item.romanizedName?.name) ? { romanizedName: item.romanizedName!.name!.trim() } : {}),
    }),
  );

const diffEvents = (dto: PersonDto, nextEventsInput: PersonRecord['events']): UpdatePersonAggregateInput['events'] =>
  diffCollection(
    dto.events ?? [], nextEventsInput ?? [],
    (old, next, idx) => {
      const description = nonEmptyOrNull(next.description);
      return old.type !== next.type || old.description !== description || old.sortOrder !== idx ||
        JSON.stringify(old.structuredDate) !== JSON.stringify(next.structuredDate ?? null) ||
        JSON.stringify(old.structuredPlace) !== JSON.stringify(next.structuredPlace ?? null)
        ? { id: old.id, type: next.type, structuredDate: next.structuredDate ?? null, structuredPlace: next.structuredPlace ?? null, description, sortOrder: idx } : null;
    },
    (item, idx) => ({
      type: item.type, structuredDate: item.structuredDate ?? null, structuredPlace: item.structuredPlace ?? null,
      ...(nonEmptyOrUndefined(item.description) ? { description: item.description!.trim() } : {}), sortOrder: idx,
    }),
  );

function collectParentEdgeDiff(
  personId: string, prevParentId: string | null, nextParentId: string | null, roleLabel: string | undefined,
  relations: RelationDto[], create: CreateRelationInput[], update: PersonAggregateRelationUpdateInput[], deleteIds: string[],
) {
  const findEdge = (parentId: string | null) =>
    parentId ? relations.find((r) => r.toPersonId === personId && r.fromPersonId === parentId && PARENT_API_RELATION_KINDS.has(r.kind)) : undefined;
  const prevEdge = findEdge(prevParentId);
  if (!nextParentId) { if (prevEdge) deleteIds.push(prevEdge.id); return; }
  if (prevEdge && prevEdge.fromPersonId !== nextParentId) deleteIds.push(prevEdge.id);
  const kind = chineseRelationToApiKind(roleLabel);
  const toRoleLabel = nonEmptyOrNull(roleLabel);
  const targetEdge = findEdge(nextParentId);
  if (targetEdge) {
    if (targetEdge.kind !== kind || targetEdge.toRoleLabel !== toRoleLabel) update.push({ id: targetEdge.id, kind, toRoleLabel });
    return;
  }
  create.push({ fromPersonId: nextParentId, toPersonId: personId, kind, ...(toRoleLabel ? { toRoleLabel } : {}) });
}

function diffRelations(graph: LineageGraphPayload, current: PersonRecord, nextRecord: PersonRecord, updates: Partial<PersonRecord>): UpdatePersonAggregateInput['relations'] {
  const [create, update, deleteIds]: [CreateRelationInput[], PersonAggregateRelationUpdateInput[], string[]] = [[], [], []];
  if (current.spouseOfId && updates.siblingOrder !== undefined) {
    const spouseEdge = graph.relations.find((r) => (r.kind === 'spouse' || r.kind === 'partner') &&
      ((r.fromPersonId === current.spouseOfId && r.toPersonId === current.id) || (r.toPersonId === current.spouseOfId && r.fromPersonId === current.id)));
    if (spouseEdge) update.push({ id: spouseEdge.id, sortOrder: Math.max(0, Number(updates.siblingOrder) - 1) });
  }
  if ('fatherId' in updates || updates.fatherRelationType !== undefined)
    collectParentEdgeDiff(current.id, current.fatherId ?? null, nextRecord.fatherId ?? null, nextRecord.fatherRelationType ?? nextRecord.relationType, graph.relations, create, update, deleteIds);
  if ('motherId' in updates || updates.motherRelationType !== undefined)
    collectParentEdgeDiff(current.id, current.motherId ?? null, nextRecord.motherId ?? null, nextRecord.motherRelationType ?? nextRecord.relationType, graph.relations, create, update, deleteIds);
  return nonEmptyOps(create, update, Array.from(new Set(deleteIds)));
}

export async function syncPersonUpdatesToApi(
  projectId: string, graph: LineageGraphPayload, currentPersons: PersonRecord[], personId: string, updates: Partial<PersonRecord>,
): Promise<void> {
  const current = currentPersons.find((p) => p.id === personId);
  const dto = graph.persons.find((p) => p.id === personId);
  if (!current || !dto) return;
  const nextRecord: PersonRecord = { ...current, ...updates };
  const scalarWithVersion = buildUpdatePersonInput(current, updates);
  const person = scalarWithVersion ? (({ version: _, ...fields }) => fields)(scalarWithVersion) : undefined;
  const names = updates.aliasItems !== undefined || updates.aliases !== undefined ? diffNames(dto, nextRecord) : undefined;
  const events = updates.events !== undefined ? diffEvents(dto, updates.events) : undefined;
  const relations = diffRelations(graph, current, nextRecord, updates);
  if (!person && !names && !events && !relations) return;
  await updatePersonAggregateRequest(projectId, personId, { version: dto.version, ...(person ? { person } : {}), ...(names ? { names } : {}), ...(events ? { events } : {}), ...(relations ? { relations } : {}) });
}

export async function syncCoupleMarriageEventToApi(projectId: string, graph: LineageGraphPayload, prevPersons: PersonRecord[], nextPersons: PersonRecord[]): Promise<void> {
  for (const next of nextPersons) {
    const prev = prevPersons.find((p) => p.id === next.id);
    const dto = graph.persons.find((p) => p.id === next.id);
    if (!prev || !dto || prev.events === next.events) continue;
    const events = diffEvents(dto, next.events);
    if (events) await updatePersonAggregateRequest(projectId, dto.id, { version: dto.version, events });
  }
}

export async function createDirectPersonViaApi(projectId: string, lineageId: string, effectiveSurname: string, existingCount: number, initialData: Partial<PersonRecord>): Promise<PersonDto> {
  const surname = nonEmptyOrUndefined(initialData.surname ?? effectiveSurname);
  const givenName = nonEmptyOrUndefined(initialData.name) ?? '新录族人';
  const { person } = await createPersonRequest(projectId, {
    lineageId, displayName: composeDisplayName(surname, givenName), ...(surname ? { surname } : {}),
    givenName, sex: initialData.gender ?? 'male', isLiving: (initialData.status ?? 'living') === 'living', siblingOrder: Math.max(0, existingCount),
  });
  return person;
}

const spouseEdge = (direction: 'new_to_other' | 'other_to_new', toRoleLabel: string, sortOrder = 0, otherPersonId?: string, fromRoleLabel = '夫'): CreateRelativeRelationInput =>
  ({ ...(otherPersonId ? { otherPersonId } : {}), direction, kind: 'spouse', fromRoleLabel, toRoleLabel, sortOrder });

export async function createRelativeViaApi(
  projectId: string, lineageId: string, _graph: LineageGraphPayload, currentPersons: PersonRecord[],
  effectiveSurname: string, context: AddRelativeContext, payload: AddRelativeSubmitPayload,
): Promise<{ selectId: string }> {
  const birthInfo = cleanBirthInfo(payload.birthDate || payload.birthPlace ? { structuredDate: payload.birthDate ?? undefined, structuredPlace: payload.birthPlace ?? undefined } : undefined);
  const deathInfo = payload.status === 'deceased' ? cleanDeathInfo(payload.deathDate || payload.deathPlace || payload.deathCause || payload.burialPlace ? { structuredDate: payload.deathDate ?? undefined, structuredPlace: payload.deathPlace ?? undefined, cause: payload.deathCause, structuredBurialPlace: payload.burialPlace ?? undefined } : undefined) : null;
  const surname = nonEmptyOrUndefined(payload.surname);
  const givenName = nonEmptyOrUndefined(payload.name) ?? '未命名';
  const displayName = composeDisplayName(surname, givenName);
  const person: CreatePersonInput = {
    lineageId, displayName, ...(surname ? { surname } : {}), givenName, sex: payload.gender, isLiving: payload.status === 'living', siblingOrder: currentPersons.length,
    ...(nonEmptyOrUndefined(payload.romanizedName?.surname) ? { romanizedSurname: payload.romanizedName!.surname!.trim() } : {}),
    ...(nonEmptyOrUndefined(payload.romanizedName?.name) ? { romanizedName: payload.romanizedName!.name!.trim() } : {}),
    ...(nonEmptyOrUndefined(payload.romanizedName?.suffix) ? { romanizedSuffix: payload.romanizedName!.suffix!.trim() } : {}),
    ...(birthInfo ? { birthInfo } : {}), ...(deathInfo ? { deathInfo } : {}),
  };
  const anchor = context.targetPerson;
  const relations: CreateRelativeRelationInput[] = [];
  let [companion, events, anchorEvents]: [CreateRelativeInput['companion'], CreateRelativeInput['events'], CreateRelativeInput['anchorEvents']] = [undefined, undefined, undefined];
  const defaultRel = payload.gender === 'female' ? '生女' : '生子';

  if (context.relation === 'child') {
    const isAnchorMother = Boolean(anchor.gender === 'female' && !anchor.spouseOfId);
    const fatherRel = payload.fatherRelationType || payload.relationType || defaultRel;
    const motherRel = payload.motherRelationType || payload.relationType || defaultRel;
    relations.push({ direction: 'other_to_new', kind: chineseRelationToApiKind(isAnchorMother ? motherRel : fatherRel), toRoleLabel: isAnchorMother ? motherRel : fatherRel });
    const motherId = payload.motherId ?? context.motherInfo?.motherId;
    if (!isAnchorMother && payload.shouldAutoCreateMother && !motherId) {
      const motherName = nonEmptyOrUndefined(payload.motherName) ?? '不详';
      companion = { person: { lineageId, displayName: motherName, givenName: motherName, sex: 'female', isLiving: anchor.status === 'living' }, spouseRelation: { fromRoleLabel: '夫', toRoleLabel: '妻子' }, childRelation: { kind: chineseRelationToApiKind(motherRel), toRoleLabel: motherRel } };
    } else if (!isAnchorMother && motherId) {
      relations.push({ otherPersonId: motherId, direction: 'other_to_new', kind: chineseRelationToApiKind(motherRel), toRoleLabel: motherRel });
    }
  } else if (context.relation === 'sibling') {
    if (anchor.fatherId) relations.push({ otherPersonId: anchor.fatherId, direction: 'other_to_new', kind: 'biological_parent', toRoleLabel: defaultRel });
    if (anchor.motherId) relations.push({ otherPersonId: anchor.motherId, direction: 'other_to_new', kind: 'biological_parent', toRoleLabel: defaultRel });
  } else if (context.relation === 'spouse') {
    relations.push(spouseEdge('other_to_new', payload.gender === 'male' ? '丈夫' : payload.gender === 'female' ? '妻子' : '配偶', currentPersons.filter((p) => p.spouseOfId === anchor.id).length, undefined, anchor.gender === 'female' ? '妻' : '夫'));
    if (payload.marriageDate || payload.marriagePlace) {
      const anchorName = composeDisplayName(anchor.surname || effectiveSurname, anchor.name);
      events = [{ type: 'marriage', structuredDate: payload.marriageDate ?? null, structuredPlace: payload.marriagePlace ?? null, description: `与${anchorName}结缡` }];
      anchorEvents = [{ type: 'marriage', structuredDate: payload.marriageDate ?? null, structuredPlace: payload.marriagePlace ?? null, description: `与${displayName}结缡` }];
    }
  } else {
    relations.push({ direction: 'new_to_other', kind: 'biological_parent', toRoleLabel: anchor.gender === 'female' ? '生女' : '生子' });
    if (payload.gender === 'female' && anchor.fatherId) relations.push(spouseEdge('other_to_new', '妻子', currentPersons.filter((p) => p.spouseOfId === anchor.fatherId).length, anchor.fatherId));
    else if (payload.gender === 'male' && anchor.motherId) relations.push(spouseEdge('new_to_other', '妻子', 0, anchor.motherId));
  }

  if (relations.length === 0 && !companion) return { selectId: (await createPersonRequest(projectId, person)).person.id };
  const created = await createRelativeRequest(projectId, {
    anchorPersonId: anchor.id, person, relations, ...(companion ? { companion } : {}), ...(events ? { events } : {}), ...(anchorEvents ? { anchorEvents } : {}),
  });
  return { selectId: created.person.id };
}
