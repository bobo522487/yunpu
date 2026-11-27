import type { CreateFolderInput, UpdateFolderInput } from "@yunpu/shared";
import { requireProjectMember } from "../../access";
import {
  type TxDatabase,
  withTenantTransaction,
} from "../../db/with-tenant-transaction";
import { notFound } from "../../lib/errors";
import {
  deleteFolder,
  type FolderRecord,
  folderExists,
  insertFolder,
  listFolders,
  updateFolder,
} from "./queries";

export type { FolderRecord };

/** List flat folders within an existing tenant transaction. */
export async function listFoldersInTx(
  db: TxDatabase,
  projectId: string,
): Promise<FolderRecord[]> {
  return listFolders(db, projectId);
}

/** Check folder existence inside a project within an existing transaction. */
export async function folderExistsInTx(
  db: TxDatabase,
  projectId: string,
  folderId: string,
): Promise<boolean> {
  return folderExists(db, projectId, folderId);
}

/** Create a flat folder within an existing tenant transaction. */
export async function insertFolderInTx(
  db: TxDatabase,
  organizationId: string,
  projectId: string,
  input: CreateFolderInput,
): Promise<FolderRecord> {
  return insertFolder(db, organizationId, projectId, input);
}

export async function listFoldersForProject(
  userId: string,
  projectId: string,
): Promise<FolderRecord[]> {
  return withTenantTransaction({ userId, readOnly: true }, async (db) => {
    await requireProjectMember(db, projectId, userId, null);
    return listFolders(db, projectId);
  });
}

export async function createFolderForProject(
  userId: string,
  projectId: string,
  input: CreateFolderInput,
): Promise<FolderRecord> {
  return withTenantTransaction({ userId }, async (db) => {
    const { organizationId } = await requireProjectMember(
      db,
      projectId,
      userId,
      "editor",
    );
    return insertFolder(db, organizationId, projectId, input);
  });
}

export async function updateFolderForProject(
  userId: string,
  projectId: string,
  folderId: string,
  input: UpdateFolderInput,
): Promise<FolderRecord> {
  return withTenantTransaction({ userId }, async (db) => {
    await requireProjectMember(db, projectId, userId, "editor");
    const updated = await updateFolder(db, projectId, folderId, input);
    if (!updated) throw notFound();
    return updated;
  });
}

export async function deleteFolderForProject(
  userId: string,
  projectId: string,
  folderId: string,
): Promise<void> {
  await withTenantTransaction({ userId }, async (db) => {
    await requireProjectMember(db, projectId, userId, "editor");
    const deleted = await deleteFolder(db, projectId, folderId);
    if (!deleted) throw notFound();
  });
}
