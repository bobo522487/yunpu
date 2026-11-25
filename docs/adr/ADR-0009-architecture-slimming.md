---
status: accepted
---

# ADR-0009: 架构精简——简单胜过聪明

## Context

上一轮决策把权威收回行为本身之后，仓库里仍留着几类没有行为回报的复杂度：`auth/session-context.ts` 是 320 行的依赖注入版会话模块，生产路径零引用（生产走 `auth/service.ts`），另有 248 行专属测试；`db/with-user.ts` 与 `db/pool.ts` 只是转接层，连接池关闭逻辑可以内联进启动入口；`modules/{auth,person,project}/schema.ts` 只是把 `@yunpu/shared` 再导出一次的壳；三个模块各自维护一份 `errors.ts`，八处手写角色字面量与五处手写时间戳格式各说同一件事；分页 schema 与账号侧的错误映射也各存在两份。另有 `scripts/check-rls.ts` 与 `tests/security/force-rls.test.ts` 重复验证同一条 RLS 事实，`verify.yml` 重复执行 Biome。14 个 `tsc --noEmit` 错误则让类型检查一直没能成为合并门禁。

这些代码既不承载业务规则，也不改变对外可见结果。按 Linus 哲学，复杂度只有在带来行为收益时才值得保留；同一事实只应在一处权威表达。因此本轮只做删除与收敛，不新增抽象、不引入依赖或依赖注入容器。

## Decision

- **阶段 0（纯删除）**：删除生产零引用的 DI 版会话模块及其测试；删除 `db/with-user.ts`、`db/pool.ts`，把 `closePools` 内联进 `apps/api/src/index.ts`；删除死导出（`countResidualEdges`、`countResidualProjection`、`defaultListLimit`、`ownerRoleConflict`、`authDb` 的 index re-export）；删除 `scripts/check-rls.ts` 与 `.github/workflows/docs.yml`，从 `verify.yml` 去掉重复的 Biome 步骤；删除 `modules/{auth,person,project}/schema.ts` 三个 re-export 壳，schema 统一到 `@yunpu/shared`。
- **阶段 1（收敛重复）**：router 助手统一到 `apps/api/src/lib/http.ts`；三个模块的错误映射统一到 `apps/api/src/lib/errors.ts`；用 `apps/api/src/lib/sql.ts` 的 `isoTimestamp` 统一五处时间戳格式化（同时修掉 7 个 TS2345）；八处手写 `"admin" | "editor" | "viewer"` 改用 `@yunpu/shared` 的 `MemberRole`；shared 新增 `PageQuerySchema` 合并分页 schema；合并账号服务的 `mapBetterAuthError` 与 `auth/errors` 的 `mapAccountError`，删除 `auth/service.ts` 本地的 `mapSignUpError` 副本；合并测试夹具 `call`/`addMember` 与两份 `loadEnvFile`。
- **阶段 1.5（门禁）**：修完 14 个类型错误后，把 `tsc --noEmit` 设为 CI 门禁。
- **明确放弃 DI 版的两条不变式**：「登录失败时撤销会话」与「`resolve` 复用已解析的 user」只存在于被删除的 `session-context.ts` 及其测试中，生产路径 `auth/service.ts` 从未执行过它们。本轮**明确放弃这两条不变式，不把它们搬进生产，也不新增等价实现**；删除它们不改变任何生产行为，也不把「未来可能想要」误记为现状。
- **范围约束**：范围限定为阶段 0/1 的纯删除与重复收敛，行为不变。

## Consequences

- 源码规模可测量下降：相对精简前基线，纯删除阶段删除 809 行、新增 51 行，净减少 758 行；后续收敛阶段继续减少重复定义。
- HTTP 可见结果不变：状态码、响应信封、错误码与文案、Set-Cookie 行为均与精简前一致；合法请求照常成功，非法请求按原错误码失败。校验失败的 `details` 形状按各路由原样保留——多数路由沿用裸 `fieldErrors`，person 路由沿用 `{ issues: flatten() }`；统一助手 `lib/http.ts` 用可选 `shape` 参数区分，避免把原本不统一的外部契约"统一"成悄然的行为变更。
- 同一事实只在一处定义：路由助手、数据库错误映射、时间戳格式、分页规则、成员角色、账号错误含义与环境加载各只有一个权威位置，其余位置只引用它。
- `tsc --noEmit` 零错误并纳入 `pnpm lint`，类型错误在合并前被挡住；`verify.yml` 不再重复执行 Biome。
- 数据库层不受影响：RLS 策略、触发器、迁移与约束保持原样，原有拒绝行为不变。
- 明确不做（本轮不处理）：不把 DI 版 `revokeAuthSession` 搬进生产；不加 `withProjectRole`；不重写 `export-contract.ts`、不启用 `app.routes`、不加契约新鲜度 CI；不动 RLS/触发器/迁移；不引入依赖或 DI 容器；不修 `specs/` 的 16 个悬空 docs 引用；不改进程内限流；不动 `AppType`。

## Status

Accepted。阶段 0/1 的删除与收敛已落地；阶段 1.5 的类型检查门禁已生效——`tsc --noEmit` 从 14 个错误修至 0，并纳入 `pnpm lint`（`biome check . && tsc --noEmit -p apps/api/tsconfig.json`），`verify.yml` 仅执行一次。静态检查（Biome/tsc）、契约导出与 DB 无关测试全部通过。全量集成验证以仓库自带嵌入式 PostgreSQL 18.7 起库、14 个迁移全部 applied 完成 core 套件 A/B 对照：重构后失败集为 pristine HEAD 基线的真子集（`8 failed/168 passed` vs `10 failed/174 passed`），零新增失败；8 项均为基线既存、与本次改动无关的陈旧 `json.error` 断言。`tests/env` 因当前沙箱无 silo/S3 与 3010/3001 应用服务仍无法全跑（环境限制，非代码回归）。详见本 ADR 与对应提交历史（原 `006-architecture-slimming` 规格三件套已随收口删除）。
