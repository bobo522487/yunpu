import { createHash, randomBytes } from "node:crypto";
import type { MemberRole } from "@yunpu/shared";
import { memberRole, requireMember } from "../../access";
import {
  type TxDatabase,
  withTenantTransaction,
} from "../../db/with-tenant-transaction";
import { AppError, conflict, notFound } from "../../lib/errors";
import {
  acceptInviteWithFunction,
  activateOrganization,
  createOrganizationWithFunction,
  findDefaultOrganization,
  getInviteRecord,
  getMemberRecord,
  getOrganizationDetail,
  getOrganizationSummary,
  type InviteListItem,
  insertInviteRecord,
  listInvites,
  listMembers,
  listOrganizations,
  type MemberListItem,
  type OrganizationDetail,
  type OrganizationListItem,
  type OrganizationSummary,
  organizationOwnerId,
  organizationStatus,
  removeMemberRecord,
  revokeInviteViaFunction,
  transferOwnershipViaFunction,
  updateMemberRoleRecord,
  updateOrganizationRecord,
} from "./queries";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type { OrganizationSummary } from "./queries";

export async function createOrganizationInTx(
  db: TxDatabase,
  userId: string,
  name: string,
): Promise<OrganizationSummary> {
  const organizationId = await createOrganizationWithFunction(db, name);
  const summary = await getOrganizationSummary(db, organizationId, userId);
  if (!summary) throw notFound();
  return summary;
}

export async function createOrganization(
  userId: string,
  name: string,
): Promise<OrganizationSummary> {
  return withTenantTransaction({ userId }, (db) =>
    createOrganizationInTx(db, userId, name),
  );
}

export async function listMyOrganizations(
  userId: string,
): Promise<OrganizationListItem[]> {
  return withTenantTransaction({ userId, readOnly: true }, (db) =>
    listOrganizations(db, userId),
  );
}

/** 非成员或组织不存在均抛出 404「目标不存在或已失效」，不泄漏存在性（FR-009）。 */
export async function getOrganization(
  userId: string,
  organizationId: string,
): Promise<OrganizationDetail> {
  return withTenantTransaction({ userId, readOnly: true }, async (db) => {
    const organization = await getOrganizationDetail(
      db,
      organizationId,
      userId,
    );
    if (!organization) {
      throw new AppError("NOT_FOUND", "目标不存在或已失效");
    }
    return organization;
  });
}

export async function resolveDefaultOrganization(
  userId: string,
): Promise<OrganizationSummary | null> {
  return withTenantTransaction({ userId, readOnly: true }, (db) =>
    findDefaultOrganization(db, userId),
  );
}

export async function activateOrganizationForUser(
  userId: string,
  organizationId: string,
): Promise<OrganizationSummary> {
  return withTenantTransaction({ userId }, async (db) => {
    const activated = await activateOrganization(db, organizationId, userId);
    if (!activated) throw notFound();
    const summary = await getOrganizationSummary(db, organizationId, userId);
    if (!summary) throw notFound();
    return summary;
  });
}

export async function acceptInvite(
  userId: string,
  token: string,
): Promise<OrganizationSummary> {
  return withTenantTransaction({ userId }, async (db) => {
    const organizationId = await acceptInviteWithFunction(db, token);
    const summary = await getOrganizationSummary(db, organizationId, userId);
    if (!summary) throw notFound();
    return summary;
  });
}

export async function listMembersForOrg(
  userId: string,
  organizationId: string,
  options: { cursor?: string; limit?: number },
): Promise<{ items: MemberListItem[]; nextCursor: string | null }> {
  return withTenantTransaction({ userId, readOnly: true }, async (db) => {
    await requireMember(db, organizationId, userId, null);
    return listMembers(db, organizationId, {
      cursor: options.cursor,
      limit: options.limit ?? 50,
    });
  });
}

export async function updateMemberRoleForOrg(
  userId: string,
  organizationId: string,
  targetUserId: string,
  role: MemberRole,
): Promise<MemberListItem> {
  return withTenantTransaction({ userId }, async (db) => {
    await requireMember(db, organizationId, userId, "admin");
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
    if (!updated) throw notFound();
    const member = await getMemberRecord(db, organizationId, targetUserId);
    if (!member) throw notFound();
    return member;
  });
}

