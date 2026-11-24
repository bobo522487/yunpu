# Tasks: 后端架构收口与谱系核心数据落地

**Input**: Design documents from `/specs/004-backend-architecture/`

**Prerequisites**: [plan.md](plan.md)、[spec.md](spec.md)、[research.md](research.md)、[data-model.md](data-model.md)、[contracts/](contracts/)、[quickstart.md](quickstart.md)

**Tests**: **包含测试任务**——宪法要求真 PG 集成测试 + TDD；[spec.md](spec.md) `FR-006`/`FR-017` 与 [quickstart.md](quickstart.md) §3 已定断言清单。测试任务写在对应实现之前，先失败后通过。

**Organization**: 按用户故事分组；每故事可独立验收。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无未完成依赖）
- **[Story]**: US1–US6
- 描述含精确路径；约束引用 data-model / contracts 原文

## Path Conventions

- API：`apps/api/src/`
- DB：`packages/db/src/`、`packages/db/migrations/`
- 共享：`packages/shared/src/`
- 测试：`tests/`（Vitest）
- 门禁：`biome.json`、`.github/workflows/verify.yml`

---

## Phase 1: Setup（工具链与依赖）

**Purpose**: 锁定 Node 26 + Vitest + Biome + `@hono/node-server`，不改业务行为

- [X] T001 在根 `package.json` 增加 `"engines": { "node": ">=26.13.0", "pnpm": ">=12.0.0" }`，并新增/调整 scripts：`db:migrate` → `node packages/db/src/migrate.ts`，`test` 入口改为 Vitest（暂可先挂空/既有套件路径，完整迁移在 US1）
- [X] T002 [P] 在 `apps/api/package.json` 添加 `@hono/node-server`，升级 `hono`/`better-auth` 至 plan 锁定线，配置 `"imports": { "#/*": "./src/*.ts" }`
- [X] T003 [P] 更新 `apps/api/tsconfig.json`：`module`/`moduleResolution`=`NodeNext`，`erasableSyntaxOnly`、`verbatimModuleSyntax`、`strict`、`noEmit`（research R1）
- [X] T004 [P] 新增根 `vitest.config.ts`（或 `vitest.workspace`）指向 `tests/**` 与 `apps/api/test/**`，环境文件 `.env.test`
- [X] T005 [P] 新增/更新根 `biome.json`：基础 lint；`noRestrictedImports` 规则骨架预留（具体阻断路径在 US2/US6 填实）

**Checkpoint**: 依赖可安装，Node 可解析 API 入口类型

---

## Phase 2: Foundational（阻塞所有故事）

**Purpose**: 租户事务入口、错误信封、`AppType` 链式骨架、扩展与共享枚举

**⚠️ CRITICAL**: 本阶段完成前不得开始用户故事实现

- [X] T006 将 `apps/api/src/db/with-user.ts` 演进为 `apps/api/src/db/with-tenant-transaction.ts`：`withTenantTransaction({ userId, orgId }, fn)` 内顺序执行 `BEGIN` → `SET LOCAL ROLE genealogy_app` → `set_config('app.user_id',…,true)` → `set_config('app.current_org_id',…,true)` → 业务 → `COMMIT`；可重试仅 `ECONNRESET`/`40001`/`40P01` 最多 3 次；`23505`/版本冲突不重试（contracts/runtime-hardening.md §2）
- [X] T007 更新所有既有 `withUser` 调用点（`apps/api/src/modules/**`）改为新入口或薄包装，保持 002/003 行为不变
- [X] T008 [P] 在 `apps/api/src/app.ts` 统一 `onError` 为 `{ ok: false, code, message, details? }`，确保 `X-Request-Id` 不丢（research R8；勿改成嵌套 `error` 对象）
- [X] T009 [P] 在 `packages/shared/src/enums.ts`（或等价）导出本批次关系 kind 常量：至少 `biological_parent` / `adoptive_parent` / `spouse`，并与文档 7 种枚举源对齐策略（research R5：DB 可含 7 种，API 只收 3 种）
- [X] T010 创建迁移前置 `packages/db/migrations/XXXX_extensions_ltree.sql`：`CREATE EXTENSION IF NOT EXISTS ltree`、`btree_gist`（data-model §9）
- [X] T011 [P] 调整 `.github/workflows/verify.yml`：Node 24→26；移除 `oven-sh/setup-bun`；测试步骤改为 `pnpm test` / Vitest（与 US1 脚本一致）

**Checkpoint**: 租户事务与错误信封就绪；用户故事可开始

---

## Phase 3: User Story 1 - 单一运行时启动/迁移/测试 (Priority: P1) 🎯 MVP

**Goal**: 零 Bun 业务命令；`node` 启动 API + 迁移；Vitest 全绿；优雅关闭

