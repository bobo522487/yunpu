import { lineage, person, personName } from "@yunpu/db";
import type {
  PersonBirthInfoInput,
  PersonDeathInfoInput,
  PersonSex,
} from "@yunpu/shared";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import type { TxDatabase } from "../../db/with-tenant-transaction";
import { parseUuidCursor, sliceCursorPage } from "../../lib/pagination";
import {
  hydratePersonsDetails,
  mapPersonRow,
  type PersonView,
  personBaseColumns,
} from "./person-views";

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

async function loadPersonView(
  db: TxDatabase,
  projectId: string,
  personId: string,
  includeDetails = false,
): Promise<PersonView | null> {
  const rows = await db
    .select({
      ...personBaseColumns,
      displayName: sql<string>`coalesce(${personName.value}, ${person.surname}, '')`,
    })
    .from(person)
    .leftJoin(
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
      displayName: sql<string>`coalesce(${person.surname}, '')`,
    })
    .from(person)
    .where(and(...conditions))
    .orderBy(person.id)
    .limit(options.limit + 1);
  const page = sliceCursorPage(rows, options.limit, (last) => last.id);
  const pageIds = page.items.map((item) => item.id);
  const primaryNames = new Map<string, string>();
  if (pageIds.length > 0) {
    const nameRows = await db
      .select({ personId: personName.personId, value: personName.value })
      .from(personName)
      .where(
        and(
          eq(personName.organizationId, organizationId),
          eq(personName.projectId, projectId),
          eq(personName.isPrimary, true),
          inArray(personName.personId, pageIds),
        ),
      );
    for (const row of nameRows) {
      primaryNames.set(row.personId, row.value);
    }
  }
  return {
    persons: page.items.map((row) =>
      mapPersonRow({
        ...row,
        displayName: primaryNames.get(row.id) ?? row.surname ?? "",
      }),
    ),
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

  const rows = await db
    .update(person)
    .set(set)
    .where(
      and(
        eq(person.projectId, projectId),
        eq(person.id, personId),
        eq(person.version, expectedVersion),
      ),
    )
    .returning({
      ...personBaseColumns,
      displayName: sql<string>`coalesce((
        SELECT pn.value FROM person_name pn
         WHERE pn.project_id = ${person.projectId}
           AND pn.person_id = ${person.id}
           AND pn.is_primary = true
         LIMIT 1
      ), ${person.surname}, '')`,
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

export async function getPersonAnchorInfo(
  db: TxDatabase,
  projectId: string,
  personId: string,
): Promise<{ id: string; lineageId: string } | null> {
  const rows = await db
    .select({ id: person.id, lineageId: person.lineageId })
    .from(person)
    .where(and(eq(person.projectId, projectId), eq(person.id, personId)))
    .limit(1);
  return rows[0] ?? null;
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
