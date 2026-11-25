# Technical Plan: 开发与测试环境（Development & Test Environment）

**Branch**: `001-dev-test-environment` | **Date**: 2026-11-14 | **Spec**: [spec.md](./spec.md)

> **前置要求**：本方案依据当前仓库的独立后端架构、宪法、架构、编码与术语规范制定，设计逐条可追溯至 spec.md 的 `FR-xxx`。技术取舍与查阅出处集中在第 7 节，验收契约见第 3、4 节。本仓库只提供 `/api/*` JSON 接口，产品前端在独立仓库；技术栈以 `docs/architecture.md` 为准。

## 1. 上下文与复用分析

- **关联 Spec**：[spec.md](./spec.md)（`FR-001`–`FR-014`）。
- **复用现有模块**：本功能落地时仓库尚无应用代码，不复用产品模块；沿用官方能力——`hono` 4.13.19 配 `@hono/node-server` 的 `serve({ fetch: app.fetch, port, hostname })` 启动，Zod 4.6.7 做配置枚举校验，`pg` 8.23.1 做连接与代际检查，`@aws-sdk/client-s3` 配 `endpoint` 指向 S3 兼容存储。后续产品模式出现时，迁移由 `packages/db/src/migrate.ts` 的顺序 runner 执行，使用 node 与 `scripts/ts-ext-register.mjs`，由迁移凭证执行，不在应用启动路径里自动迁移。
- **新增/修改范围**：只建立 `apps/api` 一个应用包、启动数据库与对象存储的 `compose.yaml`、`scripts/env.sh`、`.env.example` 与 `tests/env/`。不创建产品前端工程、不引入第二套测试运行器、不引入缓存/队列/搜索/第二套数据库：当时没有第二个消费方，也没有需要迁移的产品模式。当前仓库后续演进出的 `packages/shared`、`packages/db` 与 `/api/v1/*` 业务模块不在本功能范围内。
- **技术上下文**：TypeScript 5+（Node ≥ 26.13.0 原生类型剥离，`scripts/ts-ext-register.mjs` 加载 `.ts`），运行时与依赖安装统一 Node 26 + pnpm 12.18.0（`packageManager` 固定、`pnpm install --frozen-lockfile`，仓库禁 `bun`/`bun:test`，由 `biome.json` 护栏强制）；Hono 4.13.19、`@hono/node-server` 1.19.0、Zod 4.6.7、`pg` 8.23.1、`@aws-sdk/client-s3` 3.758.0；PostgreSQL 18（镜像 `postgres:18`）与单节点 S3 兼容存储（`docker.io/pgsty/silo`，沿用 `server /data` 与 `/minio/health/live` 健康端点）；Biome 2.2.6（`pnpm lint` 同时跑 `biome check .` 与 `tsc --noEmit`）、Vitest 5.1.0（测试命令 `vitest run --config vitest.config.ts`）；目标平台为开发者的 Linux 工作机，容器跑数据库与对象存储、应用在宿主机。

## 2. 模块职责与依赖关系

- 应用入口与边界：`apps/api/src/index.ts` 在监听前调用 `env.ts` 解析配置，用 `@hono/node-server` 的 `serve({ fetch: app.fetch, port, hostname: "127.0.0.1" })` 启动，注册 SIGTERM/SIGINT 优雅关闭并释放连接池；`apps/api/src/env.ts` 用 Zod 解析并拒绝非法目标；`apps/api/src/config.ts` 缓存配置；`apps/api/src/app.ts` 提供 `GET /api/health`、`GET /api/ready`、`/api/v1/*` 业务路由与 `app.route("/", media)`（路由级测试用 Hono 官方 `app.request()` 进程内请求助手，无需起监听服务），并导出 `AppType`；`apps/api/src/storage.ts` 在启动时确认私有桶可用，失败则进程退出；`apps/api/src/media.ts` 实现私有对象的读写与能力令牌守卫。应用只输出 JSON，不托管页面。
- 环境与容器：`compose.yaml` 定义两项服务；`docker/postgres/init/01-role.sql` 在空数据目录上创建数据库角色，`scripts/env.sh` 的 `buildRoles` 在已有卷上幂等补齐；`scripts/env.sh` 是 `up|down|reset|ready` 的唯一入口。
- 依赖方向：应用依赖数据库与对象存储，二者不依赖应用；遵守 `biome.json` 的依赖护栏——`packages/shared` 不导入 `apps/*`，模块间不跨层导入 `queries`，不设透传层，模块不直接导入连接池而统一走 `withTenantTransaction`。不引入第二套测试运行器、缓存、队列、搜索或额外进程（对应 `FR-014` 与宪法「明确不做」）。
- 目录结构：

