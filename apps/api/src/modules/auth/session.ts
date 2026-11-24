import { AppError } from "../../lib/errors";
import type { SessionUser } from "../../types";
import { auth } from "./better-auth";

export async function getSession(
  headers: Headers,
): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers });
  if (!session?.user) return null;
  return {
    id: session.user.id,
    email: String(session.user.email ?? ""),
    name: String(session.user.name ?? ""),
  };
}

export async function requireAuth(headers: Headers): Promise<SessionUser> {
  const user = await getSession(headers);
  if (!user) {
    throw new AppError("UNAUTHORIZED", "需要登录", 401);
  }
  return user;
}
