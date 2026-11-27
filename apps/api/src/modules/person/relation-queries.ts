import { lineageProjection, personRelation } from "@yunpu/db";
import type { ApiRelationKind } from "@yunpu/shared";
import { and, asc, eq, or, sql } from "drizzle-orm";
import type { TxDatabase } from "../../db/with-tenant-transaction";
import {
  type ProjectionView,
  type RelationView,
  relationColumns,
} from "./person-views";

export async function listRelationsForPerson(
  db: TxDatabase,
  projectId: string,
  personId: string,
): Promise<RelationView[]> {
  return db
    .select(relationColumns)
    .from(personRelation)
    .where(
      and(
        eq(personRelation.projectId, projectId),
        or(
          eq(personRelation.fromPersonId, personId),
          eq(personRelation.toPersonId, personId),
        ),
      ),
    )
    .orderBy(asc(personRelation.sortOrder), asc(personRelation.createdAt));
}

export async function getProjectionForPerson(
  db: TxDatabase,
  projectId: string,
  personId: string,
): Promise<ProjectionView | null> {
  const rows = await db
    .select({
      personId: lineageProjection.personId,
      primaryPath: sql<string>`${lineageProjection.primaryPath}::text`,
      generation: lineageProjection.generation,
    })
    .from(lineageProjection)
    .where(
      and(
        eq(lineageProjection.projectId, projectId),
        eq(lineageProjection.personId, personId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
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
