# Contract: 最小认证页面

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md) | **Date**: 2026-11-14

本批次不引入 `apps/web` 的 Vite/React 构建链，页面由 API 进程直接返回 HTML。页面只承担认证、默认组织落地与引导，不包含谱牒业务 UI。

## 1. 路由

| 方法 | 路径 | 用途 | 未登录行为 |
| --- | --- | --- | --- |
| `GET` | `/sign-up` | 注册表单；可带 `?invite=<token>` | 可访问 |
| `POST` | `/sign-up` | 提交注册；成功后 303 到 `/app` | 可访问 |
| `GET` | `/sign-in` | 登录表单 | 可访问 |
| `POST` | `/sign-in` | 提交登录；成功 303 到 `/app` 或 `/onboarding` | 可访问 |
| `POST` | `/sign-out` | 登出；303 到 `/sign-in` | 303 到 `/sign-in` |
| `GET` | `/app` | 默认组织工作区；显示组织名、角色、登出入口 | 303 到 `/sign-in` |
| `GET` | `/onboarding` | 引导状态；提供创建/接受邀请入口 | 303 到 `/sign-in` |

> `/` 保持 001 批次的既有语义（开发环境示例工作区 / 测试环境空白页），本批次不改它的响应。认证后的工作区放在 `/app`，避免破坏环境批次的就绪与隔离验收。

## 2. 页面可见内容（验收锚点）

- `/sign-up`：表单包含邮箱、密码两个必填字段；带邀请时额外显示「邀请已附带」提示，不把 token 显示在页面正文。
- `/sign-up` 成功：页面跳转到 `/app`；工作区显示默认组织名称与「owner」或成员角色。
- `/sign-in` 失败：页面显示统一提示「邮箱或密码错误」，不显示邮箱是否存在。
- `/sign-in` 成功：跳转到 `/app`（有默认组织）或 `/onboarding`（无可用组织）。
- `/app`：显示当前组织名称、当前账号可切换的组织列表、登出按钮；不显示其他组织的数据。
- `/onboarding`：显示「创建组织」与「接受邀请」两个入口；不自动创建组织。
- 所有页面不输出密码、会话 token 或邀请 token。

## 3. 表单与 Cookie

- 表单以 `application/x-www-form-urlencoded` 提交；服务端复用 `POST /api/v1/auth/sign-up` / `sign-in` 的 schema 与错误映射。
- 会话 Cookie 由认证层下发；页面跳转不改变 Cookie 属性。
- 表单失败时返回同一页面并显示错误；不返回 500 堆栈。

## 4. 与 API 契约的关系

- 页面不新增业务规则；默认组织解析与切换规则见 [organization-selection.md](organization-selection.md)。
- 邀请参数只从查询串读取一次，提交后不写入页面、不写日志。
- 页面路由不改变 `/api/v1/*` 的响应形状；API 仍以 JSON 为唯一机器契约。
