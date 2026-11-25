import { describe, expect, test } from "vitest";
import { signIn, signUp, uniqueEmail } from "../auth/fixtures";
import { call } from "../fixtures/http";

describe("account settings (console)", () => {
  test("GET /account returns the caller's own profile", async () => {
    const email = uniqueEmail("acc-get");
    const user = await signUp(email);

    const result = await call("/api/v1/account", user.cookie);
    expect(result.status).toBe(200);
    expect(result.data?.email).toBe(email.toLowerCase());
    expect(typeof result.data?.name).toBe("string");
    expect(result.data?.id).toBeTruthy();
  });

  test("PATCH /account updates display name for self only", async () => {
    const user = await signUp(uniqueEmail("acc-name"));

    const updated = await call("/api/v1/account", user.cookie, {
      method: "PATCH",
      body: JSON.stringify({ name: "修谱主事人" }),
    });
    expect(updated.status).toBe(200);
    expect(updated.data?.name).toBe("修谱主事人");

    const fetched = await call("/api/v1/account", user.cookie);
    expect((fetched.data as { name: string }).name).toBe("修谱主事人");

    const blank = await call("/api/v1/account", user.cookie, {
      method: "PATCH",
      body: JSON.stringify({ name: "   " }),
    });
    expect(blank.status).toBe(400);
    expect(blank.json.code).toBe("VALIDATION");
  });

  test("password change requires the current password and invalidates it", async () => {
    const email = uniqueEmail("acc-pw");
    const user = await signUp(email);

    const wrong = await call("/api/v1/account/password", user.cookie, {
      method: "POST",
      body: JSON.stringify({
        currentPassword: "wrong-password",
        newPassword: "brand-new-pass",
      }),
    });
    expect(wrong.status).toBe(400);
    expect(wrong.json.code).toBe("VALIDATION");

    const changed = await call("/api/v1/account/password", user.cookie, {
      method: "POST",
      body: JSON.stringify({
        currentPassword: "correct-horse",
        newPassword: "brand-new-pass",
      }),
    });
    expect(changed.status).toBe(200);
    expect(changed.data?.changed).toBe(true);

    const oldLogin = await signIn(email, "correct-horse");
    expect(oldLogin.response.status).toBe(401);

    const newLogin = await signIn(email, "brand-new-pass");
    expect(newLogin.response.status).toBe(200);
  });

  test("unauthenticated account access is rejected", async () => {
    const result = await call("/api/v1/account", null);
    expect(result.status).toBe(401);
    expect(result.json.code).toBe("UNAUTHORIZED");
  });
});
