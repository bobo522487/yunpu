import { z } from "zod";
import {
  API_RELATION_KINDS,
  ARTICLE_DOC_TYPES,
  ARTICLE_PRIVACIES,
  ARTICLE_STATUSES,
  BOOK_BINDING_STYLES,
  BOOK_EDITION_PRINT_STATUSES,
  BOOK_LINEAGE_STYLES,
  BOOK_PAPER_SIZES,
  FOLDER_KINDS,
  INVITE_STATUSES,
  MEMBER_ROLES,
  ORGANIZATION_STATUSES,
  PERSON_EVENT_TYPES,
  PERSON_NAME_KINDS,
  PERSON_SEXES,
  PROJECT_COLOR_THEMES,
  PROJECT_STATUSES,
} from "./enums.ts";
import {
  ArticleCitationSchema,
  ArticleContentJsonSchema,
  BookLayoutConfigSchema,
  BookSectionsSchema,
  CompiledPageSchema,
  GenealogyDateSchema,
  GenealogyPlaceSchema,
  PersonBirthInfoSchema,
  PersonDeathInfoSchema,
} from "./schemas.ts";

const id = z.uuid();
const timestamp = z.iso.datetime();
const nullableText = z.string().nullable();

export const ErrorResponseSchema = z.object({
  ok: z.literal(false),
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});
export type ErrorResponseDto = z.infer<typeof ErrorResponseSchema>;

export const okOnlySchema = z.object({ ok: z.literal(true) });

export const okDataSchema = <T extends z.ZodType>(data: T) =>
  z.object({ ok: z.literal(true), data });

export type Page<T> = {
  items: T[];
  nextCursor: string | null;
};

export function createPageSchema<T extends z.ZodType>(item: T, key = "items") {
  return z.object({
    [key]: z.array(item),
    nextCursor: z.string().nullable(),
  });
}

// ---- Account & Organization ----

export const AccountSchema = z.object({
  id,
  email: z.email(),
  name: z.string(),
});
export type AccountRecord = z.infer<typeof AccountSchema>;

export const OrganizationSummarySchema = z.object({
  id,
  name: z.string(),
  role: z.enum(MEMBER_ROLES),
  isOwner: z.boolean(),
});
export type OrganizationSummary = z.infer<typeof OrganizationSummarySchema>;

export const OrganizationListItemSchema = OrganizationSummarySchema.extend({
  lastUsedAt: timestamp.nullable(),
});
export type OrganizationListItem = z.infer<typeof OrganizationListItemSchema>;

export const OrganizationsPayloadSchema = z.object({
  organizations: z.array(OrganizationListItemSchema),
  defaultOrganizationId: id.nullable(),
});
export type OrganizationsPayload = z.infer<typeof OrganizationsPayloadSchema>;

export const OrganizationDetailSchema = OrganizationSummarySchema.omit({
  role: true,
}).extend({
  status: z.enum(ORGANIZATION_STATUSES),
  ownerUserId: id,
  myRole: z.enum(MEMBER_ROLES),
  memberCount: z.number().int().nonnegative(),
  pendingInviteCount: z.number().int().nonnegative(),
  projectCount: z.number().int().nonnegative(),
});
export type OrganizationDetail = z.infer<typeof OrganizationDetailSchema>;

export const MemberSchema = z.object({
  userId: id,
  name: z.string(),
  email: z.email(),
  role: z.enum(MEMBER_ROLES),
  isOwner: z.boolean(),
  joinedAt: timestamp,
});
export type MemberRecord = z.infer<typeof MemberSchema>;

export const InviteSchema = z.object({
  id,
  email: z.email(),
  role: z.enum(MEMBER_ROLES),
  status: z.enum(INVITE_STATUSES),
  expiresAt: timestamp,
  createdAt: timestamp,
});
export type InviteRecord = z.infer<typeof InviteSchema>;

