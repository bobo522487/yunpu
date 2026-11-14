# Contract: 环境命令

唯一入口是 `scripts/env.sh`。第一个参数是动作，第二个参数是环境名。

```text
scripts/env.sh up     development|test
scripts/env.sh down   development|test
scripts/env.sh reset  development|test
scripts/env.sh ready  development|test
```

环境名不是 `development` 或 `test` 时，命令以非零退出并指出允许的取值。不得把该值当成生产去连接。

## 前置条件

命令开始时检查 `docker`、`pnpm`、`bun` 是否存在。缺哪一个，就在退出信息里写出哪一个的名字，并以非零退出。不继续把环境标为可用。

依赖安装只通过 `pnpm install --frozen-lockfile`。命令本身不调用 `bun install`。

## `up`

1. 选择与环境名对应的 Compose 项目、端口、库名和卷。
2. 若目标端口已被另一个项目占用，非零退出并写出端口。不接管那套数据。
3. `development`：若同一项目已经在运行，沿用现有卷，继续等到就绪。停止后再启动也沿用该卷，上一轮数据仍在。
4. `test`：每次启动先清空本环境上一轮的数据库卷和对象存储卷，再以空起点启动。不得把中断检查留下的数据当成空起点。不清空 `development`。
5. 启动 PostgreSQL 与 MinIO，并等待各自健康检查通过。数据库未接受连接或存储存活探针不是 200 时，非零退出并写出失败的组件。
6. 启动本环境的应用进程。配置解析失败时，转述失败字段并不把环境标为可用。
7. 调用该环境的 `GET /api/ready`。只有 `ok: true` 时本命令才以 0 退出。

## `down`

停止本环境的应用进程和两个容器，释放本环境的端口。保留卷。不影响另一个环境。

## `reset`

对本环境执行带卷删除的停止，再执行与 `up` 相同的启动。完成后：

- development 的 `GET /` 仍包含「示例工作区」。
- test 的 `GET /` 仍不包含该工作区。
- 上一轮经 `POST /api/media` 写入的对象不再能读到。
- 另一个环境的就绪状态和对象保持不变。
- 从发出命令到本环境再次 `ok: true`，不超过 2 分钟。

## `ready`

请求本环境的 `GET /api/ready`，把响应写到标准输出。`ok: true` 时退出码 0，否则非零。命令本身不启动容器。

## 同时运行

`up development` 与 `up test` 可以先后执行，两者同时处于就绪。项目名不同，因此卷不共用。
