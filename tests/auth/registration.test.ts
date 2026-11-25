import { describe, expect, test } from "vitest";
import {
  findUserIdByEmail,
  PASSWORD,
  readSession,
  signUp,
  uniqueEmail,
  withAdminDb,
} from "./fixtures.ts";

describe("US1 registration", () => {
  test("creates a session and a default organization owned by the new user", async () => {
    const email = uniqueEmail("owner");
    const result = await signUp(email);

    expect(result.response.status).toBe(201);
    expect(result.cookie.length).toBeGreaterThan(0);
    expect(result.json.ok).toBe(true);

    const organization = result.json.data?.defaultOrganization as {
      role: string;
      isOwner: boolean;
    };
    expect(organization.role).toBe("admin");
    expect(organization.isOwner).toBe(true);

    const session = await readSession(result.cookie);
    expect((session.data?.user as { email: string }).email).toBe(email);
    expect((session.data?.defaultOrganization as { id: string }).id).toBe(
      (result.json.data?.defaultOrganization as { id: string }).id,
    );

    const auditCount = await withAdminDb(async (client) => {
      const orgId = (result.json.data?.defaultOrganization as { id: string })
        .id;
      const rows = await client.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM audit_log WHERE organization_id = $1 AND action = 'organization.created' AND project_id IS NULL",
        [orgId],
      );
      return Number(rows.rows[0]?.count ?? 0);
    });
    expect(auditCount).toBe(1);
  });

  test("treats case and surrounding whitespace as the same email", async () => {
    const email = uniqueEmail("case");
    const first = await signUp(email);
    expect(first.response.status).toBe(201);

    const duplicate = await signUp(` ${email.toUpperCase()} `);
    expect(duplicate.response.status).toBe(409);
    expect(duplicate.json.code).toBe("CONFLICT");
  });

  test("rejects a password shorter than 8 characters", async () => {
    const result = await signUp(uniqueEmail("short"), { password: "short" });
    expect(result.response.status).toBe(400);
    expect(result.json.code).toBe("VALIDATION");
  });

  test("rejects an all-whitespace password with 400 and names the minimum", async () => {
    const result = await signUp(uniqueEmail("blank"), { password: "        " });
    expect(result.response.status).toBe(400);
    expect(result.json.code).toBe("VALIDATION");
    const details = JSON.stringify(result.json.details ?? {});
    expect(details).toContain("密码");
    expect(details).toContain("8");
  });

  test("rejects an empty password with 400", async () => {
    const result = await signUp(uniqueEmail("empty"), { password: "" });
    expect(result.response.status).toBe(400);
    expect(result.json.code).toBe("VALIDATION");
  });

  test("keeps a password that only has surrounding spaces", async () => {
    const result = await signUp(uniqueEmail("spaced"), {
      password: "  spaced-pass  ",
    });
    expect(result.response.status).toBe(201);
  });

  test("ten concurrent signups for one email produce exactly one account", async () => {
    const email = uniqueEmail("concurrent");
    const attempts = await Promise.all(
      Array.from({ length: 10 }, () => signUp(email)),
    );

    const created = attempts.filter(
      (attempt) => attempt.response.status === 201,
    );
    const rejected = attempts.filter(
      (attempt) => attempt.response.status === 409,
    );
    expect(created).toHaveLength(1);
    expect(rejected).toHaveLength(9);
    for (const attempt of rejected) {
      expect(attempt.json.code).toBe("CONFLICT");
      expect(attempt.json.message).toContain("已注册");
    }

    const counts = await withAdminDb(async (client) => {
      const users = await client.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM auth."user" WHERE email = $1',
        [email],
      );
      const organizations = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count
           FROM organization o
           JOIN organization_member m ON m.organization_id = o.id
          WHERE m.user_id = (SELECT id FROM auth."user" WHERE email = $1)`,
        [email],
      );
      return {
        users: Number(users.rows[0]?.count ?? 0),
        organizations: Number(organizations.rows[0]?.count ?? 0),
      };
    });
    expect(counts.users).toBe(1);
    expect(counts.organizations).toBe(1);
  });

  test("compensates the auth user when default organization creation fails", async () => {
    const email = uniqueEmail("compensate");
    await withAdminDb((client) =>
      client.query(
        "REVOKE EXECUTE ON FUNCTION app.create_organization(text) FROM genealogy_app",
      ),
    );

    try {
      const result = await signUp(email);
      expect(result.response.status).toBe(500);
      expect(await findUserIdByEmail(email)).toBeUndefined();
    } finally {
      await withAdminDb((client) =>
        client.query(
          "GRANT EXECUTE ON FUNCTION app.create_organization(text) TO genealogy_app",
        ),
      );
    }
  });

  test("the default organization name is readable", async () => {
    const email = uniqueEmail("named");
    const result = await signUp(email);
    const organization = result.json.data?.defaultOrganization as {
      name: string;
    };
    expect(organization.name.length).toBeGreaterThan(0);
    expect(organization.name).toContain("的组织");
  });

  test("password is never present in the response body", async () => {
    const result = await signUp(uniqueEmail("secret"));
    const body = JSON.stringify(result.json);
    expect(body.includes(PASSWORD)).toBe(false);
  });
});
