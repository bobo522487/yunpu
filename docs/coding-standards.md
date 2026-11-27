# Yunpu 编码与测试规范

本文档是 [constitution.md](constitution.md) 的落地细则，约束代码风格、模块边界、请求校验、错误映射、数据库事务与测试验收。规则与 `biome.json`、`apps/api/tsconfig.json`、`apps/api/src/**`、`packages/**` 及 `tests/**` 的现行实现对齐。

> 冲突处理：若本文与代码或自动门禁不一致，以实际代码与测试为准，并在同一变更中修正本文；不得只改文档或只改代码。

---

## 一、权威来源与自动门禁

| 规则域 | 唯一权威 | 自动门禁 |
| :--- | :--- | :--- |
| 后端/共享包格式、Lint、导入边界 | `biome.json` | `pnpm run lint:api`（`biome check .`） |
| 后端 TypeScript 类型 | `apps/api/tsconfig.json` | `pnpm run lint:api`（`tsc --noEmit -p apps/api/tsconfig.json`） |
| 前端 Lint、边界与类型检查 | `apps/web/eslint.config.js`、`apps/web/tsconfig.json` | `pnpm run lint:web`（`eslint .` + `tsr generate && tsc -b`） |
| 跨模块/包依赖方向 | `biome.json`、`apps/web/eslint.config.js` | `tests/runtime/`、`tests/security/` |
| 错误码与 HTTP 状态 | `packages/shared/src/errors.ts`、`apps/api/src/lib/errors.ts` | `apps/api/test/error-mapping.test.ts`、`tests/runtime/error-envelope.test.ts` |
| 租户隔离与事务 | `apps/api/src/db/with-tenant-transaction.ts` | `tests/security/tenant-isolation.test.ts`、`tests/security/tenant-connection-reuse.test.ts` |
| HTTP 契约 | `apps/api/src/openapi/operations.ts` | `pnpm contract:check` |

- 后端与共享包使用 Biome 作为唯一格式化与 Lint 入口，不在根目录或 `apps/api` 新增 ESLint/Prettier；`apps/web` 使用 ESLint（含 React Hooks、TanStack Query 规则及禁止导入 `@yunpu/db`/`apps/api`/`bun` 的边界规则）与 Prettier（含 Tailwind 排序）。
- 规范类规则优先落在配置、类型或测试中；不能自动化的约定才写入本文。

---

## 二、运行时与 TypeScript

1. **运行时**：Node.js `>=26.13.0`，pnpm `12.18.0`。后端与脚本直接执行 `.ts` 源码（`node --import ./scripts/ts-ext-register.mjs ...`）。
2. **禁止 Bun**：不得使用 `bun` 运行时或 `bun:test`（`biome.json` 的 `noRestrictedImports` 拦截）。
3. **TypeScript 约束**（`apps/api/tsconfig.json`：`strict`、`noEmit`、`erasableSyntaxOnly`、`verbatimModuleSyntax`、`allowImportingTsExtensions`、`moduleResolution: bundler`）：
   - 仅使用可擦除语法：禁止 `enum`、`namespace` 与构造函数参数属性；枚举用 `as const` 数组 + 联合类型表达（见 `packages/shared/src/enums.ts`）。
   - 仅用于类型的导入必须写 `import type`；相对导入不带 `.ts` 后缀。
   - 开启 `strict`，禁止用 `any` 绕过边界类型；外部输入一律先收窄为 `unknown`，再交给 Zod 校验。
   - 禁止无理由的 `@ts-ignore`；确需抑制时使用 `@ts-expect-error` 并注明原因，且不得长期保留。
4. **格式化**：Biome `2.2.6`，2 空格缩进，启用 `recommended` 规则。不得用 `biome-ignore` 静默违规；确需例外时必须写明理由并限定最小范围。
5. **前端边界**：`@yunpu/web` 已纳入 `pnpm-workspace.yaml`（Node 26 + Vite + React），通过 `"@yunpu/shared": "workspace:*"` 直接消费共享枚举、错误码与校验 Schema，严禁导入 `@yunpu/db` 或 `apps/api` 运行时代码。`pnpm lint` 同时覆盖前后端检查（`lint:api` + `lint:web`），`contracts/openapi.json` 继续作为 HTTP 契约校验产物。

