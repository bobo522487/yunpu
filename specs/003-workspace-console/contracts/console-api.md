# Contract: 控制台 API（前端消费面）

**Feature**: `003-workspace-console` | **Date**: 2026-11-15

> 端点路径、方法、权限与状态码的**权威表**是 [endpoints.md](../../../docs/architecture/api/endpoints.md) §2.1–§2.3（Phase 0 结论 C8 已定值）。本文件只定义：控制台消费的载荷形状、与 Mock 的对齐要求。任何与 endpoints.md 冲突以 endpoints.md 为准。

## 0. 通用约定

- 全部端点前缀 `/api/v1`，响应为统一信封 `{ ok: true, data: T }` 或 `{ ok: false, code, message, details? }`（既有 `lib/api.ts` 解析）。
- 认证靠会话 cookie（`credentials: 'include'`）；未登录 → 401，前端 `RequireAuth` 跳登录。
- 分页：`?cursor=<opaque>&limit=<1..200>`，默认 50；响应 `data: { items: T[], nextCursor: string | null }`（C4）。
- 错误码使用 `packages/shared/src/errors.ts` 的 `ErrorCode` 联合（002 批次实现口径）：`VALIDATION`(400)、`UNAUTHORIZED`(401)、`FORBIDDEN`(403)、`NOT_FOUND`(404)、`CONFLICT`(409)、`RATE_LIMITED`(429)、`INTERNAL`(500)。`errors.md` §9.4 的领域码按 002 既有映射落入该集合：并发抢占（`GX010`）→ `CONFLICT`，目标缺失/越权（`GX005`）→ `NOT_FOUND`，函数内权限（`GX006`）→ `FORBIDDEN`，约束校验 → `VALIDATION`。本批次不扩展 `ErrorCode` 联合。
- 越权与不存在统一返回 `NOT_FOUND` / 404 语义「不存在或无权」，不泄漏存在性（`FR-009`）。

## 1. 账号（设置页 · 账号分区）

| 方法 | 路径 | 请求 | `data` 响应 |
| --- | --- | --- | --- |
| `GET` | `/account` | — | `{ id, email, name }` |
| `PATCH` | `/account` | `{ name: string }`（非空白，≤100） | `{ id, email, name }` |
| `POST` | `/account/password` | `{ currentPassword, newPassword }`（≥8 字符） | `{ changed: true }`；当前密码错 → 400 `VALIDATION_ERROR` |

## 2. 组织（切换器、设置页组织分区）

| 方法 | 路径 | 请求 | `data` 响应 |
| --- | --- | --- | --- |
| `GET` | `/organizations` | — | `{ organizations: [{ id, name, role, isOwner, lastUsedAt }], defaultOrganizationId }`（仅 active；**既有实现形状**，本批次不改） |
| `POST` | `/organizations` | `{ name }` | `{ organization: { id, name, role, isOwner } }`（创建后自动成为当前组织） |
| `GET` | `/organizations/:organizationId` | — | `{ organization: { id, name, status, ownerUserId, myRole, isOwner, memberCount, pendingInviteCount, projectCount } }`（非成员 → 404） |
| `PATCH` | `/organizations/:organizationId` | `{ name? , status? : 'archived' }` | `{ organization: ... }`；改名需 `organization.update`，归档需 `organization.archive` |
| `POST` | `/organizations/:organizationId/activate` | — | `{ organization: ... }`；**切换即记住**（更新 `last_used_at`） |
| `POST` | `/organizations/:organizationId/leave` | — | `{ left: true }`；owner 未先转移 → 409 |

归档成功后前端立即执行：拉取 `GET /organizations` → 若为空进入引导状态 `/onboarding`，否则 `activate` 下一个可用组织并刷新四页（spec `FR-013`）。

## 3. 成员（成员页）

