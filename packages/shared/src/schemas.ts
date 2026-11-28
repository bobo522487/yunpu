import { z } from "zod";
import {
  API_RELATION_KINDS,
  ARTICLE_CITATION_SOURCE_TYPES,
  ARTICLE_DOC_TYPES,
  ARTICLE_PRIVACIES,
  ARTICLE_STATUSES,
  BOOK_BINDING_STYLES,
  BOOK_BORDER_STYLES,
  BOOK_DENSITIES,
  BOOK_EDITION_PRINT_STATUSES,
  BOOK_FISHTAIL_STYLES,
  BOOK_FONT_FAMILIES,
  BOOK_LINEAGE_STYLES,
  BOOK_PAGE_NUMBER_STYLES,
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

const normalizedEmail = z.string().trim().toLowerCase().pipe(z.email());

// FR-002：空密码、纯空白密码与少于 8 个字符的密码都必须拒绝，且提示里要说明最低要求。
// 密码本身不做 trim —— 首尾空格是合法字符，只拒绝「整体无实义」的输入。
const password = z
  .string()
  .min(8, "密码至少 8 个字符")
  .max(128, "密码最多 128 个字符")
  .refine((value) => value.trim().length > 0, {
    message: "密码不能为空或全为空白字符，至少 8 个字符",
  });

export const SignUpSchema = z.object({
  email: normalizedEmail,
  password,
  inviteToken: z.string().trim().min(1).optional(),
});
export type SignUpInput = z.infer<typeof SignUpSchema>;

export const SignInSchema = z.object({
  email: normalizedEmail,
  password: z.string().min(1, "请输入密码").max(128),
});
export type SignInInput = z.infer<typeof SignInSchema>;

export const CreateOrganizationSchema = z.object({
  name: z.string().trim().min(1, "组织名不能为空").max(120),
});
export type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>;

export const UpdateOrganizationSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    status: z.enum(ORGANIZATION_STATUSES).optional(),
  })
  .refine((value) => value.name !== undefined || value.status !== undefined, {
    message: "至少提供一个要修改的字段",
  });
export type UpdateOrganizationInput = z.infer<typeof UpdateOrganizationSchema>;

export const AcceptInviteSchema = z.object({
  token: z.string().trim().min(1, "邀请 token 不能为空"),
});
export type AcceptInviteInput = z.infer<typeof AcceptInviteSchema>;

export const OrganizationIdParamsSchema = z.object({
  organizationId: z.uuid(),
});
export type OrganizationIdParams = z.infer<typeof OrganizationIdParamsSchema>;

export const MemberParamsSchema = z.object({
  organizationId: z.uuid(),
  userId: z.uuid(),
});
export type MemberParams = z.infer<typeof MemberParamsSchema>;

export const InviteParamsSchema = z.object({
  organizationId: z.uuid(),
  inviteId: z.uuid(),
});
export type InviteParams = z.infer<typeof InviteParamsSchema>;

export const MediaPathParamsSchema = z.object({
  path: z.string(),
});
export type MediaPathParams = z.infer<typeof MediaPathParamsSchema>;

export const RoleSchema = z.enum(MEMBER_ROLES);
export const InviteStatusSchema = z.enum(INVITE_STATUSES);

export const UpdateAccountSchema = z.object({
  name: z.string().trim().min(1, "显示名不能为空").max(100),
});
export type UpdateAccountInput = z.infer<typeof UpdateAccountSchema>;

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "请输入当前密码").max(128),
  newPassword: password,
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

export const CreateInviteSchema = z.object({
  email: normalizedEmail,
  role: RoleSchema.optional().meta({ default: "viewer" }),
});
export type CreateInviteInput = z.infer<typeof CreateInviteSchema>;

export const UpdateMemberRoleSchema = z.object({
  role: RoleSchema,
});
export type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleSchema>;

export const TransferOwnerSchema = z.object({
  newOwnerUserId: z.uuid(),
});
export type TransferOwnerInput = z.infer<typeof TransferOwnerSchema>;

const optionalNonBlank = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((value) => value.length > 0, { message: "不能为空白" })
    .optional();