---

## 三、模块边界与代码组织

### 1. 依赖方向

| 位置 | 允许依赖 | 禁止依赖 |
| :--- | :--- | :--- |
| `packages/shared` | 纯类型、枚举、Zod Schema、错误定义 | `apps/**`、`**/modules/**` 或任何运行时模块 |
| `packages/db` | Drizzle schema、迁移、数据库客户端 | 业务 service、HTTP 层 |
| `apps/web` | 本应用源码、`@yunpu/shared`（纯类型/枚举/校验） | `@yunpu/db`、`apps/api` 运行时代码、`bun`/`bun:test` |
| `apps/api/src/modules/<module>` | 本模块文件、其他模块 `service.ts`、`@yunpu/shared`、`@yunpu/db` schema | 其他模块的 `queries.ts`、`*.repo`、`*.route`；`createDb`/裸连接池 |
| `apps/api/src/app.ts` | 中间件、路由挂载、统一错误兜底、`AppType` | 具体业务规则 |

### 2. 分层与调用

- 请求链路固定为：`router`（认证上下文 + Zod 校验）→ `service`（租户事务 + 领域规则）→ `queries`（Drizzle 查询）。
- 跨模块协作只能调用目标模块 `service.ts` 的对外函数，不得穿透到其内部查询。
- **禁止空转中间层**：不新增只做字段原样拷贝的 `mapper`、`.repo.ts` 或 `.route.ts`（`tests/runtime/no-passthrough-layer.test.ts`）。
- 复杂业务不变量优先交给数据库约束；跨系统与角色权限校验集中在 `service.ts` 与 `apps/api/src/access.ts`。
- API 对外类型通过 `apps/api/src/app.ts` 导出的 `AppType` 与 `contracts/openapi.json` 暴露；`@yunpu/web` 直接通过 `@yunpu/shared` 复用共享枚举、错误码与 Schema。

---

## 四、请求处理与校验

1. **Router 只做四件事**：提取已认证 `userId`（`requireUser`）、校验入参、调用 `service`、返回统一响应。业务规则不得写进 `router.ts`。
2. **所有外部输入在边界校验**：JSON body 与 query 使用 `apps/api/src/lib/http.ts` 的 `parseJson`、`parseQuery`；路径参数存在专用 Schema 时使用 `parseParams`。禁止在路由内直接 `JSON.parse`、手写类型断言或重复定义 schema。
3. **Schema 复用**：跨端或跨模块共享的校验规则放在 `packages/shared/src/schemas.ts`；输出类型使用 `z.output<typeof Schema>`，不得用 `as` 伪造。
4. **JSON 请求**：必须携带 `Content-Type: application/json`；非法 JSON 会被转为 `null` 并返回 `VALIDATION`，不得绕过该行为。
5. **校验错误形状**：`details` 是裸 `fieldErrors`（`z.ZodError.flatten().fieldErrors`），不得包成 `{ issues: ... }`（`tests/security/validation-shape.test.ts`）；顶层 `.refine()` 产生的 `formErrors` 保留在 `details._form`。
6. **契约同步**：修改路由、参数或共享 Schema 后运行 `pnpm contract:export`，提交更新后的 `contracts/openapi.json`。

---

## 五、错误处理与响应

### 1. 标准响应信封

业务 API（`/api/v1/*`）统一使用扁平结果信封，由 `apps/api/src/app.ts` 的 `onApiError` 与测试保证：

- **成功**：`{ ok: true, data: ... }`；无返回体的删除操作为 `{ ok: true }`。
- **失败**：`{ ok: false, code: ErrorCode, message: string, details?: Record<string, unknown> }`。
- 错误响应不得出现 `error` 字段；`details` 仅在确有附加信息时提供。
- `/api/media/*` 是能力令牌保护的基础设施端点，使用独立的 `{ ok, reason }` 形状，不纳入业务信封。

### 2. 错误构造

