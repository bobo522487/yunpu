import { z } from "zod";

export const MemberParamsSchema = z.object({
  organizationId: z.uuid(),
  userId: z.uuid(),
});

export const InviteParamsSchema = z.object({
  organizationId: z.uuid(),
  inviteId: z.uuid(),
});