export const CreateProjectSchema = z.object({
  name: z.string().trim().min(1, "项目名不能为空").max(120),
  status: z.enum(PROJECT_STATUSES).optional(),
  surname: optionalNonBlank(50),
  ancestor: optionalNonBlank(120),
  hallName: optionalNonBlank(50),
  originText: z.string().trim().max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  colorTheme: z.enum(PROJECT_COLOR_THEMES).optional(),
  projectLevel: z.coerce.number().int().min(1).max(5).optional(),
  iconKey: optionalNonBlank(255),
});
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = z
  .object({
    name: z.string().trim().min(1, "项目名不能为空").max(120).optional(),
    status: z.enum(PROJECT_STATUSES).optional(),
    surname: optionalNonBlank(50).nullable().optional(),
    ancestor: optionalNonBlank(120).nullable().optional(),
    hallName: optionalNonBlank(50).nullable().optional(),
    originText: z.string().trim().max(200).nullable().optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    colorTheme: z.enum(PROJECT_COLOR_THEMES).optional(),
    projectLevel: z.coerce.number().int().min(1).max(5).optional(),
    iconKey: optionalNonBlank(255).nullable().optional(),
    version: z.coerce.number().int().positive(),
  })
  .refine((value) => Object.keys(value).some((key) => key !== "version"), {
    message: "至少提供一个要修改的字段",
  });
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

export const GenealogyPlaceSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.enum(["structured", "phrase"]),
  countryCode: z.string().trim().max(16).optional(),
  country: z.string().trim().max(120).optional(),
  provinceCode: z.string().trim().max(32).optional(),
  province: z.string().trim().max(120).optional(),
  cityCode: z.string().trim().max(32).optional(),
  city: z.string().trim().max(120).optional(),
  districtCode: z.string().trim().max(32).optional(),
  district: z.string().trim().max(120).optional(),
  originalText: z.string().trim().max(500).nullable().optional(),
});
export type GenealogyPlaceInput = z.infer<typeof GenealogyPlaceSchema>;

const DateTimeValueSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("traditional_hour"),
    branch: z.enum([
      "zi",
      "chou",
      "yin",
      "mao",
      "chen",
      "si",
      "wu",
      "wei",
      "shen",
      "you",
      "xu",
      "hai",
    ]),
    subPeriod: z.enum(["early", "late"]).optional(),
  }),
  z.object({
    type: z.literal("clock"),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
  }),
]);

const CalendarDatePartsSchema = z.union([
  z.object({
    year: z.number().int().min(-5000).max(9999),
    month: z.number().int().min(1).max(12).nullable().optional(),
    isLeapMonth: z.boolean().optional(),
    day: z.number().int().min(1).max(31).nullable().optional(),
  }),
  z.object({
    dynastyId: z.string().max(64).optional(),
    eraId: z.string().max(64).optional(),
    eraName: z.string().min(1).max(64),
    yearInEra: z.number().int().min(1).max(200),
    month: z.number().int().min(1).max(12).nullable().optional(),
    isLeapMonth: z.boolean().optional(),
    day: z.number().int().min(1).max(31).nullable().optional(),
  }),
  z.object({
    cycleYear: z.string().min(1).max(16),
    cycleIndex: z.number().int().min(0).max(59),
    basis: z.enum(["lunar_new_year", "lichun"]),
  }),
]);

const CalendarDatePointSchema = z.object({
  calendar: z.enum(["gregorian", "chinese_lunisolar", "regnal", "sexagenary"]),
  precision: z.enum(["year", "month", "day"]),
  parts: CalendarDatePartsSchema,
});

const NormalizedDateSchema = z.object({
  status: z.enum(["exact", "period", "ambiguous", "unsupported"]),
  calendarBasis: z
    .enum([
      "gregorian",
      "julian",
      "julian_gregorian_hybrid",
      "historical_chinese",
    ])
    .optional(),
  start: z.string().max(32).nullable().optional(),
  end: z.string().max(32).nullable().optional(),
  engine: z.string().max(64).optional(),
  engineVersion: z.string().max(64).optional(),
  note: z.string().max(500).optional(),
});

export const GenealogyDateSchema = z.discriminatedUnion("kind", [
  z.object({
    schemaVersion: z.literal(1),
    kind: z.literal("date"),
    calendar: z.enum([
      "gregorian",
      "chinese_lunisolar",
      "regnal",
      "sexagenary",
    ]),
    qualifier: z.enum(["exact", "about", "before", "after"]),
    precision: z.enum(["year", "month", "day"]),
    parts: CalendarDatePartsSchema,
    time: DateTimeValueSchema.nullable().optional(),
    originalText: z.string().max(500).nullable().optional(),
    normalized: NormalizedDateSchema.nullable().optional(),
  }),
  z.object({
    schemaVersion: z.literal(1),
    kind: z.literal("range"),
    start: CalendarDatePointSchema,
    end: CalendarDatePointSchema,
    time: DateTimeValueSchema.nullable().optional(),
    originalText: z.string().max(500).nullable().optional(),
  }),
  z.object({
    schemaVersion: z.literal(1),
    kind: z.literal("phrase"),
    originalText: z.string().trim().min(1).max(500),
    calendarHint: z
      .enum(["gregorian", "chinese_lunisolar", "regnal", "sexagenary"])
      .nullable()
      .optional(),
    time: DateTimeValueSchema.nullable().optional(),
  }),
]);
export type GenealogyDateInput = z.infer<typeof GenealogyDateSchema>;

