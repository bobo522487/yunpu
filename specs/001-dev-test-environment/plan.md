# Implementation Plan: 开发与测试环境

**Branch**: `001-dev-test-environment` | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-dev-test-environment/spec.md`

## Summary

为开发者和测试执行者提供两套互不共享数据的环境。每套环境同时只运行三项：一个 Bun 上的 Hono 应用、一个 PostgreSQL 18、一个单节点私有对象存储。启动脚本用 Compose 项目名把两套环境隔开，用 Zod 拒绝生产目标，用 `/api/ready` 在 10 秒内给出三项的就绪结果。租户隔离的证明由 `bun test` 打在测试环境的真实数据库上。

技术取舍与 Context7 出处见 [research.md](research.md)。

## Technical Context

**Language/Version**: TypeScript，运行时 Bun 1.4.4

**Primary Dependencies**: Hono 4.13.18、Zod 4.6.7、`pg` 8.23.1。包管理器 pnpm 12.18.0。对象存储客户端用 Bun 自带的 `S3Client`。

**Storage**: PostgreSQL 18（镜像 `postgres:18`）与单节点 MinIO（`quay.io/minio/minio server /data`）。不引入第二套数据库。

**Testing**: `bun test --env-file .env.test`，请求打到已启动的测试环境。路由级断言使用 `app.request`。

**Target Platform**: 开发者的 Linux 工作机。Docker 负责数据库和对象存储，应用进程在宿主机。

**Project Type**: 单体 Web 服务的本地与测试环境。本功能不包含产品前端工程。

**Performance Goals**: `GET /api/ready` 在 10 秒内返回。选定环境的恢复在 2 分钟内再次就绪。前置条件已齐时，首次启动开发环境的人工步骤在 15 分钟内完成。

**Constraints**: 同时运行的平台组件只有应用、数据库、对象存储。应用连接角色为 `genealogy_app`，不得是超级用户或 `BYPASSRLS`。对象存储不开放匿名读取。`/api/health` 不探测对象存储。不新增产品表、领域错误码或架构编号。

**Scale/Scope**: 同一台机器上一套开发环境加一套测试环境。不覆盖生产部署、备份演练和业务功能。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Phase 0 之前：

| # | 检查 | 结论 | 出处 |
| --- | --- | --- | --- |
| 1 | 是否引入新抽象层 | 否。不建仓储层，不建第二套测试运行器 | Article I，`OOS-17` |
| 2 | 是否引入新表 | 否。示例工作区是配置。隔离证明表由测试创建并删除 | Article VII |
| 3 | 是否新增依赖方向 | 否。应用依赖数据库和对象存储，二者不依赖应用 | `ARCH-AR-05` |
| 4 | 新约束的执行者 | 有。Zod 拒绝非法环境；`pg_isready` 与存储存活探针；`/api/ready`；`scripts/env.sh` 的退出码；`bun test` | Article III，Article VIII |
| 5 | 新错误码是否登记 | 不新增领域错误码，因此不改错误码表 | `docs/architecture/data/errors.md` |
| 6 | 新编号是否登记 | 不新增编号 | Article VI |
| 7 | 是否触碰「明确不做」 | 否。不加队列、缓存、搜索、第二数据库、公开读、PgBouncer、Vite 第二进程、Playwright | `OOS-09`、`OOS-10`、`OOS-14`、`OOS-16`、`OOS-17`、`OOS-19` |

门禁：通过。未进入 Complexity Tracking。

Phase 1 之后再次检查：契约只增加存活与就绪两个入口和一个证明用的媒体入口，没有新产品表，没有第四个运行组件，存储契约明确禁止匿名读取。`/api/ready` 的文档登记放在实现阶段，与代码同一变更写入 `docs/architecture/api/endpoints.md`。结论与上表相同，门禁仍通过。

## Project Structure

### Documentation (this feature)

```text
specs/001-dev-test-environment/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── readiness.md
│   ├── storage-access.md
│   └── env-cli.md
└── tasks.md              # 由 /speckit-tasks 生成，本命令不创建
```

### Source Code (repository root)

```text
compose.yaml
.env.example
package.json
pnpm-workspace.yaml
apps/api/
├── package.json
└── src/
    ├── index.ts          # Bun 默认导出 { port, fetch }
    ├── app.ts            # /api/health、/api/ready、/、/api/media
    └── env.ts            # Zod 解析，失败则进程退出
scripts/env.sh            # up | down | reset | ready
tests/env/
└── infrastructure.test.ts
```

**Structure Decision**: 仓库目前没有应用代码。本功能只建立 `apps/api` 这一个包，以及启动数据库和对象存储的 Compose 文件。不创建 `packages/shared`、`packages/db` 或 Vite 应用：还没有第二个消费方，也没有需要迁移的产品模式。

## Complexity Tracking

无违反。三项之外的进程不进入本功能。
