# 云谱 API 契约（001-cloud-genealogy-v1）



## 0. 阅读约定

- **未定义**：plan.md §8 未给出该项信息，本文不做推断补充，需在实现阶段由 spec 补齐。
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
| 租户上下文    | 由当前登录用户推导，**不接受**客户端传入的 `organization_id` 作为隔离依据 | §7.4、§2.1 |

> 来源：plan.md §8.2、§10、§7.4

### 1.2 请求头

| 请求头          | 规定                                                         | 出处               |
| --------------- | ------------------------------------------------------------ | ------------------ |
| `Authorization` | 测试示例中以 `Bearer test-token` 形式传入                    | §8.1.2             |
| `Content-Type`  | 写接口**必须**带 `application/json`；缺失时 `zValidator('json', …)` 取到空对象 `{}`，schema 全可选时会静默通过 | §8.6 纪律 1、§14.1 |
| `X-Request-Id`  | 入站最多 255 字符；`requestId()` 读入或生成，回写到响应头，并放入 `c.get('requestId')` | §13                |

> 来源：plan.md §8.1.2、§8.6、§13、§14.1

### 1.3 中间件链（固定顺序）

```
app.use(requestId());        // ① 必须最先：后续所有日志都要 requestId
app.use(secureHeaders());    // ② 安全响应头
app.use(compress());         // ③ 响应压缩
app.use(requestContext());   // ④ 结构化日志字段
app.use(authMiddleware());   // ⑤ 会话解析
app.use(rateLimit());        // ⑥ 限流
```

- 中间件按注册顺序进入、按**逆序**返回（§2.1 `ARCH-HONO-02`）。
- `rateLimit` 置于认证之后：**按用户限流比按 IP 限流更准**，且避免未认证流量打满共享配额（§8.2）。
- 全局错误兜底是 `app.onError(...)`，**不是中间件**（§2.1 纪律 2、§8.2）。
- 选用的内置中间件清单见 §3.1；`bodyLimit` / `timeout` 的按端点挂载见 §15.1.2（本文 §1.9）。

> 来源：plan.md §8.2、§2.1、§3.1

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

> **唯一权威**：应用错误码的取值、HTTP 状态与用户可见文案以 **data-model §9.4** 为准。本节只做端点侧的**速查**，不构成第二份定义（宪法 Article VI）。改动错误码时改 data-model，本文同步。

**应用错误码 → HTTP**

| 类别                                                         | HTTP | 触发来源                                                     |
| ------------------------------------------------------------ | ---- | ------------------------------------------------------------ |
| `VALIDATION` / `SELF_RELATION` / `SYMMETRIC_ORDER` / `EVENT_SUBJECT_INVALID` / `BLANK_TEXT` / `INVALID_INPUT` | 400  | `zValidator` / `HTTPException`；SQLSTATE `23514`、`22P02`    |
| `NO_AUTH_CONTEXT`                                            | 401  | `GX008`（缺少登录上下文）                                    |
| `FORBIDDEN` / `INVITE_EMAIL_MISMATCH`                        | 403  | `42501`；`GX006`、`GX009`                                    |
| `TARGET_INVALID`                                             | 404  | `GX005`（目标不存在或已失效）                                |
| `DUPLICATE_PRIMARY_NAME` / `INVITE_ALREADY_PENDING` / `RELATION_DUPLICATE` / `NODE_PARENT_MISSING` / `PROJECT_SCOPE_VIOLATION` / `BOOK_HAS_RELEASE` / `OWNER_MEMBER_REQUIRED` / `LINEAGE_CYCLE` / `SCOPE_IMMUTABLE` / `SNAPSHOT_IMMUTABLE` / `APPEND_ONLY` / `INVALID_STATE` / `CONCURRENT_MODIFICATION` | 409  | `23505`、`23503`、`23001`；`GX001`–`GX004`、`GX007`、`GX010` |
| `RATE_LIMITED`                                               | 429  | 限流（具体状态码映射在原文中**未定义**）                     |
| `ARTIFACT_MISSING`                                           | 500  | `GX011`（产物字节缺失，服务端状态不一致）                    |
| `LOCK_TIMEOUT` / `STATEMENT_TIMEOUT`                         | 503  | `55P03`、`57014`                                             |
| `INTERNAL`                                                   | 500  | 未识别异常                                                   |