export const PersonBirthInfoSchema = z.object({
  structuredDate: GenealogyDateSchema.nullable().optional(),
  structuredPlace: GenealogyPlaceSchema.nullable().optional(),
  summary: z.string().trim().max(500).optional(),
});
export type PersonBirthInfoInput = z.infer<typeof PersonBirthInfoSchema>;

export const PersonDeathInfoSchema = z.object({
  structuredDate: GenealogyDateSchema.nullable().optional(),
  structuredPlace: GenealogyPlaceSchema.nullable().optional(),
  structuredBurialDate: GenealogyDateSchema.nullable().optional(),
  structuredBurialPlace: GenealogyPlaceSchema.nullable().optional(),
  cause: z.string().trim().max(500).optional(),
  summary: z.string().trim().max(500).optional(),
  manualAge: z.coerce.number().int().min(0).max(200).optional(),
});
export type PersonDeathInfoInput = z.infer<typeof PersonDeathInfoSchema>;

export const CreateFolderSchema = z.object({
  name: z.string().trim().min(1, "分组名不能为空").max(120),
  kind: z.enum(FOLDER_KINDS).optional(),
  seq: z.coerce.number().int().min(0).optional(),
});
export type CreateFolderInput = z.infer<typeof CreateFolderSchema>;

export const ListFoldersQuerySchema = z.object({
  kind: z.enum(FOLDER_KINDS).optional(),
});
export type ListFoldersQueryInput = z.infer<typeof ListFoldersQuerySchema>;

export const UpdateFolderSchema = z
  .object({
    name: z.string().trim().min(1, "分组名不能为空").max(120).optional(),
    seq: z.coerce.number().int().min(0).optional(),
  })
  .refine((value) => value.name !== undefined || value.seq !== undefined, {
    message: "至少提供一个要修改的字段",
  });
export type UpdateFolderInput = z.infer<typeof UpdateFolderSchema>;

export const CreateLineageSchema = z.object({
  name: z.string().trim().min(1, "谱系名称不能为空").max(120),
  folderId: z.uuid().nullable().optional(),
  surname: optionalNonBlank(50),
  hallName: optionalNonBlank(50),
  progenitor: optionalNonBlank(120),
  region: GenealogyPlaceSchema.nullable().optional(),
  seq: z.coerce.number().int().min(0).optional(),
});
export type CreateLineageInput = z.infer<typeof CreateLineageSchema>;

export const UpdateLineageSchema = z
  .object({
    name: z.string().trim().min(1, "谱系名称不能为空").max(120).optional(),
    folderId: z.uuid().nullable().optional(),
    surname: optionalNonBlank(50).nullable().optional(),
    hallName: optionalNonBlank(50).nullable().optional(),
    progenitor: optionalNonBlank(120).nullable().optional(),
    region: GenealogyPlaceSchema.nullable().optional(),
    seq: z.coerce.number().int().min(0).optional(),
    version: z.coerce.number().int().positive(),
  })
  .refine((value) => Object.keys(value).some((key) => key !== "version"), {
    message: "至少提供一个要修改的字段",
  });
export type UpdateLineageInput = z.infer<typeof UpdateLineageSchema>;

export const CreatePersonSchema = z.object({
  lineageId: z.uuid().optional(),
  displayName: z.string().trim().min(1, "显示名不能为空").max(120),
  sex: z.enum(PERSON_SEXES).optional(),
  surname: optionalNonBlank(50),
  givenName: optionalNonBlank(120),
  romanizedSurname: optionalNonBlank(120),
  romanizedName: optionalNonBlank(120),
  romanizedSuffix: optionalNonBlank(120),
  birthYear: z.coerce.number().int().min(-5000).max(9999).optional(),
  deathYear: z.coerce.number().int().min(-5000).max(9999).optional(),
  isLiving: z.boolean().optional(),
  birthInfo: PersonBirthInfoSchema.optional(),
  deathInfo: PersonDeathInfoSchema.optional(),
  generationWord: optionalNonBlank(20),
  relationTitle: optionalNonBlank(50),
  siblingOrder: z.coerce.number().int().min(0).optional(),
  biography: z.string().trim().max(20000).optional(),
  notes: z.string().trim().max(10000).optional(),
  avatarKey: optionalNonBlank(255),
});
export type CreatePersonInput = z.infer<typeof CreatePersonSchema>;

