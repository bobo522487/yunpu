# Tasks: 用户注册、登录与默认组织

**Input**: Design documents from `/specs/002-user-auth-default-org/`

**Prerequisites**: [plan.md](plan.md)、[spec.md](spec.md)、[research.md](research.md)、[data-model.md](data-model.md)、[contracts/](contracts/)、[quickstart.md](quickstart.md)

**Tests**: 按项目宪法「先写会失败的测试」执行；测试打在真实 PostgreSQL 18 上，不 mock RLS、唯一约束、邀请抢占与限流窗口。

## 实施原则（Linus 视角）

- 先让约束在数据库里生效，再写应用逻辑；应用层不重复实现 DB 能表达的规则。
- 不引入通用抽象、缓存、队列或第二套幂等机制；本批次只增加 `docs/` 已定值的 Better Auth 与 Drizzle。
- 每个任务以一个可观察行为为完成标准；没有验证方式的任务不写进本表。
- 失败要响亮：错误按 SQLSTATE + 约束名映射，禁止 `catch { return null }`。
- 删除优于兼容：本批次不用的端点、字段与抽象不预埋；表只建认证表 + 4 张租户表。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 不同文件、无未完成依赖，可并行
- **[Story]**: 对应用户故事（US1 / US2 / US3 / US4）
- 每个任务都带精确文件路径

## Path Conventions

- API：`apps/api/src/`
- 数据库契约：`packages/db/`、`packages/shared/`
- 集成测试：`tests/auth/`
- 路由测试：`apps/api/test/`

---

## Phase 1: Setup（共享基础设施）

**Purpose**: 建立本批次需要的 workspace、依赖、环境变量与数据库角色

- [X] T001 更新 `pnpm-workspace.yaml` 纳入 `apps/*` 与 `packages/*`；创建 `packages/db/package.json`（`@yunpu/db`）与 `packages/shared/package.json`（`@yunpu/shared`），均设 `"type": "module"`。
- [X] T002 在 `apps/api/package.json` 增加 `better-auth@1.7.23`、`drizzle-orm@0.45.4` 与开发依赖 `@types/pg`；在 `packages/db/package.json` 增加 `drizzle-orm@0.45.4`、`pg`、开发依赖 `drizzle-kit` 与 `@types/pg`；在根 `package.json` 增加 `db:generate` 与 `db:migrate` 脚本。
- [X] T003 更新 `apps/api/src/env.ts`、`.env.example`、`.env.test`、`scripts/env.sh`：新增 `AUTH_DATABASE_URL`（用户必须是 `auth_runtime`）、`BETTER_AUTH_SECRET`、`BETTER_AUTH_URL`；保持 `DATABASE_URL` 使用 `genealogy_app`，并校验两者数据库名与 `YUNPU_ENV` 配对。
- [X] T004 更新 `docker/postgres/init/01-role.sql` 与 `scripts/env.sh`：幂等创建 `rls_definer`（`NOLOGIN BYPASSRLS`）与 `auth_runtime`（`LOGIN NOBYPASSRLS`）；本地口令只用于开发/测试，不写入生产配置。
- [X] T005 创建 `packages/shared/src/enums.ts`、`schemas.ts`、`errors.ts`：角色 `admin/editor/viewer`、组织状态 `active/suspended/archived`、邀请状态 `pending/accepted/revoked`；Zod schema 覆盖注册/登录/创建组织/切换组织/接受邀请；邮箱 `trim().toLowerCase()` 且唯一，密码最小 8 字符，组织名 `btrim` 后非空。
- [X] T006 创建 `packages/db/src/client.ts` 与 `packages/db/src/migrate.ts`：业务连接用 `DATABASE_URL`，认证连接用 `AUTH_DATABASE_URL`；两者设 `prepare: false` 并由连接串下发 `PGOPTIONS`；迁移器按文件名顺序执行 `migrations/*.sql` 并记录到 `schema_migrations`，重复执行幂等；`drizzle-kit generate` 产出的 SQL 按顺序重命名后由同一迁移器应用，不引入第二套迁移状态。
- [X] T007 [P] 创建 `packages/db/src/schema/auth.ts`：Better Auth 的 `auth."user"`、`auth.session`、`auth.account`、`auth.verification` Drizzle 定义；`id` 为 `uuid`，`user.email` 唯一。
- [X] T008 创建 `packages/db/src/schema/tenant.ts`：`organization`、`organization_member`（含 `last_used_at timestamptz NULL`）、`invite`、`audit_log` 的 Drizzle 定义；字段、空值、默认值与 `data-model.md` 一致；`organization_member.user_id` 引用 T007 的 `auth.user`。
- [X] T009 创建 `packages/db/src/schema/index.ts` 汇总导出 T007/T008，并更新 `packages/db/package.json` 的入口。

