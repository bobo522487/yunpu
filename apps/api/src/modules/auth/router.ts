import { Hono } from "hono";
import { AppError } from "../../lib/errors";
import { appendSetCookie } from "../../lib/http";
import type { ApiEnv } from "../../types";
import {
  assertLoginAllowed,
  loginKey,
  loginRateLimiter,
  sourceAddress,
} from "../../middleware/login-rate-limit";
import { SignInSchema, SignUpSchema } from "./schema";
import { unauthorized } from "./errors";
import { getSessionView, register, signIn, signOut } from "./service";

function validationError(details: Record<string, unknown>): AppError {
  return new AppError("VALIDATION", "请求参数不合法", 400, details);
}

export const authRouter = new Hono<ApiEnv>();

authRouter.post("/sign-up", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = SignUpSchema.safeParse(body);
  if (!parsed.success) {
    throw validationError(parsed.error.flatten().fieldErrors);
  }

  const result = await register(parsed.data, c.get("requestId"));
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
  const body = await c.req.json().catch(() => null);
  const parsed = SignInSchema.safeParse(body);
  if (!parsed.success) {
    throw validationError(parsed.error.flatten().fieldErrors);
  }

  const key = loginKey(parsed.data.email, sourceAddress(c));
  assertLoginAllowed(loginRateLimiter, key);

  try {
    const result = await signIn(parsed.data, c.get("requestId"));
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
  if (!c.get("user")) {
    throw unauthorized();
  }
  const headers = await signOut(c.req.raw.headers);
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
