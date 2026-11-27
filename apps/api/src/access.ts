import { organizationMember, project } from "@yunpu/db";
import { MEMBER_ROLES, type MemberRole } from "@yunpu/shared";
import { and, eq } from "drizzle-orm";
import type { TxDatabase } from "./db/with-tenant-transaction";
import { forbidden, notFound } from "./lib/errors";

const RANK: Record<MemberRole, number> = { viewer: 1, editor: 2, admin: 3 };

export async function memberRole(
  db: TxDatabase,
  organizationId: string,
  userId: string,
): Promise<MemberRole | null> {
  const rows = await db
    .select({ role: organizationMember.role })
    .from(organizationMember)
    .where(
      and(
        eq(organizationMember.organizationId, organizationId),
        eq(organizationMember.userId, userId),
      ),
    )
    .limit(1);
  const role = rows[0]?.role;
  if (MEMBER_ROLES.some((candidate) => candidate === role)) {
    return role as MemberRole;
  }
  return null;
}

/** Non-members are not found. A member below `min` is forbidden. `min` null only checks membership. */
export async function requireMember(
  db: TxDatabase,
  organizationId: string,
  userId: string,
  min: Exclude<MemberRole, "viewer"> | null,
): Promise<MemberRole> {
  const role = await memberRole(db, organizationId, userId);
  if (role === null) throw notFound();
  if (min !== null && RANK[role] < RANK[min]) throw forbidden();
  return role;
}

/** Resolve a project's organization and check caller membership in a single round trip. */
export async function requireProjectMember(
  db: TxDatabase,
  projectId: string,
  userId: string,
  min: Exclude<MemberRole, "viewer"> | null,
): Promise<{ organizationId: string; role: MemberRole }> {
  const rows = await db
    .select({
      organizationId: project.organizationId,
      role: organizationMember.role,
    })
    .from(project)
    .leftJoin(
      organizationMember,
      and(
        eq(organizationMember.organizationId, project.organizationId),
        eq(organizationMember.userId, userId),
      ),
    )
    .where(eq(project.id, projectId))
    .limit(1);
  const row = rows[0];
  const role = row?.role;
  if (!row || !MEMBER_ROLES.some((candidate) => candidate === role)) {
    throw notFound();
  }
  const member = role as MemberRole;
  if (min !== null && RANK[member] < RANK[min]) throw forbidden();
  return { organizationId: row.organizationId, role: member };
}