---

## Phase 2: Foundational（阻塞所有用户故事）

**Purpose**: 数据库结构、受控函数、RLS、认证实例与请求上下文

**⚠️ CRITICAL**: 本阶段完成前，任何用户故事都不能开始。

- [X] T010 创建 `packages/db/migrations/0000_roles.sql`（自定义迁移，创建角色与 schema 基础）；用 `drizzle-kit generate` 从 T007 生成认证表 DDL 并落到 `packages/db/migrations/0001_auth_tables.sql`；生成物必须使用 `auth` schema、`uuid` 主键与 `user.email` 唯一索引。
- [X] T011 用 `drizzle-kit generate` 从 T008 生成租户表 DDL 并落到 `packages/db/migrations/0002_tenant_tables.sql`；手工补齐生成器不覆盖的部分：`organization.owner_user_id` 循环外键分两步并 `DEFERRABLE INITIALLY IMMEDIATE`、`organization_member.last_used_at timestamptz NULL`、`organization_member` 主键 `(organization_id, user_id)` 与 `idx_organization_member_user`、`invite` 的 `token_hash bytea` / `UNIQUE (token_hash)` / 部分唯一索引 `uq_invite_pending_email`、`audit_log` 无 `updated_at`。
- [X] T012 创建 `packages/db/migrations/0003_functions.sql`：实现 `app.current_user_id()`（非法 UUID 返回 NULL）、`app.visible_org_array()`（`SELECT` 用 `organization_member`）、`app.touch_updated_at()`（`clock_timestamp()`）、`app.guard_scope_immutable()`（`GX002`）、`app.guard_append_only()`（`GX004`）、`app.create_organization(text)`（同一事务插组织 + owner `admin` 成员 + `audit_log`，缺 `app.user_id` 抛 `GX008`）、`app.resolve_invite_by_token(text)` 与 `app.accept_invite(text)`（条件更新抢占，邮箱比较必须用 `IS DISTINCT FROM`，错误码 `GX005`/`GX009`/`GX010`）。
- [X] T013 创建 `packages/db/migrations/0004_rls.sql`：对 `organization`、`organization_member`、`invite`、`audit_log` 执行 `ENABLE` + `FORCE ROW LEVEL SECURITY`；策略谓词 `organization_id = ANY (app.visible_org_array())`，`organization` 自身用 `id = ANY (app.visible_org_array())`。
- [X] T014 创建 `packages/db/migrations/0005_grants.sql`：授予 `genealogy_app` 读取与最小写权限，`organization_member` 的列级 `UPDATE (role, last_used_at, updated_at)`；`rls_definer` 最小权限包含 `auth."user"(email)` 的 `SELECT`；不把 `auth` schema 任何权限授予 `genealogy_app`。
- [X] T015 [P] 同步 `docs/architecture/data/schema.md` §5.2 的 `last_used_at`、`docs/architecture/data/security.md` §8.4/§8.5 的授权、`docs/architecture/data/errors.md` §9.4 的邮箱唯一冲突映射、`docs/architecture/data/invariants.md` §7.2 的软约束登记；不得复制 `docs/` 表格。
- [X] T016 [P] 创建 `apps/api/src/lib/ids.ts`：实现 UUIDv7 生成函数，供 Better Auth 的 `advanced.database.generateId` 使用；不引入第三方 UUID 依赖。
- [X] T017 [P] 创建 `apps/api/src/lib/errors.ts`：`AppError`、`HTTPException` 映射、SQLSTATE + 约束名两级映射；覆盖邮箱唯一（409）、`GX005`/`GX008`/`GX009`/`GX010`、`RATE_LIMITED`（429）；禁止解析数据库消息文本。
- [X] T018 [P] 创建 `apps/api/src/lib/logger.ts`：结构化日志字段 `request_id`、`user_id`、`organization_id`、`event`、`result`；禁止记录密码、会话 token、邀请明文。
- [X] T019 创建 `apps/api/src/auth/index.ts`：Better Auth 实例使用 `drizzleAdapter` 与 `packages/db/src/schema`；`basePath: "/api/v1/auth"`；`emailAndPassword.minPasswordLength: 8`；`session.expiresIn: 604800`、`updateAge: 86400`、`cookieCache.enabled: false`；`advanced.database.generateId` 使用 T016 的 UUIDv7；`secret`/`baseURL`/`trustedOrigins` 来自环境变量。
- [X] T020 创建 `apps/api/src/middleware/auth.ts` 与 `apps/api/src/db/with-user.ts`：`auth.api.getSession({ headers })` 写入 `c.set('user')`；业务事务内 `SET LOCAL ROLE genealogy_app`、`set_config('app.user_id', ..., true)`，并断言 `current_user = 'genealogy_app'`。
- [X] T021 更新 `apps/api/src/app.ts`：按 `requestId → secureHeaders → compress → authMiddleware → 路由` 组织；接入 `onError` 统一错误体；保留 `/api/health`、`/api/ready` 与 `/` 的既有语义。
- [X] T022 创建 `tests/auth/schema.test.ts` 并在测试环境执行 `pnpm db:migrate -- --env test`，断言认证表 + 4 张租户表存在、`organization_member.last_used_at` 存在、四张表 `rowsecurity = true` 且 `forcerowsecurity = true`；不新增第 5 张业务表。

