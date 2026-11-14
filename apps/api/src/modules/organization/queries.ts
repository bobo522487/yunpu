import { and, asc, eq, sql } from "drizzle-orm";
import { organization, organizationMember } from "@yunpu/db";
import type { TxDatabase } from "../db/with-user";

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
    .innerJoin(organization, eq(organization.id, organizationMember.organizationId))
    .where(and(eq(organizationMember.userId, userId), eq(organization.status, "active")))
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
    .innerJoin(organization, eq(organization.id, organizationMember.organizationId))
    .where(and(eq(organizationMember.userId, userId), eq(organization.status, "active")))
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
    .innerJoin(organization, eq(organization.id, organizationMember.organizationId))
    .where(and(eq(organization.id, organizationId), eq(organizationMember.userId, userId)))
    .limit(1);

  return rows[0] ?? null;
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
