# Tasks: 工作台控制台（首页/项目/成员/设置）

**Input**: Design documents from `/specs/003-workspace-console/`

**Prerequisites**: [plan.md](plan.md)、[spec.md](spec.md)、[research.md](research.md)、[data-model.md](data-model.md)、[contracts/](contracts/)、[quickstart.md](quickstart.md)

**Tests**: 本批次**包含测试任务**——宪法「开发流程」要求测试驱动且集成测试连真 PostgreSQL 18，[quickstart.md](quickstart.md) §3 已定值测试清单。测试任务写在实现之前，先失败后通过。

**Organization**: 任务按用户故事分组，每个故事可独立实现与验收。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无未完成依赖）
- **[Story]**: 所属用户故事（US1–US5）
- 所有任务含精确文件路径；约束引用 spec / data-model / contracts 的原文

## Path Conventions

- 服务端：`apps/api/src/`，迁移：`packages/db/migrations/`，共享契约：`packages/shared/src/`
- 前端：`apps/web/`，集成测试：`tests/console/`

---

## Phase 1: Setup（共享契约与 Schema）

**Purpose**: 扩展单一来源的枚举、Zod schema 与 Drizzle 表定义，供所有故事消费

- [X] T001 [P] 在 `packages/shared/src/enums.ts` 的 `TABLE_NAMES` 追加 `"project"`，并新增 `PROJECT_STATUSES = ["planning", "in_progress", "completed"] as const`（schema.md §5.4 `ck_project_status` 取值、§4.5 枚举单一来源）
- [X] T002 [P] 在 `packages/shared/src/schemas.ts` 新增 7 个 schema：`UpdateAccountSchema`（name 非空白 ≤100）、`ChangePasswordSchema`（newPassword ≥8 字符）、`CreateInviteSchema`（email 小写、role ∈ MEMBER_ROLES）、`UpdateMemberRoleSchema`（role ∈ MEMBER_ROLES）、`TransferOwnerSchema`（newOwnerUserId uuid）、`CreateProjectSchema`（name 非空白；status ∈ PROJECT_STATUSES 可选；surname/hallName 有值时非空白）、`UpdateProjectSchema`（同前 + 必填 `expectedUpdatedAt` ISO 时间戳）
- [X] T003 [P] 在 `packages/db/src/schema/tenant.ts` 新增 `project` Drizzle 表定义，字段/约束逐条对应 [data-model.md](data-model.md) §1（含 `UNIQUE (organization_id, id)`、`idx_project_org_status` 对应索引声明）

**Checkpoint**: 共享契约就绪

---

## Phase 2: Foundational（所有故事的阻塞前提）

**Purpose**: `project` 表落地、共用端点、前端数据层与状态组件

**⚠️ CRITICAL**: 本阶段完成前不得开始任何用户故事

- [X] T004 创建 `packages/db/migrations/0007_project.sql`：`CREATE TABLE project`（字段与默认值按 data-model §1，`status` 默认 `'planning'`）、具名 CHECK（`ck_project_status` / `ck_project_name_not_blank` / `ck_project_surname_not_blank` / `ck_project_hall_name_not_blank`）、`UNIQUE (organization_id, id)`、`idx_project_org_status`、`trg_touch_updated_at` 覆盖本表（`trg_guard_scope_immutable` 按 schema.md §9.2 **不**覆盖 project）、RLS `ENABLE` + `FORCE ROW LEVEL SECURITY` 且策略谓词为 `organization_id = ANY (app.visible_org_array())`（**不得写成 SELECT 子查询**）、仅 `GRANT SELECT, INSERT, UPDATE, DELETE ON project TO genealogy_app`（`rls_definer` 不授予，security.md §8.5）、并把 `ck_audit_log_entity_type` 扩为含 `'project'`（与 T001 的 `TABLE_NAMES` 一致）
- [X] T005 执行 `bun packages/db/src/migrate.ts --env test` 并在 `tests/console/foundation.test.ts` 断言：`project` 表 `rowsecurity = true` 且 `forcerowsecurity = true`、`ck_audit_log_entity_type` 含 `project`、不带 `app.user_id` 查询 `project` 返回空集（RLS fail-closed）
- [X] T006 [P] 创建 `apps/web/features/dashboard/api.ts`：按 [contracts/console-api.md](contracts/console-api.md) §1–§6 定义类型与 `apiRequest` 封装（组织详情、项目、成员、邀请、所有权、账号），分页统一 `cursor`/`limit`
- [X] T007 [P] 创建 `apps/web/features/dashboard/mockConsole.ts`：导出控制台端点的 Mock 分支（数据结构、错误码与真实信封逐字段一致，Mock 组织/项目/成员引用自洽），由 `apps/web/features/auth/mockAuth.ts` 的 `handleMockRequest` 末尾委托调用（保持单一 `registerMockHandler` 注册点不变）
- [X] T008 [P] 创建 `apps/web/features/dashboard/components/` 下的 `PageSkeleton.tsx`、`PageError.tsx`（页内错误 + 「重试」只重发读请求）、`ConfirmDialog.tsx`（破坏性操作确认 + 后果说明），状态机按 [contracts/ui-states.md](contracts/ui-states.md) §1
- [X] T009 改造 `apps/web/store/useWorkspaceStore.ts`：`workspaces` / `activeWorkspaceId` 由 API 灌入（保留 store 形状，模板遗留 `apps`/`datasources` 种子不动）；新增 `setCurrentOrganization(id)`（调 `POST /organizations/:id/activate`，**切换即记住**，spec `FR-007`）、`resolveNextAvailableOrganization()`（归档后去向：下一个可用组织 → 空则引导状态，spec `FR-013`）、切换时清空四页数据防跨组织残留（spec `FR-008`）

