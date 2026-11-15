# 架构评审 P0 止血 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把评审报告里六条 P0 中最要命的四条（规则无执行者、连接配置、media 绕过、后端静默失败链）变成有测试、有门禁、有日志的真实代码，产出一个可独立跑通 `bun test` 全套 + CI 的后端。

**Architecture:** 模块化单体保持不变：一个 Bun 进程跑一个 Hono 实例（`app.fetch` 是唯一 fetch 入口），一个 PG18 承载全部业务域，RLS 是租户隔离唯一执行者。本计划只新增三样东西：错误码→状态码的单一数据表、连接配置的单一常量、CI 里的真实测试执行者。不引入新服务、不引入新抽象层、不改 `AppError` 构造签名。

**Tech Stack:** Bun 1.4.4 / pnpm 12.18.0 / Hono 4.13.18 / Zod 4.6.7 / Drizzle ORM 0.45.4 / node-postgres `pg` 8.23.1 / PostgreSQL 18 / better-auth 1.7.23 / MinIO（`quay.io/minio/minio`）/ GitHub Actions ubuntu-latest。本计划**不引入** Biome、Playwright、Service Worker、缓存层。

**Spec:** `.local/architecture-review-2026-11-15.md`（只读评审产物，第 0.1、4、7、10 节）+ `.specify/memory/constitution.md` v1.1.0 + `docs/architecture/data/migrations.md:160-177`。本计划的 Global Constraints 逐字复制其精确值，因此计划可独立执行；`.local/` 被 `.gitignore:9` 忽略，不属于交付物。

## Scope

评审报告覆盖四个互不依赖的子系统，按 writing-plans 的 Scope Check 拆成四份独立计划，每份独立产出可工作、可测试的软件。本计划是**第 1 份：P0 止血**，只动后端、数据层连接、CI 与少量文档状态；不碰前端、不动路由契约、不引入版本升级。

| 计划 | 覆盖 findings | 退出条件 |
| --- | --- | --- |
| **1（本文件）P0 止血** | P0-1（CI 真实门禁部分）、P0-2、P0-4、P0-5、P1-3、P1-13 | `bun test` 全套（含 `tests/console`）在 CI 真 PG18 上通过；media 走统一中间件链；后端不再把故障伪装成成功/404/401 |
| 2 前端单一真相 | P0-3、P0-6、P1-4 | 生产入口不注册 mock；业务数据只有一份；模板遗留删除且页面仍可达 |
| 3 类型化契约 | P1-1、P1-2、P1-6、P1-7 | 链式 `AppType` + `hc<AppType>` + `zValidator`；精确版本锁定 |
| 4 交付链与文档治理 | P1-5、P1-8、P0-1 剩余（477 行白名单收敛）、`gen:sql`、Dockerfile | 生产可部署；`gen:sql && git diff --exit-code` 有执行者 |

**P0-1 的边界**：本计划只负责「让已有测试与校验器在 CI 里真跑」。`docs/.check-docs-baseline.txt` 的 477 行白名单收敛、`scripts/gen-sql.ts` 生成器、Biome `noRestrictedImports` 属于计划 4，本计划不假装完成。

## Global Constraints

逐字复制自 spec 与宪法，实现时不得改数值：

- 版本精确锁定：`hono 4.13.18`、`@hono/zod-validator 0.9.1`、`zod 4.6.7`、`drizzle-orm 0.45.4`、`pg 8.23.1`、`better-auth 1.7.23`、`Bun 1.4.4`、`pnpm 12.18.0`、`PostgreSQL 18`（`compose.yaml:7` `image: postgres:18`）。
- 三个超时逐字：`PGOPTIONS='-c lock_timeout=3000 -c statement_timeout=30000 -c idle_in_transaction_session_timeout=60000'`；宪法 `.specify/memory/constitution.md:137-139` 要求 `prepare: false` 与连接串下发超时。实测结论：`drizzle-orm@0.45.4` 的 `DrizzleConfig`（`node_modules/.pnpm/drizzle-orm@0.45.4_*/node_modules/drizzle-orm/utils.d.ts:47-52`）**没有** `prepare` 字段，`driver.js:29-50` 的 `construct()` 忽略它；`pg@8.23.1` 的 `lib/connection-parameters.js:83` 读 `this.options = val('options', config)`。因此本计划用 `new Pool({ options: PG_OPTIONS })` 显式下发，删掉 `prepare: false`。
- SQLSTATE 与约束名：`23505` + `user_email_unique`、`23503`、`23001`、`23514`、`22P02`、`55P03`、`57014`、`fk_organization_owner`；自定义码 `GX005`–`GX010`。`23001` 与 `23503` 必须分开映射（`docs/architecture/stack.md:154`：合并会返回同一错误）。
- 租户谓词逐字：`= ANY (app.visible_org_array())`；带 SELECT 子查询会报 `42883 operator does not exist: uuid = uuid[]`。
- 错误码联合逐字：`"VALIDATION"|"UNAUTHORIZED"|"FORBIDDEN"|"NOT_FOUND"|"CONFLICT"|"RATE_LIMITED"|"INTERNAL"`（本计划追加 `"UNAVAILABLE"`）；`AppError` 签名为 `(code: ErrorCode, message: string, status: number, details?: Record<string, unknown>)`，全仓 43 处 `new AppError(` 调用点**不得改动签名**。
- Hono 官方逐字约束：`For RPC route inference, all methods must be chained and the endpoint type inferred from a declared variable. Export the resulting type as AppType.`（本计划不实现 RPC，属计划 3）；`the body is not parsed and the callback receives an empty object`（缺 `Content-Type: application/json`，**仅对 `zValidator` 成立**；实测 Bun 1.4.4 下本项目手写 `c.req.json().catch(() => null)` 仍能解析，详见 Review Focus #4）；4.x 的 `onError((error, c) => ...)` 正确，**不得**改成 v5 的 `(c, next)` 读 `c.error`。
- pnpm 官方：`pnpm install --frozen-lockfile`；设置不匹配报 `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`。
- 文档一致性实测：`sh scripts/check-docs.sh --root docs --strict` → `VIOLATIONS=478 WARN=0 exit=1`；加 `--baseline docs/.check-docs-baseline.txt` → `baseline known=477 fixed=0 new=0` / `VIOLATIONS=0 exit=0`。
- 复杂度预算（宪法 `:102-117`）：400 行是警报不是合并门禁；业务模块 ≤ 8；表 ≤ 30；基础设施 3（`compose.yaml:2` 两个容器 + 宿主机 app）。
- 失败要响亮（Article VIII）：禁 `catch { return null }`，按 SQLSTATE + 约束名两级映射；结构化日志 `logEvent(fields: LogFields): void` 输出 `console.log(JSON.stringify(fields))`。
- 测试命令统一带 `--env-file .env.test`；`.env.test` 由 `scripts/env.sh up test` 生成（本地若不存在，先跑 `scripts/env.sh up development && scripts/env.sh up test`）。真库测试依赖 `compose.yaml` 的 PG18 + MinIO 两个容器。
- 官方依据 URL：https://hono.dev/docs/concepts/stacks 、https://hono.dev/docs/guides/validation 、https://hono.dev/docs/guides/migrating-to-v5 、https://www.postgresql.org/docs/current/ddl-rowsecurity.html 、https://pnpm.io/cli/install 、https://www.better-auth.com/docs/integrations/hono 、https://orm.drizzle.team/docs/rls 、https://bun.com/docs/cli/test 。

