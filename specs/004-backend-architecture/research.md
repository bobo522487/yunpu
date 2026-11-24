# Phase 0 Research: 后端架构收口与谱系核心数据落地

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-11-24

## R1 — 运行时：Bun → Node 26 LTS

**Decision**: 业务启动、迁移、测试全部改为 Node 26 LTS + pnpm；根 `package.json` 声明 `engines`；`db:migrate` 用 `node packages/db/src/migrate.ts`；测试入口 Vitest 5.1；入口用 `@hono/node-server`；CI 去掉 Bun setup。

**Rationale**: 规格 `FR-001`/`SC-002` 要求单一运行时；输入方案与 Node 26 原生类型擦除对齐；仓库已用 pnpm，混用 Bun 只增加特殊情况。

**Alternatives considered**:

- 继续 Bun 运行时：与规格「零 Bun」冲突。
- 保留 Bun 仅跑测试：仍是第二套运行时，违反单一真相。

## R2 — 表名与文档权威对齐

**Decision**: 采用 `docs/architecture/data/schema.md` 权威名：`person`、`person_name`、`person_relation`。输入方案中的 `relation_edge` 仅作口语，实现与迁移一律用 `person_relation`。

**Rationale**: 宪法 Article VI / 文档分层：`docs/` 是完整目标架构；规格批次不得另造平行表名。

**Alternatives considered**:

- 按提案新建 `relation_edge`：造成双真相，后续迁移成本高。

## R3 — 谱系投影 vs `lineage`/`node`

**Decision**: 本批次新增最小表 `lineage_projection(organization_id, project_id, person_id, primary_path ltree, generation int)`，由父母类边写/删路径同事务刷新。不落地完整 `lineage`/`node` 编纂位置模型。

**Rationale**: 澄清要求投影必做且服务子图性能；完整编纂模型超出本批次范围。在 plan Complexity Tracking 登记相对 Article IV 的取舍。

**Alternatives considered**:

- 直接落地 `lineage`+`node`：能力过重，牵涉 folder/编纂 UI。
- 不落库、纯递归：澄清已否决（难稳达 `SC-004`）。

## R4 — 人物显示名与生卒字段

**Decision**:

- 显示名 → `person_name`（`is_primary=true`）写入/读取。
- 性别 → `person.sex`（文档枚举）。
- 乐观锁 → `person.version`（本批次新增列，条件更新）。
- 生卒年 / 在世 → `person` 上可选列 `birth_year` / `death_year` / `is_living`（本批次便利字段）；完整事件模型留给后续。

**Rationale**: 满足 FR 人物 CRUD，同时姓名遵循文档「姓名独立表」；避免本批次引入整个 `event` 域。

**Alternatives considered**:

- 生卒只走 `event`：范围膨胀。
- `display_name` 列直接放 `person`：与 `DM-PER`/`person_name` 双重存储冲突。

## R5 — 关系种类与父母基数

**Decision**: DB CHECK 采用文档 7 种 `kind`（保持单一枚举源）；本批次 API **只接受** `biological_parent` / `adoptive_parent` / `spouse`。血亲/收养各自 ≤2 由服务层在写前计数拒绝（409）；配偶无向用 `CHECK (from_person_id < to_person_id)`（`DM-REL-03`）。

**Rationale**: 与澄清一致，同时不切断文档枚举扩展。

**Alternatives considered**:

- DB 只允许 3 种 kind：与文档枚举冲突，后续加 kind 要改约束。
- 不限制父母条数：澄清已否决。

## R6 — 防环执行者

**Decision**: 沿用文档设计——世系父边 advisory lock + `CONSTRAINT TRIGGER` 递归 CTE，错误码 `GX001`；服务层捕获映射为冲突信封。应用层不做「先查再写」作为正确性来源。

**Rationale**: Article III/V；overview 已规定并发正确性在数据库。

**Alternatives considered**:

- 仅服务层递归检测：并发下可被绕过。

## R7 — 租户事务入口

**Decision**: 将 `withUser` 演进为（或包装为）`withTenantTransaction({ userId, orgId }, fn)`：`BEGIN` → `SET LOCAL ROLE genealogy_app` → `set_config('app.user_id')` → `set_config('app.current_org_id', …, true)` → 业务 → `COMMIT`。可重试错误分类：连接重置、`40001`、`40P01`，最多 3 次指数退避；`23505` 与版本冲突不重试。

**Rationale**: 规格 US2；`is_local=true` 防止池化串租户。

**Alternatives considered**:

- 中间件只 SET 会话级变量：与事务池化不兼容，易泄漏。

## R8 — 错误信封

**Decision**: 保持既有 `{ ok: false, code, message, details? }`，并保证响应头 / 日志贯通 `requestId`（`X-Request-Id`）。不改为提案示例的 `{ error: {…} }` 嵌套形状，以免破坏 002/003 契约。

**Rationale**: `docs/architecture/runtime.md` 与既有 contracts 已统一；规格要的是「统一 + requestId」，非必须改字段名。

**Alternatives considered**:

- 迁移到 `{ error: { code, message, requestId } }`：破坏既有客户端，收益低。

## R9 — 认证目录与鉴权页

**Decision**: 合并 `apps/api/src/auth/` 入 `modules/auth/`，对外只导出 `authRouter` / `getSession` / `requireAuth`。服务端鉴权页可暂留但不新增依赖；完整删除不阻塞 DoD。

**Rationale**: 澄清 Q5。

## R10 — FORCE RLS CI

**Decision**: 迁移后 Vitest 查询 `pg_class`：业务表必须 `relrowsecurity AND relforcerowsecurity`；白名单仅 `__drizzle_migrations` 与明确认证/系统表。

**Rationale**: Drizzle `pgPolicy()` 不生成 FORCE；规格 US2。

## R11 — 测试与门禁工具

**Decision**: Vitest 5.1 替换 `bun test`；Biome 2.x `noRestrictedImports` 阻断 shared→modules、跨模块 `*.repo.ts`/`*.route.ts`、业务→裸 pool。

**Rationale**: 规格 US1/US6；Biome 不依赖 TS JS API，适合 TS7。
