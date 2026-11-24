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
});
