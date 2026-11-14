import { describe, expect, test } from "bun:test";
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
