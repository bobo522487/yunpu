import { requireMember, requireProjectMember } from "../../access";
import {
  type TxDatabase,
  withTenantTransaction,
} from "../../db/with-tenant-transaction";
import { AppError, notFound, versionConflict } from "../../lib/errors";
import { createLineageInTx } from "../lineage/service";
import {
  type CreateProjectValues,
  casUpdateProject,
  deleteProject,
  getProject,
  insertProject,
  isOrganizationArchived,
  listProjects,
  type ProjectRecord,
  type UpdateProjectValues,
} from "./queries";

export async function createProjectInTx(
  db: TxDatabase,
  organizationId: string,
  values: CreateProjectValues,
  options?: { skipStarterLineage?: boolean },
): Promise<ProjectRecord> {
  const created = await insertProject(db, organizationId, values);
  const ancestorName = values.ancestor?.trim();
  if (!options?.skipStarterLineage && ancestorName) {
    await createLineageInTx(db, organizationId, created.id, {
      name: `${values.name}主世系`,
      surname: values.surname,
      hallName: values.hallName,
      progenitor: ancestorName,
      seq: 0,
    });
  }
  return created;
}

export async function listProjectsForOrg(
  userId: string,
  organizationId: string,
  options: { cursor?: string; limit?: number },
): Promise<{ items: ProjectRecord[]; nextCursor: string | null }> {
  return withTenantTransaction({ userId, readOnly: true }, async (db) => {
    await requireMember(db, organizationId, userId, null);
    return listProjects(db, organizationId, {
      cursor: options.cursor,
      limit: options.limit ?? 50,
    });
  });
}

export async function createProject(
  userId: string,
  organizationId: string,
  values: CreateProjectValues,
): Promise<ProjectRecord> {
  return withTenantTransaction({ userId }, async (db) => {
    await requireMember(db, organizationId, userId, "editor");
    return createProjectInTx(db, organizationId, values);
  });
}

export async function assertProjectMediaAccess(
  userId: string,
  projectId: string,
  mode: "read" | "write",
): Promise<{ organizationId: string }> {
  return withTenantTransaction({ userId, readOnly: true }, async (db) => {
    const { organizationId } = await requireProjectMember(
      db,
      projectId,
      userId,
      mode === "write" ? "editor" : null,
    );
    if (
      mode === "write" &&
      (await isOrganizationArchived(db, organizationId))
    ) {
      throw new AppError("CONFLICT", "组织已归档，无法写入", 409, {
        sqlstate: "GX012",
      });
    }
    return { organizationId };
  });
}

export async function getProjectById(
  userId: string,
  projectId: string,
): Promise<ProjectRecord> {
  return withTenantTransaction({ userId, readOnly: true }, async (db) => {
    const existing = await getProject(db, projectId);
    // RLS 已把非本组织的行过滤掉；成员即可读（C3：project.read 全角色）。
    if (!existing) throw notFound();
    return existing;
  });
}

export async function updateProject(
  userId: string,
  projectId: string,
  expectedVersion: number,
  values: UpdateProjectValues,
): Promise<ProjectRecord> {
  return withTenantTransaction({ userId }, async (db) => {
    const { organizationId } = await requireProjectMember(
      db,
      projectId,
      userId,
      "editor",
    );
    const updated = await casUpdateProject(
      db,
      projectId,
      organizationId,
      expectedVersion,
      values,
    );
    if (!updated) {
      throw versionConflict("项目已被他人修改，请刷新后重试");
    }
    return updated;
  });
}

export async function removeProject(
  userId: string,
  projectId: string,
): Promise<void> {
  await withTenantTransaction({ userId }, async (db) => {
    const { organizationId } = await requireProjectMember(
      db,
      projectId,
      userId,
      "admin",
    );
    const deleted = await deleteProject(db, projectId, organizationId);
    if (!deleted) throw notFound();
  });
}