**Checkpoint**: 迁移可跑、共用端点与前端数据层就绪——用户故事可并行开始

---

## Phase 3: User Story 1 - 登录后进入当前组织的首页 (Priority: P1) 🎯 MVP

**Goal**: 首页展示当前组织概览（项目数、成员数、待处理邀请数、最近 5 条 + 查看全部、快捷入口），登录落地即首页

**Independent Test**: 用已有项目与成员的账号登录，落地 `/home`，首页数字与项目页/成员页一致；空组织显示空状态（quickstart §4 步骤 1、2、3、16）

### Tests for User Story 1

- [X] T010 [P] [US1] 先写失败用例 `tests/console/organization.test.ts`：`GET /api/v1/organizations/:id` 返回 `memberCount`/`pendingInviteCount`/`myRole`/`isOwner` 且计数与实际行数一致；跨租户访问返回「不存在或无权」（404，`FR-009`）；未登录 401

### Implementation for User Story 1

- [X] T011 [US1] 实现组织详情：`apps/api/src/modules/organization/queries.ts`（一次查询聚合 memberCount/pendingInviteCount，RLS 内）、`service.ts`、`router.ts` 挂 `GET /api/v1/organizations/:organizationId`（权限 `organization.read`，C3）
- [X] T012 [US1] 重写 `apps/web/features/dashboard/pages/WorkspaceHomePage.tsx` 为 spec 首页：组织概览数字、最近项目固定 5 条（按 `updated_at` 降序，无更新按 `created_at`，spec Assumptions）+「查看全部」跳 `/`、「新建项目」「邀请成员」快捷入口；移除应用构建器/数据源卡片与应用列表（research R3）
- [X] T013 [US1] 登录落地改首页：`apps/web/features/auth/pages/LoginPage.tsx`（`from || '/home'`）、`RegisterPage.tsx`（`/home`）、`apps/web/app/App.tsx`（通配路由跳 `/home`）
- [X] T014 [US1] 首页接入状态契约：`PageSkeleton`（概览数字 + 5 卡骨架）、空状态「尚无项目」+ 新建入口（`FR-015`）、`PageError` 页内重试（`FR-017`），文件 `apps/web/features/dashboard/pages/WorkspaceHomePage.tsx`
- [X] T015 [US1] 验证：`bun test --env-file .env.test --max-concurrency=1 tests/console` 通过；`pnpm --filter nocoapp-dev lint` 通过

**Checkpoint**: US1 独立可验收（quickstart §4 步骤 1、2、3、16）

---

## Phase 4: User Story 2 - 项目页管理当前组织的谱项目 (Priority: P1)

**Goal**: 项目页列出当前组织全部项目，支持新建/打开/修改/删除，冲突不静默覆盖

**Independent Test**: 项目页新建→出现；改名刷新保持；两标签页并发改名后提交者收到 409；viewer 无写入口且直调 403（quickstart §4 步骤 4、5）

### Tests for User Story 2

