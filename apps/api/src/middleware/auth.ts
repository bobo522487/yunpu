import type { MiddlewareHandler } from "hono";
import { getSession } from "../modules/auth";
import type { ApiEnv } from "../types";

export function authMiddleware(): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    const user = await getSession(c.req.raw.headers);
    c.set("user", user);
    await next();
  };
}
