import type { CreateLineageInput, UpdateLineageInput } from "@yunpu/shared";
import { requireProjectMember } from "../../access";
import {
  type TxDatabase,
  withTenantTransaction,
} from "../../db/with-tenant-transaction";
import { notFound, versionConflict } from "../../lib/errors";
import {
  type FolderRecord,
  folderExistsInTx,
  listFoldersInTx,
} from "../folder/service";
import {
  createPersonInTx,
  loadLineageGraphDataInTx,
  type PersonView,
  type ProjectionView,
  type RelationView,
} from "../person/service";
import {
  casUpdateLineage,
  deleteLineage,
  getLineage,
  insertLineage,
  type LineageRecord,
  listLineages,
} from "./queries";

export type { LineageRecord };

/** Create a lineage (and optional starter progenitor person) within an existing tenant transaction. */
export async function createLineageInTx(
  db: TxDatabase,
  organizationId: string,
  projectId: string,
  input: CreateLineageInput,
  options?: { skipStarterProgenitor?: boolean },
): Promise<{ lineage: LineageRecord; progenitorPerson: PersonView | null }> {
  if (input.folderId) {
    const exists = await folderExistsInTx(db, projectId, input.folderId);
    if (!exists) throw notFound();
  }

  const created = await insertLineage(db, organizationId, projectId, input);
  let progenitorPerson: PersonView | null = null;
  const progenitorName = input.progenitor?.trim();
  if (!options?.skipStarterProgenitor && progenitorName) {
    progenitorPerson = await createPersonInTx(db, organizationId, projectId, {
      lineageId: created.id,
      displayName: progenitorName,
      givenName: progenitorName,
      surname: input.surname,
      sex: "male",
      isLiving: false,
      relationTitle: "始祖",
    });
  }

  return { lineage: created, progenitorPerson };
}

export async function listLineageDirectoryForProject(
  userId: string,
  projectId: string,
): Promise<{ folders: FolderRecord[]; lineages: LineageRecord[] }> {
  return withTenantTransaction({ userId, readOnly: true }, async (db) => {
    await requireProjectMember(db, projectId, userId, null);
    const [folders, lineages] = await Promise.all([
      listFoldersInTx(db, projectId),
      listLineages(db, projectId),
    ]);
    return { folders, lineages };
  });
}

export async function createLineageForProject(
  userId: string,
  projectId: string,
  input: CreateLineageInput,
): Promise<{ lineage: LineageRecord; progenitorPerson: PersonView | null }> {
  return withTenantTransaction({ userId }, async (db) => {
    const { organizationId } = await requireProjectMember(
      db,
      projectId,
      userId,
      "editor",
    );
    return createLineageInTx(db, organizationId, projectId, input);
  });
}

export async function updateLineageForProject(
  userId: string,
  projectId: string,
  lineageId: string,
  input: UpdateLineageInput,
): Promise<LineageRecord> {
  return withTenantTransaction({ userId }, async (db) => {
    await requireProjectMember(db, projectId, userId, "editor");
    const { version, ...values } = input;
    if (values.folderId) {
      const exists = await folderExistsInTx(db, projectId, values.folderId);
      if (!exists) throw notFound();
    }

    const updated = await casUpdateLineage(
      db,
      projectId,
      lineageId,
      version,
      values,
    );
    if (updated) return updated;

    const existing = await getLineage(db, projectId, lineageId);
    if (existing) {
      throw versionConflict("谱系图已被他人修改，请刷新后重试");
    }
    throw notFound();
  });
}

export async function deleteLineageForProject(
  userId: string,
  projectId: string,
  lineageId: string,
): Promise<void> {
  await withTenantTransaction({ userId }, async (db) => {
    await requireProjectMember(db, projectId, userId, "editor");
    const deleted = await deleteLineage(db, projectId, lineageId);
    if (!deleted) throw notFound();
  });
}

export async function getLineageGraphForProject(
  userId: string,
  projectId: string,
  lineageId: string,
): Promise<{
  lineage: LineageRecord;
  persons: PersonView[];
  relations: RelationView[];
  projections: ProjectionView[];
}> {
  return withTenantTransaction({ userId, readOnly: true }, async (db) => {
    const { organizationId } = await requireProjectMember(
      db,
      projectId,
      userId,
      null,
    );
    const found = await getLineage(db, projectId, lineageId);
    if (!found) throw notFound();

    const graph = await loadLineageGraphDataInTx(
      db,
      organizationId,
      projectId,
      lineageId,
    );
    return {
      lineage: found,
      ...graph,
    };
  });
}