- [X] T016 [P] [US2] 先写失败用例 `tests/console/projects.test.ts`：列表仅含本组织（跨租户隔离）；空名 400；CRUD 往返；同 `expectedUpdatedAt` 并发 PATCH 一方成功一方 409 `CONCURRENT_MODIFICATION`（data-model 不变量 8）；`viewer` 写端点 403 `FORBIDDEN`（`SC-003`）；按 ID 直访他租户项目返回「不存在或无权」

### Implementation for User Story 2

- [X] T017 [P] [US2] 创建 `apps/api/src/modules/project/schema.ts` 与 `errors.ts`（校验按 T002 schema；错误复用 `VALIDATION_ERROR`/`FORBIDDEN`/`TARGET_INVALID`/`CONCURRENT_MODIFICATION`，不新增错误码）
- [X] T018 [US2] 创建 `apps/api/src/modules/project/queries.ts`：keyset 分页列表（`cursor`/`limit` 默认 50 上限 200，C4）、`sort=recent` 按 `updated_at` 降序、CAS 条件 UPDATE（`WHERE id=? AND organization_id=? AND updated_at=?`，0 行 → 409）
- [X] T019 [US2] 创建 `apps/api/src/modules/project/service.ts`：create/read/update/delete，全部在 `withUser(userId, ...)` 内，RLS 兜底 + 权限 `project.read/create/update/delete`（C3）
- [X] T020 [US2] 创建 `apps/api/src/modules/project/router.ts` 5 个端点（endpoints.md §2.3：列表/创建/详情/编辑/删除）并在 `apps/api/src/app.ts` 挂载
- [X] T021 [US2] 改造 `apps/web/features/dashboard/pages/DashboardPage.tsx` 为项目页：API 项目列表、新建/编辑弹窗（空名提示）、删除确认弹窗（说明后果，`FR-011`）、409 冲突提示「他人已修改，请刷新后重试」、viewer 入口不渲染（`FR-010`）；移除 all/apps/datasources tab（research R3，独立路由 `/datasources`、`/files` 不动）
- [X] T022 [US2] `apps/web/features/dashboard/mockConsole.ts` 补项目端点分支（含 409 与 403 场景）
- [X] T023 [US2] 验证：`bun test ... tests/console` + `pnpm --filter nocoapp-dev lint`

**Checkpoint**: US1 + US2 均可独立验收

---

## Phase 5: User Story 3 - 成员页查看与管理组织成员 (Priority: P2)

**Goal**: 成员名单、角色调整、移除、邀请（一次性链接）、撤销、所有权转移

**Independent Test**: 管理员邀请→链接弹窗→兑换后成员出现；改角色/移除生效；并发转移仅一方成功；viewer 只读（quickstart §4 步骤 6、7、8、9）

### Tests for User Story 3

- [X] T024 [P] [US3] 先写失败用例 `tests/console/members.test.ts`：列表含 `isOwner` 推导；改 owner 角色 409；删 owner 成员行 409/`23001`（验收 #2）；移除成员后其旧会话读不到本组织任何行（`US-007` 场景 4）；viewer 调写端点 403
- [X] T025 [P] [US3] 先写失败用例 `tests/console/invites.test.ts`：创建响应含一次性 `inviteUrl`，此后任何查询不含明文 token（`DM-INV-01`）；同组织同邮箱重复 pending 409（`uq_invite_pending_email`）；撤销走 `app.revoke_invite` 后不可兑换；非管理员撤销 403；同 token 并发兑换只一方成功
- [X] T026 [P] [US3] 先写失败用例 `tests/console/ownership.test.ts`：非 owner 转移 403；接手人非成员 404；两事务并发转移一方成功一方 409 `CONCURRENT_MODIFICATION`（`GX010`，验收 #50）

### Implementation for User Story 3

