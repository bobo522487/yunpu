# Tasks: 开发与测试环境（Development & Test Environment）

> **执行原则**：按依赖顺序逐批执行；修改前先查看现有实现；不擅自扩大范围；每完成一个任务即运行对应测试并更新状态；发现 `spec.md` 缺失或 `plan.md` 冲突时立即暂停报告。
>
> 本清单是 `001-dev-test-environment` 的历史执行档案：所有任务已于 2026-11-14 完成（T-030 当时记为 partial，见第 3 节说明）。原 Phase 1~7 按用户故事组织，此处折叠为统一清单；`[P]` 表示不同文件无依赖可并行，`[US1/US2/US3]` 为故事可追溯标签。测试为 `vitest run --config vitest.config.ts` 打到真实测试环境，先写失败测试再写实现。技术栈表述已对齐当前独立后端架构（Node 26 / pnpm / Hono 4.13.19 / silo）。

- **输入**：[spec.md](./spec.md)、[plan.md](./plan.md)

## 1. 开发任务清单

| ID | 状态 | 依赖 | 关联需求 | 任务描述 | 修改范围 & 变更类型（迁移/API/配置） | 测试要求 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `T-001` | `[x]` | - | `FR-001`/`FR-014` | 建根 `package.json`：`"packageManager": "pnpm@12.18.0"`、`engines.node>=26.13.0`，脚本调 `scripts/env.sh` 与 `vitest run --config vitest.config.ts`；不得出现 `bun`/`bun:test`/`bun install`/`bun add`/`bun.lock` | `package.json`（配置） | 脚本与引擎枚举检查；Vitest 串行配置断言（`fileParallelism:false`、`sequence.concurrent:false`、`testTimeout`/`hookTimeout` 60s——后者高于官方默认 5s/10s 以覆盖容器起停） |
| `T-002` | `[x]` | - | `FR-001` | 建 `pnpm-workspace.yaml`，列 `apps/api`（后续包另加） | `pnpm-workspace.yaml`（配置） | 工作区解析检查 |
| `T-003` | `[x]` | - | `FR-001`/`FR-014` | 建 `apps/api/package.json`，依赖 `hono@4.13.19`/`@hono/node-server`/`zod@4.6.7`/`pg@8.23.1`/`@aws-sdk/client-s3` | `apps/api/package.json`（配置） | 依赖版本检查 |
| `T-004` | `[x]` | - | `FR-002`/`FR-004` | 建 `.env.example`：development(`yunpu_dev`,3001/5432/9000) 与 test(`yunpu_test`,3010/5433/9010)，每环境一把独立非空能力令牌与独立存储凭证 | `.env.example`（配置） | 枚举与令牌检查 |
| `T-005` | `[x]` | - | `FR-001` | 更新 `.gitignore`：忽略 `.env`/`.env.test`/`.local/` | `.gitignore`（配置） | 忽略规则检查 |
| `T-006` | `[x]` | `T-001` | `FR-014` | 根目录 `pnpm install` 生成 `pnpm-lock.yaml`；后续统一 `--frozen-lockfile` | `pnpm-lock.yaml`（配置） | 冻结安装检查 |
| `T-007` | `[x]` | `T-001` | `FR-003`/`FR-008` | `apps/api/src/env.ts`：`YUNPU_ENV` 仅 development/test，库名成对、认证目标为 `auth_runtime`，拒 `yunpu_prod` 与生产目标，令牌非空；解析失败打印字段并非零退出、不监听端口 | `apps/api/src/env.ts`（API/配置） | 非法配置非零退出断言 |
| `T-008` | `[x]` | `T-006` | `FR-001`/`FR-002` | `compose.yaml` 只含 `postgres:18` 与单节点 `docker.io/pgsty/silo server /data`；PG 健康用 `pg_isready` 退出码 0，存储健康用 `GET /minio/health/live` 200；`POSTGRES_USER=postgres` 为超级用户 owner 而非 `genealogy_app`；不加 PgBouncer/Redis/队列/搜索 | `compose.yaml`（配置） | 仅两服务、健康检查断言 |
| `T-009` | `[x]` | `T-008` | `FR-005`/`FR-006` | `docker/postgres/init/01-role.sql` 建 `genealogy_app LOGIN NOSUPERUSER NOBYPASSRLS`、`rls_definer NOLOGIN BYPASSRLS`、`auth_runtime`，仅在空数据目录执行；`env.sh` 的 `buildRoles` 在已有卷幂等补齐 | `docker/postgres/init/01-role.sql`、`scripts/env.sh`（配置） | 角色权限断言 |
| `T-010` | `[x]` | `T-007` | `FR-001` | `apps/api/src/index.ts` 监听前先调 `env.ts`，用 `@hono/node-server` 的 `serve({ fetch: app.fetch, port, hostname: "127.0.0.1" })` 启动，注册 SIGTERM/SIGINT 优雅关闭并释放连接池 | `apps/api/src/index.ts`（API） | 启动顺序与监听地址检查 |
| `T-011` | `[x]` | `T-007` | `FR-001`/`FR-003` | `scripts/env.sh` 参数与前置于卫：动作 `up\|down\|reset\|ready`，环境名 development/test；其他名（含 production）非零退出并列允许值；缺 `docker`/`podman`/`pnpm`/`node` 打印缺失的工具名（容器运行时只需其一）并非零退出 | `scripts/env.sh`（配置） | 非法参数非零退出断言 |
| `T-012` | `[x]` | `T-011` | `FR-004` | [P][US1] 写失败测试 `tests/env/dev-surface.test.ts`：`GET /api/health` 200 体为 `{ok:true,checks:{process:"up",database:"up"}}` 且无 `storage` 字段；`GET /api/ready` 三项 up | `tests/env/dev-surface.test.ts`（测试） | 失败先行验证 |
| `T-013` | `[x]` | `T-012` | `FR-004` | [US1] `apps/api/src/app.ts` 实现 `GET /api/health`：库可查时 200 上述形状，不可查时 503 `ok:false`/`database:down`；不含 `storage`、不查代际 | `apps/api/src/app.ts`（API） | Hono 官方 `app.request("/api/health")` 断言 200/503，无需起监听服务 |
| `T-014` | `[x]` | `T-012` | `FR-004`/`FR-013` | [US1] `GET /api/ready`：10 秒内返回，三项 `up` 且 `version` 含 `PostgreSQL 18` 才 200，否则 503 带 `reason`；`storage:up` 要求存活 200 且本环境凭证可访问桶 | `apps/api/src/app.ts`（API） | 200/503 双路断言 |
| `T-015` | `[x]` | `T-012` | `FR-011` | [US1] 应用只输出 JSON：挂 `/api/v1/*` 业务路由与 `/api/media`，不提供 `GET /` 页面；初始不预置真实客户/家族资料 | `apps/api/src/app.ts`（API） | 路由枚举、无页面端点断言 |
| `T-016` | `[x]` | `T-012` | `FR-007` | [P][US1] `apps/api/src/storage.ts` 用 `@aws-sdk/client-s3` 配 `endpoint` 指向本环境存储、`forcePathStyle: true`（官方默认 false 且无 env 开关，路径风格才能定址 silo 的桶）、显式 `credentials`，启动时确认私有桶可用，失败则进程退出；不设匿名策略 | `apps/api/src/storage.ts`（API） | 私有桶、`forcePathStyle` 与显式凭证断言 |
| `T-017` | `[x]` | `T-011`/`T-014` | `FR-001`/`FR-012` | [US1] `scripts/env.sh` 的 development `up`/`ready`/`down`：项目 `yunpu-dev`、库 `yunpu_dev`、端口 3001/5432/9000；已运行则复用卷，端口被占则退出并指出；仅 `GET /api/ready` 为 `ok:true` 退出 0；`down` 停 `.local/` 内 pid 与两容器、释放端口、保留卷 | `scripts/env.sh`（配置） | 生命周期脚本断言 |
| `T-018` | `[x]` | `T-011` | `FR-006`/`FR-007`/`FR-013` | [P][US2] 写失败测试 `tests/env/infrastructure.test.ts`：测试环境 down 时拒绝跳过；用真实库证明租户隔离、`SELECT version()` 含 `PostgreSQL 18`、直读对象非 200、另一环境令牌被拒 | `tests/env/infrastructure.test.ts`（测试） | 失败先行验证 |
| `T-019` | `[x]` | `T-018` | `FR-009` | [US2] `up test`：项目 `yunpu-test`、库 `yunpu_test`、端口 3010/5433/9010；每次启动前删本环境数据库与对象卷，不动 `yunpu-dev` | `scripts/env.sh`（配置） | 空起点断言 |
| `T-020` | `[x]` | `T-018` | `FR-011` | [US2] 测试环境首次就绪后经真实库查询业务表为空，不预置数据，也不含真实家族资料 | `tests/env/infrastructure.test.ts`（测试） | 空起点查询断言 |
| `T-021` | `[x]` | `T-018` | `FR-007` | [P][US2] `apps/api/src/media.ts` 实现 `POST /api/media` 与 `GET /api/media/*`：正文 ≤1MB、键由应用生成且格式受限、本环境正确 Bearer 令牌写 201 读回同字节 | `apps/api/src/media.ts`（API） | 读写往返断言 |
| `T-022` | `[x]` | `T-021` | `FR-007` | [US2] 令牌缺失/错误/跨环境时 media 调用 401、键不存在 404、键格式非法 400、正文超限 413；不加产品登录 | `apps/api/src/media.ts`（API） | 401/404/400/413 断言 |
| `T-023` | `[x]` | `T-018` | `FR-006` | [US2] `tests/env/proof-fixture.ts` 建证明夹具并由 infrastructure 测试调用：owner 建、`genealogy_app` 为 `NOSUPERUSER NOBYPASSRLS`、启用并强制行安全、无租户过滤的 select 只读当前租户；测试结束（含失败）删除 | `tests/env/proof-fixture.ts`（测试） | 行安全隔离断言 |
| `T-024` | `[x]` | `T-011` | `FR-009`/`FR-012` | [P][US3] 写失败测试 `tests/env/lifecycle.test.ts`：开发数据经 `down`→`up` 仍在、测试环境下次 `up test` 后数据消失、恢复一环境不改另一环境对象数 | `tests/env/lifecycle.test.ts`（测试） | 失败先行验证 |
| `T-025` | `[x]` | `T-024` | `FR-012` | [US3] `scripts/env.sh` 的 `reset`：只删点名环境的卷再走 `up` 路径；两环境都回到空起点、旧对象消失、2 分钟内 `ok:true` | `scripts/env.sh`（配置） | 恢复时间断言 |
| `T-026` | `[x]` | `T-025` | `FR-012` | [US3] `reset`/`down`/`up` 不得移除另一项目；恢复期间到达的写在恢复后不保留 | `scripts/env.sh`（配置） | 跨环境隔离断言 |
| `T-027` | `[x]` | `T-014` | `FR-004` | [P] 把 `GET /api/ready` 与 `GET /api/health` 的分工写入 `docs/architecture.md`（端点说明与错误信封约定），不向错误码文档加领域错误码 | `docs/architecture.md`（文档） | 端点说明检查 |
| `T-028` | `[x]` | `T-017`/`T-019`/`T-025` | 全部 | 走 spec 的验收场景，只修违反原契约的失败 | `specs/001-dev-test-environment/`（文档/验收） | 场景逐条验收 |
| `T-029` | `[x]` | `T-008` | `FR-014` | 确认 `compose.yaml` 仍恰好两服务、仓库无 `bun`/`bun:test`/`bun.lock` | `compose.yaml`/仓库根（配置） | 服务数与工具链检查 |
| `T-030` | `[x]` | `T-027` | `SC-DOC-01` | 恢复 docs 一致性门禁至 exit 0：T-027 加入的行曾引入跨文件引用违规，需转为有效链接或刷新基线后重跑 CI | `docs/architecture.md`/基线（文档） | CI 门禁 exit 0（历史记为 partial，见第 3 节） |

