import type { MemberRole } from "@yunpu/shared";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  createOrganization,
  findUserIdByEmail,
  signUp,
  uniqueEmail,
  withAdminDb,
} from "../auth/fixtures";
import { call } from "../fixtures/http";
import { addMember } from "../fixtures/members";

type AuditRow = {
  action: string;
  actor_user_id: string;
  entity_type: string;
  entity_id: string;
  payload: Record<string, unknown>;
  payload_text: string;
};

type ExpectedAudit = {
  action: string;
  actorUserId: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
};

type Scope = {
  emails: Set<string>;
  organizationIds: Set<string>;
};

const SENSITIVE_PATTERNS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: "token", pattern: /token/i },
  { label: "tokenHash", pattern: /tokenhash/i },
  {
    label: "email",
    pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
  },
  {
    label: "session token",
    pattern: /(?:session[_-]?token|set-cookie|bearer\s+\S+|\bsid\b)/i,
  },
  { label: "password", pattern: /password|passwd|\bpwd\b/i },
];

let scope: Scope;

beforeEach(() => {
  scope = { emails: new Set(), organizationIds: new Set() };
});

afterEach(async () => {
  await cleanupScope(scope);
});

/** Register the cleanup target before the request that may fail. */
function trackEmail(email: string): void {
  scope.emails.add(email.toLowerCase());
}

function trackOrganization(organizationId: string): void {
  scope.organizationIds.add(organizationId);
}

async function createUser(prefix: string): Promise<{
  email: string;
  cookie: string;
  userId: string;
}> {
  const email = uniqueEmail(`audit-${prefix}`);
  trackEmail(email);
  const signedUp = await signUp(email);
  expect(signedUp.response.status).toBe(201);
  const defaultOrganization = signedUp.json.data?.defaultOrganization as
    | { id?: string }
    | undefined;
  if (defaultOrganization?.id) {
    trackOrganization(defaultOrganization.id);
  }
  const userId = await findUserIdByEmail(email);
  if (!userId) {
    throw new Error(`sign-up did not persist user ${email}`);
  }
  return { email, cookie: signedUp.cookie, userId };
}

async function createOrg(cookie: string, name: string): Promise<string> {
  const created = await createOrganization(cookie, `审计-${name}`);
  expect(created.ok).toBe(true);
  const organizationId = (
    created.data?.organization as { id?: string } | undefined
  )?.id;
  if (!organizationId) {
    throw new Error("createOrganization did not return an organization id");
  }
  trackOrganization(organizationId);
  return organizationId;
}

async function addTrackedMember(
  organizationId: string,
  prefix: string,
  role: MemberRole,
): Promise<{ cookie: string; userId: string }> {
  const email = uniqueEmail(`audit-${prefix}`);
  trackEmail(email);
  return addMember(organizationId, email, role);
}

async function readAudits(organizationId: string): Promise<AuditRow[]> {
  return withAdminDb(async (client) => {
    const result = await client.query<AuditRow>(
      `SELECT action, actor_user_id, entity_type, entity_id,
              payload, payload::text AS payload_text
         FROM audit_log
        WHERE organization_id = $1 AND project_id IS NULL
        ORDER BY created_at, action`,
      [organizationId],
    );
    return result.rows;
  });
}

function expectAuditOnce(rows: AuditRow[], expected: ExpectedAudit): void {
  const matches = rows.filter((row) => row.action === expected.action);
  expect(
    matches,
    `expected exactly one ${expected.action}; all rows: ${JSON.stringify(rows)}`,
  ).toHaveLength(1);
  const row = matches[0];
  expect(row?.actor_user_id).toBe(expected.actorUserId);
  expect(row?.entity_type).toBe(expected.entityType);
  expect(row?.entity_id).toBe(expected.entityId);
  expect(row?.payload).toEqual(expected.payload);
}

function assertNoSensitivePayloads(rows: AuditRow[], rawToken?: string): void {
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) {
    for (const { label, pattern } of SENSITIVE_PATTERNS) {
      expect(
        row.payload_text,
        `${row.action} payload contains ${label}`,
      ).not.toMatch(pattern);
    }
    if (rawToken) {
      expect(
        row.payload_text,
        `${row.action} payload contains the raw invite token`,
      ).not.toContain(rawToken);
    }
  }
}

