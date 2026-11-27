import { AppError, extractDatabaseError } from "../../lib/errors";
import {
  acceptInvite,
  createOrganization,
  type OrganizationSummary,
} from "../organization/service";
import { authPool } from "./better-auth";

export type InviteOutcome = {
  organization: OrganizationSummary;
  accepted: boolean;
  reason?: "email_mismatch" | "expired" | "revoked" | "already_used";
};

function defaultOrganizationName(email: string): string {
  const prefix = email.split("@")[0] || email;
  return `${prefix}的组织`;
}

export async function provisionDefaultOrganization(
  userId: string,
  email: string,
): Promise<OrganizationSummary> {
  return createOrganization(userId, defaultOrganizationName(email));
}

export async function provisionWithInvite(
  userId: string,
  email: string,
  token: string,
): Promise<InviteOutcome> {
  try {
    const organization = await acceptInvite(userId, token);
    return { organization, accepted: true };
  } catch (error) {
    const sqlstate =
      error instanceof AppError
        ? String(error.details?.sqlstate ?? "")
        : (extractDatabaseError(error)?.code ?? "");
    const reason =
      sqlstate === "GX009"
        ? "email_mismatch"
        : sqlstate === "GX010"
          ? "already_used"
          : sqlstate === "GX005"
            ? "expired"
            : undefined;
    if (!reason) throw error;
    const organization = await provisionDefaultOrganization(userId, email);
    return { organization, accepted: false, reason };
  }
}

export async function deleteAuthUser(userId: string): Promise<void> {
  await authPool.query('DELETE FROM auth."user" WHERE id = $1', [userId]);
}