## Review Focus

以下是 spec 隐含、当前测试**没有**覆盖的五类输入/失败模式。每条都指定了固定它的测试所在的 Task 与 Step，实现时不得跳过。写计划时已对每条做过一手实测（结论写在括注里），避免留下「恒真/恒假」的假测试。

1. **DB 抖动被误判成凭证错误并锁账号**：`apps/api/src/modules/auth/service.ts:143-151` 裸 `catch` 把任何异常变 401，`router.ts:66-70` 又计入登录失败；`tests/auth/login-rate-limit.test.ts` 只测 limiter 本身，`tests/auth/log-redaction.test.ts` 只测响应体。→ 固定在 **Task 2 Step 1**（`app.request("/api/v1/auth/sign-in")` + `spyOn(auth.api, "signInEmail")` 抛 `ECONNREFUSED` + `spyOn(loginRateLimiter, "recordFailure")`，断言修好后 `recordFailure` 调用 0 次）。实测当前链路：`status 401`、`recordFailure calls: 1`，因此该断言修前 FAIL、修后 PASS，是真测试。
2. **存储故障被伪装成 404 与日志泄漏**：`apps/api/src/storage.ts:182-190` 的 `catch { return undefined; }` 连 `s3()` 抛的 `storage not initialized` 都吞；`app.ts:86-94` 兜底不打日志，加日志后 stack 可能带密码/token，而现有 `log-redaction.test.ts` 不断言日志。→ 固定在 **Task 3 Step 1**（区分不存在/故障 + 日志字段脱敏断言）。
3. **media 的任意 key 读取、路径穿越、超大 body**：`apps/api/src/media.ts:70` 把 URL 余段直接当 S3 key，`:46` 先 `arrayBuffer()` 再查 1MB；现有 env 测试只走合法 key。→ 固定在 **Task 4 Step 1**（`..%2f` 穿越、非法 key、`content-length` 超限三条）。实测：`c.req.path` 保留 `%2f` 不解码；`app.request` 传入的 `content-length: "2000000"` 在 handler 内可读到。
4. **media 并入统一中间件链后的鉴权回归**：`app.ts` 的 `app.use(authMiddleware())` 是全局注册，media 从 `index.ts` 的外层 `new Hono()` 移入 `app` 后，必须仍能靠 capability token 独立鉴权，且错误信封与其余 API 一致。`tests/env/infrastructure.test.ts:65-75` 只覆盖 HTTP 真服务，没有 `app.request` 级回归。→ 固定在 **Task 4 Step 1**（无 token 返回 401；合法 token + 合法 key 返回 200/404 而非 500）。**实测订正**：Bun 1.4.4 下 Hono 的 `c.req.json()` 不检查 `Content-Type`（带/不带/带 `text/plain` 都解析成功），项目 `organization/router.ts:101` 是手写 `c.req.json().catch(() => null)` + `safeParse`，不是 `zValidator`，因此 Hono 官方「缺 Content-Type 则 body 不解析」的场景在本仓库不成立，本计划不为此写假测试；`zValidator` 与 Content-Type 门控属 `## Scope` 的计划 3。
5. **`SET LOCAL` 跨用户连接复用残留**：`apps/api/src/db/with-user.ts:15-35` 在池化连接上做 `SET LOCAL ROLE genealogy_app` / `set_config('app.user_id', …)`；全仓没有跨用户复用同一连接的测试。→ 固定在 **Task 5 Step 1**（两个不同 userId 顺序执行，逐用户断言 `app.current_user_id()` 等于各自传入值，而不是 `toBeTruthy()` 这种恒真断言）。
---

## File Structure

| 路径 | 角色 | 涉及 Task |
| --- | --- | --- |
| `packages/shared/src/errors.ts` | 修改：`ErrorCode` 追加 `UNAVAILABLE`、新增 `ERROR_STATUS` 表 | 1 |
| `packages/shared/src/index.ts` | 只读：`export * from "./errors"` 自动导出新符号 | 1 |
| `apps/api/src/lib/errors.ts` | 修改：拆分 23001/23503、加 22P02、GX 分支带 `sqlstate`、503 换码 | 1, 2 |
| `apps/api/test/error-mapping.test.ts` | 新建：纯单测 | 1 |
| `apps/api/src/modules/auth/service.ts` | 修改：`signIn()` 只把 4xx 凭证错误映射 401 | 2 |
| `apps/api/src/auth/provisioning.ts` | 修改：`provisionWithInvite()` 只捕 GX005/GX009/GX010 | 2 |
| `apps/api/src/modules/auth/router.ts` | 只读：`:66-70` 的 `error.code === "UNAUTHORIZED"` 判定式不改，故障链由 `service.ts` 与 `provisioning.ts` 收窄 | 2 |
| `apps/api/test/auth-failure-chain.test.ts` | 新建：故障注入单测 | 2 |
| `tests/auth/login-rate-limit.test.ts` | 只读：现有 limiter 单测保持原样，DB 故障断言由 `apps/api/test/auth-failure-chain.test.ts` 承担 | 2 |
| `apps/api/src/app.ts` | 修改：导出 `onApiError`/`probeDatabase`、兜底打日志、HTTPException 状态映射、Client 带 `options`、注册 media 路由 | 1, 3, 4, 5 |
| `apps/api/src/storage.ts` | 修改：`getObject()` 用 `file.exists()` 区分不存在/故障 | 3 |
| `apps/api/src/lib/logger.ts` | 修改：新增 `redact(text: string): string` | 3 |
| `apps/api/test/failure-loudness.test.ts` | 新建：日志与存储故障单测 | 3 |
| `apps/api/src/media.ts` | 修改：key 白名单、body 前置限流、token 改 `config()` | 4 |
| `apps/api/src/index.ts` | 修改：删掉外层 `new Hono()` 包装，`fetch: app.fetch` | 4 |
| `apps/api/test/media-boundary.test.ts` | 新建：key 白名单 / 超大 body / 鉴权链回归（`c.req.json()` 不检查 Content-Type，不写假测试） | 4 |
| `packages/db/src/client.ts` | 修改：导出 `PG_OPTIONS`，`createDb()` 注入 `options` | 5 |
| `packages/db/src/migrate.ts` | 修改：`new Client({ ..., options: PG_OPTIONS })` | 5 |
| `apps/api/test/connection-options.test.ts` | 新建：常量逐字断言 | 5 |
| `tests/env/connection-settings.test.ts` | 新建：真库 `SHOW` + 跨用户复用 | 5 |
| `docs/architecture/data/migrations.md` | 修改：`:162-174` 删 `prepare: false`、改 PGOPTIONS 说明 | 5 |
| `specs/002-user-auth-default-org/tasks.md` | 修改：`:41` `[X]` 订正并写明实测结论 | 5 |
| `.github/workflows/verify.yml` | 新建：CI 真门禁 | 6 |
| `.github/workflows/docs.yml` | 修改：`:3-4` 过期注释 | 6 |
| `package.json` | 修改：新增 `lint`、`test:all` | 6 |
| `docs/README.md` | 修改：`:12,55,57-65,69,97-121` 状态与白名单计数 | 6 |
| `.specify/memory/constitution.md` | 修改：`:125-127` `42883` 改「预期（待验证）」 | 6 |
| `tests/docs/check-ci-gates.test.sh` | 新建：CI 门禁自检 | 6 |
| `docs/superpowers/plans/2026-11-13-architecture-docs-refactor.md` | 只读：本仓库计划格式参照 | 全部 |

