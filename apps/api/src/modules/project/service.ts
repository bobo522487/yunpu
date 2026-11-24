import { AppError, mapDatabaseError } from "../../lib/errors";
import { withTenantTransaction } from "../../db/with-tenant-transaction";
import {
  conflict,
  forbidden,
  projectNotFound,
} from "./errors";
import {
  casUpdateProject,
  deleteProject,
  getProject,
  hasRole,
  insertProject,
  listProjects,
  membershipRole,
  organizationStatus,
  type CreateProjectValues,
  type ProjectRecord,
  type UpdateProjectValues,
} from "./queries";

function asAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  return mapDatabaseError(error);
}

/** 非成员 → 404（不存在或无权）；角色不足 → 403。执行者：服务层 + C3 权限矩阵。 */
async function requireRole(
  db: Parameters<typeof membershipRole>[0],
  organizationId: string,
  userId: string,
  min: "editor" | "admin",
): Promise<void> {
  const role = await membershipRole(db, organizationId, userId);
  if (role === null) throw projectNotFound();
  if (!hasRole(role, min)) throw forbidden();
}

/** 归档组织拒绝写入（EC-08：数据库层不拦截的已声明软约束，执行者为服务层）。 */
async function requireActiveOrganization(
  db: Parameters<typeof organizationStatus>[0],
  organizationId: string,
): Promise<void> {
  const status = await organizationStatus(db, organizationId);
  if (status !== "active") {
    throw conflict("组织已归档，无法写入");
  }
}

export async function listProjectsForOrg(
  userId: string,
  organizationId: string,
  options: { cursor?: string; limit?: number },
): Promise<{ items: ProjectRecord[]; nextCursor: string | null }> {
  try {
    return await withTenantTransaction({ userId, orgId: organizationId }, async (db) => {
      const role = await membershipRole(db, organizationId, userId);
      if (role === null) throw projectNotFound();
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
    return await withTenantTransaction({ userId, orgId: organizationId }, async (db) => {
      await requireRole(db, organizationId, userId, "editor");
      await requireActiveOrganization(db, organizationId);
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
  min: "editor" | "admin",
): Promise<ProjectRecord> {
  const existing = await getProject(db, projectId);
  if (!existing) throw projectNotFound();
  await requireRole(db, existing.organizationId, userId, min);
  await requireActiveOrganization(db, existing.organizationId);
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
      if (!existing) throw projectNotFound();
      return existing;
    });
  } catch (error) {
    throw asAppError(error);
  }
}

export async function updateProject(
  userId: string,
  projectId: string,
  expectedUpdatedAt: string,
  values: UpdateProjectValues,
): Promise<ProjectRecord> {
  try {
    return await withTenantTransaction({ userId }, async (db) => {
      const existing = await loadProjectForWrite(db, userId, projectId, "editor");
      const updated = await casUpdateProject(
        db,
        projectId,
        existing.organizationId,
        expectedUpdatedAt,
        values,
      );
      if (!updated) {
        throw conflict("项目已被他人修改，请刷新后重试");
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
      const existing = await loadProjectForWrite(db, userId, projectId, "admin");
      const deleted = await deleteProject(db, projectId, existing.organizationId);
      if (!deleted) throw projectNotFound();
    });
  } catch (error) {
    throw asAppError(error);
  }
}
