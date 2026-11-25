# Technical Plan: 用户注册、登录与默认组织

**Branch**: `002-user-auth-default-org` | **Date**: 2026-11-25 | **Spec**: [spec.md](./spec.md)

> **前置要求**：本方案依据当前仓库的独立后端架构、宪法、架构、编码与术语规范制定，设计逐条可追溯至 spec.md 的 `FR-xxx`。技术取舍与查阅出处集中在第 7 节，验收契约见第 3、4 节。本仓库只提供 `/api/*` JSON 接口，产品前端在独立仓库；技术栈以 `docs/architecture.md` 为准。本文件是功能完成后的技术归档：保留有效设计事实，不保留当时的临时工具链描述。

## 1. 上下文与复用分析

- **关联 Spec**：[spec.md](./spec.md)（`FR-001`–`FR-021`）；商业行为不在此重复，设计只解释系统如何满足这些需求。
- **复用现有模块**：`apps/api/src/modules/auth/*`（认证路由、服务与错误映射）、`apps/api/src/modules/organization/*`（组织、成员与邀请服务）、`apps/api/src/middleware/login-rate-limit.ts`（按邮箱与来源地址计数）、`apps/api/src/db/with-user.ts`（事务内设置当前用户上下文）、`packages/db`（迁移与连接）、`packages/shared`（枚举与错误契约）。这些模块均为既有目录，不需要新抽象层。
- **新增/修改范围**：本批次没有新增业务模块；落地时把注册补偿、默认组织解析与邀请兑换串到既有模块中。只修改配置、路由、服务与测试，不引入缓存、消息队列、独立认证服务、第二个数据库或前端工程（`FR-001`、`FR-005`）。
- **技术上下文**：TypeScript 5+（Node ≥ 26.13.0 原生类型剥离，`scripts/ts-ext-register.mjs` 加载 `.ts`），运行时与依赖安装统一 Node 26.13.1 + pnpm 12.18.0（`packageManager` 固定、`pnpm install --frozen-lockfile`）；测试运行器为 Vitest 5.1.1（`vitest run --config vitest.config.ts`），静态检查为 Biome 2.2.6 与 `tsc --noEmit`。服务框架为 Hono，数据库为 PostgreSQL 18，对象存储为 `docker.io/pgsty/silo`；认证与 ORM 沿用 Better Auth + Drizzle 的既有选型。目标平台为开发者 Linux 工作机，数据库与对象存储由 Compose 提供，应用在宿主机（对应 `FR-014` 的工具链约束）。
- **规模假设**：单应用进程；每账号组织成员关系为个位数到几十；登录失败计数为进程内状态，出现多实例时再迁移到共享存储，不预埋接口。

## 2. 模块职责与依赖关系

- **请求链路**：`router → service → queries`。路由只做输入校验与响应封装；服务编排业务规则与事务边界；queries 只执行数据访问，不跨层被其他模块直接导入。注册、登录、会话与邀请入口分别落在 `modules/auth` 与 `modules/organization`（`FR-001`、`FR-008`、`FR-016`）。
- **注册编排**：`auth/provisioning.ts` 负责「建立认证用户 → 兑换邀请或创建默认组织 → 失败补偿」的顺序；成功时账号立即拥有会话与默认组织，失败时按第 5 节顺序删除已创建的认证状态（`FR-004`、`FR-005`、`FR-006`、`FR-017`）。
- **事务上下文**：`apps/api/src/db/with-user.ts` 在事务内设置当前用户上下文，使四张租户表的行级安全策略以真实账号身份执行；服务不得绕过该上下文或用迁移角色跑业务写入（`FR-019`、`FR-020`）。
- **默认组织解析**：组织服务按 `last_used_at DESC NULLS LAST, created_at ASC, id` 从 active 成员关系中收敛出唯一组织，解析结果作为账号级偏好跨设备复用；无可用组织时返回引导状态，不静默建组织（`FR-013`、`FR-014`、`FR-015`）。
- **登录失败限流**：`middleware/login-rate-limit.ts` 在路由前按「规范化邮箱 + 来源地址」统计连续失败；达到窗口后短路返回统一拒绝，成功登录清零；提示不区分邮箱是否存在（`FR-009`、`FR-021`）。
- **依赖方向**：`apps/api → packages/db / packages/shared` 单向依赖，反向无依赖；模块之间不直接导入 `queries`，也不另建透传层。应用只输出 JSON，不托管页面。

