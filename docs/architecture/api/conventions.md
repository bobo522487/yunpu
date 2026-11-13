# API 通用约定

> 本文件是「API 通用约定、分页、限流、幂等、权限名与媒体」的唯一权威；其他主题见 `docs/README.md` 导航，同一主题不复制表格。

## 0. 阅读约定

- **未定义项的 Phase 0 处置**：原 plan.md §8 未给出的项由 [stack.md](../stack.md) 的九条 Phase 0 结论（C1–C9）统一收口；本文不推断补充、不留到实现阶段。已定值项直接引用结论，未决项见 [README.md](../../README.md) 的 Phase 0 未决项表并阻塞该批次 `/speckit-tasks`。
- **Zod schema 名**：plan.md 只显式给出了少数 schema（`CreateNodeSchema`、`NodeIdParamsSchema`、`NodeResponseSchema`、`ErrorSchema`），其余端点的入参 schema 名在 plan.md 中**未定义**；按 §8.5 的规则它们应位于 `packages/shared/src/schemas`。
- **权限名**：plan.md 只显式点名 `person.write`、`release.purge`（§10、§7.5 `ARCH-PERM-01`），完整矩阵在 `packages/shared/src/permissions.ts`，本文中未列出的权限名记为**未定义**。
- 路径参数一律使用**内部 UUID**；URL 不承担授权，授权由会话 + RBAC + RLS 完成（§8.9 末段）。

---

## 1. 通用约定

### 1.1 认证方式

| 项            | 规定                                                         | 出处       |
| ------------- | ------------------------------------------------------------ | ---------- |
| 认证方案      | Better Auth + 数据库会话 + 邮箱密码 + 微信 OAuth             | §10        |
| 会话有效期    | 7 天；滑动续期 1 天                                          | §10        |
| `cookieCache` | `enabled: false`（每次校验查库，安全优先于性能）             | §10        |
| 认证中间件    | `authMiddleware()`；成功后 `c.set('user', user)`             | §8.2       |
| 未认证行为    | **不立即返回 401**，把 `user` 留空，由各路由按需判定「公开端点」还是「需要登录」 | §8.2       |
| 公开端点      | health、登录、兑换邀请（与受保护端点共用一条链，不靠路径匹配做权限判断） | §8.2       |
| 租户上下文    | 由当前登录用户推导，**不接受**客户端传入的 `organization_id` 作为隔离依据 | [`security.md`](../data/security.md)、[`overview.md`](../overview.md) |

> 来源：[`runtime.md`](../runtime.md)、[`overview.md`](../overview.md)、[`security.md`](../data/security.md)

### 1.2 请求头

| 请求头          | 规定                                                         | 出处               |
| --------------- | ------------------------------------------------------------ | ------------------ |
| `Authorization` | 测试示例中以 `Bearer test-token` 形式传入                    | §8.1.2             |
| `Content-Type`  | 写接口**必须**带 `application/json`；缺失时 `zValidator('json', …)` 取到空对象 `{}`，schema 全可选时会静默通过 | §8.6 纪律 1、§14.1 |
| `X-Request-Id`  | 入站最多 255 字符；`requestId()` 读入或生成，回写到响应头，并放入 `c.get('requestId')` | §13                |

> 来源：plan.md §8.1.2、§8.6、§13、§14.1

### 1.3 中间件链（固定顺序）

中间件注册顺序的唯一权威见 [../runtime.md](../runtime.md) §8.2；本文不复制 `app.use(...)` 清单。

### 1.4 分页参数（keyset，不用 offset）

```sql
SELECT *
FROM person
WHERE project_id = $1 AND id > $2
ORDER BY id
LIMIT $3;
```

| 项             | 规定                                                         | 出处               |
| -------------- | ------------------------------------------------------------ | ------------------ |
| 游标           | 上一页最后一行的 `id`（UUIDv7，时间有序）；插入新行不重复也不漏读已翻过的页 | §8.7               |
| 索引依据       | 复合主键 `(project_id, id)` 即现成索引，零新增               | §8.7 `ARCH-API-01` |
| 按创建时间排序 | 用 `ORDER BY created_at, id` 复合游标，**并同步建立** `(project_id, created_at, id)` 索引 | §8.7               |
| 树形列表       | Node 按 `path` 排序，按父路径查子节点，**不用游标分页**；谱系树同理 | §8.7               |
| 总数           | 用单独的估算查询，不每次 `COUNT(*)`                          | §8.7               |

