import type { MemberRole } from "@yunpu/shared";
import { requireMember } from "../../access";
import { withTenantTransaction } from "../../db/with-tenant-transaction";
import {
  AppError,
  mapDatabaseError,
  notFound,
  versionConflict,
} from "../../lib/errors";
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

function asAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  return mapDatabaseError(error);
}

export async function listProjectsForOrg(
  userId: string,
  organizationId: string,
  options: { cursor?: string; limit?: number },
): Promise<{ items: ProjectRecord[]; nextCursor: string | null }> {
  try {
    return await withTenantTransaction({ userId }, async (db) => {
      await requireMember(db, organizationId, userId, null);
      return listProjects(db, organizationId, {
        cursor: options.cursor,
        limit: options.limit ?? 50,
      });
    });
  } catch (error) {
    throw asAppError(error);
  }
}

export async function createProject(
  userId: string,
  organizationId: string,
  values: CreateProjectValues,
): Promise<ProjectRecord> {
  try {
    return await withTenantTransaction({ userId }, async (db) => {
      await requireMember(db, organizationId, userId, "editor");
      return insertProject(db, organizationId, values);
    });
  } catch (error) {
    throw asAppError(error);
  }
}

async function loadProjectForWrite(
  db: Parameters<typeof getProject>[0],
  userId: string,
  projectId: string,
  min: Exclude<MemberRole, "viewer">,
): Promise<ProjectRecord> {
  const existing = await getProject(db, projectId);
  if (!existing) throw notFound();
  await requireMember(db, existing.organizationId, userId, min);
  return existing;
}

export async function getProjectById(
  userId: string,
  projectId: string,
): Promise<ProjectRecord> {
  try {
    return await withTenantTransaction({ userId }, async (db) => {
      const existing = await getProject(db, projectId);
      // RLS 已把非本组织的行过滤掉；成员即可读（C3：project.read 全角色）。
      if (!existing) throw notFound();
      return existing;
    });
  } catch (error) {
    throw asAppError(error);
  }
}

export async function updateProject(
  userId: string,
  projectId: string,
  expectedVersion: number,
  values: UpdateProjectValues,
): Promise<ProjectRecord> {
  try {
    return await withTenantTransaction({ userId }, async (db) => {
      const existing = await loadProjectForWrite(
        db,
        userId,
        projectId,
        "editor",
      );
      const updated = await casUpdateProject(
        db,
        projectId,
        existing.organizationId,
        expectedVersion,
        values,
      );
      if (!updated) {
        throw versionConflict("项目已被他人修改，请刷新后重试");
      }
      return updated;
    });
  } catch (error) {
    throw asAppError(error);
  }
}

export async function removeProject(
  userId: string,
  projectId: string,
): Promise<void> {
  try {
    await withTenantTransaction({ userId }, async (db) => {
      const existing = await loadProjectForWrite(
        db,
        userId,
        projectId,
        "admin",
      );
      const deleted = await deleteProject(
        db,
        projectId,
        existing.organizationId,
      );
      if (!deleted) throw notFound();
    });
  } catch (error) {
    throw asAppError(error);
  }
}
