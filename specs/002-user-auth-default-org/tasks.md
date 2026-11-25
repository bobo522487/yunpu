# Tasks: 用户注册、登录与默认组织

> **执行原则**：按依赖顺序逐批执行；修改前先查看现有实现；不擅自扩大范围；每完成一个任务即运行对应测试并更新状态；发现 `spec.md` 缺失或 `plan.md` 冲突时立即暂停报告。
>
> 本清单是 `002-user-auth-default-org` 的历史执行档案：所有任务已于 2026-11-25 完成。原 Phase 1–8 按用户故事组织，此处折叠为统一清单；`[P]` 表示不同文件无依赖可并行，`[US1]`/`[US2]`/`[US3]`/`[US4]` 为故事可追溯标签。当前技术栈表述为 Node 26 / pnpm / Vitest / Hono / PostgreSQL 18 / silo；测试打到真实 PostgreSQL 18，先写失败测试再写实现。页面相关任务仅作历史记录，前端页面已不在当前批次。
>
> - **输入**：[spec.md](./spec.md)、[plan.md](./plan.md)

## 1. 开发任务清单

| ID | 状态 | 依赖 | 关联需求 | 任务描述 | 修改范围 & 变更类型（迁移/API/配置） | 测试要求 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `T-001` | `[x]` | - | `FR-001`/`FR-014` | 更新 `pnpm-workspace.yaml` 纳入 `apps/*` 与 `packages/*`；创建 `packages/db/package.json` 与 `packages/shared/package.json`，均设 `"type": "module"` | `pnpm-workspace.yaml`、`packages/db/package.json`、`packages/shared/package.json`（配置） | 工作区解析与入口检查 |
| `T-002` | `[x]` | - | `FR-001`/`FR-003` | 在 `apps/api/package.json` 增加 Better Auth 与 Drizzle 依赖；在 `packages/db/package.json` 增加 Drizzle、`pg`、`@types/pg` 与开发期生成工具；在根 `package.json` 增加 `db:generate`、`db:migrate` | `package.json`、两份包清单（配置） | 依赖版本与脚本检查 |
| `T-003` | `[x]` | - | `FR-001`/`FR-004`/`FR-014` | 更新 `apps/api/src/env.ts`、`.env.example`、`.env.test`、`scripts/env.sh`：新增 `AUTH_DATABASE_URL`（用户为 `auth_runtime`）、`BETTER_AUTH_SECRET`、`BETTER_AUTH_URL`；保持 `DATABASE_URL` 使用 `genealogy_app` 并校验库名与 `YUNPU_ENV` 配对 | `apps/api/src/env.ts`、环境模板、`scripts/env.sh`（API/配置） | 非法配置非零退出断言 |
| `T-004` | `[x]` | - | `FR-003`/`FR-019` | 更新 `docker/postgres/init/01-role.sql` 与 `scripts/env.sh`：幂等创建 `rls_definer`（`NOLOGIN BYPASSRLS`）和 `auth_runtime`（`LOGIN NOBYPASSRLS`）；本地口令只用于开发/测试 | `docker/postgres/init/01-role.sql`、`scripts/env.sh`（配置） | 角色权限断言 |
| `T-005` | `[x]` | - | `FR-001`/`FR-002`/`FR-005`/`FR-007`/`FR-016` | 创建 `packages/shared/src/enums.ts`、`schemas.ts`、`errors.ts`：角色、组织状态、邀请状态枚举；Zod 覆盖注册、登录、建组织、切换、邀请；邮箱 `trim().toLowerCase()` 唯一，密码最低 8 位，组织名 `btrim` 后非空 | `packages/shared/src/`（配置/API） | schema 校验与枚举断言 |
| `T-006` | `[x]` | `T-001` | `FR-006`/`FR-014` | 创建 `packages/db/src/client.ts` 与 `migrate.ts`：业务连接用 `DATABASE_URL`，认证连接用 `AUTH_DATABASE_URL`；三个超时经 `packages/db/src/client.ts:PG_OPTIONS` 由 `pg` 的 `options` 字段下发；迁移器按文件名顺序执行并记录 `schema_migrations`，生成物重命名后由同一 runner 应用 | `packages/db/src/`（配置） | 超时与迁移幂等由 `T-063` 在真实 PG 18 上验证 |
| `T-007` | `[x]` | `T-001` | `FR-003`/`FR-005` | `[P]` 创建 `packages/db/src/schema/auth.ts`：Better Auth 的 `auth."user"`、`auth.session`、`auth.account`、`auth.verification` 定义，`id` 为 `uuid`，`user.email` 唯一 | `packages/db/src/schema/auth.ts`（配置） | 表与唯一索引断言 |
| `T-008` | `[x]` | `T-007` | `FR-005`/`FR-013`/`FR-016`/`FR-019` | 创建 `packages/db/src/schema/tenant.ts`：`organization`、`organization_member`（含 `last_used_at`）、`invite`、`audit_log` 定义；字段、空值、默认值按设计；成员表引用 `auth.user` | `packages/db/src/schema/tenant.ts`（配置） | 列定义与外键断言 |
| `T-009` | `[x]` | `T-007`/`T-008` | `FR-005` | 创建 `packages/db/src/schema/index.ts` 汇总导出，并更新 `packages/db/package.json` 入口 | `packages/db/src/schema/index.ts`、`packages/db/package.json`（配置） | 导入路径检查 |
| `T-010` | `[x]` | `T-007`/`T-008` | `FR-005` | 创建 `packages/db/migrations/0000_roles.sql`，并把认证与租户表 DDL 落到 `packages/db/migrations/0001_auth_tenant.sql`；使用 `auth` schema、`uuid` 主键、邮箱唯一索引 | `packages/db/migrations/`（迁移） | 迁移顺序与表结构断言 |
| `T-011` | `[x]` | `T-008` | `FR-005`/`FR-013`/`FR-016` | 在 `0001_auth_tenant.sql` 手工补齐生成器不覆盖部分：`owner_user_id` 两步可延迟外键、`last_used_at`、`(organization_id, user_id)` 主键与成员索引、`token_hash` 与部分唯一索引、`audit_log` 无 `updated_at`；目录中没有 `0002` | `packages/db/migrations/0001_auth_tenant.sql`（迁移） | 约束与索引断言 |
| `T-012` | `[x]` | `T-010`/`T-011` | `FR-005`/`FR-016`/`FR-017`/`FR-018`/`FR-020` | 创建 `packages/db/migrations/0003_functions.sql`：`app.current_user_id()`、`app.visible_org_array()`、`app.touch_updated_at()`、`app.guard_scope_immutable()`、`app.guard_append_only()`、`app.create_organization()`、`app.resolve_invite_by_token()`、`app.accept_invite()`；邮箱比较用 `IS DISTINCT FROM`，错误码 `GX005`/`GX009`/`GX010` | `packages/db/migrations/0003_functions.sql`（迁移） | 受控函数与错误码断言 |
| `T-013` | `[x]` | `T-010`/`T-011` | `FR-019` | 创建 `packages/db/migrations/0004_rls.sql`：四张租户表 `ENABLE` + `FORCE ROW LEVEL SECURITY`，策略谓词按可见组织数组收敛 | `packages/db/migrations/0004_rls.sql`（迁移） | RLS 启用与强制断言 |
| `T-014` | `[x]` | `T-010`/`T-011` | `FR-019`/`FR-020` | 创建 `packages/db/migrations/0005_grants.sql`：`genealogy_app` 最小读写与 `organization_member` 列级更新；`rls_definer` 最小权限含认证用户邮箱读取；不把 `auth` schema 权限授予业务角色 | `packages/db/migrations/0005_grants.sql`（迁移） | 权限矩阵断言 |
| `T-015` | `[x]` | `T-010`/`T-011` | `FR-013`/`FR-019`/`FR-020` | `[P]` 同步架构文档中的 `last_used_at`、授权、唯一冲突映射与软约束登记；不复制文档表格 | `docs/architecture/`（文档） | 引用一致性检查 |
| `T-016` | `[x]` | `T-001` | `FR-003` | `[P]` 创建 `apps/api/src/lib/ids.ts`：UUIDv7 生成函数，供认证层 `advanced.database.generateId` 使用，不引入第三方依赖 | `apps/api/src/lib/ids.ts`（API） | UUID 格式与唯一性检查 |
| `T-017` | `[x]` | `T-010`/`T-011` | `FR-001`/`FR-002`/`FR-009`/`FR-012`/`FR-017` | `[P]` 创建 `apps/api/src/lib/errors.ts`：`AppError`、`HTTPException`、SQLSTATE 与约束名两级映射；覆盖邮箱冲突 409、`GX005`/`GX008`/`GX009`/`GX010`、`RATE_LIMITED`；禁止解析数据库消息文本 | `apps/api/src/lib/errors.ts`（API） | 错误码映射断言 |
| `T-018` | `[x]` | `T-010`/`T-011` | `FR-003`/`FR-020` | `[P]` 创建 `apps/api/src/lib/logger.ts`：结构化字段 `request_id`、`user_id`、`organization_id`、`event`、`result`；禁止记录密码、会话凭据、邀请明文 | `apps/api/src/lib/logger.ts`（API） | 日志脱敏断言 |
| `T-019` | `[x]` | `T-010`/`T-011` | `FR-001`/`FR-004`/`FR-010` | 在 `apps/api/src/modules/auth/client.ts` 配置 Better Auth：Drizzle adapter、`basePath: /api/v1/auth`、密码最短 8、会话 `expiresIn: 604800` 与 `updateAge: 86400`、`cookieCache.enabled: false`、UUIDv7、`secret`/`baseURL`/`trustedOrigins` 来自环境 | `apps/api/src/modules/auth/client.ts`（API/配置） | 会话参数与配置断言 |
| `T-020` | `[x]` | `T-010`/`T-011` | `FR-012`/`FR-019` | 创建 `apps/api/src/middleware/auth.ts` 与 `apps/api/src/db/with-user.ts`：`getSession` 写入 `c.set('user')`；事务内 `SET LOCAL ROLE genealogy_app`、`set_config('app.user_id', ..., true)` 并断言当前角色 | `apps/api/src/middleware/auth.ts`、`apps/api/src/db/with-user.ts`（API） | 请求上下文与事务断言 |
| `T-021` | `[x]` | `T-010`/`T-011` | `FR-012`/`FR-014` | 更新 `apps/api/src/ 下的 app.ts`：按 `requestId → secureHeaders → compress → authMiddleware → 路由` 组织；`onError` 统一扁平错误体；保留 `/api/health`、`/api/ready` 与根路径既有语义 | `apps/api/src/ 下的 app.ts`（API） | 中间件顺序与错误信封断言 |
| `T-022` | `[x]` | `T-010`/`T-011` | `FR-005`/`FR-019` | 创建 `tests/auth/schema.test.ts` 并执行 `pnpm db:migrate -- --env test`：断言认证表与四张租户表存在、`last_used_at` 存在、四张表强制行安全、无第五张业务表 | `tests/auth/schema.test.ts`（测试） | 真实 PG 18 结构断言 |
| `T-023` | `[x]` | `T-019` | `FR-001`/`FR-002`/`FR-005`/`FR-012` | `[P][US1]` 编写 `tests/auth/registration.test.ts`：注册成功、大小写与空白邮箱视为同一邮箱、密码不足 8 位 400、重复邮箱 409、默认组织 owner 正确、会话读到同一组织 | `tests/auth/registration.test.ts`（测试） | 失败先行与集成断言 |
| `T-024` | `[x]` | `T-019` | `FR-006` | `[P][US1]` 编写 `apps/api/test/auth-router.test.ts`：注入失败组织创建器验证 500、认证用户被补偿删除、响应不返回会话 Cookie | `apps/api/test/auth-router.test.ts`（测试） | 失败注入断言 |
| `T-025` | `[x]` | `T-023`/`T-024` | `FR-005`/`FR-013`/`FR-014`/`FR-015` | `[US1]` 创建 `apps/api/src/modules/organization/queries.ts`、`service.ts`、`errors.ts`：封装 `app.create_organization()` 与默认组织解析，复用排序逻辑，提供 `last_used_at` 单一更新入口，不新增第二套读写路径 | `apps/api/src/modules/organization/`（API） | 默认组织查询断言 |
| `T-026` | `[x]` | `T-023`/`T-024` | `FR-004`/`FR-005`/`FR-006`/`FR-017` | `[US1]` 创建 `apps/api/src/modules/auth/provisioning.ts`：注册编排、无邀请时创建默认组织、组织创建器可注入、失败按 `session → account → user` 补偿并响亮记录 | `apps/api/src/modules/auth/provisioning.ts`（API） | 补偿路径断言 |
| `T-027` | `[x]` | `T-023` | `FR-001`/`FR-005`/`FR-007`/`FR-016` | `[US1]` 创建 `apps/api/src/modules/auth/schema.ts`、`service.ts`、`errors.ts`：复用共享 schema、规范化邮箱、默认组织名取邮箱前缀加「的组织」、返回 `user`/`defaultOrganization`/`invite` 形状 | `apps/api/src/modules/auth/`（API） | 服务层行为断言 |
| `T-028` | `[x]` | `T-027` | `FR-001`/`FR-004`/`FR-012` | `[US1]` 创建 `apps/api/src/modules/auth/router.ts`：实现 `POST /api/v1/auth/` 下的 `sign-up` 路由 与 `GET /api/v1/auth/session`，转发 `Set-Cookie`，未登录时返回 `user: null` | `apps/api/src/modules/auth/router.ts`（API） | 路由级断言 |
| `T-029` | `[x]` | `T-028` | `FR-001`/`FR-005`/`FR-014` | `[US1][历史：前端页面已不在当前批次]` 历史页面任务：最小表单 `/sign-up` 提交邮箱与密码，成功 303 到 `/app`；仅为历史记录，不进入当前验收面 | 历史页面文件（历史配置项） | 不纳入当前验收路径 |
| `T-030` | `[x]` | `T-026`/`T-027` | `FR-020` | `[US1]` 在注册成功与失败路径写结构化日志，不记录密码、凭据或邀请明文 | `apps/api/src/modules/auth/service.ts`、`apps/api/src/lib/logger.ts`（API） | 成功与失败日志断言 |
| `T-031` | `[x]` | `T-023`/`T-024`/`T-028` | `FR-001`/`FR-006` | `[US1]` 在 `apps/api/src/ 下的 app.ts` 挂载认证路由，运行 `pnpm exec vitest run --config vitest.config.ts tests/auth/registration.test.ts apps/api/test/auth-router.test.ts` | `apps/api/src/ 下的 app.ts`（API） | 双测试文件全绿 |
| `T-032` | `[x]` | `T-019` | `FR-004`/`FR-008`/`FR-010`/`FR-011`/`FR-012` | `[P][US2]` 编写 `tests/auth/login-session.test.ts`：正确登录、未知邮箱与错误密码一致 401、Cookie、会话恢复、登出只失效当前会话、`expires_at` 约 7 天 | `tests/auth/login-session.test.ts`（测试） | 失败先行与会话断言 |
| `T-033` | `[x]` | `T-019` | `FR-009`/`FR-021` | `[P][US2]` 编写 `tests/auth/login-rate-limit.test.ts`：同邮箱与来源 5 次失败后 429、成功清零、注入时钟验证 15 分钟窗口恢复 | `tests/auth/login-rate-limit.test.ts`（测试） | 失败先行与窗口断言 |
| `T-034` | `[x]` | `T-032`/`T-033` | `FR-009`/`FR-021` | `[US2]` 创建 `apps/api/src/middleware/login-rate-limit.ts`：有界映射、邮箱与来源键、5 次与 15 分钟、成功删除键、时钟与来源可注入、429 与 `Retry-After` | `apps/api/src/middleware/login-rate-limit.ts`（API） | 限流边界断言 |
| `T-035` | `[x]` | `T-034` | `FR-008`/`FR-009`/`FR-011`/`FR-021` | `[US2]` 扩展 `apps/api/src/modules/auth/service.ts`：`signInEmail`、`signOut`、会话读取；失败统一 `UNAUTHORIZED`，成功清除计数 | `apps/api/src/modules/auth/service.ts`（API） | 服务层行为断言 |
| `T-036` | `[x]` | `T-034`/`T-035` | `FR-008`/`FR-011`/`FR-021` | `[US2]` 扩展 `apps/api/src/modules/auth/router.ts`：`POST /api/v1/auth/sign-in`、`POST /api/v1/auth/sign-out`，转发 Cookie，登录先过限流 | `apps/api/src/modules/auth/router.ts`（API） | 路由与限流顺序断言 |
| `T-037` | `[x]` | `T-035` | `FR-008`/`FR-011` | `[US2][历史：前端页面已不在当前批次]` 历史页面任务：`/sign-in` 表单与统一错误提示，成功 303 到 `/app` 或 `/onboarding`，登出 303 回 `/sign-in`；仅为历史记录 | 历史页面文件（历史配置项） | 不纳入当前验收路径 |
| `T-038` | `[x]` | `T-036` | `FR-009`/`FR-021` | `[US2]` 在 `apps/api/src/ 下的 app.ts` 为 API 与历史页面 POST 挂载限流，运行 US2 测试并确认 US1 无回归 | `apps/api/src/ 下的 app.ts`（API） | 回归测试全绿 |
| `T-039` | `[x]` | `T-019` | `FR-016`/`FR-017`/`FR-018` | `[P][US3]` 创建 `tests/auth/fixtures.ts`：CSPRNG 生成 token、库里只存摘要、插入待兑邀请；提供第二组织、归档组织与成员夹具，不新增生产端点 | `tests/auth/fixtures.ts`（测试） | 夹具隔离断言 |
| `T-040` | `[x]` | `T-039` | `FR-016`/`FR-017`/`FR-018` | `[P][US3]` 编写 `tests/auth/invite-acceptance.test.ts`：有效邀请、邮箱不一致、过期、撤销、已兑换、并发兑换、注册不额外建个人组织、已登录用户接受邀请切换默认组织 | `tests/auth/invite-acceptance.test.ts`（测试） | 失败先行与并发断言 |
| `T-041` | `[x]` | `T-039`/`T-040` | `FR-005`/`FR-016`/`FR-017` | `[US3]` 扩展 `apps/api/src/modules/auth/provisioning.ts`：注册带 `inviteToken` 时调用 `app.accept_invite()`；失败不阻断注册，返回个人默认组织与 `accepted: false` 和原因 | `apps/api/src/modules/auth/provisioning.ts`（API） | 邀请失败不阻断断言 |
| `T-042` | `[x]` | `T-041` | `FR-013`/`FR-016`/`FR-018` | `[US3]` 扩展 `apps/api/src/modules/organization/service.ts`：已登录用户 `acceptInvite()`，成功后更新成员 `last_used_at`，角色取邀请且不能授予 owner | `apps/api/src/modules/organization/service.ts`（API） | 默认组织切换断言 |
| `T-043` | `[x]` | `T-042` | `FR-016`/`FR-017`/`FR-018` | `[US3]` 扩展 `apps/api/src/modules/organization/router.ts`：`POST /api/v1/invites/accept`，`GX005` 映射 404、`GX009` 映射 403、`GX010` 映射 409 | `apps/api/src/modules/organization/router.ts`（API） | 错误码映射断言 |
| `T-044` | `[x]` | `T-041` | `FR-016` | `[US3][历史：前端页面已不在当前批次]` 历史页面任务：注册表单读取 `?invite=<token>` 作为隐藏字段，`/onboarding` 提供接受邀请表单；仅为历史记录 | 历史页面文件（历史配置项） | 不纳入当前验收路径 |
| `T-045` | `[x]` | `T-041`/`T-042` | `FR-016`/`FR-020` | `[US3]` 在 `0003_functions.sql` 与邀请测试中断言组织创建和邀请兑换写 `audit_log`，日志与审计不含邀请明文 | `packages/db/migrations/0003_functions.sql`、`tests/auth/invite-acceptance.test.ts`（迁移/测试） | 审计与脱敏断言 |
| `T-046` | `[x]` | `T-019` | `FR-013`/`FR-014`/`FR-015` | `[P][US4]` 编写 `tests/auth/default-organization.test.ts`：`last_used_at` 优先、无记录时 `created_at` 最早、归档跳过、无组织时 `defaultOrganization = null` 且 `onboarding = true`、两设备同一组织 | `tests/auth/default-organization.test.ts`（测试） | 失败先行与排序断言 |
| `T-047` | `[x]` | `T-019` | `FR-019` | `[P][US4]` 编写 `tests/auth/tenant-isolation.test.ts`：跨账号访问 404、组织列表只含自己的 active 组织、用真实 PG 以业务角色与用户上下文验证行安全过滤 | `tests/auth/tenant-isolation.test.ts`（测试） | 真实库隔离断言 |
| `T-048` | `[x]` | `T-046` | `FR-013`/`FR-014`/`FR-015` | `[US4]` 扩展 `apps/api/src/modules/organization/queries.ts`：我的组织列表复用默认组织解析，不复制排序、不缓存结果 | `apps/api/src/modules/organization/queries.ts`（API） | 查询复用断言 |
| `T-049` | `[x]` | `T-048` | `FR-013`/`FR-014`/`FR-015` | `[US4]` 扩展 `apps/api/src/modules/organization/service.ts`：列出与激活组织，复用组织创建，激活只更新 active 成员 `last_used_at`，影响 0 行返回不存在或无权 | `apps/api/src/modules/organization/service.ts`（API） | 激活边界断言 |
| `T-050` | `[x]` | `T-049` | `FR-005`/`FR-013`/`FR-015` | `[US4]` 创建或扩展 `apps/api/src/modules/organization/router.ts`：`GET` 与 `POST /api/v1/organizations`、`POST /api/v1/organizations/:organizationId/activate`，创建返回 201 | `apps/api/src/modules/organization/router.ts`（API） | 路由与权限断言 |
| `T-051` | `[x]` | `T-049` | `FR-013`/`FR-015` | `[US4][历史：前端页面已不在当前批次]` 历史页面任务：`/app` 增加组织切换列表，`/onboarding` 增加创建组织表单；仅为历史记录 | 历史页面文件（历史配置项） | 不纳入当前验收路径 |
| `T-052` | `[x]` | `T-050` | `FR-013`/`FR-014`/`FR-015` | `[US4]` 在 `apps/api/src/ 下的 app.ts` 挂载组织路由，运行 US4 测试并确认 US1、US2、US3 无回归 | `apps/api/src/ 下的 app.ts`（API） | 全量回归断言 |
| `T-053` | `[x]` | `T-038`/`T-052` | `FR-020` | `[P]` 文档质量结论折叠进第 3 节；文档门禁脚本不纳入本归档验收路径，不对历史结论制造新门禁 | 文档归档说明（文档） | 历史结论一致性检查 |
| `T-054` | `[x]` | `T-038`/`T-052` | `FR-003`/`FR-020` | `[P]` 创建 `tests/auth/log-redaction.test.ts`：注册、登录、邀请兑换的日志与错误响应不含密码、会话凭据、邀请明文 | `tests/auth/log-redaction.test.ts`（测试） | 失败先行与脱敏断言 |
| `T-055` | `[x]` | `T-052`/`T-054` | `FR-001`–`FR-021` | 运行 `pnpm test:auth`，确认四个用户故事全通过，且行安全、唯一约束、邀请抢占、限流窗口未用替身跳过 | 仓库根目录（测试） | `pnpm test:auth` 全绿 |
| `T-056` | `[x]` | `T-052` | `FR-001`–`FR-021` | 按验收场景逐条验证注册、重复邮箱、登录、限流、多组织、跨设备、邀请与租户隔离，并记录实际输出 | 仓库根目录（验收） | 场景输出记录检查 |
| `T-057` | `[x]` | `T-055` | `FR-005`/`FR-019` | 复核迁移目录与测试环境：除 `schema_migrations` 外只有认证表与四张租户表，四张表强制行安全，业务角色无 `BYPASSRLS` | `packages/db/migrations/`、测试环境（迁移/配置） | 真实 PG 18 枚举断言 |
| `T-058` | `[x]` | `T-055` | `FR-014` | 清理 `apps/api/src/` 与 `packages/` 中未使用代码：删除占位、空实现、未挂载路由与静默吞错；确认没有第五张业务表或通用幂等抽象 | `apps/api/src/`、`packages/`（API/配置） | 静态检查与代码审查 |
| `T-059` | `[x]` | `T-053`/`T-055` | `FR-020` | 若实现偏离 API 契约则回写 `docs/architecture/api/endpoints.md` 并重新核对；否则不制造文档噪音 | `docs/architecture/api/endpoints.md`（文档） | 契约一致性检查 |
| `T-060` | `[x]` | - | `FR-014`/`FR-020` | 收敛修订：把章程权限条款中的连接串超时表述改为由 `packages/db/src/client.ts:PG_OPTIONS` 经 `pg` 的 `options` 字段显式下发，并同步架构文档中的陈旧表述；按技术性修订流程保留历史说明 | `.specify/memory/constitution.md`、`docs/`（文档） | 引用一致性与历史说明检查 |
| `T-061` | `[x]` | `T-035` | `FR-020` | 在登出路径写结构化日志 `event=auth.signed_out`，带 `request_id`/`user_id` 且不含 Cookie 或凭据，并在登录会话测试增加断言 | `apps/api/src/modules/auth/service.ts`、`tests/auth/login-session.test.ts`（API/测试） | 日志事件断言 |
| `T-062` | `[x]` | `T-027` | `FR-002` | 收紧共享 schema 的密码规则以拒绝空密码与纯空白密码，保留最短 8 与最长 128，并核对认证客户端 `minPasswordLength` | `packages/shared/src/schemas.ts`、`tests/auth/registration.test.ts`、`apps/api/src/modules/auth/client.ts`（API/测试） | 400 边界用例断言 |
| `T-063` | `[x]` | `T-006` | `FR-006`/`FR-014` | 在真实 PG 18 测试环境执行连接设置测试并重复执行迁移器，确认三个超时与迁移幂等；把旧文件名对齐为实际的 `0001_auth_tenant.sql`，确认没有 `0002` | `tests/env/connection-settings.test.ts`、`packages/db/src/migrate.ts`、`packages/db/migrations/`（测试/迁移） | 真实 PG 18 断言 |
| `T-064` | `[x]` | `T-054` | `FR-020` | 扩展日志脱敏测试：捕获输出并断言注册、登录、邀请兑换的日志与错误响应均不含密码、会话凭据、邀请明文 | `tests/auth/log-redaction.test.ts`（测试） | 捕获输出断言 |
| `T-065` | `[x]` | `T-023` | `FR-001`/`FR-005` | 增加 10 个并发同邮箱注册用例：恰好 1 个成功，其余返回邮箱已注册，且只创建一个默认组织 | `tests/auth/registration.test.ts`（测试） | 并发唯一性断言 |
| `T-066` | `[x]` | `T-033`/`T-035` | `FR-010` | 增加会话滑动续期与无绝对上限测试，覆盖 `apps/api/src/modules/auth/client.ts` 的 `updateAge: 86400` 与 7 天有效期；用数据库时钟把会话整体回拨两天而非伪造当前时间，连续十轮回拨后仍有效 | `tests/auth/login-session.test.ts`（测试） | 真实时间线续期断言 |