> 分页参数的**具体命名**（如 `cursor` / `limit` 字段名、每页上限）在 plan.md 中**未定义**。
> 来源：plan.md §8.7

### 1.5 乐观锁（version）

仅 `article_page` 带 `version` 字段（谱文分页富文本）：

```sql
UPDATE article_page
SET content = $3, version = version + 1
WHERE project_id = $1 AND id = $2 AND version = $4
RETURNING version;
```

- 影响行数为 0 → 版本冲突 → **409**，前端提示「内容已在别处修改，请刷新或另存」。
- **不做编辑锁**（会带来超时、僵尸锁、「谁先打开谁赢」）。
- 其余写入（人物、关系、事件、来源、引用、谱书目录）为**最后写入获胜**，不做编辑锁。

> 来源：plan.md §11.1、§11.5

### 1.6 错误响应格式

统一为 `{ ok: true, data }` 或 `{ ok: false, code, message, details? }`。

```ts
export type ErrorCode =
  | 'VALIDATION' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND'
  | 'CONFLICT' | 'RATE_LIMITED' | 'INTERNAL';
```

- service **抛领域错误**，不返回错误对象；抛异常才能保证错误不被忽略。
- handler **不写 try/catch**；由全局 `onError` 统一映射。
- 未识别异常一律 500，响应体**不含堆栈**；堆栈只进日志。
- `onError` 必须**同时处理 `HTTPException`**（`ARCH-HONO-07`）：`zValidator` 校验失败抛的是 `HTTPException(400)`，不显式处理会绕过统一错误体。
- 校验失败也可由 `zValidator` hook 短路，**两条路产出同一形状**（`ARCH-HONO-09`）：
  `{ ok: false, code: 'VALIDATION', message, details: result.error.flatten().fieldErrors }`。
- 不使用 `HTTPException.getResponse()`（它不感知 `Context`，会丢安全响应头与 `X-Request-Id`），统一用 `c.json()` 构造。

> 来源：plan.md §8.3、§8.6

### 1.7 错误码到 HTTP 状态的映射

错误码、SQLSTATE、约束名、HTTP 状态与用户文案的唯一权威见 [../data/errors.md](../data/errors.md)；本文只引用 `GX*` 编号，不复制映射表，不引用仓库中未定义的映射常量。

### 1.8 幂等性

| 端点/场景        | 幂等策略                                                     | 出处               |
| ---------------- | ------------------------------------------------------------ | ------------------ |
| 邀请兑换         | `UPDATE ... WHERE status='pending' AND expires_at > now() RETURNING` 抢占，只有一条能成功，其余抛 `GX010` | §10、§11.4         |
| 所有权转移       | CAS 条件更新 `UPDATE organization SET owner_user_id = :new WHERE id = :org AND owner_user_id = :prev`，并发时只有一个命中，其余抛 `GX010` | §10、§11.4         |
| 谱系节点路径分配 | 事务级 `pg_advisory_xact_lock('yunpu:lineage:' || lineage_id)` 串行化 | §11.2              |
| 世系关系写入     | 事务级 advisory lock `yunpu:relation:<project_id>` 串行化；延迟约束触发器在提交时检环 | §11.3 `ARCH-CC-01` |
| 媒体上传         | **不幂等**：同一文件重复上传产生新资产；数据库不按 checksum 去重 | §11.5、§12.1       |
| 谱文保存         | 乐观锁：靠 `version` CAS，重复提交第二次命中 0 行 → 409      | §11.1              |
| 其余写入         | 最后写入获胜                                                 | §11.5              |

> 一般性的 `Idempotency-Key` 请求头机制在 plan.md 中**未定义**。

> 来源：plan.md §10、§11.1–§11.5、§12.1

### 1.9 请求体大小与超时（按端点）

| 端点                                                     | 中间件                   | 值                                           |
| -------------------------------------------------------- | ------------------------ | -------------------------------------------- |
| 媒体上传 `POST /api/v1/projects/:projectId/media-assets` | `bodyLimit({ maxSize })` | 10 MB；超出抛 `413`                          |
| 出版 `POST /books/:bookId/releases`                      | `timeout(ms)`            | 120s，超时抛 `504`；与 §11.6 服务端上限一致  |
| 其余写接口                                               | `bodyLimit({ maxSize })` | 1 MB                                         |
| 全局                                                     | 无 `timeout`             | 全局超时会让长查询难以排查；按端点挂载更精确 |

