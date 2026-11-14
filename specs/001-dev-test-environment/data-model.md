# Data Model: 开发与测试环境

本功能不新增产品表，也不写入 `docs/architecture/data/schema.md`。下面是环境自身的实体、约束和状态。隔离证明在测试中创建并删除，不留下迁移。

## Environment

一套可启动的运行实例。

| 字段 | 规则 |
| --- | --- |
| name | `development` 或 `test`。没有第三种。 |
| compose project | `yunpu-dev` 或 `yunpu-test`。卷、网络、容器名随项目隔离。 |
| database name | `yunpu_dev` 或 `yunpu_test`，必须与 name 成对。拒绝 `yunpu_prod` 以及任何生产目标。 |
| app port | development `3000`，test `3010`。 |
| database host port | development `5432`，test `5433`。 |
| storage host port | development `9000`，test `9010`。 |
| starter workspace | 仅 development 有。内容是固定配置，不是数据库行。 |

关系：一个 Environment 同时拥有一个 Application、一个 Database、一个 ObjectStore。不能多也不能少。

## Application

宿主机上的一个 Bun 进程，对应一个 Environment。

| 字段 | 规则 |
| --- | --- |
| env | 与所属 Environment.name 相同。解析失败则进程不监听。 |
| database role | 连接角色是 `genealogy_app`。该角色不是超级用户，也没有 `BYPASSRLS`。 |
| capability token | 非空，且只属于这一个环境。另一环境的令牌无效。不是产品登录会话。 |
| pid | 启动脚本记录。停止时结束该进程并释放端口。 |

## Database

官方 PostgreSQL 18 容器。每个 Environment 一个数据卷。

| 字段 | 规则 |
| --- | --- |
| version | `SELECT version()` 必须包含 `PostgreSQL 18`。否则该组件为 down。 |
| owner role | 镜像初始化出的超级用户。只用于第一次初始化和测试夹具的搭建与拆除。 |
| app role | `genealogy_app`，`LOGIN NOSUPERUSER NOBYPASSRLS`。由空数据目录上的初始化脚本创建。 |
| volume | 属于本 Environment 的 Compose 项目。另一套环境的卷不可见。 |

初始化变量只在卷为空时生效。卷里已有数据时，改环境变量不会重建角色或库名。

## ObjectStore

单节点 MinIO 进程。每个 Environment 一个数据卷、一个私有桶。

| 字段 | 规则 |
| --- | --- |
| endpoint | 仅本环境的主机端口。 |
| bucket | 应用启动时创建。创建失败则应用退出，环境不得就绪。 |
| anonymous policy | 不设置。未授权的直接读取不是成功。 |
| object | 只经应用写入。键由应用生成，不接受调用方指定任意路径。 |

控制台端口附属于同一进程，不记成另一个组件。

## Readiness

一次对三个组件的判定。不是持久化记录。

| 字段 | 规则 |
| --- | --- |
| process | `up` 或 `down`。 |
| database | `up` 或 `down`。`up` 还要求代际匹配。 |
| storage | `up` 或 `down`。`up` 要求存活探针成功，且应用能用凭证访问自己的桶。 |
| ok | 仅当三项都是 `up`。 |

## StarterWorkspace

仅存在于 development 应用的响应里。

| 字段 | 规则 |
| --- | --- |
| title | 固定文案「示例工作区」。 |
| marker | 固定标记，测试用来识别它。 |
| source | 配置。恢复数据库或对象存储之后仍然出现。 |
| forbidden content | 不得包含真实客户或真实家族资料。test 环境的响应里不得出现 title 与 marker。 |

## ProofFixture

测试过程中的临时表，用来证明隔离检查打在真实数据库上。

| 字段 | 规则 |
| --- | --- |
| lifetime | 测试开始时由 owner 角色创建，结束时删除。不进入迁移目录。 |
| isolation | 启用并强制行级安全。`genealogy_app` 在不附加过滤条件时，只能读到当前租户的行。 |
| residue | 测试失败也要删除。下一轮测试环境不得把它当成空起点里的数据。 |

## 状态

```text
absent ──up──▶ starting ──三项 up──▶ ready
                  │                    │
                  │ 缺前置条件 / 代际不符 / 端口被其他项目占用
                  ▼                    │ 任一组件随后 down
                failed ◀───────────────┘
                  
ready ──down──▶ absent          （容器与进程停止，端口释放）
development: 卷保留；再次 up 仍看到上一轮数据
test: 下次 up 先删卷，再进入空起点
ready ──reset──▶ starting ──▶ ready   （本环境的卷删除后重建；另一环境保持 ready）
```

- `development` 的 `up` 发现同一项目已在运行：停在现有卷上进入 `ready`，不另起一套数据。
- `test` 的 `up`：先删除本环境上一轮的卷，再进入 `starting`。空起点里没有上一轮检查数据。
- `up` 发现端口被别的项目占用：进入 `failed`，指出端口。不得把两边的数据接在一起再报 `ready`。
- `reset` 只改变被点名的那一个 Environment。
- `failed` 不是 `ready`。启动脚本以非零退出。