export const AuthDataSchema = z.object({
  user: AccountSchema,
  defaultOrganization: OrganizationSummarySchema.nullable(),
  invite: z.unknown().optional(),
  onboarding: z.boolean().optional(),
});
export type AuthDataPayload = z.infer<typeof AuthDataSchema>;

export const SessionDataSchema = z.object({
  user: AccountSchema.nullable(),
  defaultOrganization: OrganizationSummarySchema.nullable(),
  onboarding: z.boolean(),
});
export type SessionDataPayload = z.infer<typeof SessionDataSchema>;

// ---- Project & Folder ----

export const ProjectSchema = z.object({
  id,
  organizationId: id,
  name: z.string(),
  status: z.enum(PROJECT_STATUSES),
  surname: nullableText,
  ancestor: nullableText,
  hallName: nullableText,
  originText: nullableText,
  description: nullableText,
  colorTheme: z.enum(PROJECT_COLOR_THEMES),
  projectLevel: z.number().int(),
  iconKey: nullableText,
  version: z.number().int().positive(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type ProjectRecord = z.infer<typeof ProjectSchema>;

export const FolderSchema = z.object({
  id,
  projectId: id,
  kind: z.enum(FOLDER_KINDS),
  name: z.string(),
  seq: z.number().int().nonnegative(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type FolderDto = z.infer<typeof FolderSchema>;

// ---- Article & Book ----

export const ArticleSchema = z.object({
  id,
  projectId: id,
  folderId: id.nullable(),
  seq: z.number().int().nonnegative(),
  title: z.string(),
  subtitle: z.string(),
  author: z.string(),
  docType: z.enum(ARTICLE_DOC_TYPES),
  status: z.enum(ARTICLE_STATUSES),
  privacy: z.enum(ARTICLE_PRIVACIES),
  contentJson: ArticleContentJsonSchema,
  contentHtml: z.string(),
  linkedPersonIds: z.array(z.string()),
  linkedChartIds: z.array(z.string()),
  citations: z.array(ArticleCitationSchema),
  wordCount: z.number().int().nonnegative(),
  version: z.number().int().positive(),
  updatedBy: id.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type ArticleDto = z.infer<typeof ArticleSchema>;

export const ArticleRevisionSchema = z.object({
  id,
  projectId: id,
  articleId: id,
  version: z.number().int().positive(),
  title: z.string(),
  status: z.enum(ARTICLE_STATUSES),
  contentJson: ArticleContentJsonSchema,
  contentHtml: z.string(),
  wordCount: z.number().int().nonnegative(),
  summary: z.string(),
  authorName: z.string(),
  createdBy: id.nullable(),
  createdAt: timestamp,
});
export type ArticleRevisionDto = z.infer<typeof ArticleRevisionSchema>;

export const ArticlesDirectoryPayloadSchema = z.object({
  folders: z.array(FolderSchema),
  articles: z.array(ArticleSchema),
});
export type ArticlesDirectoryPayload = z.infer<
  typeof ArticlesDirectoryPayloadSchema
>;

export const BookSchema = z.object({
  id,
  projectId: id,
  folderId: id.nullable(),
  bookName: z.string(),
  headerName: z.string(),
  hallName: z.string(),
  volumeNo: z.string(),
  editor: z.string(),
  compilationDate: z.string(),
  sections: BookSectionsSchema,
  layoutConfig: BookLayoutConfigSchema,
  seq: z.number().int().nonnegative(),
  version: z.number().int().positive(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type BookDto = z.infer<typeof BookSchema>;

export const BookEditionSchema = z.object({
  id,
  projectId: id,
  bookId: id,
  bindingStyle: z.enum(BOOK_BINDING_STYLES),
  lineageStyle: z.enum(BOOK_LINEAGE_STYLES),
  paperSize: z.enum(BOOK_PAPER_SIZES),
  pageCount: z.number().int().nonnegative(),
  memberCount: z.number().int().nonnegative(),
  wordCount: z.number().int().nonnegative(),
  printStatus: z.enum(BOOK_EDITION_PRINT_STATUSES),
  layoutSnapshot: BookLayoutConfigSchema,
  pages: z.array(CompiledPageSchema),
  createdAt: timestamp,
});
export type BookEditionDto = z.infer<typeof BookEditionSchema>;

// ---- Genealogy: Lineage, Person, Relation, Projection ----

export const LineageSchema = z.object({
  id,
  projectId: id,
  folderId: id.nullable(),
  name: z.string(),
  surname: nullableText,
  hallName: nullableText,
  progenitor: nullableText,
  region: GenealogyPlaceSchema.nullable(),
  seq: z.number().int().nonnegative(),
  version: z.number().int().positive(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type LineageDto = z.infer<typeof LineageSchema>;

export const LineageDirectoryPayloadSchema = z.object({
  folders: z.array(FolderSchema),
  lineages: z.array(LineageSchema),
});
export type LineageDirectoryPayload = z.infer<
  typeof LineageDirectoryPayloadSchema
>;

export const PersonNameSchema = z.object({
  id,
  projectId: id,
  personId: id,
  kind: z.enum(PERSON_NAME_KINDS),
  value: z.string(),
  surname: nullableText,
  romanizedSurname: nullableText,
  romanizedName: nullableText,
  label: nullableText,
  isPrimary: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type PersonNameDto = z.infer<typeof PersonNameSchema>;

export const PersonEventSchema = z.object({
  id,
  projectId: id,
  personId: id,
  type: z.enum(PERSON_EVENT_TYPES),
  structuredDate: GenealogyDateSchema.nullable(),
  structuredPlace: GenealogyPlaceSchema.nullable(),
  description: nullableText,
  sortOrder: z.number().int().nonnegative(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type PersonEventDto = z.infer<typeof PersonEventSchema>;

export const PersonSchema = z.object({
  id,
  projectId: id,
  lineageId: id,
  displayName: z.string(),
  sex: z.enum(PERSON_SEXES),
  surname: nullableText,
  givenName: nullableText,
  romanizedSurname: nullableText,
  romanizedName: nullableText,
  romanizedSuffix: nullableText,
  birthYear: z.number().int().nullable(),
  deathYear: z.number().int().nullable(),
  isLiving: z.boolean(),
  birthInfo: PersonBirthInfoSchema.nullable(),
  deathInfo: PersonDeathInfoSchema.nullable(),
  generationWord: nullableText,
  relationTitle: nullableText,
  siblingOrder: z.number().int().nonnegative().nullable(),
  biography: nullableText,
  notes: nullableText,
  avatarKey: nullableText,
  version: z.number().int().positive(),
  createdAt: timestamp,
  updatedAt: timestamp,
  names: z.array(PersonNameSchema).optional(),
  events: z.array(PersonEventSchema).optional(),
});
export type PersonDto = z.infer<typeof PersonSchema>;

export const RelationSchema = z.object({
  id,
  projectId: id,
  fromPersonId: id,
  toPersonId: id,
  kind: z.enum(API_RELATION_KINDS),
  fromRoleLabel: nullableText,
  toRoleLabel: nullableText,
  sortOrder: z.number().int().nonnegative().nullable(),
  note: nullableText,
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type RelationDto = z.infer<typeof RelationSchema>;

export const ProjectionSchema = z.object({
  personId: id,
  primaryPath: z.string(),
  generation: z.number().int().nonnegative(),
});
export type ProjectionDto = z.infer<typeof ProjectionSchema>;

export const LineageGraphPayloadSchema = z.object({
  lineage: LineageSchema,
  persons: z.array(PersonSchema),
  relations: z.array(RelationSchema),
  projections: z.array(ProjectionSchema),
});
export type LineageGraphPayload = z.infer<typeof LineageGraphPayloadSchema>;

export const SubgraphPayloadSchema = z.object({
  rootPersonId: id,
  persons: z.array(PersonSchema),
  relations: z.array(RelationSchema),
  hasMoreAncestors: z.boolean(),
  hasMoreDescendants: z.boolean(),
});
export type SubgraphPayload = z.infer<typeof SubgraphPayloadSchema>;