> 注 1：原 plan.md §8.3 只给出粗粒度 `ErrorCode` 枚举（7 个）与 `AppError(status)` 构造，与数据模型 §9.4 的细粒度码（24 个）粒度不同。**细粒度码是权威**——它才能把「主姓名重复」与「邀请重复」区分开，给出不同的用户文案。上表按 data-model §9.4 重排。
>
> 注 2：`RATE_LIMITED` 的具体 HTTP 状态码在原文中**未定义**。

**PG SQLSTATE → 应用错误码（`ARCH-ERR-01`，§8.3，两级：先看 SQLSTATE，再看约束名）**

| SQLSTATE | ErrorCode                 | 文案                                                         |
| -------- | ------------------------- | ------------------------------------------------------------ |
| `23505`  | `CONFLICT`                | 已存在重复记录                                               |
| `23503`  | `CONFLICT`                | 该记录已被引用，无法删除                                     |
| `23001`  | `CONFLICT`                | 该记录已被引用，无法删除                                     |
| `23514`  | `VALIDATION`              | 数据不满足约束                                               |
| `42501`  | `FORBIDDEN`               | 没有执行该操作的权限                                         |
| `GX001`  | `CONFLICT`                | 该关系会形成祖先环路                                         |
| `GX002`  | `CONFLICT`                | 组织或项目归属不可修改                                       |
| `GX003`  | `CONFLICT`                | 出版快照不可修改                                             |
| `22P02`  | `INVALID_INPUT`           | 参数格式错误（400）                                          |
| `55P03`  | `LOCK_TIMEOUT`            | 系统繁忙，请重试（503，advisory lock 超时）                  |
| `57014`  | `STATEMENT_TIMEOUT`       | 查询超时，请缩小范围（503）                                  |
| `GX004`  | `APPEND_ONLY`             | 审计日志只可追加（**409**，非 403——这是状态冲突不是权限问题） |
| `GX005`  | `NOT_FOUND`               | 邀请无效或已过期（404）                                      |
| `GX006`  | `FORBIDDEN`               | 只有组织所有者可以清除出版版本（403）                        |
| `GX007`  | `INVALID_STATE`           | 出版版本尚未作废（409）                                      |
| `GX008`  | `NO_AUTH_CONTEXT`         | 缺少登录上下文（401）                                        |
| `GX009`  | `INVITE_EMAIL_MISMATCH`   | 邀请邮箱与当前登录用户邮箱不一致（403）                      |
| `GX010`  | `CONCURRENT_MODIFICATION` | 操作已被并发请求抢先（**409**；同时覆盖邀请兑换与所有权转移两条路径） |
| `GX011`  | `ARTIFACT_MISSING`        | 出版产物缺失，状态不一致（**500**，服务端状态不一致，非客户端可重试） |

**约束名 → 具体文案（第二级匹配，约束一律具名）**

| 约束名                               | 文案                            |
| ------------------------------------ | ------------------------------- |
| `uq_invite_pending_email`            | 该邮箱已有待处理邀请            |
| `uq_person_name_primary`             | 该人物已有主显示名              |
| `uq_node_one_primary`                | 该人物在本谱系已有 primary 节点 |
| `uk_node_path`                       | 该谱系下已存在相同路径的节点    |
| `uk_person_name_value`               | 该人物已有完全相同的姓名        |
| `uk_person_relation_kind`            | 这两位人物之间已存在同类关系    |
| `uk_book_release_version`            | 该谱书已存在相同版本号          |
| `uk_media_asset_object_key`          | 该对象 key 已被占用             |
| `ck_person_relation_symmetric_order` | 对称关系只能存一种方向          |
| `ck_event_subject_xor`               | 事件必须且只能关联一个主体      |
| `ck_source_citation_target_xor`      | 一条引用只能指向一个事实        |
| `ck_book_catalog_content_match`      | 目录项类型与内容引用不匹配      |
| `fk_organization_owner`              | 新 owner 必须是组织成员         |
| `fk_organization_owner`              | 新 owner 必须是组织成员         |

- 匹配顺序：先查 `PG_CONSTRAINT_MESSAGES[constraint_name]`，命中用具体文案；否则退回 `PG_ERROR_MAP[sqlstate]`。
- PostgreSQL `driverError` 带 `constraint` 与 `code`，取 `constraint` 做第二级匹配。
- `ON DELETE RESTRICT` 在 PostgreSQL 18 报 `23001` 而非 `23503`，两者都映射以免遗漏。