**Independent Test**: `node apps/api/src/index.ts` 就绪通过；`node packages/db/src/migrate.ts --env test` 成功；`pnpm test` 绿；仓库检索无业务 `bun ` 残留（spec US1 / SC-001 / SC-002）

### Tests for User Story 1

- [X] T012 [P] [US1] 先写失败用例 `tests/runtime/ready.test.ts`：进程以 Node 启动后 `/api/ready`（或既有就绪路径）返回可用
- [X] T013 [P] [US1] 先写失败用例 `tests/runtime/no-bun-scripts.test.ts`：扫描根/`apps/api`/`packages/db` 的 `package.json` scripts 与 CI，断言无 `bun ` 业务启动/迁移/测试命令（白名单说明除外）

### Implementation for User Story 1

- [X] T014 [US1] 重写 `apps/api/src/index.ts`：`@hono/node-server` `serve`；SIGTERM/SIGINT 优雅关闭（停收→排空→`closePools`→exit 0）（plan 入口示意）
- [X] T015 [US1] 确认 `packages/db/src/migrate.ts` 在 Node 26 下可直接运行（类型擦除/语法）；修正任何 Bun 专用 API
- [X] T016 [US1] 将根 `package.json` 的 `test`/`test:auth`/`test:all`/`db:migrate` 全部改为 `node`/`vitest`/`pnpm` 路径，删除业务侧 `bun test`/`bun packages/db...`
- [X] T017 [US1] 迁移既有 `bun test` 用例到 Vitest 兼容写法（`tests/auth`、`tests/console`、`apps/api/test` 等），保证回归绿
- [X] T018 [US1] 更新 `specs/004-backend-architecture/quickstart.md` 与开发文档中仍写 Bun 启动的段落（若 `docs/architecture/runtime.md` 锁定 Bun，开 PR 说明本批次收口并回写）

**Checkpoint**: US1 独立可验收

---

## Phase 4: User Story 2 - 租户隔离焊死 (Priority: P1)

**Goal**: 业务模块禁裸 db；FORCE RLS CI 断言；跨租户空/404

**Independent Test**: 违规 import 被 Biome 阻断；去掉 FORCE 的表使断言失败；跨租户读写用例 100% 通过（spec US2 / SC-003）

### Tests for User Story 2

- [X] T019 [P] [US2] 先写失败用例 `tests/security/force-rls.test.ts`：按 contracts/runtime-hardening.md §5 查询 `pg_class`，非白名单表缺 `relrowsecurity`/`relforcerowsecurity` 则 fail
- [X] T020 [P] [US2] 先写失败用例 `tests/security/tenant-isolation.test.ts`：组织甲会话读写组织乙资源 → 空或 404；连接复用后无 org 绑定泄漏

### Implementation for User Story 2

- [X] T021 [US2] 在 `biome.json` 填实：禁止 `apps/api/src/modules/**` 直接 import `apps/api/src/db/pool.ts` / 裸 `createDb`；禁止导出未绑定 db（spec FR-003/FR-016）
- [X] T022 [US2] 审计现有迁移：对已有业务表补 `ALTER TABLE … FORCE ROW LEVEL SECURITY`（若缺），手写 SQL 提交 Git（research R10）
- [X] T023 [US2] 在 `apps/api/src/db/with-tenant-transaction.ts` 增加失败分类单测/集成测：瞬态重试 3 次；唯一键/版本冲突不重试 → 409
- [X] T024 [US2] 越权路径统一不可发现语义（404），审计日志记真实 403（`apps/api/src/app.ts` / 模块错误映射）

**Checkpoint**: US1+US2 可独立验收

---

## Phase 5: User Story 3 - 人物与关系边（含删除与防环）(Priority: P1)

**Goal**: CRUD 人物/边；配偶无向；父母≤2；环拒绝；删人物级联；投影同事务刷新

**Independent Test**: quickstart §4 冒烟 + 集成测覆盖环/基数/配偶反向/级联删除/回滚（spec US3 / SC-005）

### Tests for User Story 3

- [X] T025 [P] [US3] 先写失败用例 `tests/genealogy/person-crud.test.ts`：创建/读/改（version 冲突 409）/删；删人物后边与投影不残留
- [X] T026 [P] [US3] 先写失败用例 `tests/genealogy/relations.test.ts`：合法父母/配偶；自环拒绝；配偶反向 CONFLICT；血亲/收养第 3 条 `PARENT_LIMIT`；环 `CYCLE_DETECTED`；失败事务完整回滚
- [X] T027 [P] [US3] 先写失败用例 `tests/genealogy/cross-tenant-person.test.ts`：跨组织人物/边不可见

### Implementation for User Story 3

