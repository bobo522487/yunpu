import { describe, expect, test } from "vitest";
import { withAdminDb } from "../auth/fixtures";
import { call, createPerson, seedOwnerProject } from "./fixtures/helpers";

describe("archived organization writes", () => {
  test("archiving is allowed and later writes on child tables raise GX012", async () => {
    const { cookie, organizationId, projectId } =
      await seedOwnerProject("archived-write");
    const person = await createPerson(cookie, projectId, {
      displayName: "已在谱",
    });
    const other = await createPerson(cookie, projectId, {
      displayName: "另一人",
    });
    expect(person.status).toBe(201);
    expect(other.status).toBe(201);
    const personId = (person.data?.person as { id: string }).id;
    const otherId = (other.data?.person as { id: string }).id;

    const archived = await call(
      `/api/v1/organizations/${organizationId}`,
      cookie,
      { method: "PATCH", body: JSON.stringify({ status: "archived" }) },
    );
    expect(archived.status).toBe(200);

    await expect(
      withAdminDb((client) =>
        client.query(
          `INSERT INTO project (organization_id, name) VALUES ($1, 'archived')`,
          [organizationId],
        ),
      ),
    ).rejects.toMatchObject({ code: "GX012" });
    await expect(
      withAdminDb((client) =>
        client.query(
          `INSERT INTO person (organization_id, project_id, sex) VALUES ($1, $2, 'unknown')`,
          [organizationId, projectId],
        ),
      ),
    ).rejects.toMatchObject({ code: "GX012" });
    await expect(
      withAdminDb((client) =>
        client.query(
          `INSERT INTO person_name (organization_id, project_id, person_id, kind, value, is_primary)
           VALUES ($1, $2, $3, 'formal', '别名', false)`,
          [organizationId, projectId, personId],
        ),
      ),
    ).rejects.toMatchObject({ code: "GX012" });
    await expect(
      withAdminDb((client) =>
        client.query(
          `INSERT INTO person_relation (
             organization_id, project_id, from_person_id, to_person_id, kind
           ) VALUES ($1, $2, $3, $4, 'ritual_heir')`,
          [organizationId, projectId, otherId, personId],
        ),
      ),
    ).rejects.toMatchObject({ code: "GX012" });
    await expect(
      withAdminDb((client) =>
        client.query(
          `INSERT INTO lineage_projection (organization_id, project_id, person_id, primary_path, generation)
           VALUES ($1, $2, $3, 'abc', 0)`,
          [organizationId, projectId, personId],
        ),
      ),
    ).rejects.toMatchObject({ code: "GX012" });
    await expect(
      withAdminDb(async (client) => {
        const user = await client.query<{ id: string }>(
          `SELECT id FROM auth."user" ORDER BY id LIMIT 1`,
        );
        return client.query(
          `INSERT INTO organization_member (organization_id, user_id, role)
           VALUES ($1, $2, 'viewer')`,
          [organizationId, user.rows[0].id],
        );
      }),
    ).rejects.toMatchObject({ code: "GX012" });
    await expect(
      withAdminDb(async (client) => {
        const owner = await client.query<{ user_id: string }>(
          `SELECT user_id FROM organization_member
            WHERE organization_id = $1 AND role = 'admin' LIMIT 1`,
          [organizationId],
        );
        return client.query(
          `INSERT INTO invite
             (organization_id, email, role, token_hash, status, expires_at, invited_by)
           VALUES ($1, 'gone@example.com', 'viewer', sha256('archived'), 'pending', now() + interval '1 day', $2)`,
          [organizationId, owner.rows[0].user_id],
        );
      }),
    ).rejects.toMatchObject({ code: "GX012" });
  });
});
