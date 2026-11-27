import type {
  ApiRelationKind,
  CreatePersonEventInput,
  CreatePersonInput,
  CreatePersonNameInput,
  CreateRelationInput,
  CreateRelativeInput,
  GenealogyDateInput,
  PersonDeathInfoInput,
  SubgraphQueryInput,
  UpdatePersonAggregateInput,
  UpdatePersonEventInput,
  UpdatePersonInput,
  UpdatePersonNameInput,
  UpdateRelationInput,
} from "@yunpu/shared";
import { requireProjectMember } from "../../access";
import {
  type TxDatabase,
  withTenantTransaction,
} from "../../db/with-tenant-transaction";
import {
  conflict,
  notFound,
  validationError,
  versionConflict,
} from "../../lib/errors";
import {
  casUpdatePerson,
  clearPrimaryPersonName,
  countPersonsInProject,
  deletePerson,
  deletePersonEvent,
  deletePersonName,
  deleteRelation,
  getPerson,
  getPersonAnchorInfo,
  getPersonLivingState,
  getPersonName,
  getProjectionForPerson,
  getRelation,
  insertPerson,
  insertPersonEvent,
  insertPersonName,
  insertRelation,
  lineageExistsInProject,
  listPersons,
  listRelationsForPerson,
  type PersonEventView,
  type PersonNameView,
  type PersonView,
  type ProjectionView,
  personExistsInProject,
  queryLineageGraphData,
  querySubgraph,
  type RelationView,
  resolveOrCreateDefaultLineageId,
  updatePersonEvent,
  updatePersonName,
  updateRelation,
} from "./queries";

export type {
  PersonEventView,
  PersonNameView,
  PersonView,
  ProjectionView,
  RelationView,
};

function isSymmetricRelationKind(kind: ApiRelationKind): boolean {
  return kind === "spouse" || kind === "partner";
}

function normalizeSymmetricPair(
  fromPersonId: string,
  toPersonId: string,
  fromRoleLabel?: string | null,
  toRoleLabel?: string | null,
): {
  fromPersonId: string;
  toPersonId: string;
  fromRoleLabel: string | null | undefined;
  toRoleLabel: string | null | undefined;
} {
  if (fromPersonId < toPersonId) {
    return { fromPersonId, toPersonId, fromRoleLabel, toRoleLabel };
  }
  return {
    fromPersonId: toPersonId,
    toPersonId: fromPersonId,
    fromRoleLabel: toRoleLabel,
    toRoleLabel: fromRoleLabel,
  };
}

function extractGregorianYear(
  date: GenealogyDateInput | null | undefined,
): number | undefined {
  if (!date || date.kind !== "date" || date.calendar !== "gregorian") {
    return undefined;
  }
  const parts = date.parts as { year?: unknown };
  return typeof parts.year === "number" && Number.isInteger(parts.year)
    ? parts.year
    : undefined;
}

function assertLivingDeathConsistency(
  isLiving: boolean,
  deathInfo: PersonDeathInfoInput | null | undefined,
): void {
  if (isLiving && deathInfo) {
    throw validationError({
      deathInfo: ["在世人物不能填写死亡或葬地信息"],
    });
  }
}

function resolveUpdateLifeYears(values: {
  birthYear?: number | null;
  deathYear?: number | null;
  birthInfo?: UpdatePersonInput["birthInfo"];
  deathInfo?: UpdatePersonInput["deathInfo"];
}): {
  birthYear: number | null | undefined;
  deathYear: number | null | undefined;
} {
  const birthYear =
    values.birthYear !== undefined
      ? values.birthYear
      : values.birthInfo !== undefined
        ? (extractGregorianYear(values.birthInfo?.structuredDate) ?? null)
        : undefined;
  const deathYear =
    values.deathYear !== undefined
      ? values.deathYear
      : values.deathInfo !== undefined
        ? (extractGregorianYear(values.deathInfo?.structuredDate) ?? null)
        : undefined;
  return { birthYear, deathYear };
}

