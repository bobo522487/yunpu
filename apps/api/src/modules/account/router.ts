import { ChangePasswordSchema, UpdateAccountSchema } from "@yunpu/shared";
import { Hono } from "hono";
import { parseJson, requireUser } from "../../lib/http";
import type { ApiEnv } from "../../types";
import { changePassword, updateAccount } from "./service";

export const accountRouter = new Hono<ApiEnv>();

accountRouter.get("/account", async (c) => {
  const user = requireUser(c);
  return c.json({
    ok: true,
    data: { id: user.id, email: user.email, name: user.name },
  });
});

accountRouter.patch("/account", async (c) => {
  requireUser(c);
  const parsed = await parseJson(c, UpdateAccountSchema);
  const account = await updateAccount(c.req.raw.headers, parsed.name);
  return c.json({ ok: true, data: account });
});

accountRouter.post("/account/password", async (c) => {
  requireUser(c);
  const parsed = await parseJson(c, ChangePasswordSchema);
  await changePassword(
    c.req.raw.headers,
    parsed.currentPassword,
    parsed.newPassword,
  );
  return c.json({ ok: true, data: { changed: true } });
});

export default accountRouter;
