# Yunpu Coding & Testing Standards

本文档约束代码风格、错误处理、数据库事务与测试验收标准。所有规则均与现行 `biome.json`、`apps/api/`、`packages/` 及 `tests/` 对齐。

---

## 一、运行时与语言规范

1. **Node 26 原生 TS 执行**：后端与脚本直接运行 `.ts` 源码（通过 `node --import ./scripts/ts-ext-register.mjs ...`），禁止引入 `bun` 或 `bun:test` API（由 `biome.json` `noRestrictedImports` 拦截）。
2. **格式化与静态检查**：
   - 使用 Biome 统一格式化（2 空格缩进）与 Lint 检查。
   - 执行命令：`pnpm lint`（全仓 `biome check .` + `tsc --noEmit -p apps/api/tsconfig.json`）。
   - 前端在独立仓库 `yunpu-web` 中用 Bun 自行做类型检查，不进入本仓库的 `pnpm lint`。
   - `tsc --noEmit` 已纳入 `pnpm lint` 门禁，类型错误必须清零后才能合并。
   - 改了路由或 `packages/shared` 的 schema 后运行 `pnpm contract:export`，提交更新后的 `contracts/openapi.json`。

---

## 二、模块边界与代码组织

1. **导出与调用规范**：
   - API 对外契约通过 `apps/api/src/app.ts` 导出的 `AppType` 暴露。
   - 跨模块调用仅允许导入目标模块的 `service.ts`（或根导出），**严禁**导入其他模块的 `queries.ts`、`*.repo` 或 `*.route`。
   - `packages/shared` 仅存放跨端纯类型、枚举、校验 Schema 与错误定义，禁止反向依赖 `apps/**` 或任何模块。
2. **禁止空转中间层**：不新增只做原样字段拷贝的 `mapper` 或 `.repo.ts` 文件，在 `service` 与 `queries` 中保持简洁的数据转换。
3. **函数与校验职责**：
   - `router.ts` 负责入参反序列化/Zod 校验、从上下文提取已认证 `userId`、调用 `service` 并返回响应。
   - 复杂业务规则能由数据库约束保障的交给数据库；跨系统或角色权限校验集中于 `service.ts` 与 `apps/api/src/access.ts`。

---

## 三、错误处理与响应规范

### 1. 标准响应信封

当前 API 全量统一使用扁平结果信封（由 `apps/api/src/app.ts` `onApiError` 与 `tests/runtime/error-envelope.test.ts` 保证）：

- **成功响应**：`{ ok: true, ... }`（或路由约定 payload）。
- **错误响应**：`{ ok: false, code: ErrorCode, message: string, details?: Record<string, unknown> }`。

### 2. 错误分类与数据库映射

- 允许的 `ErrorCode` 与 HTTP 状态码集中定义在 `packages/shared/src/errors.ts`（`ERROR_STATUS`），业务层统一抛出 `AppError`。
- 数据库异常由 `apps/api/src/lib/errors.ts` 的 `mapDatabaseError` 统一翻译，**必须只依据 PostgreSQL `SQLSTATE`（`code`）与 `constraint` 名称映射，禁止解析错误消息文本**：
  - `23505`（唯一冲突）→ `409 CONFLICT`（如 `user_email_unique`）
  - `23001` / `23503`（外键限制）→ `409 CONFLICT`（如 `fk_organization_owner`）
  - `22P02`（格式非法）→ `400 VALIDATION`
  - `23514`（CHECK 约束）→ `400 VALIDATION`（如 `ck_person_life_years`）
  - `GX001`（谱系环检测）→ `409 CYCLE_DETECTED`
  - `GX011`（父母边上限）→ `409 PARENT_LIMIT`
  - `GX012`（归档组织写入）→ `409 CONFLICT`
  - `42501`（RLS 权限拒绝）→ 由角色策略与 `access.ts` 区分：非成员返回 `404 NOT_FOUND`（`"不存在或无权"`），成员角色不足返回 `403 FORBIDDEN`。

---

## 四、数据库、事务与并发规范

1. **连接与超时参数**：所有数据库连接均需通过 `packages/db/src/client.ts` 的 `PG_OPTIONS` 注入服务端超时（`lock_timeout=3000`、`statement_timeout=30000`、`idle_in_transaction_session_timeout=60000`）。
2. **租户事务入口**：所有业务数据库读写必须包裹在 `withTenantTransaction({ userId, orgId? }, fn)` 中：
   - 仅对瞬态故障（`ECONNRESET`、`40001` 序列化冲突、`40P01` 死锁）执行最多 3 次指数退避重试（`25ms * 2^attempt`）。
   - 唯一键冲突（`23505`）与乐观锁版本冲突（`VERSION_CONFLICT`）**不得重试**，直接返回 `409`。
   - 传给 `withTenantTransaction` 的 `orgId` 若用于业务写操作或权限判定，必须经过 `access.ts`（`requireMember`）在事务内完成成员关系校验。
3. **迁移规范**：Schema 变更必须通过 `packages/db/migrations/` 顺序迁移文件与 `packages/db/src/schema/` 同步落地，迁移脚本不得混入业务模块调用。

---

## 五、测试与 SDD 验收规范

### 1. 测试执行方式

- 环境启停：`scripts/env.sh up development` / `scripts/env.sh up test`（确保 PostgreSQL 18 与 `pgsty/silo` 对象存储就绪）。
- 常用测试命令：
  - 基础环境与认证/API 测试：`pnpm test`
  - 全量测试套件：`pnpm test:all`（覆盖 `tests/env`、`tests/auth`、`tests/console`、`tests/genealogy`、`tests/security`、`tests/runtime`、`apps/api/test`）
  - 代码与边界检查：`pnpm lint`
- **禁止仅用 Mock 假装验证数据库约束、RLS、触发器或事务重试**；涉及存储规则、租户隔离、迁移与 API 路由的改动必须在真实 PostgreSQL 18 上跑通测试。

### 2. SDD 独立验收要求

对于遵循 SDD 流程的功能开发，测试与验收阶段必须完成：
1. 覆盖每条 `FR-xxx` 的正常路径、异常路径、权限/租户隔离边界与并发/事务场景。
2. 验收者对照 `spec.md`、`plan.md`、`tasks.md` 与实际代码检查，输出需求追踪矩阵（`FR-xxx` | 实现位置 | 测试用例 | 验收结果）。
3. 发现未通过项时记录缺陷与修复建议，修复后重新运行完整测试直至通过。