| 方法 | 路径 | 请求 | `data` 响应 |
| --- | --- | --- | --- |
| `GET` | `/organizations/:organizationId/members` | 分页 | `{ items: [{ userId, name, email, role, isOwner, joinedAt }], nextCursor }` |
| `PATCH` | `/organizations/:organizationId/members/:userId` | `{ role: 'admin'\|'editor'\|'viewer' }` | `{ member: {...} }`；改 owner 角色 → 409 |
| `DELETE` | `/organizations/:organizationId/members/:userId` | — | `{ removed: true }`；移除 owner → 409；被移除者的旧会话读不到本组织任何行（RLS） |

## 4. 邀请（成员页）

| 方法 | 路径 | 请求 | `data` 响应 |
| --- | --- | --- | --- |
| `GET` | `/organizations/:organizationId/invites` | 分页 | `{ items: [{ id, email, role, status, expiresAt, createdAt }], nextCursor }`；**不含 token** |
| `POST` | `/organizations/:organizationId/invites` | `{ email, role }` | `{ invite: {...}, inviteUrl: string }`；**`inviteUrl` 含明文 token，仅此响应出现一次**；同邮箱已有 pending → 409 |
| `DELETE` | `/organizations/:organizationId/invites/:inviteId` | — | `{ revoked: true }`；非 pending → 404/409；非管理员 → 403 |

`inviteUrl` 形如 `${WEB_BASE}/#/invite/{token}`（HashRouter）。前端本批次新增 `/invite/:token` 路由：提取 token 后跳转 `/onboarding?invite=<token>` 并预填既有「接受邀请」表单（兑换仍走既有 `POST /invites/accept`，不在本批次改后端）。

## 5. 所有权转移（成员页）

| 方法 | 路径 | 请求 | `data` 响应 |
| --- | --- | --- | --- |
| `PUT` | `/organizations/:organizationId/owner` | `{ newOwnerUserId }`（必须已是成员） | `{ ownerUserId }`；非 owner → 403；非成员 → 404；并发 → 409 `CONCURRENT_MODIFICATION`（`GX010`） |

## 6. 项目（首页 + 项目页）

| 方法 | 路径 | 请求 | `data` 响应 |
| --- | --- | --- | --- |
| `GET` | `/organizations/:organizationId/projects` | 分页 + `?sort=recent` | `{ items: [{ id, name, status, updatedAt, createdAt }], nextCursor }`；首页取 `limit=5` 即「最近 5 条」（按 `updated_at` 降序，无更新按 `created_at`） |
| `POST` | `/organizations/:organizationId/projects` | `{ name, status?, surname?, hallName?, originText?, description? }` | 201 `{ project }` |
| `GET` | `/projects/:projectId` | — | `{ project }` |
| `PATCH` | `/projects/:projectId` | 变更字段 + **`expectedUpdatedAt`**（乐观锁令牌） | `{ project }`；令牌不匹配 → 409 `CONCURRENT_MODIFICATION` |
| `DELETE` | `/projects/:projectId` | — | `{ deleted: true }`；未来内容表 `RESTRICT` 时 → 409 |

概览数字（首页）由既有列表端点聚合得出：项目数 = 项目列表总数（或 `GET /organizations/:id` 的 `memberCount` 同风格计数字段），成员数、待处理邀请数来自 `GET /organizations/:id`；**不新增专用统计端点**。

## 7. 会话（横切）

`GET /auth/session`（既有）返回 `{ user, defaultOrganization, onboarding }`；`onboarding: true` 时前端四页路由重定向 `/onboarding`（`FR-002`）。

## 8. Mock 对齐要求（`features/dashboard/mockConsole.ts`）

- 每个上表端点都有对应 Mock 分支，路径与方法精确匹配（`apiRequest(path, options)` 的 `path` 不含 query 时按前缀匹配，含 `cursor` 的列表返回固定单页 `nextCursor: null`）。
- Mock 数据结构与上表 `data` 形状逐字段一致；错误场景返回同款信封（如改 owner 角色 → `{ ok:false, code:'CONCURRENT_MODIFICATION' }`），保证降级时行为可测。
- Mock 组织/项目/成员数据之间引用关系自洽（项目 `organizationId` 归属当前 Mock 组织），避免首页数字与列表不一致。
- `MockModeIndicator` 已有，不重复实现。
