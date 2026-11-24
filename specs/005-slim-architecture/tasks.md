# Tasks: 把权威还给行为本身

**Input**: Design documents from `/specs/005-slim-architecture/`

**Prerequisites**: [plan.md](plan.md)（必需）、[spec.md](spec.md)（必需）、[research.md](research.md)、[data-model.md](data-model.md)、[contracts/](contracts/)、[quickstart.md](quickstart.md)

**Tests**: **包含测试任务**。[quickstart.md](quickstart.md) 把每条验收写成了可运行场景；现行宪法要求约束用真实 PostgreSQL 证明，不能 mock。测试写在对应实现之前，先失败再通过。本特性会把宪法改成 2.0.0，但不取消这些断言。

**Organization**: 按用户故事分组。每个故事可以单独实现、单独验收。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、不依赖未完成任务）
- **[Story]**: 只出现在用户故事阶段（US1–US4）
- 描述里写精确路径

## Path Conventions

- API：`apps/api/src/`
- DB：`packages/db/migrations/`、`packages/db/src/schema/`
- 共享错误码：`packages/shared/src/errors.ts`（本特性不新增错误码）
- 测试：`tests/`（已由根 `package.json` 的 `test:all` 覆盖）
- 现行说明：`docs/decisions/`、`docs/boundaries.md`
- 治理：`.specify/memory/constitution.md`、`.github/workflows/verify.yml`、`.github/workflows/docs.yml`

---

## Phase 1: Setup（已有仓库，不新增依赖）

**Purpose**: 确认测试会跑到新文件，且不引入依赖注入或接口生成器

- [X] T001 核对根 `package.json` 的 `test:all` 已包含 `tests/genealogy`、`tests/security`、`tests/runtime`、`tests/console`。缺哪一段就只补那一段。不要往 `package.json` 或 `apps/api/package.json` 加入依赖注入框架或 OpenAPI 生成器

**Checkpoint**: 新测试放到上述目录即可被 `pnpm test:all` 执行

---

## Phase 2: Foundational（阻塞所有用户故事）

**Purpose**: 先改写治理条文，避免后续任务为了旧门禁去补编号或散文对照表

**⚠️ CRITICAL**: 用户故事开始前必须完成本阶段

- [X] T002 按 [plan.md](plan.md)「宪法改写」把 `.specify/memory/constitution.md` 改为 **2.0.0**。保留这些行为原则并写清：能由存储拒绝的状态就由存储拒绝；同一事实只有一处权威（已执行迁移、与之对照的 Drizzle schema、`AppType`、`ERROR_STATUS` 与 `mapDatabaseError`）；失败对调用方可见；租户隔离仍在数据库行级策略，应用只在唯一事务里设置 `app.user_id`；删除是物理删除，归档仍是状态；不为未到来的表预建索引或软约束登记。从合并条件中删除编号族、`scripts/check-docs.sh`、两次散文门禁、复杂度例外三列表、软约束登记表、外键例外白名单

**Checkpoint**: 宪法不再要求为新约束补 `docs/architecture/data/errors.md` 或 `docs/README.md` 编号

---

## Phase 3: User Story 1 - 维护者只改一处权威就能交付变更 (Priority: P1) 🎯 MVP

**Goal**: 现行说明只剩决策记录和一份边界说明。合并不再依赖文档校验、编号族、两次治理检查或复杂度例外登记。

**Independent Test**: 仓库里不存在 `docs/README.md`、`docs/requirements/`、`docs/architecture/`、`docs/verification/`、`docs/superpowers/`、`scripts/check-docs.sh`。`docs/boundaries.md` 与 `docs/decisions/` 在。`verify.yml` 与 `docs.yml` 不再调用文档校验。历史 `specs/001`–`specs/004` 不被改写。

### Tests for User Story 1

- [X] T003 [P] [US1] 在 `tests/runtime/living-docs.test.ts` 写会失败的断言：`docs/` 下现行文件只有 `docs/boundaries.md` 和 `docs/decisions/**`；`docs/decisions/0001-pg18-defects.md` 仍在；`docs/README.md`、`docs/requirements/`、`docs/architecture/`、`docs/verification/`、`docs/superpowers/`、`docs/.check-docs-baseline.txt` 不存在
- [X] T004 [P] [US1] 在 `tests/runtime/no-doc-gate.test.ts` 写会失败的断言：`.github/workflows/verify.yml` 与 `.github/workflows/docs.yml` 都不包含 `check-docs.sh`，且 `scripts/check-docs.sh` 不存在

### Implementation for User Story 1