### Task 1: 错误码→状态码的单一真相源

**Files:**
- Modify: `packages/shared/src/errors.ts`, `apps/api/src/lib/errors.ts`, `apps/api/src/app.ts:75-83`
- Test: `apps/api/test/error-mapping.test.ts`
- Read-only: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: `export type ErrorCode`（`packages/shared/src/errors.ts:1`）、`export class AppError extends Error { constructor(readonly code: ErrorCode, message: string, readonly status: number, readonly details?: Record<string, unknown>) }`、`export function mapDatabaseError(error: unknown): AppError`（`apps/api/src/lib/errors.ts:22`）、`function asDatabaseError(error: unknown): DatabaseError | undefined`（沿 `cause` 最多 5 层）。
- Produces: `ErrorCode` 联合追加 `"UNAVAILABLE"`；`export const ERROR_STATUS: Record<ErrorCode, number>`（8 项）；`mapDatabaseError(error: unknown): AppError` 签名不变；其 GX005/GX009/GX010 分支的 `AppError` 带 `details: { sqlstate: dbError.code }`（Task 2 依赖此字段）；`app.ts` 的 HTTPException 分支按状态反查 `ERROR_STATUS`。所有 43 处 `new AppError(` 调用点签名不变。

- [ ] **Step 1: Write the failing test** — 新建 `apps/api/test/error-mapping.test.ts`，用 `{ code, constraint }` 伪对象直接调 `mapDatabaseError(error)`：

```ts
import { describe, expect, test } from "bun:test";
import { ERROR_STATUS } from "@yunpu/shared";
import { mapDatabaseError } from "../src/lib/errors";

test("ERROR_STATUS covers exactly eight codes", () => {
  expect(ERROR_STATUS.UNAVAILABLE).toBe(503);
  expect(Object.keys(ERROR_STATUS)).toHaveLength(8);
});

test("23001 and 23503 are distinct", () => {
  const restrict = mapDatabaseError({ code: "23001" });
  const fk = mapDatabaseError({ code: "23503" });
  expect(restrict.code).toBe("CONFLICT");
  expect(restrict.status).toBe(409);
  expect(restrict.message).not.toBe(fk.message);
});

test("named constraint still wins", () => {
  expect(mapDatabaseError({ code: "23503", constraint: "fk_organization_owner" }).message)
    .toBe("不能移除组织所有者");
});

test("22P02 is a validation error", () => {
  expect(mapDatabaseError({ code: "22P02" }).code).toBe("VALIDATION");
  expect(mapDatabaseError({ code: "22P02" }).status).toBe(400);
});

test("lock and cancellation timeouts are UNAVAILABLE 503", () => {
  for (const code of ["55P03", "57014"]) {
    const e = mapDatabaseError({ code });
    expect(e.code).toBe("UNAVAILABLE");
    expect(e.status).toBe(503);
  }
});

test("GX errors carry sqlstate for provisioning", () => {
  expect(mapDatabaseError({ code: "GX005" }).details?.sqlstate).toBe("GX005");
});

test("cause chain is unwrapped up to five levels", () => {
  expect(mapDatabaseError({ cause: { cause: { code: "23514" } } }).code).toBe("VALIDATION");
});

test("unknown code falls back to INTERNAL 500", () => {
  expect(mapDatabaseError({ code: "ZZZZZ" }).status).toBe(500);
});
```

- [ ] **Step 2: Run test to verify it fails**
  - Run: `bun test --env-file .env.test apps/api/test/error-mapping.test.ts`
  - Expected: FAIL — `export 'ERROR_STATUS' not found`；`23001` 与 `23503` 返回同一 `message`「记录仍被引用」；`22P02` 落到 default `INTERNAL`/500；GX 分支无 `details`。
- [ ] **Step 3: Implement `ERROR_STATUS` and the `mapDatabaseError` cases in `packages/shared/src/errors.ts` + `apps/api/src/lib/errors.ts` + `apps/api/src/app.ts:75-83`** — 在 `errors.ts` 追加 `ErrorCode` 成员 `"UNAVAILABLE"` 与 `export const ERROR_STATUS: Record<ErrorCode, number>`（逐字值 `VALIDATION:400, UNAUTHORIZED:401, FORBIDDEN:403, NOT_FOUND:404, CONFLICT:409, RATE_LIMITED:429, UNAVAILABLE:503, INTERNAL:500`）；`AppError` 构造签名保持原样。在 `lib/errors.ts` 把 `case "23503": case "23001":` 拆成两个 `case`（23001 保留「记录仍被引用」，23503 用「关联记录不存在或仍被引用」），补 `case "22P02":`，GX005/GX009/GX010 三个分支补 `details: { sqlstate: dbError.code }`，把 `:52-54` 的 `new AppError("INTERNAL", "系统繁忙，请重试", 503)` 改为 `"UNAVAILABLE"`；`app.ts:75-83` 用 `Object.entries(ERROR_STATUS).find(([, s]) => s === status)?.[0] ?? "INTERNAL"` 取代硬编码 `code:"VALIDATION"`。
- [ ] **Step 4: Run test to verify it passes**
  - Run: `bun test --env-file .env.test apps/api/test/error-mapping.test.ts apps/api/test tests/auth/log-redaction.test.ts`
  - Expected: PASS（8 tests + 既有 `apps/api/test/` 全部 + `log-redaction`）；无 `TypeError: AppError is not a constructor`。
- [ ] **Step 5: Commit**
  - Run: `git add packages/shared/src/errors.ts apps/api/src/lib/errors.ts apps/api/src/app.ts apps/api/test/error-mapping.test.ts && git commit -m "fix(api): make error code the single source of HTTP status"`
  - Expected: `git status --short` 干净。

### Task 2: 认证与邀请的失败链不再吞异常

**Files:**
- Modify: `apps/api/src/modules/auth/service.ts:143-151`, `apps/api/src/auth/provisioning.ts:35-45`
- Test: `apps/api/test/auth-failure-chain.test.ts`
- Read-only: `apps/api/src/modules/auth/router.ts:66-70`（判定式无需改动）、`apps/api/src/middleware/login-rate-limit.ts:75`（模块单例 `loginRateLimiter`）、`apps/api/src/modules/auth/service.ts:44-57`（`mapSignUpError` 是同源的 4xx 判定）、`tests/auth/login-rate-limit.test.ts`