- 业务错误一律抛出 `AppError`（或 `lib/errors.ts` 提供的 `notFound`、`forbidden`、`conflict`、`validationError`、`versionConflict` 等工厂），禁止返回临时拼装的错误对象。
- 允许的 `ErrorCode` 与状态码以 `packages/shared/src/errors.ts` 的 `ERROR_STATUS` 为准。
- 禁止把数据库异常、堆栈或 SQL 文本直接返回给客户端；未处理错误必须带 `requestId` 写入结构化日志。

### 3. 数据库错误映射

数据库异常由 `apps/api/src/lib/errors.ts` 的 `tryMapDatabaseError` / `mapDatabaseError` 统一翻译（未在 service 层捕获的已识别异常也由 `app.ts` `onApiError` 兜底映射），**只依据 PostgreSQL `SQLSTATE`（`code`）与 `constraint` 名称，禁止解析错误消息文本**；映射会沿 `cause` 链向上查找最多 5 层。

| SQLSTATE | 业务码 | HTTP | 典型约束 / 说明 |
| :--- | :--- | :--- | :--- |
| `23505` | `CONFLICT` | 409 | `user_email_unique`、`uk_person_relation_kind` 使用专属文案 |
| `23001` / `23503` | `CONFLICT` | 409 | `fk_organization_owner` 使用专属文案（不能移除组织所有者） |
| `22P02` / `22007` | `VALIDATION` | 400 | 输入格式 / 日期时间格式非法 |
| `23514` | `VALIDATION` | 400 | `ck_person_life_years` 等 CHECK 约束 |
| `GX001` | `CYCLE_DETECTED` | 409 | 谱系环检测 |
| `GX011` | `PARENT_LIMIT` | 409 | 父母边上限 |
| `GX012` | `CONFLICT` | 409 | 归档组织禁止写入 |
| `GX013` | `CONFLICT` | 409 | 不能修改所有者角色 |
| `GX005` | `NOT_FOUND` | 404 | 目标不存在或已失效 |
| `GX006` / `GX009` | `FORBIDDEN` | 403 | 权限不足 / 邀请邮箱不匹配 |
| `GX008` | `UNAUTHORIZED` | 401 | 缺少认证上下文 |
| `GX010` | `CONFLICT` | 409 | 并发抢先，提示重试 |
| `55P03` / `57014` | `UNAVAILABLE` | 503 | 锁超时 / 语句取消 |
| 其他 | `INTERNAL` | 500 | 记录日志，不泄露细节 |

- `42501`（RLS 写入拒绝）是数据库兜底，不在业务映射表中。正常链路必须由 `access.ts` 在写前返回 404/403；若 API 层收到 `42501`，视为权限前置校验缺失，按 `INTERNAL` 记录并修复，不得当作常规分支吞掉。

---

## 六、数据库、事务与并发

1. **连接参数**：所有数据库连接必须通过 `packages/db/src/client.ts` 的 `PG_OPTIONS` 注入 `lock_timeout=3000`、`statement_timeout=30000`、`idle_in_transaction_session_timeout=60000`。
2. **唯一租户事务入口**：业务读写必须包裹在 `withTenantTransaction({ userId }, fn)` 中：
   - 事务入口只设置 `app.user_id`；组织与角色权限在事务内经 `access.ts` 的 `requireMember` 校验。
   - 非成员统一返回 `404 NOT_FOUND`（“不存在或无权”），成员角色不足返回 `403 FORBIDDEN`。
   - `authMiddleware` 只挂载在 `/api/v1/*`；`/api/health`、`/api/ready`、`/api/media/*` 不查询业务会话。
3. **禁止绕过入口**：`apps/api/src/modules/**` 禁止导入 `createDb`、`businessPool` 或裸 `db/pool`。仅允许 `docs/architecture.md` 登记的三类例外：健康检查、认证库、数据库迁移。
4. **重试策略**：
   - 仅对瞬态故障执行最多 3 次指数退避（`25ms * 2^attempt`）：`40001`（序列化冲突）、`40P01`（死锁）可重试；`ECONNRESET` 仅在事务建立阶段（`setup`）或只读事务（`readOnly: true`）中重试，绝不在写入事务的提交阶段（`commit`）重放非幂等写操作。
   - 唯一键冲突（`23505`）与乐观锁版本冲突（`VERSION_CONFLICT`）不得重试，直接返回 `409`。
