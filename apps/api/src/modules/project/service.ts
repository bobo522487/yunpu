import { requireMember, requireProjectMember } from "../../access";
import { withTenantTransaction } from "../../db/with-tenant-transaction";
import { notFound, versionConflict } from "../../lib/errors";
import {
  type CreateProjectValues,
  casUpdateProject,
  deleteProject,
  getProject,
  insertProject,
  listProjects,
  type ProjectRecord,
  type UpdateProjectValues,
} from "./queries";

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
    return insertProject(db, organizationId, values);
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
