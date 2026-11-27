import {
  lineage,
  lineageProjection,
  person,
  personEvent,
  personName,
  personRelation,
} from "@yunpu/db";
import type {
  ApiRelationKind,
  GenealogyDateInput,
  GenealogyPlaceInput,
  PersonBirthInfoInput,
  PersonDeathInfoInput,
  PersonEventType,
  PersonNameKind,
  PersonSex,
} from "@yunpu/shared";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import type { TxDatabase } from "../../db/with-tenant-transaction";
import { parseUuidCursor, sliceCursorPage } from "../../lib/pagination";
import { isoTimestamp as timestamp } from "../../lib/sql";

export type PersonNameView = {
  id: string;
  projectId: string;
  personId: string;
  kind: PersonNameKind;
  value: string;
  surname: string | null;
  romanizedSurname: string | null;
  romanizedName: string | null;
  label: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PersonEventView = {
  id: string;
  projectId: string;
  personId: string;
  type: PersonEventType;
  structuredDate: GenealogyDateInput | null;
  structuredPlace: GenealogyPlaceInput | null;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type PersonView = {
  id: string;
  projectId: string;
  lineageId: string;
  displayName: string;
  sex: PersonSex;
  surname: string | null;
  givenName: string | null;
  romanizedSurname: string | null;
  romanizedName: string | null;
  romanizedSuffix: string | null;
  birthYear: number | null;
  deathYear: number | null;
  isLiving: boolean;
  birthInfo: PersonBirthInfoInput | null;
  deathInfo: PersonDeathInfoInput | null;
  generationWord: string | null;
  relationTitle: string | null;
  siblingOrder: number | null;
  biography: string | null;
  notes: string | null;
  avatarKey: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  names?: PersonNameView[];
  events?: PersonEventView[];
};

export type RelationView = {
  id: string;
  projectId: string;
  fromPersonId: string;
  toPersonId: string;
  kind: ApiRelationKind | string;
  fromRoleLabel: string | null;
  toRoleLabel: string | null;
  sortOrder: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectionView = {
  personId: string;
  primaryPath: string;
  generation: number;
};

const personBaseColumns = {
  id: person.id,
  projectId: person.projectId,
  lineageId: person.lineageId,
  sex: person.sex,
  surname: person.surname,
  givenName: person.givenName,
  romanizedSurname: person.romanizedSurname,
  romanizedName: person.romanizedName,
  romanizedSuffix: person.romanizedSuffix,
  birthYear: person.birthYear,
  deathYear: person.deathYear,
  isLiving: person.isLiving,
  birthInfo: person.birthInfo,
  deathInfo: person.deathInfo,
  generationWord: person.generationWord,
  relationTitle: person.relationTitle,
  siblingOrder: person.siblingOrder,
  biography: person.biography,
  notes: person.notes,
  avatarKey: person.avatarKey,
  version: person.version,
  createdAt: timestamp(person.createdAt),
  updatedAt: timestamp(person.updatedAt),
};

const personNameColumns = {
  id: personName.id,
  projectId: personName.projectId,
  personId: personName.personId,
  kind: personName.kind,
  value: personName.value,
  surname: personName.surname,
  romanizedSurname: personName.romanizedSurname,
  romanizedName: personName.romanizedName,
  label: personName.label,
  isPrimary: personName.isPrimary,
  createdAt: timestamp(personName.createdAt),
  updatedAt: timestamp(personName.updatedAt),
};

const personEventColumns = {
  id: personEvent.id,
  projectId: personEvent.projectId,
  personId: personEvent.personId,
  type: personEvent.type,
  structuredDate: personEvent.structuredDate,
  structuredPlace: personEvent.structuredPlace,
  description: personEvent.description,
  sortOrder: personEvent.sortOrder,
  createdAt: timestamp(personEvent.createdAt),
  updatedAt: timestamp(personEvent.updatedAt),
};

const relationColumns = {
  id: personRelation.id,
  projectId: personRelation.projectId,
  fromPersonId: personRelation.fromPersonId,
  toPersonId: personRelation.toPersonId,
  kind: personRelation.kind,
  fromRoleLabel: personRelation.fromRoleLabel,
  toRoleLabel: personRelation.toRoleLabel,
  sortOrder: personRelation.sortOrder,
  note: personRelation.note,
  createdAt: timestamp(personRelation.createdAt),
  updatedAt: timestamp(personRelation.updatedAt),
};

function mapPersonRow(row: {
  id: string;
  projectId: string;
  lineageId: string;
  displayName: string;
  sex: PersonSex;
  surname: string | null;
  givenName: string | null;
  romanizedSurname: string | null;
  romanizedName: string | null;
  romanizedSuffix: string | null;
  birthYear: number | null;
  deathYear: number | null;
  isLiving: boolean;
  birthInfo: unknown;
  deathInfo: unknown;
  generationWord: string | null;
  relationTitle: string | null;
  siblingOrder: number | null;
  biography: string | null;
  notes: string | null;
  avatarKey: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}): PersonView {
  return {
    ...row,
    birthInfo: (row.birthInfo as PersonBirthInfoInput | null) ?? null,
    deathInfo: (row.deathInfo as PersonDeathInfoInput | null) ?? null,
  };
}

function mapEventRow(row: {
  id: string;
  projectId: string;
  personId: string;
  type: PersonEventType;
  structuredDate: unknown;
  structuredPlace: unknown;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}): PersonEventView {
  return {
    ...row,
    structuredDate: (row.structuredDate as GenealogyDateInput | null) ?? null,
    structuredPlace:
      (row.structuredPlace as GenealogyPlaceInput | null) ?? null,
  };
}

export async function lineageExistsInProject(
  db: TxDatabase,
  projectId: string,
  lineageId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: lineage.id })
    .from(lineage)
    .where(and(eq(lineage.projectId, projectId), eq(lineage.id, lineageId)))
    .limit(1);
  return rows.length > 0;
}

export async function resolveOrCreateDefaultLineageId(
  db: TxDatabase,
  organizationId: string,
  projectId: string,
): Promise<string> {
  const existing = await db
    .select({ id: lineage.id })
    .from(lineage)
    .where(eq(lineage.projectId, projectId))
    .orderBy(asc(lineage.seq), asc(lineage.createdAt), asc(lineage.id))
    .limit(1);
  if (existing[0]) return existing[0].id;

  const inserted = await db
    .insert(lineage)
    .values({
      organizationId,
      projectId,
      name: "主世系",
    })
    .returning({ id: lineage.id });
  return inserted[0].id;
}

async function hydratePersonsDetails(
  db: TxDatabase,
  projectId: string,
  persons: PersonView[],
): Promise<PersonView[]> {
  if (persons.length === 0) return [];
  const personIds = persons.map((item) => item.id);
  const [nameRows, eventRows] = await Promise.all([
    db
      .select(personNameColumns)
      .from(personName)
      .where(
        and(
          eq(personName.projectId, projectId),
          inArray(personName.personId, personIds),
        ),
      )
      .orderBy(asc(personName.createdAt), asc(personName.id)),
    db
      .select(personEventColumns)
      .from(personEvent)
      .where(
        and(
          eq(personEvent.projectId, projectId),
          inArray(personEvent.personId, personIds),
        ),
      )
      .orderBy(asc(personEvent.sortOrder), asc(personEvent.createdAt)),
  ]);

  const namesByPerson = new Map<string, PersonNameView[]>();
  for (const row of nameRows) {
    const list = namesByPerson.get(row.personId) ?? [];
    list.push(row);
    namesByPerson.set(row.personId, list);
  }

  const eventsByPerson = new Map<string, PersonEventView[]>();
  for (const row of eventRows) {
    const list = eventsByPerson.get(row.personId) ?? [];
    list.push(mapEventRow(row));
    eventsByPerson.set(row.personId, list);
  }

  return persons.map((item) => ({
    ...item,
    names: namesByPerson.get(item.id) ?? [],
    events: eventsByPerson.get(item.id) ?? [],
  }));
}

async function loadPersonView(
  db: TxDatabase,
  projectId: string,
  personId: string,
  includeDetails = false,
): Promise<PersonView | null> {
  const rows = await db
    .select({
      ...personBaseColumns,
      displayName: personName.value,
    })
    .from(person)
    .innerJoin(
      personName,
      and(
        eq(personName.projectId, person.projectId),
        eq(personName.personId, person.id),
        eq(personName.isPrimary, true),
      ),
    )
    .where(and(eq(person.projectId, projectId), eq(person.id, personId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const base = mapPersonRow(row);
  if (!includeDetails) return base;
  const hydrated = await hydratePersonsDetails(db, projectId, [base]);
  return hydrated[0] ?? base;
}

export async function getPerson(
  db: TxDatabase,
  projectId: string,
  personId: string,
): Promise<PersonView | null> {
  return loadPersonView(db, projectId, personId, true);
}

export type ListPageOptions = {
  lineageId?: string;
  cursor?: string;
  limit: number;
};

export async function listPersons(
  db: TxDatabase,
  organizationId: string,
  projectId: string,
  options: ListPageOptions,
): Promise<{ persons: PersonView[]; nextCursor: string | null }> {
  const conditions = [
    eq(person.organizationId, organizationId),
    eq(person.projectId, projectId),
  ];
  if (options.lineageId) {
    conditions.push(eq(person.lineageId, options.lineageId));
  }
  if (options.cursor) {
    conditions.push(gt(person.id, parseUuidCursor(options.cursor)));
  }
  const rows = await db
    .select({
      ...personBaseColumns,
      displayName: personName.value,
    })
    .from(person)
    .innerJoin(
      personName,
      and(
        eq(personName.organizationId, person.organizationId),
        eq(personName.projectId, person.projectId),
        eq(personName.personId, person.id),
        eq(personName.isPrimary, true),
      ),
    )
    .where(and(...conditions))
    .orderBy(person.id)
    .limit(options.limit + 1);
  const page = sliceCursorPage(rows, options.limit, (last) => last.id);
  return {
    persons: page.items.map(mapPersonRow),
    nextCursor: page.nextCursor,
  };
}

export type CreatePersonValues = {
  lineageId: string;
  displayName: string;
  sex?: PersonSex;
  surname?: string;
  givenName?: string;
  romanizedSurname?: string;
  romanizedName?: string;
  romanizedSuffix?: string;
  birthYear?: number;
  deathYear?: number;
  isLiving?: boolean;
  birthInfo?: PersonBirthInfoInput;
  deathInfo?: PersonDeathInfoInput;
  generationWord?: string;
  relationTitle?: string;
  siblingOrder?: number;
  biography?: string;
  notes?: string;
  avatarKey?: string;
};

export async function insertPerson(
  db: TxDatabase,
  organizationId: string,
  projectId: string,
  values: CreatePersonValues,
): Promise<PersonView> {
  const sex = values.sex ?? "unknown";
  const surname = values.surname ?? null;
  const givenName = values.givenName ?? null;
  const romanizedSurname = values.romanizedSurname ?? null;
  const romanizedName = values.romanizedName ?? null;
  const romanizedSuffix = values.romanizedSuffix ?? null;
  const birthYear = values.birthYear ?? null;
  const deathYear = values.deathYear ?? null;
  const isLiving = values.isLiving ?? true;
  const birthInfo = values.birthInfo ?? null;
  const deathInfo = values.deathInfo ?? null;
  const generationWord = values.generationWord ?? null;
  const relationTitle = values.relationTitle ?? null;
  const siblingOrder = values.siblingOrder ?? null;
  const biography = values.biography ?? null;
  const notes = values.notes ?? null;
  const avatarKey = values.avatarKey ?? null;

  const executed = await db.execute<PersonView>(sql`
    WITH inserted_person AS (
      INSERT INTO person (
        organization_id, project_id, lineage_id, sex, surname, given_name,
        romanized_surname, romanized_name, romanized_suffix,
        birth_year, death_year, is_living, birth_info, death_info,
        generation_word, relation_title, sibling_order, biography, notes, avatar_key
      )
      VALUES (
        ${organizationId}::uuid,
        ${projectId}::uuid,
        ${values.lineageId}::uuid,
        ${sex},
        ${surname},
        ${givenName},
        ${romanizedSurname},
        ${romanizedName},
        ${romanizedSuffix},
        ${birthYear},
        ${deathYear},
        ${isLiving},
        ${birthInfo ? JSON.stringify(birthInfo) : null}::jsonb,
        ${deathInfo ? JSON.stringify(deathInfo) : null}::jsonb,
        ${generationWord},
        ${relationTitle},
        ${siblingOrder},
        ${biography},
        ${notes},
        ${avatarKey}
      )
      RETURNING
        id, project_id, lineage_id, sex, surname, given_name,
        romanized_surname, romanized_name, romanized_suffix,
        birth_year, death_year, is_living, birth_info, death_info,
        generation_word, relation_title, sibling_order, biography, notes, avatar_key,
        version, created_at, updated_at
    ),
    inserted_name AS (
      INSERT INTO person_name (
        organization_id, project_id, person_id, kind, value,
        surname, romanized_surname, romanized_name, is_primary
      )
      SELECT
        ${organizationId}::uuid,
        ${projectId}::uuid,
        ip.id,
        'formal',
        ${values.displayName},
        ${surname},
        ${romanizedSurname},
        ${romanizedName},
        true
      FROM inserted_person ip
      RETURNING id, project_id, person_id, kind, value, surname, romanized_surname, romanized_name, label, is_primary, created_at, updated_at
    )
    SELECT
      ip.id,
      ip.project_id AS "projectId",
      ip.lineage_id AS "lineageId",
      inm.value AS "displayName",
      ip.sex,
      ip.surname,
      ip.given_name AS "givenName",
      ip.romanized_surname AS "romanizedSurname",
      ip.romanized_name AS "romanizedName",
      ip.romanized_suffix AS "romanizedSuffix",
      ip.birth_year AS "birthYear",
      ip.death_year AS "deathYear",
      ip.is_living AS "isLiving",
      ip.birth_info AS "birthInfo",
      ip.death_info AS "deathInfo",
      ip.generation_word AS "generationWord",
      ip.relation_title AS "relationTitle",
      ip.sibling_order AS "siblingOrder",
      ip.biography,
      ip.notes,
      ip.avatar_key AS "avatarKey",
      ip.version,
      to_char(ip.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt",
      to_char(ip.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "updatedAt"
    FROM inserted_person ip
    JOIN inserted_name inm ON inm.person_id = ip.id
  `);
  const rows = (executed as unknown as { rows: PersonView[] }).rows;
  const view = rows[0];
  if (!view) throw new Error("person insert failed");
  const hydrated = await hydratePersonsDetails(db, projectId, [view]);
  return hydrated[0] ?? view;
}

export type UpdatePersonValues = {
  displayName?: string;
  sex?: PersonSex;
  surname?: string | null;
  givenName?: string | null;
  romanizedSurname?: string | null;
  romanizedName?: string | null;
  romanizedSuffix?: string | null;
  birthYear?: number | null;
  deathYear?: number | null;
  isLiving?: boolean;
  birthInfo?: PersonBirthInfoInput | null;
  deathInfo?: PersonDeathInfoInput | null;
  generationWord?: string | null;
  relationTitle?: string | null;
  siblingOrder?: number | null;
  biography?: string | null;
  notes?: string | null;
  avatarKey?: string | null;
};

export async function getPersonLivingState(
  db: TxDatabase,
  projectId: string,
  personId: string,
): Promise<{
  isLiving: boolean;
  deathInfo: PersonDeathInfoInput | null;
} | null> {
  const rows = await db
    .select({ isLiving: person.isLiving, deathInfo: person.deathInfo })
    .from(person)
    .where(and(eq(person.projectId, projectId), eq(person.id, personId)))
    .limit(1);
  if (!rows[0]) return null;
  return {
    isLiving: rows[0].isLiving,
    deathInfo: (rows[0].deathInfo as PersonDeathInfoInput | null) ?? null,
  };
}

export async function casUpdatePerson(
  db: TxDatabase,
  projectId: string,
  personId: string,
  expectedVersion: number,
  values: UpdatePersonValues,
): Promise<PersonView | null> {
  const set: Record<string, unknown> = {
    version: sql`${person.version} + 1`,
    updatedAt: sql`clock_timestamp()`,
  };
  if (values.sex !== undefined) set.sex = values.sex;
  if (values.surname !== undefined) set.surname = values.surname;
  if (values.givenName !== undefined) set.givenName = values.givenName;
  if (values.romanizedSurname !== undefined)
    set.romanizedSurname = values.romanizedSurname;
  if (values.romanizedName !== undefined)
    set.romanizedName = values.romanizedName;
  if (values.romanizedSuffix !== undefined)
    set.romanizedSuffix = values.romanizedSuffix;
  if (values.birthYear !== undefined) set.birthYear = values.birthYear;
  if (values.deathYear !== undefined) set.deathYear = values.deathYear;
  if (values.isLiving !== undefined) set.isLiving = values.isLiving;
  if (values.birthInfo !== undefined) set.birthInfo = values.birthInfo;
  if (values.deathInfo !== undefined) set.deathInfo = values.deathInfo;
  if (values.generationWord !== undefined)
    set.generationWord = values.generationWord;
  if (values.relationTitle !== undefined)
    set.relationTitle = values.relationTitle;
  if (values.siblingOrder !== undefined) set.siblingOrder = values.siblingOrder;
  if (values.biography !== undefined) set.biography = values.biography;
  if (values.notes !== undefined) set.notes = values.notes;
  if (values.avatarKey !== undefined) set.avatarKey = values.avatarKey;

  const whereClause = and(
    eq(person.projectId, projectId),
    eq(person.id, personId),
    eq(person.version, expectedVersion),
  );

  const rows = await db
    .update(person)
    .set(set)
    .where(whereClause)
    .returning({
      ...personBaseColumns,
      displayName: sql<string>`(
        SELECT pn.value FROM person_name pn
         WHERE pn.project_id = ${person.projectId}
           AND pn.person_id = ${person.id}
           AND pn.is_primary = true
         LIMIT 1
      )`,
    });
  const updated = rows[0];
  if (!updated) return null;

  if (
    values.displayName !== undefined ||
    values.surname !== undefined ||
    values.romanizedSurname !== undefined ||
    values.romanizedName !== undefined
  ) {
    const primarySet: Record<string, unknown> = {
      updatedAt: sql`clock_timestamp()`,
    };
    if (values.displayName !== undefined) primarySet.value = values.displayName;
    if (values.surname !== undefined) primarySet.surname = values.surname;
    if (values.romanizedSurname !== undefined)
      primarySet.romanizedSurname = values.romanizedSurname;
    if (values.romanizedName !== undefined)
      primarySet.romanizedName = values.romanizedName;

    await db
      .update(personName)
      .set(primarySet)
      .where(
        and(
          eq(personName.projectId, projectId),
          eq(personName.personId, personId),
          eq(personName.isPrimary, true),
        ),
      );
  }

  const base = mapPersonRow({
    ...updated,
    displayName: values.displayName ?? updated.displayName,
  });
  const hydrated = await hydratePersonsDetails(db, projectId, [base]);
  return hydrated[0] ?? base;
}

export async function deletePerson(
  db: TxDatabase,
  projectId: string,
  personId: string,
): Promise<boolean> {
  const rows = await db
    .delete(person)
    .where(and(eq(person.projectId, projectId), eq(person.id, personId)))
    .returning({ id: person.id });
  return rows.length > 0;
}

export async function personExistsInProject(
  db: TxDatabase,
  projectId: string,
  personId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: person.id })
    .from(person)
    .where(and(eq(person.projectId, projectId), eq(person.id, personId)))
    .limit(1);
  return rows.length > 0;
}

export async function countPersonsInProject(
  db: TxDatabase,
  projectId: string,
  personIds: string[],
): Promise<number> {
  const rows = await db
    .select({ id: person.id })
    .from(person)
    .where(and(eq(person.projectId, projectId), inArray(person.id, personIds)));
  return rows.length;
}

export async function clearPrimaryPersonName(
  db: TxDatabase,
  projectId: string,
  personId: string,
): Promise<void> {
  await db
    .update(personName)
    .set({ isPrimary: false, updatedAt: sql`clock_timestamp()` })
    .where(
      and(
        eq(personName.projectId, projectId),
        eq(personName.personId, personId),
        eq(personName.isPrimary, true),
      ),
    );
}

export async function insertPersonName(
  db: TxDatabase,
  organizationId: string,
  projectId: string,
  personId: string,
  values: {
    kind: PersonNameKind;
    value: string;
    surname?: string | null;
    romanizedSurname?: string | null;
    romanizedName?: string | null;
    label?: string | null;
    isPrimary?: boolean;
  },
): Promise<PersonNameView> {
  const rows = await db
    .insert(personName)
    .values({
      organizationId,
      projectId,
      personId,
      kind: values.kind,
      value: values.value,
      surname: values.surname ?? null,
      romanizedSurname: values.romanizedSurname ?? null,
      romanizedName: values.romanizedName ?? null,
      label: values.label ?? null,
      isPrimary: values.isPrimary ?? false,
    })
    .returning(personNameColumns);
  return rows[0];
}

export async function getPersonName(
  db: TxDatabase,
  projectId: string,
  personId: string,
  nameId: string,
): Promise<PersonNameView | null> {
  const rows = await db
    .select(personNameColumns)
    .from(personName)
    .where(
      and(
        eq(personName.projectId, projectId),
        eq(personName.personId, personId),
        eq(personName.id, nameId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function updatePersonName(
  db: TxDatabase,
  projectId: string,
  personId: string,
  nameId: string,
  values: {
    kind?: PersonNameKind;
    value?: string;
    surname?: string | null;
    romanizedSurname?: string | null;
    romanizedName?: string | null;
    label?: string | null;
    isPrimary?: boolean;
  },
): Promise<PersonNameView | null> {
  const set: Record<string, unknown> = {
    updatedAt: sql`clock_timestamp()`,
  };
  if (values.kind !== undefined) set.kind = values.kind;
  if (values.value !== undefined) set.value = values.value;
  if (values.surname !== undefined) set.surname = values.surname;
  if (values.romanizedSurname !== undefined)
    set.romanizedSurname = values.romanizedSurname;
  if (values.romanizedName !== undefined)
    set.romanizedName = values.romanizedName;
  if (values.label !== undefined) set.label = values.label;
  if (values.isPrimary !== undefined) set.isPrimary = values.isPrimary;

  const rows = await db
    .update(personName)
    .set(set)
    .where(
      and(
        eq(personName.projectId, projectId),
        eq(personName.personId, personId),
        eq(personName.id, nameId),
      ),
    )
    .returning(personNameColumns);
  return rows[0] ?? null;
}

export async function deletePersonName(
  db: TxDatabase,
  projectId: string,
  personId: string,
  nameId: string,
): Promise<boolean> {
  const rows = await db
    .delete(personName)
    .where(
      and(
        eq(personName.projectId, projectId),
        eq(personName.personId, personId),
        eq(personName.id, nameId),
      ),
    )
    .returning({ id: personName.id });
  return rows.length > 0;
}

export async function insertRelation(
  db: TxDatabase,
  organizationId: string,
  projectId: string,
  values: {
    fromPersonId: string;
    toPersonId: string;
    kind: ApiRelationKind;
    fromRoleLabel?: string | null;
    toRoleLabel?: string | null;
    sortOrder?: number | null;
    note?: string | null;
  },
): Promise<RelationView> {
  const rows = await db
    .insert(personRelation)
    .values({
      organizationId,
      projectId,
      fromPersonId: values.fromPersonId,
      toPersonId: values.toPersonId,
      kind: values.kind,
      fromRoleLabel: values.fromRoleLabel ?? null,
      toRoleLabel: values.toRoleLabel ?? null,
      sortOrder: values.sortOrder ?? null,
      note: values.note ?? null,
    })
    .returning(relationColumns);
  return rows[0];
}

export async function getRelation(
  db: TxDatabase,
  projectId: string,
  relationId: string,
): Promise<RelationView | null> {
  const rows = await db
    .select(relationColumns)
    .from(personRelation)
    .where(
      and(
        eq(personRelation.projectId, projectId),
        eq(personRelation.id, relationId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function updateRelation(
  db: TxDatabase,
  projectId: string,
  relationId: string,
  values: {
    fromPersonId?: string;
    toPersonId?: string;
    kind?: ApiRelationKind;
    fromRoleLabel?: string | null;
    toRoleLabel?: string | null;
    sortOrder?: number | null;
    note?: string | null;
  },
): Promise<RelationView | null> {
  const set: Record<string, unknown> = {
    updatedAt: sql`clock_timestamp()`,
  };
  if (values.fromPersonId !== undefined) set.fromPersonId = values.fromPersonId;
  if (values.toPersonId !== undefined) set.toPersonId = values.toPersonId;
  if (values.kind !== undefined) set.kind = values.kind;
  if (values.fromRoleLabel !== undefined)
    set.fromRoleLabel = values.fromRoleLabel;
  if (values.toRoleLabel !== undefined) set.toRoleLabel = values.toRoleLabel;
  if (values.sortOrder !== undefined) set.sortOrder = values.sortOrder;
  if (values.note !== undefined) set.note = values.note;

  const rows = await db
    .update(personRelation)
    .set(set)
    .where(
      and(
        eq(personRelation.projectId, projectId),
        eq(personRelation.id, relationId),
      ),
    )
    .returning(relationColumns);
  return rows[0] ?? null;
}

export async function deleteRelation(
  db: TxDatabase,
  projectId: string,
  relationId: string,
): Promise<boolean> {
  const rows = await db
    .delete(personRelation)
    .where(
      and(
        eq(personRelation.projectId, projectId),
        eq(personRelation.id, relationId),
      ),
    )
    .returning({ id: personRelation.id });
  return rows.length > 0;
}

export async function insertPersonEvent(
  db: TxDatabase,
  organizationId: string,
  projectId: string,
  personId: string,
  values: {
    type: PersonEventType;
    structuredDate?: GenealogyDateInput | null;
    structuredPlace?: GenealogyPlaceInput | null;
    description?: string | null;
    sortOrder?: number;
  },
): Promise<PersonEventView> {
  const rows = await db
    .insert(personEvent)
    .values({
      organizationId,
      projectId,
      personId,
      type: values.type,
      structuredDate: values.structuredDate ?? null,
      structuredPlace: values.structuredPlace ?? null,
      description: values.description ?? null,
      sortOrder: values.sortOrder ?? 0,
    })
    .returning(personEventColumns);
  return mapEventRow(rows[0]);
}

export async function updatePersonEvent(
  db: TxDatabase,
  projectId: string,
  personId: string,
  eventId: string,
  values: {
    type?: PersonEventType;
    structuredDate?: GenealogyDateInput | null;
    structuredPlace?: GenealogyPlaceInput | null;
    description?: string | null;
    sortOrder?: number;
  },
): Promise<PersonEventView | null> {
  const set: Record<string, unknown> = {
    updatedAt: sql`clock_timestamp()`,
  };
  if (values.type !== undefined) set.type = values.type;
  if (values.structuredDate !== undefined)
    set.structuredDate = values.structuredDate;
  if (values.structuredPlace !== undefined)
    set.structuredPlace = values.structuredPlace;
  if (values.description !== undefined) set.description = values.description;
  if (values.sortOrder !== undefined) set.sortOrder = values.sortOrder;

  const rows = await db
    .update(personEvent)
    .set(set)
    .where(
      and(
        eq(personEvent.projectId, projectId),
        eq(personEvent.personId, personId),
        eq(personEvent.id, eventId),
      ),
    )
    .returning(personEventColumns);
  return rows[0] ? mapEventRow(rows[0]) : null;
}

export async function deletePersonEvent(
  db: TxDatabase,
  projectId: string,
  personId: string,
  eventId: string,
): Promise<boolean> {
  const rows = await db
    .delete(personEvent)
    .where(
      and(
        eq(personEvent.projectId, projectId),
        eq(personEvent.personId, personId),
        eq(personEvent.id, eventId),
      ),
    )
    .returning({ id: personEvent.id });
  return rows.length > 0;
}

export async function queryLineageGraphData(
  db: TxDatabase,
  organizationId: string,
  projectId: string,
  lineageId: string,
): Promise<{
  persons: PersonView[];
  relations: RelationView[];
  projections: ProjectionView[];
}> {
  const personRows = await db
    .select({
      ...personBaseColumns,
      displayName: personName.value,
    })
    .from(person)
    .innerJoin(
      personName,
      and(
        eq(personName.organizationId, person.organizationId),
        eq(personName.projectId, person.projectId),
        eq(personName.personId, person.id),
        eq(personName.isPrimary, true),
      ),
    )
    .where(
      and(
        eq(person.organizationId, organizationId),
        eq(person.projectId, projectId),
        eq(person.lineageId, lineageId),
      ),
    )
    .orderBy(asc(person.siblingOrder), asc(person.createdAt), asc(person.id));

  const persons = await hydratePersonsDetails(
    db,
    projectId,
    personRows.map(mapPersonRow),
  );
  if (persons.length === 0) {
    return { persons: [], relations: [], projections: [] };
  }

  const personIds = persons.map((item) => item.id);
  const [relations, projectionRows] = await Promise.all([
    db
      .select(relationColumns)
      .from(personRelation)
      .where(
        and(
          eq(personRelation.organizationId, organizationId),
          eq(personRelation.projectId, projectId),
          inArray(personRelation.fromPersonId, personIds),
          inArray(personRelation.toPersonId, personIds),
        ),
      )
      .orderBy(asc(personRelation.sortOrder), asc(personRelation.createdAt)),
    db
      .select({
        personId: lineageProjection.personId,
        primaryPath: sql<string>`${lineageProjection.primaryPath}::text`,
        generation: lineageProjection.generation,
      })
      .from(lineageProjection)
      .where(
        and(
          eq(lineageProjection.organizationId, organizationId),
          eq(lineageProjection.projectId, projectId),
          inArray(lineageProjection.personId, personIds),
        ),
      )
      .orderBy(
        asc(lineageProjection.generation),
        asc(lineageProjection.personId),
      ),
  ]);

  return { persons, relations, projections: projectionRows };
}

export type SubgraphResult = {
  rootPersonId: string;
  persons: PersonView[];
  relations: RelationView[];
  hasMoreAncestors: boolean;
  hasMoreDescendants: boolean;
};

export async function querySubgraph(
  db: TxDatabase,
  organizationId: string,
  projectId: string,
  options: {
    rootPersonId: string;
    upDepth: number;
    downDepth: number;
    limit: number;
  },
): Promise<SubgraphResult | null> {
  type Payload = {
    root_ok: boolean;
    persons: PersonView[] | null;
    relations: RelationView[] | null;
    has_more_ancestors: boolean;
    has_more_descendants: boolean;
  };

  const executed = await db.execute(sql`
    WITH RECURSIVE
    root_path AS (
      SELECT lp.person_id, lp.primary_path, lp.generation
        FROM lineage_projection lp
       WHERE lp.organization_id = ${organizationId}::uuid
         AND lp.project_id = ${projectId}::uuid
         AND lp.person_id = ${options.rootPersonId}::uuid
    ),
    ancestors AS (
      SELECT ${options.rootPersonId}::uuid AS person_id, 0 AS depth
      UNION ALL
      SELECT r.from_person_id, a.depth + 1
        FROM person_relation r
        JOIN ancestors a ON r.to_person_id = a.person_id
       WHERE r.organization_id = ${organizationId}::uuid
         AND r.project_id = ${projectId}::uuid
         AND r.kind IN ('biological_parent', 'adoptive_parent', 'ritual_heir')
         AND a.depth < ${options.upDepth}
    ),
    descendants AS (
      SELECT rp.person_id, 0 AS depth
        FROM root_path rp
      UNION ALL
      SELECT lp.person_id,
             (nlevel(lp.primary_path) - nlevel(rp.primary_path)) AS depth
        FROM lineage_projection lp
        JOIN root_path rp ON true
       WHERE lp.organization_id = ${organizationId}::uuid
         AND lp.project_id = ${projectId}::uuid
         AND ${options.downDepth} > 0
         AND lp.primary_path::text ~>=~ (rp.primary_path::text || '.')
         AND lp.primary_path::text ~<~ (rp.primary_path::text || '/')
         AND nlevel(lp.primary_path) <= nlevel(rp.primary_path) + ${options.downDepth}
    ),
    spouse_of_core AS (
      SELECT CASE
               WHEN r.from_person_id = c.person_id THEN r.to_person_id
               ELSE r.from_person_id
             END AS person_id
        FROM person_relation r
        JOIN (
          SELECT person_id FROM ancestors
          UNION
          SELECT person_id FROM descendants
        ) c ON c.person_id IN (r.from_person_id, r.to_person_id)
       WHERE r.organization_id = ${organizationId}::uuid
         AND r.project_id = ${projectId}::uuid
         AND r.kind IN ('spouse', 'partner')
    ),
    candidate AS (
      SELECT person_id, min(depth) AS depth, 'up'::text AS direction
        FROM ancestors
       GROUP BY person_id
      UNION ALL
      SELECT person_id, min(depth) AS depth, 'down'::text AS direction
        FROM descendants
       GROUP BY person_id
      UNION ALL
      SELECT person_id, 0 AS depth, 'spouse'::text AS direction
        FROM spouse_of_core
    ),
    ordered AS (
      SELECT DISTINCT ON (person_id) person_id, depth, direction
        FROM candidate
       ORDER BY person_id,
                CASE direction WHEN 'up' THEN 0 WHEN 'down' THEN 1 ELSE 2 END,
                depth
    ),
    limited AS (
      SELECT person_id, depth, direction
        FROM ordered
       ORDER BY
         CASE WHEN person_id = ${options.rootPersonId}::uuid THEN 0 ELSE 1 END,
         depth,
         person_id
       LIMIT ${options.limit}
    ),
    person_json AS (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
               'id', p.id,
               'projectId', p.project_id,
               'lineageId', p.lineage_id,
               'displayName', pn.value,
               'sex', p.sex,
               'surname', p.surname,
               'givenName', p.given_name,
               'romanizedSurname', p.romanized_surname,
               'romanizedName', p.romanized_name,
               'romanizedSuffix', p.romanized_suffix,
               'birthYear', p.birth_year,
               'deathYear', p.death_year,
               'isLiving', p.is_living,
               'birthInfo', p.birth_info,
               'deathInfo', p.death_info,
               'generationWord', p.generation_word,
               'relationTitle', p.relation_title,
               'siblingOrder', p.sibling_order,
               'biography', p.biography,
               'notes', p.notes,
               'avatarKey', p.avatar_key,
               'version', p.version,
               'createdAt', to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
               'updatedAt', to_char(p.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
             ) ORDER BY p.id), '[]'::jsonb) AS persons
        FROM limited l
        JOIN person p
          ON p.organization_id = ${organizationId}::uuid
         AND p.project_id = ${projectId}::uuid
         AND p.id = l.person_id
        JOIN person_name pn
          ON pn.organization_id = p.organization_id
         AND pn.project_id = p.project_id
         AND pn.person_id = p.id
         AND pn.is_primary
    ),
    relation_json AS (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
               'id', r.id,
               'projectId', r.project_id,
               'fromPersonId', r.from_person_id,
               'toPersonId', r.to_person_id,
               'kind', r.kind,
               'fromRoleLabel', r.from_role_label,
               'toRoleLabel', r.to_role_label,
               'sortOrder', r.sort_order,
               'note', r.note,
               'createdAt', to_char(r.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
               'updatedAt', to_char(r.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
             ) ORDER BY r.id), '[]'::jsonb) AS relations
        FROM person_relation r
       WHERE r.organization_id = ${organizationId}::uuid
         AND r.project_id = ${projectId}::uuid
         AND r.from_person_id IN (SELECT person_id FROM limited)
         AND r.to_person_id IN (SELECT person_id FROM limited)
    )
    SELECT
      EXISTS (SELECT 1 FROM root_path) AS root_ok,
      (SELECT persons FROM person_json) AS persons,
      (SELECT relations FROM relation_json) AS relations,
      (
        EXISTS (
          SELECT 1 FROM ancestors a
           WHERE a.depth = ${options.upDepth}
             AND ${options.upDepth} > 0
             AND EXISTS (
               SELECT 1 FROM person_relation r
                WHERE r.organization_id = ${organizationId}::uuid
                  AND r.project_id = ${projectId}::uuid
                  AND r.to_person_id = a.person_id
                  AND r.kind IN ('biological_parent', 'adoptive_parent', 'ritual_heir')
             )
        )
        OR (
          (SELECT count(*) FROM ordered) > ${options.limit}
          AND EXISTS (
            SELECT 1 FROM ordered o
             WHERE o.direction = 'up'
               AND o.person_id NOT IN (SELECT person_id FROM limited)
          )
        )
      ) AS has_more_ancestors,
      (
        EXISTS (
          SELECT 1
            FROM lineage_projection lp
            JOIN root_path rp ON true
           WHERE lp.organization_id = ${organizationId}::uuid
             AND lp.project_id = ${projectId}::uuid
             AND lp.primary_path::text ~>=~ (rp.primary_path::text || '.')
             AND lp.primary_path::text ~<~ (rp.primary_path::text || '/')
             AND nlevel(lp.primary_path) = nlevel(rp.primary_path) + ${options.downDepth}
             AND ${options.downDepth} > 0
             AND EXISTS (
               SELECT 1 FROM person_relation r
                WHERE r.organization_id = ${organizationId}::uuid
                  AND r.project_id = ${projectId}::uuid
                  AND r.from_person_id = lp.person_id
                  AND r.kind IN ('biological_parent', 'adoptive_parent', 'ritual_heir')
             )
        )
        OR (
          (SELECT count(*) FROM ordered) > ${options.limit}
          AND EXISTS (
            SELECT 1 FROM ordered o
             WHERE o.direction = 'down'
               AND o.person_id NOT IN (SELECT person_id FROM limited)
          )
        )
      ) AS has_more_descendants
  `);

  const row = (executed as unknown as { rows: Payload[] }).rows[0];
  if (!row?.root_ok) return null;

  return {
    rootPersonId: options.rootPersonId,
    persons: (row.persons ?? []) as PersonView[],
    relations: (row.relations ?? []) as RelationView[],
    hasMoreAncestors: Boolean(row.has_more_ancestors),
    hasMoreDescendants: Boolean(row.has_more_descendants),
  };
}
