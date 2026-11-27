# Tasks: 004 谱系工作区后端持久化与演示数据初始化

> **执行原则**：按依赖顺序逐批执行；修改前先查看现有实现；不擅自扩大范围；每完成一个任务即运行对应测试并更新状态；发现 `spec.md` 缺失或 `plan.md` 冲突时立即暂停报告。

- **输入**：[spec.md](./spec.md)、[plan.md](./plan.md)

## 1. 开发任务清单

| ID | 状态 | 依赖 | 关联需求 | 任务描述 | 修改范围 & 变更类型（迁移/API/配置） | 测试要求 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `T-001` | `[x]` | - | `FR-001`~`FR-007` | 落地迁移 `0027_lineage_workspace_persistence.sql`、对齐 Drizzle schema、`@yunpu/shared` 枚举/Schema 与数据库错误映射 | `packages/db/`、`packages/shared/`、`apps/api/src/lib/errors.ts`（迁移/Schema） | `test`/`development` 迁移执行通过，现有约束无冲突 |
| `T-002` | `[x]` | `T-001` | `FR-001` | 实现平铺分组 `folder` 模块（`queries.ts` / `service.ts` / `router.ts`） | `apps/api/src/modules/folder/`（API） | 增删改查、重名 409、删除解绑与权限测试 |
| `T-003` | `[x]` | `T-002` | `FR-002`, `FR-008` | 实现谱系图 `lineage` 模块（CRUD、`version` CAS、带 `progenitor` 初始化始祖、整图读取） | `apps/api/src/modules/lineage/`（API） | `version` CAS、级联删除、整图加载与跨组织隔离测试 |
| `T-004` | `[x]` | `T-003` | `FR-003`, `FR-004` | 扩展 `project` 持久化 `ancestor` 及开谱联动初始化，并实现 `/projects/:projectId/media` 鉴权 S3 上传/读取 | `apps/api/src/modules/project/`、`packages/shared/`（API） | `ancestor` 持久/建谱联动、项目级联删除与 S3 媒体权限测试 |
| `T-005` | `[x]` | `T-003` | `FR-004`~`FR-007` | 扩展 `person` 模块：全量界面字段、`lineageId` 兼容解析、`PersonName` CRUD、7 种 `PersonRelation` + `PATCH`、`PersonEvent` CRUD | `apps/api/src/modules/person/`（API） | 人物全字段/别名/7 种关系/跨表拒连 `GX014`/事件级联测试 |
| `T-006` | `[x]` | `T-004`, `T-005` | `FR-009` | 实现新用户个人默认组织范例家族初始化，挂载全部路由、更新 `operations.ts` 与 `contracts/openapi.json` 并跑通真实 PG18 全量集成测试 | `apps/api/src/modules/auth/`、`apps/api/src/app.ts`、`apps/api/src/openapi/operations.ts`、`contracts/openapi.json`、`tests/`（API/契约/集成测试） | `pnpm run lint:api`、`pnpm contract:check`、`pnpm test:all` 全量通过 |
| `T-007` | `[x]` | `T-006` | `FR-010` | 前端彻底移除 `mockAuth`/`mockConsole`/`enableMock`/`demoAccount` 与 `api.ts` Mock 路径及测试 | `apps/web/src/lib/api.ts`、`apps/web/src/features/{auth,dashboard}/`（前端清理） | `pnpm run lint:web`、`pnpm run test:web` 通过 |
| `T-008` | `[x]` | `T-006`, `T-007` | `FR-001`~`FR-008` | 新增前端 `features/lineage/api.ts`、`queries.ts` 与服务端 DTO ↔ `PersonRecord` 双向适配层 | `apps/web/src/features/lineage/`（前端数据层） | 双向映射与错误状态单测通过 |
| `T-009` | `[x]` | `T-008` | `FR-001`~`FR-010` | 瘦身 `useLineageStore` 为纯 UI 状态；改造 `LineageTreePanel` 平铺分组、`LineagePage`、`PersonDetailPanel` 与 `PersonPortraitModal`（S3 上传）及 `DashboardPage`/`WorkspaceHomePage` 同步失效缓存 | `apps/web/src/store/`、`apps/web/src/features/{lineage,project,dashboard}/`（前端页面与状态） | `pnpm run lint:web`、`pnpm run build:web`、`pnpm run test:web` 通过 |
| `T-010` | `[x]` | `T-009` | `AC-001`~`AC-010` | 补齐并跑通全栈 Playwright E2E（新用户范例项目、平铺文件夹、多谱系切换、人物/别名/关系/事件持久化、刷新一致与删除） | `apps/web/e2e/`（E2E 测试） | 全量 `test:e2e` 与 `test:web:browser` 通过 |
| `T-011` | `[x]` | `T-010` | `FR-001`~`FR-010` | 同步更新 `docs/architecture.md`、`docs/glossary.md`，新增 `ADR-0018` | `docs/`、`docs/adr/`（文档） | `pnpm run lint` 与 `pnpm contract:check` 通过 |
| `T-012` | `[x]` | `T-011` | `FR-001`~`FR-010` | 对照 `spec.md`、`plan.md`、`tasks.md` 与实际代码执行独立验收并填写追踪矩阵 | `specs/004-lineage-workspace-persistence/tasks.md`（独立验收） | 全仓静态检查与全量回归通过 |