## 3. 数据模型与数据库变更

本批次沿用既有数据库与模式划分，不新增业务数据库、缓存或队列。下面把原数据模型与查阅结论折叠为归档记录，字段与执行顺序按实现事实描述。

### 3.1 认证与租户实体（`FR-003`、`FR-005`、`FR-013`、`FR-016`）

- `auth."user"`：账号主体，保存规范化后唯一的邮箱、不可还原的密码凭证、可缺省显示名与账号状态。邮箱唯一约束由数据库执行，服务层负责去首尾空白与小写化。
- `auth.session`、`auth.account`、`auth.verification`：会话、密码凭证与验证状态由认证层持有；本功能不直接写这三张表的内容，注册补偿时按第 5 节顺序清理。
- `organization`：租户本体，关键属性为名称、状态和唯一 owner；owner 归属由 `organization_member` 的角色与约束表达，不新增 owner 字段。
- `organization_member`：账号与组织的归属关系，含 `admin` / `editor` / `viewer` 角色及 `last_used_at`。`last_used_at` 是默认组织偏好的单一真相源，不另建偏好表。
- `invite`：指向目标邮箱与目标组织的加入凭据，含拟授予角色、状态与有效期；只能由受控函数消费，不能授予 owner。
- `audit_log`：注册、登录、登出与邀请兑换的关键事件记录；沿用既有审计边界，密码、会话凭据与邀请明文不得进入记录。

### 3.2 默认组织查询与状态（`FR-006`、`FR-013`、`FR-014`、`FR-015`）

- 默认组织按 `last_used_at DESC NULLS LAST, created_at ASC, id` 排序，只选 `status='active'` 的成员关系；已归档组织不参与选择。
- 解析结果是一次按 `user_id` 收敛的查询，不为每个组织追加往返；没有可用组织时返回引导状态。
- 用户切换组织时更新当前成员关系的 `last_used_at`；跨设备一致由该字段保证，不依赖会话本地状态。
- 账号与默认组织创建的一致性由补偿实现，不依赖跨 schema 的单条事务；外部观察不到有账号无组织的中间态。

### 3.3 受控函数、安全策略与迁移（`FR-017`、`FR-018`、`FR-019`、`FR-020`）

- 受控函数：`app.create_organization`（创建默认组织与 owner 成员）、`app.accept_invite`（一次性兑换邀请）、`app.resolve_invite_by_token`（按凭据解析邀请）。业务连接只通过函数执行这些动作。
- 四张租户表（`organization`、`organization_member`、`invite`、`audit_log`）全部启用并强制行级安全；业务角色 `genealogy_app` 无 `BYPASSRLS`，`SECURITY DEFINER` 函数属主为 `rls_definer`。权限不足时 fail-closed，不返回租户数据。
- 迁移顺序由 `packages/db/src/migrate.ts` 顺序执行：`0000_roles.sql`、`0001_auth_tenant.sql`、`0003_functions.sql`、`0004_rls.sql`、`0005_grants.sql`、`0006_fix_user_email_grant.sql`。目录中没有 `0002` 文件，这是历史编号空档，不是缺漏；runner 只应用尚未应用的迁移。
- 约束执行者：唯一邮箱由唯一索引 + 服务层规范化；邀请一次性由条件更新抢占；错误映射由统一错误表负责；测试用真实 PostgreSQL 18 验证，不用替身跳过约束。

## 4. API Contract

应用只返回 JSON。成功统一为 `{ ok: true, data }`；失败为扁平信封 `{ ok: false, code, message, details? }`，与 ADR-0003 一致，不使用嵌套 `error` 对象（`FR-001`、`FR-002`、`FR-011`）。字段名为契约，实现不得改名。

### 4.1 认证入口（`FR-001`、`FR-002`、`FR-004`、`FR-008`、`FR-009`、`FR-011`）

