import { ChangePasswordSchema, UpdateAccountSchema } from "@yunpu/shared";
import { Hono } from "hono";
import { AppError } from "../../lib/errors";
import type { ApiEnv } from "../../types";
import { changePassword, updateAccount } from "./service";

function requireUser(user: ApiEnv["Variables"]["user"]) {
  if (!user) throw new AppError("UNAUTHORIZED", "需要登录", 401);
  return user;
}

function validationError(details: Record<string, unknown>): AppError {
  return new AppError("VALIDATION", "请求参数不合法", 400, details);
}

export const accountRouter = new Hono<ApiEnv>();

accountRouter.get("/account", async (c) => {
  const user = requireUser(c.get("user"));
  return c.json({
    ok: true,
    data: { id: user.id, email: user.email, name: user.name },
  });
});

accountRouter.patch("/account", async (c) => {
  requireUser(c.get("user"));
  const body = await c.req.json().catch(() => null);
  const parsed = UpdateAccountSchema.safeParse(body);
  if (!parsed.success) {
    throw validationError(parsed.error.flatten().fieldErrors);
  }
  const account = await updateAccount(c.req.raw.headers, parsed.data.name);
  return c.json({ ok: true, data: account });
});

accountRouter.post("/account/password", async (c) => {
  requireUser(c.get("user"));
  const body = await c.req.json().catch(() => null);
  const parsed = ChangePasswordSchema.safeParse(body);
  if (!parsed.success) {
    throw validationError(parsed.error.flatten().fieldErrors);
  }
  await changePassword(
    c.req.raw.headers,
    parsed.data.currentPassword,
    parsed.data.newPassword,
  );
  return c.json({ ok: true, data: { changed: true } });
});

export default accountRouter;