/** Create a person inside an existing tenant transaction. */
export async function createPersonInTx(
  db: TxDatabase,
  organizationId: string,
  projectId: string,
  input: CreatePersonInput,
): Promise<PersonView> {
  let lineageId = input.lineageId;
  if (lineageId) {
    if (!(await lineageExistsInProject(db, projectId, lineageId))) {
      throw notFound();
    }
  } else {
    lineageId = await resolveOrCreateDefaultLineageId(
      db,
      organizationId,
      projectId,
    );
  }

  const birthYear =
    input.birthYear ?? extractGregorianYear(input.birthInfo?.structuredDate);
  const deathYear =
    input.deathYear ?? extractGregorianYear(input.deathInfo?.structuredDate);
  const isLiving = input.isLiving ?? true;

  assertLivingDeathConsistency(isLiving, input.deathInfo);

  return insertPerson(db, organizationId, projectId, {
    ...input,
    lineageId,
    birthYear,
    deathYear,
    isLiving,
  });
}

/** Create a person name inside an existing tenant transaction. */
export async function createPersonNameInTx(
  db: TxDatabase,
  organizationId: string,
  projectId: string,
  personId: string,
  input: CreatePersonNameInput,
): Promise<PersonNameView> {
  if (!(await personExistsInProject(db, projectId, personId))) {
    throw notFound();
  }
  if (input.isPrimary) {
    await clearPrimaryPersonName(db, projectId, personId);
  }
  return insertPersonName(db, organizationId, projectId, personId, input);
}

/** Create a person relation inside an existing tenant transaction. */
export async function createRelationInTx(
  db: TxDatabase,
  organizationId: string,
  projectId: string,
  input: CreateRelationInput,
): Promise<RelationView> {
  if (
    (await countPersonsInProject(db, projectId, [
      input.fromPersonId,
      input.toPersonId,
    ])) !== 2
  ) {
    throw notFound();
  }

  let fromPersonId = input.fromPersonId;
  let toPersonId = input.toPersonId;
  let fromRoleLabel: string | null | undefined = input.fromRoleLabel;
  let toRoleLabel: string | null | undefined = input.toRoleLabel;
  const kind = input.kind as ApiRelationKind;

  if (isSymmetricRelationKind(kind)) {
    ({ fromPersonId, toPersonId, fromRoleLabel, toRoleLabel } =
      normalizeSymmetricPair(
        fromPersonId,
        toPersonId,
        fromRoleLabel,
        toRoleLabel,
      ));
  }

  return insertRelation(db, organizationId, projectId, {
    fromPersonId,
    toPersonId,
    kind,
    fromRoleLabel,
    toRoleLabel,
    sortOrder: input.sortOrder,
    note: input.note,
  });
}

/** Create a person event inside an existing tenant transaction. */
export async function createPersonEventInTx(
  db: TxDatabase,
  organizationId: string,
  projectId: string,
  personId: string,
  input: CreatePersonEventInput,
): Promise<PersonEventView> {
  if (!(await personExistsInProject(db, projectId, personId))) {
    throw notFound();
  }
  return insertPersonEvent(db, organizationId, projectId, personId, input);
}

/** Load full persons, relations, and projections for a lineage inside an existing transaction. */
export async function loadLineageGraphDataInTx(
  db: TxDatabase,
  organizationId: string,
  projectId: string,
  lineageId: string,
): Promise<{
  persons: PersonView[];
  relations: RelationView[];
  projections: ProjectionView[];
}> {
  return queryLineageGraphData(db, organizationId, projectId, lineageId);
}

export async function createPersonForProject(
  userId: string,
  projectId: string,
  input: CreatePersonInput,
): Promise<PersonView> {
  return withTenantTransaction({ userId }, async (db) => {
    const { organizationId } = await requireProjectMember(
      db,
      projectId,
      userId,
      "editor",
    );
    return createPersonInTx(db, organizationId, projectId, input);
  });
}

export async function getPersonForProject(
  userId: string,
  projectId: string,
  personId: string,
): Promise<PersonView> {
  return withTenantTransaction({ userId, readOnly: true }, async (db) => {
    await requireProjectMember(db, projectId, userId, null);
    const person = await getPerson(db, projectId, personId);
    if (!person) throw notFound();
    return person;
  });
}