const personScalarUpdateShape = {
  displayName: z.string().trim().min(1, "显示名不能为空").max(120).optional(),
  sex: z.enum(PERSON_SEXES).optional(),
  surname: optionalNonBlank(50).nullable().optional(),
  givenName: optionalNonBlank(120).nullable().optional(),
  romanizedSurname: optionalNonBlank(120).nullable().optional(),
  romanizedName: optionalNonBlank(120).nullable().optional(),
  romanizedSuffix: optionalNonBlank(120).nullable().optional(),
  birthYear: z.coerce.number().int().min(-5000).max(9999).nullable().optional(),
  deathYear: z.coerce.number().int().min(-5000).max(9999).nullable().optional(),
  isLiving: z.boolean().optional(),
  birthInfo: PersonBirthInfoSchema.nullable().optional(),
  deathInfo: PersonDeathInfoSchema.nullable().optional(),
  generationWord: optionalNonBlank(20).nullable().optional(),
  relationTitle: optionalNonBlank(50).nullable().optional(),
  siblingOrder: z.coerce.number().int().min(0).nullable().optional(),
  biography: z.string().trim().max(20000).nullable().optional(),
  notes: z.string().trim().max(10000).nullable().optional(),
  avatarKey: optionalNonBlank(255).nullable().optional(),
};

export const UpdatePersonSchema = z
  .object({
    ...personScalarUpdateShape,
    version: z.coerce.number().int().positive(),
  })
  .refine((value) => Object.keys(value).some((key) => key !== "version"), {
    message: "至少提供一个要修改的字段",
  });
export type UpdatePersonInput = z.infer<typeof UpdatePersonSchema>;

export const PersonScalarPatchSchema = z
  .object(personScalarUpdateShape)
  .refine((value) => Object.keys(value).length > 0, {
    message: "至少提供一个要修改的字段",
  });
export type PersonScalarPatchInput = z.infer<typeof PersonScalarPatchSchema>;

export const CreatePersonNameSchema = z.object({
  kind: z.enum(PERSON_NAME_KINDS),
  value: z.string().trim().min(1, "名号不能为空").max(120),
  surname: optionalNonBlank(50),
  romanizedSurname: optionalNonBlank(120),
  romanizedName: optionalNonBlank(120),
  label: optionalNonBlank(50),
  isPrimary: z.boolean().optional(),
});
export type CreatePersonNameInput = z.infer<typeof CreatePersonNameSchema>;

const personNameUpdateShape = {
  kind: z.enum(PERSON_NAME_KINDS).optional(),
  value: z.string().trim().min(1, "名号不能为空").max(120).optional(),
  surname: optionalNonBlank(50).nullable().optional(),
  romanizedSurname: optionalNonBlank(120).nullable().optional(),
  romanizedName: optionalNonBlank(120).nullable().optional(),
  label: optionalNonBlank(50).nullable().optional(),
  isPrimary: z.boolean().optional(),
};

export const UpdatePersonNameSchema = z
  .object(personNameUpdateShape)
  .refine((value) => Object.keys(value).length > 0, {
    message: "至少提供一个要修改的字段",
  });
export type UpdatePersonNameInput = z.infer<typeof UpdatePersonNameSchema>;

export const PersonAggregateNameUpdateSchema = z
  .object({
    id: z.uuid(),
    ...personNameUpdateShape,
  })
  .refine((value) => Object.keys(value).some((key) => key !== "id"), {
    message: "至少提供一个要修改的字段",
  });
export type PersonAggregateNameUpdateInput = z.infer<
  typeof PersonAggregateNameUpdateSchema
>;

export const CreateRelationSchema = z
  .object({
    fromPersonId: z.uuid(),
    toPersonId: z.uuid(),
    kind: z.enum(API_RELATION_KINDS),
    fromRoleLabel: optionalNonBlank(50),
    toRoleLabel: optionalNonBlank(50),
    sortOrder: z.coerce.number().int().min(0).optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .strict()
  .refine((value) => value.fromPersonId !== value.toPersonId, {
    message: "关系两端不能是同一人",
    path: ["toPersonId"],
  });
export type CreateRelationInput = z.infer<typeof CreateRelationSchema>;

const relationUpdateShape = {
  kind: z.enum(API_RELATION_KINDS).optional(),
  fromRoleLabel: optionalNonBlank(50).nullable().optional(),
  toRoleLabel: optionalNonBlank(50).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
};

export const UpdateRelationSchema = z
  .object(relationUpdateShape)
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "至少提供一个要修改的字段",
  });
