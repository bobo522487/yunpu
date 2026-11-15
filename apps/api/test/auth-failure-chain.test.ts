import { expect, spyOn, test } from "bun:test";
import { auth } from "../src/auth";
import { AppError } from "../src/lib/errors";
import { loginRateLimiter } from "../src/middleware/login-rate-limit";
import * as orgService from "../src/modules/organization/service";
import { signIn } from "../src/modules/auth/service";
import { provisionWithInvite } from "../src/auth/provisioning";
import app from "../src/app";


test("db outage is rethrown, not disguised as 401", async () => {
  const spy = spyOn(auth.api, "signInEmail").mockRejectedValue(new Error("ECONNREFUSED"));
  try {
    await expect(signIn({ email: "a@example.com", password: "secret123" }))
      .rejects.toThrow("ECONNREFUSED");
  } finally { spy.mockRestore(); }
});

test("credential 4xx is still a 401", async () => {
  const spy = spyOn(auth.api, "signInEmail")
    .mockRejectedValue({ statusCode: 401, message: "invalid password" });
  try {
    await expect(signIn({ email: "a@example.com", password: "bad" }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 });
  } finally { spy.mockRestore(); }
});

test("invite provisioning only absorbs known GX sqlstates", async () => {
  const accept = spyOn(orgService, "acceptInvite")
    .mockRejectedValue(new AppError("UNAVAILABLE", "db down", 503));
  const create = spyOn(orgService, "createOrganization")
    .mockRejectedValue(new Error("NO_DB_IN_TEST"));
  try {
    await expect(provisionWithInvite("u1", "a@example.com", "tok"))
      .rejects.toMatchObject({ code: "UNAVAILABLE" });
    expect(create.mock.calls).toHaveLength(0);
  } finally { accept.mockRestore(); create.mockRestore(); }
});

test("a database failure is not counted as a login failure", async () => {
  const rec = spyOn(loginRateLimiter, "recordFailure");
  const spy = spyOn(auth.api, "signInEmail").mockRejectedValue(new Error("ECONNREFUSED"));
  try {
    const r = await app.request("/api/v1/auth/sign-in", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "a@example.com", password: "secret123" }),
    });
    expect(r.status).not.toBe(401);
    expect(rec.mock.calls).toHaveLength(0);
  } finally { rec.mockRestore(); spy.mockRestore(); }
});
