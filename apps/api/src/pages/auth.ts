import { Hono } from "hono";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { AppError } from "../lib/errors";
import { appendSetCookie } from "../lib/http";
import {
  assertLoginAllowed,
  loginKey,
  loginRateLimiter,
  sourceAddress,
} from "../middleware/login-rate-limit";
import type { ApiEnv } from "../types";
import {
  CreateOrganizationSchema,
  SignInSchema,
  SignUpSchema,
} from "@yunpu/shared";
import { getSessionView, register, signIn, signOut } from "../modules/auth/service";
import {
  acceptInvite,
  activateOrganizationForUser,
  createOrganization,
  listMyOrganizations,
} from "../modules/organization/service";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} · 云谱</title>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 42rem; margin: 3rem auto; padding: 0 1rem; line-height: 1.6; }
      label { display: block; margin: 0.75rem 0 0.25rem; }
      input { width: 100%; padding: 0.5rem; box-sizing: border-box; }
      button { margin-top: 1rem; padding: 0.5rem 1rem; }
      .error { color: #b00020; }
      .muted { color: #666; }
      ul { padding-left: 1.25rem; }
      form.inline { display: inline; }
    </style>
  </head>
  <body>
    <main>${body}</main>
  </body>
</html>`;
}

function renderError(
  c: Context<ApiEnv>,
  title: string,
  message: string,
  status = 400,
) {
  return c.html(
    page(title, `<h1>${escapeHtml(title)}</h1><p class="error">${escapeHtml(message)}</p><p><a href="/sign-in">返回登录</a></p>`),
    status as ContentfulStatusCode,
  );
}

function formValue(body: Record<string, string | File>, key: string): string {
  const value = body[key];
  return typeof value === "string" ? value : "";
}

export const authPages = new Hono<ApiEnv>();

authPages.get("/sign-up", (c) => {
  const invite = c.req.query("invite") ?? "";
  return c.html(
    page(
      "注册",
      `<h1>注册</h1>
      <p class="muted">只需邮箱与密码。注册后会立即创建一个属于你的组织。</p>
      ${invite ? `<p class="muted">邀请已附带，注册后将加入邀请组织。</p>` : ""}
      <form method="post" action="/sign-up">
        <label>邮箱 <input type="email" name="email" required autocomplete="email" /></label>
        <label>密码 <input type="password" name="password" required minlength="8" autocomplete="new-password" /></label>
        <input type="hidden" name="inviteToken" value="${escapeHtml(invite)}" />
        <button type="submit">注册</button>
      </form>
      <p>已有账号？<a href="/sign-in">登录</a></p>`,
    ),
  );
});

authPages.post("/sign-up", async (c) => {
  const body = await c.req.parseBody();
  const parsed = SignUpSchema.safeParse({
    email: formValue(body, "email"),
    password: formValue(body, "password"),
    inviteToken: formValue(body, "inviteToken") || undefined,
  });
  if (!parsed.success) {
    return renderError(c, "注册失败", "请检查邮箱与密码（密码至少 8 个字符）", 400);
  }

  try {
    const result = await register(parsed.data, c.get("requestId"));
    appendSetCookie(c, result.headers);
    return c.redirect("/app", 303);
  } catch (error) {
    return renderError(
      c,
      "注册失败",
      error instanceof AppError ? error.message : "注册失败",
      error instanceof AppError ? error.status : 500,
    );
  }
});

authPages.get("/sign-in", (c) => {
  return c.html(
    page(
      "登录",
      `<h1>登录</h1>
      <form method="post" action="/sign-in">
        <label>邮箱 <input type="email" name="email" required autocomplete="email" /></label>
        <label>密码 <input type="password" name="password" required autocomplete="current-password" /></label>
        <button type="submit">登录</button>
      </form>
      <p>还没有账号？<a href="/sign-up">注册</a></p>`,
    ),
  );
});

authPages.post("/sign-in", async (c) => {
  const body = await c.req.parseBody();
  const parsed = SignInSchema.safeParse({
    email: formValue(body, "email"),
    password: formValue(body, "password"),
  });
  if (!parsed.success) {
    return renderError(c, "登录失败", "邮箱或密码错误", 401);
  }

  const key = loginKey(parsed.data.email, sourceAddress(c));
  try {
    assertLoginAllowed(loginRateLimiter, key);
  } catch (error) {
    return renderError(
      c,
      "登录失败",
      error instanceof AppError ? error.message : "请求过于频繁",
      error instanceof AppError ? error.status : 429,
    );
  }

  try {
    const result = await signIn(parsed.data, c.get("requestId"));
    loginRateLimiter.clear(key);
    appendSetCookie(c, result.headers);
    return c.redirect(result.onboarding ? "/onboarding" : "/app", 303);
  } catch (error) {
    if (error instanceof AppError && error.code === "UNAUTHORIZED") {
      loginRateLimiter.recordFailure(key);
    }
    return renderError(
      c,
      "登录失败",
      error instanceof AppError ? error.message : "登录失败",
      error instanceof AppError ? error.status : 500,
    );
  }
});

authPages.post("/sign-out", async (c) => {
  if (!c.get("user")) return c.redirect("/sign-in", 303);
  const headers = await signOut(c.req.raw.headers);
  appendSetCookie(c, headers);
  return c.redirect("/sign-in", 303);
});

authPages.get("/app", async (c) => {
  const view = await getSessionView(c.req.raw.headers);
  if (!view) return c.redirect("/sign-in", 303);

  const organizations = await listMyOrganizations(view.user.id);
  if (!view.defaultOrganization) return c.redirect("/onboarding", 303);

  const items = organizations
    .map(
      (item) => `<li>${escapeHtml(item.name)}${item.isOwner ? "（owner）" : ""} · ${escapeHtml(item.role)}
        <form method="post" action="/app/activate" class="inline">
          <input type="hidden" name="organizationId" value="${escapeHtml(item.id)}" />
          <button type="submit">切换</button>
        </form>
      </li>`,
    )
    .join("");

  return c.html(
    page(
      "工作区",
      `<h1>${escapeHtml(view.defaultOrganization.name)}</h1>
      <p>当前角色：${escapeHtml(view.defaultOrganization.role)}${view.defaultOrganization.isOwner ? "（owner）" : ""}</p>
      <h2>我的组织</h2>
      <ul>${items}</ul>
      <form method="post" action="/sign-out"><button type="submit">登出</button></form>`,
    ),
  );
});

authPages.post("/app/activate", async (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/sign-in", 303);

  const body = await c.req.parseBody();
  try {
    await activateOrganizationForUser(user.id, formValue(body, "organizationId"));
    return c.redirect("/app", 303);
  } catch (error) {
    return renderError(
      c,
      "切换组织失败",
      error instanceof AppError ? error.message : "切换组织失败",
      error instanceof AppError ? error.status : 500,
    );
  }
});

authPages.get("/onboarding", async (c) => {
  const view = await getSessionView(c.req.raw.headers);
  if (!view) return c.redirect("/sign-in", 303);

  return c.html(
    page(
      "开始使用",
      `<h1>开始使用</h1>
      <p>你还没有可用的组织。创建一个新组织，或接受邀请。</p>
      <h2>创建组织</h2>
      <form method="post" action="/onboarding">
        <input type="hidden" name="action" value="create" />
        <label>组织名 <input type="text" name="name" required maxlength="120" /></label>
        <button type="submit">创建</button>
      </form>
      <h2>接受邀请</h2>
      <form method="post" action="/onboarding">
        <input type="hidden" name="action" value="accept" />
        <label>邀请 token <input type="text" name="token" required /></label>
        <button type="submit">接受邀请</button>
      </form>`,
    ),
  );
});

authPages.post("/onboarding", async (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/sign-in", 303);

  const body = await c.req.parseBody();
  const action = formValue(body, "action");

  try {
    if (action === "create") {
      const parsed = CreateOrganizationSchema.safeParse({ name: formValue(body, "name") });
      if (!parsed.success) return renderError(c, "创建组织失败", "组织名不能为空", 400);
      await createOrganization(user.id, parsed.data.name);
    } else if (action === "accept") {
      const token = formValue(body, "token");
      if (!token) return renderError(c, "接受邀请失败", "邀请 token 不能为空", 400);
      await acceptInvite(user.id, token);
    } else {
      return renderError(c, "操作失败", "未知操作", 400);
    }
    return c.redirect("/app", 303);
  } catch (error) {
    return renderError(
      c,
      action === "create" ? "创建组织失败" : "接受邀请失败",
      error instanceof AppError ? error.message : "操作失败",
      error instanceof AppError ? error.status : 500,
    );
  }
});