---

## 2. 独立验收与需求追踪矩阵

| 需求 ID | 实现位置 | 测试用例 | 静态/集成检查 | 验收结果 |
| :--- | :--- | :--- | :--- | :--- |
| `FR-001` | `packages/db/src/schema/genealogy.ts`（`folder`）、`apps/api/src/modules/folder/`、`apps/web/src/features/project/components/LineageTreePanel.tsx` | `tests/genealogy/folder-lineage.test.ts`、`apps/web/e2e/lineage/lineage-workspace.spec.ts` | `pnpm run lint`、`pnpm contract:check`、`test:all`、`test:e2e` | Pass |
| `FR-002` | `packages/db/src/schema/genealogy.ts`（`lineage`）、`apps/api/src/modules/lineage/`、`apps/web/src/features/project/components/{LineageTreePanel,LineageEditorModal}.tsx` | `tests/genealogy/folder-lineage.test.ts`、`apps/web/e2e/lineage/lineage-workspace.spec.ts` | `pnpm run lint`、`pnpm contract:check`、`test:all`、`test:e2e` | Pass |
| `FR-003` | `packages/db/src/schema/tenant.ts`（`project.ancestor`）、`apps/api/src/modules/project/`、`apps/web/src/features/{dashboard/api.ts,project/pages/ProjectSettingsPage.tsx}` | `tests/console/projects.test.ts`、`apps/web/e2e/console/project-crud-cas.spec.ts` | `pnpm run lint`、`pnpm contract:check`、`test:all`、`test:e2e` | Pass |
| `FR-004` | `packages/db/src/schema/genealogy.ts`（`person`）、`apps/api/src/modules/{person,project}/`、`apps/web/src/features/lineage/{api,adapter,mutations}.ts`、`PersonPortraitModal.tsx` | `tests/genealogy/person-extended.test.ts`、`tests/genealogy/person-crud.test.ts`、`apps/api/test/media-boundary.test.ts`、`apps/web/src/features/lineage/adapter.test.ts`、`apps/web/e2e/lineage/lineage-workspace.spec.ts` | `pnpm run lint`、`pnpm run test:web`、`test:all`、`test:e2e` | Pass |
| `FR-005` | `packages/db/src/schema/genealogy.ts`（`person_name`）、`apps/api/src/modules/person/`、`apps/web/src/features/lineage/{api,adapter,mutations}.ts`、`PersonDetailPanel.tsx` | `tests/genealogy/person-extended.test.ts`、`apps/web/src/features/lineage/adapter.test.ts`、`apps/web/e2e/lineage/lineage-workspace.spec.ts` | `pnpm run lint`、`pnpm run test:web`、`test:all`、`test:e2e` | Pass |
| `FR-006` | `packages/db/src/schema/genealogy.ts`（`person_relation`）、`apps/api/src/modules/person/`、`apps/web/src/features/lineage/{api,adapter,mutations}.ts` | `tests/genealogy/relations.test.ts`、`tests/genealogy/person-extended.test.ts`、`apps/web/src/features/lineage/adapter.test.ts`、`apps/web/e2e/lineage/lineage-workspace.spec.ts` | `pnpm run lint`、`pnpm run test:web`、`test:all`、`test:e2e` | Pass |
| `FR-007` | `packages/db/src/schema/genealogy.ts`（`person_event`）、`apps/api/src/modules/person/`、`apps/web/src/features/lineage/{api,adapter,mutations}.ts`、`PersonDetailPanel.tsx` | `tests/genealogy/person-extended.test.ts`、`apps/web/src/features/lineage/adapter.test.ts`、`apps/web/e2e/lineage/lineage-workspace.spec.ts` | `pnpm run lint`、`pnpm run test:web`、`test:all`、`test:e2e` | Pass |
| `FR-008` | `apps/api/src/modules/person/`（`getLineageGraph` 与受控子图）、`apps/web/src/features/lineage/{queries,adapter}.ts`、`LineagePage.tsx`、`DashboardPage.tsx`、`WorkspaceHomePage.tsx` | `tests/genealogy/subgraph.test.ts`、`apps/web/src/features/lineage/adapter.test.ts`、`apps/web/e2e/lineage/lineage-workspace.spec.ts` | `pnpm run lint:web`、`pnpm run build:web`、`pnpm run test:web:browser`、`test:e2e` | Pass |
| `FR-009` | `apps/api/src/modules/auth/{demo-seed,provisioning}.ts` | `tests/auth/demo-provisioning.test.ts`、`apps/web/e2e/lineage/lineage-workspace.spec.ts`、`apps/web/e2e/auth/onboarding-and-invites.spec.ts` | `pnpm run lint:api`、`test:all`、`test:e2e` | Pass |
| `FR-010` | `apps/web/src/lib/{api,apiMode}.ts`、`apps/web/src/store/useLineageStore.ts`、`apps/web/src/main.tsx`、`apps/web/src/features/auth/pages/LoginPage.tsx` | `apps/web/src/lib/{api-mode,api-transport}.test.ts`、`apps/web/src/features/lineage/{lineage-refactor,lineage-ssot}.test.ts`、`apps/web/e2e/auth/register-login-logout.spec.ts` | `pnpm run lint`、`pnpm run test:web`、`pnpm run test:web:browser`、`test:e2e` | Pass |
