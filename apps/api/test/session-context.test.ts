import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { AppError } from "../src/lib/errors.ts";
import {
  createSessionContext,
  type DefaultOrganization,
  type SessionAuthClient,
  type SessionContextDependencies,
} from "../src/modules/auth/session-context.ts";

const organization: DefaultOrganization = {
  id: "org-1",
  name: "测试组织",
  role: "admin",
  isOwner: true,
};

const authUser = { id: "u1", email: "a@example.com", name: "A" };

function makeDeps(overrides: Partial<SessionContextDependencies> = {}) {
  const calls = {
    provision: [] as Array<Record<string, unknown>>,
    deleteAuthUser: [] as string[],
    revokeAuthSession: [] as string[],
    getSession: 0,
  };
  const signInHeaders = new Headers({ "x-session-id": "new-session" });
  const auth = {
    api: {
      signUpEmail: async () => ({
        headers: new Headers(),
        response: { user: authUser },
      }),
      signInEmail: async () => ({
        headers: signInHeaders,
        response: { user: authUser },
      }),
      signOut: async () => ({ headers: new Headers() }),
      getSession: async ({ headers }: { headers: Headers }) => {
        calls.getSession += 1;
        const id = headers.get("x-session-id") ?? "new-session";
        return { user: authUser, session: { id } };
      },
    },
  } as unknown as SessionAuthClient;

  const deps: SessionContextDependencies = {
    auth,
    provisionUser: async (input) => {
      calls.provision.push(input);
      return { organization, accepted: true };
    },
    resolveDefaultOrganization: async () => organization,
    deleteAuthUser: async (userId) => {
      calls.deleteAuthUser.push(userId);
    },
    revokeAuthSession: async (sessionId) => {
      calls.revokeAuthSession.push(sessionId);
    },
    ...overrides,
  };
  return { deps, calls };
}

async function capture(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    return error;
  }
}

let logSpy: ReturnType<typeof vi.spyOn>;

type LoggedEvent = Record<string, unknown> & { event?: string };

function loggedEvents(): LoggedEvent[] {
  return logSpy.mock.calls.map((call: unknown[]) => JSON.parse(String(call[0])) as LoggedEvent);
}

beforeEach(() => {
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
});

test("register provisions with the invite token and returns the outcome", async () => {
  const { deps, calls } = makeDeps();
  const result = await createSessionContext(deps).register(
    { email: "a@example.com", password: "secret123", inviteToken: "tok" },
    { requestId: "req-1" },
  );

  expect(calls.provision).toEqual([
    { userId: "u1", email: "a@example.com", inviteToken: "tok" },
  ]);
  expect(result.user.id).toBe("u1");
  expect(result.defaultOrganization).toEqual(organization);
  expect(result.invite).toEqual({ accepted: true });
});

test("register deletes the auth user when provisioning fails", async () => {
  const failure = new AppError("CONFLICT", "该邮箱已注册", 409);
  const { deps, calls } = makeDeps({
    provisionUser: async () => {
      throw failure;
    },
  });

  const error = await capture(
    createSessionContext(deps).register({ email: "a@example.com", password: "secret123" }),
  );

  expect(error).toBe(failure);
  expect(calls.deleteAuthUser).toEqual(["u1"]);
});

test("sign-in revokes the new session when organization resolution fails", async () => {
  const { deps, calls } = makeDeps({
    resolveDefaultOrganization: async () => {
      throw { code: "57014" };
    },
  });

  const error = await capture(
    createSessionContext(deps).signIn({ email: "a@example.com", password: "secret123" }),
  );

  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).code).toBe("UNAVAILABLE");
  expect(calls.revokeAuthSession).toEqual(["new-session"]);
});

test("an auth outage stays loud and does not revoke anything", async () => {
  const outage = new Error("ECONNREFUSED");
  const { deps, calls } = makeDeps();
  (deps.auth.api.signInEmail as () => Promise<unknown>) = async () => {
    throw outage;
  };

  const error = await capture(
    createSessionContext(deps).signIn({ email: "a@example.com", password: "secret123" }),
  );

  expect(error).toBe(outage);
  expect(calls.revokeAuthSession).toEqual([]);
});

test("resolve reuses the supplied user instead of looking up the session", async () => {
  const { deps, calls } = makeDeps();
  const user = { id: "u1", email: "a@example.com", name: "A" };

  const view = await createSessionContext(deps).resolve(new Headers(), user);

  expect(view?.user).toEqual(user);
  expect(view?.defaultOrganization).toEqual(organization);
  expect(calls.getSession).toBe(0);
});

test("a failed sign-in leaves older Sessions valid", async () => {
  const sessions = new Map([
    ["old-session", "u1"],
    ["new-session", "u1"],
  ]);
  const signInHeaders = new Headers({ "x-session-id": "new-session" });
  const { deps } = makeDeps({
    auth: {
      api: {
        signUpEmail: async () => ({ headers: new Headers(), response: { user: authUser } }),
        signInEmail: async () => ({
          headers: signInHeaders,
          response: { user: authUser },
        }),
        signOut: async () => ({ headers: new Headers() }),
        getSession: async ({ headers }: { headers: Headers }) => {
          const id = headers.get("x-session-id");
          return id && sessions.has(id) ? { user: authUser, session: { id } } : null;
        },
      },
    } as unknown as SessionAuthClient,
    resolveDefaultOrganization: async () => {
      throw { code: "57014" };
    },
    revokeAuthSession: async (sessionId) => {
      sessions.delete(sessionId);
    },
  });

  await capture(
    createSessionContext(deps).signIn({ email: "a@example.com", password: "secret123" }),
  );

  expect(sessions.has("old-session")).toBe(true);
  expect(sessions.has("new-session")).toBe(false);
});

test("sign-out records a structured event without the session cookie", async () => {
  const { deps } = makeDeps();
  const headers = new Headers({
    cookie: "better-auth.session_token=super-secret-token",
  });

  await createSessionContext(deps).signOut(headers, {
    requestId: "req-9",
    userId: "u1",
  });

  const events = loggedEvents();
  const signedOut = events.find((event) => event.event === "auth.signed_out");

  expect(signedOut).toMatchObject({
    event: "auth.signed_out",
    request_id: "req-9",
    user_id: "u1",
    result: "ok",
  });
  expect(JSON.stringify(events)).not.toContain("super-secret-token");
});

test("a failed sign-out is logged and stays loud", async () => {
  const failure = new Error("session revoke failed");
  const { deps } = makeDeps({
    auth: {
      api: {
        signOut: async () => {
          throw failure;
        },
      },
    } as unknown as SessionAuthClient,
  });

  const error = await capture(
    createSessionContext(deps).signOut(new Headers(), { requestId: "req-10", userId: "u1" }),
  );

  const events = loggedEvents();
  const signedOut = events.find((event) => event.event === "auth.signed_out");

  expect(error).toBe(failure);
  expect(signedOut).toMatchObject({
    event: "auth.signed_out",
    request_id: "req-10",
    user_id: "u1",
    result: "failed",
  });
});
