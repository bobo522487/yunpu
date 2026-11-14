import type { MiddlewareHandler } from "hono";
import { auth } from "../auth";
import type { ApiEnv, SessionUser } from "../types";

export function authMiddleware(): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    const user: SessionUser | null = session?.user
      ? {
          id: session.user.id,
          email: String(session.user.email ?? ""),
          name: String(session.user.name ?? ""),
        }
      : null;
    c.set("user", user);
    await next();
  };
}
