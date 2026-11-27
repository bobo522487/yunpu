import { folder } from "@yunpu/db";
import { and, asc, eq, sql } from "drizzle-orm";
import type { TxDatabase } from "../../db/with-tenant-transaction";
import { isoTimestamp as timestamp } from "../../lib/sql";

export type FolderRecord = {
  id: string;
  projectId: string;
  name: string;
  seq: number;
  createdAt: string;
  updatedAt: string;
};

const folderColumns = {
  id: folder.id,
  projectId: folder.projectId,
  name: folder.name,
  seq: folder.seq,
  createdAt: timestamp(folder.createdAt),
  updatedAt: timestamp(folder.updatedAt),
};

export async function listFolders(
  db: TxDatabase,
  projectId: string,
): Promise<FolderRecord[]> {
  return db
    .select(folderColumns)
    .from(folder)
    .where(eq(folder.projectId, projectId))
    .orderBy(asc(folder.seq), asc(folder.createdAt), asc(folder.id));
}

export async function folderExists(
  db: TxDatabase,
  projectId: string,
  folderId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: folder.id })
    .from(folder)
    .where(and(eq(folder.projectId, projectId), eq(folder.id, folderId)))
    .limit(1);
  return rows.length > 0;
}

export async function insertFolder(
  db: TxDatabase,
  organizationId: string,
  projectId: string,
  values: { name: string; seq?: number },
): Promise<FolderRecord> {
  const rows = await db
    .insert(folder)
    .values({
      organizationId,
      projectId,
      name: values.name,
      seq: values.seq ?? 0,
    })
    .returning(folderColumns);
  return rows[0];
}

export async function updateFolder(
  db: TxDatabase,
  projectId: string,
  folderId: string,
  values: { name?: string; seq?: number },
): Promise<FolderRecord | null> {
  const set: Record<string, unknown> = {
    updatedAt: sql`clock_timestamp()`,
  };
  if (values.name !== undefined) set.name = values.name;
  if (values.seq !== undefined) set.seq = values.seq;

  const rows = await db
    .update(folder)
    .set(set)
    .where(and(eq(folder.projectId, projectId), eq(folder.id, folderId)))
    .returning(folderColumns);
  return rows[0] ?? null;
}

export async function deleteFolder(
  db: TxDatabase,
  projectId: string,
  folderId: string,
): Promise<boolean> {
  const rows = await db
    .delete(folder)
    .where(and(eq(folder.projectId, projectId), eq(folder.id, folderId)))
    .returning({ id: folder.id });
  return rows.length > 0;
}