```text
compose.yaml
.env.example
package.json                      # packageManager=pnpm@12.18.0, engines node>=26.13.0
pnpm-workspace.yaml
apps/api/
├── package.json
└── src/
    ├── index.ts          # @hono/node-server serve({ fetch, port, hostname })
    ├── app.ts            # /api/health、/api/ready、/api/v1/*、/api/media；export AppType
    ├── env.ts            # Zod 解析 config()，失败则进程退出
    ├── config.ts         # 配置单例缓存
    ├── storage.ts        # @aws-sdk/client-s3，私有桶
    └── media.ts          # POST/GET /api/media，能力令牌守卫
docker/postgres/init/01-role.sql  # genealogy_app / rls_definer / auth_runtime
scripts/env.sh                    # up | down | reset | ready
tests/env/
└── infrastructure.test.ts
```

## 3. 数据模型与数据库变更

本功能不新增产品表，也不写产品模式；下面列出环境自身的实体、约束、状态与对外 HTTP 契约。隔离证明表在测试中创建并删除，不进入迁移目录。产品表与迁移（`packages/db/migrations/`）由后续功能引入，本功能只保证环境能承载它们。

### 3.1 实体（`FR-001`、`FR-002`、`FR-005`、`FR-007`）

| 实体 | 字段与规则 |
| --- | --- |
| Environment | `name` ∈ {`development`,`test`}；Compose 项目 `yunpu-dev`/`yunpu-test`；库名 `yunpu_dev`/`yunpu_test` 与 name 成对，拒绝 `yunpu_prod`；应用端口 3001/3010，数据库宿主端口 5432/5433，存储宿主端口 9000/9010。一环境同时拥有一个 Application、一个 Database、一个 ObjectStore。 |
| Application | 宿主机上的一个 Node 26 进程，用 `@hono/node-server` 监听；`YUNPU_ENV` 与所属环境同名，解析失败则不监听；数据库应用角色 `genealogy_app`（`LOGIN NOSUPERUSER NOBYPASSRLS`）；认证连接用独立角色 `auth_runtime`；每环境一把能力令牌（非空、不可互换、非产品登录会话）；pid 由启动脚本记录在 `.local/`。 |
| Database | 官方 PostgreSQL 18 容器，每环境一个数据卷；`SELECT version()` 不含 `PostgreSQL 18` 即为 down；owner 为镜像初始化超级用户 `postgres`，只用于首次初始化、迁移与测试夹具搭建/拆除；应用角色 `genealogy_app LOGIN NOSUPERUSER NOBYPASSRLS` 与 `rls_definer NOLOGIN BYPASSRLS` 由空数据目录上的初始化脚本创建，已有卷由 `buildRoles` 幂等补齐；初始化变量只在卷为空时生效。 |
| ObjectStore | 单节点 S3 兼容存储（`docker.io/pgsty/silo`，`server /data`），每环境一个数据卷与私有桶；endpoint 仅本环境端口；`S3Client` 显式传 `credentials` 并设 `forcePathStyle: true`（路径风格，桶名进 URL 路径——官方 v3 该选项只从构造参数读取、默认 false 且无环境变量开关）；桶由应用启动时确认，失败则应用退出、环境不得就绪；不设匿名策略；对象只经应用写入、键由应用生成；每环境凭证由 `scripts/env.sh` 生成，不共用。 |
| Readiness | 对 process/database/storage 的一次判定（`up`/`down`，database `up` 还要求代际匹配，storage `up` 还要求 `/minio/health/live` 探针 200 且能用凭证访问自己的桶）；仅三项都 `up` 时 `ok` 为真。 |
| ProofFixture | 测试中的临时表，owner 角色在测试开始创建、结束（含失败）删除，不进迁移；启用并强制行级安全，`genealogy_app` 不加过滤条件时只读当前租户行；失败也删除，不污染下一轮空起点。 |