| 路径 | 成功 | 失败 |
| --- | --- | --- |
| `POST /api/v1/auth/sign-up` | 201 `{ ok: true, data: { user, session, defaultOrganization } }`；会话立即建立 | 邮箱冲突 `409 CONFLICT`；密码或邮箱非法 `400 VALIDATION`；补偿失败 `500 INTERNAL` |
| `POST /api/v1/auth/sign-in` | 200 `{ ok: true, data: { session, defaultOrganization } }`；登录计数清零 | 邮箱不存在或密码错误统一 `401 UNAUTHORIZED`；达到窗口 `429 RATE_LIMITED` |
| `POST /api/v1/auth/sign-out` | 200 `{ ok: true, data: { signedOut: true } }`；当前会话失效 | 无会话 `401 UNAUTHORIZED`；其他设备会话不受影响 |
| `GET /api/v1/auth/session` | 200 `{ ok: true, data: { user, defaultOrganization } }` | 会话缺失、过期或账号不可用 `401 UNAUTHORIZED` |

### 4.2 组织与邀请入口（`FR-005`、`FR-007`、`FR-013`、`FR-014`、`FR-015`、`FR-016`）

| 路径 | 成功 | 失败 |
| --- | --- | --- |
| `GET /api/v1/organizations` | 200 `{ ok: true, data: { organizations, defaultOrganizationId } }`；只列当前账号可用组织 | 无会话 `401 UNAUTHORIZED` |
| `POST /api/v1/organizations` | 201 `{ ok: true, data: { organization, membership } }`；创建者成为 owner | 参数非法 `400 VALIDATION`；无会话 `401 UNAUTHORIZED` |
| `POST /api/v1/organizations/:organizationId/activate` | 200 `{ ok: true, data: { defaultOrganizationId } }`；写入 `last_used_at` | 非成员或已归档 `404 TARGET_INVALID`；无会话 `401 UNAUTHORIZED` |
| `POST /api/v1/invites/accept` | 200 `{ ok: true, data: { organization, membership } }`；默认组织切换为邀请组织 | 邮箱不匹配 `403 INVITE_EMAIL_MISMATCH`；不存在/过期/已撤销 `404 TARGET_INVALID`；并发已使用 `409 CONFLICT` |

邀请失败不影响注册主流程：注册时检测到邀请不可用仍完成账号创建，返回成功并在 `data` 中说明邀请未生效；用户进入自己的默认组织（`FR-017`、`FR-018`）。

## 5. 异常处理、事务与并发控制

- **注册补偿**：默认组织创建失败时按 `session → account → user` 顺序删除刚创建的认证状态，响应完成后不留下占用邮箱却没有组织的账号；重试不产生重复默认组织（`FR-006`）。
- **唯一冲突**：邮箱唯一键冲突的 `23505` 映射为 `409 CONFLICT`，文案不泄漏账号敏感信息；并发注册最多一个成功（`FR-001`、`FR-002`）。
- **错误码映射**：沿用 `GX005`（邮箱已注册）、`GX008`（登录凭证无效）、`GX009`（会话无效）、`GX010`（邀请不可用）与 `RATE_LIMITED`；新增邮箱冲突统一走 `409 CONFLICT`，保持扁平 `code/message/details` 结构（`FR-009`、`FR-012`、`FR-017`）。
- **邀请抢占**：消费邀请使用条件更新并在目标字段上以 `IS DISTINCT FROM` 判定，确保并发下只有一个请求把邀请标记为已使用；失败方收到明确错误，不产生重复成员（`FR-018`）。
- **限流窗口**：同一「邮箱 + 来源地址」在进程内做 5 次 / 15 分钟滑动窗口，成功登录清零；窗口过期自动解除，不实现永久锁定。多来源轮换不在本批次拦截范围，由平台统一限流兜底（`FR-021`）。
- **会话守卫**：缺失、过期、被登出或账号状态变化的会话一律 `401 UNAUTHORIZED`，不返回任何组织或业务数据；写入失败时不能把未保存内容当作已保存（`FR-012`）。
- **RLS fail-closed**：业务请求必须通过 `with-user` 设置当前账号上下文；上下文缺失时四张租户表读不到任何行，受控函数也不放行跨租户写入（`FR-019`、`FR-020`）。

## 6. 安全性、性能与兼容性

