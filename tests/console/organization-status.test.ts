import { afterEach, describe, expect, test } from "vitest";
import {
  findUserIdByEmail,
  signUp,
  uniqueEmail,
  withAdminDb,
} from "../auth/fixtures";
import { call } from "../fixtures/http";

let created: { email: string; organizationId: string | null } | null = null;

afterEach(async () => {
  if (!created) return;
  const { email, organizationId } = created;
  created = null;
  const userId = await findUserIdByEmail(email);
  await withAdminDb(async (client) => {
    await client.query("BEGIN");
    try {
      // Narrower `SET CONSTRAINTS fk_organization_owner DEFERRED` was tried
      // first and fails on the mutually RESTRICT FK cycle with:
      // error: update or delete on table "organization_member" violates RESTRICT
      // setting of foreign key constraint "fk_organization_owner" on table "organization"
      // RESTRICT checks are not deferrable (member->org is RESTRICT as well),
      // so keep the transaction-scoped override until the schema changes.
      await client.query("SET LOCAL session_replication_role = replica");
      if (userId) {
        await client.query("DELETE FROM auth.session WHERE user_id = $1", [
          userId,
        ]);
        await client.query("DELETE FROM auth.account WHERE user_id = $1", [
          userId,
        ]);
      }
      // Resolve the organization from the sign-up response when available.
      // If sign-up failed before returning an id, derive it from the already
      // registered user id. Never bind a non-uuid placeholder (e.g. "") to a
      // uuid parameter, which would abort cleanup before deleting auth.user.
      let organizationIdToDelete = organizationId;
      if (!organizationIdToDelete && userId) {
        const orgRows = await client.query<{ id: string }>(
          "SELECT id FROM organization WHERE owner_user_id = $1",
          [userId],
        );
        organizationIdToDelete = orgRows.rows[0]?.id ?? null;
      }
      if (organizationIdToDelete) {
        await client.query("DELETE FROM invite WHERE organization_id = $1", [
          organizationIdToDelete,
        ]);
        await client.query(
          "DELETE FROM organization_member WHERE organization_id = $1",
          [organizationIdToDelete],
        );
        await client.query("DELETE FROM organization WHERE id = $1", [
          organizationIdToDelete,
        ]);
      }
      if (userId) {
        await client.query('DELETE FROM auth."user" WHERE id = $1', [userId]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
});

async function storedStatus(
  organizationId: string,
): Promise<string | undefined> {
  return withAdminDb(async (client) => {
    const result = await client.query<{ status: string }>(
      "SELECT status FROM organization WHERE id = $1",
      [organizationId],
    );
    return result.rows[0]?.status;
  });
}

describe("PATCH /api/v1/organizations/:id with an unsupported status", () => {
  test("returns the validation envelope and leaves the stored status unchanged", async () => {
    const email = uniqueEmail("org-status-negative");
    // Register the cleanup target BEFORE the request: an error envelope or a
    // thrown sign-up must still be cleanable by afterEach.
    const cleanup = { email, organizationId: null as string | null };
    created = cleanup;
    const owner = await signUp(email);
    expect(owner.json.ok).toBe(true);
    cleanup.organizationId =
      (owner.json.data?.defaultOrganization as { id?: string } | undefined)
        ?.id ?? null;
    const organizationId = cleanup.organizationId;
    expect(organizationId).not.toBeNull();
    if (!organizationId) {
      throw new Error("sign-up did not create a default organization");
    }

    expect(await storedStatus(organizationId)).toBe("active");

    const result = await call(
      `/api/v1/organizations/${organizationId}`,
      owner.cookie,
      { method: "PATCH", body: JSON.stringify({ status: "suspended" }) },
    );

    expect(result.status).toBe(400);
    expect(result.json.ok).toBe(false);
    expect(result.json.code).toBe("VALIDATION");
    expect(result.json.details).toHaveProperty("status");
    expect(result.json.details).not.toHaveProperty("issues");
    expect(await storedStatus(organizationId)).toBe("active");
  });
});
