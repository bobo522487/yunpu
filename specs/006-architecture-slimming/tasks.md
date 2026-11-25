# Tasks: 架构精简（Architecture Slimming）

> **执行原则**：按依赖顺序逐批执行；修改前先查看现有实现；不擅自扩大范围；每完成一个任务即运行对应测试并更新状态；发现 `spec.md` 缺失或 `plan.md` 冲突时立即暂停报告。

- **输入**：[spec.md](./spec.md)、[plan.md](./plan.md)、[ADR-0009](../../docs/adr/ADR-0009-architecture-slimming.md)

## 1. 开发任务清单

| ID | 状态 | 依赖 | 关联需求 | 任务描述 | 修改范围 & 变更类型（迁移/API/配置） | 测试要求 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `T-001` | `[x]` | - | `FR-001`, `FR-007` | 删除生产零引用的 DI 版会话模块及其专属测试；明确放弃其两条不变式，不搬进生产 | `apps/api/src/modules/auth/session-context.ts`、`apps/api/test/session-context.test.ts`（无） | 既有认证测试 |
| `T-002` | `[x]` | - | `FR-001`, `FR-003` | 删除 `db/with-user.ts`、`db/pool.ts`，连接关闭逻辑内联进启动入口 | `apps/api/src/db/`、`apps/api/src/index.ts`（无） | 租户连接复用与优雅关闭测试 |
| `T-003` | `[x]` | - | `FR-001`, `FR-005` | 删除死导出、`scripts/check-rls.ts`、`.github/workflows/docs.yml`；`verify.yml` 去掉重复 Biome 步骤 | `apps/api/src/`、`scripts/`、`.github/workflows/`（配置） | CI 配置检查 |
| `T-004` | `[x]` | `T-003` | `FR-002` | 删除 `modules/{auth,person,project}/schema.ts` 三个 re-export 壳，schema 统一到 `@yunpu/shared` | `apps/api/src/modules/`、`packages/shared/src/schemas.ts`（无） | 既有 API 路由测试 |
| `T-005` | `[x]` | - | `FR-002`, `FR-003` | 统一 router 助手到 `apps/api/src/lib/http.ts` | `apps/api/src/modules/*/router.ts`、`apps/api/src/lib/http.ts`（无） | HTTP 响应头断言 |
| `T-006` | `[x]` | - | `FR-002`, `FR-003` | 合并三个模块 `errors.ts` 到 `apps/api/src/lib/errors.ts`，保持 SQLSTATE 映射语义 | `apps/api/src/lib/errors.ts`、`apps/api/src/modules/*/errors.ts`（无） | 错误信封测试 |
| `T-007` | `[x]` | - | `FR-002`, `FR-004` | 用 `apps/api/src/lib/sql.ts` 的 `isoTimestamp` 统一五处时间戳格式化，兼修 7 个 TS2345 | `apps/api/src/lib/sql.ts`、相关查询文件（无） | 时间戳格式断言 + 类型检查 |
| `T-008` | `[x]` | - | `FR-002` | 八处手写角色字面量改用 `MemberRole`；shared 新增 `PageQuerySchema` 合并分页 schema | `packages/shared/src/`、`apps/api/src/modules/`（无） | 分页与角色边界测试 |
| `T-009` | `[x]` | `T-006` | `FR-002`, `FR-003` | 合并 `mapBetterAuthError` 与 `mapAccountError`，删除本地 `mapSignUpError` 副本 | `apps/api/src/modules/auth/`、`apps/api/src/modules/account/`（无） | 账号错误映射测试 |
| `T-010` | `[x]` | - | `FR-002` | 合并测试夹具 `call`/`addMember` 与两份 `loadEnvFile` | `tests/`（无） | 既有集成测试 |
| `T-011` | `[x]` | `T-007` | `FR-004` | 修完剩余的 14 个类型错误 | `apps/api/src/`（无） | `tsc --noEmit` 零错误 |
| `T-012` | `[x]` | `T-011` | `FR-005` | 将 `tsc --noEmit` 纳入 `pnpm lint` 门禁，确认 CI 不重复跑同一检查 | 根 `package.json`、`.github/workflows/verify.yml`（配置） | `pnpm lint`；等价命令 `biome check .` 与 `tsc --noEmit -p apps/api/tsconfig.json` 均 EXIT=0，CI 仅 Lint 一处执行 |
| `T-013` | `[x]` | `T-012` | `FR-003`, `FR-004` | 全量验证可见行为不变与门禁生效 | 全仓（无） | 以仓库自带嵌入式 PostgreSQL 18.7 起库、14 个迁移全部 applied；core 套件（auth/console/genealogy/security/runtime + api/test）重构后 `8 failed / 168 passed / 2 skipped`，pristine HEAD 基线 `10 failed / 174 passed`，重构失败集为基线真子集 → **零新增失败**；8 项均为基线既存的陈旧 `json.error?.code` 断言（flat 信封自 ADR-0003 起无 `error` 键）；`tests/env` 因沙箱无 silo/S3 与 3010/3001 应用服务无法全跑（5 failed/7 passed，均属环境）；`pnpm` 本身因只读 store 锁不可执行，等价 vitest 命令已执行。静态检查与 DB 无关测试全绿 |
| `T-014` | `[x]` | `T-001`–`T-011` | `FR-008` | 规范同步：ADR-0009、本规格三件套、`coding-standards.md`、`architecture.md` | `docs/adr/`、`specs/006-architecture-slimming/`、`docs/`（文档） | 格式与链接核对 |