> 来源：plan.md §8.3（`ARCH-ERR-01`）；补充参照数据模型 §9.4

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
| 具体配额数值、返回状态码、限流响应体 | **未定义**                                       | —    |
| `RATE_LIMITED` 错误码                | 存在于 `ErrorCode` 枚举                          | §8.3 |

> 来源：plan.md §8.2、§8.3

### 1.12 依赖注入与契约生成

| 纪律                      | 说明                                                         | 出处                  |
| ------------------------- | ------------------------------------------------------------ | --------------------- |
| 运行时依赖                | `db` / `services` / `logger` / `storage` 通过 `AppEnv['Variables']` + `c.get()` 获取 | §8.1.1、§8.4          |
| 不用 `createFactory` 注入 | `Factory` 只有 `createApp` / `createMiddleware` / `createHandlers`，**无** `.use()` / `.get()` / `.post()` | §8.1.1 `ARCH-HONO-01` |
| 不做全局增强              | 不用 `declare module 'hono'` 扩展 `ContextVariableMap`（会掩盖运行时的 `undefined`） | §8.1.1 `ARCH-HONO-05` |
| Schema 单一真相源         | 请求 schema 与 `zValidator` 用**同一个 Zod 对象**；前端 `safeParse` 与后端 `zValidator` 共用一份 | §8.5、§8.8            |
| OpenAPI                   | 官方 `@hono/zod-openapi`（`createRoute` + `OpenAPIHono` + `app.doc()`），Scalar 渲染在 `/api/docs`；契约从代码生成，不手写 YAML | §8.8、`ARCH-HONO-06`  |
| 路由清单快照              | `hono routes` 导出 JSON 纳入 CI，防路由漂移                  | §13                   |

> 来源：plan.md §8.1.1、§8.4、§8.5、§8.8、§13

---

## 2. 端点表

### 2.1 认证与账号

| 方法    | 路径                       | 用途         | 请求体来源（Zod schema） | 权限要求 | 关键状态码 |
| ------- | -------------------------- | ------------ | ------------------------ | -------- | ---------- |
| `POST`  | `/api/v1/auth/sign-in`     | 登录         | 未定义                   | 公开端点 | 未定义     |
| `POST`  | `/api/v1/auth/sign-up`     | 注册         | 未定义                   | 公开端点 | 未定义     |
| `POST`  | `/api/v1/auth/sign-out`    | 登出         | 未定义                   | 需登录   | 未定义     |
| `PATCH` | `/api/v1/account`          | 修改个人资料 | 未定义                   | 需登录   | 未定义     |
| `POST`  | `/api/v1/account/password` | 修改密码     | 未定义                   | 需登录   | 未定义     |

> 来源：plan.md §8.9

### 2.2 组织

| 方法     | 路径                                                      | 用途                                        | 请求体来源（Zod schema） | 权限要求                                                     | 关键状态码                       |
| -------- | --------------------------------------------------------- | ------------------------------------------- | ------------------------ | ------------------------------------------------------------ | -------------------------------- |
| `GET`    | `/api/v1/organizations`                                   | 我的组织列表                                | —                        | 需登录                                                       | 未定义                           |
| `POST`   | `/api/v1/organizations`                                   | 创建组织（同一事务内插组织 + owner 成员行） | 未定义                   | 需登录上下文（`GX008` 缺上下文 → 401）                       | 201（§8.1 示例语义）；其余未定义 |
| `GET`    | `/api/v1/organizations/:organizationId`                   | 组织详情                                    | —                        | 成员（admin/editor/viewer；owner 按 admin 处理）             | 未定义                           |
| `PATCH`  | `/api/v1/organizations/:organizationId`                   | 改名或归档                                  | 未定义                   | 成员；`owner_user_id` **不可**由此路径修改（只能经转移函数） | 未定义                           |
| `GET`    | `/api/v1/organizations/:organizationId/invites`           | 邀请列表                                    | —                        | 成员                                                         | 未定义                           |
| `POST`   | `/api/v1/organizations/:organizationId/invites`           | 创建邀请                                    | 未定义                   | 成员（admin 级别；具体权限名未定义）；邀请不能授予 owner     | 未定义                           |
| `DELETE` | `/api/v1/organizations/:organizationId/invites/:inviteId` | 撤销邀请                                    | —                        | 成员（具体权限名未定义）                                     | 未定义                           |
| `PUT`    | `/api/v1/organizations/:organizationId/owner`             | 转移所有权（CAS 条件更新）                  | 未定义                   | **仅当前 owner**；新 owner 必须已是成员                      | 未定义；并发失败 → `GX010` → 409 |
| —        | 兑换邀请                                                  | 兑换邀请（明文 token 只返回一次）           | 未定义                   | 公开端点；兑换时校验当前登录用户邮箱与邀请邮箱一致（`GX009` → 403） | 未定义；已被兑换 → `GX010` → 409 |

