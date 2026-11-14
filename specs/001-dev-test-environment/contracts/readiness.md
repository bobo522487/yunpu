# Contract: 就绪与示例页

应用由 Hono 提供，Bun 以 `{ port, fetch: app.fetch }` 启动。下列路径都在这个进程上。字段名即契约，实现不得改名。

## `GET /api/health`

存活。只检查进程与数据库连通性，不检查对象存储，也不检查数据库代际。

**200**

```json
{ "ok": true, "checks": { "process": "up", "database": "up" } }
```

**503**：数据库查询失败。`ok` 为 `false`，`database` 为 `down`。响应里不出现 `storage`。

## `GET /api/ready`

环境是否可用。必须在 10 秒内返回。

**200**：三项都是 `up`，且 `version` 包含 `PostgreSQL 18`。

```json
{
  "ok": true,
  "checks": {
    "process": "up",
    "database": "up",
    "storage": "up"
  },
  "version": "PostgreSQL 18..."
}
```

**503**：任一项为 `down`，或代际不匹配。`ok` 为 `false`。失败项带 `reason`，指出缺失的条件、代际不符或存储不可用。不得在这种响应里把 `ok` 设为 `true`。

`storage: up` 表示存活探针返回 200，并且应用能用自己的凭证访问本环境的桶。只看到进程在听端口不算 `up`。

## `GET /`

**development，200**：正文包含「示例工作区」和固定标记 `yunpu-starter-workspace`。正文中没有真实家族或客户数据。

**test，200**：正文是空状态，不包含「示例工作区」，也不包含 `yunpu-starter-workspace`。

## 错误形态

启动前的配置错误不走这些路径：进程打印 Zod 的失败字段并以非零退出，端口上没有服务。

这些响应不是领域错误码。不新增 `docs/architecture/data/errors.md` 的条目。实现落地 `/api/ready` 时，同步把该路径写入 `docs/architecture/api/endpoints.md`，并写明它与 `/api/health` 的分工。