export async function listPersonsForProject(
  userId: string,
  projectId: string,
  options: { lineageId?: string; cursor?: string; limit?: number },
): Promise<{ persons: PersonView[]; nextCursor: string | null }> {
  return withTenantTransaction({ userId, readOnly: true }, async (db) => {
    const { organizationId } = await requireProjectMember(
      db,
      projectId,
      userId,
      null,
    );
    return listPersons(db, organizationId, projectId, {
      lineageId: options.lineageId,
      cursor: options.cursor,
      limit: options.limit ?? 50,
    });
  });
}

async function updatePersonNameInTx(
  db: TxDatabase,
  projectId: string,
  personId: string,
  nameId: string,
  input: UpdatePersonNameInput,
): Promise<PersonNameView> {
  const existing = await getPersonName(db, projectId, personId, nameId);
  if (!existing) throw notFound();

  if (input.isPrimary === false && existing.isPrimary) {
    throw conflict("不能取消人物唯一主名，请改设其他名号为主名");
  }
  if (input.isPrimary === true && !existing.isPrimary) {
    await clearPrimaryPersonName(db, projectId, personId);
  }

  const updated = await updatePersonName(
    db,
    projectId,
    personId,
    nameId,
    input,
  );
  if (!updated) throw notFound();
  return updated;
}

async function deletePersonNameInTx(
  db: TxDatabase,
  projectId: string,
  personId: string,
  nameId: string,
): Promise<void> {
  const existing = await getPersonName(db, projectId, personId, nameId);
  if (!existing) throw notFound();
  if (existing.isPrimary) {
    throw conflict("不能删除人物主名");
  }
  const deleted = await deletePersonName(db, projectId, personId, nameId);
  if (!deleted) throw notFound();
}

async function updateRelationInTx(
  db: TxDatabase,
  projectId: string,
  relationId: string,
  input: UpdateRelationInput,
  scopedPersonId?: string,
): Promise<RelationView> {
  const existing = await getRelation(db, projectId, relationId);
  if (!existing) throw notFound();
  if (
    scopedPersonId &&
    existing.fromPersonId !== scopedPersonId &&
    existing.toPersonId !== scopedPersonId
  ) {
    throw notFound();
  }

  const nextKind = (input.kind ?? existing.kind) as ApiRelationKind;
  let fromPersonId = existing.fromPersonId;
  let toPersonId = existing.toPersonId;
  let fromRoleLabel =
    input.fromRoleLabel === undefined
      ? existing.fromRoleLabel
      : input.fromRoleLabel;
  let toRoleLabel =
    input.toRoleLabel === undefined ? existing.toRoleLabel : input.toRoleLabel;

  if (isSymmetricRelationKind(nextKind)) {
    const normalized = normalizeSymmetricPair(
      fromPersonId,
      toPersonId,
      fromRoleLabel,
      toRoleLabel,
    );
    fromPersonId = normalized.fromPersonId;
    toPersonId = normalized.toPersonId;
    fromRoleLabel = normalized.fromRoleLabel ?? null;
    toRoleLabel = normalized.toRoleLabel ?? null;
  }

  const updated = await updateRelation(db, projectId, relationId, {
    fromPersonId,
    toPersonId,
    kind: nextKind,
    fromRoleLabel,
    toRoleLabel,
    sortOrder: input.sortOrder,
    note: input.note,
  });
  if (!updated) throw notFound();
  return updated;
}

async function applyAggregateNamesInTx(
  db: TxDatabase,
  organizationId: string,
  projectId: string,
  personId: string,
  names: NonNullable<UpdatePersonAggregateInput["names"]>,
): Promise<void> {
  for (const nameId of names.deleteIds ?? []) {
    await deletePersonNameInTx(db, projectId, personId, nameId);
  }
  for (const { id, ...patch } of names.update ?? []) {
    await updatePersonNameInTx(db, projectId, personId, id, patch);
  }
  for (const item of names.create ?? []) {
    await createPersonNameInTx(db, organizationId, projectId, personId, item);
  }
}

