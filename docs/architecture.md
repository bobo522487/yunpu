# Yunpu System Architecture

本文档描述 Yunpu 仓库的整体架构、运行技术栈、模块职责、依赖方向与系统边界。所有路径与组件均对照当前代码实现整理。

---

## 一、运行环境与技术栈

- **运行时与包管理**：Node.js `>=26.13.0`（原生 TypeScript 类型剥离，经 `scripts/ts-ext-register.mjs` 注册），`pnpm@12.18.0`（workspace 只包含 `apps/api` 与 `packages/*`）。本仓库禁止使用 Bun 运行时或 `bun:test`。
- **后端（`@yunpu/api`）**：Hono `4.13.19` + `@hono/node-server` + Zod `4.6.7` + Better Auth `1.7.27` + Drizzle ORM `0.45.4` + `pg` `8.23.1` + `@aws-sdk/client-s3`。只提供 `/api/*` JSON，不渲染登录页。
- **前端**：独立仓库 `yunpu-web`（Bun + Vite + React）。本仓库通过 `pnpm contract:export` 生成 `contracts/openapi.json`（Hono 路由 + `@yunpu/shared` Zod schema）。跨源联调可配置 `CORS_ORIGINS`；同源联调优先走前端 dev server 的 `/api` 代理。见 [ADR-0008](adr/ADR-0008-polyrepo-contract.md)。
- **数据存储与基础设施**：PostgreSQL 18（启用 `ltree` 扩展与 `FORCE ROW LEVEL SECURITY`）、S3 兼容对象存储（测试/开发环境由 `scripts/env.sh` 拉起容器，使用 `pgsty/silo`）。
- **代码检查与测试**：Biome `2.2.6`（`pnpm lint`）、Vitest `5.1.0`。`apps/api/tsconfig.json` 使用 `moduleResolution: bundler`，与仓库里的无扩展名 `.ts` 导入一致。

---

## 二、工作区与模块划分

```text
yunpu/
├── apps/
│   ├── api/                 # Hono API 服务、Better Auth 挂载、租户事务与业务模块
│   │   ├── src/
│   │   │   ├── app.ts       # Hono 根应用、全局中间件、错误兜底、/api/health、/api/ready、导出 AppType
│   │   │   ├── index.ts     # 进程启动入口（初始化 S3、启动 HTTP 服务、SIGTERM/SIGINT 优雅关闭连接池）
│   │   │   ├── access.ts    # 组织成员角色检查（非成员 404 / 权限不足 403 / 所有者冲突 409）
│   │   │   ├── media.ts     # 独立媒体/存储探测端点
│   │   │   ├── storage.ts   # S3 客户端初始化与健康检查
│   │   │   ├── db/
│   │   │   │   └── with-tenant-transaction.ts  # 业务租户唯一事务入口与瞬态重试
│   │   │   ├── lib/
│   │   │   │   ├── http.ts     # 路由共用的 HTTP 助手（如 Set-Cookie 透传）
│   │   │   │   ├── errors.ts   # 唯一的数据库错误码到 HTTP 结果映射
│   │   │   │   └── sql.ts      # 统一 SQL 时间格式等片段助手
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts  # 会话校验中间件
│   │   │   └── modules/     # 业务领域模块：auth / organization / project / account / person
│   │   └── test/            # API 单元与集成测试
├── contracts/
│   └── openapi.json         # 只读契约，由 scripts/export-contract.ts 生成
├── packages/
│   ├── db/                  # PostgreSQL Drizzle schema（auth / tenant / genealogy）与 SQL 迁移（0000~0014）
│   └── shared/              # 跨端共享枚举（enums.ts）、错误定义（errors.ts）、校验 Schema（schemas.ts）
├── scripts/                 # env.sh、ts-ext-register.mjs、export-contract.ts
└── tests/                   # 端到端集成测试（env / auth / console / genealogy / runtime / security）
```

### API 业务模块职责

`apps/api/src/modules/` 下按业务域分模块，所有路由统一挂载于 `/api/v1`（`app.ts` 导出 `AppType`）：

| 模块 | 挂载与职责 | 主要文件 |
| :--- | :--- | :--- |
| `auth` | 登录、注册、登出、Better Auth 集成、默认组织上下文与新用户配置 | `better-auth.ts`, `router.ts`, `service.ts`, `provisioning.ts` |
| `organization` | 组织创建、切换、成员角色管理、所有权转移、邀请创建/撤回/兑换 | `router.ts`, `service.ts`, `queries.ts`, `schema.ts`, `errors.ts` |
| `project` | 组织下谱系项目 CRUD 与项目元数据（姓氏、堂号、源流、配色主题等） | `router.ts`, `service.ts`, `queries.ts`, `schema.ts`, `errors.ts` |
| `account` | 当前登录用户个人资料与账户操作 | `router.ts`, `service.ts` |
| `person` | 谱系人物 CRUD、多姓名（`person_name`）、人物关系（`person_relation`）与受控子图查询 | `router.ts`, `service.ts`, `queries.ts`, `schema.ts`, `errors.ts` |