- [X] T028 [P] [US3] 在 `packages/db/src/schema/` 新增 Drizzle 表：`person`（含 `sex` 默认 `unknown`、`surname` 可空非空白、`birth_year`/`death_year` 可空、`is_living` 默认 true、`version` 默认 1 且 `>0`）、`person_name`（primary 唯一）、`person_relation`（7 种 kind CHECK、`from<>to`、配偶 `from<to`、UNIQUE(project,from,to,kind)）、`lineage_projection`（`primary_path ltree`、`generation int`、GiST）（data-model §3–§6）
- [X] T029 [US3] 生成并提交 `packages/db/migrations/XXXX_genealogy_core.sql`：建表、FK、索引、RLS ENABLE+FORCE、环检查触发器/advisory lock（对齐 schema.md DM-REL-05）、投影表；禁止 `drizzle-kit push`
- [X] T030 [P] [US3] 在 `packages/shared/src/schemas.ts` 增加 Zod：Create/UpdatePerson（`displayName` 非空白；Update 必填 `version`）、CreateRelation（kind ∈ 三值）
- [X] T031 [US3] 创建 `apps/api/src/modules/person/`：`schema.ts`、`errors.ts`（`CYCLE_DETECTED`/`PARENT_LIMIT`/`VERSION_CONFLICT`/`CONFLICT`）、`queries.ts`、`service.ts`（全部经 `withTenantTransaction`；写边后刷新投影；删人物级联）、`router.ts` 按 [contracts/person-api.md](contracts/person-api.md)
- [X] T032 [US3] 服务层父母基数：对 `to_person_id` 计同 kind 父母边，已有 2 则 409 `PARENT_LIMIT`；配偶写入前规范化 uuid 序（clarify）
- [X] T033 [US3] 在 `apps/api/src/app.ts` 挂载 person/relations 路由；捕获 DB `GX001` → `CYCLE_DETECTED`
- [X] T034 [US3] 若新增错误码，回写 `docs/architecture/data/errors.md` 并跑 `scripts/check-docs.sh --strict`

**Checkpoint**: US3 独立可验收

---

## Phase 6: User Story 4 - 受控子图 (Priority: P2)

**Goal**: `GET …/subgraph` 默认 up=2/down=4/limit=300；`hasMore*`；P95&lt;200ms @~5k

**Independent Test**: 默认参数不倾倒整谱；深度未尽但触 limit 时 hasMore 为 true；性能断言（spec US4 / SC-004）

### Tests for User Story 4

- [X] T035 [P] [US4] 先写失败用例 `tests/genealogy/subgraph.test.ts`：默认深度/limit；根缺失 404；跨租户不可读；触达 limit 时 `hasMoreAncestors`/`hasMoreDescendants`
- [X] T036 [US4] 先写失败用例 `tests/genealogy/subgraph-perf.test.ts`：约 5,000 人种子谱上默认视口 P95&lt;200ms（约定环境；依赖投影）

### Implementation for User Story 4

- [X] T037 [US4] 在 `apps/api/src/modules/person/subgraph.ts`（或 `queries.ts`）实现受控子图：递归 CTE + `lineage_projection` 过滤；默认 query 参数按 [contracts/subgraph-api.md](contracts/subgraph-api.md)
- [X] T038 [US4] 路由 `GET /api/v1/projects/:projectId/subgraph` 校验 query（上限裁剪）；挂到 `router.ts`/`app.ts`
- [X] T039 [US4] 种子脚本或测试夹具 `tests/genealogy/fixtures/large-tree.ts`：生成约 5k 人与父母边并刷新投影

**Checkpoint**: US4 独立可验收

---

## Phase 7: User Story 5 - 认证边界与 AppType (Priority: P2)

**Goal**: 认证唯一出口；链式 `export type AppType`；不新增鉴权页依赖

**Independent Test**: 仅 `modules/auth` 对外导出；前端可 import `AppType` 编译；抽样错误均为统一信封（spec US5 / SC-006）

### Tests for User Story 5

- [X] T040 [P] [US5] 先写失败用例 `tests/runtime/auth-module-boundary.test.ts`：断言不存在并行对外认证目录出口（或 import 图只指向 `modules/auth`）
- [X] T041 [P] [US5] 先写失败用例 `tests/runtime/error-envelope.test.ts`：抽样 400/401/404/409 体均为 `{ ok:false, code, message }`

### Implementation for User Story 5

- [X] T042 [US5] 合并 `apps/api/src/auth/` 入 `apps/api/src/modules/auth/`，对外仅导出 `authRouter`/`getSession`/`requireAuth`；更新所有 import（research R9）
- [X] T043 [US5] 在 `apps/api/src/app.ts` 全链式注册 `/api/v1` 路由并 `export type AppType = typeof apiRoutes`（contracts/runtime-hardening.md §4）
- [X] T044 [P] [US5] 在 `apps/web`（或共享类型入口）改为消费 `AppType`/`hc`；删除手工重复 DTO（若有）
- [X] T045 [US5] 确认本批次未新增对 `apps/api/src/pages` 鉴权页的依赖；删除页列为非阻塞（可不做）