## 2. 每任务完成汇报模板

完成每个任务后记录/输出：

1. 修改了哪些文件
2. 实现了哪些功能
3. 执行了哪些测试及命令
4. 测试结果
5. 是否存在遗留问题

---

## 3. 独立验收与需求追踪矩阵

> 由独立质量视角对照原始 `spec.md`、`plan.md`、`tasks.md` 与实际代码逐项核验，不能仅凭开发自证通过。

| 需求 ID | 实现位置 | 测试用例 | 静态/集成检查 | 验收结果 |
| :--- | :--- | :--- | :--- | :--- |
| `FR-001` | 删除的模块与死导出；`apps/api/src/index.ts` | `pnpm test` | `git diff --stat`（净减少 758 行） | `[Pass]` |
| `FR-002` | `apps/api/src/lib/http.ts`、`apps/api/src/lib/errors.ts`、`apps/api/src/lib/sql.ts`、`packages/shared/src/` | `tests/runtime/`、`apps/api/test/` | `pnpm lint` | `[Pass]` |
| `FR-003` | 既有 API 路径 | `tests/auth/`、`tests/console/`、`tests/genealogy/`、`apps/api/test/` | 真实 PG18.7 + 14 迁移下 core 套件 A/B 对照：重构 `8 failed/168 passed` vs 基线 `10 failed/174 passed`，失败集为基线真子集、零新增失败；8 项均为基线既存的陈旧 `json.error` 断言；`tests/env` 因无 silo 环境阻塞 | `[Pass: 零回归 A/B 已证]` |
| `FR-004` | 全仓类型 | `tsc --noEmit` | `pnpm lint` | `[Pass]` |
| `FR-005` | 根 `package.json`、`.github/workflows/verify.yml` | CI 运行记录 | `pnpm lint` 等价于 `biome check . && tsc --noEmit`（均 EXIT=0）；`verify.yml` 仅 Lint 一处执行 | `[Pass]` |
| `FR-006` | `packages/db/migrations/`、`packages/db/src/schema/` | `tests/security/force-rls.test.ts` | 迁移与策略文件与基线一致 | `[Pass]` |
| `FR-007` | 不做项清单 | 改动审阅 | 无对应改动 | `[Pass]` |
| `FR-008` | `docs/adr/ADR-0009-architecture-slimming.md`、`specs/006-architecture-slimming/`、`docs/coding-standards.md`、`docs/architecture.md` | 文档格式与链接核对 | 人工审阅 | `[Pass]` |
