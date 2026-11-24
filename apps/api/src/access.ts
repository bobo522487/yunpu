import { organizationMember } from "@yunpu/db";
import { and, eq } from "drizzle-orm";
import type { TxDatabase } from "./db/with-tenant-transaction";
import { AppError } from "./lib/errors";

const RANK = { viewer: 1, editor: 2, admin: 3 } as const;

type Role = keyof typeof RANK;

export function accessNotFound(): AppError {
  return new AppError("NOT_FOUND", "不存在或无权", 404);
}

export function accessForbidden(): AppError {
  return new AppError("FORBIDDEN", "无权执行该操作", 403);
}

export function ownerRoleConflict(): AppError {
  return new AppError("CONFLICT", "不能修改所有者角色", 409);
}

export async function memberRole(
  db: TxDatabase,
  organizationId: string,
  userId: string,
): Promise<Role | null> {
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
  if (role === "admin" || role === "editor" || role === "viewer") return role;
  return null;
}

/** Non-members are not found. A member below `min` is forbidden. `min` null only checks membership. */
export async function requireMember(
  db: TxDatabase,
  organizationId: string,
  userId: string,
  min: "editor" | "admin" | null,
): Promise<void> {
  const role = await memberRole(db, organizationId, userId);
  if (role === null) throw accessNotFound();
  if (min !== null && RANK[role] < RANK[min]) throw accessForbidden();
}
