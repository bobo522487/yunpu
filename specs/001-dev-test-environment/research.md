# Phase 0 Research: 开发与测试环境

查阅日期：2026-11-14。每条都先经 Context7 拉取当前文档，再对照 `.specify/memory/constitution.md` 与 `docs/architecture/stack.md` 取舍。未决项在本节收口，计划正文不再保留 NEEDS CLARIFICATION。

## Context7 查阅记录

| 技术 | Library ID | 取用的实践 |
| --- | --- | --- |
| Hono | `/websites/hono_dev` | Bun 以默认导出 `{ port, fetch: app.fetch }` 启动；测试用 `app.request` |
| PostgreSQL 18 | `/websites/postgresql`（version `18`） | `SELECT version()` 识别代际；`pg_isready` 退出码 0 表示接受连接 |
| Postgres 镜像 | `/websites/hub_docker_postgres` | 仅 `POSTGRES_PASSWORD` 必填；`POSTGRES_*` 只在数据目录为空时生效 |
| Compose | `/docker/compose` | `depends_on.condition: service_healthy` 只作就绪门闩，健康检查失败不会因此重启容器；`-p` / `COMPOSE_PROJECT_NAME` 分隔项目；`--profile` 只启用可选服务 |
| Drizzle | `/drizzle-team/drizzle-orm-docs` | `drizzle-orm/node-postgres` + `migrate(db, { migrationsFolder })` |
| Bun | `/websites/bun_sh` | `bun test --env-file`；`S3Client` 用 `endpoint` 指向 MinIO，且支持显式凭证 |
| pnpm | `/pnpm/pnpm.io` | 镜像与安装使用 `pnpm install --frozen-lockfile`，先复制 lockfile 与 workspace 清单 |
| Zod | `/colinhacks/zod`（`v4.6.7`） | `z.enum` 拒绝集合外的字符串 |
| MinIO | `/minio/docs` | 单节点 `quay.io/minio/minio server /data`；存活探针 `GET /minio/health/live` 返回 200 且不泄露数据；匿名策略要用 `mc anonymous` 才会公开 |
| Playwright | `/websites/playwright_dev` | `webServer` 在测试前拉起服务并等待 URL |
| Vite | `/websites/vite_dev` | `server.proxy` 把路径转到另一个开发进程 |

## Decision: 本地三项就是应用进程、PostgreSQL 18 容器、单节点 MinIO 容器

**Decision**: 开发环境与测试环境各用一个 Compose 项目（`yunpu-dev`、`yunpu-test`）。项目里只有 PostgreSQL 与 MinIO 两个容器。应用是宿主机上的一个 Bun 进程，由同一条启动脚本拉起。两套环境端口、库名、卷都分开。

**Rationale**: 规格要求同时运行的基础设施只有应用、数据库、私有对象存储。Compose 的项目名是官方的隔离手段，卷和网络随项目分开，满足「两套环境数据互不可见」。`POSTGRES_*` 只在空数据目录生效，所以恢复必须删卷后再启动，不能只重启容器。

**Alternatives considered**:

- 用 Compose profile 把两套环境放进同一个项目。profile 只决定哪些服务启动，不分开卷，恢复一套会危及另一套。
- 把应用也打进镜像。仓库还没有可构建的产品镜像，本功能要证明的是环境而不是发布流水线。宿主机 Bun 进程仍是那一个应用组件。
- 加入 PgBouncer。它会变成第四个运行组件，而生产连接池不在本功能范围内。本地应用直连数据库。

## Decision: 数据库代际用官方 `postgres:18`，应用角色不是超级用户

**Decision**: 镜像标签 `postgres:18`。容器健康检查执行 `pg_isready`，退出码 0 才算健康。就绪检查另执行 `SELECT version()`，结果必须包含 `PostgreSQL 18`，否则环境不可用。初始化脚本创建登录角色 `genealogy_app`，且为 `NOSUPERUSER NOBYPASSRLS`。镜像自带的超级用户只用于初始化。应用连接使用 `genealogy_app`。

**Rationale**: `pg_isready` 的 0/1/2/3 退出码能区分「接受连接」「启动中拒绝」「无响应」。超级用户即使在 `FORCE ROW LEVEL SECURITY` 下也会绕过策略，用它跑应用就无法证明租户隔离。角色名沿用宪法里的 `genealogy_app`，避免以后再引入第二个应用角色。

**Alternatives considered**:

- 把 `POSTGRES_USER` 直接设成 `genealogy_app`。官方镜像会把该用户建成超级用户，隔离证明失效。
- 固定到某一个 18.x 小版本镜像摘要。规格只要求代际一致；小版本摘要留到实现时按当时的 18 线标签锁定，不在计划里猜一个摘要。

## Decision: 对象存储用单节点 MinIO，默认不授予匿名策略

**Decision**: 每个环境一个 MinIO 进程，命令为 `server /data`，凭证用 `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`。容器健康检查请求 `GET /minio/health/live`，只接受 HTTP 200。应用使用 Bun `S3Client`，`endpoint` 指向该 MinIO，不设置 `public-read`。桶由应用在启动时创建。不执行 `mc anonymous`。未授权直接读取对象必须失败。