> 说明：兑换邀请的**具体路径**在 plan.md §8.9 端点清单中**未定义**（§8.2 仅说明它是公开端点）。
> 来源：plan.md §8.9、§10、§11.4

### 2.3 项目与分类

| 方法     | 路径                                             | 用途     | 请求体来源（Zod schema） | 权限要求                             | 关键状态码                       |
| -------- | ------------------------------------------------ | -------- | ------------------------ | ------------------------------------ | -------------------------------- |
| `GET`    | `/api/v1/organizations/:organizationId/projects` | 项目列表 | —                        | 组织成员                             | 未定义                           |
| `POST`   | `/api/v1/organizations/:organizationId/projects` | 创建项目 | 未定义                   | 组织成员                             | 201（§8.1 示例语义）；其余未定义 |
| `GET`    | `/api/v1/projects/:projectId`                    | 项目详情 | —                        | 项目所属组织成员                     | 未定义                           |
| `PATCH`  | `/api/v1/projects/:projectId`                    | 编辑项目 | 未定义                   | 项目所属组织成员（具体权限名未定义） | 未定义                           |
| `DELETE` | `/api/v1/projects/:projectId`                    | 删除项目 | 未定义                   | 项目所属组织成员（具体权限名未定义） | 未定义                           |
| `GET`    | `/api/v1/projects/:projectId/folders`            | 分类列表 | —                        | 项目所属组织成员                     | 未定义                           |
| `POST`   | `/api/v1/projects/:projectId/folders`            | 创建分类 | 未定义                   | 项目所属组织成员                     | 未定义                           |

> 说明：plan.md §8.9 未列出 folder 的修改 / 删除端点；未定义。
> 来源：plan.md §8.9

### 2.4 谱系与节点

| 方法     | 路径                                   | 用途                                                       | 请求体来源（Zod schema）                                    | 权限要求                             | 关键状态码                       |
| -------- | -------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------ | -------------------------------- |
| `GET`    | `/api/v1/projects/:projectId/lineages` | 谱系列表                                                   | —                                                           | 项目所属组织成员                     | 未定义                           |
| `POST`   | `/api/v1/projects/:projectId/lineages` | 创建谱系                                                   | 未定义                                                      | 项目所属组织成员                     | 201（§8.1 示例语义）；其余未定义 |
| `GET`    | `/api/v1/lineages/:lineageId`          | 谱系详情                                                   | —                                                           | 项目所属组织成员                     | 未定义                           |
| `PATCH`  | `/api/v1/lineages/:lineageId`          | 编辑谱系                                                   | 未定义                                                      | 项目所属组织成员（具体权限名未定义） | 未定义                           |
| `DELETE` | `/api/v1/lineages/:lineageId`          | 删除谱系                                                   | 未定义                                                      | 项目所属组织成员（具体权限名未定义） | 未定义                           |
| `GET`    | `/api/v1/lineages/:lineageId/nodes`    | 节点列表（按 `path` 排序，按父路径查子节点，不用游标分页） | `NodeIdParamsSchema`（`zValidator('param', …)`，§8.1 示例） | 项目所属组织成员                     | 未定义                           |
| `POST`   | `/api/v1/lineages/:lineageId/nodes`    | 建节点                                                     | `CreateNodeSchema`（`zValidator('json', …)`，§8.1 示例）    | 项目所属组织成员                     | **201**（§8.1 示例）             |
| `PATCH`  | `/api/v1/nodes/:nodeId`                | 修改节点                                                   | 未定义                                                      | 项目所属组织成员                     | 未定义                           |
| `DELETE` | `/api/v1/nodes/:nodeId`                | 删除子树                                                   | 未定义                                                      | 项目所属组织成员                     | 未定义                           |

