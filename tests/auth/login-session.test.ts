import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  cookieFrom,
  PASSWORD,
  readSession,
  request,
  signIn,
  signUp,
  uniqueEmail,
  withAdminDb,
} from "./fixtures.ts";

type LoggedEvent = Record<string, unknown> & { event?: string };

let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logSpy = vi.spyOn(console, "log");
});

afterEach(() => {
  logSpy.mockRestore();
});

function loggedEvents(): LoggedEvent[] {
  return logSpy.mock.calls.map((call: unknown[]) => {
    const line = String(call[0]);
    try {
      return JSON.parse(line) as LoggedEvent;
    } catch {
      return { event: "unparsed", line };
    }
  });
}

describe("US2 login and session", () => {
  test("signs in and returns the default organization", async () => {
    const email = uniqueEmail("login");
    const registered = await signUp(email);
    const defaultOrganization = registered.json.data?.defaultOrganization as {
      id: string;
    };

    const signedIn = await signIn(email);
    expect(signedIn.response.status).toBe(200);
    expect((signedIn.json.data?.defaultOrganization as { id: string }).id).toBe(
      defaultOrganization.id,
    );
  });

  test("uses the same generic message for unknown email and wrong password", async () => {
    const email = uniqueEmail("generic");
    await signUp(email);

    const wrong = await signIn(email, "wrong-password");
    const unknown = await signIn(uniqueEmail("nobody"), PASSWORD);

    expect(wrong.response.status).toBe(401);
    expect(unknown.response.status).toBe(401);
    expect(wrong.json.error?.message).toBe(unknown.json.error?.message);
    expect(wrong.json.error?.message).toBe("邮箱或密码错误");
  });

  test("signing out one device keeps the other session alive", async () => {
    const email = uniqueEmail("devices");
    await signUp(email);

    const deviceA = await signIn(email);
    const deviceB = await signIn(email);

    const signedOut = await request("/api/v1/auth/sign-out", {
      method: "POST",
      headers: { cookie: deviceA.cookie },
    });
    expect(signedOut.status).toBe(200);

    const sessionA = await readSession(deviceA.cookie);
    const sessionB = await readSession(deviceB.cookie);
    expect(sessionA.data?.user).toBeNull();
    expect((sessionB.data?.user as { email: string }).email).toBe(email);
  });

  test("an aging session slides forward instead of expiring", async () => {
    const email = uniqueEmail("slide");
    const registered = await signUp(email);
    const userId = (registered.json.data?.user as { id: string }).id;

    // 把会话整体回拨两天：better-auth 的续期判据是
    // `expiresAt - expiresIn + updateAge <= now`（见 dist/api/routes/session.mjs:182），
    // 也就是「距创建已超过 updateAge」，因此三个时间戳必须一起改。
    // 用数据库时钟而不是伪造 Date：服务端 now() 与 SQL 的 now() 落在同一条时间线上。
    const before = await withAdminDb(async (client) => {
      const result = await client.query<{ expires_at: Date; updated_at: Date }>(
        `UPDATE auth.session
            SET created_at = now() - interval '2 days',
                updated_at = now() - interval '2 days',
                expires_at = now() + interval '5 days'
          WHERE user_id = $1
          RETURNING expires_at, updated_at`,
        [userId],
      );
      return result.rows[0];
    });

    const session = await readSession(registered.cookie);
    expect((session.data?.user as { email: string }).email).toBe(email);

    const after = await withAdminDb(async (client) => {
      const result = await client.query<{
        expires_at: Date;
        updated_at: Date;
        days: number;
      }>(
        `SELECT expires_at, updated_at,
                EXTRACT(EPOCH FROM (expires_at - now())) / 86400 AS days
           FROM auth.session WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [userId],
      );
      return result.rows[0];
    });

    expect(after.expires_at.getTime()).toBeGreaterThan(
      before.expires_at.getTime(),
    );
    expect(after.updated_at.getTime()).toBeGreaterThan(
      before.updated_at.getTime(),
    );
    expect(Number(after.days)).toBeGreaterThan(6.9);
    expect(Number(after.days)).toBeLessThanOrEqual(7.01);
  });

  test("a repeatedly renewed session has no absolute maximum lifetime", async () => {
    const email = uniqueEmail("no-max-life");
    const registered = await signUp(email);
    const userId = (registered.json.data?.user as { id: string }).id;

    const original = await withAdminDb(async (client) => {
      const result = await client.query<{ created_at: Date; expires_at: Date }>(
        "SELECT created_at, expires_at FROM auth.session WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
        [userId],
      );
      return result.rows[0];
    });

    // 连续十次「创建两天后访问一次」。若存在绝对最长寿命（例如 30 天），
    // 二十天后会话终将失效；没有上限时它每次都继续滑动。
    for (let round = 0; round < 10; round += 1) {
      await withAdminDb(async (client) => {
        await client.query(
          `UPDATE auth.session
              SET created_at = now() - interval '2 days',
                  updated_at = now() - interval '2 days'
            WHERE user_id = $1`,
          [userId],
        );
      });
      const session = await readSession(registered.cookie);
      expect(session.data?.user).not.toBeNull();
    }

    // 每轮都把创建时间回拨两天再访问，十轮共「消耗」二十天，会话依然有效。
    const alive = await withAdminDb(async (client) => {
      const result = await client.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM auth.session WHERE user_id = $1",
        [userId],
      );
      return Number(result.rows[0]?.count ?? 0);
    });
    expect(alive).toBe(1);
    expect(original.expires_at.getTime()).toBeGreaterThan(Date.now());
  });

  test("session lifetime is about seven days", async () => {
    const email = uniqueEmail("lifetime");
    const registered = await signUp(email);
    const userId = (registered.json.data?.user as { id: string }).id;

    const days = await withAdminDb(async (client) => {
      const result = await client.query<{ days: number }>(
        "SELECT EXTRACT(EPOCH FROM (expires_at - now())) / 86400 AS days FROM auth.session WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
        [userId],
      );
      return Number(result.rows[0]?.days ?? 0);
    });

    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThanOrEqual(7.01);
  });

  test("sign-out requires a session", async () => {
    const response = await request("/api/v1/auth/sign-out", { method: "POST" });
    expect(response.status).toBe(401);
  });

  test("sign-out records an auditable event without the session token", async () => {
    const email = uniqueEmail("signout-log");
    await signUp(email);
    const device = await signIn(email);

    logSpy.mockClear();
    const signedOut = await request("/api/v1/auth/sign-out", {
      method: "POST",
      headers: { cookie: device.cookie },
    });
    expect(signedOut.status).toBe(200);

    const events = loggedEvents();
    const recorded = events.find((event) => event.event === "auth.signed_out");
    expect(recorded).toMatchObject({ event: "auth.signed_out", result: "ok" });
    expect(recorded?.user_id).toEqual(expect.any(String));
    expect(recorded?.request_id).toEqual(expect.any(String));

    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain(email.split("@")[0]);
    for (const secret of device.cookie.split("; ")) {
      expect(serialized).not.toContain(secret.split("=").slice(1).join("="));
    }
  });

  test("session endpoint returns null user when unauthenticated", async () => {
    const response = await request("/api/v1/auth/session");
    const json = (await response.json()) as { data: { user: null } };
    expect(response.status).toBe(200);
    expect(json.data.user).toBeNull();
  });

  test("login response never includes the password", async () => {
    const email = uniqueEmail("login-secret");
    await signUp(email);
    const signedIn = await signIn(email);
    expect(JSON.stringify(signedIn.json).includes(PASSWORD)).toBe(false);
  });

  test("consume a sign-in cookie as a header value", () => {
    expect(typeof cookieFrom).toBe("function");
  });
});