**Checkpoint**: 数据库、认证实例与请求上下文就绪，可以开始用户故事。

---

## Phase 3: User Story 1 - 注册后立即获得默认组织（Priority: P1）🎯 MVP

**Goal**: 新邮箱注册后立即建立会话，并原子创建默认组织；注册者成为唯一 owner 与 `admin` 成员。

**Independent Test**: 用全新邮箱注册，确认 201、会话 Cookie、`defaultOrganization` 存在、`role = admin`、`isOwner = true`，并在 `/app` 看到组织名。

### Tests for User Story 1

- [X] T023 [P] [US1] 编写 `tests/auth/registration.test.ts`：注册成功、大小写/空白邮箱视为同一邮箱、密码不足 8 位返回 400、重复邮箱返回 409、默认组织 owner 正确、注册后 `/api/v1/auth/session` 可读到同一组织。
- [X] T024 [P] [US1] 编写 `apps/api/test/auth-router.test.ts`：用注入的失败组织创建器验证「组织创建失败 → 认证用户被补偿删除 → 响应为 500」，并断言不返回会话 Cookie。

### Implementation for User Story 1

- [X] T025 [US1] 创建 `apps/api/src/modules/organization/queries.ts`、`service.ts` 与 `errors.ts`：封装 `app.create_organization(name)` 调用与默认组织解析查询（`last_used_at DESC NULLS LAST, created_at ASC, id`，仅 `status = 'active'`）；`errors.ts` 只放组织/邀请域错误并继承 `AppError`；提供更新成员行 `last_used_at` 的单一入口；不新增第二套组织读写路径。
- [X] T026 [US1] 创建 `apps/api/src/auth/provisioning.ts`：调用 `auth.api.signUpEmail({ ..., returnHeaders: true })`；无邀请时在业务事务内创建默认组织；组织创建逻辑通过参数注入，便于失败注入测试；任一步失败按 `session → account → user` 补偿删除并通过日志响亮记录。
- [X] T027 [US1] 创建 `apps/api/src/modules/auth/schema.ts`、`service.ts` 与 `errors.ts`：复用 `packages/shared` 的注册 schema；`errors.ts` 只放注册/会话域错误并继承 `AppError`；规范化邮箱；默认组织名取 `name || email 前缀` + 「的组织」；返回 `user`、`defaultOrganization`、`invite` 形状。
- [X] T028 [US1] 创建 `apps/api/src/modules/auth/router.ts`：实现 `POST /api/v1/auth/sign-up` 与 `GET /api/v1/auth/session`；转发 Better Auth 的 `Set-Cookie`；未登录时 `session` 返回 `user: null`。
- [X] T029 [US1] 创建 `apps/api/src/pages/auth.ts`：`GET/POST /sign-up` 最小 HTML 表单（邮箱 + 密码），成功后 303 到 `/app`；`GET /app` 显示当前组织名、角色与登出入口；不修改 `/` 的既有语义。
- [X] T030 [US1] 在 `apps/api/src/modules/auth/service.ts` 的注册成功/失败路径写结构化日志（不记录密码、token、邀请明文），并接入 `apps/api/src/lib/logger.ts`。
- [X] T031 [US1] 在 `apps/api/src/app.ts` 挂载认证与页面路由，运行 `bun test --env-file .env.test tests/auth/registration.test.ts apps/api/test/auth-router.test.ts`，全部通过后进入 US2。