**执行顺序与并行**：Setup（T-001–T-009）→ Foundational（T-010–T-022，阻塞所有用户故事）→ US1（T-023–T-031）→ US2（T-032–T-038）→ US3（T-039–T-045）→ US4（T-046–T-052）→ Polish（T-053–T-059）→ Convergence（T-060–T-066）。可并行：T-001 后 T-002、T-003、T-004、T-005；T-010 后 T-015、T-016、T-017、T-018；各故事测试对 T-023/T-024、T-032/T-033、T-039/T-040、T-046/T-047 可并行；Foundational 后若人力允许 US1 与 US2 可并行，US3/US4 在接口稳定后并行。MVP 止于 T-031，即注册成功、会话可用、默认组织可见且补偿路径被验证。

## 2. 每任务完成汇报模板

完成每个任务后记录/输出：
1. 修改了哪些文件
2. 实现了哪些功能
3. 执行了哪些测试及命令
4. 测试结果
5. 是否存在遗留问题

---

## 3. 独立验收与需求追踪矩阵

> 由独立质量视角对照原始 `spec.md`、`plan.md`、`tasks.md` 与实际实现逐项核验，不能仅凭开发自证通过。原质量检查清单（现已归档）的结论并入本矩阵说明。

| 需求 ID | 实现位置 | 测试用例 | 静态/集成检查 | 验收结果 |
| :--- | :--- | :--- | :--- | :--- |
| `FR-001` | `apps/api/src/modules/auth/service.ts`、`apps/api/src/modules/auth/router.ts` | T-023、T-031、T-065 | `pnpm lint`、`pnpm test:auth`、`pnpm test:all`、真实 PostgreSQL 18 断言 | `[Pass]` |
| `FR-002` | `packages/shared/src/schemas.ts`、`apps/api/src/modules/auth/client.ts` | T-023、T-062 | `pnpm lint`、`pnpm test:auth`、真实 PostgreSQL 18 断言 | `[Pass]` |
| `FR-003` | `apps/api/src/modules/auth/client.ts`、`apps/api/src/lib/logger.ts` | T-018、T-054、T-064 | `pnpm lint`、`pnpm test:auth`、日志脱敏断言 | `[Pass]` |
| `FR-004` | `apps/api/src/modules/auth/provisioning.ts`、`apps/api/src/modules/auth/router.ts` | T-026、T-032 | `pnpm test:auth`、会话与 Cookie 断言 | `[Pass]` |
| `FR-005` | `apps/api/src/modules/organization/service.ts`、`packages/db/migrations/` | T-010、T-011、T-025、T-057 | `pnpm test:all`、真实 PostgreSQL 18 表结构断言 | `[Pass]` |
| `FR-006` | `apps/api/src/modules/auth/provisioning.ts`、`packages/db/src/migrate.ts` | T-024、T-026、T-063 | `pnpm test:auth`、迁移幂等断言 | `[Pass]` |
| `FR-007` | `apps/api/src/modules/auth/service.ts`、`apps/api/src/modules/organization/service.ts` | T-027、T-030 | `pnpm lint`、`pnpm test:auth`、默认组织名称断言 | `[Pass]` |
| `FR-008` | `apps/api/src/modules/auth/service.ts`、`apps/api/src/modules/auth/router.ts` | T-032、T-035、T-036 | `pnpm test:auth`、登录成功断言 | `[Pass]` |
| `FR-009` | `apps/api/src/middleware/login-rate-limit.ts` | T-033、T-034 | `pnpm test:auth`、限流窗口断言 | `[Pass]` |
| `FR-010` | `apps/api/src/modules/auth/client.ts`、`tests/auth/login-session.test.ts` | T-066 | `pnpm test:auth`、真实时间线续期断言 | `[Pass]` |
| `FR-011` | `apps/api/src/modules/auth/service.ts`、`apps/api/src/modules/auth/router.ts` | T-035、T-036 | `pnpm test:auth`、登出范围断言 | `[Pass]` |
| `FR-012` | `apps/api/src/middleware/auth.ts`、`apps/api/src/db/with-user.ts` | T-020、T-023、T-032 | `pnpm test:all`、真实 PostgreSQL 18 会话断言 | `[Pass]` |
| `FR-013` | `apps/api/src/modules/organization/queries.ts`、`packages/db/src/schema/` | T-008、T-025、T-046 | `pnpm test:auth`、默认排序断言 | `[Pass]` |
| `FR-014` | `apps/api/src/modules/organization/queries.ts`、`packages/db/migrations/` | T-011、T-046、T-049 | `pnpm test:auth`、归档跳过断言 | `[Pass]` |
| `FR-015` | `apps/api/src/modules/organization/service.ts`、`apps/api/src/modules/organization/router.ts` | T-046、T-049、T-052 | `pnpm test:auth`、引导状态断言 | `[Pass]` |
| `FR-016` | `apps/api/src/modules/auth/provisioning.ts`、`apps/api/src/modules/organization/service.ts` | T-040、T-041、T-042 | `pnpm test:auth`、邀请落位断言 | `[Pass]` |
| `FR-017` | `apps/api/src/modules/auth/provisioning.ts`、`apps/api/src/lib/errors.ts` | T-024、T-041、T-043 | `pnpm test:auth`、邀请失败不阻断断言 | `[Pass]` |
| `FR-018` | `packages/db/migrations/0003_functions.sql`、`tests/auth/invite-acceptance.test.ts` | T-012、T-040 | `pnpm test:auth`、并发抢占断言 | `[Pass]` |
| `FR-019` | `apps/api/src/db/with-user.ts`、`packages/db/migrations/0004_rls.sql` | T-013、T-020、T-047 | `pnpm test:all`、真实 PostgreSQL 18 行安全断言 | `[Pass]` |
| `FR-020` | `apps/api/src/lib/logger.ts`、`packages/db/migrations/` | T-018、T-030、T-045、T-054、T-061、T-064 | `pnpm lint`、`pnpm test:auth`、审计脱敏断言 | `[Pass]` |
| `FR-021` | `apps/api/src/middleware/login-rate-limit.ts` | T-033、T-034、T-036 | `pnpm test:auth`、真实窗口断言 | `[Pass]` |

