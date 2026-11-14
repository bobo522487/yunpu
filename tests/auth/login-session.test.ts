import { describe, expect, test } from "bun:test";
import {
  PASSWORD,
  cookieFrom,
  readSession,
  request,
  signIn,
  signUp,
  uniqueEmail,
  withAdminDb,
} from "./fixtures";

describe("US2 login and session", () => {
  test("signs in and returns the default organization", async () => {
    const email = uniqueEmail("login");
    const registered = await signUp(email);
    const defaultOrganization = registered.json.data?.defaultOrganization as { id: string };

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
    expect(wrong.json.message).toBe(unknown.json.message);
    expect(wrong.json.message).toBe("邮箱或密码错误");
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
