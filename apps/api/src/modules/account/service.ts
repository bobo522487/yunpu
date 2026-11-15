import { auth } from "../../auth";
import { AppError } from "../../lib/errors";
import { logEvent } from "../../lib/logger";

type BetterAuthUser = {
  id: string;
  email: string;
  name: string;
};

export type AccountRecord = {
  id: string;
  email: string;
  name: string;
};

function toAccount(user: BetterAuthUser): AccountRecord {
  return {
    id: user.id,
    email: String(user.email ?? ""),
    name: String(user.name ?? ""),
  };
}

async function requireSessionUser(headers: Headers): Promise<BetterAuthUser> {
  const session = await auth.api.getSession({ headers });
  if (!session?.user) {
    throw new AppError("UNAUTHORIZED", "需要登录", 401);
  }
  return session.user as BetterAuthUser;
}

function mapBetterAuthError(error: unknown, fallback: string): AppError {
  const record =
    typeof error === "object" && error !== null
      ? (error as {
          statusCode?: unknown;
          status?: unknown;
          body?: { code?: string };
        })
      : undefined;
  const code = record?.body?.code;
  if (code === "INVALID_PASSWORD") {
    return new AppError("VALIDATION", "当前密码不正确", 400);
  }
  const status = Number(record?.statusCode ?? record?.status);
  if (status === 400) {
    return new AppError("VALIDATION", fallback, 400);
  }
  if (status === 401) {
    return new AppError("UNAUTHORIZED", "需要登录", 401);
  }
  return new AppError("INTERNAL", fallback, 500);
}

/** 只修改调用者本人的显示名（`account.write`，FR-006）。 */
export async function updateAccount(
  headers: Headers,
  name: string,
): Promise<AccountRecord> {
  const sessionUser = await requireSessionUser(headers);
  try {
    await auth.api.updateUser({ body: { name }, headers });
  } catch (error) {
    throw mapBetterAuthError(error, "修改资料失败");
  }
  // 以会话回读为准，避免依赖 Better Auth 各版本的返回体形状。
  const refreshed = await requireSessionUser(headers);
  logEvent({
    event: "account.updated",
    user_id: sessionUser.id,
    result: "ok",
  });
  return toAccount(refreshed);
}

/** 修改本人密码：需当前密码；失败不改密（Better Auth 事务内校验）。 */
export async function changePassword(
  headers: Headers,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const sessionUser = await requireSessionUser(headers);
  try {
    await auth.api.changePassword({
      body: { currentPassword, newPassword },
      headers,
    });
  } catch (error) {
    logEvent({
      event: "account.password_changed",
      user_id: sessionUser.id,
      result: "failed",
    });
    throw mapBetterAuthError(error, "修改密码失败");
  }
  logEvent({
    event: "account.password_changed",
    user_id: sessionUser.id,
    result: "ok",
  });
}
