import { z } from "zod";

export {
  AcceptInviteSchema,
  CreateInviteSchema,
  CreateOrganizationSchema,
  OrganizationIdParamsSchema,
  TransferOwnerSchema,
  UpdateMemberRoleSchema,
  UpdateOrganizationSchema,
} from "@yunpu/shared";

export const MemberParamsSchema = z.object({
  organizationId: z.uuid(),
  userId: z.uuid(),
});

export const InviteParamsSchema = z.object({
  organizationId: z.uuid(),
  inviteId: z.uuid(),
});

export const ListPageQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});