**Checkpoint**: US5 独立可验收

---

## Phase 8: User Story 6 - 工程门禁 (Priority: P3)

**Goal**: 依赖方向门禁完备；三类集成测无假事务

**Independent Test**: 故意违规 import 必红；跨租户/防环/回滚三类套件全绿且无 mock 事务（spec US6 / SC-007）

### Tests for User Story 6

- [X] T046 [P] [US6] 先写/补强 `tests/security/import-boundary.fixture.md` 或脚本：文档化三类违规样例路径，供人工/CI 验证 Biome 检出率 100%

### Implementation for User Story 6

- [X] T047 [US6] 扩展 `biome.json` `noRestrictedImports`：禁止 `packages/shared`→`modules`；禁止跨模块 `*.repo.ts`/`*.route.ts`/`queries.ts` 内部文件；禁止业务→裸 pool（FR-016）
- [X] T048 [US6] 审查 `tests/genealogy/**` 与 `tests/security/**`：确保无假事务替身；全部走真实 `yunpu_test`
- [X] T049 [US6] 在 CI `verify.yml` 增加 `pnpm exec biome check .` 步骤（若尚未）

**Checkpoint**: 门禁与三类必测就绪

---

## Phase 9: Polish & Cross-Cutting

**Purpose**: 文档同步、验收收口、非阻塞收尾

- [X] T050 [P] 回写 `docs/architecture/stack.md` / `runtime.md`：运行时改为 Node 26 + Vitest；标注 Bun 废弃
- [X] T051 [P] 在 `docs/architecture/data/schema.md` 登记本批次增量（`person.version`/生卒便利字段、`lineage_projection`）并更新编号索引
- [X] T052 按 [quickstart.md](quickstart.md) 全文跑通验收清单，修复缺口
- [X] T053 [P] （非阻塞）评估删除 `apps/api/src/pages` 鉴权页；若前端未完全接管则保留并注明
- [X] T054 确认 plan Complexity Tracking 两项仍成立；PR 描述引用取舍

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup → Foundational → US1 → US2 → US3 → US4**（US3 表是 US4 前提）
- **US5** 可在 Foundational 后与 US1–US2 并行，但建议在 US3 路由挂载后做最终 `AppType` 导出（T043）
- **US6** 依赖 US2 规则骨架 + US3/US4 测试存在
- **Polish** 在目标故事完成后

### User Story Dependencies

| Story | 依赖 |
| --- | --- |
| US1 | Foundational |
| US2 | Foundational；受益于 US1 的 Vitest/CI |
| US3 | Foundational + US2 事务入口/RLS 惯例 |
| US4 | US3 表与投影写路径 |
| US5 | Foundational；完整 AppType 需故事路由齐 |
| US6 | US2 + US3/US4 测试 |

### Parallel Opportunities

- Phase 1：T002–T005 并行
- Foundational：T008/T009/T011 并行
- US1：T012/T013 并行；T014 与 T015 可部分并行
- US2：T019/T020 并行
- US3：T025–T027 并行；T028/T030 并行
- US4：T035 与夹具可并行准备
- US5：T040/T041/T044 并行

---

## Parallel Example: User Story 3

```bash
# 测试先行（并行）：
Task: "tests/genealogy/person-crud.test.ts"
Task: "tests/genealogy/relations.test.ts"
Task: "tests/genealogy/cross-tenant-person.test.ts"

# Schema 并行：
Task: "packages/db/src/schema/* person/name/relation/projection"
Task: "packages/shared/src/schemas.ts Zod"
```

---

## Implementation Strategy

### MVP First（US1）

1. Setup + Foundational  
2. US1 单一运行时  
3. **STOP**：按 quickstart §2 验证启动/迁移/测试  

### Incremental Delivery

1. US2 护栏 → 安全基线  
2. US3 谱系核心 → 可修谱  
3. US4 子图 → 可浏览  
4. US5/US6 → 契约与门禁  
5. Polish → 文档与收尾  

### Suggested MVP Scope

仅 **US1（T012–T018）** 即可证明运行时收口；完整特性需 US1–US3 全部 P1 完成后方可宣称本规格交付。

---

## Notes

- 总计 **54** 任务（T001–T054）
- 按故事约计：Setup 5 · Foundational 6 · US1 7 · US2 6 · US3 10 · US4 5 · US5 6 · US6 4 · Polish 5
- 格式：全部为 `- [ ] Txxx …` 含路径；故事阶段含 `[USn]`；并行标 `[P]`
- 下一步：`/speckit-implement` 或按 MVP 只做 US1