**Interfaces:**
- Consumes: `ERROR_STATUS`（Task 1）、`mapDatabaseError` 的 GX 分支现在带 `details.sqlstate`（Task 1）、`export async function signIn(input: SignInInput, requestId?: string): Promise<AuthResponse>`（`service.ts:138`，`SignInInput = { email: string; password: string }`）、`export async function provisionWithInvite(userId: string, email: string, token: string): Promise<InviteOutcome>`（`provisioning.ts:27`）、`export type InviteOutcome = { organization: OrganizationSummary; accepted: boolean; reason?: "email_mismatch"|"expired"|"revoked"|"already_used" }`、`export const loginRateLimiter = createLoginRateLimiter()`。
- Produces: 上述函数签名全部不变；`signIn` 的 catch 沿用 `mapSignUpError` 的同源判定（读 `error.statusCode ?? error.status`，只有 400/401/422 才映射 `AppError("UNAUTHORIZED", "邮箱或密码错误", 401)`，其余 `throw error`），**不 import `better-auth/api` 的 `APIError`**（构造签名未验证，且从仓库根解析会报 `Cannot find module 'better-auth/api'`）；`provisionWithInvite` 的 catch 只接受 `error instanceof AppError && ["GX005","GX009","GX010"].includes(String(error.details?.sqlstate))`，其余 `throw error`；`router.ts:66-70` **不改**判定式，DB 故障现在以 `INTERNAL`/`UNAVAILABLE` 到达，因此不再被 `error.code === "UNAUTHORIZED"` 误计。

- [ ] **Step 1: Write the failing test** — 新建 `apps/api/test/auth-failure-chain.test.ts`。三条断言都经一手实测：当前 `signIn` 把 `ECONNREFUSED` 吞成 401、`provisionWithInvite` 对非白名单 `AppError` 仍走 `provisionDefaultOrganization`、完整 sign-in 链路会误调 `recordFailure` 一次。

```ts
import { expect, spyOn, test } from "bun:test";
import { auth } from "../src/auth";
import { AppError } from "../src/lib/errors";
import { loginRateLimiter } from "../src/middleware/login-rate-limit";
import * as orgService from "../src/modules/organization/service";
import { signIn } from "../src/modules/auth/service";
import { provisionWithInvite } from "../src/auth/provisioning";
import app from "../src/app";


test("db outage is rethrown, not disguised as 401", async () => {
  const spy = spyOn(auth.api, "signInEmail").mockRejectedValue(new Error("ECONNREFUSED"));
  try {
    await expect(signIn({ email: "a@example.com", password: "secret123" }))
      .rejects.toThrow("ECONNREFUSED");
  } finally { spy.mockRestore(); }
});

test("credential 4xx is still a 401", async () => {
  const spy = spyOn(auth.api, "signInEmail")
    .mockRejectedValue({ statusCode: 401, message: "invalid password" });
  try {
    await expect(signIn({ email: "a@example.com", password: "bad" }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 });
  } finally { spy.mockRestore(); }
});

test("invite provisioning only absorbs known GX sqlstates", async () => {
  const accept = spyOn(orgService, "acceptInvite")
    .mockRejectedValue(new AppError("UNAVAILABLE", "db down", 503));
  const create = spyOn(orgService, "createOrganization")
    .mockRejectedValue(new Error("NO_DB_IN_TEST"));
  try {
    await expect(provisionWithInvite("u1", "a@example.com", "tok"))
      .rejects.toMatchObject({ code: "UNAVAILABLE" });
    expect(create.mock.calls).toHaveLength(0);
  } finally { accept.mockRestore(); create.mockRestore(); }
});

test("a database failure is not counted as a login failure", async () => {
  const rec = spyOn(loginRateLimiter, "recordFailure");
  const spy = spyOn(auth.api, "signInEmail").mockRejectedValue(new Error("ECONNREFUSED"));
  try {
    const r = await app.request("/api/v1/auth/sign-in", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "a@example.com", password: "secret123" }),
    });
    expect(r.status).not.toBe(401);
    expect(rec.mock.calls).toHaveLength(0);
  } finally { rec.mockRestore(); spy.mockRestore(); }
});
```

`spyOn` 对 ESM namespace 生效已实测：`spyOn(orgService, "acceptInvite")` 能改变 `provisionWithInvite` 内部调用结果；`spyOn(loginRateLimiter, "recordFailure")` 能计数到 router 的调用。不要改成 `mock.module`。

- [ ] **Step 2: Run test to verify it fails**
  - Run: `bun test --env-file .env.test apps/api/test/auth-failure-chain.test.ts`
  - Expected: FAIL — 第 1 条得到 `AppError: 邮箱或密码错误`（401）而非 `ECONNREFUSED`；第 3 条得到 `Error: NO_DB_IN_TEST` 且 `createOrganization` 被调用 1 次；第 4 条 `status 401` 且 `recordFailure calls: 1`。第 2 条当前即 PASS（保留作回归）。
- [ ] **Step 3: Implement the narrowed catches in `apps/api/src/modules/auth/service.ts:143-151` + `apps/api/src/auth/provisioning.ts:35-45`** — `signIn` 的 `catch (error)` 里先 `logEvent({ event: "auth.signed_in", request_id: requestId, result: "failed", reason: error instanceof Error ? error.message : "unknown" })`，再用与 `mapSignUpError(service.ts:44-57)` 相同的 `Number(record?.statusCode ?? record?.status)` 判定：仅 400/401/422 时 `throw new AppError("UNAUTHORIZED", "邮箱或密码错误", 401)`，否则 `throw error`。`provisionWithInvite` 的 catch 按 `error.details?.sqlstate` 三分（GX009→`email_mismatch`、GX010→`already_used`、GX005→`expired`），删掉兜底的 `provisionDefaultOrganization` 调用，非白名单 `throw error`。`router.ts:66-70` 不改动。
- [ ] **Step 4: Run test to verify it passes**
  - Run: `bun test --env-file .env.test apps/api/test/auth-failure-chain.test.ts && bun test --env-file .env.test --max-concurrency=1 tests/auth/ tests/auth/login-rate-limit.test.ts`
  - Expected: 两条命令全 PASS；`registration.test.ts:60-75` 的补偿、`invite-acceptance.test.ts:143-171` 的并发 `[200,409]` 不受影响。
- [ ] **Step 5: Commit**
  - Run: `git add apps/api/src/modules/auth/service.ts apps/api/src/auth/provisioning.ts apps/api/test/auth-failure-chain.test.ts && git commit -m "fix(auth): stop swallowing database failures as 401"`
  - Expected: `git status --short` 干净。
### Task 3: 全局失败响亮（onError / probeDatabase / getObject）

**Files:**
- Modify: `apps/api/src/app.ts:30-51,58-95`, `apps/api/src/storage.ts:182-190`, `apps/api/src/lib/logger.ts`
- Test: `apps/api/test/failure-loudness.test.ts`
- Read-only: `tests/env/dev-surface.test.ts`

