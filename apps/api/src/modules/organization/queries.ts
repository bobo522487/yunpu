import { authUser, invite, organization, organizationMember } from "@yunpu/db";
import type { InviteStatus, MemberRole } from "@yunpu/shared";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { TxDatabase } from "../../db/with-tenant-transaction";
import { isoTimestamp as timestamp } from "../../lib/sql";

export type OrganizationSummary = {
  id: string;
  name: string;
  role: string;
  isOwner: boolean;
};

export type OrganizationListItem = OrganizationSummary & {
  lastUsedAt: Date | null;
};

const summaryColumns = {
  id: organization.id,
  name: organization.name,
  role: organizationMember.role,
  isOwner: sql<boolean>`${organization.ownerUserId} = ${organizationMember.userId}`,
};

export async function findDefaultOrganization(
  db: TxDatabase,
  userId: string,
): Promise<OrganizationSummary | null> {
  const rows = await db
    .select(summaryColumns)
    .from(organizationMember)
    .innerJoin(
      organization,
      eq(organization.id, organizationMember.organizationId),
    )
    .where(
      and(
        eq(organizationMember.userId, userId),
        eq(organization.status, "active"),
      ),
    )
    .orderBy(
      sql`${organizationMember.lastUsedAt} DESC NULLS LAST`,
      asc(organizationMember.createdAt),
      asc(organization.id),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function listOrganizations(
  db: TxDatabase,
  userId: string,
): Promise<OrganizationListItem[]> {
  return db
    .select({ ...summaryColumns, lastUsedAt: organizationMember.lastUsedAt })
    .from(organizationMember)
    .innerJoin(
      organization,
      eq(organization.id, organizationMember.organizationId),
    )
    .where(
      and(
        eq(organizationMember.userId, userId),
        eq(organization.status, "active"),
      ),
    )
    .orderBy(
      sql`${organizationMember.lastUsedAt} DESC NULLS LAST`,
      asc(organizationMember.createdAt),
      asc(organization.id),
    );
}

export async function getOrganizationSummary(
  db: TxDatabase,
  organizationId: string,
  userId: string,
): Promise<OrganizationSummary | null> {
  const rows = await db
    .select(summaryColumns)
    .from(organizationMember)
    .innerJoin(
      organization,
      eq(organization.id, organizationMember.organizationId),
    )
    .where(
      and(
        eq(organization.id, organizationId),
        eq(organizationMember.userId, userId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export type OrganizationDetail = {
  id: string;
  name: string;
  status: "active" | "suspended" | "archived";
  ownerUserId: string;
  myRole: MemberRole;
  isOwner: boolean;
  memberCount: number;
  pendingInviteCount: number;
  projectCount: number;
};

/** 组织详情：非成员返回 null（路由映射为 404「不存在或无权」，不泄漏存在性）。 */
export async function getOrganizationDetail(
  db: TxDatabase,
  organizationId: string,
  userId: string,
): Promise<OrganizationDetail | null> {
  const rows = await db
    .select({
      id: organization.id,
      name: organization.name,
      status: organization.status,
      ownerUserId: organization.ownerUserId,
      myRole: organizationMember.role,
      isOwner: sql<boolean>`${organization.ownerUserId} = ${organizationMember.userId}`,
      memberCount: sql<number>`(
        SELECT count(*) FROM public.organization_member m
        WHERE m.organization_id = ${organization.id}
      )`,
      pendingInviteCount: sql<number>`(
        SELECT count(*) FROM public.invite i
        WHERE i.organization_id = ${organization.id} AND i.status = 'pending'
      )`,
      projectCount: sql<number>`(
        SELECT count(*) FROM public.project p
        WHERE p.organization_id = ${organization.id}
      )`,
    })
    .from(organization)
    .innerJoin(
      organizationMember,
      and(
        eq(organizationMember.organizationId, organization.id),
        eq(organizationMember.userId, userId),
      ),
    )
    .where(eq(organization.id, organizationId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return {
    ...row,
    memberCount: Number(row.memberCount),
    pendingInviteCount: Number(row.pendingInviteCount),
    projectCount: Number(row.projectCount),
  };
}

export async function createOrganizationWithFunction(
  db: TxDatabase,
  name: string,
): Promise<string> {
  const result = await db.execute<{ id: string }>(
    sql`SELECT app.create_organization(${name}) AS id`,
  );
  const rows = (result as unknown as { rows: { id: string }[] }).rows;
  const id = rows[0]?.id;
  if (!id) throw new Error("app.create_organization returned no id");
  return id;
}

export async function acceptInviteWithFunction(
  db: TxDatabase,
  token: string,
): Promise<string> {
  const result = await db.execute<{ org_id: string }>(
    sql`SELECT app.accept_invite(${token}) AS org_id`,
  );
  const rows = (result as unknown as { rows: { org_id: string }[] }).rows;
  const id = rows[0]?.org_id;
  if (!id) throw new Error("app.accept_invite returned no organization");
  return id;
}

export async function activateOrganization(
  db: TxDatabase,
  organizationId: string,
  userId: string,
): Promise<boolean> {
  const updated = await db
    .update(organizationMember)
    .set({ lastUsedAt: sql`clock_timestamp()` })
    .where(
      and(
        eq(organizationMember.organizationId, organizationId),
        eq(organizationMember.userId, userId),
        sql`EXISTS (SELECT 1 FROM ${organization} o WHERE o.id = ${organizationId} AND o.status = 'active')`,
      ),
    )
    .returning({ organizationId: organizationMember.organizationId });

  return updated.length > 0;
}

// ---- 控制台：成员 / 邀请 / 所有权 ----

export type MemberListItem = {
  userId: string;
  name: string;
  email: string;
  role: MemberRole;
  isOwner: boolean;
  joinedAt: string;
};

const memberColumns = {
  userId: organizationMember.userId,
  name: authUser.name,
  email: authUser.email,
  role: organizationMember.role,
  isOwner: sql<boolean>`${organization.ownerUserId} = ${organizationMember.userId}`,
  joinedAt: timestamp(organizationMember.createdAt),
};

export async function listMembers(
  db: TxDatabase,
  organizationId: string,
  options: { cursor?: string; limit: number },
): Promise<{ items: MemberListItem[]; nextCursor: string | null }> {
  const conditions = [eq(organizationMember.organizationId, organizationId)];
  if (options.cursor) {
    const separator = options.cursor.indexOf("|");
    const joinedAt = options.cursor.slice(0, separator);
    const userId = options.cursor.slice(separator + 1);
    conditions.push(
      sql`(${organizationMember.createdAt}, ${organizationMember.userId}) < (${joinedAt}::timestamptz, ${userId}::uuid)`,
    );
  }

  const rows = await db
    .select(memberColumns)
    .from(organizationMember)
    .innerJoin(authUser, eq(authUser.id, organizationMember.userId))
    .innerJoin(
      organization,
      eq(organization.id, organizationMember.organizationId),
    )
    .where(and(...conditions))
    .orderBy(
      desc(organizationMember.createdAt),
      desc(organizationMember.userId),
    )
    .limit(options.limit);

  const last = rows[rows.length - 1];
  return {
    items: rows,
    nextCursor:
      rows.length === options.limit && last
        ? `${last.joinedAt}|${last.userId}`
        : null,
  };
}

export async function getMemberRecord(
  db: TxDatabase,
  organizationId: string,
  userId: string,
): Promise<MemberListItem | null> {
  const rows = await db
    .select(memberColumns)
    .from(organizationMember)
    .innerJoin(authUser, eq(authUser.id, organizationMember.userId))
    .innerJoin(
      organization,
      eq(organization.id, organizationMember.organizationId),
    )
    .where(
      and(
        eq(organizationMember.organizationId, organizationId),
        eq(organizationMember.userId, userId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function updateMemberRoleRecord(
  db: TxDatabase,
  organizationId: string,
  userId: string,
  role: MemberRole,
): Promise<boolean> {
  const rows = await db
    .update(organizationMember)
    .set({ role, updatedAt: sql`clock_timestamp()` })
    .where(
      and(
        eq(organizationMember.organizationId, organizationId),
        eq(organizationMember.userId, userId),
      ),
    )
    .returning({ userId: organizationMember.userId });
  return rows.length > 0;
}

/** owner 行由 `fk_organization_owner` RESTRICT 兜底（23001 → 409）。 */
export async function removeMemberRecord(
  db: TxDatabase,
  organizationId: string,
  userId: string,
): Promise<boolean> {
  const rows = await db
    .delete(organizationMember)
    .where(
      and(
        eq(organizationMember.organizationId, organizationId),
        eq(organizationMember.userId, userId),
      ),
    )
    .returning({ userId: organizationMember.userId });
  return rows.length > 0;
}

export async function organizationOwnerId(
  db: TxDatabase,
  organizationId: string,
): Promise<string | null> {
  const rows = await db
    .select({ ownerUserId: organization.ownerUserId })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);
  return rows[0]?.ownerUserId ?? null;
}

/** 组织状态（RLS 内）：不可见组织返回 null。 */
export async function organizationStatus(
  db: TxDatabase,
  organizationId: string,
): Promise<"active" | "suspended" | "archived" | null> {
  const rows = await db
    .select({ status: organization.status })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);
  return rows[0]?.status ?? null;
}

/** 组织改名 / 归档（RLS WITH CHECK 兜底；调用方负责权限与状态前置）。 */
export async function updateOrganizationRecord(
  db: TxDatabase,
  organizationId: string,
  patch: { name?: string; status?: string },
): Promise<void> {
  const set: Record<string, unknown> = { updatedAt: sql`clock_timestamp()` };
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.status !== undefined) set.status = patch.status;
  await db
    .update(organization)
    .set(set)
    .where(eq(organization.id, organizationId))
    .returning({ id: organization.id });
}

export type InviteListItem = {
  id: string;
  email: string;
  role: MemberRole;
  status: InviteStatus;
  expiresAt: string;
  createdAt: string;
};

const inviteColumns = {
  id: invite.id,
  email: invite.email,
  role: invite.role,
  status: invite.status,
  expiresAt: timestamp(invite.expiresAt),
  createdAt: timestamp(invite.createdAt),
};

export async function listInvites(
  db: TxDatabase,
  organizationId: string,
  options: { cursor?: string; limit: number },
): Promise<{ items: InviteListItem[]; nextCursor: string | null }> {
  const conditions = [eq(invite.organizationId, organizationId)];
  if (options.cursor) {
    const separator = options.cursor.indexOf("|");
    const createdAt = options.cursor.slice(0, separator);
    const id = options.cursor.slice(separator + 1);
    conditions.push(
      sql`(${invite.createdAt}, ${invite.id}) < (${createdAt}::timestamptz, ${id}::uuid)`,
    );
  }

  const rows = await db
    .select(inviteColumns)
    .from(invite)
    .where(and(...conditions))
    .orderBy(desc(invite.createdAt), desc(invite.id))
    .limit(options.limit);

  const last = rows[rows.length - 1];
  return {
    items: rows,
    nextCursor:
      rows.length === options.limit && last
        ? `${last.createdAt}|${last.id}`
        : null,
  };
}

export async function getInviteRecord(
  db: TxDatabase,
  organizationId: string,
  inviteId: string,
): Promise<InviteListItem | null> {
  const rows = await db
    .select(inviteColumns)
    .from(invite)
    .where(
      and(eq(invite.id, inviteId), eq(invite.organizationId, organizationId)),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function insertInviteRecord(
  db: TxDatabase,
  organizationId: string,
  values: {
    email: string;
    role: MemberRole;
    tokenHash: Buffer;
    expiresAt: Date;
    invitedBy: string;
  },
): Promise<InviteListItem> {
  const rows = await db
    .insert(invite)
    .values({
      organizationId,
      email: values.email,
      role: values.role,
      tokenHash: values.tokenHash,
      expiresAt: values.expiresAt,
      invitedBy: values.invitedBy,
    })
    .returning(inviteColumns);
  return rows[0];
}

export async function revokeInviteViaFunction(
  db: TxDatabase,
  inviteId: string,
  reason: string,
): Promise<void> {
  await db.execute(sql`SELECT app.revoke_invite(${inviteId}, ${reason})`);
}

export async function transferOwnershipViaFunction(
  db: TxDatabase,
  organizationId: string,
  newOwnerUserId: string,
): Promise<void> {
  await db.execute(
    sql`SELECT app.transfer_organization_ownership(${organizationId}, ${newOwnerUserId})`,
  );
}