---

## 三、依赖方向与架构护栏

由根目录 `biome.json` 的 `noRestrictedImports` 与 `tests/runtime/` 共同强制约束：

1. **包级单向依赖**：`packages/shared` 不得导入 `apps/**` 或 `**/modules/**`。
2. **模块封装边界**：任意文件不得跨模块导入其他模块的 `queries.ts`、`*.repo` 或 `*.route`，模块间协作只能调用对方的 `service.ts` 对外 API。
3. **禁止无意义中间层**：请求链路直接为 `router`（Zod 参数校验）→ `service`（事务与领域逻辑）→ `queries`（Drizzle 查询），禁止引入只做原样拷贝的 `mapper` 或 `.repo.ts` 层（由 `tests/runtime/no-passthrough-layer.test.ts` 验证）。
4. **唯一租户数据库入口**：`apps/api/src/modules/**` 禁止导入 `db/pool`、`businessPool`、`withUser` 或调用 `createDb`（`modules/auth/better-auth.ts` 访问独立 `auth` schema 除外），统一经 `withTenantTransaction` 访问租户表。

---

## 四、数据模型概览

数据库分为两个主要 schema（定义位于 `packages/db/src/schema/`）：

- **`auth` schema**（Better Auth 管理）：`auth.user`、`auth.session`、`auth.account`、`auth.verification`。
- **`public` 租户与谱系 schema**（启用 `FORCE ROW LEVEL SECURITY`）：
  - **组织与协作**：`organization`、`organization_member`、`invite`、`project`、`audit_log`。
  - **谱系核心**：`person`、`person_name`、`person_relation`、`lineage_projection`（使用 `ltree` 存储主脉路径与世代）。

数据库级不变量（在 `0012`~`0022` 迁移中落地）包括：人物在世/生卒年份约束、同名类型唯一与唯一主名部分索引、关系防自环与配偶规范序（`from_person_id < to_person_id`）、父母边上限（`GX011`）、归档组织禁止写入（`GX012`）、环检测延迟约束触发器（`GX001`）与基于角色的行级写策略。谱系投影由 0017 之后的逐边增量 reflow 维护，不再全表重建，也不再静默截断 64 代；路径前缀索引为 btree 文本前缀而非 ltree GiST，避免索引膨胀。项目与人物统一使用整数 `version` 做 CAS（0019），不再用 `updated_at` 字符串作为并发令牌。

HTTP 契约的唯一权威是 `apps/api/src/openapi/operations.ts`；`scripts/export-contract.ts` 从注册表生成 `contracts/openapi.json`，CI 的 `contract:check` 防止路由与契约漂移。校验错误统一为裸 `fieldErrors`，详见 ADR-0012。

---

## 五、租户事务与系统边界

业务请求与后台任务读写任何租户表，**必须且只能**通过 `apps/api/src/db/with-tenant-transaction.ts` 的 `withTenantTransaction({ userId }, fn)`：

- `BEGIN` 与 `SET LOCAL ROLE genealogy_app` 合并为一次简单协议往返；随后用一条 `SELECT set_config('app.user_id', $1, true), current_user` 同时写入事务局部身份并断言角色，前置往返由 5 次降为 2 次。
- `app.current_org_id` 从未被任何 RLS 策略读取，已从租户入口移除；租户隔离只依赖 `app.user_id`、RLS 谓词与成员角色校验。
- 连接释放前事务结束（`COMMIT` 或 `ROLLBACK`），`SET LOCAL` 作用域自动失效；`ROLLBACK` 失败、连接级故障或角色断言失败时以 `release(true)` 销毁会话，避免连接池复用导致跨租户串数据。
- `authMiddleware` 只挂在 `/api/v1/*`；`/api/health`、`/api/ready` 与 `/api/media/*` 不查会话。列表接口统一使用共享分页 schema 与 `limit + 1` 游标，游标非法时在查库前返回 `VALIDATION`。

**仅有的三处非租户事务入口（严禁普通业务复用）：**

1. **健康检查（`apps/api/src/app.ts` `probeDatabase`）**：复用 `businessPool` 仅执行 `SELECT version()`，供 `/api/health` 与 `/api/ready` 探测数据库连通性与 PostgreSQL 18 版本；不新建短连接，也不访问租户表。
2. **认证库（`apps/api/src/modules/auth/better-auth.ts` `authDatabase`）**：使用 `AUTH_DATABASE_URL` 独立连接池，只访问 `auth` schema 下的表，不查询业务租户表。
3. **数据库迁移（`packages/db/src/migrate.ts`）**：使用迁移命令行独立连接执行跨租户 DDL 与策略变更，HTTP 请求与普通后台任务禁止借用。

新增第四种例外时，必须同步更新本文档并在 `docs/adr/` 记录原因。当前系统不存在「事务提交后再异步删除外部对象」的产品级写入流程。