- **敏感信息**：响应、日志与审计记录中不得出现密码原文、会话令牌或邀请明文；密码凭证只由认证层持有，审计只记录事件类型、主体与时间（`FR-003`、`FR-020`）。
- **会话语义**：7 天有效期、滑动续期 1 天、无绝对最长寿命，以统一服务端时间为准；持续活跃不被强制登出，主动登出只影响当前会话（`FR-010`、`FR-011`）。
- **性能**：默认组织解析为一次按 `user_id` 收敛的查询；登录与进入默认组织的中位耗时不超过 3 秒、95% 不超过 5 秒；注册到进入默认组织的中位耗时不超过 2 分钟（`FR-013`、`FR-001`）。
- **租户隔离**：所有组织内操作限定在当前会话所属组织，默认组织切换不改变数据边界；归档组织不可被选中（`FR-014`、`FR-019`）。
- **范围边界**：`/sign-up`、`/app`、`/onboarding` 这些前端页面路由不在当前仓库范围内；它们只作为历史文档中的页面表述被移除，不是本归档的接口契约。产品前端在独立仓库消费 JSON 接口（`FR-015`）。

## 7. 技术风险与取舍

> 以下是当时的决策记录与查阅出处；未决项已在 spec.md 澄清与本设计中收口，正文不留待澄清标记。技术栈表述已按当前独立后端架构对齐。

### 7.1 决策

1. **注册跨认证层与业务层，采用补偿删除而非单一事务**（`FR-005`、`FR-006`）：Better Auth 的用户与密码写入和业务组织创建不在同一事务边界；直接写认证表会绕过密码哈希、会话与凭据逻辑，把认证写入塞进业务事务需要依赖内部 API，升级即碎。补偿删除是当时风险最低的方案。
2. **登录失败计数为进程内状态**（`FR-021`）：单应用进程部署，15 分钟窗口无需新增表或缓存；新建计数表会带来每次失败写入与清理任务，引入 Redis 又与明确不做清单冲突。多实例需求出现前不迁移。
3. **沿用 Better Auth + Drizzle 运行时依赖**（`FR-001`、`FR-003`）：架构文档已定认证与数据访问选型；手写认证会复制密码哈希、会话和凭据逻辑，只用底层连接会形成第二套数据访问路径。当前运行入口已统一到 Node 26 + pnpm，工具链不再保留旧运行时描述。
4. **`organization_member.last_used_at` 表达默认组织偏好**（`FR-013`、`FR-014`）：默认组织需要账号级、跨设备地记录上次使用的组织；新建偏好表会多一张表与一套策略，放进认证用户表则把业务偏好塞进认证层。
5. **受控函数承载组织创建与邀请兑换**（`FR-016`、`FR-017`、`FR-018`）：四个动作都需要跨表一致性和权限收紧；放在通用查询层会绕过行级安全，放在路由层则无法保证并发抢占。
6. **扁平错误信封与统一映射**（`FR-009`、`FR-012`）：ADR-0003 已采纳 `{ ok:false, code, message, details? }`；嵌套错误对象会改变客户端解析契约，本归档不改网关错误结构。
7. **测试只使用 Vitest 打真实 PostgreSQL 18**（`FR-006`、`FR-019`、`FR-021`）：注册补偿、行级安全、唯一约束、邀请抢占与限流窗口都属于真实数据库或真实中间件行为，不用替身跳过；测试环境与开发环境端口、库名、凭证隔离。

### 7.2 查阅记录

| 技术 | 取用实践 |
| --- | --- |
| Hono | 路由级测试用官方 `app.request()` 进程内请求助手，无需起监听服务；应用只返回 JSON |
| Node 26 原生类型剥离 | `node --import ./scripts/ts-ext-register.mjs` 直接运行 `.ts`，不引入编译步骤 |
| PostgreSQL 18 | 唯一键冲突识别为 `23505` 并映射为 `409 CONFLICT`；迁移由自研顺序 runner 执行 |
| Drizzle | 官方 `migrate()` 只应用尚未应用的迁移；本项目迁移含角色与安全策略等非纯 DDL，沿用顺序 runner 保留显式控制 |
| Better Auth | 会话有效期与滑动续期由认证层配置；业务侧只消费会话结果，不复制凭据逻辑 |
| Vitest | `fileParallelism: false` 保证共用真实库时文件间串行；`test.env` 注入隔离配置 |
| pnpm | 先复制 lockfile 再 `--frozen-lockfile`，锁定依赖版本 |

### 7.3 归档说明

- 原随附的研究、数据模型、快速开始、清单与接口文档中的有效内容已按方案 A 合入本归档；前端页面契约按方案 A 移除，不再作为验收面。
- 文档检查脚本不属于本归档的验收路径；本功能归档的验收依据只有 spec.md 的需求与验收标准、plan.md 的技术事实、tasks.md 的追踪矩阵，以及真实环境下的自动化测试。
