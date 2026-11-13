# 技术栈、锁定版本与官方依据

> 本文件是「技术选型、锁定版本、Phase 0 调研与官方依据」的唯一权威；其他主题见 `docs/README.md` 导航，同一主题不复制表格。

## 0. 调研摘要

| 结论                                                         | 影响                                               | 出处 |
| ------------------------------------------------------------ | -------------------------------------------------- | ---- |
| 中间件是洋葱模型（进入正序、返回逆序）                       | `requestId` 必须最先注册；`onError` 不能写成中间件 | §1   |
| 官方 `createFactory({ initApp })` 支持跨文件 DI | 本项目按 `ARCH-HONO-01` 选 `Hono<AppEnv>` + `c.get()` | §1   |
| `ContextVariableMap` 全局增强会掩盖 `undefined`              | 不声明全局模块扩展                                 | §1   |
| 官方 `@hono/zod-openapi` 的请求 schema 与 `zValidator` 是同一份 Zod 对象 | 不引入第三方 `hono-openapi`                        | §1   |
| Drizzle `generatedAlwaysAs` 必须显式写 `{ mode: 'stored' }`  | `ltree` 列不会因默认值变更而报 `0A000`             | §5   |
| Drizzle `pgPolicy()` **不生成** `FORCE ROW LEVEL SECURITY`   | RLS 策略不能以 Drizzle 为唯一来源                  | §5   |
| PG 18 的 `NOT NULL` 进入 `pg_constraint`（`contype='n'`）    | 所有 `NOT NULL` 一律具名                           | §6   |
| PG 18 **没有** `ALTER CONSTRAINT ... SET NOT VALID`          | 大表加约束走 `ADD ... NOT VALID` → `VALIDATE`      | §9   |
| 核心 RLS 谓词 `= ANY ((SELECT f()))` 待复现          | 必须写 `= ANY (f())`                               | §9   |

> **PostgreSQL 18（待验证；本机无 `psql`，未实测）**：本文件的 PG 18 结论均来自官方文档，未在本机复现；复现步骤与状态登记见 [`../verification/README.md`](../verification/README.md)，D1–D12 缺陷清单见 [`../decisions/0001-pg18-defects.md`](../decisions/0001-pg18-defects.md)。

---

## 1. Hono（4.13.18，锁定）

### 1.1 选型结论