- [x] **AC-001（原 SC-001）**：实现位置 `apps/api/src/modules/auth/service.ts`、`apps/api/src/modules/organization/service.ts`；测试用例 T-023、T-030；检查 `pnpm lint`、`pnpm test:auth`、`pnpm test:all`、真实 PostgreSQL 18 断言；结果 `[Pass]`。
- [x] **AC-002（原 SC-002）**：实现位置 `apps/api/src/modules/auth/provisioning.ts`、`packages/db/migrations/`；测试用例 T-024、T-026、T-057；检查 `pnpm test:auth`、真实 PostgreSQL 18 断言；结果 `[Pass]`。
- [x] **AC-003（原 SC-003）**：实现位置 `apps/api/src/modules/auth/service.ts`；测试用例 T-023、T-065；检查 `pnpm lint`、`pnpm test:auth`、真实 PostgreSQL 18 并发断言；结果 `[Pass]`。
- [x] **AC-004（原 SC-004）**：实现位置 `apps/api/src/modules/auth/router.ts`、`apps/api/src/modules/organization/queries.ts`；测试用例 T-032、T-046；检查 `pnpm test:auth`、真实 PostgreSQL 18 性能断言；结果 `[Pass]`。
- [x] **AC-005（原 SC-005）**：实现位置 `apps/api/src/modules/auth/provisioning.ts`、`apps/api/src/modules/organization/service.ts`；测试用例 T-040、T-041；检查 `pnpm test:auth`、真实 PostgreSQL 18 邀请断言；结果 `[Pass]`。
- [x] **AC-006（原 SC-006）**：实现位置 `apps/api/src/middleware/auth.ts`、`apps/api/src/ 下的 app.ts`；测试用例 T-020、T-032；检查 `pnpm test:all`、会话守卫断言；结果 `[Pass]`。
- [x] **AC-007（原 SC-007）**：实现位置 `apps/api/src/modules/organization/queries.ts`、`packages/db/src/schema/`；测试用例 T-046；检查 `pnpm test:auth`、跨设备默认组织断言；结果 `[Pass]`。
- [x] **AC-008（原 SC-008）**：实现位置 `apps/api/src/modules/organization/queries.ts`、`apps/api/src/modules/organization/service.ts`；测试用例 T-046、T-049；检查 `pnpm test:auth`、归档与引导断言；结果 `[Pass]`。
- [x] **AC-009（原 SC-009）**：实现位置 `apps/api/src/modules/auth/service.ts`、`apps/api/src/lib/errors.ts`；测试用例 T-032；检查 `pnpm test:auth`、错误响应一致性断言；结果 `[Pass]`。
- [x] **AC-010（原 SC-010）**：实现位置 `apps/api/src/middleware/login-rate-limit.ts`；测试用例 T-033；检查 `pnpm test:auth`、5 次与 15 分钟断言；结果 `[Pass]`。
- [x] **AC-011（原 SC-011）**：实现位置 `apps/api/src/modules/auth/client.ts`；测试用例 T-066；检查 `pnpm test:auth`、真实时间线续期断言；结果 `[Pass]`。
- [x] **AC-012（原 SC-012）**：实现位置 `packages/shared/src/schemas.ts`、`apps/api/src/modules/auth/service.ts`；测试用例 T-023、T-062；检查 `pnpm lint`、`pnpm test:auth`、注册字段断言；结果 `[Pass]`。

**质量检查结论（原质量清单）**：2026-11-14 的审阅未发现 `[NEEDS CLARIFICATION]`，FR-001–FR-021 与当时 SC-001–SC-012 的追踪完整，成功标准均可度量且描述为外部可观察结果，范围与非目标清晰；验收结论现由上面的 AC-001–AC-012 行记录。
