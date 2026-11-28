import { Hono } from "hono";
import { createContractBinder } from "../../lib/contract";
import { AppError } from "../../lib/errors";
import { appendSetCookie } from "../../lib/http";
import {
  assertLoginAllowed,
  clearLoginRateLimits,
  loginLimits,
  sourceAddress,
} from "../../middleware/login-rate-limit";
import type { ApiEnv } from "../../types";
import { getSessionView, register, signIn, signOut } from "./service";

export const authRouter = new Hono<ApiEnv>();
const route = createContractBinder(
  authRouter,
  "apps/api/src/modules/auth/router.ts",
);

route.public("post", "/sign-up", async (c, { body }) => {
  const result = await register(body, c.get("requestId"));
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

route.public("post", "/sign-in", async (c, { body }) => {
  const address = sourceAddress(c);
  const limits = loginLimits(body.email, address);
  for (const { limiter, key } of limits) {
    assertLoginAllowed(limiter, key);
  }

  try {
    const result = await signIn(body, c.get("requestId"));
    clearLoginRateLimits(body.email, address);
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

route("post", "/sign-out", async (c, { user }) => {
  const headers = await signOut(c.req.raw.headers, {
    requestId: c.get("requestId"),
    userId: user.id,
  });
  appendSetCookie(c, headers);
  return c.json({ ok: true, data: { signedOut: true } });
});

route.public("get", "/session", async (c) => {
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