> 本功能不设示例工作区实体：本仓库为独立后端，不托管前端页面，检查所需数据由检查自身装入。

### 3.2 状态机（`FR-009`、`FR-012`）

```text
absent ──up──▶ starting ──三项 up──▶ ready
                    │                    │
                    │ 缺前置条件 / 代际不符 / 端口被占用
                    ▼                    │ 任一组件随后 down
                  failed ◀───────────────┘
ready ──down──▶ absent（进程与容器停止、端口释放）
   development：卷保留，再次 up 仍见上一轮数据
   test：下次 up 先删卷，进入空起点
ready ──reset──▶ starting ──▶ ready（只删本环境卷后重建，另一环境保持 ready）
```

- development 的 `up` 发现同一项目已运行：停在现有卷上进入 ready，不另起数据（`FR-012`）。
- test 的 `up`：先删本环境上一轮数据库卷与对象卷，再进入 starting（`FR-009`）。
- `up` 发现端口被别的项目占用：进入 failed 并指出端口，不接管数据（`FR-003`）。
- `reset` 只改变被点名的 Environment；`failed` 不是 ready，启动脚本以非零退出。

## 4. API Contract

### 4.1 环境命令 `scripts/env.sh`（`FR-001`、`FR-003`、`FR-009`、`FR-012`）

唯一入口，第一个参数为动作、第二个为环境名；环境名非 `development|test` 时非零退出并列出允许值，不把它当生产连接。启动时检查 `docker` 或 `podman`（至少一种容器运行时）、`pnpm`、`node` 是否存在（不使用 Bun），两者都缺时写出两个名字，缺 pnpm/node 时写出对应名字，并非零退出；依赖安装只通过 `pnpm install --frozen-lockfile`。容器命令通过选定的运行时调用 Compose；Docker Compose 用 `--wait`，podman-compose 无该参数，因此健康检查由脚本统一轮询。

- `up`：选择对应项目/端口/库名/卷；端口被占用则非零退出；development 复用现有卷，test 每次先清空本环境数据库卷与对象卷；启动两项容器并等各自健康检查，配置解析失败则转述失败字段且不标可用；只有 `GET /api/ready` 为 `ok:true` 才以 0 退出。迁移与角色补齐走 node + `scripts/ts-ext-register.mjs`。
- `down`：停本环境应用进程与两个容器、释放端口、保留卷，不影响另一环境。
- `reset`：对本环境带卷删除地停止，再走与 `up` 相同的启动；完成后两环境都回到空起点，上一轮对象读不到，另一环境不变，2 分钟内恢复 `ok:true`。
- `ready`：请求本环境 `GET /api/ready` 并把响应写到标准输出，`ok:true` 退出 0 否则非零；命令本身不启动容器。
- `up development` 与 `up test` 可先后执行、同时就绪；项目名不同，卷不共用。

### 4.2 路由契约（Hono 应用，`FR-004`、`FR-007`、`FR-011`、`FR-013`）

字段名即契约，实现不得改名。这些是存活/就绪与证明用的媒体入口，不是领域错误码，不新增架构错误码条目；`/api/ready` 与 `/api/health` 的分工由实现落定。应用只返回 JSON 或对象字节，不返回页面。

| 路径 | 成功 | 失败 |
| --- | --- | --- |
| `GET /api/health` | 200 `{ "ok": true, "checks": { "process": "up", "database": "up" } }`，响应无 `storage` 字段 | 503：`ok:false`、`database:down`，不出现 `storage`；只查进程与数据库连通性，不查对象存储、不查数据库代际 |
| `GET /api/ready` | 200：三项都 `up`、`version` 含 `PostgreSQL 18` | 503：任一项 down 或代际不符，`ok:false`、失败项带 `reason`；10 秒内返回 |
| `POST /api/media` | 201 `{ "ok": true, "key": "<应用生成的键>" }`，正文 ≤ 1 MB，键由应用生成 | 401：令牌缺失、错误或属于另一环境，对象不写入；413：正文超过上限；此上限只服务本功能证明，不是产品媒体规则 |
| `GET /api/media/*` | 200：正文与写入时字节一致，`content-type: application/octet-stream`，同样要求本环境 Bearer 令牌 | 401：令牌缺失/错误/跨环境；404：键不存在；400 `VALIDATION`：键格式非法 |
| 绕过应用直读对象 URL | — | 不带根凭证的 `GET` 状态不是 200、正文不是对象内容；不设 `public-read`、不调用匿名策略命令 |

