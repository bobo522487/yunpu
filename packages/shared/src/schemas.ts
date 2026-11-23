import { z } from "zod";
import {
  API_RELATION_KINDS,
  INVITE_STATUSES,
  MEMBER_ROLES,
  ORGANIZATION_STATUSES,
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
  role: RoleSchema,
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
    hallName: optionalNonBlank(50).nullable().optional(),
    originText: z.string().trim().max(200).nullable().optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    colorTheme: z.enum(PROJECT_COLOR_THEMES).optional(),
    projectLevel: z.coerce.number().int().min(1).max(5).optional(),
    expectedUpdatedAt: z.iso.datetime(),
  })
  .refine(
    (value) => Object.keys(value).some((key) => key !== "expectedUpdatedAt"),
    { message: "至少提供一个要修改的字段" },
  );
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

export const CreatePersonSchema = z.object({
  displayName: z.string().trim().min(1, "显示名不能为空").max(120),
  sex: z.enum(PERSON_SEXES).optional(),
  surname: optionalNonBlank(50),
  birthYear: z.coerce.number().int().min(-5000).max(9999).optional(),
  deathYear: z.coerce.number().int().min(-5000).max(9999).optional(),
  isLiving: z.boolean().optional(),
});
export type CreatePersonInput = z.infer<typeof CreatePersonSchema>;

export const UpdatePersonSchema = z
  .object({
    displayName: z.string().trim().min(1, "显示名不能为空").max(120).optional(),
    sex: z.enum(PERSON_SEXES).optional(),
    surname: optionalNonBlank(50).nullable().optional(),
    birthYear: z.coerce
      .number()
      .int()
      .min(-5000)
      .max(9999)
      .nullable()
      .optional(),
    deathYear: z.coerce
      .number()
      .int()
      .min(-5000)
      .max(9999)
      .nullable()
      .optional(),
    isLiving: z.boolean().optional(),
    version: z.coerce.number().int().positive(),
  })
  .refine((value) => Object.keys(value).some((key) => key !== "version"), {
    message: "至少提供一个要修改的字段",
  });
export type UpdatePersonInput = z.infer<typeof UpdatePersonSchema>;

export const CreateRelationSchema = z
  .object({
    fromPersonId: z.uuid(),
    toPersonId: z.uuid(),
    kind: z.enum(API_RELATION_KINDS),
    meta: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((value) => value.fromPersonId !== value.toPersonId, {
    message: "关系两端不能是同一人",
    path: ["toPersonId"],
  });
export type CreateRelationInput = z.infer<typeof CreateRelationSchema>;

export const SubgraphQuerySchema = z.object({
  rootPersonId: z.uuid(),
  upDepth: z.coerce.number().int().min(0).max(10).optional(),
  downDepth: z.coerce.number().int().min(0).max(20).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});
export type SubgraphQueryInput = z.infer<typeof SubgraphQuerySchema>;
