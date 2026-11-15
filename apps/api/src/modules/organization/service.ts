import { AppError, mapDatabaseError } from "../../lib/errors";
import { withUser } from "../../db/with-user";
import { conflict, forbidden, organizationNotFound } from "./errors";
import {
  acceptInviteWithFunction,
  activateOrganization,
  createOrganizationWithFunction,
  findDefaultOrganization,
  getOrganizationDetail,
  getOrganizationSummary,
  getInviteRecord,
  getMemberRecord,
  hasRoleAtLeast,
  insertInviteRecord,
  listInvites,
  listMembers,
  listOrganizations,
  membershipRole,
  organizationOwnerId,
  organizationStatus,
  removeMemberRecord,
  revokeInviteViaFunction,
  transferOwnershipViaFunction,
  updateMemberRoleRecord,
  updateOrganizationRecord,
  type InviteListItem,
  type MemberListItem,
  type OrganizationDetail,
  type OrganizationListItem,
  type OrganizationSummary,
} from "./queries";
import { createHash, randomBytes } from "node:crypto";
import type { MemberRole } from "@yunpu/shared";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function asAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  return mapDatabaseError(error);
}

export async function createOrganization(
  userId: string,
  name: string,
): Promise<OrganizationSummary> {
  try {
    return await withUser(userId, async (db) => {
      const organizationId = await createOrganizationWithFunction(db, name);
      const summary = await getOrganizationSummary(db, organizationId, userId);
      if (!summary) throw organizationNotFound();
      return summary;
    });
  } catch (error) {
    throw asAppError(error);
  }
}

export async function listMyOrganizations(userId: string): Promise<OrganizationListItem[]> {
  try {
    return await withUser(userId, (db) => listOrganizations(db, userId));
  } catch (error) {
    throw asAppError(error);
  }
}

/** 非成员或组织不存在均返回 null，由路由统一映射 404（FR-009 不泄漏存在性）。 */
export async function getOrganization(
  userId: string,
  organizationId: string,
): Promise<OrganizationDetail | null> {
  try {
    return await withUser(userId, (db) =>
      getOrganizationDetail(db, organizationId, userId),
    );
  } catch (error) {
    throw asAppError(error);
  }
}

export async function resolveDefaultOrganization(
  userId: string,
): Promise<OrganizationSummary | null> {
  try {
    return await withUser(userId, (db) => findDefaultOrganization(db, userId));
  } catch (error) {
    throw asAppError(error);
  }
}

export async function activateOrganizationForUser(
  userId: string,
  organizationId: string,
): Promise<OrganizationSummary> {
  try {
    return await withUser(userId, async (db) => {
      const activated = await activateOrganization(db, organizationId, userId);
      if (!activated) throw organizationNotFound();
      const summary = await getOrganizationSummary(db, organizationId, userId);
      if (!summary) throw organizationNotFound();
      return summary;
    });
  } catch (error) {
    throw asAppError(error);
  }
}

export async function acceptInvite(
  userId: string,
  token: string,
): Promise<OrganizationSummary> {
  try {
    return await withUser(userId, async (db) => {
      const organizationId = await acceptInviteWithFunction(db, token);
      const summary = await getOrganizationSummary(db, organizationId, userId);
      if (!summary) throw organizationNotFound();
      return summary;
    });
  } catch (error) {
    throw asAppError(error);
  }
}

/**
 * 成员/邀请管理的统一前置：非成员 → 404（不泄漏存在性）；
 * `min` 角色不足 → 403。执行者：服务层 + C3 权限矩阵（DM-ORG-07）。
 */
async function requireMembership(
  db: Parameters<typeof membershipRole>[0],
  organizationId: string,
  userId: string,
  min: "editor" | "admin" | null,
): Promise<void> {
  const role = await membershipRole(db, organizationId, userId);
  if (role === null) throw organizationNotFound();
  if (min !== null && !hasRoleAtLeast(role, min)) throw forbidden();
}

export async function listMembersForOrg(
  userId: string,
  organizationId: string,
  options: { cursor?: string; limit?: number },
): Promise<{ items: MemberListItem[]; nextCursor: string | null }> {
  try {
    return await withUser(userId, async (db) => {
      await requireMembership(db, organizationId, userId, null);
      return listMembers(db, organizationId, {
        cursor: options.cursor,
        limit: options.limit ?? 50,
      });
    });
  } catch (error) {
    throw asAppError(error);
  }
}