- [X] T005 [P] [US1] 新建 `docs/boundaries.md`，只写 [contracts/tenant-entry.md](contracts/tenant-entry.md) 的三个例外：健康检查短连接只允许 `SELECT version()`；认证库连接只访问 Better Auth 自己的表；迁移命令使用独立连接。写明这三者不能被普通请求或普通后台任务用来读写家谱租户表
- [X] T006 [P] [US1] 删除 `docs/README.md`、`docs/requirements/`、`docs/architecture/`、`docs/verification/`、`docs/superpowers/`、`docs/.check-docs-baseline.txt`。保留 `docs/decisions/0001-pg18-defects.md`。不要把删掉的文章移到新的 archive 目录
- [X] T007 [P] [US1] 从 `.github/workflows/verify.yml` 和 `.github/workflows/docs.yml` 去掉 `sh -n scripts/check-docs.sh`、`tests/docs/check-docs.test.sh`、`tests/docs/check-docs-review.test.sh`、`scripts/check-docs.sh --root docs --strict` 以及 `wc -l docs/.check-docs-baseline.txt`
- [X] T008 [US1] 删除 `scripts/check-docs.sh` 和目录 `tests/docs/`（含现在要求工作流必须调用 `check-docs.sh` 的 `tests/docs/check-ci-gates.test.sh`）。不要改 `specs/001-dev-test-environment/`、`specs/002-user-auth-default-org/`、`specs/003-workspace-console/`、`specs/004-backend-architecture/`

**Checkpoint**: T003 与 T004 通过。维护者改存储、对外形状或失败含义时，不再有手写编号或追溯矩阵要同步

---

## Phase 4: User Story 2 - 非法状态在保存时就被拒绝 (Priority: P2)

**Goal**: 年份、父母边上限、归档后写入、投影与父母边的一致性由数据库拒绝。服务层不再靠记得检查来维持这些规则。

**Independent Test**: 在租户事务里直接插入，不调用服务层预检查。第三条血亲或收养父母边、在世却填了死亡年、归档组织上的新写入都会失败，原数据还在。合法的创建人物、两条父母边、把组织改为归档仍然成功。

### Tests for User Story 2

- [X] T009 [P] [US2] 在 `tests/genealogy/life-years.test.ts` 用直接 SQL 覆盖 data-model 原文：「有 `death_year` 时 `is_living` 必须为假」；「`birth_year` 与 `death_year` 都有值时，`death_year >= birth_year`」；「只有出生年、或死亡年未知但 `is_living` 为假，仍然允许」。失败时调用方得到 `VALIDATION` / 400，约束名为 `ck_person_life_years`，SQLSTATE `23514`，已有行不变
- [X] T010 [P] [US2] 在 `tests/genealogy/parent-limit.test.ts` 用直接插入覆盖：「同一项目、同一 `to_person_id`、同为 `biological_parent` 或同为 `adoptive_parent` 的边最多 2 条」。第 3 条得到 `PARENT_LIMIT` / 409，SQLSTATE `GX011`。`ritual_heir` 不套用这个上限
- [X] T011 [P] [US2] 在 `tests/genealogy/archived-org-write.test.ts` 覆盖：「`status <> 'active'` 时，已落地的项目、人物、人名、关系、投影、成员与邀请上的新增、修改和删除被拒绝」。消息仍是「组织已归档，无法写入」，`CONFLICT` / 409，SQLSTATE `GX012`。「把组织更新为 `archived` 的那一次写入本身允许通过」
- [X] T012 [P] [US2] 在 `tests/genealogy/projection-same-transaction.test.ts` 断言：插入或删除父母类边后，`lineage_projection` 在同一事务内更新；环检测失败时投影一并回滚。测试不得依赖 `apps/api/src/modules/person/service.ts` 里的手动刷新

### Implementation for User Story 2