> 补充：§8.8 的 OpenAPI 示例另给出 `GET /lineages/{lineageId}/nodes/{nodeId}`（节点详情），其响应 schema 为 `NodeResponseSchema`、`404` 使用 `ErrorSchema`。该路径未出现在 §8.9 的骨架表中。
> 来源：plan.md §8.9、§8.1、§8.8、§11.2

### 2.5 人物与姓名

| 方法     | 路径                                  | 用途                                                   | 请求体来源（Zod schema） | 权限要求                                                   | 关键状态码                       |
| -------- | ------------------------------------- | ------------------------------------------------------ | ------------------------ | ---------------------------------------------------------- | -------------------------------- |
| `GET`    | `/api/v1/projects/:projectId/persons` | 人物列表（keyset 分页，游标 = `id`）                   | —                        | 项目所属组织成员                                           | 未定义                           |
| `POST`   | `/api/v1/projects/:projectId/persons` | 创建人物                                               | 未定义                   | 项目所属组织成员（`person.write` 为 §10 点名的权限名之一） | 201（§8.1 示例语义）；其余未定义 |
| `GET`    | `/api/v1/persons/:personId`           | 人物详情                                               | —                        | 项目所属组织成员                                           | 未定义                           |
| `PATCH`  | `/api/v1/persons/:personId`           | 编辑人物                                               | 未定义                   | 项目所属组织成员                                           | 未定义                           |
| `DELETE` | `/api/v1/persons/:personId`           | 删除人物（**不删除**媒体资产，先解绑再由清理动作删除） | 未定义                   | 项目所属组织成员                                           | 未定义                           |
| `GET`    | `/api/v1/persons/:personId/names`     | 姓名列表                                               | —                        | 项目所属组织成员                                           | 未定义                           |
| `POST`   | `/api/v1/persons/:personId/names`     | 新增姓名                                               | 未定义                   | 项目所属组织成员                                           | 未定义                           |

> 说明：姓名的修改 / 删除端点在 plan.md §8.9 中**未定义**。
> 来源：plan.md §8.9、§8.7、§12.1

### 2.6 关系

| 方法   | 路径                                  | 用途       | 请求体来源（Zod schema） | 权限要求         | 关键状态码                                                   |
| ------ | ------------------------------------- | ---------- | ------------------------ | ---------------- | ------------------------------------------------------------ |
| `GET`  | `/api/v1/persons/:personId/relations` | 关系边列表 | —                        | 项目所属组织成员 | 未定义                                                       |
| `POST` | `/api/v1/persons/:personId/relations` | 新增关系   | 未定义                   | 项目所属组织成员 | 未定义；祖先环 → `GX001` → 409；对称关系顺序错误 → `23514` → 400 |

> 说明：关系的修改 / 删除端点在 plan.md §8.9 中**未定义**。
> 来源：plan.md §8.9、§11.3

### 2.7 事件

| 方法   | 路径                               | 用途     | 请求体来源（Zod schema） | 权限要求         | 关键状态码 |
| ------ | ---------------------------------- | -------- | ------------------------ | ---------------- | ---------- |
| `GET`  | `/api/v1/persons/:personId/events` | 事件列表 | —                        | 项目所属组织成员 | 未定义     |
| `POST` | `/api/v1/persons/:personId/events` | 新增事件 | 未定义                   | 项目所属组织成员 | 未定义     |

> 说明：事件的修改 / 删除端点在 plan.md §8.9 中**未定义**。
> 来源：plan.md §8.9

### 2.8 来源与考证引用

| 方法   | 路径                                    | 用途         | 请求体来源（Zod schema） | 权限要求         | 关键状态码 |
| ------ | --------------------------------------- | ------------ | ------------------------ | ---------------- | ---------- |
| `GET`  | `/api/v1/projects/:projectId/sources`   | 来源列表     | —                        | 项目所属组织成员 | 未定义     |
| `POST` | `/api/v1/projects/:projectId/sources`   | 新增来源     | 未定义                   | 项目所属组织成员 | 未定义     |
| `GET`  | `/api/v1/projects/:projectId/citations` | 考证引用列表 | —                        | 项目所属组织成员 | 未定义     |
| `POST` | `/api/v1/projects/:projectId/citations` | 新增考证引用 | 未定义                   | 项目所属组织成员 | 未定义     |

