import { lineage } from "@yunpu/db";
import type {
  CreateLineageInput,
  GenealogyPlaceInput,
  UpdateLineageInput,
} from "@yunpu/shared";
import { and, asc, eq, sql } from "drizzle-orm";
import type { TxDatabase } from "../../db/with-tenant-transaction";
import { isoTimestamp as timestamp } from "../../lib/sql";

export type LineageRecord = {
  id: string;
  projectId: string;
  folderId: string | null;
  name: string;
  surname: string | null;
  hallName: string | null;
  progenitor: string | null;
  region: GenealogyPlaceInput | null;
  seq: number;
  version: number;
  createdAt: string;
  updatedAt: string;
};

const lineageColumns = {
  id: lineage.id,
  projectId: lineage.projectId,
  folderId: lineage.folderId,
  name: lineage.name,
  surname: lineage.surname,
  hallName: lineage.hallName,
  progenitor: lineage.progenitor,
  region: lineage.region,
  seq: lineage.seq,
  version: lineage.version,
  createdAt: timestamp(lineage.createdAt),
  updatedAt: timestamp(lineage.updatedAt),
};

function mapLineageRow(row: {
  id: string;
  projectId: string;
  folderId: string | null;
  name: string;
  surname: string | null;
  hallName: string | null;
  progenitor: string | null;
  region: unknown;
  seq: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}): LineageRecord {
  return {
    ...row,
    region: (row.region as GenealogyPlaceInput | null) ?? null,
  };
}

export async function listLineages(
  db: TxDatabase,
  projectId: string,
): Promise<LineageRecord[]> {
  const rows = await db
    .select(lineageColumns)
    .from(lineage)
    .where(eq(lineage.projectId, projectId))
    .orderBy(asc(lineage.seq), asc(lineage.createdAt), asc(lineage.id));
  return rows.map(mapLineageRow);
}

export async function getLineage(
  db: TxDatabase,
  projectId: string,
  lineageId: string,
): Promise<LineageRecord | null> {
  const rows = await db
    .select(lineageColumns)
    .from(lineage)
    .where(and(eq(lineage.projectId, projectId), eq(lineage.id, lineageId)))
    .limit(1);
  return rows[0] ? mapLineageRow(rows[0]) : null;
}

export async function insertLineage(
  db: TxDatabase,
  organizationId: string,
  projectId: string,
  values: CreateLineageInput,
): Promise<LineageRecord> {
  const rows = await db
    .insert(lineage)
    .values({
      organizationId,
      projectId,
      folderId: values.folderId ?? null,
      name: values.name,
      surname: values.surname ?? null,
      hallName: values.hallName ?? null,
      progenitor: values.progenitor ?? null,
      region: values.region ?? null,
      seq: values.seq ?? 0,
    })
    .returning(lineageColumns);
  return mapLineageRow(rows[0]);
}

export async function casUpdateLineage(
  db: TxDatabase,
  projectId: string,
  lineageId: string,
  expectedVersion: number,
  values: Omit<UpdateLineageInput, "version">,
): Promise<LineageRecord | null> {
  const set: Record<string, unknown> = {
    version: sql`${lineage.version} + 1`,
    updatedAt: sql`clock_timestamp()`,
  };
  if (values.name !== undefined) set.name = values.name;
  if (values.folderId !== undefined) set.folderId = values.folderId;
  if (values.surname !== undefined) set.surname = values.surname;
  if (values.hallName !== undefined) set.hallName = values.hallName;
  if (values.progenitor !== undefined) set.progenitor = values.progenitor;
  if (values.region !== undefined) set.region = values.region;
  if (values.seq !== undefined) set.seq = values.seq;

  const rows = await db
    .update(lineage)
    .set(set)
    .where(
      and(
        eq(lineage.projectId, projectId),
        eq(lineage.id, lineageId),
        eq(lineage.version, expectedVersion),
      ),
    )
    .returning(lineageColumns);
  return rows[0] ? mapLineageRow(rows[0]) : null;
}

export async function deleteLineage(
  db: TxDatabase,
  projectId: string,
  lineageId: string,
): Promise<boolean> {
  const rows = await db
    .delete(lineage)
    .where(and(eq(lineage.projectId, projectId), eq(lineage.id, lineageId)))
    .returning({ id: lineage.id });
  return rows.length > 0;
}