- [X] T013 [P] [US2] 新增 `packages/db/migrations/0013_shape_invariants.sql`：`person` 上的 `ck_person_life_years`（有 `death_year` 则 `is_living` 为假；两个年份都有则 `death_year >= birth_year`）；父母上限约束触发器只计 `biological_parent` 与 `adoptive_parent`，抛 `GX011`；归档触发器在组织不是 `active` 时拒绝 `project`、`person`、`person_name`、`person_relation`、`lineage_projection`、`organization_member`、`invite` 的 INSERT/UPDATE/DELETE，抛 `GX012`，但允许把 `active` 组织更新为 `archived`；把 `apps/api/src/modules/person/queries.ts` 里的投影刷新收成数据库函数，由 `person_relation` 触发器在同一事务调用；为 `person`、`person_name`、`person_relation`、`lineage_projection` 上指向 `project (organization_id, id)` 的外键各建 `(organization_id, project_id)` 索引，名称分别为 `idx_person_org_project`、`idx_person_name_org_project`、`idx_person_relation_org_project`、`idx_lineage_projection_org_project`。不要为 `fk_organization_owner` 另建索引，不要创建 event、node、folder、book、media 表
- [X] T014 [P] [US2] 在 `packages/db/src/schema/genealogy.ts` 同步 `ck_person_life_years` 与上述四个索引名。触发器留在 SQL 迁移里
- [X] T015 [P] [US2] 在 `apps/api/src/lib/errors.ts` 的 `mapDatabaseError` 增加映射，且不解析错误文本：`23514` 且约束名 `ck_person_life_years` → `VALIDATION` / 400，消息说明年份与在世状态不一致；`GX011` → `PARENT_LIMIT` / 409，「同类型父母边已达上限」；`GX012` → `CONFLICT` / 409，「组织已归档，无法写入」。`packages/shared/src/errors.ts` 的 `PARENT_LIMIT` 保持 409，不新增错误码
- [X] T016 [US2] 删除预检查：`apps/api/src/modules/person/queries.ts` 的 `countParentsOfKind` 与投影刷新函数体，`apps/api/src/modules/person/service.ts` 里调用它们的代码，以及 `apps/api/src/modules/person/service.ts` 与 `apps/api/src/modules/project/service.ts` 中复制的 `requireActiveOrganization`。拒绝必须来自 T013 的触发器，经 T015 映射
- [X] T017 [P] [US2] 新建 `docs/decisions/0002-owner-fk-index.md`：`fk_organization_owner` 的引用列前导是 `organization` 主键 `id`，删除成员时按主键定位一行，所以不另建索引。不要在任何文件里重建外键例外白名单

**Checkpoint**: T009–T012 通过。直接 SQL 保存非法组合失败，合法写入的可见结果与原来一致

---

## Phase 5: User Story 3 - 读者能顺着一条请求走完，租户数据不会串 (Priority: P3)

**Goal**: 租户读写只走 `withTenantTransaction`。角色写入由行级策略兜底，HTTP 仍区分「不存在」和「无权」。列表与谱系树在 10,000 人时各自 2 秒内返回。

**Independent Test**: 业务模块不能导入连接池。不设置 `app.user_id` 时看不到上一租户的行。viewer 写人物得到无权；非成员仍得到不存在。`YUNPU_PERF=1` 时，10,000 人的名单与子图各自不超过 2 秒，另一项目数据加倍后增幅不超过 10%。

### Tests for User Story 3

- [X] T018 [P] [US3] 在 `tests/security/write-role.test.ts` 固定 data-model 矩阵的可见结果：person、person_name、person_relation、lineage_projection 的新增/修改/删除需 editor 或 admin，且组织为 active；project 的新增/修改需 editor 或 admin，删除仅 admin；organization 与 invite 的新增/修改/删除需 admin；organization_member 由 admin 修改，本人只能改自己的 `last_used_at`，本人可以退出，所有者行仍由现有外键限制删除。非成员写人物仍是不存在，不是 403。成员但角色不够得到 `FORBIDDEN` / 403（SQLSTATE `42501`）。修改所有者角色仍是 `CONFLICT` / 409，「不能修改所有者角色」
- [X] T019 [P] [US3] 在 `tests/runtime/no-pool-import.test.ts` 扫描 `apps/api/src/modules/**`：不得导入 `businessPool`、`createDb` 或 `withUser`
- [X] T020 [P] [US3] 在 `tests/security/tenant-connection-reuse.test.ts` 断言：一次 `withTenantTransaction` 归还连接后，下一次不设置 `app.user_id` 的查询看不到上一租户的行。并断言 `apps/api/src/app.ts` 的 `probeDatabase` 只执行 `SELECT version()`
- [X] T021 [P] [US3] 扩展 `tests/genealogy/fixtures/large-tree.ts` 与 `tests/genealogy/subgraph-perf.test.ts`：一个项目 10,000 位人物时，人物名单与 `GET /projects/:projectId/subgraph` 各自在 2 秒内返回；第二个项目数据量加倍后，再测第一个项目，两次耗时增幅都不超过 10%。沿用 `YUNPU_PERF=1` 才运行，避免默认 CI 播种 10,000 人

### Implementation for User Story 3

