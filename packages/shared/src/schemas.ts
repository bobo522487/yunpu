import { z } from "zod";
import {
  API_RELATION_KINDS,
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
  seq: z.coerce.number().int().min(0).optional(),
});
export type CreateFolderInput = z.infer<typeof CreateFolderSchema>;

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
  name: z.string().trim().min(1, "世系名称不能为空").max(120),
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
    name: z.string().trim().min(1, "世系名称不能为空").max(120).optional(),
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