**Interfaces:**
- Consumes: `logEvent(fields: LogFields): void`（`console.log(JSON.stringify(fields))`）、`export function s3(): import("bun").S3Client`（未初始化抛 `storage not initialized`）、`Bun.S3File.prototype.exists()`（已实测存在于 S3File 原型）、`mapDatabaseError`（Task 1）、`config(): AppEnv`（`apps/api/src/config.ts:3-8`，模块级 `cached`）。
- Produces: `export function onApiError(error: unknown, c: Context<ApiEnv>): Response`（把 `app.ts:58-95` 的内联 handler 具名导出，供 `app.onError(onApiError)` 与测试共用）；`export async function probeDatabase(): Promise<{ up: boolean; version?: string }>`（把 `:30-51` 私有函数导出）；`export function redact(text: string): string`（`logger.ts` 新增，≤ 8 行）；`getObject(key: string): Promise<Uint8Array | undefined>` 签名不变。`onApiError` 兜底分支先 `logEvent({ event: "unhandled_error", request_id: c.get("requestId"), reason, stack })`（reason/stack 过 `redact`）再返回 `mapDatabaseError(error)`；`probeDatabase()` 改用 `config().DATABASE_URL`、`new Client({ ..., options: PG_OPTIONS })`（Task 5 常量）、catch 里 `logEvent`、`client?.end().catch(...)` 改为 `logEvent` 记录；`getObject` 用 `if (!(await file.exists())) return undefined;` 前置判断，其余异常原样抛出。

- [ ] **Step 1: Write the failing test** — 新建 `apps/api/test/failure-loudness.test.ts`。裸 `new Hono()` 没有 `requestId()` 中间件，`c.get("requestId")` 实测返回 `null`，因此测试必须自己 `probe.use(requestId())` 才能断言 `request_id`；否则该断言恒 FAIL。

```ts
import { expect, spyOn, test } from "bun:test";
import { Hono } from "hono";
import { requestId } from "hono/request-id";
import { getObject } from "../src/storage";
import { onApiError, probeDatabase } from "../src/app";

test("uninitialised storage throws instead of returning undefined", async () => {
  await expect(getObject("media/x/y")).rejects.toThrow("storage not initialized");
});

test("unhandled errors are logged with request_id and no secrets", async () => {
  const lines: string[] = [];
  const spy = spyOn(console, "log").mockImplementation((line?: unknown) => {
    lines.push(String(line));
  });
  const probe = new Hono();
  probe.use(requestId());
  probe.onError(onApiError);
  probe.get("/boom", () => { throw new Error("password=hunter2 token=abc"); });
  try {
    await probe.request("/boom");
    const log = lines.map((l) => { try { return JSON.parse(l); } catch { return {}; } })
      .find((f) => f.event === "unhandled_error");
    expect(log).toBeDefined();
    expect(log.request_id).toBeTruthy();
    expect(JSON.stringify(log)).not.toContain("hunter2");
    expect(JSON.stringify(log)).not.toContain("token=abc");
  } finally { spy.mockRestore(); }
});

test("probeDatabase uses config(), not a bare process.env read", async () => {
  const saved = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "";
  try {
    const result = await probeDatabase();
    expect(result.up).toBe(true);
  } finally {
    process.env.DATABASE_URL = saved;
  }
});
```

- [ ] **Step 2: Run test to verify it fails**
  - Run: `bun test --env-file .env.test apps/api/test/failure-loudness.test.ts`
  - Expected: FAIL — `getObject` 返回 `undefined`；`export 'onApiError' not found` / `export 'probeDatabase' not found`；兜底无任何日志；空 `process.env.DATABASE_URL` 下 `probeDatabase()` 返回 `up:false`。`config()` 的 `cached` 在 `apps/api/src/auth/index.ts:7` 模块加载时已由 `.env.test` 填充，所以改坏 `process.env` 不影响它 —— 这条正是「双真相源」的判别式。
- [ ] **Step 3: Implement `onApiError`, `probeDatabase`, `redact`, and the `getObject` guard** — 把 `app.ts:58-95` 的箭头函数抽成 `export function onApiError(error: unknown, c: Context<ApiEnv>): Response` 并 `app.onError(onApiError)`；把 `:30-51` 的 `probeDatabase` 加 `export` 并改用 `config().DATABASE_URL`（**本 Task 不加 `options`，留给 Task 5**）；`logger.ts` 加 `redact(text)` 用正则替换 `password|token|secret|authorization` 后跟的 `=`/`:` 与其值；`storage.ts:182-190` 改为 `const file = s3().file(key); if (!(await file.exists())) return undefined; return new Uint8Array(await file.arrayBuffer());`，删掉 `catch { return undefined; }` —— `s3()` 抛的 `storage not initialized` 与 `file.exists()` 的网络故障现在都会冒泡到 `onApiError`。
- [ ] **Step 4: Run test to verify it passes**
  - Run: `bun test --env-file .env.test apps/api/test/failure-loudness.test.ts tests/env/dev-surface.test.ts tests/env/infrastructure.test.ts apps/api/test/organization-router.test.ts`
  - Expected: 全 PASS；`/api/ready` 的 `PostgreSQL 18` 判定、`tests/env/infrastructure.test.ts:47-62` 的 MinIO 匿名读非 200 断言不变。注意 `tests/env/infrastructure.test.ts` 走的是已启动服务的 HTTP，不受本文件 `app.request` 影响。
- [ ] **Step 5: Commit**
  - Run: `git add apps/api/src/app.ts apps/api/src/storage.ts apps/api/src/lib/logger.ts apps/api/test/failure-loudness.test.ts && git commit -m "fix(api): log unhandled errors and stop swallowing storage failures"`
  - Expected: `git status --short` 干净。
### Task 4: media 并入唯一 Hono 装配点并收紧输入边界

**Files:**
- Modify: `apps/api/src/index.ts:16-23`, `apps/api/src/app.ts:167-171`, `apps/api/src/media.ts`
- Test: `apps/api/test/media-boundary.test.ts`
- Read-only: `tests/env/infrastructure.test.ts`, `tests/env/lifecycle.test.ts`, `apps/api/test/organization-router.test.ts`, `tests/auth/fixtures.ts`

**Interfaces:**
- Consumes: `media`（`apps/api/src/media.ts:82` default export，`Hono`）、`function authorized(request: Request): boolean`（`:9-28`，静态 Bearer 比 `YUNPU_CAPABILITY_TOKEN`）、`function randomKey(): string`（`:34-39`，产出 `media/<8 位日期>T<4 位时分>/<32 位 hex>`）、`maxBodyBytes = 1024*1024`、`getObject(key)`（Task 3）、`putObject(key, body)`、`config(): AppEnv`、`onApiError`（Task 3）。
- Produces: `export const MEDIA_KEY_PATTERN = /^media\/[0-9]{8}T[0-9]{4}\/[0-9a-f]{32}$/`、`export function isAllowedMediaKey(key: string): boolean`（均在 `media.ts`）；`app.ts` 路由区追加 `app.route("/", media)`（thus 经过 `requestId → secureHeaders → compress → authMiddleware → onError`）；`index.ts:16-23` 删掉 `const routes = new Hono()` 包装，改为 `export default { port: env.PORT, fetch: app.fetch };`；`authorized()` 改读 `config().YUNPU_CAPABILITY_TOKEN`；POST 在 `arrayBuffer()` 之前用 `content-length` 头预检 1MB；GET 对 `MEDIA_KEY_PATTERN` 不匹配返回 `AppError("VALIDATION", ..., 400)`；`GET` 的 404 语义保持不变（`getObject` 返回 `undefined` 时）。

