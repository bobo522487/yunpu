import type { MiddlewareHandler } from "hono";
import { auth } from "../auth";
import type { ApiEnv, SessionUser } from "../types";

// The media endpoints are an infrastructure proof guarded by a capability
// token, not by a user session. Skipping the session lookup keeps them usable
// during an auth outage and keeps session cookies out of their Context.
const MEDIA_PREFIX = "/api/media";

function isMediaRequest(path: string): boolean {
  return path === MEDIA_PREFIX || path.startsWith(`${MEDIA_PREFIX}/`);
}

export function authMiddleware(): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    if (isMediaRequest(c.req.path)) {
      c.set("user", null);
      await next();
      return;
    }
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
