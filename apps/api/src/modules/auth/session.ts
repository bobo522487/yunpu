import type { SessionUser } from "../../types";
import { auth } from "./better-auth";
import { unauthorized } from "./errors";

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
    throw unauthorized();
  }
  return user;
}
