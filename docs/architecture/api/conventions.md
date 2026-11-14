# API 通用约定

> 本文件是「API 通用约定、分页、限流、幂等、权限名与媒体」的唯一权威；其他主题见 `docs/README.md` 导航，同一主题不复制表格。

## 0. 阅读约定

- **未定义项的 Phase 0 处置**：原 plan.md（重构前基线定位符，见 git 历史 `5cbb72b`） §8 未给出的项由 [stack.md](../stack.md) 的九条 Phase 0 结论（C1–C9）统一收口；本文不推断补充、不留到实现阶段。九类契约项已全部定值，当前无未决项。
- **Zod schema 名**：plan.md（重构前基线定位符，见 git 历史 `5cbb72b`） 只显式给出了少数 schema（`CreateNodeSchema`、`NodeIdParamsSchema`、`NodeResponseSchema`、`ErrorSchema`），其余端点按 C1 的 `<动词><实体>Schema` 规则置于 `packages/shared/src/schemas`。
- **权限名**：Phase 0 结论 `C3` 已定值；完整矩阵见 §1.13。实现时以该表为唯一来源写入 `packages/shared/src/permissions.ts`，业务代码只传权限名，不比较角色名（`ARCH-PERM-01`）。
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
| 公开端点      | `GET /api/health`、`GET /api/ready`、`POST /api/v1/auth/sign-in`、`POST /api/v1/auth/sign-up`、`GET /api/v1/auth/session`、`GET /api/docs`；邀请兑换需要登录（校验当前账号邮箱与邀请邮箱一致） | §8.2       |
| 租户上下文    | 由当前登录用户推导，**不接受**客户端传入的 `organization_id` 作为隔离依据 | [`security.md`](../data/security.md)、[`overview.md`](../overview.md) |

> 来源：[`runtime.md`](../runtime.md)、[`overview.md`](../overview.md)、[`security.md`](../data/security.md)

### 1.2 请求头

| 请求头          | 规定                                                         | 出处               |
| --------------- | ------------------------------------------------------------ | ------------------ |
| `Authorization` | 测试示例中以 `Bearer test-token` 形式传入                    | §8.1.2             |
| `Content-Type`  | 写接口**必须**带 `application/json`；缺失时 `zValidator('json', …)` 取到空对象 `{}`，schema 全可选时会静默通过 | §8.6 纪律 1、§14.1 |
| `X-Request-Id`  | 入站最多 255 字符；`requestId()` 读入或生成，回写到响应头，并放入 `c.get('requestId')` | §13                |

> 来源：plan.md（重构前基线定位符，见 git 历史 `5cbb72b`） §8.1.2、§8.6、§13、§14.1

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
| 参数名         | `cursor`（可选，不透明字符串）、`limit`（可选，整数）        | C4                 |
| 默认值与上限   | `limit` 默认 50，最小 1，最大 200；越界返回 `400 VALIDATION` | C4                 |
| 游标           | 服务端编码并校验的不透明值，客户端不得解析或构造；按 `id` 升序的列表游标为上一页最后一行的 `id`，按创建时间倒序的列表（审计）游标同时包含 `created_at` 与 `id` | C4                 |
| 排序           | 内容列表默认按 `id` 升序（UUIDv7 时间有序）；审计等需要最新优先的列表按 `created_at DESC, id DESC` | §8.7、C4           |
| 响应形状       | `{ ok: true, data: { items: [...], nextCursor: string \| null } }`；`nextCursor = null` 表示没有下一页 | C4                 |
| 非法游标       | 返回 `400 VALIDATION`，不得静默从头开始                       | C4                 |
| 不分页的列表   | 我的组织列表（成员关系有界）、Node 与编目树（按 `path` 排序、按父路径取子节点） | §8.7、C4           |
| 总数           | 需要时用单独的估算查询，不在每次列表响应里执行 `COUNT(*)`     | §8.7               |
| 索引依据       | 复合主键 `(project_id, id)` 即现成索引；按创建时间排序需 `(project_id, created_at, id)` | §8.7 `ARCH-API-01` |