> 说明：来源 / 引用的修改、删除端点在 plan.md §8.9 中**未定义**。
> 来源：plan.md §8.9

### 2.9 谱文（文章与分页富文本）

| 方法     | 路径                                        | 用途                                        | 请求体来源（Zod schema） | 权限要求         | 关键状态码                       |
| -------- | ------------------------------------------- | ------------------------------------------- | ------------------------ | ---------------- | -------------------------------- |
| `GET`    | `/api/v1/projects/:projectId/articles`      | 谱文列表                                    | —                        | 项目所属组织成员 | 未定义                           |
| `POST`   | `/api/v1/projects/:projectId/articles`      | 新建谱文                                    | 未定义                   | 项目所属组织成员 | 201（§8.1 示例语义）；其余未定义 |
| `GET`    | `/api/v1/articles/:articleId`               | 谱文详情                                    | —                        | 项目所属组织成员 | 未定义                           |
| `PATCH`  | `/api/v1/articles/:articleId`               | 编辑谱文                                    | 未定义                   | 项目所属组织成员 | 未定义                           |
| `DELETE` | `/api/v1/articles/:articleId`               | 删除谱文（**不自动删除**媒体资产）          | 未定义                   | 项目所属组织成员 | 未定义                           |
| `PUT`    | `/api/v1/articles/:articleId/pages/:pageId` | 保存分页富文本（**乐观锁**，`version` CAS） | 未定义                   | 项目所属组织成员 | 版本冲突 → **409**（§11.1）      |
| `DELETE` | `/api/v1/articles/:articleId/pages/:pageId` | 删除分页                                    | 未定义                   | 项目所属组织成员 | 未定义                           |

> 说明：分页的创建端点（`POST .../pages`）在 plan.md §8.9 中**未定义**。
> 来源：plan.md §8.9、§11.1、§12.1

### 2.10 谱书与编目

| 方法   | 路径                                | 用途       | 请求体来源（Zod schema） | 权限要求         | 关键状态码                       |
| ------ | ----------------------------------- | ---------- | ------------------------ | ---------------- | -------------------------------- |
| `GET`  | `/api/v1/projects/:projectId/books` | 谱书列表   | —                        | 项目所属组织成员 | 未定义                           |
| `POST` | `/api/v1/projects/:projectId/books` | 新建谱书   | 未定义                   | 项目所属组织成员 | 201（§8.1 示例语义）；其余未定义 |
| `GET`  | `/api/v1/books/:bookId/catalog`     | 编目树列表 | —                        | 项目所属组织成员 | 未定义                           |
| `POST` | `/api/v1/books/:bookId/catalog`     | 新增编目项 | 未定义                   | 项目所属组织成员 | 未定义                           |

> 说明：编目项的修改 / 删除端点在 plan.md §8.9 中**未定义**。
> 来源：plan.md §8.9

### 2.11 出版（快照）

| 方法   | 路径                                 | 用途                                                         | 请求体来源（Zod schema） | 权限要求                                                     | 关键状态码                                             |
| ------ | ------------------------------------ | ------------------------------------------------------------ | ------------------------ | ------------------------------------------------------------ | ------------------------------------------------------ |
| `GET`  | `/api/v1/books/:bookId/releases`     | 出版快照列表                                                 | —                        | 项目所属组织成员                                             | 未定义                                                 |
| `POST` | `/api/v1/books/:bookId/releases`     | **同步**生成出版快照（编目节点 ≤ 2 000、文章页 ≤ 5 000；服务端 120s / 客户端 180s） | 未定义                   | 项目所属组织成员                                             | 超规模 → **413**；超时 → **504**；其余未定义           |
| `POST` | `/api/v1/releases/:releaseId/revoke` | 作废版本（快照不可修改）                                     | 未定义                   | 项目所属组织成员                                             | 未定义；重复作废 → `GX007` → 409                       |
| `POST` | `/api/v1/releases/:releaseId/purge`  | 清除出版版本（**仅组织所有者**）                             | 未定义                   | **owner 专属**；权限名 `release.purge`，矩阵中标注 `ownerOnly` | 非 owner → `GX006` → 403；产物缺失 → `GX011` → **500** |

> 来源：plan.md §8.9、§11.6、§7.5、§8.3

### 2.12 媒体