| 结论                                                         | 官方来源                                                     | 本项目的具体用法                                             |
| ------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------ |
| Hono 基于 Web Standard，不绑定运行时；RPC 模式免 codegen；中间件为洋葱模型 | [Middleware Guide](https://hono.dev/docs/guides/middleware) · [RPC Guide](https://hono.dev/docs/guides/rpc) | 选 Hono 而非 Express/Nest：一份代码同时服务 Bun 运行时，RPC 类型从后端 `AppType` 推导，**不手写请求路径**（`ARCH-HONO-12`） |
| 中间件在 `next()` **之前**按注册顺序执行，**之后**按注册顺序的**逆序**执行 | [Middleware Guide](https://hono.dev/docs/guides/middleware)  | 中间件链固定为 `requestId → secureHeaders → compress → requestContext → authMiddleware → rateLimit`；`requestId` 必须最先注册，否则后续日志拿不到 requestId（`ARCH-HONO-02`） |
| `c.error` 在 `await next()` **之后**可读                     | [Context API](https://hono.dev/docs/api/context)             | 日志中间件在 `await next()` 后读 `c.error` 补记路由与用户维度，**不需要在每个 handler 里写 try/catch**（§13） |
| 官方 `createFactory({ initApp })` 可为 `createApp()` 产出的 app 注册中间件并注入运行时依赖 | [Factory Helper](https://hono.dev/docs/helpers/factory) | 本项目按 `ARCH-HONO-01` 选 `Hono<AppEnv>` + `c.get()`：装配集中在 `app.ts`、测试用 `app.request(input, init, env)` 注入 mock；`createMiddleware` 仍用于共享中间件以自动带上 `AppEnv` 类型（`ARCH-HONO-05`）。这是取舍，不是「官方不支持」，逐字引文见第 6.1 节 |
| `ContextVariableMap` 是**全局**增强，会掩盖运行时的 `undefined` | [Context API — ContextVariableMap](https://hono.dev/docs/api/context) | **不做** `declare module 'hono'` 全局增强；业务变量全部声明在 `AppEnv` 的 `Variables` 上，作用域限定在真正使用它的 app 实例（`ARCH-HONO-05`） |
| RPC 类型推断要求：**全链式调用** + **从已声明的具名变量推断** | [RPC Guide](https://hono.dev/docs/guides/rpc) · [Best Practices](https://hono.dev/docs/guides/best-practices) | 每个模块的 `router.ts` 导出 `export const routes = app.get(...).post(...)`；顶层 `export const routes = app.route(...)`；拆成多条语句会让 `hc()` 类型推导**静默失效**（`ARCH-RPC-01`） |
| `validator` 各 target 的取值来源是确定的；`json` target **仅当** `Content-Type` 匹配 `application/json` 或 `*+json` 时才解析，否则取到空对象 `{}` | [hono/validator 源码](https://github.com/honojs/hono/blob/v4.13.18/src/validator/validator.ts) | 写接口统一校验 `Content-Type`；`json` target 必须配 hook 统一错误体形状（`ARCH-HONO-08`、`ARCH-HONO-09`） |
| `zValidator` 的 hook 可短路请求 | [@hono/zod-validator](https://github.com/honojs/middleware/tree/8d656de46d87/packages/zod-validator) | 项目锁定 `zod@4.6.7`，上游 peer 范围只作兼容说明（见第 7 节）；校验失败由 hook 返回 `{ ok: false, code, message, details }`，前端只需处理一种形状（`ARCH-HONO-09`） |
| `HTTPException.getResponse()` **不感知 `Context`**，已设在 Context 上的响应头不会出现在它生成的 `Response` 里 | [Exception API](https://hono.dev/docs/api/exception)         | **不使用** `getResponse()`，统一用 `c.json()` 自行构造响应，保证 `secureHeaders` 与 `X-Request-Id` 不丢（§8.3） |
| 内置中间件清单与默认行为                                     | [Secure Headers](https://hono.dev/docs/middleware/builtin/secure-headers) · [Body Limit](https://hono.dev/docs/middleware/builtin/body-limit) | 制定「Hono 内置中间件选用表」：采用 `requestId` / `secureHeaders` / `compress` / `bodyLimit` / `timeout`；不采用 `cors` / `etag` / `cache` / `timing` / `logger` / `ipRestriction` 并**逐条写明理由**（`ARCH-HONO-03`） |
| `app.request(input, requestInit?, env?, executionCtx?)` 是官方测试约定 | [Hono API](https://hono.dev/docs/api/hono)                   | 路由/集成测试用第三个参数 `env` 注入 `Bindings`（`db` / `services` / `logger` / `storage`）的 mock，**不需要额外的 DI 框架**（`ARCH-TST-04`、§14.1） |
| `@hono/zod-openapi` 提供 `createRoute` / `OpenAPIHono` / `app.doc()` | [zod-openapi 示例](https://github.com/honojs/website/blob/20aab4e020e3/examples/zod-openapi.md) | 用**官方** `@hono/zod-openapi` 而非第三方 `rhinobase/hono-openapi`；`createRoute` 的请求/响应 schema 与 `zValidator` 是**同一份 Zod 对象**；Scalar 挂在 `/api/docs`（`ARCH-HONO-06`、§8.8） |

### 1.2 与 Bun 相关的 Hono 行为

| 结论                                        | 官方来源                                                     | 本项目的具体用法                                             |
| ------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `serveStatic` 存在大小写 / 8.3 短名绕过风险 | [Bun Getting Started](https://hono.dev/docs/getting-started/bun) | 静态目录**不放需授权的文件**；媒体必须走 API 鉴权代理（§17 决策摘要「静态资源」行） |
| Bun 默认导出 `{ port, fetch }` 启动方式     | [Bun Getting Started](https://hono.dev/docs/getting-started/bun) | 单个 Bun 进程同时提供 Hono API 与前端静态页（overview「技术栈」） |

> `ARCH-HONO-11`：升级 Hono 大版本前，先用 Context7 重新拉一遍 §18 官方实践表对应条目，逐条核对本文表述是否仍成立。**框架语义会变，本项目对框架的断言必须跟着变。**

---

## 2. Bun（1.4.4，锁定）

| 结论                                           | 官方来源                                                     | 本项目的具体用法                                             |
| ---------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| Bun 冷启动快、`bun test` 开箱即用、安装快      | [Bun 1.4](https://bun.sh/blog/bun-v1.4)（逐字引文见第 6.1 节，抓取日期：2026-11-13） | 运行时锁定 Bun 1.4.4；单元 / 路由 / 集成测试统一用 `bun test`（`ARCH-TST-03`） |
| Playwright now runs on Bun（官方逐字引文） | [Bun 1.4](https://bun.sh/blog/bun-v1.4) · [Playwright release notes](https://playwright.dev/docs/release-notes)（抓取日期：2026-11-13） | E2E 用 Playwright 1.65.0，可在 Bun 1.4.4 上运行；应用镜像与 E2E job 的运行时按部署需要选择，不再以「不兼容」为由强制拆分 |
| `serveStatic` 在 Bun 上的大小写 / 短名绕过风险 | [Bun Getting Started](https://hono.dev/docs/getting-started/bun) | 见 §1.2；媒体走 API 鉴权代理                                 |

---

## 3. pnpm（12.18.0，锁定）

| 结论                                                         | 官方来源 | 本项目的具体用法                                             |
| ------------------------------------------------------------ | -------- | ------------------------------------------------------------ |
| pnpm 的 workspace 与依赖隔离可控 | [pnpm Workspaces](https://pnpm.io/workspaces) · [pnpm Docker](https://pnpm.io/docker)（抓取日期：2026-11-13） | **全仓库唯一包管理器**，锁定 12.18.0；CI 与本地安装一律使用 pnpm；**禁止** `bun install` / `bun add` / `bun.lock`；镜像使用 `pnpm-lock.yaml` + `pnpm install --frozen-lockfile`（`ARCH-BLD-01`） |

> `ARCH-BLD-01` 同时是对旧版的修正：旧版 §3 写「pnpm，不要混用 Bun 的安装器」而 §15.1 镜像却是 `COPY bun.lock` + `bun install --frozen-lockfile`，两份文档互相否定；**现统一为 pnpm**。

---

## 4. Zod（4.6.7，锁定）

| 结论                                                         | 官方来源                                                     | 本项目的具体用法                                             |
| ------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------ |
| 一份 schema 同时驱动前端表单与后端入参                       | [Zod](https://zod.dev)（抓取日期：2026-11-13） | 前端 `safeParse` 即时校验，后端 `zValidator` 权威校验，**用同一个 Zod schema**（§8.5） |
| `drizzle-zod` 可从表定义派生单表 CRUD                        | [drizzle-zod](https://orm.drizzle.team/docs/zod)             | 单表 CRUD 用 `drizzle-zod` 派生（`createInsertSchema` / `createSelectSchema` / `createUpdateSchema`）；跨实体规则手写（§8.5） |
| `@hono/zod-openapi@1.6.3` 要求 `^4.0.0`；上游 peer 范围只作兼容说明 | [zod-openapi 示例](https://github.com/honojs/website/blob/20aab4e020e3/examples/zod-openapi.md)（抓取日期：2026-11-13） | 项目锁定 `zod@4.6.7`；详见第 7 节版本锁定说明 |

---

## 5. Drizzle ORM（0.45.4，锁定）

### 5.1 选型结论

| 结论                                                         | 官方来源                                                     | 本项目的具体用法                                             |
| ------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------ |
| Drizzle SQL 原生，适合递归 CTE、`ltree`、RLS；无冷启动引擎 | [Drizzle 文档](https://orm.drizzle.team/docs/schemas)（抓取日期：2026-11-13） | 选 Drizzle 而非 Prisma：递归 CTE（祖先/后代查询、环检查）、`ltree`、RLS 都需要直写 SQL |
| 生产驱动用 `drizzle-orm/node-postgres`（`pg`）：在 Bun 的 Node 兼容层下可用，被 PgBouncer 长期验证 | [node-postgres](https://node-postgres.com/)（抓取日期：2026-11-13） | 生产用 `pg` 驱动，**不用** `drizzle-orm/bun-sql`（ORM 的查询构建与结果映射会吃掉驱动层性能优势，连接池行为也与 `pg` 不同）；**先用 `pg`，等实测证明连接池是瓶颈再换** |
| `generatedAlwaysAs(sql, { mode: 'stored' \| 'virtual' })`    | [Generated Columns](https://orm.drizzle.team/docs/column-types/pg)（抓取日期：2026-11-13） | `node.parent_path` 等生成列一律**显式**写 `mode: 'stored'`（`DM-ADR-11`、`DM-GEN-20`）；`drizzle-orm@0.45.4` 源码第 28 行的默认值**待验证**，登记见 [`../verification/README.md`](../verification/README.md)，故不依赖默认值 |
| `customType` 定义 `ltree`                                    | [Custom Types](https://orm.drizzle.team/docs/custom-types)（抓取日期：2026-11-13） | `node.path` / `book_catalog.path` 用 `ltree` 自定义类型      |
| `index().using('gist' \| 'gin', ...)`、`uniqueIndex().on().where()` | [SQL schema declaration](https://orm.drizzle.team/docs/sql-schema-declaration)（抓取日期：2026-11-13） | GiST 复合索引 `node_path_gist` / `book_catalog_path_gist`；部分唯一索引（`uq_invite_pending_email`、`uq_person_name_primary`、`uq_node_one_primary` 等） |
| `primaryKey()`、`foreignKey({ columns, foreignColumns })`    | [Schemas](https://orm.drizzle.team/docs/schemas) 与 [SQL schema declaration](https://orm.drizzle.team/docs/sql-schema-declaration)（抓取日期：2026-11-13） | 所有 Project 内容表用 `(project_id, id)` 复合主键；复合外键保证 `organization_id` / `project_id` 一致 |
| `pgPolicy()` 的参数与限制（**不生成 `FORCE`**）              | [Row Level Security](https://orm.drizzle.team/docs/rls)      | `FORCE ROW LEVEL SECURITY` 归手写 SQL 迁移，不指望 Drizzle 生成（数据模型 §12.2 归类） |
| `pgView`、`.with({ securityInvoker: true })`                 | [Views](https://orm.drizzle.team/docs/views)                 | 业务视图必须 `security_invoker = true`，否则视图属主权限会绕过 RLS（`DM-RLS-03`） |
| `pgSchema`                                                   | [Schemas](https://orm.drizzle.team/docs/schemas)             | `app` schema 承载 `app.visible_org_array()` 等函数与 `app.lineage_root` 等视图 |
| `drizzle-kit generate --custom` 生成空迁移文件               | [Custom migrations](https://orm.drizzle.team/docs/kit-custom-migrations)（抓取日期：2026-11-13） | 触发器、策略、部分索引、延迟约束等 Drizzle 不覆盖的部分归**手写 SQL 迁移**（[`migrations.md`](data/migrations.md) 第 12.2 节） |

### 5.2 归手写 SQL 迁移的部分（Drizzle 边界）

以下能力 Drizzle ORM 不生成或生成不正确，必须手写 SQL 迁移：

- `FORCE ROW LEVEL SECURITY`（`pgPolicy()` 不生成）
- `CONSTRAINT TRIGGER` + `DEFERRABLE INITIALLY DEFERRED`
- 部分唯一索引（`WHERE` 子句虽支持，但部分场景归手写）
- `ON DELETE SET NULL (column_list)` 列清单式删除动作
- `SECURITY DEFINER` 函数与 `SET search_path`
- 视图 `security_invoker`

> 来源：[`migrations.md`](data/migrations.md) 第 12.2 节「归手写 SQL 迁移（`drizzle-kit generate --custom`）」

---

## 6. PostgreSQL 18

### 6.1 官方依据（逐字引文）

> 抓取日期：2026-11-13；以下 URL 逐条 `curl -L` 验活（200），GitHub 链接固定到版本 tag 或 commit SHA，不用 `main`。

- [Generated Columns](https://www.postgresql.org/docs/18/ddl-generated-columns.html)：逐字引文 `STORED` / `VIRTUAL`；用户定义类型不支持虚拟生成列。抓取日期：2026-11-13
- [Constraints](https://www.postgresql.org/docs/18/ddl-constraints.html)：逐字引文 `NOT VALID` / `VALIDATE CONSTRAINT`；CHECK、UNIQUE、复合外键、列清单式 `ON DELETE SET NULL (col)`、可延迟约束、`NOT NULL` 具名。抓取日期：2026-11-13
- [ALTER TABLE](https://www.postgresql.org/docs/18/sql-altertable.html)：逐字引文 `ADD table_constraint [ NOT VALID]`、`VALIDATE CONSTRAINT`；无 `ALTER CONSTRAINT … SET NOT VALID`。抓取日期：2026-11-13
- [Row Security Policies](https://www.postgresql.org/docs/18/ddl-rowsecurity.html)：逐字引文 `FORCE ROW LEVEL SECURITY`、`BYPASSRLS`、`PERMISSIVE` / `RESTRICTIVE`；默认拒绝。抓取日期：2026-11-13
- [Explicit Locking](https://www.postgresql.org/docs/18/explicit-locking.html)：逐字引文 `FOR UPDATE` 与 `FOR KEY SHARE` 冲突（Table 13.3）；[Advisory Locks](https://www.postgresql.org/docs/18/explicit-locking.html#ADVISORY-LOCKS) 的 `pg_advisory_xact_lock`。抓取日期：2026-11-13
- [CREATE TRIGGER](https://www.postgresql.org/docs/18/sql-createtrigger.html)：逐字引文 `CONSTRAINT TRIGGER`、`DEFERRABLE | [ DEFERRABLE ] [ INITIALLY IMMEDIATE | INITIALLY DEFERRED ]`；该页不规定触发器执行角色，故本文不作此断言。抓取日期：2026-11-13
- [CREATE FUNCTION](https://www.postgresql.org/docs/18/sql-createfunction.html)：逐字引文 `SECURITY DEFINER`、`SET search_path`、属主权限。抓取日期：2026-11-13
- [CREATE VIEW](https://www.postgresql.org/docs/18/sql-createview.html)：逐字引文 `security_invoker`。抓取日期：2026-11-13
- [CREATE INDEX](https://www.postgresql.org/docs/18/sql-createindex.html)：逐字引文 `USING gist`；[btree_gist](https://www.postgresql.org/docs/18/btree-gist.html)。抓取日期：2026-11-13
- [ltree](https://www.postgresql.org/docs/18/ltree.html)：逐字引文 `nlevel`、`subpath`、GiST 操作符类。抓取日期：2026-11-13
- [UUID Functions](https://www.postgresql.org/docs/18/functions-uuid.html)：逐字引文 `uuidv7()`。抓取日期：2026-11-13
- [GRANT](https://www.postgresql.org/docs/18/sql-grant.html)：逐字引文列级权限与函数授权。抓取日期：2026-11-13
- [Error Codes](https://www.postgresql.org/docs/18/errcodes-appendix.html)：逐字引文 `23001`（`restrict_violation`）与 `23503`（`foreign_key_violation`）的区分。抓取日期：2026-11-13
- [Lock Management](https://www.postgresql.org/docs/18/runtime-config-client.html)：逐字引文 `lock_timeout`、`statement_timeout`、`idle_in_transaction_session_timeout`。抓取日期：2026-11-13
- [EXPLAIN](https://www.postgresql.org/docs/18/sql-explain.html)：逐字引文 `ANALYZE` 自动输出 `BUFFERS`。抓取日期：2026-11-13
- [Backup](https://www.postgresql.org/docs/18/backup.html)：逐字引文 `initdb` 默认启用数据校验和，`pg_upgrade` 要求两端一致。抓取日期：2026-11-13
- [Factory Helper](https://hono.dev/docs/helpers/factory)：逐字引文 `createFactory() can receive the initApp option to initialize an app created by createApp().`；`Uses initApp to configure middleware and dependencies across apps generated by createApp() across separate files.` 抓取日期：2026-11-13
- [Bun 1.4](https://bun.sh/blog/bun-v1.4)：逐字引文 `Playwright now runs on Bun: drive a browser with connectOverCDP(), run your suite with playwright test`。抓取日期：2026-11-13
- [Playwright release notes](https://playwright.dev/docs/release-notes)：逐字引文 `🥟 Run tests with Bun`、`Bun transpiles your TypeScript test files itself, so Playwright does not use Babel or its compilation cache.` 抓取日期：2026-11-13
- [Custom migrations](https://orm.drizzle.team/docs/kit-custom-migrations)：逐字引文 `Generates an empty SQL migration file that can be populated with custom DDL or data seeding statements.` 抓取日期：2026-11-13

### 6.2 本项目的具体用法

| 官方结论                                             | 本项目的具体用法                                             |
| ---------------------------------------------------- | ------------------------------------------------------------ |
| `uuidv7()`                                           | 所有主键默认值；时间有序，**可直接当 keyset 游标**（见 [`schema.md`](data/schema.md)、[`runtime.md`](runtime.md) §8.7 `ARCH-API-01`） |
| 生成列 `STORED` / `VIRTUAL`                          | `node.parent_path` 必须 `STORED`（参与唯一约束与外键）；**PG 18 拒绝用户定义类型的虚拟生成列**（待验证 #01：`SQLSTATE 0A000`，复现见 [`../verification/README.md`](../verification/README.md)） |
| 复合外键 / 延迟约束                                  | 自引用父外键、owner 外键用 `DEFERRABLE INITIALLY DEFERRED`，允许父子同事务内任意顺序写入（§11.2） |
| `FORCE ROW LEVEL SECURITY`                           | 所有业务表启用 `ENABLE` + `FORCE`；否则表 owner 绕过 RLS（§7.2） |
| 锁冲突矩阵（Table 13.3）                             | PostgreSQL 外键检查对被引用 `project` 行加 `FOR KEY SHARE`，与 `FOR UPDATE` 冲突 → **不锁 project 行**，改用事务级 advisory lock `yunpu:relation:<project_id>`（`ARCH-CC-01`） |
| `pg_advisory_xact_lock`                              | 世系写入串行化 + 谱系路径分配（`yunpu:lineage:<lineage_id>`）；全局锁顺序 `yunpu:relation:` → `yunpu:lineage:`（`DM-REL-06`） |
| `security_invoker`                                   | 业务视图必须 `security_invoker = true`，否则视图属主权限绕过 RLS（§7.6、`DM-RLS-03`） |
| `ltree` + GiST                                       | `node.path` / `book_catalog.path`；`nlevel(path)` 派生世次，不落列 |
| `23001` 与 `23503` 的区分                            | 应用侧**必须分开映射**：`23001` = `restrict_violation`（`ON DELETE RESTRICT` 专属），`23503` = `foreign_key_violation`。合并会导致「引用了被保护的对象」与「级联动作被拒」返回同一错误（数据模型 §9.4 修正说明） |
| `ADD CONSTRAINT … NOT VALID` / `VALIDATE CONSTRAINT` | 用于大表加约束的在线路径；**无** `ALTER CONSTRAINT … SET NOT VALID`（待验证 #17，复现见 [`../verification/README.md`](../verification/README.md)） |
| 锁超时三项                                           | 由连接串 `PGOPTIONS='-c lock_timeout=3000 -c statement_timeout=30000 -c idle_in_transaction_session_timeout=60000'` 下发，并设 `prepare: false`（`DM-POOL-01`、`DM-REL-06`）；见 [`migrations.md`](data/migrations.md) |
| `EXPLAIN` 自动含 `BUFFERS`                           | 索引验证方法：`EXPLAIN (ANALYZE, TIMING off, COSTS off)`（待验证 #13）；`DM-GEN-10` 先测量再优化 |

> 来源（重构前基线定位符，见 git 历史 `5cbb72b`）：原 `data-model.md` 的「PostgreSQL 18」版本说明；用法对照原 `plan.md` 的工具链、RLS、索引与部署章节。现行权威见本文第 1–9 节与 `data/schema.md`。

---

## 7. 工具链版本（唯一副本）

> 抓取日期：2026-11-13（npm registry `dist-tags.latest` 与 GitHub release tag 实测）。项目锁定以下精确版本，不写版本下限、区间写法或浮动 tag；上游 peer 范围只作兼容说明，不构成项目约束。

| 组件 | 锁定版本 | 依据 |
| --- | --- | --- |
| `hono` | 4.13.18 | npm latest + [Factory Helper](https://hono.dev/docs/helpers/factory) |
| `@hono/zod-validator` | 0.9.1 | npm latest；上游 peer `zod: ^3.25.0 || ^4.0.0` 只作兼容说明 |
| `@hono/zod-openapi` | 1.6.3 | npm latest；上游要求 `zod: ^4.0.0` |
| `zod` | 4.6.7 | npm latest；项目锁定 `zod@4.6.7` |
| `drizzle-orm` | 0.45.4 | npm latest |
| `drizzle-kit` | 0.31.11 | npm latest |
| `@biomejs/biome` | 2.6.7 | npm latest |
| `pnpm` | 12.18.0 | npm latest |
| `Bun` | 1.4.4（tag `bun-v1.4.4`） | [Bun 1.4 release](https://bun.sh/blog/bun-v1.4) |
| `PostgreSQL` | 18（待验证；本机无 `psql`，未实测） | 复现登记见 [`../verification/README.md`](../verification/README.md) |

> 项目锁定 `zod@4.6.7`。`@hono/zod-validator@0.9.1` 的 peer 范围是 `^3.25.0 || ^4.0.0`，`@hono/zod-openapi@1.6.3` 要求 `^4.0.0`；这两个上游声明只说明兼容性，不是本项目允许的版本区间，因此不允许 Zod 3.25。

前端与其余工具同样锁定到 2026-11-13 实测最新版：Vite 8.3.8、React 19.3.1、TypeScript 7.0.2、@tanstack/react-query 5.107.1、zustand 5.1.0、@tanstack/react-router 1.170.46、tailwindcss 4.3.5、@xyflow/react 12.12.1、@tiptap/react 3.34.0、better-auth 1.7.23、@scalar/hono-api-reference 0.12.20、Playwright 1.65.0、pg 8.23.1、drizzle-zod 0.8.3（同见第 3 节 Technical Context）。

## 8. 升级与复核纪律

| 编号           | 纪律                                                         |
| -------------- | ------------------------------------------------------------ |
| `ARCH-HONO-11` | 升级 Hono 大版本前，先用 Context7 重新拉一遍 §18 官方实践表对应条目，逐条核对本文表述是否仍成立 |
| `ARCH-RPC-01` | RPC 类型推断要求全链式调用与具名变量推断（见 [`conventions.md`](api/conventions.md)） |
| `ARCH-HONO-03` | 新增中间件前先查内置中间件选用表；内置件不采用时必须写明理由 |
| `ARCH-BLD-01`  | 包管理纪律与 Dockerfile 必须一致：一律 pnpm，禁止 `bun install` / `bun add` / `bun.lock` |
| [`DM-GEN-06`](data/schema.md) | 约束必须能在真实 PG 18 上稳定执行（复现登记见 [`verification/README.md`](../verification/README.md)） |

---


---

## 9. 实测与缺陷记录（已迁出）

21 组 PG 18 实测与 D1–D12 缺陷清单的唯一副本见 [../decisions/0001-pg18-defects.md](../decisions/0001-pg18-defects.md)；复现方式与「待验证」登记见 [../verification/README.md](../verification/README.md)。本文不复制实测表。

## 10. Technical Context（运行时与工具链）

| 层         | 选型                         | 版本                  | 为什么是它                                                   |
| ---------- | ---------------------------- | --------------------- | ------------------------------------------------------------ |
| 运行时     | **Bun**                      | 1.4.4                 | 冷启动快、`bun test` 开箱即用、安装快；Playwright 1.65.0 可在 Bun 1.4 上运行 |
| Web 框架   | **Hono**                     | 4.13.18               | 基于 Web Standard，不绑定运行时；RPC 模式免 codegen；中间件洋葱模型 |
| 前端构建   | **Vite**                     | 8.3.8                 | 冷启动毫秒级；Hono 路由可在 dev 下热重载                     |
| UI         | React                        | 19.3.1                | 生态与人才池最大                                             |
| 语言       | TypeScript                   | 7.0.2                 | `strict` + `noUncheckedIndexedAccess`                        |
| 校验       | **Zod**                      | 4.6.7                 | 一份 schema 驱动前端表单与后端入参；`drizzle-zod` 从表定义派生单表 CRUD。项目锁定 `zod@4.6.7`，上游 peer 范围只作兼容说明（见第 7 节） |
| ORM        | **Drizzle**                  | 0.45.4                | SQL 原生，适合递归 CTE、`ltree`、RLS；无冷启动引擎           |
| 数据库     | **PostgreSQL**               | 18（待验证；本机无 `psql`，未实测） | `uuidv7()`、`ltree`、RLS、生成列、延迟约束、advisory lock    |
| 服务端状态 | TanStack Query               | 5.107.1               | 缓存、失效、请求去重                                         |
| 视图状态   | Zustand                      | 5.1.0                 | 画布、面板、临时选择                                         |
| 路由       | TanStack Router              | 1.170.46              | 文件式、类型安全                                             |
| 组件       | Radix UI + Tailwind CSS      | 4.3.5                 | 无样式可访问原语 + CSS-first 令牌                            |
| 画布       | `@xyflow/react`              | 12.12.1               | 小规模家谱树可视化                                           |
| 富文本     | TipTap                       | 3.34.0                | ProseMirror 系，正文存 JSON                                  |
| 认证       | Better Auth                  | 1.7.23                | Drizzle adapter、数据库会话、自定义 access control           |
| API 文档   | `@hono/zod-openapi` + Scalar | 1.6.3 / 0.12.20      | 契约从代码生成，不手写 YAML；官方维护的 `@hono/zod-openapi` 而非第三方 `hono-openapi`（`ARCH-HONO-06`） |
| 测试       | `bun test` + Playwright      | 1.65.0                | 单元/路由/集成用 Bun；E2E 用 Playwright，官方已确认可在 Bun 1.4 上运行（`ARCH-TST-03`） |
| 质量       | Biome                        | 2.6.7                 | lint + format + 依赖方向规则                                 |
| 包管理     | **pnpm**                     | 12.18.0               | workspace 与依赖隔离可控；**全仓库唯一包管理器**（`ARCH-BLD-01`） |

> `ARCH-HONO-06`（1.2 修正）：OpenAPI 方案改用 **官方 `@hono/zod-openapi`**（`createRoute` + `OpenAPIHono` + `app.doc()`），不再用第三方的 `rhinobase/hono-openapi`。理由：官方包与 Zod v4、`zValidator` 同源，`createRoute` 里请求与响应 schema 与校验 schema 是**同一份 Zod 对象**，不存在两处定义漂移；第三方包需要额外维护 `resolver` 适配层，属于「同一规则两处」的变体。Scalar 仍作为渲染器挂在 `/api/docs`。

### 10.1 Hono 内置中间件选用表

Hono 自带一批经过审计的内置中间件。**先用内置的，不要自己写**（`ARCH-HONO-03`）：

| 中间件            | import                | 用途                                                         | 本项目决定                                                   |
| ----------------- | --------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `requestId()`     | `hono/request-id`     | 读入站 `X-Request-Id` 或生成，回写到响应头，设置 `c.get('requestId')` | **采用**，作为最外层中间件                                   |
| `secureHeaders()` | `hono/secure-headers` | 默认已启用 HSTS / `X-Frame-Options: SAMEORIGIN` / `X-Content-Type-Options: nosniff` / `Referrer-Policy: no-referrer` / COOP / CORP，并移除 `X-Powered-By` | **采用**；CSP 按需配置                                       |
| `compress()`      | `hono/compress`       | gzip/deflate，默认阈值 1024 字节；带 `Cache-Control: no-transform` 的响应自动跳过 | **采用**                                                     |
| `bodyLimit()`     | `hono/body-limit`     | 限制请求体大小，默认抛 `413`；有 `Content-Length` 且无 `transfer-encoding` 时直接拒绝，否则按流读取到上限 | **采用**，上传端点必配                                       |
| `timeout()`       | `hono/timeout`        | 超时抛 `504`；`next()` 先完成则自动清除定时器                | **采用**，长耗时端点按需挂载                                 |
| `cors()`          | `hono/cors`           | CORS 头与预检 `204`                                          | **不采用**：前后端同源部署，由反向代理处理                   |
| `etag()`          | `hono/etag`           | GET/HEAD 条件请求，`304`                                     | **不采用**：谱牒数据不缓存，缓存是浏览器的事                 |
| `cache()`         | `hono/cache`          | 响应缓存                                                     | **不采用**：会缓存到边缘，且必须置于认证之后并带 `vary: Cookie` 才安全；本项目无此需求 |
| `timing()`        | `hono/timing`         | `Server-Timing` 响应头与分段计时                             | **不采用**：性能观测走 APM + `Server-Timing` 由网关补        |
| `logger()`        | `hono/logger`         | 控制台访问日志                                               | **不采用**：自研结构化日志（§13）需要 JSON 输出与字段裁剪    |
| `ipRestriction()` | `hono/ip-restriction` | IP 白/黑名单                                                 | **不采用**：边缘层已做 WAF                                   |

> `ARCH-HONO-03` 纪律：新增中间件前先查这张表。内置件不采用时必须写明理由——这张表本身是「不用什么」的记录，避免下一个人重新论证一遍。

> `ARCH-BLD-01`（1.1 修正）：包管理纪律与 Dockerfile 必须一致。旧版 §3 写「pnpm，不要混用 Bun 的安装器」，而 §15.1 镜像却是 `COPY bun.lock` + `bun install --frozen-lockfile`——两份文档互相否定，执行者不知道听谁的。**现统一为 pnpm**，镜像使用 `pnpm-lock.yaml` + `pnpm install --frozen-lockfile`。CI 与本地安装一律使用 pnpm；禁止出现 `bun install`、`bun add`、`bun.lock`。

### 10.2 Drizzle 驱动

生产用 `drizzle-orm/node-postgres`（`pg`）。它在 Bun 的 Node 兼容层下可用，并被 PgBouncer 长期验证。`drizzle-orm/bun-sql` 是官方路径，但 ORM 的查询构建与结果映射会吃掉驱动层的性能优势，连接池行为也与 `pg` 不同。**先用 `pg`，等实测证明连接池是瓶颈再换。**

### 10.3 Bun 与 Playwright

官方 [Bun 1.4](https://bun.sh/blog/bun-v1.4) 的逐字引文：`Playwright now runs on Bun: drive a browser with connectOverCDP(), run your suite with playwright test`；[Playwright release notes](https://playwright.dev/docs/release-notes) 亦写明 `🥟 Run tests with Bun` 与 `Bun transpiles your TypeScript test files itself, so Playwright does not use Babel or its compilation cache.`（抓取日期：2026-11-13）。

因此（`ARCH-TST-03`）：

- Playwright 1.65.0 可在 Bun 1.4.4 上运行，单元 / 路由 / 集成与 E2E 不再因「运行时不兼容」被强制拆到两套 runner；
- 是否把 E2E job 与应用镜像放在同一运行时，由部署隔离需求决定，不是框架限制；
- `bun build --compile` 是否使用按打包收益单独评估，不再以 Playwright 兼容性为由禁用。

---

## 18. Hono 官方实践依据

本文所有与 Hono 相关的表述，均对照 Hono 官方文档与源码核实（经 Context7 拉取）：

| 主题                                                         | 官方来源                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| 中间件执行顺序（注册顺序进入、逆序返回）                     | [Middleware Guide](https://hono.dev/docs/guides/middleware)  |
| `c.error` 在 `await next()` 之后可读                         | [Context API](https://hono.dev/docs/api/context)             |
| `createFactory({ initApp })` 支持跨文件 DI 与运行时依赖注入 | [Factory Helper](https://hono.dev/docs/helpers/factory) |
| `ContextVariableMap` 全局增强会掩盖 `undefined`              | [Context API — ContextVariableMap](https://hono.dev/docs/api/context) |
| RPC 类型推断要求：全链式 + 从具名变量推断                    | [RPC Guide](https://hono.dev/docs/guides/rpc) · [Best Practices](https://hono.dev/docs/guides/best-practices) |
| `validator` 各 target 取值来源与 `Content-Type` 门控         | [hono/validator 源码](https://github.com/honojs/hono/blob/v4.13.18/src/validator/validator.ts) |
| `zValidator` hook 可短路请求；上游 peer 范围只作兼容说明 | [@hono/zod-validator](https://github.com/honojs/middleware/tree/8d656de46d87/packages/zod-validator) |
| `HTTPException.getResponse()` 不感知 `Context` 的 header     | [Exception API](https://hono.dev/docs/api/exception)         |
| 内置中间件清单与默认行为                                     | [Secure Headers](https://hono.dev/docs/middleware/builtin/secure-headers) · [Body Limit](https://hono.dev/docs/middleware/builtin/body-limit) |
| `serveStatic` 的大小写 / 8.3 短名绕过风险                    | [Bun Getting Started](https://hono.dev/docs/getting-started/bun) |
| Bun 默认导出 `{ port, fetch }` 启动方式                      | [Bun Getting Started](https://hono.dev/docs/getting-started/bun) |
| `app.request(input, requestInit?, env?, executionCtx?)` 测试约定 | [Hono API](https://hono.dev/docs/api/hono)                   |
| `@hono/zod-openapi` 的 `createRoute` / `OpenAPIHono` / `app.doc()` | [zod-openapi 示例](https://github.com/honojs/website/blob/20aab4e020e3/examples/zod-openapi.md) |

> `ARCH-HONO-11`：升级 Hono 大版本前，先用 Context7 重新拉一遍上表对应条目，逐条核对本文表述是否仍成立。框架语义会变，本文对框架的断言必须跟着变。

---


## Phase 0 结论（九类契约项）

> 原 api.md（重构前基线定位符，见 git 历史 `5cbb72b`） §4 的九类契约项已在 Phase 0 一次性收口，终态不留待澄清标记。本节是结论的唯一权威；需求侧只保留「类别 → 结论编号 → 状态」索引（见 [functional.md](../requirements/functional.md)），未决项登记在 [README.md](../README.md) 的 Phase 0 未决项表。判定标准：能量化为具体值并可由校验脚本核对的记「已定值」；依赖尚未落地的代码或产品决策的记「未决」并阻塞该批次 `/speckit-tasks`。

1. **Zod schema 名（C1）**：已定值。沿用 `<动词><实体>Schema` 规则；已点名的 4 个 schema 保留，其余端点入参按同规则置于 `packages/shared/src/schemas`，不再逐个留空。
2. **逐端点关键状态码（C2）**：已定值。除 `201` / `400` / `401` / `403` / `404` / `409` / `413` / `500` / `504` 外不引入新码；`RATE_LIMITED` 定为 `429`，见 [conventions.md](api/conventions.md) §1.11。
3. **完整权限名矩阵（C3）**：未决。矩阵本体 `packages/shared/src/permissions.ts` 未落地，阻塞该批次 `/speckit-tasks`。
4. **分页参数名（C4）**：未决。游标、每页大小与上限的 HTTP 参数名需与前端列表契约一起定，阻塞该批次 `/speckit-tasks`。
5. **限流配额（C5）**：未决。配额数值、返回状态码与响应体依赖部署容量测算，阻塞该批次 `/speckit-tasks`。
6. **通用幂等机制（C6）**：未决。是否启用 `Idempotency-Key`、键的存活期与存储未定，阻塞该批次 `/speckit-tasks`。
7. **批量端点上限（C7）**：已定值。V1 端点清单中没有批量导入 / 批量写入端点，故无上限可定；将来引入时按 [out-of-scope.md](../requirements/out-of-scope.md) 的复评条件处理。
8. **端点清单（C8）**：未决。增删改、兑换邀请具体路径与审计查询端点是否纳入 V1 需产品确认，阻塞该批次 `/speckit-tasks`。
9. **ErrorCode 到 HTTP 映射（C9）**：已定值。[errors.md](data/errors.md) §9.4 是唯一权威；`RATE_LIMITED` → `429` 已写入该表，其余按枚举逐行映射。
