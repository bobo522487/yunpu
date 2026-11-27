import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  createTenantCleanupTracker,
  signUp,
  uniqueEmail,
  withAdminDb,
} from "../auth/fixtures";
import { call } from "../fixtures/http";

const tracker = createTenantCleanupTracker();

beforeEach(() => {
  tracker.reset();
});

afterEach(async () => {
  await tracker.cleanup();
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
    const email = tracker.trackEmail(uniqueEmail("org-status-negative"));
    const owner = await signUp(email);
    expect(owner.json.ok).toBe(true);
    const organizationId =
      (owner.json.data?.defaultOrganization as { id?: string } | undefined)
        ?.id ?? null;
    expect(organizationId).not.toBeNull();
    if (!organizationId) {
      throw new Error("sign-up did not create a default organization");
    }
    tracker.trackOrganization(organizationId);

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