- [ ] **Step 1: Write the failing test** — 新建 `apps/api/test/media-boundary.test.ts`（Review Focus #3 + #4）。合法 token 取 `config().YUNPU_CAPABILITY_TOKEN`。**实测前提**：`app.request("/api/media/..%2f..%2fsecret")` 的 `c.req.path` 保留 `%2f` 不解码；`app.request` 传入的 `content-length: "2000000"` 在 handler 内可读到；`signUp(email)` 必须传 email（`tests/auth/fixtures.ts:32-35`），从 `apps/api/test/` 到 `tests/` 的相对路径是 `../../../tests/auth/fixtures`。

```ts
import { expect, spyOn, test } from "bun:test";
import app from "../src/app";
import { config } from "../src/config";
import { isAllowedMediaKey } from "../src/media";
import * as storage from "../src/storage";

const bearer = { authorization: `Bearer ${config().YUNPU_CAPABILITY_TOKEN}` };
const validKey = "media/20261115T1023/" + "a".repeat(32);

test("only randomKey-shaped keys are accepted", () => {
  expect(isAllowedMediaKey(validKey)).toBe(true);
  for (const bad of ["../etc/passwd", "media/../../secret", "media/x/y",
                     "media/20261115T1023/" + "A".repeat(32), "..%2f..%2fsecret"]) {
    expect(isAllowedMediaKey(bad)).toBe(false);
  }
});

test("path traversal never reaches storage", async () => {
  const r = await app.request("/api/media/..%2f..%2fsecret", { headers: bearer });
  expect(r.status).toBe(400);
});

test("oversize content-length is rejected before arrayBuffer", async () => {
  const r = await app.request("/api/media", {
    method: "POST",
    headers: { ...bearer, "content-length": "2000000" },
    body: "x",
  });
  expect(r.status).toBe(413);
});

test("media capability-token auth survives the shared middleware chain", async () => {
  // Task 3 之后 getObject 在 storage 未初始化时会抛 storage not initialized；
  // app.request 单测不走 index.ts 的 initStorage，故注入 getObject 只验证路由/鉴权边界。
  const spy = spyOn(storage, "getObject").mockResolvedValue(undefined);
  try {
    const noToken = await app.request("/api/media/" + validKey);
    expect(noToken.status).toBe(401);
    const withToken = await app.request("/api/media/" + validKey, { headers: bearer });
    expect(withToken.status).toBe(404);
    expect((await withToken.json() as { reason?: string }).reason).toBe("object not found");
  } finally { spy.mockRestore(); }
});
```

- [ ] **Step 2: Run test to verify it fails**
  - Run: `bun test --env-file .env.test apps/api/test/media-boundary.test.ts`
  - Expected: FAIL — `export 'isAllowedMediaKey' not found`（整份文件在 import 阶段即失败，符合 TDD 红灯）。`spyOn(storage, "getObject")` 对 Bun 的 ESM live binding 已实测生效（`mockResolvedValue(new Uint8Array([65,66,67]))` 时 GET 返回 `200 "ABC"`）；media 当前挂在 `index.ts` 外层 Hono 上，`app.request` 会落到 `app.notFound()` 的 404 且响应体是 `message:"接口不存在"` 而非 `reason:"object not found"`。
- [ ] **Step 3: Implement `MEDIA_KEY_PATTERN`, `isAllowedMediaKey`, the mount, and the body precheck** — `media.ts` 导出常量与函数，GET 的 `:70` 之后先 `if (!isAllowedMediaKey(key)) throw new AppError("VALIDATION", "非法的对象键", 400)`，POST 的 `:41-56` 在 `arrayBuffer()` 前用 `Number(c.req.header("content-length") ?? 0) > maxBodyBytes` 返回 413；`authorized()` 用 `config().YUNPU_CAPABILITY_TOKEN`；`app.ts` 路由区追加 `app.route("/", media)`；`index.ts` 删除 `routes` 包装并把 `fetch` 指向 `app.fetch`。`app.use(authMiddleware())` 是全局注册，media 并入后会先走 `auth.api.getSession`（DB 查询），这是预期行为变化，测试用 `.env.test` 已起的真库覆盖；`authorized()` 仍独立要求 capability token，不因 session 存在而放行。
- [ ] **Step 4: Run test to verify it passes**
  - Run: `bun test --env-file .env.test apps/api/test/media-boundary.test.ts && bun test --env-file .env.test tests/env/infrastructure.test.ts tests/env/lifecycle.test.ts`
  - Expected: 两条命令全 PASS。`tests/env/infrastructure.test.ts:47-62` 依赖 `POST /api/media` 写对象再匿名读 MinIO 断言非 200；`:65-75` 断言 dev token 在 test 环境 401、无 token 401；`tests/env/lifecycle.test.ts:94-161` 断言 201/200/404 与 `prefix=media/` 计数 —— **media 路由不可删**，这三条必须仍通过。
- [ ] **Step 5: Commit**
  - Run: `git add apps/api/src/index.ts apps/api/src/app.ts apps/api/src/media.ts apps/api/test/media-boundary.test.ts && git commit -m "fix(api): mount media behind the shared middleware chain and validate keys"`
  - Expected: `git status --short` 干净。
### Task 5: 三个超时由单一常量显式下发，并订正文档谎言

**Files:**
- Modify: `packages/db/src/client.ts:5-14`, `packages/db/src/migrate.ts:41`, `apps/api/src/app.ts:38-42`, `docs/architecture/data/migrations.md:162-174`, `specs/002-user-auth-default-org/tasks.md:41`
- Test: `apps/api/test/connection-options.test.ts`, `tests/env/connection-settings.test.ts`
- Read-only: `packages/db/src/index.ts`（`export * from "./client"` 自动导出新常量）、`docs/verification/README.md:9`

**Interfaces:**
- Consumes: `export function createDb(connectionString: string): { pool: Pool; db: Database }`（`client.ts:5-14`）、`const client = new Client({ connectionString })`（`migrate.ts:41`）、`new Client({ connectionString, connectionTimeoutMillis: 5000, query_timeout: 5000 })`（`app.ts:38-42`）、`export async function withUser<T>(userId: string, fn: (db: TxDatabase) => Promise<T>): Promise<T>`（`with-user.ts:11`）、`export const businessPool`。
- Produces: `export const PG_OPTIONS = "-c lock_timeout=3000 -c statement_timeout=30000 -c idle_in_transaction_session_timeout=60000"`（在 `packages/db/src/client.ts`，逐字值，经 `packages/db/src/index.ts` 自动对 `@yunpu/db` 可见）；`createDb()` 改为 `new Pool({ connectionString, max: 10, connectionTimeoutMillis: 5000, options: PG_OPTIONS })`；两处 `new Client` 各加 `options: PG_OPTIONS`（从 `@yunpu/db` import，值只有一份）。`scripts/env.sh` **不改**（`:243-244` 的 `env -i` 不继承外部变量，显式 `options` 才是可靠执行者；PGOPTIONS 环境变量只作为文档历史说明保留）。

