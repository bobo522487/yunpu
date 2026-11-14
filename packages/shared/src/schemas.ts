import { z } from "zod";
import { INVITE_STATUSES, MEMBER_ROLES, ORGANIZATION_STATUSES } from "./enums";

const normalizedEmail = z.string().trim().toLowerCase().pipe(z.email());

const password = z.string().min(8, "密码至少 8 个字符").max(128);

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
