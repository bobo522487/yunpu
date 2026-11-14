import { AppError } from "../lib/errors";
import { authPool } from "./index";
import {
  acceptInvite,
  createOrganization,
  type OrganizationSummary,
} from "../modules/organization/service";

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
    if (!(error instanceof AppError)) throw error;
    const reason =
      error.code === "FORBIDDEN"
        ? "email_mismatch"
        : error.code === "CONFLICT"
          ? "already_used"
          : "expired";
    const organization = await provisionDefaultOrganization(userId, email);
    return { organization, accepted: false, reason };
  }
}

export async function deleteAuthUser(userId: string): Promise<void> {
  const client = await authPool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM auth.session WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM auth.account WHERE user_id = $1", [userId]);
    await client.query('DELETE FROM auth."user" WHERE id = $1', [userId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
