import { sql } from "drizzle-orm";
import {
  customType,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { ORGANIZATION_STATUSES, INVITE_STATUSES, MEMBER_ROLES } from "@yunpu/shared";
import { authUser } from "./auth";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const organization = pgTable(
  "organization",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    name: text("name").notNull(),
    status: text("status", { enum: ORGANIZATION_STATUSES }).notNull().default("active"),
    ownerUserId: uuid("owner_user_id").notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [index("idx_organization_owner").on(table.ownerUserId)],
);

export const organizationMember = pgTable(
  "organization_member",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "restrict" }),
    role: text("role", { enum: MEMBER_ROLES }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.userId] }),
    index("idx_organization_member_user").on(table.userId),
  ],
);

export const invite = pgTable(
  "invite",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    email: text("email").notNull(),
    role: text("role", { enum: MEMBER_ROLES }).notNull(),
    tokenHash: bytea("token_hash").notNull(),
    status: text("status", { enum: INVITE_STATUSES }).notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => authUser.id, { onDelete: "restrict" }),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("uk_invite_token_hash").on(table.tokenHash),
    uniqueIndex("uq_invite_pending_email")
      .on(table.organizationId, table.email)
      .where(sql`status = 'pending'`),
    index("idx_invite_org_status").on(table.organizationId, table.status),
    index("idx_invite_invited_by").on(table.invitedBy),
  ],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    organizationId: uuid("organization_id").notNull(),
    projectId: uuid("project_id"),
    actorUserId: uuid("actor_user_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    payload: jsonb("payload").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_audit_log_org_created").on(table.organizationId, table.createdAt),
    index("idx_audit_log_project_created").on(table.projectId, table.createdAt),
    index("idx_audit_log_entity").on(table.organizationId, table.entityType, table.entityId),
  ],
);
