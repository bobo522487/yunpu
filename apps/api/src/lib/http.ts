import type { Context } from "hono";
import type { z } from "zod";
import type { ApiEnv } from "../types";
import { AppError, validationError } from "./errors";

type ApiContext = Context<ApiEnv>;

/**
 * Original routers were not uniform in how they exposed Zod failures:
 * most passed `flatten().fieldErrors`, person passed `{ issues: flatten() }`.
 * Keep both shapes available so the shared helper preserves every route's
 * original error envelope.
 */
type DetailsShape = "fieldErrors" | "issues";

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
  shape: DetailsShape,
): z.output<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    throw validationError(
      shape === "issues" ? { issues: flat } : flat.fieldErrors,
    );
  }
  return parsed.data as z.output<S>;
}

/** Parse a value against a schema, throwing the shared validation envelope on failure. */
export function parse<S extends z.ZodType>(
  schema: S,
  value: unknown,
  shape: DetailsShape = "fieldErrors",
): z.output<S> {
  return parseOrThrow(schema, value, shape);
}

/** Parse a JSON body, throwing the shared validation envelope on failure. */
export async function parseJson<S extends z.ZodType>(
  c: ApiContext,
  schema: S,
  shape: DetailsShape = "fieldErrors",
): Promise<z.output<S>> {
  return parseOrThrow(schema, await c.req.json().catch(() => null), shape);
}

/** Parse route params, throwing the shared validation envelope on failure. */
export function parseParams<S extends z.ZodType>(
  c: ApiContext,
  schema: S,
  shape: DetailsShape = "fieldErrors",
): z.output<S> {
  return parseOrThrow(schema, c.req.param(), shape);
}

/** Parse the query string, throwing the shared validation envelope on failure. */
export function parseQuery<S extends z.ZodType>(
  c: ApiContext,
  schema: S,
  shape: DetailsShape = "fieldErrors",
): z.output<S> {
  return parseOrThrow(schema, c.req.query(), shape);
}
