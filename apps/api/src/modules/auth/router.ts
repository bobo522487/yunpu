import { SignInSchema, SignUpSchema } from "@yunpu/shared";
import { Hono } from "hono";
import { AppError } from "../../lib/errors";
import { appendSetCookie, parseJson } from "../../lib/http";
import {
  assertLoginAllowed,
  loginKey,
  loginRateLimiter,
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
  const key = loginKey(input.email, sourceAddress(c));
  assertLoginAllowed(loginRateLimiter, key);

  try {
    const result = await signIn(input, c.get("requestId"));
    loginRateLimiter.clear(key);
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
      loginRateLimiter.recordFailure(key);
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
  const view = await getSessionView(c.req.raw.headers);
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