- [ ] **Step 1: Write the failing test** — 新建两个测试文件（Review Focus #5）。**实测前提**：`tests/env/` 目录**无法**解析 `@yunpu/db` 与 `drizzle-orm`（报 `Cannot find module '@yunpu/db' from '/home/bobo/project/yunpu/tests/env/[eval]'`），但可解析 `pg`、`../../packages/db/src/client.ts`、`../../apps/api/src/db/with-user.ts`、`../../apps/api/src/config.ts`；`pg` 的 `Client.query("SHOW lock_timeout")` 返回 `{ rows: [{ lock_timeout: "0" }] }`，`String(rows[0])` 是 `[object Object]`，所以必须读 `Object.values(rows[0])[0]`；给 `Client` 传 `options: "-c lock_timeout=3000 …"` 后实测三行分别是 `3s` / `30s` / `1min`。

```ts
// apps/api/test/connection-options.test.ts
import { expect, test } from "bun:test";
import { PG_OPTIONS } from "@yunpu/db";

test("PG_OPTIONS carries the three mandated timeouts verbatim", () => {
  expect(PG_OPTIONS).toBe(
    "-c lock_timeout=3000 -c statement_timeout=30000 -c idle_in_transaction_session_timeout=60000",
  );
});
```

```ts
// tests/env/connection-settings.test.ts
import { expect, test, afterAll } from "bun:test";
import { Client } from "pg";
import { createDb, PG_OPTIONS } from "../../packages/db/src/client";
import { withUser, businessPool } from "../../apps/api/src/db/with-user";
import { config } from "../../apps/api/src/config";

afterAll(async () => { await businessPool.end(); });

test("every connection created by createDb has the three server-side timeouts", async () => {
  const { db, pool } = createDb(config().DATABASE_URL);
  try {
    for (const [q, want] of [
      ["SHOW lock_timeout", "3s"],
      ["SHOW statement_timeout", "30s"],
      ["SHOW idle_in_transaction_session_timeout", "1min"],
    ] as const) {
      const r = await db.execute(q);
      expect(Object.values(r.rows[0] as Record<string, string>)[0]).toBe(want);
    }
  } finally { await pool.end(); }
});

test("a bare Client without PG_OPTIONS has no lock timeout (control)", async () => {
  const client = new Client({ connectionString: config().DATABASE_URL });
  await client.connect();
  try {
    const r = await client.query("SHOW lock_timeout");
    expect(Object.values(r.rows[0] as Record<string, string>)[0]).toBe("0");
  } finally { await client.end(); }
});

test("SET LOCAL does not leak across pooled users", async () => {
  const u1 = "00000000-0000-0000-0000-000000000001";
  const u2 = "00000000-0000-0000-0000-000000000002";
  const read = (id: string) =>
    withUser(id, async (db) =>
      (await db.execute("select app.current_user_id() as uid")).rows[0] as { uid: string });
  expect((await read(u1)).uid).toBe(u1);
  expect((await read(u2)).uid).toBe(u2);
  expect((await read(u1)).uid).toBe(u1);
  // businessPool.options 是 pg Pool 的配置对象，字符串在 .options.options。
  expect((businessPool.options as { options?: string }).options).toBe(PG_OPTIONS);
});
```

- [ ] **Step 2: Run test to verify it fails**
  - Run: `bun test --env-file .env.test apps/api/test/connection-options.test.ts tests/env/connection-settings.test.ts`
  - Expected: FAIL — `export 'PG_OPTIONS' not found`；`SHOW lock_timeout` 返回 `0`（实测）；`(businessPool.options as any).options.options` 为 `undefined`（实测 `businessPool.options` 是含 `connectionString/max/...` 的配置对象，别把它当字符串比）。`SET LOCAL` 三条断言当前即 PASS（保留作回归，避免 `SET LOCAL` 实现被后续改动破坏）。
- [ ] **Step 3: Implement `PG_OPTIONS` in `packages/db/src/client.ts` and inject it into all three connection sites** — `createDb()` 的 `new Pool` 加 `options: PG_OPTIONS`；`migrate.ts:41` 与 `app.ts:38-42` 的 `new Client` 各加 `options: PG_OPTIONS`（`app.ts` 已从 Task 3 改用 `config().DATABASE_URL`）。随后订正文档：`docs/architecture/data/migrations.md:162-167` 的 `drizzle(pool, { schema, prepare: false, // ← 必须 })` 改成 `new Pool({ connectionString, options: PG_OPTIONS })`；`:169` 的「`prepare: false` 是硬要求」改成实测结论（DrizzleConfig 无此字段，`driver.js` 忽略它）；`:170-174` 说明超时由 `pg` 的 `options` 字段下发而非环境变量；`specs/002-user-auth-default-org/tasks.md:41` 的 `- [X] T006 ... 两者设 prepare: false 并由连接串下发 PGOPTIONS` 改为 `- [ ]` 并附一行「实测：见 `packages/db/src/client.ts:PG_OPTIONS`；`prepare` 非有效配置项」。
- [ ] **Step 4: Run test to verify it passes**
  - Run: `bun test --env-file .env.test apps/api/test/connection-options.test.ts tests/env/connection-settings.test.ts && sh scripts/check-docs.sh --root docs --strict --baseline docs/.check-docs-baseline.txt`
  - Expected: `bun test` 全 PASS；文档命令 `baseline known=477 fixed=0 new=0` / `VIOLATIONS=0` / `exit=0`（文档改动不得新增编号违规）。
- [ ] **Step 5: Commit**
  - Run: `git add packages/db/src/client.ts packages/db/src/migrate.ts apps/api/src/app.ts apps/api/test/connection-options.test.ts tests/env/connection-settings.test.ts docs/architecture/data/migrations.md specs/002-user-auth-default-org/tasks.md && git commit -m "fix(db): enforce the three timeouts via one explicit pg option"`
  - Expected: `git status --short` 干净。
### Task 6: 给规则装上执行者（CI 真门禁）

**Files:**
- Create: `.github/workflows/verify.yml`, `tests/docs/check-ci-gates.test.sh`
- Modify: `.github/workflows/docs.yml:3-4`, `package.json:3-15`, `docs/README.md:12,55,57-65,69,97-121`, `.specify/memory/constitution.md:125-127`
- Read-only: `scripts/env.sh:271-297`（`perform_up()` 顺序）、`compose.yaml`、`tests/console/*.test.ts`（10 个文件，当前根 `package.json:6` 的 `test` 不含它们）

