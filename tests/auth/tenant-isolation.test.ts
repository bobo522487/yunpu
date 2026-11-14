import { describe, expect, test } from "bun:test";
import { Client } from "pg";
import {
  activateOrganization,
  listOrganizations,
  signUp,
  uniqueEmail,
} from "./fixtures";

describe("US4 tenant isolation", () => {
  test("a user sees only their own organizations", async () => {
    const userA = await signUp(uniqueEmail("tenant-a"));
    const userB = await signUp(uniqueEmail("tenant-b"));
    const orgA = (userA.json.data?.defaultOrganization as { id: string }).id;
    const orgB = (userB.json.data?.defaultOrganization as { id: string }).id;

    const listed = await listOrganizations(userA.cookie);
    const ids = (listed.data?.organizations as { id: string }[]).map((item) => item.id);
    expect(ids).toContain(orgA);
    expect(ids).not.toContain(orgB);

    const foreign = await activateOrganization(userA.cookie, orgB);
    expect(foreign.response.status).toBe(404);
    expect(foreign.json.code).toBe("NOT_FOUND");
  });

  test("RLS filters cross-tenant rows when the app omits organization_id", async () => {
    const userA = await signUp(uniqueEmail("rls-a"));
    await signUp(uniqueEmail("rls-b"));
    const userId = (userA.json.data?.user as { id: string }).id;
    const orgId = (userA.json.data?.defaultOrganization as { id: string }).id;

    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL ROLE genealogy_app");
      await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
      const result = await client.query<{ id: string }>("SELECT id FROM organization");
      expect(result.rows.map((row) => row.id)).toEqual([orgId]);
      await client.query("COMMIT");
    } finally {
      await client.end();
    }
  });

  test("an empty auth context sees no rows", async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL ROLE genealogy_app");
      const result = await client.query("SELECT id FROM organization");
      expect(result.rowCount).toBe(0);
      await client.query("COMMIT");
    } finally {
      await client.end();
    }
  });
});