async function applyAggregateEventsInTx(
  db: TxDatabase,
  organizationId: string,
  projectId: string,
  personId: string,
  events: NonNullable<UpdatePersonAggregateInput["events"]>,
): Promise<void> {
  for (const eventId of events.deleteIds ?? []) {
    const deleted = await deletePersonEvent(db, projectId, personId, eventId);
    if (!deleted) throw notFound();
  }
  for (const { id, ...patch } of events.update ?? []) {
    const updated = await updatePersonEvent(db, projectId, personId, id, patch);
    if (!updated) throw notFound();
  }
  for (const item of events.create ?? []) {
    await createPersonEventInTx(db, organizationId, projectId, personId, item);
  }
}

async function applyAggregateRelationsInTx(
  db: TxDatabase,
  organizationId: string,
  projectId: string,
  personId: string,
  relations: NonNullable<UpdatePersonAggregateInput["relations"]>,
): Promise<void> {
  for (const relationId of relations.deleteIds ?? []) {
    const existing = await getRelation(db, projectId, relationId);
    if (
      !existing ||
      (existing.fromPersonId !== personId && existing.toPersonId !== personId)
    ) {
      throw notFound();
    }
    const deleted = await deleteRelation(db, projectId, relationId);
    if (!deleted) throw notFound();
  }
  for (const { id, ...patch } of relations.update ?? []) {
    await updateRelationInTx(db, projectId, id, patch, personId);
  }
  for (const item of relations.create ?? []) {
    if (item.fromPersonId !== personId && item.toPersonId !== personId) {
      throw validationError({
        relations: ["关系必须关联当前人物"],
      });
    }
    await createRelationInTx(db, organizationId, projectId, item);
  }
}

export async function updatePersonForProject(
  userId: string,
  projectId: string,
  personId: string,
  input: UpdatePersonInput,
): Promise<PersonView> {
  return withTenantTransaction({ userId }, async (db) => {
    await requireProjectMember(db, projectId, userId, "editor");
    const existingState = await getPersonLivingState(db, projectId, personId);
    if (!existingState) throw notFound();

    const { version, ...values } = input;
    assertLivingDeathConsistency(
      values.isLiving ?? existingState.isLiving,
      values.deathInfo === undefined
        ? existingState.deathInfo
        : values.deathInfo,
    );

    const { birthYear, deathYear } = resolveUpdateLifeYears(values);

    const updated = await casUpdatePerson(db, projectId, personId, version, {
      ...values,
      birthYear,
      deathYear,
    });
    if (updated) return updated;
    if (!(await personExistsInProject(db, projectId, personId))) {
      throw notFound();
    }
    throw versionConflict();
  });
}

export async function updatePersonAggregateForProject(
  userId: string,
  projectId: string,
  personId: string,
  input: UpdatePersonAggregateInput,
): Promise<{
  person: PersonView;
  relations: RelationView[];
  projection: ProjectionView | null;
}> {
  return withTenantTransaction({ userId }, async (db) => {
    const { organizationId } = await requireProjectMember(
      db,
      projectId,
      userId,
      "editor",
    );
    const existingState = await getPersonLivingState(db, projectId, personId);
    if (!existingState) throw notFound();

    const scalarValues = input.person ?? {};
    assertLivingDeathConsistency(
      scalarValues.isLiving ?? existingState.isLiving,
      scalarValues.deathInfo === undefined
        ? existingState.deathInfo
        : scalarValues.deathInfo,
    );

    const { birthYear, deathYear } = resolveUpdateLifeYears(scalarValues);
    const updated = await casUpdatePerson(
      db,
      projectId,
      personId,
      input.version,
      {
        ...scalarValues,
        birthYear,
        deathYear,
      },
    );
    if (!updated) {
      throw versionConflict();
    }

    if (input.names) {
      await applyAggregateNamesInTx(
        db,
        organizationId,
        projectId,
        personId,
        input.names,
      );
    }
    if (input.events) {
      await applyAggregateEventsInTx(
        db,
        organizationId,
        projectId,
        personId,
        input.events,
      );
    }
    if (input.relations) {
      await applyAggregateRelationsInTx(
        db,
        organizationId,
        projectId,
        personId,
        input.relations,
      );
    }

    const [person, relations, projection] = await Promise.all([
      getPerson(db, projectId, personId),
      listRelationsForPerson(db, projectId, personId),
      getProjectionForPerson(db, projectId, personId),
    ]);

    return {
      person: person ?? updated,
      relations,
      projection,
    };
  });
}

