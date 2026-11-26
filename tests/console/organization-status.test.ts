import { afterEach, describe, expect, test } from "vitest";
import {
  findUserIdByEmail,
  signUp,
  uniqueEmail,
  withAdminDb,
} from "../auth/fixtures";
import { call } from "../fixtures/http";

let created: { email: string; organizationId: string } | null = null;

afterEach(async () => {
  if (!created) return;
  const { email, organizationId } = created;
  created = null;
  const userId = await findUserIdByEmail(email);
  await withAdminDb(async (client) => {
    await client.query("BEGIN");
    try {
      // The owner FK and the member/org FKs are mutually RESTRICT, so the
      // fixture has to bypass RI triggers for this cleanup transaction only.
      await client.query("SET LOCAL session_replication_role = replica");
      if (userId) {
        await client.query("DELETE FROM auth.session WHERE user_id = $1", [
          userId,
        ]);
        await client.query("DELETE FROM auth.account WHERE user_id = $1", [
          userId,
        ]);
      }
      await client.query("DELETE FROM invite WHERE organization_id = $1", [
        organizationId,
      ]);
      await client.query(
        "DELETE FROM organization_member WHERE organization_id = $1",
        [organizationId],
      );
      await client.query("DELETE FROM organization WHERE id = $1", [
        organizationId,
      ]);
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
    const owner = await signUp(email);
    const organizationId = (
      owner.json.data?.defaultOrganization as { id: string }
    ).id;
    created = { email, organizationId };

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