启动前配置错误不走这些路径：进程打印 Zod 失败字段并以非零退出，端口上没有服务。`/api/v1/*` 的业务路由由后续功能定义，不在本功能契约内。

### 4.3 `AppType` 影响

`apps/api/src/app.ts` 导出 `AppType = typeof apiRoutes`（`/api/v1/*` 业务路由），供契约生成参考；健康、就绪与媒体路由直接挂在根 app 上。当前前端在独立仓库，本仓库通过 `pnpm contract:export` 生成 `contracts/openapi.json` 供前端消费；本功能不新增对外类型，路由级断言直接打在 app 实例上。

## 5. 异常处理、事务与并发控制

- 配置与前置异常（`FR-003`、`FR-008`）：非法环境名、`yunpu_prod`、库名不成对、能力令牌为空、缺容器运行时（docker 与 podman 均不存在）/`pnpm`/`node`、代际不符、目标指向生产——一律启动失败、打印原因、非零退出，端口不留服务、生产数据零读写；不把失败环境标为可用。
- 就绪与存活（`FR-004`、`FR-013`）：`ok` 为真是三项全 `up` 的唯一结果；存储 `up` 要求存活探针 200 且应用能用凭证访问自己的桶，只监听端口不算；组件随后停止则下一次就绪整体不可用并标出失败项。
- 私有访问（`FR-007`）：缺失/错误/跨环境令牌返回 401 且不泄露对象内容；键不存在返回 404、键格式非法返回 400；无产品登录通道。
- 事务边界：本功能无产品表与迁移，不引入 `withTenantTransaction`/`23505`/`VERSION_CONFLICT`/SQLSTATE→ErrorCode 映射；规则的执行者是 Zod 配置校验、`pg_isready` 退出码、存储存活探针、`/api/ready`、`env.sh` 退出码与 Vitest。后续产品表的事务由 `apps/api/src/db/with-tenant-transaction.ts` 统一承担，本功能不改变其边界。
- 并发与残留（`FR-009`、`FR-012`）：`POSTGRES_*` 只在空数据目录生效，恢复与 test 的每次启动必须先删卷再启动，不能只重启容器；恢复期间的写入在完成后不保留；端口被其他项目占用时失败退出而非接管数据。

## 6. 安全性、性能与兼容性

- 最小权限（`FR-005`、`FR-006`）：应用连接用 `genealogy_app`（`LOGIN NOSUPERUSER NOBYPASSRLS`），认证连接用 `auth_runtime`，超级用户只在初始化、迁移与测试夹具搭建/拆除使用；超级用户绕过 `FORCE ROW LEVEL SECURITY`，用它跑应用无法证明租户隔离。ProofFixture 启用并强制行级安全，`genealogy_app` 无过滤条件只读当前租户行。
- 对象私有（`FR-007`）：对象存储默认私有，不设匿名策略；未授权直读不是成功。每环境的能力令牌与存储凭证独立，不可互换。
- 性能目标：`GET /api/ready` 10 秒内返回；选定环境恢复 2 分钟内再次就绪；前置齐备时首次启动开发环境人工步骤 15 分钟内完成。
- 兼容性：只覆盖同一机器上一套开发加一套测试环境；两套端口/库名/卷/令牌全隔离；不覆盖生产部署、备份演练与业务功能；`Compose` 的 `depends_on.condition: service_healthy` 只作就绪门闩、失败不重启容器，存储抖动不把应用打进重启循环。前端由独立仓库消费 `contracts/openapi.json`，本仓库不承载页面。

## 7. 技术风险与取舍

> 以下是本功能当时的决策记录与查阅出处；未决项已在 spec.md 的澄清与本设计中收口，正文不留 NEEDS CLARIFICATION。技术栈表述已按当前独立后端架构对齐。

