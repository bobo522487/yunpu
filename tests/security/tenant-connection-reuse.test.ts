import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import { businessPool } from "../../apps/api/src/db/with-tenant-transaction";
import { withAdminDb } from "../auth/fixtures";
import { createPerson, seedOwnerProject } from "../genealogy/fixtures/helpers";

describe("tenant connection boundary", () => {
  test("a checked-out connection without app.user_id sees no tenant rows", async () => {
    const seeded = await seedOwnerProject("conn-reuse");
    const created = await createPerson(seeded.cookie, seeded.projectId, {
      displayName: "只在事务里可见",
    });
    expect(created.status).toBe(201);

    const visible = await withAdminDb((client) =>
      client.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM person WHERE project_id = $1",
        [seeded.projectId],
      ),
    );
    expect(Number(visible.rows[0]?.count)).toBeGreaterThan(0);

    const client = await businessPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL ROLE genealogy_app");
      const hidden = await client.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM person WHERE project_id = $1",
        [seeded.projectId],
      );
      expect(hidden.rows[0]?.count).toBe("0");
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  test("the health probe only selects the server version", async () => {
    const source = await readFile("apps/api/src/app.ts", "utf8");
    const probe = source.slice(
      source.indexOf("export async function probeDatabase"),
      source.indexOf("app.use(requestId())"),
    );
    expect(probe).toContain(
      'client.query<{ version: string }>("SELECT version()")',
    );
    expect(probe).not.toMatch(/person|organization_member|project/);
  });
});
