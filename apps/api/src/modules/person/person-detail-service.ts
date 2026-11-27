import type {
  ApiRelationKind,
  CreatePersonEventInput,
  CreatePersonNameInput,
  CreateRelationInput,
  UpdatePersonEventInput,
  UpdatePersonNameInput,
  UpdateRelationInput,
} from "@yunpu/shared";
import { requireProjectMember } from "../../access";
import {
  type TxDatabase,
  withTenantTransaction,
} from "../../db/with-tenant-transaction";
import { conflict, notFound } from "../../lib/errors";
import {
  clearPrimaryPersonName,
  deletePersonEvent,
  deletePersonName,
  getPersonName,
  insertPersonEvent,
  insertPersonName,
  updatePersonEvent,
  updatePersonName,
} from "./name-event-queries";
import { countPersonsInProject, personExistsInProject } from "./person-queries";
import type {
  PersonEventView,
  PersonNameView,
  RelationView,
} from "./person-views";
import {
  deleteRelation,
  getRelation,
  insertRelation,
  updateRelation,
} from "./relation-queries";

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

export async function updatePersonNameInTx(
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

export async function deletePersonNameInTx(
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

export async function updateRelationInTx(
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