**Rationale**: MinIO 文档把分布式集群的 Compose 部署标为不支持，单节点容器命令是它提供的路径。本功能只跑一个进程，符合「对象存储算一项」。存活探针不返回业务数据。匿名访问只有显式设置策略才会打开，默认即私有，对齐 `OOS-19`。Bun 文档把 `http://localhost:9000` 列为 MinIO 的 endpoint，无需再引入 AWS SDK。

**Alternatives considered**:

- 分布式 MinIO 或 Kubernetes Operator。超出三项预算，也是 MinIO 明确不在 Compose 上支持的形态。
- 再加一个长期运行的 `mc` 初始化容器。那是第四个运行组件。建桶放在应用启动里，失败则进程退出。
- 用文件系统目录冒充对象存储。规格要求独立的私有对象存储组件，目录没有未授权读取这道边界。

## Decision: 存活与就绪分开

**Decision**: `GET /api/health` 只报告进程与数据库，与现有架构约定一致。`GET /api/ready` 同时报告应用、数据库代际、对象存储三项；任一项失败则 HTTP 503，整体不可用。Compose 的健康检查失败不会重启容器，因此存储抖动不会把应用进程打重启循环。使用者看到的「就绪结果」是 `/api/ready` 与 `env ready` 的退出码。

**Rationale**: Hono 没有单独的健康中间件需要引入，用普通路由即可，测试走 `app.request`。Compose 把 `service_healthy` 当作依赖门闩，而不是失败后的重启条件。现有文档已规定 `/api/health` 不探测对象存储，避免外部依赖抖动导致反复重启。规格仍要求三项一起判定可用，所以用另一个就绪入口，而不是改写存活入口的含义。

**Alternatives considered**:

- 让 `/api/health` 同时探测对象存储。与现有端点约定冲突，也会把存储故障变成应用重启。
- 只看容器是否启动、不看代际和桶。规格要求代际不符和存储不可读都不得标为可用。

## Decision: 启动配置用 Zod 枚举，非法目标直接退出

**Decision**: 进程启动时用 Zod 解析环境。`YUNPU_ENV` 只允许 `development` 或 `test`。数据库名必须与该枚举对应（`yunpu_dev` / `yunpu_test`）。解析失败或出现生产目标时，进程以非零退出并打印失败字段，不监听端口。

**Rationale**: `z.enum` 对集合外的值解析失败，这就是「失败要响亮」的执行者。不把生产列为合法值，比事后再拦一层更难配错。

**Alternatives considered**:

- 用未校验的 `process.env` 字符串。缺变量会变成稍后的空指针或连上错误的库。
- 接受 `production` 再在脚本里拒绝。两个入口容易只挡住一个。

## Decision: 示例工作区是开发环境配置，不是新表

**Decision**: 开发环境的合成示例工作区由应用在 `development` 下固定返回。测试环境不返回这段内容。不建产品表，也不把示例数据写入数据库。

**Rationale**: 规格要的是打开产品能看到非空、且非真实家族的内容。配置满足这一点，恢复数据库卷之后示例内容仍在，因为它们不在库里。宪法要求没有第二个消费方就不建新表。

**Alternatives considered**:

- 种子脚本写入示例表。本功能没有产品表，种子表会变成第二套真相，并和后续数据模型冲突。

## Decision: 本功能不引入 Drizzle 迁移、Vite 和 Playwright

**Decision**: 连接与代际检查使用 `pg`（`node-postgres`）。不调用 `migrate()`，因为还没有迁移目录。不启动 Vite。端到端浏览器套件不在本功能内；基础设施证明用 `bun test --env-file` 打到已启动的测试环境。后续产品模式出现时，迁移方式固定为 `drizzle-orm/node-postgres` 的 `migrate(db, { migrationsFolder })`，由迁移角色执行，不在应用角色的启动路径里自动迁移。

**Rationale**: Drizzle 教程里的启动即迁移，需要迁移目录和足够的数据库权限。应用角色按宪法不能是超级用户，不适合拿来建模式。Vite 的 `server.proxy` 会再起一个开发进程，规格里的应用是一项。Playwright 的 `webServer` 适合以后的浏览器测试；`OOS-17` 禁止第二套测试运行器，当前证明用已锁定的 `bun test`。

**Alternatives considered**:

- 现在生成空的 Drizzle 迁移并在启动时执行。空迁移是为未来预埋的实现。
- 用 Vite 代理 API，方便以后接前端。本功能的「打开产品」由同一个 Bun 进程返回示例页即可。

## Decision: 安装只用 pnpm，运行和测试只用 Bun

**Decision**: 根目录声明 `packageManager` 为 pnpm 12.18.0。安装命令是 `pnpm install --frozen-lockfile`。应用与测试由 Bun 1.4.4 执行。仓库不出现 `bun.lock`，脚本不调用 `bun install` 或 `bun add`。

**Rationale**: pnpm 文档要求先复制 lockfile 再 `--frozen-lockfile`。这与 `ARCH-BLD-01` 一致。Bun 负责运行和 `bun test`，不负责安装依赖。

**Alternatives considered**:

- 用 Bun 安装依赖。与锁定的包管理器冲突，也会生成被 CI 拒绝的 `bun.lock`。