### 7.1 决策

1. **三项基础设施 = 应用进程 + PostgreSQL 18 容器 + 单节点 S3 兼容存储**（`FR-001`）：两环境各用一个 Compose 项目（`yunpu-dev`/`yunpu-test`），项目里只有数据库与存储两个容器，应用是宿主机上的 Node 进程。项目名是官方隔离手段，卷与网络随项目分开；`POSTGRES_*` 只在空目录生效，所以恢复必须删卷。备选：Compose profile 放进同一项目（profile 不分卷）、应用打进镜像、加 PgBouncer（第四组件）——均因预算或隔离不足被否。
2. **数据库代际用 `postgres:18`，应用角色非超级用户**（`FR-005`、`FR-006`）：健康检查 `pg_isready` 退出码 0 才算健康，就绪另查 `SELECT version()` 含 `PostgreSQL 18`；初始化脚本建 `genealogy_app LOGIN NOSUPERUSER NOBYPASSRLS`、`rls_definer NOLOGIN BYPASSRLS` 与 `auth_runtime`，已有卷由 `buildRoles` 幂等补齐。超级用户绕过 RLS，`POSTGRES_USER` 直接设成应用角色会使隔离证明失效。
3. **对象存储用单节点 pgsty/silo，默认私有**（`FR-007`）：每环境一个 `server /data` 进程，沿用 `MINIO_ROOT_USER/PASSWORD` 凭证与 `GET /minio/health/live` 存活端点，凭证按环境生成、不共用；桶由应用启动时确认。分布式集群/Kubernetes Operator 超出预算；长期初始化容器是第四组件；文件系统目录没有未授权读取边界。
4. **存活与就绪分开**（`FR-004`、`FR-013`）：`/api/health` 只报进程与数据库，`/api/ready` 同时报三项与代际；任一项失败 503。让 health 也探存储会把存储故障变成应用重启。
5. **启动配置用 Zod 枚举，非法目标直接退出**（`FR-003`、`FR-008`）：`YUNPU_ENV` 只允许 development/test，库名对应 `yunpu_dev`/`yunpu_test`，认证目标必须是 `auth_runtime`，解析失败或生产目标非零退出。未校验的 `process.env` 会变成空指针或连错库；接受 production 再拦有两个入口、容易只挡一个。
6. **不预置示例数据，空起点由检查装入**（`FR-011`）：本仓库只提供 JSON API，不托管前端页面；测试环境在检查装入数据前为空，两环境初始都无真实客户/家族资料。写入示例表会变成第二套真相，与后续数据模型冲突。
7. **迁移用自研 runner，测试只用 Vitest**（`FR-006`、`FR-014`）：连接与代际检查用 `pg`，产品表迁移由 `packages/db/src/migrate.ts` 按文件顺序执行、使用 node + `scripts/ts-ext-register.mjs`；不做端到端浏览器套件，基础设施证明用 Vitest 打真实测试环境。Vitest 配置取官方串行实践：`fileParallelism: false`（官方语义会把 `maxWorkers` 降为 1，避免共用真实库时文件间互相污染）、`sequence.concurrent: false`、因容器起停较慢把 `testTimeout`/`hookTimeout` 从官方默认 5s/10s 提高到 60s、`test.env` 注入隔离配置（worker 中合并顺序最后、覆盖 shell 同名变量）。启动即迁移需要建模式权限，与应用最小权限冲突；第二套测试运行器或浏览器套件超出预算。
8. **安装/运行/测试统一 Node 26 + pnpm，不用 Bun**（`FR-014`）：`packageManager` 固定 pnpm 12.18.0、`pnpm install --frozen-lockfile`；Node ≥ 26.13.0 用原生类型剥离加载 TypeScript，脚本与测试一律 `node`/`vitest`，`biome.json` 禁止 `bun`/`bun:test`，仓库不出现 `bun.lock`。工具链分裂会导致 lockfile 冲突、运行时能力不一致并让 CI 门禁失效。

### 7.2 查阅记录