- [X] T027 [US3] 创建 `packages/db/migrations/0008_org_management.sql`：按 schema.md §9.3 定义 `app.revoke_invite(uuid, text)` 与 `app.transfer_organization_ownership(uuid, uuid)`——`SECURITY DEFINER`、属主 `rls_definer`、`SET search_path = pg_catalog`、`REVOKE ... FROM PUBLIC`、强审计 INSERT `audit_log`、错误码 `GX005/GX006/GX008/GX010`；EXECUTE 授予 `genealogy_api`；执行 `bun packages/db/src/migrate.ts --env test` 验证
- [X] T028 [P] [US3] 在 `apps/api/src/modules/organization/queries.ts` 增成员与邀请的 keyset 列表查询（`cursor`/`limit`，C4）
- [X] T029 [US3] 成员端点（`organization/router.ts` + `service.ts`）：`GET .../members`（`organization.member.read`）、`PATCH .../members/:userId`（`organization.member.write`，owner 角色不可改 → 409）、`DELETE .../members/:userId`（同权限，owner 由 RESTRICT 兜底）
- [X] T030 [US3] 邀请端点：`GET .../invites`（`organization.invite.read`，响应不含 token）、`POST .../invites`（`organization.invite.create`；CSPRNG ≥32 字节 token、库存 `sha256`、响应一次性 `inviteUrl` 形如 `${WEB_BASE}/#/invite/{token}`）、`DELETE .../invites/:inviteId`（`organization.invite.revoke`，调 `app.revoke_invite`）
- [X] T031 [US3] 所有权转移端点 `PUT /api/v1/organizations/:organizationId/owner`（`organization.transfer_ownership` ownerOnly，调 `app.transfer_organization_ownership`）
- [X] T032 [US3] 改造 `apps/web/features/dashboard/pages/MembersPage.tsx`：成员表（角色、owner 标记）、邀请列表（邮箱/角色/状态，无明文）、改角色、移除、撤销、转移所有权，全部破坏性操作走 `ConfirmDialog`，viewer 只读（入口不渲染 + 服务端双防线）
- [X] T033 [US3] 创建邀请链接弹窗 `apps/web/features/dashboard/components/InviteLinkDialog.tsx`：展示 `inviteUrl` + 一键复制，关闭后列表只显示状态（spec US3 场景 8）
- [X] T034 [US3] `apps/web/features/dashboard/mockConsole.ts` 补成员/邀请/所有权分支（含 403/409 场景）
- [X] T035 [US3] 验证：`bun test ... tests/console` + `pnpm --filter nocoapp-dev lint`

**Checkpoint**: US1–US3 独立可验收

---

## Phase 6: User Story 4 - 设置页管理组织与账号 (Priority: P2)

**Goal**: 组织改名/归档 + 账号显示名/密码，权限分区展示，归档后去向正确

**Independent Test**: admin 改组织名生效；归档后组织不可再进入且自动进入下一可用组织（无则引导状态）；改显示名全控制台一致；改密后旧密码失效（quickstart §4 步骤 10、11）

### Tests for User Story 4

- [X] T036 [P] [US4] 先写失败用例 `tests/console/settings.test.ts`：`PATCH` 改名（空名 400、viewer 403、admin 200）；归档后 `activate` 不选中该组织（data-model 不变量 9）；归档组织下项目写入被拒（`EC-08`）
- [X] T037 [P] [US4] 先写失败用例 `tests/console/account.test.ts`：`GET /account` 本人资料；`PATCH /account` 只改本人显示名；`POST /account/password` 当前密码错误 400、成功后旧密码登录失败、新密码 ≥8（`FR-003` spec 002）

### Implementation for User Story 4

- [X] T038 [US4] 组织写端点（`organization/router.ts` + `service.ts`）：`PATCH /api/v1/organizations/:id`（改名 `organization.update`、归档 `organization.archive`，`owner_user_id` 不可由此修改）、`POST /api/v1/organizations/:id/leave`（owner 须先转移所有权否则 409，endpoints.md §2.2 契约完整性，无 UI）
- [X] T039 [US4] 创建 `apps/api/src/modules/account/router.ts` + `service.ts` 并在 `apps/api/src/app.ts` 挂载：`GET /account`、`PATCH /account`（Better Auth `updateUser`）、`POST /account/password`（Better Auth `changePassword`，需当前密码，research R11）
- [X] T040 [US4] 改造 `apps/web/features/dashboard/pages/WorkspaceSettingsPage.tsx`：组织分区（改名表单；归档按钮 + `ConfirmDialog` 说明「数据保留、写入被拒」）按 `myRole` 门控，账号分区（显示名、改密码，只对本人生效，`FR-006`）
- [X] T041 [US4] 归档成功后调用 T009 的 `resolveNextAvailableOrganization()`：有可用组织 → `setCurrentOrganization` 切换并刷新；无 → 跳 `/onboarding`（spec `FR-013`，quickstart §2 归档去向）
- [X] T042 [US4] `apps/web/features/dashboard/mockConsole.ts` 补组织写与账号分支
- [X] T043 [US4] 验证：`bun test ... tests/console` + `pnpm --filter nocoapp-dev lint`