**Checkpoint**: US1 独立可用，构成 MVP。

---

## Phase 4: User Story 2 - 登录、登出与会话保持（Priority: P1）

**Goal**: 邮箱密码登录回到默认组织；会话 7 天滑动、无绝对上限；登出只结束当前会话；登录失败按「邮箱 + 来源地址」5 次 / 15 分钟限流。

**Independent Test**: 正确登录返回默认组织；错误邮箱与错误密码提示一致；两台设备登录后登出其中一台，另一台仍有效；连续 5 次失败后第 6 次返回 429。

### Tests for User Story 2

- [X] T032 [P] [US2] 编写 `tests/auth/login-session.test.ts`：正确登录、未知邮箱与错误密码返回一致 401、会话 Cookie、`/session` 恢复、登出只失效当前会话、数据库会话 `expires_at` 约为 7 天。
- [X] T033 [P] [US2] 编写 `tests/auth/login-rate-limit.test.ts`：同一「规范化邮箱 + 来源地址」5 次失败后第 6 次 429；成功登录清零；注入时钟验证 15 分钟窗口结束后自动恢复。

### Implementation for User Story 2

- [X] T034 [US2] 创建 `apps/api/src/middleware/login-rate-limit.ts`：有界 `Map`，键为规范化邮箱 + 来源地址；连续 5 次失败锁定 15 分钟；成功登录删除键；时钟与来源地址可注入；429 响应体与 `Retry-After` 符合 `docs/architecture/api/conventions.md` §1.11。
- [X] T035 [US2] 扩展 `apps/api/src/modules/auth/service.ts`：实现 `signInEmail`、`signOut`、会话读取；登录失败统一抛 `UNAUTHORIZED`（文案「邮箱或密码错误」）；成功登录清除限流计数。
- [X] T036 [US2] 扩展 `apps/api/src/modules/auth/router.ts`：实现 `POST /api/v1/auth/sign-in`、`POST /api/v1/auth/sign-out`；登录/登出转发 `Set-Cookie`；`sign-in` 先过 T034 限流。
- [X] T037 [US2] 扩展 `apps/api/src/pages/auth.ts`：`GET/POST /sign-in` 表单与统一错误提示；成功 303 到 `/app` 或 `/onboarding`；`POST /sign-out` 303 到 `/sign-in`。
- [X] T038 [US2] 在 `apps/api/src/app.ts` 同时为 API 与认证页面 POST 挂载限流；运行 US2 测试并确认不影响 US1。

**Checkpoint**: US1 + US2 均可独立工作。

---

## Phase 5: User Story 3 - 通过邀请注册或登录时进入正确组织（Priority: P2）

**Goal**: 邀请注册直接加入邀请组织且不创建个人组织；邮箱不一致/过期/已兑换时注册成功但邀请不生效；已登录用户接受邀请后默认组织切换。

**Independent Test**: 用与邀请邮箱一致的新邮箱携带 token 注册，确认只加入邀请组织；用其他邮箱携带同一 token 注册，确认创建个人组织并返回 `email_mismatch`/`already_used`。

### Tests for User Story 3

- [X] T039 [P] [US3] 创建 `tests/auth/fixtures.ts`：用 CSPRNG 生成 token、数据库只存 `sha256`，插入 `pending` 邀请；提供创建第二组织、归档组织、插入成员的测试夹具，并提供 quickstart 使用的 `create-invite` / `archive-org` CLI；不得新增生产端点。
- [X] T040 [P] [US3] 编写 `tests/auth/invite-acceptance.test.ts`：有效邀请注册、邮箱不一致、过期、已撤销、已兑换、并发兑换只有一人成功、注册后不额外创建个人组织、已登录用户 `POST /api/v1/invites/accept` 切换默认组织。

### Implementation for User Story 3