- 业务层的 10 MB 校验与 `bodyLimit` **并存**：中间件是粗筛，service 里的校验是业务规则（返回领域错误文案）。
- 出版客户端超时 180s（§11.6）。

> 来源：plan.md §15.1.2、§11.6、§12.1

### 1.10 批量操作上限

| 项                            | 规定                                                         | 出处                |
| ----------------------------- | ------------------------------------------------------------ | ------------------- |
| 出版规模上限                  | 单次发布的编目节点数 ≤ 2 000、文章页总数 ≤ 5 000；超出返回 `413`，提示「规模超出版本同步上限」 | §11.6 `ARCH-PUB-01` |
| 批量导入/批量写入类端点的上限 | **未定义**（plan.md §8.9 的端点清单中没有批量端点）          | §8.9                |

> 来源：plan.md §11.6、§8.9

### 1.11 限流

| 项                                   | 规定                                             | 出处 |
| ------------------------------------ | ------------------------------------------------ | ---- |
| 中间件                               | `rateLimit()`，注册在认证**之后**                | §8.2 |
| 粒度                                 | 按用户（按 IP 更差且会被未认证流量打满共享配额） | §8.2 |
| 具体配额数值、返回状态码、限流响应体 | 未决（Phase 0 结论 `C5`，见 [stack.md](../stack.md)） | C5   |
| `RATE_LIMITED` 错误码                | 已定值：映射为 HTTP `429`（Phase 0 结论 `C9`）  | C9   |

> 来源：plan.md §8.2、§8.3

### 1.12 依赖注入与契约生成

依赖注入约定的唯一权威见 [../runtime.md](../runtime.md) §8.1.1；本文不复制纪律表。

## 3. 全局约束小结

| 约束                           | 说明                                                         | 出处                     |
| ------------------------------ | ------------------------------------------------------------ | ------------------------ |
| 路径参数校验                   | 路径参数、查询参数**必须**经 `zValidator` 校验后才使用；`c.req.param()` 返回 `string`，直接当 UUID 用等于不校验 | §8.1 `ARCH-HONO-04`      |
| 全链式调用                     | 所有路由方法必须链式调用，否则 `hc()` 类型推导静默失效       | [`runtime.md`](../runtime.md) `ARCH-RPC-01` |
| 具名变量推断类型               | 必须 `export const routes = app.get(...)`，类型从已声明变量推断 | [`runtime.md`](../runtime.md) `ARCH-RPC-01` |
| `hc` 类型预编译                | 用 `ReturnType` 固定，避免类型图过大                         | §8.1                     |
| `valid()` 必须有对应 validator | `c.req.valid('param')` 无对应注册时返回 `undefined` 且**不报错** | §8.1                     |
| 校验目标语义                   | `json` 受 `Content-Type` 门控；`query` 值一律字符串（数字/布尔须 `z.coerce`）；`GET`/`HEAD` 不可用 `json`/`form` target | §8.6 `ARCH-HONO-08`      |
| 权限复核位置                   | 必须在事务内执行（`requirePermission(tx, ...)`），不能只在路由层查一次 | §7.5、§10 `ARCH-PERM-01` |
| 授权单一来源                   | 角色矩阵在 `packages/shared/src/permissions.ts`，业务代码只传权限名，不比较角色名 | §7.5、§10                |
| RLS 与 RBAC 分工               | RLS 答「能看到哪些行」；RBAC 答「能不能做这个操作」          | §7.5                     |
| 授权不由 URL 承担              | URL 不承担授权；请求体里任何 ID 也必须是内部 UUID            | §8.9                     |
| 错误不进 handler               | handler 不写 try/catch，由 `onError` 统一映射                | §8.3                     |
| 服务层不感知 HTTP              | service 通过参数接收依赖，路由负责把 `c.get('services')` 转成参数 | §8.4、§5.2               |

> 来源：plan.md §8.1、§8.3、§8.4、§8.6、§8.9、§7.5、§10

---
