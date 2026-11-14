import { describe, expect, test } from "bun:test";
import app from "../src/app";

describe("organization router contract", () => {
  test("requires a session to list organizations", async () => {
    const response = await app.request("/api/v1/organizations");
    expect(response.status).toBe(401);
  });

  test("rejects an invalid organization id", async () => {
    const response = await app.request("/api/v1/organizations/not-a-uuid/activate", {
      method: "POST",
      headers: { cookie: "session=invalid" },
    });
    expect(response.status).toBe(401);
  });

  test("accept invite requires a session", async () => {
    const response = await app.request("/api/v1/invites/accept", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "x" }),
    });
    expect(response.status).toBe(401);
  });
});
