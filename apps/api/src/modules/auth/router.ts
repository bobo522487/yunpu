import { SignInSchema, SignUpSchema } from "@yunpu/shared";
import { Hono } from "hono";
import { AppError } from "../../lib/errors";
import { appendSetCookie, parseJson } from "../../lib/http";
import {
  assertLoginAllowed,
  clearLoginRateLimits,
  loginLimits,
  sourceAddress,
} from "../../middleware/login-rate-limit";
import type { ApiEnv } from "../../types";
import { unauthorized } from "./errors";
import { getSessionView, register, signIn, signOut } from "./service";

export const authRouter = new Hono<ApiEnv>();

authRouter.post("/sign-up", async (c) => {
  const input = await parseJson(c, SignUpSchema);
  const result = await register(input, c.get("requestId"));
  appendSetCookie(c, result.headers);

  return c.json(
    {
      ok: true,
      data: {
        user: result.user,
        defaultOrganization: result.defaultOrganization,
        invite: result.invite,
      },
    },
    201,
  );
});

authRouter.post("/sign-in", async (c) => {
  const input = await parseJson(c, SignInSchema);
  const address = sourceAddress(c);
  const limits = loginLimits(input.email, address);
  for (const { limiter, key } of limits) {
    assertLoginAllowed(limiter, key);
  }

  try {
    const result = await signIn(input, c.get("requestId"));
    clearLoginRateLimits(input.email, address);
    appendSetCookie(c, result.headers);
    return c.json({
      ok: true,
      data: {
        user: result.user,
        defaultOrganization: result.defaultOrganization,
        onboarding: result.onboarding,
      },
    });
  } catch (error) {
    if (error instanceof AppError && error.code === "UNAUTHORIZED") {
      for (const { limiter, key } of limits) {
        limiter.recordFailure(key);
      }
    }
    throw error;
  }
});

authRouter.post("/sign-out", async (c) => {
  const user = c.get("user");
  if (!user) {
    throw unauthorized();
  }
  const headers = await signOut(c.req.raw.headers, {
    requestId: c.get("requestId"),
    userId: user.id,
  });
  appendSetCookie(c, headers);
  return c.json({ ok: true, data: { signedOut: true } });
});

authRouter.get("/session", async (c) => {
  const view = await getSessionView(c.get("user"));
  if (!view) {
    return c.json({
      ok: true,
      data: { user: null, defaultOrganization: null, onboarding: false },
    });
  }
  return c.json({
    ok: true,
    data: {
      user: view.user,
      defaultOrganization: view.defaultOrganization,
      onboarding: view.onboarding,
    },
  });
});