export type UpdateRelationInput = z.infer<typeof UpdateRelationSchema>;

export const PersonAggregateRelationUpdateSchema = z
  .object({
    id: z.uuid(),
    ...relationUpdateShape,
  })
  .strict()
  .refine((value) => Object.keys(value).some((key) => key !== "id"), {
    message: "至少提供一个要修改的字段",
  });
export type PersonAggregateRelationUpdateInput = z.infer<
  typeof PersonAggregateRelationUpdateSchema
>;

export const CreatePersonEventSchema = z.object({
  type: z.enum(PERSON_EVENT_TYPES),
  structuredDate: GenealogyDateSchema.nullable().optional(),
  structuredPlace: GenealogyPlaceSchema.nullable().optional(),
  description: z.string().trim().max(5000).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});
export type CreatePersonEventInput = z.infer<typeof CreatePersonEventSchema>;

const personEventUpdateShape = {
  type: z.enum(PERSON_EVENT_TYPES).optional(),
  structuredDate: GenealogyDateSchema.nullable().optional(),
  structuredPlace: GenealogyPlaceSchema.nullable().optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
};

export const UpdatePersonEventSchema = z
  .object(personEventUpdateShape)
  .refine((value) => Object.keys(value).length > 0, {
    message: "至少提供一个要修改的字段",
  });
export type UpdatePersonEventInput = z.infer<typeof UpdatePersonEventSchema>;

export const PersonAggregateEventUpdateSchema = z
  .object({
    id: z.uuid(),
    ...personEventUpdateShape,
  })
  .refine((value) => Object.keys(value).some((key) => key !== "id"), {
    message: "至少提供一个要修改的字段",
  });
export type PersonAggregateEventUpdateInput = z.infer<
  typeof PersonAggregateEventUpdateSchema
>;

const hasAggregateOps = (group?: {
  create?: unknown[];
  update?: unknown[];
  deleteIds?: unknown[];
}) =>
  Boolean(
    group &&
      ((group.create?.length ?? 0) > 0 ||
        (group.update?.length ?? 0) > 0 ||
        (group.deleteIds?.length ?? 0) > 0),
  );

export const UpdatePersonAggregateSchema = z
  .object({
    version: z.coerce.number().int().positive(),
    person: PersonScalarPatchSchema.optional(),
    names: z
      .object({
        create: z.array(CreatePersonNameSchema).optional(),
        update: z.array(PersonAggregateNameUpdateSchema).optional(),
        deleteIds: z.array(z.uuid()).optional(),
      })
      .optional(),
    relations: z
      .object({
        create: z.array(CreateRelationSchema).optional(),
        update: z.array(PersonAggregateRelationUpdateSchema).optional(),
        deleteIds: z.array(z.uuid()).optional(),
      })
      .optional(),
    events: z
      .object({
        create: z.array(CreatePersonEventSchema).optional(),
        update: z.array(PersonAggregateEventUpdateSchema).optional(),
        deleteIds: z.array(z.uuid()).optional(),
      })
      .optional(),
  })
  .refine(
    (value) =>
      value.person !== undefined ||
      hasAggregateOps(value.names) ||
      hasAggregateOps(value.relations) ||
      hasAggregateOps(value.events),
    {
      message: "至少提供一个要修改的字段或子项操作",
    },
  );
export type UpdatePersonAggregateInput = z.infer<
  typeof UpdatePersonAggregateSchema
>;

export const CreateRelativeRelationSchema = z.object({
  otherPersonId: z.uuid().optional(),
  direction: z.enum(["new_to_other", "other_to_new"]),
  kind: z.enum(API_RELATION_KINDS),
  fromRoleLabel: optionalNonBlank(50),
  toRoleLabel: optionalNonBlank(50),
  sortOrder: z.coerce.number().int().min(0).optional(),
  note: z.string().trim().max(1000).optional(),
});
export type CreateRelativeRelationInput = z.infer<
  typeof CreateRelativeRelationSchema
>;

