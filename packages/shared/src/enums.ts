export const MEMBER_ROLES = ["admin", "editor", "viewer"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const ORGANIZATION_STATUSES = [
  "active",
  "suspended",
  "archived",
] as const;
export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];

export const INVITE_STATUSES = ["pending", "accepted", "revoked"] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];

export const PROJECT_STATUSES = [
  "planning",
  "in_progress",
  "completed",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_COLOR_THEMES = [
  "sky",
  "pink",
  "orange",
  "indigo",
  "emerald",
  "violet",
] as const;
export type ProjectColorTheme = (typeof PROJECT_COLOR_THEMES)[number];

export const PERSON_SEXES = ["male", "female", "unknown", "other"] as const;
export type PersonSex = (typeof PERSON_SEXES)[number];

export const RELATION_KINDS = [
  "biological_parent",
  "adoptive_parent",
  "ritual_heir",
  "step_parent",
  "foster_parent",
  "spouse",
  "partner",
] as const;
export type RelationKind = (typeof RELATION_KINDS)[number];

/** API write subset this batch accepts (DB still allows all RELATION_KINDS). */
export const API_RELATION_KINDS = [
  "biological_parent",
  "adoptive_parent",
  "spouse",
] as const;
export type ApiRelationKind = (typeof API_RELATION_KINDS)[number];

export const PERSON_NAME_KINDS = [
  "formal",
  "courtesy",
  "art",
  "milk",
  "genealogy",
  "posthumous",
  "other",
] as const;
export type PersonNameKind = (typeof PERSON_NAME_KINDS)[number];

export const TABLE_NAMES = [
  "organization",
  "organization_member",
  "invite",
  "audit_log",
  "project",
  "person",
  "person_name",
  "person_relation",
  "lineage_projection",
] as const;
export type TableName = (typeof TABLE_NAMES)[number];
