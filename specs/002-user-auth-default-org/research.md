# Phase 0 Research: 用户注册、登录与默认组织

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-11-14

本文件记录本批次的技术决策、依据与被否方案。规格中的行为约束不在本文重复。

## 0. 结论摘要

| # | 决策 | 一句话理由 |
| --- | --- | --- |
| R1 | 认证使用 Better Auth 1.7.23（Drizzle adapter、数据库会话、邮箱密码） | `docs/architecture/stack.md` §10 已锁定；不手写密码与会话 |
| R2 | 注册采用「编排 + 补偿删除」，不追求跨认证层单事务 | Better Auth 的 `after` 钩子在事务提交后执行，无法回滚已建用户 |
| R3 | 默认组织不建新表，使用 `organization_member.last_used_at` | 偏好属于成员关系；查询可推导，避免第二张偏好表 |
| R4 | 登录失败计数使用进程内有界 Map | 单应用进程；15 分钟窗口无需新增表或缓存 |
| R5 | 表 DDL 用 Drizzle 生成，函数 / RLS / 角色用手写迁移 | `docs/architecture/data/migrations.md` 的既定边界 |
| R6 | Better Auth 使用独立连接角色 `auth_runtime` | `docs/architecture/data/security.md` §8.1 要求认证连接不与业务连接共用 |
| R7 | 本批次只做 API 进程内的最小认证页面 | 不引入 Vite/React/Playwright；`apps/web` 留给后续批次 |
| R8 | 邀请只在注册 / 登录后消费，不提供邀请创建端点 | 邀请生成属于组织模块；本批次用测试夹具造邀请 |

## R1. 认证库与会话配置

**Decision**: 使用 Better Auth 1.7.23 + Drizzle adapter，表放在 `auth` schema；邮箱密码开启，`minPasswordLength = 8`；会话 `expiresIn = 604800`（7 天）、`updateAge = 86400`（1 天）、`cookieCache.enabled = false`、不设绝对最长寿命。

**Rationale**:

- `docs/architecture/stack.md` §10 与 `docs/architecture/overview.md` §10 已把 Better Auth、数据库会话、7 天滑动续期、关闭 cookie 缓存写成目标基线。
- 关闭 cookie 缓存意味着每次会话校验都查库，符合「安全优先于性能」的既有取舍。
- 显示名不是注册必填，但 Better Auth 的 `user.name` 是必填字段；注册时用邮箱前缀填充，既满足库约束，也符合规格的缺省显示名规则。

**Alternatives considered**:

- 手写密码哈希与会话：否决。会复制密码哈希参数、会话轮换、cookie 属性等安全逻辑，维护成本高于引入成熟库。
- 使用 cookie 缓存会话：否决。与 `overview.md` §10 的 `cookieCache.enabled: false` 冲突，且登出即时失效更难保证。

**References**: Better Auth session options（`expiresIn` / `updateAge` / `cookieCache`）与 Hono `getSession` 用法，见 `https://github.com/better-auth/better-auth/blob/main/docs/content/docs/reference/options.mdx` 与 `.../basic-usage.mdx`。

## R2. 注册与默认组织的一致性

**Decision**: 注册走应用层编排：

1. 规范化邮箱，调用 `auth.api.signUpEmail`（`returnHeaders: true`）创建用户与会话。
2. 在业务事务内设置 `app.user_id`，按是否有邀请执行 `app.accept_invite(token)` 或 `app.create_organization(defaultName)`。
3. 邀请失败（邮箱不匹配 / 过期 / 已兑换）不回滚注册，改为创建个人默认组织并在响应中说明邀请未生效。
4. 默认组织创建失败时，按 `session → account → user` 顺序补偿删除刚创建的用户，返回失败；不转发 Set-Cookie。

**Rationale**:

- Better Auth 的 `databaseHooks.*.after` 在事务提交后执行；官方文档明确：当适配器有事务时，`after` 钩子在提交后运行，回滚则跳过；若适配器没有事务，后续步骤失败时钩子仍会运行。因此不能把「建默认组织」放进 `after` 钩子并指望它回滚用户。
- 认证表与业务表由不同连接角色持有，跨层单事务需要把 Better Auth 的写入塞进业务事务，依赖其内部 API，升级风险高。
- 规格 `FR-006` 要求响应完成后不存在半成品；补偿删除 + 集成测试可以在可观察层面满足该要求。补偿本身失败时必须返回 `500` 并记录可人工清理的证据，不静默把注册报告为成功。

**Alternatives considered**:

- 在 `databaseHooks.user.create.after` 里建组织：否决。钩子失败不会回滚已提交的用户。
- 业务表直接写 `auth.user` / `auth.account`：否决。绕过密码哈希、邮箱规范化与会话创建。
- 先建组织再建用户：否决。`organization.owner_user_id` 是 `NOT NULL` 外键，必须先有用户。
- 引入分布式事务 / 消息队列：否决。违反 `OOS-09` 与 1–3 人团队的复杂度预算。

**References**: Better Auth Database Hooks 文档，`https://github.com/better-auth/better-auth/blob/main/docs/content/docs/concepts/database.mdx`；服务端 API 返回头用法见 `.../concepts/api.mdx`。

## R3. 默认组织的存储与解析

**Decision**: 在 `organization_member` 增加可空列 `last_used_at timestamptz`；默认组织解析为：

```sql
SELECT o.id, o.name, om.role
FROM public.organization_member om
JOIN public.organization o ON o.id = om.organization_id
WHERE om.user_id = app.current_user_id()
  AND o.status = 'active'
ORDER BY om.last_used_at DESC NULLS LAST, om.created_at ASC, o.id
LIMIT 1;
```

注册建默认组织、兑换邀请、用户切换组织时，把对应成员行的 `last_used_at` 置为 `clock_timestamp()`。

**Rationale**:

- 「上次在哪个组织工作」是成员关系上的事实，不是独立实体；按 Article IV 用一列表达即可，查询时推导默认组织。
- 不需要新增 `user_preference` 表，也不给 `auth.user` 加业务字段；跨设备一致由数据库天然保证。
- 「最早加入」用 `organization_member.created_at`，无需第二份存储。

**Alternatives considered**:

- 新建 `user_preference(user_id, default_organization_id)`：否决。多一张表、一套 RLS 策略与一轮文档同步，收益与一列相同。
- 存在 `auth.user` 额外字段：否决。业务偏好进入认证层，且更新路径依赖 Better Auth 内部适配器。
- 只存当前设备（cookie / localStorage）：否决。已被澄清要求跨设备一致。

## R4. 登录失败限流

**Decision**: 在 `apps/api/src/middleware/login-rate-limit.ts` 实现进程内计数：

- 键：`规范化邮箱 + 来源地址`。
- 窗口：15 分钟；连续失败 5 次后拒绝该组合；成功登录删除键。
- 来源地址：优先取 Hono `getConnInfo()` 的连接地址；仅当部署在可信反向代理后时读取 `X-Forwarded-For` 首段。
- 存储：有界 `Map`，带过期清理与容量上限；进程重启会清空计数。

**Rationale**:

- 平台当前是单 Bun 进程、3 个基础设施组件；为 15 分钟窗口引入数据库表或 Redis 不划算，且 Redis 在「明确不做」清单内。
- Better Auth 自带限流默认按客户端地址与路径计数，无法直接表达「规范化邮箱 + 来源地址」的组合键；本批次把该规则放在路由层，平台统一配额仍由 Phase 0 `C5` 管理。

**Alternatives considered**:

- 新建登录失败表：否决。每次失败写入 + 清理任务，并增加业务表数量。
- 仅依赖 Better Auth 内置限流：否决。无法按邮箱维度计数，且内置值与规格的 5 次 / 15 分钟不一致。
- 永久锁定账号：否决。规格明确不做永久锁定，且容易形成拒绝服务。

**Accepted limitation**: 进程重启会重置窗口；攻击者轮换来源地址可绕过组合计数。两者已写入规格 Edge Cases，平台级限流作为兜底。

## R5. 数据访问、迁移与 ID

**Decision**:

- `packages/db` 提供 Drizzle schema、连接池与迁移；`drizzle-kit` 只用于生成表 DDL。
- 角色、`app.*` 函数、RLS 策略、触发器与授权使用手写迁移（`0000`、`0003`、`0004`、`0005`），与 `docs/architecture/data/migrations.md` 的「复杂 DDL 走手写迁移」一致。
- 业务表主键使用数据库默认 `uuidv7()`；认证表由 Better Auth 在应用层生成 ID，通过 `advanced.database.generateId` 注入 `lib/ids.ts` 的 UUIDv7，保证与业务外键同为 `uuid` 且时间有序。
- 迁移以幂等 SQL 编写，本地由 `scripts/env.sh` 在环境就绪后执行；根 `package.json` 提供 `db:generate`（生成表 DDL）与 `db:migrate`（按序应用全部迁移）两个脚本，生产迁移角色不在本批次定义。

**Rationale**: 认证表结构由 Better Auth 约定，落成 Drizzle schema 后由生成器产出 DDL 最不易漏列；函数、策略与授权包含 `SECURITY DEFINER`、`FORCE RLS` 等生成器不覆盖的内容，必须手写。

**Alternatives considered**:

- 全部手写 DDL：否决。认证表字段随 Better Auth 版本变化，手抄容易漏列。
- 全部用 drizzle-kit：否决。`pgPolicy()` 不生成 `FORCE ROW LEVEL SECURITY`，函数与触发器也不在生成范围。
- 认证表使用默认随机字符串 ID：否决。业务表 `organization_member.user_id` / `invite.invited_by` 是 `uuid` 外键，类型不一致。

## R6. 数据库角色与连接

**Decision**:

- 业务连接继续使用 `genealogy_app`（无 `BYPASSRLS`）。
- Better Auth 运行时使用独立 `auth_runtime` 连接，只持有 `auth` schema 的 DML。
- `rls_definer` 为 `NOLOGIN BYPASSRLS`，持有受控函数所需的最小权限，包括读取 `auth."user"(email)` 与更新 `organization_member.last_used_at`。
- 本地迁移由 Compose 的 `postgres` 超级用户执行；生产迁移角色留给部署批次。

**Rationale**: `docs/architecture/data/security.md` §8.1 / §8.5 要求认证连接与业务连接分离，且受控函数属主只能是 `rls_definer`。本批次不把 `auth` 表权限授予 `genealogy_app`，避免业务代码绕过认证层改账号。

**Alternatives considered**: 复用 `genealogy_app` 连接：否决。会把 `auth` 表的写权限扩散到业务代码，破坏最小权限。

## R7. 前端范围

**Decision**: 认证行为仍由 `apps/api/src/pages/auth.ts` 的最小 HTML 页面验证；`apps/web` 已克隆为独立的 Vite + React 工程，本批次不接认证 API。

**Rationale**: 规格的成功标准是用户可见行为，不是前端框架。`apps/web` 当前是既有的 UI 原型，包含本地 mock 数据与独立路由；在同一批次里同时改认证 API 与前端会放大回归面。把它放进 monorepo 是为了后续统一依赖与构建，而不是本批次交付认证 UI。

**Alternatives considered**: 在本批次直接把 `apps/web` 接到 `/api/v1/auth/*`：否决。会引入第二套登录/会话状态与未完成的业务 UI，超出本规格范围。保留服务端最小页面可以在不依赖前端构建的前提下验证认证行为。

## R8. 邀请的生成与消费

**Decision**: 本批次不提供邀请创建端点；`app.resolve_invite_by_token()` / `app.accept_invite()` 按 `docs/architecture/data/schema.md` §5.3 实现。测试用 `tests/auth/fixtures.ts` 直接插入一条 `pending` 邀请（CSPRNG token，数据库只存 SHA-256），供注册与登录后的兑换用例使用。

**Rationale**: 规格明确邀请生成属于组织模块，本批次只负责兑换与默认组织落位。提供测试夹具可以在不扩大产品范围的前提下验证 `GX005` / `GX009` / `GX010`。

**Alternatives considered**: 本批次顺带实现邀请创建端点：否决。会引入邀请列表、撤销、角色授权与邮件投递的半套功能，超出规格。

## R9. 认证事件的记录方式

**Decision**: 注册、登录、登出与邀请兑换写结构化日志（`event`、`request_id`、`user_id`、`organization_id`、结果），不写密码、会话令牌或邀请明文；组织创建与邀请兑换继续由 `app.create_organization()` / `app.accept_invite()` 写 `audit_log` 强审计。

**Rationale**: `audit_log.organization_id` 为 `NOT NULL`，未加入任何组织的登录无法写入；把认证事件写日志既满足可审计，也不为审计新建表。日志字段沿用 `overview.md` §13 的裁剪规则。

**Alternatives considered**: 为认证事件新建 `auth_event` 表：否决。新增表与 RLS 策略，且与 `audit_log` 的职责重叠。

## 未决项与依赖

- Phase 0 九类契约项（C1–C9）已全部定值，`/speckit-tasks` 不再被阻塞。C3 见 [conventions.md](../../docs/architecture/api/conventions.md) §1.13，C4 见同文 §1.4，C5 见 §1.11，C6 见 §1.8，C8 见 [endpoints.md](../../docs/architecture/api/endpoints.md) §2。
- 本批次采用的 `POST /api/v1/invites/accept`、`POST /api/v1/organizations/:organizationId/activate`、`POST /api/v1/organizations`、`GET /api/v1/auth/session` 均已登记；分页使用 `cursor` / `limit`（默认 50、上限 200），通用 `Idempotency-Key` V1 不启用，邀请兑换使用自然键抢占。
- `docs/` 需要在本批次实现时同步的最小改动：`schema.md` §5.2 增加 `organization_member.last_used_at`；`security.md` §8.4/§8.5 增加该列授权与 `rls_definer` 对 `auth.user(email)` 的读取；`errors.md` §9.4 增加邮箱唯一冲突映射。改动后必须通过文档门禁。