/** Dedicated-client cleanup: fixture rows, audits included, must not survive. */
async function cleanupScope(current: Scope): Promise<void> {
  const emails = [...current.emails];
  if (emails.length === 0) return;

  await withAdminDb(async (client) => {
    await client.query("BEGIN");
    try {
      // RESTRICT cycles between organization/organization_member and the
      // append-only audit trigger make ordinary deletes impossible. Disabling
      // triggers is confined to this dedicated Client's transaction.
      await client.query("SET LOCAL session_replication_role = replica");

      const users = await client.query<{ id: string }>(
        'SELECT id FROM auth."user" WHERE email = ANY($1::text[])',
        [emails],
      );
      const userIds = users.rows.map((row) => row.id);

      const organizations = await client.query<{ id: string }>(
        `SELECT DISTINCT id FROM organization
          WHERE id = ANY($1::uuid[]) OR owner_user_id = ANY($2::uuid[])`,
        [[...current.organizationIds], userIds],
      );
      const organizationIds = organizations.rows.map((row) => row.id);

      if (organizationIds.length > 0) {
        await client.query(
          "DELETE FROM audit_log WHERE organization_id = ANY($1::uuid[])",
          [organizationIds],
        );
        await client.query(
          "DELETE FROM invite WHERE organization_id = ANY($1::uuid[])",
          [organizationIds],
        );
        await client.query(
          "DELETE FROM organization_member WHERE organization_id = ANY($1::uuid[])",
          [organizationIds],
        );
        await client.query(
          "DELETE FROM project WHERE organization_id = ANY($1::uuid[])",
          [organizationIds],
        );
        await client.query(
          "DELETE FROM organization WHERE id = ANY($1::uuid[])",
          [organizationIds],
        );
      }

      if (userIds.length > 0) {
        await client.query(
          "DELETE FROM auth.session WHERE user_id = ANY($1::uuid[])",
          [userIds],
        );
        await client.query(
          "DELETE FROM auth.account WHERE user_id = ANY($1::uuid[])",
          [userIds],
        );
        await client.query(
          "DELETE FROM auth.verification WHERE identifier = ANY($1::text[])",
          [emails],
        );
        await client.query(
          'DELETE FROM auth."user" WHERE id = ANY($1::uuid[])',
          [userIds],
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

describe("organization collaboration audit events (console)", () => {
  test("invite.created records only the invite id and never the raw token", async () => {
    const owner = await createUser("inv-o");
    const organizationId = await createOrg(owner.cookie, "invite");
    const inviteeEmail = uniqueEmail("audit-inv-t");

    const created = await call(
      `/api/v1/organizations/${organizationId}/invites`,
      owner.cookie,
      {
        method: "POST",
        body: JSON.stringify({ email: inviteeEmail, role: "editor" }),
      },
    );
    expect(created.status).toBe(201);
    const invite = created.data?.invite as { id: string };
    const rawToken = (created.data?.inviteUrl as string).split("/#/invite/")[1];
    expect(rawToken.length).toBeGreaterThanOrEqual(43);

    const rows = await readAudits(organizationId);
    expectAuditOnce(rows, {
      action: "invite.created",
      actorUserId: owner.userId,
      entityType: "invite",
      entityId: invite.id,
      payload: { id: invite.id },
    });
    assertNoSensitivePayloads(rows, rawToken);
  });

  test("organization_member.role_changed records only from/to roles", async () => {
    const owner = await createUser("role-o");
    const organizationId = await createOrg(owner.cookie, "role");
    const target = await addTrackedMember(organizationId, "role-t", "viewer");

    const changed = await call(
      `/api/v1/organizations/${organizationId}/members/${target.userId}`,
      owner.cookie,
      { method: "PATCH", body: JSON.stringify({ role: "editor" }) },
    );
    expect(changed.status).toBe(200);

    const rows = await readAudits(organizationId);
    expectAuditOnce(rows, {
      action: "organization_member.role_changed",
      actorUserId: owner.userId,
      entityType: "organization_member",
      entityId: target.userId,
      payload: { from: "viewer", to: "editor" },
    });
    assertNoSensitivePayloads(rows);
  });

  test("organization_member.removed records only the removed member id", async () => {
    const owner = await createUser("rem-o");
    const organizationId = await createOrg(owner.cookie, "remove");
    const target = await addTrackedMember(organizationId, "rem-t", "editor");

    const removed = await call(
      `/api/v1/organizations/${organizationId}/members/${target.userId}`,
      owner.cookie,
      { method: "DELETE" },
    );
    expect(removed.status).toBe(200);

    const rows = await readAudits(organizationId);
    expectAuditOnce(rows, {
      action: "organization_member.removed",
      actorUserId: owner.userId,
      entityType: "organization_member",
      entityId: target.userId,
      payload: { id: target.userId },
    });
    assertNoSensitivePayloads(rows);
  });

  test("organization.archived fires on status transition, not on rename", async () => {
    const owner = await createUser("arc-o");
    const organizationId = await createOrg(owner.cookie, "archive");

    const renamed = await call(
      `/api/v1/organizations/${organizationId}`,
      owner.cookie,
      { method: "PATCH", body: JSON.stringify({ name: "审计-改名" }) },
    );
    expect(renamed.status).toBe(200);
    const beforeArchive = await readAudits(organizationId);
    expect(
      beforeArchive.filter((row) => row.action === "organization.archived"),
    ).toHaveLength(0);

    const archived = await call(
      `/api/v1/organizations/${organizationId}`,
      owner.cookie,
      { method: "PATCH", body: JSON.stringify({ status: "archived" }) },
    );
    expect(archived.status).toBe(200);

    const rows = await readAudits(organizationId);
    expectAuditOnce(rows, {
      action: "organization.archived",
      actorUserId: owner.userId,
      entityType: "organization",
      entityId: organizationId,
      payload: {},
    });
    assertNoSensitivePayloads(rows);
  });

  test("promoting a viewer during ownership transfer emits both audits", async () => {
    const owner = await createUser("prom-o");
    const organizationId = await createOrg(owner.cookie, "promotion");
    const viewer = await addTrackedMember(organizationId, "prom-t", "viewer");

    const transferred = await call(
      `/api/v1/organizations/${organizationId}/owner`,
      owner.cookie,
      {
        method: "PUT",
        body: JSON.stringify({ newOwnerUserId: viewer.userId }),
      },
    );
    expect(transferred.status).toBe(200);
    expect(transferred.data?.ownerUserId).toBe(viewer.userId);

    const rows = await readAudits(organizationId);
    expectAuditOnce(rows, {
      action: "organization_member.role_changed",
      actorUserId: owner.userId,
      entityType: "organization_member",
      entityId: viewer.userId,
      payload: { from: "viewer", to: "admin" },
    });
    expectAuditOnce(rows, {
      action: "organization.owner_transferred",
      actorUserId: owner.userId,
      entityType: "organization",
      entityId: organizationId,
      payload: {
        from: owner.userId,
        to: viewer.userId,
        promoted_to_admin: true,
      },
    });
    assertNoSensitivePayloads(rows);
  });
});
