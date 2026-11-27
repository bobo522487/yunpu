---
status: accepted
supersedes: ADR-0008-polyrepo-contract
---

# ADR-0013: 将前端 `apps/web` 重新纳入统一 pnpm Monorepo

## Context

[ADR-0008](ADR-0008-polyrepo-contract.md) 曾将前端拆往独立仓库 `yunpu-web`，原因在于当时前端与后端未共享 `@yunpu/shared` 契约，且各自持有独立的工具链。然而在后续演进中，分仓策略暴露出真实的跨端漂移成本：

- 前端手写拷贝的接口类型已与后端权威实现偏离（例如 `updateProjectRequest` 仍在发送旧的 `expectedUpdatedAt` 而后端早已按 `0019` 迁移改为整数 `version` CAS；`OrgDetail.status` 保留了后端不存在的 `'suspended'` 状态；前端 `ProjectRecord` 中存在未落库的 `ancestor` 字段）。
- 仅靠人工把 `contracts/openapi.json` 复制到另一仓库无法阻止接口类型和枚举静默漂移，且缺少全栈统一的 PR 门禁。

前端现已整体迁入 `apps/web`，需要把双仓残留消除，建立真正基于单一事实来源的 Monorepo 协同架构。

## Decision

- **统一工作区与运行时**：`pnpm-workspace.yaml` 纳入 `apps/web`（包名 `@yunpu/web`）；全仓统一使用 Node.js `>=26.13.0` 与 `pnpm@12.18.0`，移除 `apps/web/bun.lock` 与所有 `bun` / `bun test` 脚本及独立子目录 CI/治理文档。
- **直接消费共享契约**：`@yunpu/web` 通过 `"@yunpu/shared": "workspace:*"` 直接复用共享枚举、错误码（`ErrorCode`）与校验规则，不再手写重复定义；修复已发生的 `Project` CAS（`version`）与 `OrganizationStatus` 等契约漂移。
- **保留 OpenAPI 权威产物**：`apps/api/src/openapi/operations.ts` 与 `contracts/openapi.json` 继续作为跨端 HTTP 契约文档和漂移门禁（`pnpm contract:check`），便于外部预览或后续自动化生成客户端类型。
- **工具链分层与依赖护栏**：
  - `biome.json` 继续守护 `apps/api/src/**`、`packages/**/src/**` 与 `tests/**` 的格式化、Lint 与后端模块边界；
  - `apps/web` 保留针对 React / TanStack Router / TanStack Query / Tailwind 的 ESLint + Prettier + `tsc -b` + Vitest Browser 体系，并在 ESLint 与根目录 `tests/runtime/` 测试中显式禁止 `apps/web` 导入 `@yunpu/db`、`@yunpu/api` 运行时代码或 `bun` API。
- **统一开发与 CI 门禁**：根目录 `package.json` 提供 `pnpm dev`（同时拉起 API 与配置了 `/api` 同源代理的 Vite dev server）、`pnpm lint`、`pnpm build:web`、`pnpm test:web`、`pnpm test:web:browser`；`.github/workflows/verify.yml` 并行覆盖后端与前端全部门禁。

## Consequences

- `apps/web` 的任何提交都会在根目录 CI 中与 `@yunpu/shared` 和 `@yunpu/api` 一起接受门禁校验，契约破坏在合并前即可暴露。
- `apps/web` 中未对接后端的领域模块（谱系 `useLineageStore`、谱文 `useArticleStore`、谱书 `useBookStore`）以及前端特有的 `project.ancestor` 字段，仍需在后续按仓库 SDD 流程逐块完成数据模型对齐与服务端持久化改造。

## Status

Accepted & Implemented（supersedes [ADR-0008-polyrepo-contract](ADR-0008-polyrepo-contract.md)）。
