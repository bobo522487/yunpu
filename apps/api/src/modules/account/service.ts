import { logEvent } from "../../lib/logger";
import type { SessionUser } from "../../types";
import { auth, mapBetterAuthError } from "../auth";

export type AccountRecord = {
  id: string;
  email: string;
  name: string;
};

/** 只修改调用者本人的显示名（`account.write`，FR-006）。 */
export async function updateAccount(
  sessionUser: SessionUser,
  headers: Headers,
  name: string,
): Promise<AccountRecord> {
  try {
    await auth.api.updateUser({ body: { name }, headers });
  } catch (error) {
    throw mapBetterAuthError(error, "修改资料失败");
  }
  logEvent({
    event: "account.updated",
    user_id: sessionUser.id,
    result: "ok",
  });
  return {
    id: sessionUser.id,
    email: sessionUser.email,
    name,
  };
}

/** 修改本人密码：需当前密码；失败不改密（Better Auth 事务内校验）。 */
export async function changePassword(
  sessionUser: SessionUser,
  headers: Headers,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
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