5. **连接卫生**：事务必须以 `COMMIT` 或 `ROLLBACK` 结束；`ROLLBACK` 失败、连接级故障或角色断言失败时必须 `release(true)` 销毁会话，禁止把可能中毒的连接还池。
6. **并发更新**：项目与人物使用整数 `version` 做 CAS，冲突返回 `409 VERSION_CONFLICT`；禁止用 `updated_at` 字符串充当并发令牌。
7. **迁移**：Schema 变更必须同时落地 `packages/db/migrations/` 顺序迁移与 `packages/db/src/schema/`，不得在迁移中调用业务模块。

---

## 七、测试与 SDD 验收

### 1. 执行命令

| 命令 | 覆盖范围 |
| :--- | :--- |
| `scripts/env.sh up development` / `scripts/env.sh up test` | 启动 PostgreSQL 18 与 `pgsty/silo` 对象存储 |
| `pnpm test` | 环境检查、迁移、认证与 `apps/api/test` 基础测试 |
| `pnpm test:all` | 全量后端套件：`tests/env`、`auth`、`console`、`genealogy`、`security`、`runtime`、`apps/api/test` |
| `pnpm run test:web` | 前端单元测试（Vitest） |
| `pnpm run test:web:browser` | 前端组件浏览器测试（Vitest + Playwright） |
| `pnpm lint` | 全仓检查：`lint:api`（Biome + API `tsc --noEmit`）与 `lint:web`（ESLint + `tsr generate && tsc -b`） |
| `pnpm dev` | 一键并行启动本地 API（`3001`）与带 `/api` 代理的前端开发服务器（`3000`） |
| `pnpm contract:check` | 校验 `contracts/openapi.json` 未漂移 |

### 2. 测试要求

- **禁止只用 Mock 验证数据库约束、RLS、触发器或事务重试**。涉及存储规则、租户隔离、迁移与 API 路由的改动必须在真实 PostgreSQL 18 上跑通。
- 测试按领域放在 `tests/<domain>/`；仅测试 API 内部函数的用例放在 `apps/api/test/`。
- 测试必须可重复：使用唯一邮箱/名称等夹具，测试结束清理数据；共享数据库下保持 `fileParallelism: false` 与串行执行。
- 错误路径必须断言完整信封（`ok`、`code`、`message`），校验失败必须断言裸 `fieldErrors`；并发与权限边界要有对应用例。
- 新增测试应优先覆盖：正常路径、异常路径、租户隔离、角色权限、并发/CAS、事务回滚与重试分类。

### 3. SDD 独立验收

对于遵循 SDD 流程的功能，测试与验收阶段必须完成：

1. 覆盖每条 `FR-xxx` 的正常路径、异常路径、权限/租户隔离边界与并发/事务场景。
2. 对照 `spec.md`、`plan.md`、`tasks.md` 与实际代码检查，输出需求追踪矩阵（`FR-xxx` | 实现位置 | 测试用例 | 验收结果）。
3. 发现未通过项时记录缺陷与修复建议，修复后重新运行完整测试直至通过。

---

## 八、提交前检查清单

- [ ] `pnpm lint` 通过（含 `biome check .` 与 `tsc --noEmit`）。
- [ ] 受影响测试通过；合并前 `pnpm test:all` 通过。
- [ ] 修改路由或共享 Schema 后已运行 `pnpm contract:export` 并提交契约。
- [ ] 未引入 Bun、跨模块内部导入、透传 `mapper`/`.repo.ts` 或裸连接池。
- [ ] 新增错误路径有对应状态码、错误码与测试断言。
- [ ] 涉及架构、边界、术语或原则变化时，已同步更新 `docs/` 或新增 `docs/adr/`。

---

## 参考

- [Biome: Configure Biome](https://biomejs.dev/guides/configure-biome/)
- [Zod: Basic usage](https://zod.dev/basics)
- [Hono: Validation](https://hono.dev/docs/guides/validation)
- [node-postgres: Transactions](https://node-postgres.com/features/transactions)
- [PostgreSQL: Error Codes](https://www.postgresql.org/docs/current/errcodes-appendix.html)