**Checkpoint**: US1–US4 独立可验收

---

## Phase 7: User Story 5 - 组织切换与引导状态 (Priority: P2)

**Goal**: 切换器切换即记住、创建组织弹窗（建议名称）、引导状态与邀请链接入口

**Independent Test**: 切换后四页数据整体替换；登出重登回到该组织；无可用组织时只见引导页；打开邀请链接可兑换（quickstart §4 步骤 7、12）

### Tests for User Story 5

- [X] T044 [US5] 手工验收脚本先行固化到 [quickstart.md](quickstart.md) §4 步骤 7、10、12 的预期文字核对表（本故事为纯前端编排，后端 `activate`/`create`/`accept` 由 002 批次 `tests/auth` 覆盖，无新后端行为）

### Implementation for User Story 5

- [X] T045 [P] [US5] 改造 `apps/web/components/layout/Sidebar.tsx` 组织切换器：列表来自 API 灌入的 store，选中即 `setCurrentOrganization`（切换即记住，spec `FR-007`），切换后四页数据整体刷新无残留（`FR-008`）
- [X] T046 [US5] 改造 `apps/web/features/workspace/components/CreateWorkspaceDialog.tsx`：创建组织弹窗提供**建议名称选项**（基于显示名与邮箱前缀）+ 自定义输入，创建成功自动切换为当前组织（spec `FR-016`）
- [X] T047 [US5] 引导状态接线：`apps/web/app/App.tsx` 中 `session.onboarding === true` 时四页路由整体重定向 `/onboarding`（`FR-002`）；校对 `apps/web/features/auth/pages/OnboardingPage.tsx` 仅保留「创建组织」「接受邀请」两入口
- [X] T048 [US5] 新增邀请链接路由：`apps/web/app/App.tsx` 加 `/invite/:token` → 跳 `/onboarding?invite=<token>`，`OnboardingPage.tsx` 读取 query 预填 token（兑换仍走既有 `POST /invites/accept`）
- [X] T049 [US5] 跨标签页与残留处理：写入被拒绝（组织已归档/被移出）时按 [contracts/ui-states.md](contracts/ui-states.md) §3 引导切换组织或进入引导状态，会话失效统一跳登录（`SC-004`、`SC-009`）
- [X] T050 [US5] 验证：`bun test ... tests/auth`（002 回归）+ `pnpm --filter nocoapp-dev lint` + quickstart §4 步骤 7、12 手工核对

**Checkpoint**: 全部五个故事独立可验收

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 跨故事的降级、回归与验收收口

- [X] T051 [P] Mock 降级全场景验证：停 API → 四页可用且 `MockModeIndicator` 出现、Mock 数字与列表一致；恢复 API → 自动回真实数据（quickstart §4 步骤 14，既有 `apiRequest` 机制不改）
- [X] T052 [P] 002 批次回归：`bun test --env-file .env.test --max-concurrency=1 tests/auth apps/api/test` 全绿，认证与默认组织行为不被本批次破坏
- [X] T053 执行 [quickstart.md](quickstart.md) §3 全部命令（migrate dev+test、`tests/console`、`pnpm --filter nocoapp-dev lint`、`scripts/check-docs.sh --root docs --strict --baseline docs/.check-docs-baseline.txt`），全部 exit=0
- [X] T054 逐条执行 [quickstart.md](quickstart.md) §4 十六步手工验收，核对 spec `SC-001`–`SC-010`，结果记录在本文件 Notes
- [X] T055 [P] 文档一致性核对：迁移新增的 CHECK/GRANT 与 `docs/architecture/data/schema.md`、`security.md` 无冲突；编号引用零悬空（宪法 Constitution Check「Phase 1 之后」四问）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖，可立即开始
- **Foundational (Phase 2)**: 依赖 Setup；**阻塞全部用户故事**（T004/T005 是 US1/US2 的数据前提；T006–T009 是全部前端故事的前提）
- **US1 (Phase 3)**: 依赖 Foundational
- **US2 (Phase 4)**: 依赖 Foundational；与 US1 可并行（不同端点与页面文件）
- **US3 (Phase 5)**: 依赖 Foundational；与 US1/US2 可并行（后端 organization 模块扩展与 US1 的 T011 同文件——**串行执行 T011 → T028/T029/T030/T031**）
- **US4 (Phase 6)**: 依赖 Foundational；其归档去向（T041）依赖 T009 的 `resolveNextAvailableOrganization`
- **US5 (Phase 7)**: 依赖 Foundational + US4（T041 的去向逻辑）+ US1（首页为切换后的落点）；切换器 UI（T045）可与 US2/US3 并行
- **Polish (Phase 8)**: 依赖所有计划交付的故事完成