export const CreateRelativeSchema = z.object({
  anchorPersonId: z.uuid(),
  person: CreatePersonSchema,
  names: z.array(CreatePersonNameSchema).optional(),
  events: z.array(CreatePersonEventSchema).optional(),
  relations: z
    .array(CreateRelativeRelationSchema)
    .min(1, "至少提供一条关联关系"),
  anchorEvents: z.array(CreatePersonEventSchema).optional(),
  companion: z
    .object({
      person: CreatePersonSchema,
      spouseRelation: z
        .object({
          fromRoleLabel: optionalNonBlank(50),
          toRoleLabel: optionalNonBlank(50),
          sortOrder: z.coerce.number().int().min(0).optional(),
        })
        .optional(),
      childRelation: z.object({
        kind: z.enum(API_RELATION_KINDS),
        toRoleLabel: optionalNonBlank(50),
      }),
    })
    .optional(),
});
export type CreateRelativeInput = z.infer<typeof CreateRelativeSchema>;

export const SubgraphQuerySchema = z.object({
  rootPersonId: z.uuid(),
  upDepth: z.coerce.number().int().min(0).max(10).optional(),
  downDepth: z.coerce.number().int().min(0).max(20).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});
export type SubgraphQueryInput = z.infer<typeof SubgraphQuerySchema>;

export const ProjectIdParamsSchema = z.object({
  projectId: z.uuid(),
});

export const FolderIdParamsSchema = z.object({
  projectId: z.uuid(),
  folderId: z.uuid(),
});

export const LineageIdParamsSchema = z.object({
  projectId: z.uuid(),
  lineageId: z.uuid(),
});

export const ProjectMediaParamsSchema = z.object({
  projectId: z.uuid(),
  fileName: z
    .string()
    .regex(/^[0-9a-f-]{36}\.(png|jpg|jpeg|webp|gif)$/, "媒体文件名不合法"),
});

export const PersonIdParamsSchema = z.object({
  projectId: z.uuid(),
  personId: z.uuid(),
});

export const PersonNameIdParamsSchema = z.object({
  projectId: z.uuid(),
  personId: z.uuid(),
  nameId: z.uuid(),
});

export const PersonEventIdParamsSchema = z.object({
  projectId: z.uuid(),
  personId: z.uuid(),
  eventId: z.uuid(),
});

export const RelationIdParamsSchema = z.object({
  projectId: z.uuid(),
  relationId: z.uuid(),
});

export const PageQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const ListPersonsQuerySchema = PageQuerySchema.extend({
  lineageId: z.uuid().optional(),
});

export const ListProjectsQuerySchema = PageQuerySchema.extend({
  sort: z.literal("recent").optional(),
});

// ---- Article & ArticleRevision ----

export const ArticleCitationSchema = z.object({
  id: z.string().trim().min(1).max(120),
  label: z.string().max(240),
  sourceType: z.enum(ARTICLE_CITATION_SOURCE_TYPES),
  detail: z.string().max(2000).optional(),
  mediaAssetId: z.string().max(255).optional(),
});
export type ArticleCitationInput = z.infer<typeof ArticleCitationSchema>;

export const ArticleContentJsonSchema = z
  .object({
    type: z.string().min(1),
  })
  .passthrough();
export type ArticleContentJson = z.infer<typeof ArticleContentJsonSchema>;

export const CreateArticleSchema = z.object({
  folderId: z.uuid().nullable().optional(),
  seq: z.coerce.number().int().min(0).optional(),
  title: z.string().trim().min(1, "谱文标题不能为空").max(200),
  subtitle: z.string().trim().max(300).optional(),
  author: z.string().trim().max(120).optional(),
  docType: z.enum(ARTICLE_DOC_TYPES).optional(),
  status: z.enum(ARTICLE_STATUSES).optional(),
  privacy: z.enum(ARTICLE_PRIVACIES).optional(),
  contentJson: ArticleContentJsonSchema.optional(),
  contentHtml: z.string().max(2_000_000).optional(),
  linkedPersonIds: z.array(z.string().min(1).max(120)).optional(),
  linkedChartIds: z.array(z.string().min(1).max(120)).optional(),
  citations: z.array(ArticleCitationSchema).optional(),
  wordCount: z.coerce.number().int().min(0).optional(),
});
export type CreateArticleInput = z.infer<typeof CreateArticleSchema>;