export async function updateMemberRoleForOrg(
  userId: string,
  organizationId: string,
  targetUserId: string,
  role: MemberRole,
): Promise<MemberListItem> {
  try {
    return await withUser(userId, async (db) => {
      await requireMembership(db, organizationId, userId, "admin");
      const ownerId = await organizationOwnerId(db, organizationId);
      if (ownerId === targetUserId) {
        throw conflict("不能修改所有者角色");
      }
      const updated = await updateMemberRoleRecord(
        db,
        organizationId,
        targetUserId,
        role,
      );
      if (!updated) throw organizationNotFound();
      const member = await getMemberRecord(db, organizationId, targetUserId);
      if (!member) throw organizationNotFound();
      return member;
    });
  } catch (error) {
    throw asAppError(error);
  }
}

export async function removeMemberFromOrg(
  userId: string,
  organizationId: string,
  targetUserId: string,
): Promise<void> {
  try {
    await withUser(userId, async (db) => {
      await requireMembership(db, organizationId, userId, "admin");
      // owner 行由 fk_organization_owner RESTRICT 兜底（23001 → 409）。
      const removed = await removeMemberRecord(db, organizationId, targetUserId);
      if (!removed) throw organizationNotFound();
    });
  } catch (error) {
    throw asAppError(error);
  }
}

export async function listInvitesForOrg(
  userId: string,
  organizationId: string,
  options: { cursor?: string; limit?: number },
): Promise<{ items: InviteListItem[]; nextCursor: string | null }> {
  try {
    return await withUser(userId, async (db) => {
      await requireMembership(db, organizationId, userId, "admin");
      return listInvites(db, organizationId, {
        cursor: options.cursor,
        limit: options.limit ?? 50,
      });
    });
  } catch (error) {
    throw asAppError(error);
  }
}

export async function createInviteForOrg(
  userId: string,
  organizationId: string,
  values: { email: string; role: MemberRole },
  origin: string,
): Promise<{ invite: InviteListItem; inviteUrl: string }> {
  try {
    return await withUser(userId, async (db) => {
      await requireMembership(db, organizationId, userId, "admin");

      // DM-INV-01：≥32 字节 CSPRNG，库存 sha256，明文只在本响应返回一次。
      const token = randomBytes(32).toString("base64url");
      const tokenHash = createHash("sha256").update(token, "utf8").digest();
      const invite = await insertInviteRecord(db, organizationId, {
        email: values.email,
        role: values.role,
        tokenHash,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        invitedBy: userId,
      });
      return { invite, inviteUrl: `${origin}/#/invite/${token}` };
    });
  } catch (error) {
    throw asAppError(error);
  }
}

export async function revokeInviteForOrg(
  userId: string,
  organizationId: string,
  inviteId: string,
): Promise<void> {
  try {
    await withUser(userId, async (db) => {
      await requireMembership(db, organizationId, userId, "admin");
      const existing = await getInviteRecord(db, organizationId, inviteId);
      if (!existing || existing.status !== "pending") {
        throw organizationNotFound();
      }
      await revokeInviteViaFunction(db, inviteId, "");
    });
  } catch (error) {
    throw asAppError(error);
  }
}

export async function transferOwnerForOrg(
  userId: string,
  organizationId: string,
  newOwnerUserId: string,
): Promise<{ ownerUserId: string }> {
  try {
    return await withUser(userId, async (db) => {
      // 非成员先 404，避免受控函数的 GX006 泄漏组织存在性（FR-009）。
      await requireMembership(db, organizationId, userId, null);
      await transferOwnershipViaFunction(db, organizationId, newOwnerUserId);
      return { ownerUserId: newOwnerUserId };
    });
  } catch (error) {
    throw asAppError(error);
  }
}

export async function updateOrganizationForUser(
  userId: string,
  organizationId: string,
  patch: { name?: string; status?: string },
): Promise<OrganizationDetail> {
  try {
    return await withUser(userId, async (db) => {
      await requireMembership(db, organizationId, userId, "admin");
      if (patch.status !== undefined && patch.status !== "archived") {
        throw new AppError("VALIDATION", "仅支持归档操作", 400);
      }
      const status = await organizationStatus(db, organizationId);
      if (status !== "active") {
        throw conflict("组织已归档，无法写入");
      }
      await updateOrganizationRecord(db, organizationId, patch);
      const detail = await getOrganizationDetail(db, organizationId, userId);
      if (!detail) throw organizationNotFound();
      return detail;
    });
  } catch (error) {
    throw asAppError(error);
  }
}

export async function leaveOrganizationForUser(
  userId: string,
  organizationId: string,
): Promise<void> {
  try {
    await withUser(userId, async (db) => {
      const role = await membershipRole(db, organizationId, userId);
      if (role === null) throw organizationNotFound();
      const ownerId = await organizationOwnerId(db, organizationId);
      if (ownerId === userId) {
        throw conflict("请先转移所有权再退出组织");
      }
      const removed = await removeMemberRecord(db, organizationId, userId);
      if (!removed) throw organizationNotFound();
    });
  } catch (error) {
    throw asAppError(error);
  }
}
