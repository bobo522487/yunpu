export const MEMBER_ROLES = ["admin", "editor", "viewer"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const ORGANIZATION_STATUSES = ["active", "archived"] as const;
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

/** API write subset now exposes all 7 database RELATION_KINDS. */
export const API_RELATION_KINDS = RELATION_KINDS;
export type ApiRelationKind = RelationKind;

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

export const PERSON_EVENT_TYPES = [
  "birth",
  "education",
  "career",
  "marriage",
  "residence",
  "death",
  "other",
] as const;
export type PersonEventType = (typeof PERSON_EVENT_TYPES)[number];

export const FOLDER_KINDS = ["lineage", "article", "book"] as const;
export type FolderKind = (typeof FOLDER_KINDS)[number];

export const ARTICLE_DOC_TYPES = [
  "preface",
  "rules",
  "origin",
  "motto",
  "biography",
  "inscription",
  "custom",
] as const;
export type ArticleDocType = (typeof ARTICLE_DOC_TYPES)[number];

export const ARTICLE_STATUSES = ["draft", "review", "approved"] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

export const ARTICLE_PRIVACIES = ["public", "clan", "editors"] as const;
export type ArticlePrivacy = (typeof ARTICLE_PRIVACIES)[number];

export const ARTICLE_CITATION_SOURCE_TYPES = [
  "old_genealogy",
  "stele",
  "gazetteer",
  "oral",
  "archive",
] as const;
export type ArticleCitationSourceType =
  (typeof ARTICLE_CITATION_SOURCE_TYPES)[number];

export const BOOK_BINDING_STYLES = ["thread", "hardcover"] as const;
export type BookBindingStyle = (typeof BOOK_BINDING_STYLES)[number];

export const BOOK_LINEAGE_STYLES = ["euler", "su", "modern_double"] as const;
export type BookLineageStyle = (typeof BOOK_LINEAGE_STYLES)[number];

export const BOOK_PAPER_SIZES = [
  "thread_185x290",
  "a4_210x297",
  "k16_185x260",
] as const;
export type BookPaperSize = (typeof BOOK_PAPER_SIZES)[number];

export const BOOK_BORDER_STYLES = ["double", "single", "none"] as const;
export type BookBorderStyle = (typeof BOOK_BORDER_STYLES)[number];

export const BOOK_FONT_FAMILIES = ["song", "kai", "fangsong", "hei"] as const;
export type BookFontFamily = (typeof BOOK_FONT_FAMILIES)[number];

export const BOOK_DENSITIES = ["loose", "standard", "compact"] as const;
export type BookDensity = (typeof BOOK_DENSITIES)[number];

export const BOOK_FISHTAIL_STYLES = [
  "black",
  "white",
  "double",
  "none",
] as const;
export type BookFishtailStyle = (typeof BOOK_FISHTAIL_STYLES)[number];

export const BOOK_PAGE_NUMBER_STYLES = ["chinese", "arabic"] as const;
export type BookPageNumberStyle = (typeof BOOK_PAGE_NUMBER_STYLES)[number];

export const BOOK_EDITION_PRINT_STATUSES = ["none", "finalized"] as const;
export type BookEditionPrintStatus =
  (typeof BOOK_EDITION_PRINT_STATUSES)[number];

export const TABLE_NAMES = [
  "organization",
  "organization_member",
  "invite",
  "audit_log",
  "project",
  "folder",
  "lineage",
  "person",
  "person_name",
  "person_relation",
  "person_event",
  "lineage_projection",
  "article",
  "article_revision",
  "book",
  "book_edition",
] as const;
export type TableName = (typeof TABLE_NAMES)[number];