- [X] T022 [US3] 新增 `packages/db/migrations/0014_write_policies.sql`。SELECT 策略保持「成员看见所属组织的行」，不要把角色子查询加进读取策略。写入策略按 T018 的矩阵，组织不是 active 时写入仍由 T013 的触发器拒绝。`organization_member.last_used_at` 只允许 `user_id = app.current_user_id()` 的那一行修改，用触发器拒绝本人改角色或其他成员列。不要改 `app.create_organization` 等已有 SECURITY DEFINER 函数的对外结果
- [X] T023 [US3] 新建 `apps/api/src/access.ts`，作为唯一的可见结果翻译：非成员保持各模块现有的 not-found；成员角色不够把 `42501` 译成 `FORBIDDEN` / 403；所有者角色冲突保持「不能修改所有者角色」。删除 `apps/api/src/modules/person/service.ts`、`apps/api/src/modules/project/service.ts`、`apps/api/src/modules/organization/service.ts`、`apps/api/src/modules/person/queries.ts`、`apps/api/src/modules/project/queries.ts`、`apps/api/src/modules/organization/queries.ts` 里复制的 `requireRole`、`hasRole`、`hasRoleAtLeast`、`requireMembership`，改为调用 `apps/api/src/access.ts`
- [X] T024 [US3] 在 `apps/api/src/lib/errors.ts` 识别 SQLSTATE `42501`，但 HTTP 结果必须经过 `apps/api/src/access.ts`：非成员仍是不存在，成员才是 `FORBIDDEN` / 403。不要把所有 `42501` 一律变成 403
- [X] T025 [US3] 删除 `withUser`：`apps/api/src/db/with-tenant-transaction.ts`、`apps/api/src/db/with-user.ts`，以及 `apps/api/src/modules/organization/service.ts` 和仍引用它的测试。调用处改为 `withTenantTransaction({ userId }, fn)`。保持现有行为：`SET LOCAL ROLE genealogy_app`、事务局部 `app.user_id`、角色断言、最多 3 次瞬态重试、`23505` 不重试
- [X] T026 [P] [US3] 在 `biome.json` 禁止 `apps/api/src/modules/**` 导入 `apps/api/src/db/pool.ts`、`createDb` 和 `with-user`。健康检查、`apps/api/src/modules/auth/better-auth.ts` 的认证库连接、`packages/db/src/migrate.ts` 不在此禁令内
- [X] T027 [P] [US3] 仓库没有人物名单路由。在 `apps/api/src/modules/person/queries.ts`、`apps/api/src/modules/person/service.ts`、`apps/api/src/modules/person/router.ts` 增加 `GET /projects/:projectId/persons`，返回该项目人物，字段与现有 `getPersonForProject` 的单人视图一致，不新增业务字段。读取仍只走 `withTenantTransaction`

**Checkpoint**: T018–T021 通过。一条租户请求的路径是路由校验 → `withTenantTransaction` → 返回，不经过隐藏装配

---

## Phase 6: User Story 4 - 改一个业务事实只碰一个地方 (Priority: P4)

**Goal**: 最近 20 次业务提交里没有总是成对修改的目录，所以不合并包。请求路径上不增加只做原样拷贝的层。

**Independent Test**: `apps/api`、`apps/web`、`packages/db`、`packages/shared` 仍然分开。`apps/api` 与 `packages/` 下不存在 mapper 或 repository 文件。一个人物字段的校验仍在对应 `schema.ts`，写入仍在对应 service。

### Tests for User Story 4

- [X] T028 [P] [US4] 在 `tests/runtime/no-passthrough-layer.test.ts` 断言 `apps/api` 与 `packages` 下不存在 `*mapper*` 或 `*.repo.ts`。`apps/api/src/modules/person/router.ts` 仍用 `CreatePersonSchema` 校验后调用 `createPersonForProject`，中间没有第二份字段拷贝

### Implementation for User Story 4

- [X] T029 [US4] 用最近 20 次非 merge、且改动 `apps/` 或 `packages/` 的提交复核 [research.md](research.md) 第 7 节。记录中的比例是 api+web 4/20、api+db 5/14、api+shared 5/14、web+db 4/11、web+shared 4/11、db+shared 4/6，api 模块两两都不是「每次触及一方时另一方也在」。比例若仍不是 20/20，就不要合并 `apps/api`、`apps/web`、`packages/db`、`packages/shared`，也不要合并 account、auth、organization、person、project。若某对变成总是同时修改，把那一对合并成一个目录并更新 `biome.json` 的依赖方向。不要把模块依赖图写进 `docs/`

**Checkpoint**: 没有新的拷贝层，目录仍按测量结果分开

---

## Phase 7: Polish

**Purpose**: 把 quickstart 整页跑一遍，并确认旧的合法路径还在

