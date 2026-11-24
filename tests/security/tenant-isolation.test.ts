import { Client } from "pg";
import { describe, expect, test } from "vitest";
import {
  createOrganization,
  signUp,
  uniqueEmail,
  withAdminDb,
} from "../auth/fixtures";
import {
  call,
  createPerson,
  seedOwnerProject,
} from "../genealogy/fixtures/helpers";

describe("US2 tenant isolation (security)", () => {
  test("org A cannot see org B person or project resources (404)", async () => {
    const ownerA = await seedOwnerProject("sec-a");
    const person = await createPerson(ownerA.cookie, ownerA.projectId, {
      displayName: "甲组织人物",
    });
    expect(person.status).toBe(201);
    const personId = (person.data?.person as { id: string }).id;

    const userB = await signUp(uniqueEmail("sec-b"));
    const orgB = await createOrganization(userB.cookie, "sec-b-org");
    const organizationIdB = (orgB.data?.organization as { id: string }).id;
    const projectB = await call(
      `/api/v1/organizations/${organizationIdB}/projects`,
      userB.cookie,
      { method: "POST", body: JSON.stringify({ name: "sec-b-谱" }) },
    );
    expect(projectB.status).toBe(201);
    const projectBId = (projectB.data?.project as { id: string }).id;

    // Cross-tenant person read/write → NOT_FOUND (undiscoverable)
    for (const init of [
      {},
      {
        method: "PATCH",
        body: JSON.stringify({ displayName: "偷改", version: 1 }),
      },
      { method: "DELETE" },
    ] as RequestInit[]) {
      const result = await call(
        `/api/v1/projects/${ownerA.projectId}/persons/${personId}`,
        userB.cookie,
        init,
      );
      expect(result.status).toBe(404);
      expect(result.json.ok).toBe(false);
      expect(result.json.code).toBe("NOT_FOUND");
    }

    const foreignCreate = await createPerson(userB.cookie, ownerA.projectId, {
      displayName: "不应写入",
    });
    expect(foreignCreate.status).toBe(404);
    expect(foreignCreate.json.code).toBe("NOT_FOUND");

    // Cross-tenant project read/write → NOT_FOUND
    const projectGet = await call(
      `/api/v1/projects/${ownerA.projectId}`,
      userB.cookie,
    );
    expect(projectGet.status).toBe(404);
    expect(projectGet.json.code).toBe("NOT_FOUND");

    const projectPatch = await call(
      `/api/v1/projects/${ownerA.projectId}`,
      userB.cookie,
      {
        method: "PATCH",
        body: JSON.stringify({
          name: "hijack",
          expectedUpdatedAt: new Date().toISOString(),
        }),
      },
    );
    expect(projectPatch.status).toBe(404);

    // Own project still works; no leaked binding to org A
    const own = await createPerson(userB.cookie, projectBId, {
      displayName: "乙组织人物",
    });
    expect(own.status).toBe(201);

    const again = await call(
      `/api/v1/projects/${ownerA.projectId}/persons/${personId}`,
      userB.cookie,
    );
    expect(again.status).toBe(404);
  });

  test("connection reuse after tenant tx does not leak org binding", async () => {
    const owner = await seedOwnerProject("leak-a");
    const person = await createPerson(owner.cookie, owner.projectId, {
      displayName: "泄漏探针",
    });
    expect(person.status).toBe(201);

    // Empty auth context on a fresh connection must see zero tenant rows
    // (SET LOCAL from prior pooled work must not stick).
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL ROLE genealogy_app");
      const orgs = await client.query("SELECT id FROM organization");
      const projects = await client.query("SELECT id FROM project");
      const people = await client.query("SELECT id FROM person");
      expect(orgs.rowCount).toBe(0);
      expect(projects.rowCount).toBe(0);
      expect(people.rowCount).toBe(0);
      await client.query("COMMIT");
    } finally {
      await client.end();
    }

    // Admin can still see the seeded rows (proves data exists; RLS hid it).
    await withAdminDb(async (admin) => {
      const counted = await admin.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM person WHERE project_id = $1",
        [owner.projectId],
      );
      expect(Number(counted.rows[0]?.n ?? 0)).toBeGreaterThan(0);
    });
  });
});
