# Implementation Plan: 后端架构收口与谱系核心数据落地

**Branch**: `004-backend-architecture` | **Date**: 2026-11-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-backend-architecture/spec.md`

## Summary

将后端从「Bun + Node 混搭」收口为单一 Node 26 LTS + pnpm 运行时；把多租户隔离焊死在 `withTenantTransaction` 与 FORCE RLS CI 断言上；按 `docs/` 权威表名落地谱系最小切片（`person` / `person_name` / `person_relation`）并新增派生加速表 `lineage_projection`；合并认证目录为单一出口、导出 Hono `AppType`、统一错误信封；用 Biome 依赖方向门禁与真实 PG 集成测试守住不变量。

技术取舍见 [research.md](research.md)。数据面见 [data-model.md](data-model.md)。接口契约见 [contracts/](contracts/)。

## Technical Context

**Language/Version**: TypeScript 7.0.2（`erasableSyntaxOnly`）；运行时 Node.js ≥ 26.13.0 LTS；包管理 pnpm ≥ 12.0.0（仓库锁定以 `packageManager` / lockfile 为准）

**Primary Dependencies**: Hono 4.13.x + `@hono/node-server`；Better Auth 1.7.x；Drizzle ORM 0.45.4 + `drizzle-kit`（仅生成迁移）；`pg`；Zod 4.x；Biome 2.x（lint / 依赖方向）；Vitest 5.1（统一测试入口）

**Storage**: PostgreSQL 18（扩展 `ltree`、`btree_gist`）；双连接角色 `genealogy_app` / `auth_runtime`；对象存储 MinIO/S3 不变。不新增缓存或消息队列。

**Testing**: Vitest 5.1；集成测试连真实 `yunpu_test`；禁止 mock 事务 / RLS / 防环触发器；结构断言查 `pg_class.relrowsecurity` + `relforcerowsecurity`

**Target Platform**: Linux 服务端；API 进程本机/容器；PostgreSQL + MinIO 由 Compose 提供。基础设施组件仍为 3。

**Project Type**: Web 服务（Hono API + 既有 Vite SPA）。本批次后端为主；前端仅消费导出的 `AppType`。

**Performance Goals**: 约 5,000 人模拟谱上，典型受控子图查询 P95 < 200ms（`SC-004`）；干净环境 5 分钟内完成启动→就绪→迁移→测试全绿（`SC-001`）

**Constraints**:

- 全仓库业务脚本零 Bun 启动/迁移/测试命令残留（`FR-001` / `SC-002`）
- 业务模块禁止裸 `db`；唯一入口 `withTenantTransaction(orgId, fn)`，事务内 `set_config('app.current_org_id', …, true)`（及既有 `app.user_id` / `SET LOCAL ROLE`）
- 瞬态故障最多退避重试 3 次；`23505` / 乐观锁冲突 → 409 不重试
- 父母类边防环由 DB 延迟约束触发器执行（`GX001`）；配偶无向 `from_person_id < to_person_id`
- 每人血亲父母 ≤2、收养父母 ≤2（服务层 + 测试；不强制凑齐）
- 物理删除；删人物级联清边与投影
- 鉴权页完整删除不阻塞 DoD
- 迁移可审计 SQL 入库；禁止生产 `drizzle-kit push` / 启动自动迁移
- 文档门禁：触碰数据模型/错误映射时 `scripts/check-docs.sh --strict`

**Scale/Scope**: 单 API 进程；本批次新增业务表 ≤4（`person`、`person_name`、`person_relation`、`lineage_projection`）；业务模块累计仍 ≤8；不落地完整 `lineage`/`node` 编纂模型、事件/媒体/谱文

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Phase 0 之前

| # | 检查 | 结论 | 出处 |
| --- | --- | --- | --- |
| 1 | 是否引入新抽象层？消除了哪两处重复？ | `withTenantTransaction` 消除「各模块自设租户上下文」与「连接池串租户」两处重复特殊情况；认证目录合并消除双出口。Biome 规则是执行者不是新业务抽象 | Article I |
| 2 | 是否引入新表？为什么不能用现有结构表达？ | 落地文档既定 `person` / `person_name` / `person_relation`；另增 `lineage_projection` 作派生加速（见 Complexity Tracking）。不建第二套关系事实表 | Article IV |
| 3 | 是否新增依赖方向？依赖图是否仍单向？ | `apps/api → packages/db / packages/shared` 保持单向；Biome `noRestrictedImports` 阻断反向与跨模块内部文件 | `ARCH-AR-05` |
| 4 | 新约束的执行者是谁？ | FORCE RLS：手写迁移 + `pg_class` 测试；租户绑定：事务入口；防环：DB 触发器；父母基数：服务层 + 测试；配偶无向：CHECK；乐观锁：`version` 条件更新 | Article III |
| 5 | 新错误码是否已在 `errors.md` 登记？ | 复用 `GX001`（环）；父母超限 / 配偶冲突映射 `409`；实现前登记缺失码到 `docs/architecture/data/errors.md` | `DM-GEN-18` |
| 6 | 新编号是否在 `docs/README.md` 登记？ | 本计划不新造 `ARCH-*` 编号；表/约束引用既有 `DM-PER-*` / `DM-REL-*`；投影表新增软约束编号须在实现时登记 | Article VI |
| 7 | 是否触碰「明确不做」清单？ | 否软删除、否第二数据库、否缓存/队列。触碰「可推导数据不落库」→ 登记 Complexity Tracking | `out-of-scope`、Article IV |
| 8 | 复杂度预算 | 新业务表 4 张，累计仍远低于 30；业务模块增加 `person`（或 `genealogy`）一个；基础设施仍 3 | 宪法复杂度预算 |

门禁：通过（投影表已登记取舍）。

### Phase 1 之后

| 检查 | 结论 |
| --- | --- |
| 是否新增没有执行者的约束？ | 否。见 data-model 不变量表 |
| 是否出现跨文档矛盾？ | 提案口语名 `relation_edge` 映射为文档权威名 `person_relation`；`lineage_projection` 明确为加速层、非 `lineage`/`node` 编纂模型。实现时回写 docs 索引 |
| 编号是否悬空？ | 否。契约与 data-model 引用既有 `GX001` / `DM-REL-*`；新增错误码待实现清单回写 |
| 是否破坏 RLS 或单一真相源？ | 否。新表全部 `ENABLE` + `FORCE ROW LEVEL SECURITY`；关系事实只存 `person_relation` |

门禁：通过。

## Project Structure

### Documentation (this feature)

```text
specs/004-backend-architecture/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── runtime-hardening.md
│   ├── person-api.md
│   └── subgraph-api.md
└── tasks.md                 # /speckit-tasks 生成，本命令不创建
```

### Source Code (repository root)

```text
package.json                 # engines; db:migrate/test → node/vitest；移除 bun 业务脚本
apps/api/
├── package.json             # @hono/node-server；imports "#/*"；依赖升级
├── tsconfig.json            # erasableSyntaxOnly / NodeNext
├── src/
│   ├── index.ts             # @hono/node-server + 优雅关闭
│   ├── app.ts               # 链式路由；export type AppType
│   ├── env.ts               # 双 DATABASE_URL 不变
│   ├── db/
│   │   ├── pool.ts
│   │   └── with-tenant-transaction.ts   # 唯一租户事务入口（演进自 with-user.ts）
│   ├── modules/
│   │   ├── auth/            # 唯一认证出口（合并顶层 auth/）
│   │   ├── organization/
│   │   ├── project/
│   │   ├── account/
│   │   └── person/          # 人物 / 关系边 / 子图
│   └── pages/               # 鉴权页可暂留；不新增依赖
packages/db/
├── src/schema/              # person, person_name, person_relation, lineage_projection
└── migrations/              # 可审计 SQL + FORCE RLS
packages/shared/             # 枚举 RELATION_KINDS 子集导出等
biome.json                   # noRestrictedImports 依赖方向
tests/                       # vitest：RLS / 防环 / 回滚 / FORCE RLS 断言 / 子图性能
.github/workflows/verify.yml # Node 26；去掉 Bun setup
```

**Structure Decision**: 延续 monorepo（`apps/api` + `packages/db` + `packages/shared` + `apps/web`）。本批次改后端与 db 包；前端仅类型消费，不重做控制台 UI。

## Complexity Tracking

> **T054**：下表两项仍成立。合并说明直接引用本节取舍即可，**不另建** PR-facing note 文件。

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 落库 `lineage_projection`（派生加速，触碰 Article IV） | 澄清确认本批次必做；支撑 `SC-004` 五千人子图 P95&lt;200ms | 纯递归 CTE 扫 `person_relation`：在目标规模下难以稳定达到 P95，且每次视口查询成本随深度指数上升 |
| 在 `person` 上保留可选生卒年/在世标记（与完整 `event` 模型部分重叠） | 规格 FR 要求人物 CRUD 含生卒/在世；本批次不落地事件模块 | 强制走 `event` 表会把事件域整批拉入，超出本批次范围与模块预算 |