- 插入新行不重复也不漏读已翻过的页；删除行不会导致后续页错位。
- 树形列表不使用游标分页；按父路径取子节点，按 `path` 排序。
- 列表端点统一返回 `items` + `nextCursor`，不返回数组本体，避免后续加分页信息时破坏契约。

> 来源：plan.md（重构前基线定位符，见 git 历史 `5cbb72b`） §8.7

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

> 来源：plan.md（重构前基线定位符，见 git 历史 `5cbb72b`） §11.1、§11.5

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

> 来源：plan.md（重构前基线定位符，见 git 历史 `5cbb72b`） §8.3、§8.6

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
| 通用 `Idempotency-Key` | V1 **不启用**；不解析该请求头，不存重放结果。重复提交按上表逐端点处理 | C6 |

> C6 定值：V1 不引入通用幂等机制。现有写路径已经用自然键或条件更新表达幂等语义；为「创建类」端点增加通用键会新建存储、TTL 与响应重放，收益不足（Article I、Article VII）。
>
> 复评条件：出现离线 / 移动端自动重试或第三方集成明确要求「同一请求只执行一次」时再引入；引入时必须同时定义请求指纹、存储表、TTL 与响应重放，不得静默启用。

> 来源：plan.md（重构前基线定位符，见 git 历史 `5cbb72b`） §10、§11.1–§11.5、§12.1

### 1.9 请求体大小与超时（按端点）

| 端点                                                     | 中间件                   | 值                                           |
| -------------------------------------------------------- | ------------------------ | -------------------------------------------- |
| 媒体上传 `POST /api/v1/projects/:projectId/media-assets` | `bodyLimit({ maxSize })` | 10 MB；超出抛 `413`                          |
| 出版 `POST /books/:bookId/releases`                      | `timeout(ms)`            | 120s，超时抛 `504`；与 §11.6 服务端上限一致  |
| 其余写接口                                               | `bodyLimit({ maxSize })` | 1 MB                                         |
| 全局                                                     | 无 `timeout`             | 全局超时会让长查询难以排查；按端点挂载更精确 |

- 业务层的 10 MB 校验与 `bodyLimit` **并存**：中间件是粗筛，service 里的校验是业务规则（返回领域错误文案）。
- 出版客户端超时 180s（§11.6）。

> 来源：plan.md（重构前基线定位符，见 git 历史 `5cbb72b`） §15.1.2、§11.6、§12.1

### 1.10 批量操作上限

| 项                            | 规定                                                         | 出处                |
| ----------------------------- | ------------------------------------------------------------ | ------------------- |
| 出版规模上限                  | 单次发布的编目节点数 ≤ 2 000、文章页总数 ≤ 5 000；超出返回 `413`，提示「规模超出版本同步上限」 | §11.6 `ARCH-PUB-01` |
| 批量导入/批量写入类端点的上限 | **未定义**（plan.md（重构前基线定位符，见 git 历史 `5cbb72b`） §8.9 的端点清单中没有批量端点）          | §8.9                |

> 来源：plan.md（重构前基线定位符，见 git 历史 `5cbb72b`） §11.6、§8.9

### 1.11 限流

| 项                                   | 规定                                             | 出处 |
| ------------------------------------ | ------------------------------------------------ | ---- |
| 中间件                               | `rateLimit()`，注册在认证**之后**                | §8.2 |
| 粒度                                 | 已登录按用户；未登录按来源地址；登录失败按「规范化邮箱 + 来源地址」组合 | §8.2、C5 |
| 全局配额（已登录）                   | 每用户 300 次 / 60 秒固定窗口                    | C5   |
| 全局配额（未登录）                   | 每来源地址 60 次 / 60 秒固定窗口                 | C5   |
| 登录失败窗口                         | 同一组合连续失败 5 次后，15 分钟内拒绝该组合     | C5、`002-user-auth-default-org` |
| 注册配额                             | 每来源地址 10 次 / 小时                          | C5   |
| 邀请兑换配额                         | 每用户 20 次 / 小时                              | C5   |
| 计数范围                             | 只统计 `/api/*` 与认证页面 POST（`/sign-in`、`/sign-up`）；静态资源、`/api/health`、`/api/ready` 不计入 | C5   |
| 返回状态码                           | `429`                                            | C9   |
| 响应体                               | `{ ok: false, code: "RATE_LIMITED", message: "请求过于频繁，请稍后重试", details: { retryAfterSeconds } }`，并带 `Retry-After` 响应头 | C5、§1.6 |
| 存储                                 | V1 为单应用进程，计数在进程内；多实例部署前必须迁移到共享存储，不得静默失效 | C5   |