export async function createRelativeForProject(
  userId: string,
  projectId: string,
  input: CreateRelativeInput,
): Promise<{
  person: PersonView;
  companionPerson: PersonView | null;
  relations: RelationView[];
  anchorEvents: PersonEventView[];
}> {
  return withTenantTransaction({ userId }, async (db) => {
    const { organizationId } = await requireProjectMember(
      db,
      projectId,
      userId,
      "editor",
    );
    const anchor = await getPersonAnchorInfo(
      db,
      projectId,
      input.anchorPersonId,
    );
    if (!anchor) throw notFound();

    const createdPerson = await createPersonInTx(
      db,
      organizationId,
      projectId,
      {
        ...input.person,
        lineageId: input.person.lineageId ?? anchor.lineageId,
      },
    );

    for (const item of input.names ?? []) {
      await createPersonNameInTx(
        db,
        organizationId,
        projectId,
        createdPerson.id,
        item,
      );
    }

    for (const item of input.events ?? []) {
      await createPersonEventInTx(
        db,
        organizationId,
        projectId,
        createdPerson.id,
        item,
      );
    }

    const createdRelations: RelationView[] = [];
    for (const rel of input.relations) {
      const otherPersonId = rel.otherPersonId ?? input.anchorPersonId;
      const fromPersonId =
        rel.direction === "new_to_other" ? createdPerson.id : otherPersonId;
      const toPersonId =
        rel.direction === "new_to_other" ? otherPersonId : createdPerson.id;
      createdRelations.push(
        await createRelationInTx(db, organizationId, projectId, {
          fromPersonId,
          toPersonId,
          kind: rel.kind,
          fromRoleLabel: rel.fromRoleLabel,
          toRoleLabel: rel.toRoleLabel,
          sortOrder: rel.sortOrder,
          note: rel.note,
        }),
      );
    }

    let companionPerson: PersonView | null = null;
    if (input.companion) {
      companionPerson = await createPersonInTx(db, organizationId, projectId, {
        ...input.companion.person,
        lineageId: input.companion.person.lineageId ?? createdPerson.lineageId,
      });
      if (input.companion.spouseRelation) {
        createdRelations.push(
          await createRelationInTx(db, organizationId, projectId, {
            fromPersonId: input.anchorPersonId,
            toPersonId: companionPerson.id,
            kind: "spouse",
            fromRoleLabel: input.companion.spouseRelation.fromRoleLabel,
            toRoleLabel: input.companion.spouseRelation.toRoleLabel,
            sortOrder: input.companion.spouseRelation.sortOrder,
          }),
        );
      }
      createdRelations.push(
        await createRelationInTx(db, organizationId, projectId, {
          fromPersonId: companionPerson.id,
          toPersonId: createdPerson.id,
          kind: input.companion.childRelation.kind,
          toRoleLabel: input.companion.childRelation.toRoleLabel,
        }),
      );
    }

    const anchorEvents: PersonEventView[] = [];
    for (const ev of input.anchorEvents ?? []) {
      anchorEvents.push(
        await createPersonEventInTx(
          db,
          organizationId,
          projectId,
          input.anchorPersonId,
          ev,
        ),
      );
    }

    const person =
      (await getPerson(db, projectId, createdPerson.id)) ?? createdPerson;

    return {
      person,
      companionPerson,
      relations: createdRelations,
      anchorEvents,
    };
  });
}

export async function deletePersonForProject(
  userId: string,
  projectId: string,
  personId: string,
): Promise<void> {
  await withTenantTransaction({ userId }, async (db) => {
    await requireProjectMember(db, projectId, userId, "editor");
    const ok = await deletePerson(db, projectId, personId);
    if (!ok) throw notFound();
  });
}

