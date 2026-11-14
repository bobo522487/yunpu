export const MEMBER_ROLES = ["admin", "editor", "viewer"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const ORGANIZATION_STATUSES = ["active", "suspended", "archived"] as const;
export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];

export const INVITE_STATUSES = ["pending", "accepted", "revoked"] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];

export const TABLE_NAMES = [
  "organization",
  "organization_member",
  "invite",
  "audit_log",
] as const;
export type TableName = (typeof TABLE_NAMES)[number];
