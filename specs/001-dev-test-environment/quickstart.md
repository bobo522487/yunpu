# Quickstart: 开发与测试环境

用来确认本功能的规格是否被满足。命令的语义在 [contracts/env-cli.md](contracts/env-cli.md)，响应形状在 [contracts/readiness.md](contracts/readiness.md) 与 [contracts/storage-access.md](contracts/storage-access.md)。实体与状态在 [data-model.md](data-model.md)。

## 前置条件

机器上已有 Docker、pnpm 12.18.0、Bun 1.4.4。下面的计时不包含安装这三样。仓库依赖只用：

```bash
pnpm install --frozen-lockfile
```

## 1. 启动开发环境

```bash
scripts/env.sh up development
scripts/env.sh ready development
```

期望：`ready` 退出码为 0，输出里 `ok` 为 `true`，`version` 包含 `PostgreSQL 18`，`process`、`database`、`storage` 都是 `up`。打开 `http://127.0.0.1:3000/`，正文包含「示例工作区」和 `yunpu-starter-workspace`。

正在运行的平台组件只有应用进程、一个 PostgreSQL 容器、一个 MinIO 容器。

## 2. 私有对象

向 `http://127.0.0.1:3000/api/media` 提交一段字节。

- 不带令牌：得到 401，存储里没有新对象。
- 带开发环境令牌：得到 201 和一个键。再经应用读取，字节与写入时一致。
- 不带 MinIO 根凭证，直接请求该对象的存储地址：状态不是 200。

## 3. 启动测试环境而不影响开发环境

```bash
scripts/env.sh up test
```

期望：`http://127.0.0.1:3010/api/ready` 的 `ok` 为 `true`。`http://127.0.0.1:3010/` 不包含「示例工作区」。开发环境里刚才写入的对象仍在，测试环境读不到它。

然后：

```bash
bun test --env-file .env.test
```

期望：租户隔离证明打在测试环境的真实数据库上，测试结束不留下证明表。测试环境未就绪时，这些测试失败，而不是跳过。

## 4. 失败要看得见

在测试环境已停止时执行 `scripts/env.sh ready test`。期望：退出码非零，输出里 `ok` 为 `false`，并标明未就绪的组件。

把配置里的环境名改成生产或把库名配成 `yunpu_prod` 后再启动。期望：进程或脚本非零退出，端口上没有新服务，生产数据没有被读取或改写。

## 5. 恢复只影响被点名的环境

开发环境与测试环境都已就绪、且都写入过一个可识别对象时：

```bash
scripts/env.sh reset development
```

期望：两分钟内开发环境再次就绪，示例页仍在，开发环境里上一轮的对象读不到。测试环境的对象还在，`ready test` 仍为 0。

## 6. 停止后端口释放

```bash
scripts/env.sh down development
```

期望：3000、5432、9000 不再由本环境占用。测试环境的 3010、5433、9010 仍然可用。
