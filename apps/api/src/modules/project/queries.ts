import { project } from "@yunpu/db";
import type { ProjectColorTheme, ProjectStatus } from "@yunpu/shared";
import { and, desc, eq, sql } from "drizzle-orm";
import type { TxDatabase } from "../../db/with-tenant-transaction";

export type ProjectRecord = {
  id: string;
  organizationId: string;
  name: string;
  status: ProjectStatus;
  surname: string | null;
  hallName: string | null;
  originText: string | null;
  description: string | null;
  colorTheme: ProjectColorTheme;
  projectLevel: number;
  createdAt: string;
  updatedAt: string;
};

/**
 * 时间戳以 UTC 微秒精度序列化（`...T10:00:00.123456Z`）：
 * 乐观锁令牌 `expectedUpdatedAt` 必须与库中值逐微秒相等，
 * JS Date 的毫秒精度会截断微秒，导致 CAS 永远不命中。
 */
const timestamp = (column: typeof project.updatedAt) =>
  sql<string>`to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

const projectColumns = {
  id: project.id,
  organizationId: project.organizationId,
  name: project.name,
  status: project.status,
  surname: project.surname,
  hallName: project.hallName,
  originText: project.originText,
  description: project.description,
  colorTheme: project.colorTheme,
  projectLevel: project.projectLevel,
  createdAt: timestamp(project.createdAt),
  updatedAt: timestamp(project.updatedAt),
};

export type { ProjectStatus };

export async function listProjects(
  db: TxDatabase,
  organizationId: string,
  options: { cursor?: string; limit: number },
): Promise<{ items: ProjectRecord[]; nextCursor: string | null }> {
  const conditions = [eq(project.organizationId, organizationId)];
  if (options.cursor) {
    const separator = options.cursor.indexOf("|");
    const updatedAt = options.cursor.slice(0, separator);
    const id = options.cursor.slice(separator + 1);
    conditions.push(
      sql`(${project.updatedAt}, ${project.id}) < (${updatedAt}::timestamptz, ${id}::uuid)`,
    );
  }

  const rows = await db
    .select(projectColumns)
    .from(project)
    .where(and(...conditions))
    .orderBy(desc(project.updatedAt), desc(project.id))
    .limit(options.limit);

  const last = rows[rows.length - 1];
  return {
    items: rows,
    nextCursor:
      rows.length === options.limit && last
        ? `${last.updatedAt}|${last.id}`
        : null,
  };
}

export async function getProject(
  db: TxDatabase,
  projectId: string,
): Promise<ProjectRecord | null> {
  const rows = await db
    .select(projectColumns)
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1);
  return rows[0] ?? null;
}

export type CreateProjectValues = {
  name: string;
  status?: ProjectStatus;
  surname?: string;
  hallName?: string;
  originText?: string;
  description?: string;
  colorTheme?: ProjectColorTheme;
  projectLevel?: number;
};

export async function insertProject(
  db: TxDatabase,
  organizationId: string,
  values: CreateProjectValues,
): Promise<ProjectRecord> {
  const rows = await db
    .insert(project)
    .values({
      organizationId,
      name: values.name,
      status: values.status ?? "planning",
      surname: values.surname ?? null,
      hallName: values.hallName ?? null,
      originText: values.originText ?? null,
      description: values.description ?? null,
      colorTheme: values.colorTheme ?? "sky",
      projectLevel: values.projectLevel ?? 1,
    })
    .returning(projectColumns);
  return rows[0];
}

export type UpdateProjectValues = Partial<CreateProjectValues> & {
  surname?: string | null;
  hallName?: string | null;
  originText?: string | null;
  description?: string | null;
};

/** CAS：`updated_at` 令牌不匹配返回 null（路由映射 409），不静默覆盖。 */
export async function casUpdateProject(
  db: TxDatabase,
  projectId: string,
  organizationId: string,
  expectedUpdatedAt: string,
  values: UpdateProjectValues,
): Promise<ProjectRecord | null> {
  const set: Record<string, unknown> = {
    updatedAt: sql`clock_timestamp()`,
  };
  if (values.name !== undefined) set.name = values.name;
  if (values.status !== undefined) set.status = values.status;
  if ("surname" in values) set.surname = values.surname ?? null;
  if ("hallName" in values) set.hallName = values.hallName ?? null;
  if ("originText" in values) set.originText = values.originText ?? null;
  if ("description" in values) set.description = values.description ?? null;
  if (values.colorTheme !== undefined) set.colorTheme = values.colorTheme;
  if (values.projectLevel !== undefined) set.projectLevel = values.projectLevel;

  const rows = await db
    .update(project)
    .set(set)
    .where(
      and(
        eq(project.id, projectId),
        eq(project.organizationId, organizationId),
        // 必须用原始字符串比较：Drizzle 的列映射会把参数转成 Date（毫秒精度），
        // 截断微秒后 CAS 永不命中；`::timestamptz` 直接按完整精度比较。
        sql`${project.updatedAt} = ${expectedUpdatedAt}::timestamptz`,
      ),
    )
    .returning(projectColumns);
  return rows[0] ?? null;
}

export async function deleteProject(
  db: TxDatabase,
  projectId: string,
  organizationId: string,
): Promise<boolean> {
  const rows = await db
    .delete(project)
    .where(
      and(
        eq(project.id, projectId),
        eq(project.organizationId, organizationId),
      ),
    )
    .returning({ id: project.id });
  return rows.length > 0;
}

export const defaultListLimit = 50;
