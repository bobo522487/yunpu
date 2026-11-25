import { project } from "@yunpu/db";
import type { ProjectColorTheme, ProjectStatus } from "@yunpu/shared";
import { and, desc, eq, sql } from "drizzle-orm";
import type { TxDatabase } from "../../db/with-tenant-transaction";
import { validationError } from "../../lib/errors";
import { isoTimestamp as timestamp } from "../../lib/sql";

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
  version: number;
  createdAt: string;
  updatedAt: string;
};

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
  version: project.version,
  createdAt: timestamp(project.createdAt),
  updatedAt: timestamp(project.updatedAt),
};

export type { ProjectStatus };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listProjects(
  db: TxDatabase,
  organizationId: string,
  options: { cursor?: string; limit: number },
): Promise<{ items: ProjectRecord[]; nextCursor: string | null }> {
  const conditions = [eq(project.organizationId, organizationId)];
  if (options.cursor) {
    const parts = options.cursor.split("|");
    if (
      parts.length !== 2 ||
      Number.isNaN(Date.parse(parts[0])) ||
      !UUID_PATTERN.test(parts[1])
    ) {
      throw validationError({ cursor: "游标格式不合法" });
    }
    const [updatedAt, id] = parts;
    conditions.push(
      sql`(${project.updatedAt}, ${project.id}) < (${updatedAt}::timestamptz, ${id}::uuid)`,
    );
  }

  const rows = await db
    .select(projectColumns)
    .from(project)
    .where(and(...conditions))
    .orderBy(desc(project.updatedAt), desc(project.id))
    .limit(options.limit + 1);
  const hasMore = rows.length > options.limit;
  const items = hasMore ? rows.slice(0, options.limit) : rows;
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: hasMore && last ? `${last.updatedAt}|${last.id}` : null,
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

export type UpdateProjectValues = Omit<
  Partial<CreateProjectValues>,
  "surname" | "hallName" | "originText" | "description"
> & {
  surname?: string | null;
  hallName?: string | null;
  originText?: string | null;
  description?: string | null;
};

/** CAS：`version` 令牌不匹配返回 null（路由映射 VERSION_CONFLICT），不静默覆盖。 */
export async function casUpdateProject(
  db: TxDatabase,
  projectId: string,
  organizationId: string,
  expectedVersion: number,
  values: UpdateProjectValues,
): Promise<ProjectRecord | null> {
  const set: Record<string, unknown> = {
    version: sql`${project.version} + 1`,
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
        eq(project.version, expectedVersion),
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