- 全局配额与登录失败窗口是两层：全局配额挡住流量洪峰，登录失败窗口挡住针对单一账号的密码尝试。
- 命中限流时不得暴露账号是否存在、组织是否存在或请求内容。
- 配额数值是 V1 默认值；部署容量变化时只允许通过环境配置调高，不允许在代码里分叉出第二套值。

### 1.12 依赖注入与契约生成

依赖注入约定的唯一权威见 [../runtime.md](../runtime.md) §8.1.1；本文不复制纪律表。

### 1.13 权限名矩阵（C3 定值）

命名规则：`<域>.<动作>`，全小写。角色只有 `viewer` / `editor` / `admin`；owner 始终按 `admin` 处理，并额外拥有标注 `ownerOnly` 的权限。业务代码只传权限名，不比较角色名（`ARCH-PERM-01`）。

**组织与审计**

| 权限名 | 含义 | viewer | editor | admin | owner |
| --- | --- | --- | --- | --- | --- |
| `organization.read` | 查看组织与成员 | ✓ | ✓ | ✓ | ✓ |
| `organization.update` | 修改组织名称 | — | — | ✓ | ✓ |
| `organization.archive` | 归档组织 | — | — | ✓ | ✓ |
| `organization.transfer_ownership` | 转移所有权（ownerOnly） | — | — | — | ✓ |
| `organization.member.read` | 查看成员列表 | ✓ | ✓ | ✓ | ✓ |
| `organization.member.write` | 修改成员角色 / 移除成员 | — | — | ✓ | ✓ |
| `organization.invite.read` | 查看邀请 | — | — | ✓ | ✓ |
| `organization.invite.create` | 创建邀请 | — | — | ✓ | ✓ |
| `organization.invite.revoke` | 撤销邀请 | — | — | ✓ | ✓ |
| `audit.read` | 查询审计日志 | — | — | ✓ | ✓ |

**项目与分类**

| 权限名 | 含义 | viewer | editor | admin | owner |
| --- | --- | --- | --- | --- | --- |
| `project.read` | 查看项目 | ✓ | ✓ | ✓ | ✓ |
| `project.create` | 创建项目 | — | ✓ | ✓ | ✓ |
| `project.update` | 编辑项目 | — | ✓ | ✓ | ✓ |
| `project.delete` | 删除项目 | — | — | ✓ | ✓ |
| `folder.read` | 查看分类 | ✓ | ✓ | ✓ | ✓ |
| `folder.write` | 创建 / 编辑分类 | — | ✓ | ✓ | ✓ |
| `folder.delete` | 删除分类 | — | — | ✓ | ✓ |

**谱系**