| 方法   | 路径                                       | 用途                                                         | 请求体来源（Zod schema） | 权限要求                                                    | 关键状态码                     |
| ------ | ------------------------------------------ | ------------------------------------------------------------ | ------------------------ | ----------------------------------------------------------- | ------------------------------ |
| `POST` | `/api/v1/projects/:projectId/media-assets` | 上传媒体（服务端代理；`bodyLimit` 10 MB；校验会话、项目权限、大小、content-type，计算 SHA-256） | 未定义                   | 项目所属组织成员；`object_key` 由服务端生成，客户端不能指定 | 超出大小 → **413**；其余未定义 |
| `GET`  | `/api/v1/media-assets/:mediaAssetId`       | 鉴权下载                                                     | —                        | 项目所属组织成员（走鉴权代理或短时签名 URL）                | 未定义                         |

> 说明：媒体删除、人物/文章与媒体的关联端点在 plan.md §8.9 中**未定义**。
> 来源：plan.md §8.9、§12.1、§15.1.2

### 2.13 探活与文档

| 方法  | 路径          | 用途                                             | 请求体来源（Zod schema） | 权限要求   | 关键状态码 |
| ----- | ------------- | ------------------------------------------------ | ------------------------ | ---------- | ---------- |
| `GET` | `/api/health` | 探活（只检查进程与数据库连通性，不检查对象存储） | —                        | 公开端点   | 未定义     |
| —     | `/api/docs`   | Scalar 渲染的 OpenAPI 文档（`app.doc()` 输出）   | —                        | **未定义** | 未定义     |

> 来源：plan.md §8.9、§13、`ARCH-HONO-06`

### 2.14 审计

plan.md **未定义**任何审计查询端点。

审计的两个级别（DB 级强审计 / 应用级尽力而为审计）见 §12.2：强审计由受控 `SECURITY DEFINER` 函数内部 `INSERT audit_log` 完成，尽力而为审计由各域 service 调 `audit.record()`。

> 来源：plan.md §8.9（端点清单中无审计端点）、§12.2

---

## 3. 全局约束小结

| 约束                           | 说明                                                         | 出处                     |
| ------------------------------ | ------------------------------------------------------------ | ------------------------ |
| 路径参数校验                   | 路径参数、查询参数**必须**经 `zValidator` 校验后才使用；`c.req.param()` 返回 `string`，直接当 UUID 用等于不校验 | §8.1 `ARCH-HONO-04`      |
| 全链式调用                     | 所有路由方法必须链式调用，否则 `hc()` 类型推导静默失效       | §8.1 `ARCH-HONO-01`      |
| 具名变量推断类型               | 必须 `export const routes = app.get(...)`，类型从已声明变量推断 | §8.1 `ARCH-HONO-01`      |
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

## 4. plan.md 未定义项汇总

以下内容 plan.md §8 未给出，需在后续 spec 中补齐，不得在实现阶段自行编造：

| 类别     | 未定义项                                                     |
| -------- | ------------------------------------------------------------ |
| Schema   | 除 `CreateNodeSchema` / `NodeIdParamsSchema` / `NodeResponseSchema` / `ErrorSchema` 外，所有端点的入参 Zod schema 名 |
| 状态码   | 除 `201`（创建示例）、`400`（校验失败）、`401`、`403`、`404`、`409`、`413`、`500`、`504` 外的逐端点关键状态码 |
| 权限名   | 除 `person.write`、`release.purge`（`ownerOnly`）外的完整权限名矩阵（矩阵本体在 `packages/shared/src/permissions.ts`，不在 plan.md 中） |
| 分页     | 游标 / 每页大小 / 上限的**具体参数名**                       |
| 限流     | 配额数值、返回 HTTP 状态码、限流响应体格式                   |
| 幂等     | 通用 `Idempotency-Key` 机制                                  |
| 批量     | 批量导入 / 批量写入端点及其上限                              |
| 端点     | folder 修改/删除、姓名修改/删除、关系修改/删除、事件修改/删除、来源/引用修改/删除、编目项修改/删除、谱文分页创建、媒体删除与关联、**兑换邀请的具体路径**、审计查询端点 |
| 错误映射 | `RATE_LIMITED` 对应的具体 HTTP 状态码；`ErrorCode` → HTTP 的完整对照表（plan.md 只给枚举与构造器） |

---

> 本文所有内容均出自 plan.md；未在原文出现的信息一律标注「未定义」。