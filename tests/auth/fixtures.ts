import { Client } from "pg";
import app from "../../apps/api/src/app";

export const PASSWORD = "correct-horse";

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

export type JsonResponse = {
  ok: boolean;
  data?: Record<string, unknown>;
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
};

export async function request(path: string, init?: RequestInit): Promise<Response> {
  return app.request(path, init);
}

export function cookieFrom(response: Response): string {
  const cookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];
  const fallback = response.headers.get("set-cookie");
  const values = cookies.length > 0 ? cookies : fallback ? [fallback] : [];
  return values.map((value) => value.split(";")[0]).join("; ");
}

export async function signUp(
  email: string,
  options: { password?: string; inviteToken?: string } = {},
): Promise<{ response: Response; json: JsonResponse; cookie: string }> {
  const response = await request("/api/v1/auth/sign-up", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email,
      password: options.password ?? PASSWORD,
      inviteToken: options.inviteToken,
    }),
  });
  return {
    response,
    json: (await response.json()) as JsonResponse,
    cookie: cookieFrom(response),
  };
}

export async function signIn(
  email: string,
  password: string = PASSWORD,
): Promise<{ response: Response; json: JsonResponse; cookie: string }> {
  const response = await request("/api/v1/auth/sign-in", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return {
    response,
    json: (await response.json()) as JsonResponse,
    cookie: cookieFrom(response),
  };
}

export async function readSession(cookie: string): Promise<JsonResponse> {
  const response = await request("/api/v1/auth/session", {
    headers: { cookie },
  });
  return (await response.json()) as JsonResponse;
}

export async function createOrganization(
  cookie: string,
  name: string,
): Promise<JsonResponse> {
  const response = await request("/api/v1/organizations", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ name }),
  });
  return (await response.json()) as JsonResponse;
}

export async function listOrganizations(cookie: string): Promise<JsonResponse> {
  const response = await request("/api/v1/organizations", { headers: { cookie } });
  return (await response.json()) as JsonResponse;
}

export async function activateOrganization(
  cookie: string,
  organizationId: string,
): Promise<{ response: Response; json: JsonResponse }> {
  const response = await request(`/api/v1/organizations/${organizationId}/activate`, {
    method: "POST",
    headers: { cookie },
  });
  return { response, json: (await response.json()) as JsonResponse };
}

export async function withAdminDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: process.env.MIGRATE_DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export async function insertInvite(input: {
  organizationId: string;
  email: string;
  token: string;
  invitedBy: string;
  role?: "admin" | "editor" | "viewer";
  status?: "pending" | "accepted" | "revoked";
  expiresInHours?: number;
}): Promise<void> {
  await withAdminDb(async (client) => {
    const expiresInHours = input.expiresInHours ?? 24;
    const acceptedAt = input.status === "accepted" ? new Date() : null;
    const revokedAt = input.status === "revoked" ? new Date() : null;
    await client.query(
      `INSERT INTO invite
         (organization_id, email, role, token_hash, status, expires_at, accepted_at, revoked_at, invited_by, created_at)
       VALUES ($1, $2, $3, sha256(convert_to($4, 'UTF8')), $5, now() + ($6 || ' hours')::interval, $7, $8, $9, now() - interval '2 days')`,
      [
        input.organizationId,
        input.email,
        input.role ?? "editor",
        input.token,
        input.status ?? "pending",
        expiresInHours,
        acceptedAt,
        revokedAt,
        input.invitedBy,
      ],
    );
  });
}

export async function setOrganizationStatus(
  organizationId: string,
  status: "active" | "suspended" | "archived",
): Promise<void> {
  await withAdminDb(async (client) => {
    await client.query("UPDATE organization SET status = $2 WHERE id = $1", [
      organizationId,
      status,
    ]);
  });
}

export async function findUserIdByEmail(email: string): Promise<string | undefined> {
  return withAdminDb(async (client) => {
    const result = await client.query<{ id: string }>(
      'SELECT id FROM auth."user" WHERE email = $1',
      [email.toLowerCase()],
    );
    return result.rows[0]?.id;
  });
}

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function cli(): Promise<void> {
  const command = process.argv[2];

  if (command === "archive-org") {
    const id = argValue("--id");
    if (!id) throw new Error("archive-org requires --id");
    await setOrganizationStatus(id, "archived");
    console.log(`archived ${id}`);
    return;
  }

  if (command === "create-invite") {
    const organizationId = argValue("--org");
    const email = argValue("--email");
    const role = (argValue("--role") ?? "editor") as "admin" | "editor" | "viewer";
    if (!organizationId || !email) {
      throw new Error("create-invite requires --org and --email");
    }
    const invitedBy =
      argValue("--invited-by") ??
      (await withAdminDb(async (client) => {
        const result = await client.query<{ owner_user_id: string }>(
          "SELECT owner_user_id FROM organization WHERE id = $1",
          [organizationId],
        );
        return result.rows[0]?.owner_user_id;
      }));
    if (!invitedBy) throw new Error("organization owner not found");

    const token = crypto.randomUUID();
    await insertInvite({ organizationId, email, token, invitedBy, role });
    console.log(token);
    return;
  }

  throw new Error("usage: fixtures.ts archive-org --id <uuid> | create-invite --org <uuid> --email <email> [--role editor]");
}

if (import.meta.main) {
  cli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
