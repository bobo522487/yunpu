import type { Context } from "hono";
import type { z } from "zod";
import type { ApiEnv } from "../types";
import { AppError, validationError } from "./errors";

type ApiContext = Context<ApiEnv>;

export function appendSetCookie(c: Context, headers: Headers): void {
  const cookies =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : ([] as string[]);
  for (const cookie of cookies) {
    c.header("Set-Cookie", cookie, { append: true });
  }
}

/** Throws the single unauthorized envelope when no session is present. */
export function requireUser(c: ApiContext) {
  const user = c.get("user");
  if (!user) throw new AppError("UNAUTHORIZED", "需要登录", 401);
  return user;
}

function parseOrThrow<S extends z.ZodType>(
  schema: S,
  value: unknown,
): z.output<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw validationError(parsed.error.flatten().fieldErrors);
  }
  return parsed.data as z.output<S>;
}

/** Parse a value against a schema, throwing the shared validation envelope on failure. */
export function parse<S extends z.ZodType>(
  schema: S,
  value: unknown,
): z.output<S> {
  return parseOrThrow(schema, value);
}

/** Parse a JSON body, throwing the shared validation envelope on failure. */
export async function parseJson<S extends z.ZodType>(
  c: ApiContext,
  schema: S,
): Promise<z.output<S>> {
  return parseOrThrow(schema, await c.req.json().catch(() => null));
}

/** Parse route params, throwing the shared validation envelope on failure. */
export function parseParams<S extends z.ZodType>(
  c: ApiContext,
  schema: S,
): z.output<S> {
  return parseOrThrow(schema, c.req.param());
}

/** Parse the query string, throwing the shared validation envelope on failure. */
export function parseQuery<S extends z.ZodType>(
  c: ApiContext,
  schema: S,
): z.output<S> {
  return parseOrThrow(schema, c.req.query());
}