export async function createPersonNameForProject(
  userId: string,
  projectId: string,
  personId: string,
  input: CreatePersonNameInput,
): Promise<PersonNameView> {
  return withTenantTransaction({ userId }, async (db) => {
    const { organizationId } = await requireProjectMember(
      db,
      projectId,
      userId,
      "editor",
    );
    return createPersonNameInTx(db, organizationId, projectId, personId, input);
  });
}

export async function updatePersonNameForProject(
  userId: string,
  projectId: string,
  personId: string,
  nameId: string,
  input: UpdatePersonNameInput,
): Promise<PersonNameView> {
  return withTenantTransaction({ userId }, async (db) => {
    await requireProjectMember(db, projectId, userId, "editor");
    return updatePersonNameInTx(db, projectId, personId, nameId, input);
  });
}

export async function deletePersonNameForProject(
  userId: string,
  projectId: string,
  personId: string,
  nameId: string,
): Promise<void> {
  await withTenantTransaction({ userId }, async (db) => {
    await requireProjectMember(db, projectId, userId, "editor");
    await deletePersonNameInTx(db, projectId, personId, nameId);
  });
}

export async function createRelationForProject(
  userId: string,
  projectId: string,
  input: CreateRelationInput,
): Promise<RelationView> {
  return withTenantTransaction({ userId }, async (db) => {
    const { organizationId } = await requireProjectMember(
      db,
      projectId,
      userId,
      "editor",
    );
    return createRelationInTx(db, organizationId, projectId, input);
  });
}

export async function updateRelationForProject(
  userId: string,
  projectId: string,
  relationId: string,
  input: UpdateRelationInput,
): Promise<RelationView> {
  return withTenantTransaction({ userId }, async (db) => {
    await requireProjectMember(db, projectId, userId, "editor");
    return updateRelationInTx(db, projectId, relationId, input);
  });
}

export async function deleteRelationForProject(
  userId: string,
  projectId: string,
  relationId: string,
): Promise<void> {
  await withTenantTransaction({ userId }, async (db) => {
    await requireProjectMember(db, projectId, userId, "editor");
    const deleted = await deleteRelation(db, projectId, relationId);
    if (!deleted) throw notFound();
  });
}

export async function createPersonEventForProject(
  userId: string,
  projectId: string,
  personId: string,
  input: CreatePersonEventInput,
): Promise<PersonEventView> {
  return withTenantTransaction({ userId }, async (db) => {
    const { organizationId } = await requireProjectMember(
      db,
      projectId,
      userId,
      "editor",
    );
    return createPersonEventInTx(
      db,
      organizationId,
      projectId,
      personId,
      input,
    );
  });
}

export async function updatePersonEventForProject(
  userId: string,
  projectId: string,
  personId: string,
  eventId: string,
  input: UpdatePersonEventInput,
): Promise<PersonEventView> {
  return withTenantTransaction({ userId }, async (db) => {
    await requireProjectMember(db, projectId, userId, "editor");
    const updated = await updatePersonEvent(
      db,
      projectId,
      personId,
      eventId,
      input,
    );
    if (!updated) throw notFound();
    return updated;
  });
}

export async function deletePersonEventForProject(
  userId: string,
  projectId: string,
  personId: string,
  eventId: string,
): Promise<void> {
  await withTenantTransaction({ userId }, async (db) => {
    await requireProjectMember(db, projectId, userId, "editor");
    const deleted = await deletePersonEvent(db, projectId, personId, eventId);
    if (!deleted) throw notFound();
  });
}

export async function getSubgraphForProject(
  userId: string,
  projectId: string,
  query: SubgraphQueryInput,
) {
  return withTenantTransaction({ userId, readOnly: true }, async (db) => {
    const { organizationId } = await requireProjectMember(
      db,
      projectId,
      userId,
      null,
    );
    const graph = await querySubgraph(db, organizationId, projectId, {
      rootPersonId: query.rootPersonId,
      upDepth: query.upDepth ?? 2,
      downDepth: query.downDepth ?? 4,
      limit: query.limit ?? 300,
    });
    if (!graph) throw notFound();
    return graph;
  });
}
