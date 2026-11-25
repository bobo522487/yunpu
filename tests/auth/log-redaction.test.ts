import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  createOrganization,
  insertInvite,
  PASSWORD,
  request,
  signIn,
  signUp,
  uniqueEmail,
} from "./fixtures";

type LoggedEvent = Record<string, unknown> & { event?: string };

let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logSpy = vi.spyOn(console, "log");
});

afterEach(() => {
  logSpy.mockRestore();
});

function loggedLines(): string[] {
  return logSpy.mock.calls.map((call: unknown[]) => String(call[0]));
}

function loggedEvents(): LoggedEvent[] {
  return loggedLines().flatMap((line) => {
    try {
      const parsed = JSON.parse(line) as unknown;
      return parsed && typeof parsed === "object"
        ? [parsed as LoggedEvent]
        : [];
    } catch {
      return [];
    }
  });
}

describe("secret redaction", () => {
  test("registration and login responses do not echo the password", async () => {
    const email = uniqueEmail("redact");
    const registered = await signUp(email);
    const signedIn = await signIn(email);

    expect(JSON.stringify(registered.json).includes(PASSWORD)).toBe(false);
    expect(JSON.stringify(signedIn.json).includes(PASSWORD)).toBe(false);
  });

  test("an invite token is not echoed in the response body", async () => {
    const token = "redact-invite-token-123";
    const registered = await signUp(uniqueEmail("redact-invite"), {
      inviteToken: token,
    });
    expect(JSON.stringify(registered.json).includes(token)).toBe(false);
  });

  test("registration and login logs never carry the password", async () => {
    const email = uniqueEmail("redact-log");
    logSpy.mockClear();

    const registered = await signUp(email);
    expect(registered.response.status).toBe(201);
    const signedIn = await signIn(email);
    expect(signedIn.response.status).toBe(200);

    const events = loggedEvents();
    expect(events.some((event) => event.event === "auth.registered")).toBe(
      true,
    );
    expect(events.some((event) => event.event === "auth.signed_in")).toBe(true);

    const all = loggedLines().join("\n");
    expect(all).not.toContain(PASSWORD);
  });

  test("a failed sign-in does not log the attempted password", async () => {
    const email = uniqueEmail("redact-fail");
    await signUp(email);
    const attempted = "wrong-horse-battery";
    logSpy.mockClear();

    const failed = await signIn(email, attempted);
    expect(failed.response.status).toBe(401);

    const all = loggedLines().join("\n");
    expect(all).not.toContain(attempted);
    expect(all).not.toContain(PASSWORD);
    expect(JSON.stringify(failed.json).includes(attempted)).toBe(false);
  });

  test("invite redemption logs and responses never carry the invite token", async () => {
    const ownerEmail = uniqueEmail("redact-owner");
    const owner = await signUp(ownerEmail);
    const ownerId = (owner.json.data?.user as { id: string }).id;
    const organization = await createOrganization(owner.cookie, "脱敏组织");
    const organizationId = (organization.data?.organization as { id: string })
      .id;

    const invitee = uniqueEmail("redact-invitee");
    const token = crypto.randomUUID();
    await insertInvite({
      organizationId,
      email: invitee,
      token,
      invitedBy: ownerId,
    });

    logSpy.mockClear();
    const registered = await signUp(invitee, { inviteToken: token });
    expect(registered.response.status).toBe(201);
    expect(
      (registered.json.data?.invite as { accepted: boolean }).accepted,
    ).toBe(true);

    const all = loggedLines().join("\n");
    expect(all).not.toContain(token);
    expect(JSON.stringify(registered.json).includes(token)).toBe(false);
    expect(all).not.toContain(PASSWORD);
  });

  test("sign-out logs never carry the session token", async () => {
    const email = uniqueEmail("redact-signout");
    await signUp(email);
    const device = await signIn(email);

    logSpy.mockClear();
    const signedOut = await request("/api/v1/auth/sign-out", {
      method: "POST",
      headers: { cookie: device.cookie },
    });
    expect(signedOut.status).toBe(200);

    const all = loggedLines().join("\n");
    for (const pair of device.cookie.split("; ")) {
      const value = pair.split("=").slice(1).join("=");
      if (value.length > 0) {
        expect(all).not.toContain(value);
      }
    }
  });
});
