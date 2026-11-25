import { organizationMember } from "@yunpu/db";
import { MEMBER_ROLES, type MemberRole } from "@yunpu/shared";
import { and, eq } from "drizzle-orm";
import type { TxDatabase } from "./db/with-tenant-transaction";
import { AppError } from "./lib/errors";

const RANK: Record<MemberRole, number> = { viewer: 1, editor: 2, admin: 3 };

export function accessNotFound(): AppError {
  return new AppError("NOT_FOUND", "不存在或无权", 404);
}

export function accessForbidden(): AppError {
  return new AppError("FORBIDDEN", "无权执行该操作", 403);
}

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
): Promise<void> {
  const role = await memberRole(db, organizationId, userId);
  if (role === null) throw accessNotFound();
  if (min !== null && RANK[role] < RANK[min]) throw accessForbidden();
}
