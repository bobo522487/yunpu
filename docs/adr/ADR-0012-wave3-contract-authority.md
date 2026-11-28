---
status: accepted
supersedes: ADR-0009-architecture-slimming
---

# ADR-0012: Wave 3 读路径权威收敛

## Context

ADR-0009 明确把校验错误形状的差异保留为外部契约，并明确不重写导出器、不加契约新鲜度门禁。Wave 3 评审指出这三项"刻意保留"已产生实际成本：person 路由的 `{ issues: flatten() }` 与其余路由的裸 `fieldErrors` 让前端需要两套解析；`scripts/export-contract.ts` 用正则抓路径、硬编码 200 且不带参数/请求体/响应 Schema，`contracts/openapi.json` 实际是空壳；CI 无漂移校验，契约会静默落后于路由。项目已具备更合适的权威位置：`@yunpu/shared` 的 Zod schema 与 Hono 路由声明。

## Decision

- 校验失败统一为裸 `fieldErrors`。删除 `apps/api/src/lib/http.ts` 的 `DetailsShape` 与 person 路由五处 `"issues"` 实参；所有 `parse*` 助手只接受 schema 与输入。
- 新增声明式操作注册表 `apps/api/src/openapi/operations.ts`。它只依赖 `@yunpu/shared` 与 zod，无数据库副作用；每条操作声明路由、请求体/路径参数/查询参数/响应 Schema 与状态码。
- `scripts/export-contract.ts` 从注册表生成完整 OpenAPI 3.1 文档：路径参数、查询参数、requestBody、各状态码响应 Schema、组件 Schema。生成前用源码路由声明校验注册表完整性，漂移即失败。
- 新增 `pnpm contract:check`（重新导出并要求 `contracts/openapi.json` 无 diff）和 CI 步骤，契约新鲜度成为合并门禁。
- 不引入 `@hono/zod-openapi` 等第三方路由耦合依赖；由 `apps/api/src/lib/contract.ts` 提供进程内同源绑定器 `createContractBinder`，让所有 Hono 路由器在运行期直接消费 `apps/api/src/openapi/operations.ts` 中同一操作对象的路由字符串以及 `params`/`query`/`body` Zod schema，从而彻底消除双写分叉（实体响应与全部路径参数 Schema 同时收敛至 `@yunpu/shared`）。

## Consequences

- 外部可见的校验错误 `details` 形状发生一次有意变更：person 路由从 `{ issues: ... }` 改为与其他路由一致的裸 `fieldErrors`。下游需按新形状解析；这是本 ADR 明确取代 ADR-0009 的原因。
- `contracts/openapi.json` 从 27 paths/38 ops 的无 Schema 骨架变为带完整请求/响应 Schema 的契约；web 端与 `@yunpu/db`、`@yunpu/api` 共同以 `@yunpu/shared` 为单一权威来源推导 DTO 与列类型。
- 新增操作或修改路由/Schema 时只需以 `OPENAPI_OPERATIONS` 为权威声明并通过 `createContractBinder` 绑定；导出校验与运行期绑定测试会在无契约覆盖、裸路由绕过或参数占位符失配时立即报错。
- ADR-0009 中"不重写导出器、不加契约新鲜度 CI、保留两种校验形状"三条约束由本 ADR 取代；其余决策继续有效。

## Status

accepted（supersedes ADR-0009 的三条相关约束，并于 2026-11-28 修订为经 `createContractBinder` 运行期同源绑定）
