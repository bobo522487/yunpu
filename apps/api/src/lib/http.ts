import type { Context } from "hono";

export function appendSetCookie(c: Context, headers: Headers): void {
  const cookies =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : ([] as string[]);
  for (const cookie of cookies) {
    c.header("Set-Cookie", cookie, { append: true });
  }
}
