import type { MemberRole } from "@yunpu/shared";
import { signUp, uniqueEmail, withAdminDb } from "../auth/fixtures";

export type AddedMember = {
  cookie: string;
  userId: string;
};

/**
 * Signs up a fresh user and adds them to an organization as `role`.
 *
 * Two call shapes are supported so existing fixtures keep their semantics:
 * - `addMember(organizationId, email, role)` — explicit email.
 * - `addMember(organizationId, role)` — email generated from the role
 *   (`uniqueEmail("role-<role>")`), as in the security write-role fixtures.
 *
 * Both shapes return the new member's cookie and user id; callers that only
 * need the cookie can destructure `{ cookie }`.
 */
export async function addMember(
  organizationId: string,
  email: string,
  role: MemberRole,
): Promise<AddedMember>;
export async function addMember(
  organizationId: string,
  role: MemberRole,
): Promise<AddedMember>;
export async function addMember(
  organizationId: string,
  emailOrRole: string,
  role?: MemberRole,
): Promise<AddedMember> {
  const memberRole = role ?? (emailOrRole as MemberRole);
  const memberEmail =
    role === undefined ? uniqueEmail(`role-${memberRole}`) : emailOrRole;
  const member = await signUp(memberEmail);
  const userId = await withAdminDb(async (client) => {
    const result = await client.query<{ id: string }>(
      `SELECT id FROM auth."user" WHERE email = $1`,
      [memberEmail.toLowerCase()],
    );
    await client.query(
      `INSERT INTO organization_member (organization_id, user_id, role, created_at, updated_at)
       VALUES ($1, $2, $3, now(), now())
       ON CONFLICT DO NOTHING`,
      [organizationId, result.rows[0].id, memberRole],
    );
    return result.rows[0].id;
  });
  return { cookie: member.cookie, userId };
}
