import { personEvent, personName } from "@yunpu/db";
import type {
  GenealogyDateInput,
  GenealogyPlaceInput,
  PersonEventType,
  PersonNameKind,
} from "@yunpu/shared";
import { and, eq, sql } from "drizzle-orm";
import type { TxDatabase } from "../../db/with-tenant-transaction";
import {
  mapEventRow,
  type PersonEventView,
  type PersonNameView,
  personEventColumns,
  personNameColumns,
} from "./person-views";

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