| 技术 | 出处 | 取用实践 |
| --- | --- | --- |
| Hono / `@hono/node-server` | [Hono `app.request()`](https://github.com/honojs/hono/blob/main/src/hono-base.ts)、[node-server `serve` Options](https://github.com/honojs/node-server) | `serve({ fetch: app.fetch, port, hostname })`：`fetch` 必填、`port` 默认 3000、`hostname` 透传给 `server.listen`；路由测试用官方 `app.request(path, init)`，它直接调 `app.fetch`、相对路径补 `http://localhost`，无需起监听服务 |
| Node 26 原生类型剥离 | Node.js 文档 | `node --import ./scripts/ts-ext-register.mjs` 直接运行 `.ts`，不引入编译步骤 |
| PostgreSQL 18 | PostgreSQL v18 文档 | `SELECT version()` 识别代际；`pg_isready` 退出码 0 表示接受连接 |
| Postgres 镜像 | Docker Hub `postgres` | 仅 `POSTGRES_PASSWORD` 必填；`POSTGRES_*` 只在空目录生效 |
| Compose | Docker Compose 文档 | `depends_on.condition: service_healthy` 只作门闩；`-p`/`COMPOSE_PROJECT_NAME` 分隔项目 |
| Drizzle | [drizzle-orm pg migrations](https://github.com/drizzle-team/drizzle-orm-docs/blob/main/src/content/docs/pg/migrations.mdx) | 官方 `migrate()` 只应用「尚未应用」的迁移；本项目迁移含角色/RLS/函数等非纯 DDL，沿用自研顺序 runner 保留对执行顺序的显式控制 |
| AWS SDK S3 | [S3.spec.ts：自定义 endpoint + forcePathStyle](https://github.com/aws/aws-sdk-js-v3/blob/main/clients/client-s3/test/unit/S3.spec.ts)、[EndpointParameters.ts](https://github.com/aws/aws-sdk-js-v3/blob/main/clients/client-s3/src/endpoint/EndpointParameters.ts) | `S3Client` 用 `endpoint` 指向兼容存储并显式传 `credentials`；**必须设 `forcePathStyle: true`**——该选项只从客户端构造参数读取、默认 false 且无环境变量选择器，路径风格把桶名放进 URL 路径，silo 才能正确定址 |
| pnpm | pnpm.io 文档 | 先复制 lockfile 再 `--frozen-lockfile` |
| Zod | [Zod v4 error-formatting](https://github.com/colinhacks/zod/blob/main/packages/docs/content/error-formatting.mdx) | `z.enum` 拒绝集合外字符串；校验失败用 `z.flattenError()`/`result.error.flatten()` 得到 `{ formErrors, fieldErrors }` 作为结构化 details（配置字段、请求字段同源） |
| pgsty/silo | silo 文档 | 单节点 `server /data`；`GET /minio/health/live` 存活探针 200；私有桶默认不公开 |
| Vitest | [fileParallelism](https://github.com/vitest-dev/vitest/blob/main/docs/config/fileparallelism.md)、[resolveConfig（超时/并发默认值）](https://github.com/vitest-dev/vitest/blob/main/packages/vitest/src/node/config/resolveConfig.ts)、[env 合并顺序](https://github.com/vitest-dev/vitest/blob/main/packages/vitest/src/node/pool.ts) | `vitest run --config vitest.config.ts` 打到真实测试环境；`fileParallelism: false` 会把 `maxWorkers` 强制为 1（共用真实库时必须串行）；官方 `testTimeout` 默认 5s、`hookTimeout` 默认 10s，本功能起停容器较慢故均设为 60s；`test.env` 在 worker 的 `process.env` 中最后合并、覆盖 shell 同名变量，故用 `.env.test` 注入隔离配置 |

### 7.3 宪法检查结果

Phase 0 之前与 Phase 1 之后各检查一次，结论一致、门禁通过、未进入 Complexity Tracking：不引入新抽象层、不新增产品表（证明表由测试建删）、不新增依赖方向（应用依赖数据库与对象存储，反向无依赖）、新约束都有执行者（Zod、`pg_isready`、存活探针、`/api/ready`、`env.sh` 退出码、Vitest）、不新增领域错误码与架构编号、不触碰明确不做清单。三项之外的进程不进入本功能。
