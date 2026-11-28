import { Hono } from "hono";
import { createContractBinder } from "../../lib/contract";
import type { ApiEnv } from "../../types";
import { changePassword, updateAccount } from "./service";

export const accountRouter = new Hono<ApiEnv>();
const route = createContractBinder(
  accountRouter,
  "apps/api/src/modules/account/router.ts",
);

route("get", "/account", async (c, { user }) => {
  return c.json({
    ok: true,
    data: { id: user.id, email: user.email, name: user.name },
  });
});

route("patch", "/account", async (c, { user, body }) => {
  const account = await updateAccount(user, c.req.raw.headers, body.name);
  return c.json({ ok: true, data: account });
});

route("post", "/account/password", async (c, { user, body }) => {
  await changePassword(
    user,
    c.req.raw.headers,
    body.currentPassword,
    body.newPassword,
  );
  return c.json({ ok: true, data: { changed: true } });
});

export default accountRouter;