**执行顺序与并行**：Phase 1（Setup，T-001~T-005）→ Phase 2（Foundational，T-006~T-011，阻塞所有故事）→ 故事 P1(T-012~T-017) → P2(T-018~T-023) → P3(T-024~T-026) → Polish(T-027~T-029) → Convergence(T-030)。可并行：T-002/003/004/005；T-006 后 T-007/008/009；T-012 与 T-016；T-018 与 T-021；T-024 与 T-025；T-027 与验收场景。MVP 止于 T-017 即验证 `ready development` 退出 0 且三项就绪；每故事独立可测、先测后码、同文件不并行编辑。

## 2. 每任务完成汇报模板

完成每个任务后记录/输出：
1. 修改了哪些文件
2. 实现了哪些功能
3. 执行了哪些测试及命令
4. 测试结果
5. 是否存在遗留问题

---

## 3. 独立验收与需求追踪矩阵

> 由独立质量视角对照原始 `spec.md`、`plan.md`、`tasks.md` 与实际实现逐项核验，不能仅凭开发自证通过。原 `checklists/requirements.md` 的质量检查结论并入本矩阵说明。

| 需求 ID | 实现位置 | 测试用例 | 静态/集成检查 | 验收结果 |
| :--- | :--- | :--- | :--- | :--- |
| `FR-001` | `compose.yaml`、`apps/api/src/index.ts`、`scripts/env.sh` | T-012、T-017 | `vitest run --config vitest.config.ts` | `[Pass]` |
| `FR-002` | `.env.example`、`compose.yaml` | T-004、T-008 | 配置枚举检查 | `[Pass]` |
| `FR-003` | `apps/api/src/env.ts`、`scripts/env.sh` | T-007、T-011 | 非法参数非零退出 | `[Pass]` |
| `FR-004` | `apps/api/src/app.ts`（`GET /api/health`、`/api/ready`） | T-012、T-013、T-014 | Hono `app.request()` 200/503 断言（无需起服务） | `[Pass]` |
| `FR-005` | `docker/postgres/init/01-role.sql`、`scripts/env.sh` | T-009 | 角色权限断言 | `[Pass]` |
| `FR-006` | `tests/env/proof-fixture.ts`、`infrastructure.test.ts` | T-018、T-023 | 真实库行安全断言 | `[Pass]` |
| `FR-007` | `apps/api/src/storage.ts`、`media.ts` | T-016、T-021、T-022 | 私有桶/`forcePathStyle`/401/404/400/413 断言 | `[Pass]` |
| `FR-008` | `apps/api/src/env.ts` | T-007 | 非法配置非零退出 | `[Pass]` |
| `FR-009` | `scripts/env.sh`（`up test`） | T-019、T-024 | 空起点/隔离断言 | `[Pass]` |
| `FR-010` | `compose.yaml`、`scripts/env.sh` | T-008、T-017 | 项目/端口隔离检查 | `[Pass]` |
| `FR-011` | `apps/api/src/app.ts`（仅 `/api/*` JSON、无页面）、`tests/env/` | T-015、T-020 | 路由枚举、空起点查询断言 | `[Pass]` |
| `FR-012` | `scripts/env.sh`（`up`/`down`/`reset`） | T-017、T-025、T-026 | 恢复时间/隔离断言 | `[Pass]` |
| `FR-013` | `apps/api/src/app.ts`（`GET /api/ready`） | T-014、T-018 | 10 秒/三项 up 断言 | `[Pass]` |
| `FR-014` | `package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、`compose.yaml` | T-003、T-006、T-029 | 冻结安装/两服务/无 Bun 断言 | `[Pass]` |
| `SC-DOC-01` | `docs/architecture.md`、基线 | T-027、T-030 | docs 一致性门禁 exit 0 | `[Partial：历史记为 partial，门禁后被移除]`，见下说明 |

**质量检查结论（原 checklists/requirements.md）**：第 1 轮审阅（2026-11-14）全部通过——无实现细节泄漏、需求可测无歧义、成功标准可度量且技术无关、验收场景与边界齐备、范围清晰、无 `[NEEDS CLARIFICATION]`；FR-001~FR-014 均能在用户故事 Given/When/Then 中对应；未决取舍已写入 spec.md 的 Assumptions（一套开发+一套测试环境、15 分钟不含前置下载、生产部署不在范围）。

**T-030 历史说明**：该任务在原清单中即标为 `(partial)`——当时 `scripts/check-docs.sh --strict` 报 3 处新增引用违规，未能确证门禁恢复至 exit 0；其后仓库演进中 `check-docs.sh` 门禁被移除（见 `tests/runtime/no-doc-gate.test.ts`），该完成状态随历史档案保留，不改写当时结论。