| 权限名 | 含义 | viewer | editor | admin | owner |
| --- | --- | --- | --- | --- | --- |
| `person.read` | 查看人物与姓名 | ✓ | ✓ | ✓ | ✓ |
| `person.write` | 创建 / 编辑人物与姓名 | — | ✓ | ✓ | ✓ |
| `person.delete` | 删除人物 | — | — | ✓ | ✓ |
| `relation.read` | 查看关系 | ✓ | ✓ | ✓ | ✓ |
| `relation.write` | 创建 / 编辑关系 | — | ✓ | ✓ | ✓ |
| `relation.delete` | 删除关系 | — | — | ✓ | ✓ |
| `event.read` | 查看事件 | ✓ | ✓ | ✓ | ✓ |
| `event.write` | 创建 / 编辑事件 | — | ✓ | ✓ | ✓ |
| `event.delete` | 删除事件 | — | — | ✓ | ✓ |
| `lineage.read` | 查看谱系 | ✓ | ✓ | ✓ | ✓ |
| `lineage.write` | 创建 / 编辑谱系 | — | ✓ | ✓ | ✓ |
| `lineage.delete` | 删除谱系 | — | — | ✓ | ✓ |
| `node.read` | 查看编纂位置 | ✓ | ✓ | ✓ | ✓ |
| `node.write` | 创建 / 移动编纂位置 | — | ✓ | ✓ | ✓ |
| `node.delete` | 删除编纂位置 | — | — | ✓ | ✓ |

**资料与谱文**

| 权限名 | 含义 | viewer | editor | admin | owner |
| --- | --- | --- | --- | --- | --- |
| `source.read` | 查看来源 | ✓ | ✓ | ✓ | ✓ |
| `source.write` | 创建 / 编辑来源 | — | ✓ | ✓ | ✓ |
| `source.delete` | 删除来源 | — | — | ✓ | ✓ |
| `citation.read` | 查看考证引用 | ✓ | ✓ | ✓ | ✓ |
| `citation.write` | 创建 / 编辑考证引用 | — | ✓ | ✓ | ✓ |
| `citation.delete` | 删除考证引用 | — | — | ✓ | ✓ |
| `article.read` | 查看谱文 | ✓ | ✓ | ✓ | ✓ |
| `article.write` | 创建 / 编辑谱文与分页 | — | ✓ | ✓ | ✓ |
| `article.delete` | 删除谱文或分页 | — | — | ✓ | ✓ |

**媒体、谱书与出版**

| 权限名 | 含义 | viewer | editor | admin | owner |
| --- | --- | --- | --- | --- | --- |
| `media.read` | 下载 / 查看媒体 | ✓ | ✓ | ✓ | ✓ |
| `media.write` | 上传媒体、关联到人物或谱文页 | — | ✓ | ✓ | ✓ |
| `media.delete` | 删除媒体或解除关联 | — | — | ✓ | ✓ |
| `book.read` | 查看谱书与编目树 | ✓ | ✓ | ✓ | ✓ |
| `book.write` | 创建 / 编辑谱书与编目树 | — | ✓ | ✓ | ✓ |
| `book.delete` | 删除谱书或编目项 | — | — | ✓ | ✓ |
| `release.read` | 查看出版版本 | ✓ | ✓ | ✓ | ✓ |
| `release.create` | 生成出版版本 | — | ✓ | ✓ | ✓ |
| `release.revoke` | 作废出版版本 | — | — | ✓ | ✓ |
| `release.purge` | 清除已作废版本（ownerOnly） | — | — | — | ✓ |

**不按组织角色授予的权限**

| 权限名 | 授予条件 | 说明 |
| --- | --- | --- |
| `account.read` | 已登录，本人 | 读取自己的账号资料与会话 |
| `account.write` | 已登录，本人 | 修改自己的资料 / 密码 |
| `organization.create` | 已登录 | 任何登录用户都可以创建组织并成为 owner |
| `invite.accept` | 已登录 + 邮箱与邀请一致 | 不接受他人邮箱的邀请 |

- `person.write` 覆盖 `person` 与 `person_name`；`book.write` 覆盖 `book` 与 `book_catalog`；`media.write` 覆盖上传与关联/解除关联。
- 同一端点涉及多个权限时，以端点的最小必要权限为准；详见 [endpoints.md](endpoints.md)。
- 权限矩阵是唯一来源；`packages/shared/src/permissions.ts` 落地时必须逐行对应本表，并由测试断言角色到权限的映射与本文一致。

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

> 来源：plan.md（重构前基线定位符，见 git 历史 `5cbb72b`） §8.1、§8.3、§8.4、§8.6、§8.9、§7.5、§10

---
