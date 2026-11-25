import { describe, expect, test } from "vitest";
import app from "../src/app";

describe("auth router contract", () => {
  test("sign-up rejects a missing body with 400", async () => {
    const response = await app.request("/api/v1/auth/sign-up", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(response.status).toBe(400);
    const json = (await response.json()) as { code: string };
    expect(json.code).toBe("VALIDATION");
  });

  test("sign-up rejects a whitespace-only password with 400", async () => {
    const response = await app.request("/api/v1/auth/sign-up", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "blank@example.com", password: "        " }),
    });
    expect(response.status).toBe(400);
    const json = (await response.json()) as {
      code: string;
      details?: Record<string, string[]>;
    };
    expect(json.code).toBe("VALIDATION");
    expect(JSON.stringify(json)).toContain("密码");
  });

  test("sign-up rejects a password of only tabs and spaces with 400", async () => {
    const response = await app.request("/api/v1/auth/sign-up", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "blank2@example.com", password: "\t\t\t\t\t\t\t\t" }),
    });
    expect(response.status).toBe(400);
  });

  test("sign-in rejects a missing body with 400", async () => {
    const response = await app.request("/api/v1/auth/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(response.status).toBe(400);
  });

  test("session is public and returns a null user", async () => {
    const response = await app.request("/api/v1/auth/session");
    expect(response.status).toBe(200);
    const json = (await response.json()) as { data: { user: null } };
    expect(json.data.user).toBeNull();
  });

  test("sign-out without a session returns 401", async () => {
    const response = await app.request("/api/v1/auth/sign-out", { method: "POST" });
    expect(response.status).toBe(401);
  });
});