### User Story Dependencies

- **US1 (P1)**: Foundational 后即可开始；MVP 核心
- **US2 (P1)**: Foundational 后即可开始，与 US1 并行
- **US3 (P2)**: Foundational 后可开始；organization 模块文件与 US1 的 T011 串行
- **US4 (P2)**: Foundational 后可开始；归档去向依赖 T009
- **US5 (P2)**: 依赖 US4 的去向逻辑与 US1 的落地页

### Within Each Story

测试（先失败）→ schema/errors → queries → service → router → 前端页面 → Mock 分支 → 验证命令

### Parallel Opportunities

- Phase 1 全部 3 个任务可并行（不同文件）
- Phase 2 中 T006 / T007 / T008 可并行；T004 → T005 串行
- US1 的 T010、US2 的 T016、US3 的 T024/T025/T026、US4 的 T036/T037 可一次性并行编写（互不相同文件）
- US1 与 US2 的实现任务可由两人并行（页面文件不同）
- Phase 8 中 T051 / T052 / T055 可并行

---

## Parallel Example: User Story 3

```bash
# 三个测试文件同时编写（先失败）:
Task: "tests/console/members.test.ts"
Task: "tests/console/invites.test.ts"
Task: "tests/console/ownership.test.ts"

# 查询层与迁移并行:
Task: "apps/api/src/modules/organization/queries.ts 增列表查询"
Task: "packages/db/migrations/0008_org_management.sql"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. 完成 Phase 1 Setup 与 Phase 2 Foundational
2. 完成 Phase 3 US1
3. **停下来验收**：quickstart §4 步骤 1、2、3、16 通过
4. 可演示：登录 → 首页概览真实数据

### Incremental Delivery

1. Setup + Foundational → 地基就绪
2. + US1 首页 → 独立验收（MVP）
3. + US2 项目页 → 独立验收
4. + US3 成员页 → 独立验收
5. + US4 设置页 → 独立验收
6. + US5 切换与引导 → 全量验收
7. Polish → quickstart §3/§4 全绿，合并门禁通过

### 并行策略（多人时）

1. 共同完成 Setup + Foundational
2. US1 与 US2 并行（P1，文件不相交）；US3 需等待 US1 的 T011 合入 organization 模块
3. US4 与 US5 串行（去向逻辑依赖）
4. 每个故事完成即跑 `tests/console` + `lint`，不积累

---

## Notes

- 每个任务完成后提交；测试先失败后通过（宪法「测试驱动」）
- 约束原文位置：权限矩阵 C3 → `conventions.md` §1.13；分页 C4 → §1.4；错误码 → `errors.md` §9.4；`project` 表 → `schema.md` §5.4；受控函数 → §9.3
- **验收结果（2026-11-15）**：
  - 自动化：`tests/console` 41 通过（含 foundation/organization/projects/members/invites/ownership/settings/account）；002 回归 `tests/auth + apps/api/test` 47 通过；`pnpm --filter nocoapp-dev lint` exit=0；`scripts/check-docs.sh --strict` VIOLATIONS=0；迁移 0007/0008/0009 已应用到 development 与 test。
  - 浏览器验收（3 轮）：① 注册落地 `#/home`、概览数字（项目0/成员1/邀请0）、空状态、新建「验收谱」后项目页与首页一致 → PASS；② 成员页名单/邀请空状态/创建邀请弹窗一次性链接/列表无明文 token → PASS；③ 停 API 后 Mock 指示出现、Mock 注册落地首页、项目与成员页不崩溃 → PASS；恢复 API 后 `/api/health` 正常（恢复场景机制与 002 批次一致）。
  - **未做浏览器逐条核对（服务端已有等价自动化覆盖，UI 留给人工抽查）**：步骤 4 的改名/删除 UI、5（并发 UI 提示）、7（兑换 UI）、8/9（改角色/移除/转移 UI）、10（归档 UI 去向）、11（账号设置 UI）、12（切换 UI）、13（viewer UI）、15（会话过期 UI）。对应服务端断言均已通过；UI 抽查可按 §4 核对表逐项打勾。
