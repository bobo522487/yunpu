import { describe, expect, test } from "vitest";
import { withTenantTransaction } from "../../apps/api/src/db/with-tenant-transaction";
import { signUp, uniqueEmail, withAdminDb } from "../auth/fixtures";
import {
  call,
  createPerson,
  seedOwnerProject,
} from "../genealogy/fixtures/helpers";

async function addMember(
  organizationId: string,
  role: "admin" | "editor" | "viewer",
): Promise<{ cookie: string; userId: string }> {
  const email = uniqueEmail(`role-${role}`);
  const member = await signUp(email);
  const userId = await withAdminDb(async (client) => {
    const result = await client.query<{ id: string }>(
      `SELECT id FROM auth."user" WHERE email = $1`,
      [email.toLowerCase()],
    );
    await client.query(
      `INSERT INTO organization_member (organization_id, user_id, role)
       VALUES ($1, $2, $3)`,
      [organizationId, result.rows[0].id, role],
    );
    return result.rows[0].id;
  });
  return { cookie: member.cookie, userId };
}

describe("write role backstop", () => {
  test("viewer inserts are 42501, non-members stay not found, owner role stays a conflict", async () => {
    const { cookie, organizationId, projectId } =
      await seedOwnerProject("write-role");
    const viewer = await addMember(organizationId, "viewer");
    const outsider = await signUp(uniqueEmail("write-role-out"));

    await expect(
      withTenantTransaction({ userId: viewer.userId }, (db) =>
        db.execute(
          `insert into person (organization_id, project_id, sex)
           values ('${organizationId}'::uuid, '${projectId}'::uuid, 'unknown')`,
        ),
      ),
    ).rejects.toMatchObject({ cause: { code: "42501" } });

    const viewerWrite = await createPerson(viewer.cookie, projectId, {
      displayName: "不该写成",
    });
    expect(viewerWrite.status).toBe(403);
    expect(viewerWrite.json.code).toBe("FORBIDDEN");

    const hidden = await createPerson(outsider.cookie, projectId, {
      displayName: "看不见",
    });
    expect(hidden.status).toBe(404);
    expect(hidden.json.code).toBe("NOT_FOUND");
    expect(hidden.json.message).toBe("不存在或无权");

    const owner = await withAdminDb((client) =>
      client.query<{ user_id: string }>(
        `SELECT owner_user_id AS user_id FROM organization WHERE id = $1`,
        [organizationId],
      ),
    );
    const roleChange = await call(
      `/api/v1/organizations/${organizationId}/members/${owner.rows[0].user_id}`,
      cookie,
      { method: "PATCH", body: JSON.stringify({ role: "editor" }) },
    );
    expect(roleChange.status).toBe(409);
    expect(roleChange.json.code).toBe("CONFLICT");
    expect(roleChange.json.message).toBe("不能修改所有者角色");

    const editor = await addMember(organizationId, "editor");
    const removed = await call(`/api/v1/projects/${projectId}`, editor.cookie, {
      method: "DELETE",
    });
    expect(removed.status).toBe(403);
    expect(removed.json.code).toBe("FORBIDDEN");
  });

  test("viewer content writes, self member columns, and admin-only org writes", async () => {
    const { cookie, organizationId, projectId } =
      await seedOwnerProject("write-matrix");
    const child = await createPerson(cookie, projectId, { displayName: "子" });
    const parent = await createPerson(cookie, projectId, { displayName: "父" });
    expect(child.status).toBe(201);
    expect(parent.status).toBe(201);
    const childId = (child.data?.person as { id: string }).id;
    const parentId = (parent.data?.person as { id: string }).id;
    const viewer = await addMember(organizationId, "viewer");
    const editor = await addMember(organizationId, "editor");
    const owner = await withAdminDb((client) =>
      client.query<{ user_id: string }>(
        `SELECT owner_user_id AS user_id FROM organization WHERE id = $1`,
        [organizationId],
      ),
    );
    const ownerUserId = owner.rows[0].user_id;

    const denied = [
      `insert into person_name (organization_id, project_id, person_id, kind, value, is_primary)
       values ('${organizationId}'::uuid, '${projectId}'::uuid, '${childId}'::uuid, 'formal', '旁支', false)`,
      `insert into person_relation (organization_id, project_id, from_person_id, to_person_id, kind)
       values ('${organizationId}'::uuid, '${projectId}'::uuid, '${parentId}'::uuid, '${childId}'::uuid, 'biological_parent')`,
      `insert into lineage_projection (organization_id, project_id, person_id, primary_path, generation)
       values ('${organizationId}'::uuid, '${projectId}'::uuid, '${childId}'::uuid, 'viewer', 1)`,
    ];
    for (const statement of denied) {
      await expect(
        withTenantTransaction({ userId: viewer.userId }, (db) =>
          db.execute(statement),
        ),
      ).rejects.toMatchObject({ cause: { code: "42501" } });
    }

    await withTenantTransaction({ userId: viewer.userId }, (db) =>
      db.execute(
        `update organization_member
            set last_used_at = now()
          where organization_id = '${organizationId}'::uuid
            and user_id = '${viewer.userId}'::uuid`,
      ),
    );
    const touched = await withAdminDb((client) =>
      client.query<{ last_used_at: Date | null }>(
        `SELECT last_used_at FROM organization_member
          WHERE organization_id = $1 AND user_id = $2`,
        [organizationId, viewer.userId],
      ),
    );
    expect(touched.rows[0].last_used_at).not.toBeNull();

    await expect(
      withTenantTransaction({ userId: viewer.userId }, (db) =>
        db.execute(
          `update organization_member
              set role = 'admin'
            where organization_id = '${organizationId}'::uuid
              and user_id = '${viewer.userId}'::uuid`,
        ),
      ),
    ).rejects.toMatchObject({ cause: { code: "42501" } });

    await expect(
      withTenantTransaction({ userId: editor.userId }, (db) =>
        db.execute(
          `insert into invite
             (organization_id, email, role, token_hash, expires_at, invited_by)
           values ('${organizationId}'::uuid, 'editor-invite@example.com', 'viewer', decode(repeat('bb', 32), 'hex'), now() + interval '1 day', '${ownerUserId}'::uuid)`,
        ),
      ),
    ).rejects.toMatchObject({ cause: { code: "42501" } });
    await expect(
      withTenantTransaction({ userId: editor.userId }, (db) =>
        db.execute(
          `update organization
              set name = 'editor-renamed'
            where id = '${organizationId}'::uuid`,
        ),
      ),
    ).resolves.toMatchObject({ rowCount: 0 });

    await withTenantTransaction({ userId: ownerUserId }, (db) =>
      db.execute(
        `update organization
            set name = 'admin-renamed'
          where id = '${organizationId}'::uuid`,
      ),
    );
    await withTenantTransaction({ userId: ownerUserId }, (db) =>
      db.execute(
        `insert into invite
           (organization_id, email, role, token_hash, expires_at, invited_by)
         values ('${organizationId}'::uuid, 'admin-invite@example.com', 'viewer', decode(repeat('cc', 32), 'hex'), now() + interval '1 day', '${ownerUserId}'::uuid)`,
      ),
    );
    const renamed = await withAdminDb((client) =>
      client.query<{ name: string }>(
        `SELECT name FROM organization WHERE id = $1`,
        [organizationId],
      ),
    );
    expect(renamed.rows[0].name).toBe("admin-renamed");

    const left = await call(
      `/api/v1/organizations/${organizationId}/leave`,
      viewer.cookie,
      { method: "POST" },
    );
    expect(left.status).toBe(200);
    expect(left.json.ok).toBe(true);
    const gone = await withAdminDb((client) =>
      client.query(
        `SELECT 1 FROM organization_member
          WHERE organization_id = $1 AND user_id = $2`,
        [organizationId, viewer.userId],
      ),
    );
    expect(gone.rows).toHaveLength(0);
  });
});