- [X] T041 [US3] 扩展 `apps/api/src/auth/provisioning.ts`：注册体携带 `inviteToken` 时调用 `app.accept_invite(token)`；成功则以邀请组织为默认组织且不建个人组织；失败（`GX005`/`GX009`/`GX010`）不补偿注册，改为创建个人默认组织并返回 `accepted: false` 与 `reason`。
- [X] T042 [US3] 扩展 `apps/api/src/modules/organization/service.ts`：实现已登录用户的 `acceptInvite(token)`，成功后更新该成员行 `last_used_at`；角色取邀请 `role`，邀请不能授予 owner。
- [X] T043 [US3] 扩展 `apps/api/src/modules/organization/router.ts`：实现 `POST /api/v1/invites/accept`，校验 `AcceptInviteSchema`，映射 `GX005`→404、`GX009`→403、`GX010`→409。
- [X] T044 [US3] 扩展 `apps/api/src/pages/auth.ts`：注册页读取 `?invite=<token>` 并作为隐藏字段提交，不在页面正文回显 token；`/onboarding` 提供接受邀请表单。
- [X] T045 [US3] 在 `packages/db/migrations/0003_functions.sql` 与 `tests/auth/invite-acceptance.test.ts` 中断言 `app.create_organization` 与 `app.accept_invite` 写 `audit_log`（`project_id IS NULL`），且日志与审计不含邀请明文。

**Checkpoint**: US3 可独立验证，并与 US1/US2 集成。

---

## Phase 6: User Story 4 - 多组织下的默认组织选择与切换（Priority: P2）

**Goal**: 登录进入上次使用的 active 组织；无记录时进入最早加入的组织；归档组织被跳过；无可用组织进入引导状态；切换结果跨设备一致。

**Independent Test**: 创建两个组织并切换，换设备登录仍进入上次组织；归档默认组织后登录跳过它；无组织时 `/onboarding` 可创建新组织。

### Tests for User Story 4

- [X] T046 [P] [US4] 编写 `tests/auth/default-organization.test.ts`：`last_used_at` 优先、无记录时 `created_at` 最早、归档组织跳过、无可用组织时 `defaultOrganization = null` 且 `onboarding = true`、两台设备登录进入同一组织。
- [X] T047 [P] [US4] 编写 `tests/auth/tenant-isolation.test.ts`：账号 A 访问账号 B 的组织返回 404；`GET /api/v1/organizations` 只返回自己的 active 组织；在真 PG 上直接以 `genealogy_app` 和 `app.user_id` 查询，验证 RLS 过滤跨租户行。

### Implementation for User Story 4

- [X] T048 [US4] 扩展 `apps/api/src/modules/organization/queries.ts`：实现「我的组织列表」并复用 T025 的默认组织解析；不复制第二份排序逻辑，不缓存结果。
- [X] T049 [US4] 扩展 `apps/api/src/modules/organization/service.ts`：实现列出组织与激活组织；创建组织复用 T025 的 `create_organization` 调用；激活只允许 active 成员关系，成功后 `UPDATE organization_member SET last_used_at = clock_timestamp() WHERE organization_id = $1 AND user_id = app.current_user_id()`；影响 0 行返回「不存在或无权」。
- [X] T050 [US4] 创建或扩展 `apps/api/src/modules/organization/router.ts`：实现 `GET /api/v1/organizations`、`POST /api/v1/organizations`、`POST /api/v1/organizations/:organizationId/activate`；权限使用 `organization.read` / `organization.create`；创建组织返回 201。
- [X] T051 [US4] 扩展 `apps/api/src/pages/auth.ts`：`/app` 增加组织切换列表，切换调用 activate；`/onboarding` 增加创建组织表单；页面不显示其他组织数据。
- [X] T052 [US4] 在 `apps/api/src/app.ts` 挂载组织路由；运行 US4 测试，并确认 US1/US2/US3 无回归。

**Checkpoint**: 四个用户故事均可独立验证。

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 文档、日志、门禁与最终验证

