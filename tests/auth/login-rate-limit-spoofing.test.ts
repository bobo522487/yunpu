import { afterEach, describe, expect, test, vi } from "vitest";
import app from "../../apps/api/src/app";
import {
  clearLoginRateLimits,
  sourceAddress,
} from "../../apps/api/src/middleware/login-rate-limit";
import { auth } from "../../apps/api/src/modules/auth";

function contextWithSocket(forwardedFor: string): never {
  return {
    req: { header: () => forwardedFor },
    env: {
      incoming: {
        socket: {
          remoteAddress: "203.0.113.7",
          remotePort: 43210,
          remoteFamily: "IPv4",
        },
      },
    },
  } as never;
}

function signIn(email: string, forwardedFor: string): Promise<Response> {
  return app.request("/api/v1/auth/sign-in", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": forwardedFor,
    },
    body: JSON.stringify({ email, password: "wrong-password" }),
  });
}

describe("login rate limit source address", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.TRUST_PROXY;
  });

  test("ignores forwarded headers unless TRUST_PROXY is enabled", () => {
    const c = contextWithSocket("198.51.100.9");
    expect(sourceAddress(c)).toBe("203.0.113.7");

    process.env.TRUST_PROXY = "true";
    expect(sourceAddress(c)).toBe("198.51.100.9");
  });

  test("forged X-Forwarded-For headers do not bypass the five-failure lock", async () => {
    const email = `spoof-${Date.now()}@example.com`;
    vi.spyOn(auth.api, "signInEmail").mockRejectedValue({
      statusCode: 401,
      message: "invalid password",
    });
    clearLoginRateLimits(email);

    for (let index = 0; index < 5; index += 1) {
      const response = await signIn(email, `198.51.100.${index + 1}`);
      expect(response.status).toBe(401);
    }

    const locked = await signIn(email, "198.51.100.99");
    expect(locked.status).toBe(429);
    await expect(locked.json()).resolves.toMatchObject({
      code: "RATE_LIMITED",
      details: { retryAfterSeconds: expect.any(Number) },
    });
    clearLoginRateLimits(email);
  });
});