export async function removeMemberFromOrg(
  userId: string,
  organizationId: string,
  targetUserId: string,
): Promise<void> {
  await withTenantTransaction({ userId }, async (db) => {
    await requireMember(db, organizationId, userId, "admin");
    // owner 行由 fk_organization_owner RESTRICT 兜底（23001 → 409）。
    const removed = await removeMemberRecord(db, organizationId, targetUserId);
    if (!removed) throw notFound();
  });
}

export async function listInvitesForOrg(
  userId: string,
  organizationId: string,
  options: { cursor?: string; limit?: number },
): Promise<{ items: InviteListItem[]; nextCursor: string | null }> {
  return withTenantTransaction({ userId, readOnly: true }, async (db) => {
    await requireMember(db, organizationId, userId, "admin");
    return listInvites(db, organizationId, {
      cursor: options.cursor,
      limit: options.limit ?? 50,
    });
  });
}

export async function createInviteForOrg(
  userId: string,
  organizationId: string,
  values: { email: string; role?: MemberRole },
  origin: string,
): Promise<{ invite: InviteListItem; inviteUrl: string }> {
  return withTenantTransaction({ userId }, async (db) => {
    await requireMember(db, organizationId, userId, "admin");

    // DM-INV-01：≥32 字节 CSPRNG，库存 sha256，明文只在本响应返回一次。
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token, "utf8").digest();
    const invite = await insertInviteRecord(db, organizationId, {
      email: values.email,
      // DB invite.role 列无默认值；缺省在入口/服务层落为 viewer。
      role: values.role ?? "viewer",
      tokenHash,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      invitedBy: userId,
    });
    return { invite, inviteUrl: `${origin}/#/invite/${token}` };
  });
}

export async function revokeInviteForOrg(
  userId: string,
  organizationId: string,
  inviteId: string,
): Promise<void> {
  await withTenantTransaction({ userId }, async (db) => {
    await requireMember(db, organizationId, userId, "admin");
    const existing = await getInviteRecord(db, organizationId, inviteId);
    if (!existing || existing.status !== "pending") {
      throw notFound();
    }
    await revokeInviteViaFunction(db, inviteId, "");
  });
}

export async function transferOwnerForOrg(
  userId: string,
  organizationId: string,
  newOwnerUserId: string,
): Promise<{ ownerUserId: string }> {
  return withTenantTransaction({ userId }, async (db) => {
    // 非成员先 404，避免受控函数的 GX006 泄漏组织存在性（FR-009）。
    await requireMember(db, organizationId, userId, null);
    await transferOwnershipViaFunction(db, organizationId, newOwnerUserId);
    return { ownerUserId: newOwnerUserId };
  });
}

export async function updateOrganizationForUser(
  userId: string,
  organizationId: string,
  patch: { name?: string; status?: string },
): Promise<OrganizationDetail> {
  return withTenantTransaction({ userId }, async (db) => {
    await requireMember(db, organizationId, userId, "admin");
    if (patch.status !== undefined && patch.status !== "archived") {
      throw new AppError("VALIDATION", "仅支持归档操作");
    }
    const status = await organizationStatus(db, organizationId);
    if (status !== "active") {
      throw conflict("组织已归档，无法写入");
    }
    await updateOrganizationRecord(db, organizationId, patch);
    const detail = await getOrganizationDetail(db, organizationId, userId);
    if (!detail) throw notFound();
    return detail;
  });
}

export async function leaveOrganizationForUser(
  userId: string,
  organizationId: string,
): Promise<void> {
  await withTenantTransaction({ userId }, async (db) => {
    const role = await memberRole(db, organizationId, userId);
    if (role === null) throw notFound();
    const ownerId = await organizationOwnerId(db, organizationId);
    if (ownerId === userId) {
      throw conflict("请先转移所有权再退出组织");
    }
    const removed = await removeMemberRecord(db, organizationId, userId);
    if (!removed) throw notFound();
  });
}