export const UpdateArticleSchema = z
  .object({
    version: z.coerce.number().int().positive(),
    folderId: z.uuid().nullable().optional(),
    seq: z.coerce.number().int().min(0).optional(),
    title: z.string().trim().min(1, "谱文标题不能为空").max(200).optional(),
    subtitle: z.string().trim().max(300).optional(),
    author: z.string().trim().max(120).optional(),
    docType: z.enum(ARTICLE_DOC_TYPES).optional(),
    status: z.enum(ARTICLE_STATUSES).optional(),
    privacy: z.enum(ARTICLE_PRIVACIES).optional(),
    contentJson: ArticleContentJsonSchema.optional(),
    contentHtml: z.string().max(2_000_000).optional(),
    linkedPersonIds: z.array(z.string().min(1).max(120)).optional(),
    linkedChartIds: z.array(z.string().min(1).max(120)).optional(),
    citations: z.array(ArticleCitationSchema).optional(),
    wordCount: z.coerce.number().int().min(0).optional(),
  })
  .refine((value) => Object.keys(value).some((key) => key !== "version"), {
    message: "至少提供一个要修改的字段",
  });
export type UpdateArticleInput = z.infer<typeof UpdateArticleSchema>;

export const CreateArticleRevisionSchema = z.object({
  summary: z.string().trim().max(300).optional(),
  authorName: z.string().trim().max(120).optional(),
});
export type CreateArticleRevisionInput = z.infer<
  typeof CreateArticleRevisionSchema
>;

export const RestoreArticleRevisionSchema = z.object({
  version: z.coerce.number().int().positive(),
  authorName: z.string().trim().max(120).optional(),
});
export type RestoreArticleRevisionInput = z.infer<
  typeof RestoreArticleRevisionSchema
>;

export const ArticleIdParamsSchema = z.object({
  projectId: z.uuid(),
  articleId: z.uuid(),
});

export const ArticleRevisionIdParamsSchema = z.object({
  projectId: z.uuid(),
  articleId: z.uuid(),
  revisionId: z.uuid(),
});

// ---- Book & BookEdition ----

export const LineageSubTableConfigSchema = z.object({
  enabled: z.boolean(),
  inToc: z.boolean(),
  tocTitle: z.string().max(120),
});
export type LineageSubTableConfig = z.infer<typeof LineageSubTableConfigSchema>;

export const CatalogArticleNodeSchema = z.object({
  id: z.string().min(1).max(120),
  nodeType: z.literal("article"),
  sourceArticleId: z.string().min(1).max(120),
  sourceTitle: z.string().max(300),
  displayTitle: z.string().max(300),
});
export type CatalogArticleNode = z.infer<typeof CatalogArticleNodeSchema>;

export const CatalogLineageNodeSchema = z.object({
  id: z.string().min(1).max(120),
  nodeType: z.literal("lineage"),
  totalTitle: z.string().max(300),
  eyebrowTitle: z.string().max(300),
  chartId: z.string().min(1).max(120),
  chartName: z.string().max(200),
  startMemberId: z.string().min(1).max(120),
  startMemberName: z.string().max(200),
  descendantScope: z.enum(["all", "member", "member_inclusive", "generations"]),
  endMemberId: z.string().max(120).optional(),
  endMemberName: z.string().max(200).optional(),
  maxGenerations: z.coerce.number().int().min(1).max(100).optional(),
  indexConfig: LineageSubTableConfigSchema,
  diaoxianConfig: LineageSubTableConfigSchema,
  shixiConfig: LineageSubTableConfigSchema,
});
export type CatalogLineageNode = z.infer<typeof CatalogLineageNodeSchema>;
export type DescendantScope = CatalogLineageNode["descendantScope"];

export const CatalogLeafNodeSchema = z.discriminatedUnion("nodeType", [
  CatalogArticleNodeSchema,
  CatalogLineageNodeSchema,
]);
export type CatalogLeafNode = z.infer<typeof CatalogLeafNodeSchema>;

export const CatalogChapterNodeSchema = z.object({
  id: z.string().min(1).max(120),
  nodeType: z.literal("chapter"),
  title: z.string().min(1).max(200),
  collapsed: z.boolean().optional(),
  children: z.array(CatalogLeafNodeSchema),
});
export type CatalogChapterNode = z.infer<typeof CatalogChapterNodeSchema>;

export const CatalogNodeSchema = z.discriminatedUnion("nodeType", [
  CatalogChapterNodeSchema,
  CatalogArticleNodeSchema,
  CatalogLineageNodeSchema,
]);
export type CatalogNode = z.infer<typeof CatalogNodeSchema>;

export const CatalogSectionStateSchema = z.object({
  code: z.enum(["preface", "body", "lineage", "appendix"]),
  label: z.string().max(60),
  hint: z.string().max(200),
  collapsed: z.boolean(),
  items: z.array(CatalogNodeSchema),
});
export type CatalogSectionState = z.infer<typeof CatalogSectionStateSchema>;
export type CatalogSectionCode = CatalogSectionState["code"];

