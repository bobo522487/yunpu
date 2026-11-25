import { randomBytes } from "node:crypto";
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

    await withAdminDb(async (client) => {
      await client.query(
        `INSERT INTO person_relation (
           organization_id, project_id, from_person_id, to_person_id, kind
         ) VALUES ($1, $2, $3, $4, 'ritual_heir')`,
        [organizationId, projectId, otherId, personId],
      );
      const owner = await client.query<{ user_id: string }>(
        `SELECT user_id FROM organization_member
          WHERE organization_id = $1 AND role = 'admin' LIMIT 1`,
        [organizationId],
      );
      await client.query(
        `INSERT INTO invite
           (organization_id, email, role, token_hash, status, expires_at, invited_by)
         VALUES ($1, 'before-archive@example.com', 'viewer', $2, 'pending', now() + interval '1 day', $3)`,
        [organizationId, randomBytes(32), owner.rows[0].user_id],
      );
    });

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

    const updates = [
      [`UPDATE project SET name = '改名' WHERE id = $1`, [projectId]],
      [
        `UPDATE person SET surname = '改' WHERE project_id = $1 AND id = $2`,
        [projectId, personId],
      ],
      [
        `UPDATE person_name SET value = '改名' WHERE project_id = $1 AND person_id = $2`,
        [projectId, personId],
      ],
      [
        `UPDATE person_relation SET note = '改' WHERE project_id = $1`,
        [projectId],
      ],
      [
        `UPDATE lineage_projection SET generation = 9 WHERE project_id = $1 AND person_id = $2`,
        [projectId, personId],
      ],
      [
        `UPDATE organization_member SET last_used_at = now() WHERE organization_id = $1`,
        [organizationId],
      ],
      [
        `UPDATE invite SET status = 'revoked' WHERE organization_id = $1`,
        [organizationId],
      ],
    ] as const;
    for (const [statement, params] of updates) {
      await expect(
        withAdminDb((client) => client.query(statement, [...params])),
      ).rejects.toMatchObject({ code: "GX012" });
    }

    const deletes = [
      [`DELETE FROM person_relation WHERE project_id = $1`, [projectId]],
      [
        `DELETE FROM person_name WHERE project_id = $1 AND person_id = $2`,
        [projectId, personId],
      ],
      [
        `DELETE FROM lineage_projection WHERE project_id = $1 AND person_id = $2`,
        [projectId, personId],
      ],
      [`DELETE FROM invite WHERE organization_id = $1`, [organizationId]],
      [
        `DELETE FROM organization_member WHERE organization_id = $1 AND role = 'admin'`,
        [organizationId],
      ],
      [
        `DELETE FROM person WHERE project_id = $1 AND id = $2`,
        [projectId, personId],
      ],
      [`DELETE FROM project WHERE id = $1`, [projectId]],
    ] as const;
    for (const [statement, params] of deletes) {
      await expect(
        withAdminDb((client) => client.query(statement, [...params])),
      ).rejects.toMatchObject({ code: "GX012" });
    }

    const kept = await withAdminDb((client) =>
      client.query<{ name: string }>(`SELECT name FROM project WHERE id = $1`, [
        projectId,
      ]),
    );
    expect(kept.rows).toHaveLength(1);

    const rejected = await createPerson(cookie, projectId, {
      displayName: "归档后不该写入",
    });
    expect(rejected.status).toBe(409);
    expect(rejected.json.code).toBe("CONFLICT");
    expect(rejected.json.message).toBe("组织已归档，无法写入");
  });
});