**Interfaces:**
- Consumes: `.github/workflows/docs.yml` 的 4 个 steps（`sh -n scripts/check-docs.sh`、`sh tests/docs/check-docs.test.sh`、`sh tests/docs/check-docs-review.test.sh`、`scripts/check-docs.sh --root docs --strict --baseline docs/.check-docs-baseline.txt`）；根 `package.json:3-15` 现有 6 个 scripts；`scripts/env.sh up development` / `up test`（`perform_up()` 依次 `compose_up → wait_containers_healthy → bootstrap_db_roles → run_migrations → start_app → poll_ready`）。
- Produces: `package.json` 新增 `"lint": "pnpm --filter nocoapp-dev lint"`（web 现有 `tsc --noEmit`）、`"test:all": "bun test --env-file .env.test tests/env && bun test --env-file .env.test --max-concurrency=1 tests/auth tests/console apps/api/test"`；`.github/workflows/verify.yml` 单 job `verify`，steps 顺序固定：`actions/checkout@v4` → `pnpm/action-setup@v4`（读 `packageManager: pnpm@12.18.0`）→ `actions/setup-node@v4`（node 24）→ `oven-sh/setup-bun@v2`（`bun-version: 1.4.4`）→ `pnpm install --frozen-lockfile` → `pnpm lint` → `scripts/env.sh up development` → `scripts/env.sh up test` → `pnpm test:all` → 文档校验 4 步 → `wc -l docs/.check-docs-baseline.txt`（把 477 这个数字显式打到日志，不隐瞒）。

- [ ] **Step 1: Write the failing test** — 新建 `tests/docs/check-ci-gates.test.sh`（POSIX sh，与 `tests/docs/check-docs.test.sh` 同风格）：

```sh
#!/bin/sh
set -eu
workflow=.github/workflows/verify.yml
[ -f "$workflow" ] || { echo "missing $workflow" >&2; exit 1; }
for needle in \
  '--frozen-lockfile' 'pnpm lint' 'scripts/env.sh up development' \
  'scripts/env.sh up test' 'pnpm test:all' 'check-docs.sh --root docs --strict' \
  'wc -l docs/.check-docs-baseline.txt' ; do
  grep -Fq "$needle" "$workflow" || { echo "missing step: $needle" >&2; exit 1; }
done
for needle in '"lint"' '"test:all"' 'tests/console' ; do
  grep -Fq "$needle" package.json || { echo "missing script: $needle" >&2; exit 1; }
done
echo "ci gates ok"
```

- [ ] **Step 2: Run test to verify it fails**
  - Run: `sh tests/docs/check-ci-gates.test.sh`
  - Expected: FAIL — `missing .github/workflows/verify.yml`。
- [ ] **Step 3: Implement `verify.yml`, the two scripts, and the four status corrections** — 新建 `.github/workflows/verify.yml`（按 Produces 顺序）；`package.json` 加两个 scripts；`.github/workflows/docs.yml:3-4` 的「本仓库尚无源码与构建产物，docs 即交付物」改为「本工作流只守护文档事实来源；构建与测试见 verify.yml」；`docs/README.md:12,55,57-65` 的「specs 不存在」改为现状，`:69,97-121` 的「两次门禁全 ✅ / 全为 0」改为「`--strict` 无基线 478 条违规、带 477 行基线 0 新增」；`.specify/memory/constitution.md:125-127` 的 `42883`「实测报」改为「预期（待验证）」，与 `docs/verification/README.md:9` 一致。
- [ ] **Step 4: Run test to verify it passes**
  - Run: `sh tests/docs/check-ci-gates.test.sh && sh scripts/check-docs.sh --root docs --strict --baseline docs/.check-docs-baseline.txt && pnpm lint && pnpm install --frozen-lockfile && scripts/env.sh up development && scripts/env.sh up test && pnpm test:all`
  - Expected: 逐条 `exit=0`；`pnpm lint` 无类型错误；`tests/console` 的 10 个文件首次进入默认测试集合且全 PASS；日志里能看到 `PostgreSQL 18` 与 `objectCount()` 断言。若 `scripts/env.sh:265` 的 `docker compose ... up -d --wait >/dev/null 2>&1` 吞掉诊断导致失败难查，把该行的 stderr 保留到日志（属于 Article VIII，不改语义）。
- [ ] **Step 5: Commit**
  - Run: `git add .github/workflows/verify.yml .github/workflows/docs.yml package.json docs/README.md .specify/memory/constitution.md tests/docs/check-ci-gates.test.sh && git commit -m "ci: run the real test suite and lint behind frozen lockfile"`
  - Expected: `git status --short` 干净；`git log -1 --oneline` 显示该提交。

## Self-Review

写计划时已按五项自检过，执行者复核时不必重做：

1. **Spec coverage**：六条 P0 中本计划覆盖 P0-1（CI 部分）、P0-2、P0-4、P0-5；P0-3/P0-6 与 P1 全部在 `## Scope` 的四表拆分里显式归属后续计划，没有静默丢弃。P1-3（23001/23503）与 P1-13（code→status）顺带落在 Task 1。
2. **Step scan**：六个 Task 各五步，严格「写失败测试 → 跑失败 → 实现 → 跑通过 → commit」，每步一个动作、有 `Run:` 与 `Expected:`，测试步骤含断言代码与 spec 的精确值，实现步骤只给签名与做法、不贴函数体。
3. **Type consistency**：`AppError`、`mapDatabaseError`、`signIn`、`provisionWithInvite`、`getObject`、`createDb`、`withUser`、`onApiError`、`probeDatabase` 全部按源码逐字抄录；新增符号只有 `ERROR_STATUS`、`UNAVAILABLE`、`PG_OPTIONS`、`MEDIA_KEY_PATTERN`、`isAllowedMediaKey`、`redact`、`onApiError` 导出、`probeDatabase` 导出、`lint`/`test:all` scripts。Task 1 的 `details.sqlstate` 与 Task 2 的消费点、Task 3 的 `onApiError`/`probeDatabase` 与 Task 4/5 的消费点均已对齐。
4. **Review Focus**：五条各指向 Task 2/3/4/5 的 Step 1；#1–#4 以失败测试开始，#5 的跨用户 `uid` 断言当前即 PASS、作为回归保留，Task 5 的红灯由 `PG_OPTIONS` 导出与 `SHOW` 值承担。所有断言都经过一手运行时探针，恒真/恒假的假测试已剔除（`tests/auth/login-rate-limit.test.ts` 的空 limiter 断言、`String(r.rows[0])`、裸 Hono 上取 `requestId`、官方 Content-Type 场景、`businessPool.options` 当字符串比）。
5. **Proportion**：spec 是 303 行评审报告，本计划不复制任何实现体、只在测试步骤贴必要的断言代码；六个 Task 合计 6 个新测试文件、约 16 个修改文件，比例合理。

## Execution Handoff

计划已保存到 `docs/superpowers/plans/2026-11-15-architecture-review-p0-remediation.md`。**请先审阅，再选执行方式；未选定前不要开始改代码。**

1. **Subagent-Driven（推荐）** — 每个 Task 派一个独立子代理，主代理在 Task 之间做交叉复核与 commit 检查。理由：六个 Task 分别落在 `packages/shared`、`apps/api`、`packages/db`、`.github/workflows`、`docs/` 五个互不重叠的目录，只有 `app.ts` 被 Task 1/3/4/5 共同修改，因此需要按 Task 顺序串行派发，但每个 Task 的测试与 commit 可独立验收。
2. **Native / Inline** — 在当前会话按 Task 顺序自己执行。理由：全程只有约 16 个文件改动，不需要并行；但 6 次真库回归会占用较长上下文。

本计划**不包含** `gen:sql`、Biome、477 行白名单收敛、前端 Mock 下线、Hono RPC 与版本升级；它们分别属于 `## Scope` 表里的计划 2/3/4，各自独立可交付。