- [X] T030 按 [quickstart.md](quickstart.md) 第 1–6 节逐条执行。性能一节使用 `YUNPU_PERF=1`。失败就回到对应故事的任务修，不要把执行计划文本写进 `docs/`
- [X] T031 [P] 跑已有合法路径：`tests/genealogy/person-crud.test.ts`、`tests/genealogy/relations.test.ts`、`tests/genealogy/subgraph.test.ts`、`tests/console/organization.test.ts`、`tests/console/projects.test.ts`、`tests/console/members.test.ts`。成功结果的可见字段保持原样
- [X] T032 [P] 确认没有改写 `specs/001-dev-test-environment/`、`specs/002-user-auth-default-org/`、`specs/003-workspace-console/`、`specs/004-backend-architecture/`。它们只作档案

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖
- **Foundational (Phase 2)**: 依赖 T001。完成前不要开始用户故事
- **User Stories (Phase 3–6)**: 都依赖 T002。故事之间按下面的顺序更稳，但 US1 不依赖 US2–US4
- **Polish (Phase 7)**: 依赖要交付的那些故事。只做 MVP 时，跑 quickstart 里 US1 能覆盖的第 1 与第 6 节

### User Story Dependencies

- **US1 (P1)**: Foundational 之后即可开始，不依赖其他故事。这是 MVP
- **US2 (P2)**: Foundational 之后即可开始。它不调用 US1 的文档删除，但不要把新约束写回已决定删除的 `docs/architecture/`
- **US3 (P3)**: 归档触发器与 `GX012` 在 T013。T022 的写入策略不要重复实现「归档拒绝」，只加上角色矩阵。因此 US3 的策略迁移放在 T013 之后。`access.ts` 与连接池禁令可以在 T013 之前写，测试里归档相关断言仍等 T013
- **US4 (P4)**: 不依赖新表。T029 的「不要合并」在任何时候都能做。T028 在 US3 加完名单路由后复核即可，它不导入 US3 的内部文件

### Within Each User Story

- 该故事的测试任务先写，并确认失败
- US2：T013 与 T014、T015、T017 可同时进行；T016 等 T013 与 T015
- US3：T022 先于依赖它的策略测试完全变绿；T023 与 T024 一起完成后再改调用处；T026、T027 与 T022 改的是不同文件，可并行
- 故事自身的检查点通过后再进入下一个优先级

### Parallel Opportunities

- T003 与 T004 可同时写
- T005、T006、T007 可同时改不同文件；T008 等 T004 已能看到「脚本不存在」这个失败之后再删脚本
- T009、T010、T011、T012 可同时写
- T013、T014、T015、T017 可同时进行
- T018、T019、T020、T021 可同时写
- T026 与 T027 可同时进行
- T031 与 T032 可同时跑

---

## Parallel Example: User Story 2

```bash
# 四个失败测试同时写：
# tests/genealogy/life-years.test.ts
# tests/genealogy/parent-limit.test.ts
# tests/genealogy/archived-org-write.test.ts
# tests/genealogy/projection-same-transaction.test.ts

# 测试失败后，迁移、Drizzle、错误映射、决策记录同时改：
# packages/db/migrations/0013_shape_invariants.sql
# packages/db/src/schema/genealogy.ts
# apps/api/src/lib/errors.ts
# docs/decisions/0002-owner-fk-index.md
```

---

## Implementation Strategy

### MVP First（只做 User Story 1）

1. 完成 T001、T002
2. 完成 T003–T008
3. 停下来跑 T003 与 T004
4. 此时维护者已经不再被文档校验和编号索引挡住。数据规则尚未下沉，不要宣称 US2 完成

### Incremental Delivery

1. Setup + Foundational
2. US1 → 文档门禁消失（MVP）
3. US2 → 非法组合无法保存
4. US3 → 租户入口与角色可见结果
5. US4 → 确认不用合并目录
6. T030 把 quickstart 跑完

### Parallel Team Strategy

1. 一起做完 T002
2. 之后一人做 US1 的文档删除，另一人写 US2 的失败测试与 `0013_shape_invariants.sql`
3. US3 的 `0014_write_policies.sql` 等 T013 落地后再合入，避免两个人改同一条「归档」规则

---

## Notes

- 不要新增错误码。`PARENT_LIMIT` 继续表示父母边超过两条
- 不要解析数据库错误的消息文本
- 不要把 `lineage_projection` 当成关系事实；事实仍是 `person_relation`
- 性能测试默认不进普通 CI，用 `YUNPU_PERF=1` 手动或在发布前跑
- 每个任务或每一组相关任务完成后单独提交