- [X] T053 [P] 运行 `scripts/check-docs.sh --root docs --strict --baseline docs/.check-docs-baseline.txt`；若仅行号偏移，刷新基线；若出现新规则违规，先修文档再刷新。
- [X] T054 [P] 创建 `tests/auth/log-redaction.test.ts`：对注册、登录、邀请兑换的日志与错误响应断言不含密码、会话 token、邀请明文。
- [X] T055 运行完整测试 `pnpm test:auth`，确认 US1–US4 全部通过，且 RLS、邀请抢占、限流窗口用例未使用替身。
- [X] T056 按 `specs/002-user-auth-default-org/quickstart.md` 逐条验证注册、重复邮箱、登录、限流、多组织、跨设备、邀请、租户隔离；记录实际输出。
- [X] T057 复核 `packages/db/migrations/` 与测试环境：除迁移器自身的 `schema_migrations` 外，只有认证表 + `organization` / `organization_member` / `invite` / `audit_log`；四张业务表 `ENABLE` + `FORCE RLS`；`genealogy_app` 无 `BYPASSRLS`。
- [X] T058 清理 `apps/api/src/` 与 `packages/` 中未使用代码与脚手架：删除 `TODO`、空实现、未挂载路由、`catch { return null }`；确认没有新增第 5 张业务表或通用幂等抽象。
- [X] T059 若实现偏离 [contracts/](contracts/)，回写 `docs/architecture/api/endpoints.md` 并重新运行 T053；否则不制造文档噪音。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖，可立即开始。
- **Foundational (Phase 2)**: 依赖 Setup 完成，阻塞所有用户故事。
- **User Stories (Phase 3–6)**: 均依赖 Foundational。
- **Polish (Phase 7)**: 依赖目标用户故事完成。

### User Story Dependencies

- **US1（P1）**: Foundational 完成后可独立开始，是 MVP。
- **US2（P1）**: Foundational 完成后可独立开始；登录测试可用 T039 的夹具或 US1 注册账号准备数据。
- **US3（P2）**: 与 US1/US2 集成；契约级测试可在 Foundational 后开始，端到端测试在 US1/US2 完成后跑通。
- **US4（P2）**: 与 US1/US2 集成；组织列表与切换测试可用夹具准备数据，端到端测试在 US1/US2 完成后跑通。

### Within Each User Story

- 先写测试并确认失败，再写实现。
- 数据库约束与受控函数先于服务层；服务层先于路由；路由先于页面。
- 每个故事在自己的 Checkpoint 停下验证，再进入下一个优先级。

### Parallel Opportunities

- T007 完成后 T008 才能开始（租户 schema 引用 `auth.user`）。
- T015 / T016 / T017 / T018（文档同步、ID、错误、日志）可并行。
- US1 的 T023 / T024 测试可并行；US2 的 T032 / T033 可并行；US3 的 T039 / T040 可并行；US4 的 T046 / T047 可并行。
- Foundational 完成后，若人力允许，US1 与 US2 可由不同开发者并行；US3/US4 在 US1/US2 的接口稳定后并行。

---

## Parallel Example: User Story 1

```bash
# 先并行写两个失败测试
Task: "编写 tests/auth/registration.test.ts"
Task: "编写 apps/api/test/auth-router.test.ts"
```

## Implementation Strategy

### MVP First（US1）

1. 完成 Phase 1 Setup。
2. 完成 Phase 2 Foundational（数据库、函数、RLS、认证实例、请求上下文）。
3. 完成 Phase 3 US1。
4. 停下按 [quickstart.md](quickstart.md) 第 1–2 节验证：注册 → 默认组织 → 重复邮箱/密码下限。
5. MVP 可用后再进入 US2。

### Incremental Delivery

1. Setup + Foundational → 基础就绪。
2. US1 → 注册即用 → 验证 → 交付 MVP。
3. US2 → 登录/会话/限流 → 验证 → 交付。
4. US3 → 邀请加入 → 验证 → 交付。
5. US4 → 多组织默认组织 → 验证 → 交付。

### Linus 纪律

- 每个阶段只做当前故事需要的表、函数与路由；不提前实现成员管理、邀请创建、所有权转移等后续端点。
- 能用一条 SQL 或一个约束表达的规则，不写第二层服务判断。
- 发现某任务需要新增抽象层才能完成时，先停下来检查是否违反 Article I/VII，再决定是否登记 Complexity Tracking。

---

## Notes

- `[P]` 任务必须不同文件且不依赖未完成任务。
- 所有集成测试连测试环境的真实 PostgreSQL 18；`bun test --env-file .env.test`。
- 文档门禁以 `scripts/check-docs.sh --root docs --strict --baseline docs/.check-docs-baseline.txt` 退出码 0 为准。
- 不在本批次实现：微信 OAuth、邮箱验证、找回密码、修改密码、成员管理、邀请创建/撤销、所有权转移、`apps/web` SPA。