export const BookSectionsSchema = z.object({
  preface: CatalogSectionStateSchema,
  body: CatalogSectionStateSchema,
  lineage: CatalogSectionStateSchema,
  appendix: CatalogSectionStateSchema,
});
export type BookSectionsInput = z.infer<typeof BookSectionsSchema>;

export const BookLayoutConfigSchema = z.object({
  bindingStyle: z.enum(BOOK_BINDING_STYLES),
  lineageStyle: z.enum(BOOK_LINEAGE_STYLES),
  paperSize: z.enum(BOOK_PAPER_SIZES),
  borderStyle: z.enum(BOOK_BORDER_STYLES),
  fontFamily: z.enum(BOOK_FONT_FAMILIES),
  density: z.enum(BOOK_DENSITIES),
  fishtailStyle: z.enum(BOOK_FISHTAIL_STYLES),
  showHallName: z.boolean(),
  showHeaderName: z.boolean(),
  pageNumberStyle: z.enum(BOOK_PAGE_NUMBER_STYLES),
});
export type BookLayoutConfigInput = z.infer<typeof BookLayoutConfigSchema>;

export const CreateBookSchema = z.object({
  folderId: z.uuid().nullable().optional(),
  seq: z.coerce.number().int().min(0).optional(),
  bookName: z.string().trim().min(1, "谱书名称不能为空").max(200),
  headerName: z.string().trim().max(200).optional(),
  hallName: z.string().trim().max(120).optional(),
  volumeNo: z.string().trim().min(1).max(60).optional(),
  editor: z.string().trim().max(120).optional(),
  compilationDate: z.string().trim().max(40).optional(),
  sections: BookSectionsSchema.optional(),
  layoutConfig: BookLayoutConfigSchema.optional(),
});
export type CreateBookInput = z.infer<typeof CreateBookSchema>;

export const UpdateBookSchema = z
  .object({
    version: z.coerce.number().int().positive(),
    folderId: z.uuid().nullable().optional(),
    seq: z.coerce.number().int().min(0).optional(),
    bookName: z.string().trim().min(1, "谱书名称不能为空").max(200).optional(),
    headerName: z.string().trim().max(200).optional(),
    hallName: z.string().trim().max(120).optional(),
    volumeNo: z.string().trim().min(1).max(60).optional(),
    editor: z.string().trim().max(120).optional(),
    compilationDate: z.string().trim().max(40).optional(),
    sections: BookSectionsSchema.optional(),
    layoutConfig: BookLayoutConfigSchema.optional(),
  })
  .refine((value) => Object.keys(value).some((key) => key !== "version"), {
    message: "至少提供一个要修改的字段",
  });
export type UpdateBookInput = z.infer<typeof UpdateBookSchema>;

export const ReorderBooksSchema = z.object({
  bookIds: z.array(z.uuid()).min(1),
});
export type ReorderBooksInput = z.infer<typeof ReorderBooksSchema>;

export const CompiledPageSchema = z
  .object({
    pageNo: z.coerce.number().int().positive(),
    type: z.enum([
      "cover",
      "toc",
      "article",
      "lineage_index",
      "lineage_tree",
      "lineage_table",
    ]),
    sectionCode: z.enum([
      "preface",
      "body",
      "lineage",
      "appendix",
      "cover",
      "toc",
    ]),
    headerTitle: z.string(),
    eyebrowTitle: z.string(),
    hallName: z.string(),
  })
  .passthrough();
export type CompiledPage = z.infer<typeof CompiledPageSchema>;

export const CreateBookEditionSchema = z.object({
  bindingStyle: z.enum(BOOK_BINDING_STYLES),
  lineageStyle: z.enum(BOOK_LINEAGE_STYLES),
  paperSize: z.enum(BOOK_PAPER_SIZES),
  pageCount: z.coerce.number().int().min(0),
  memberCount: z.coerce.number().int().min(0),
  wordCount: z.coerce.number().int().min(0),
  layoutSnapshot: BookLayoutConfigSchema,
  pages: z.array(CompiledPageSchema),
});
export type CreateBookEditionInput = z.infer<typeof CreateBookEditionSchema>;

export const UpdateBookEditionSchema = z.object({
  printStatus: z.enum(BOOK_EDITION_PRINT_STATUSES),
});
export type UpdateBookEditionInput = z.infer<typeof UpdateBookEditionSchema>;

export const BookIdParamsSchema = z.object({
  projectId: z.uuid(),
  bookId: z.uuid(),
});

export const BookEditionIdParamsSchema = z.object({
  projectId: z.uuid(),
  bookId: z.uuid(),
  editionId: z.uuid(),
});
