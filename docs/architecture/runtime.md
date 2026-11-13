# 运行时与 API 层

> 本文件是「Hono/Bun 运行时、中间件链、依赖注入与错误映射落地」的唯一权威；其他主题见 `docs/README.md` 导航，同一主题不复制表格。

## 8. API 层

### 8.1 Hono 组织方式

> `ARCH-HONO-01`（1.2 修正）：原 1.1 版的示例代码**调用了不存在的 API**：`createFactory()` 返回的是 `Factory` 实例，它只有 `createApp()` / `createMiddleware()` / `createHandlers()` 三个方法，**没有 `.use()` / `.get()` / `.post()`**。把 `Factory` 当成 `Hono` 实例用，代码根本编译不过。官方推荐的「大型应用」结构是：**每个子路由是一个独立的 `Hono` 实例，`export default` 出去；顶层用 `app.route()` 挂载并链式赋值给一个具名变量**。

**每个模块的 router.ts**（`apps/api/src/modules/genealogy/router.ts`）：

```ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { CreateNodeSchema, NodeIdParamsSchema } from '@yunpu/shared/schemas';
import type { AppEnv } from '../../types';
import { genealogyService } from './service';

const app = new Hono<AppEnv>();

// 全部方法必须链式调用；类型从「已声明的变量」推断
export const routes = app
  .get('/:lineageId/nodes',
    zValidator('param', NodeIdParamsSchema),
    async (c) => {
      const { lineageId } = c.req.valid('param');
      const data = await genealogyService.getNodes(lineageId);
      return c.json({ ok: true as const, data });
    })
  .post('/:lineageId/nodes',
    zValidator('param', NodeIdParamsSchema),
    zValidator('json', CreateNodeSchema),
    async (c) => {
      const { lineageId } = c.req.valid('param');
      const input = c.req.valid('json');
      const data = await genealogyService.placeNode(lineageId, input);
      return c.json({ ok: true as const, data }, 201);
    });

export default app;
export type GenealogyRoutes = typeof routes;
```

**顶层组装**（`apps/api/src/app.ts`）：

```ts
import { Hono } from 'hono';
import genealogy from './modules/genealogy/router';
import organization from './modules/organization/router';
import project from './modules/project/router';

const app = new Hono<AppEnv>()
  .use(requestId())
  .use(secureHeaders())
  .use(compress())
  .use(requestContext())
  .use(authMiddleware())
  .use(rateLimit())
  .onError(appErrorHandler)
  .notFound(appNotFoundHandler);

export const routes = app
  .route('/api/v1/organizations', organization)
  .route('/api/v1/projects', project)
  .route('/api/v1/lineages', genealogy);

export default app;
export type AppType = typeof routes;
```

**四条硬纪律**（全部来自官方 RPC 文档的明确要求）：

1. **所有路由方法必须链式调用。** 拆成多条语句（`app.get(...)`; `app.post(...)`）会让 `hc()` 的类型推导静默失效——不报错，只是类型退化成 `any`。官方原文："all included methods must be chained"。
2. **类型必须从具名变量推断。** 写 `export default app` 而不写 `export const routes = app.get(...)`，RPC 客户端就拿不到路由类型。官方要求 "the endpoint or app type must be inferred from a declared variable"。
3. **`hc` 客户端类型要预编译**（用 `ReturnType` 固定），否则类型图过大会让 IDE 卡死。
4. **每个 `c.req.valid(target)` 必须有对应的 validator 注册。** `c.req.valid('param')` 只有在链上注册了 `zValidator('param', …)` 才有值；否则 `valid('param')` 返回 `undefined`，且**不会报错**——这正是 1.1 版示例里的真实缺陷（只注册了 `json` 却读 `param`）。路径参数一律经 `zValidator('param', …)` 校验，顺带解决路径参数类型不安全的问题。

> `ARCH-HONO-04`：路径参数、查询参数**必须**经 `zValidator` 校验后才使用。Hono 的 `c.req.param()` 返回 `string`，直接把它当 UUID 用等于不做校验。

### 8.1.1 依赖注入：为什么不用 `createFactory`

`createFactory` 的用途是**给中间件和 handler 复用同一套 `Env` 类型**，而不是注入运行时依赖。它的 API 是：

```ts
const factory = createFactory<AppEnv>();
const authMiddleware = factory.createMiddleware(async (c, next) => { … });
const app = factory.createApp();          // 可带 initApp / defaultAppOptions
```

它**不提供** `use()` / `get()` / `post()`，也不能注入 `db`、`services` 这类运行时对象。

本项目需要注入的是运行时依赖（数据库连接池、服务实例、对象存储客户端），因此走 **`Hono<AppEnv>` + `c.get()`** 路线：

```ts
export type AppBindings = {
  db: Db;
  services: Services;
  logger: Logger;
  storage: Storage;
};
export type AppEnv = { Variables: AppBindings };
```

`createFactory` 的 `createMiddleware` 仍然值得用——共享中间件（`authMiddleware`、`rateLimit`）用它可以自动带上 `AppEnv` 类型，不必每个文件重复标注泛型。**两者不冲突：工厂用于中间件类型，`Hono` 实例用于路由与依赖注入。**

> `ARCH-HONO-05`（1.2 修正）：**不要用全局 `declare module 'hono'` 扩展 `ContextVariableMap` 来放业务变量。** 官方文档明确指出：`ContextVariableMap` 是**全局**增强——即使某个 handler 根本没挂载写入该变量的中间件，`c.get('x')` 也会被类型成非 `undefined`，**运行时的 `undefined` 被类型系统掩盖**。本项目的 `Variables` 全部声明在 `AppEnv` 上（`Hono<AppEnv>`），作用域限定在真正使用了它的 app 实例，不做全局增强。

### 8.1.2 组装

```ts
const app = new Hono<AppEnv>()
  .use(requestId())
  .use(secureHeaders())
  .use(compress())
  .use(requestContext())
  .use(authMiddleware())
  .use(rateLimit())
  .onError(appErrorHandler)
  .notFound(appNotFoundHandler)
  .route('/api/v1/organizations', organization)
  .route('/api/v1/projects', project)
  .route('/api/v1/lineages', genealogy);
```

测试时注入 mock 的 `services`，路由测试不需要真数据库。`app.request(input, requestInit?, env?, executionCtx?)` 的第三个参数就是 `Env`，测试里用它注入 `Bindings`：

```ts
const res = await app.request(
  '/api/v1/lineages/l1/nodes',
  { headers: { Authorization: 'Bearer test-token' } },
  { db: fakeDb, services: fakeServices, logger: fakeLogger, storage: fakeStorage },
);
```


### 8.2 中间件链与请求上下文

中间件按注册顺序进入、按逆序返回（§2.1）。本项目的链固定为：

```ts
app.use(requestId());        // ① 必须最先：后续所有日志都要 requestId
app.use(secureHeaders());    // ② 安全响应头
app.use(compress());         // ③ 响应压缩
app.use(requestContext());   // ④ 结构化日志字段
app.use(authMiddleware());   // ⑤ 会话解析
app.use(rateLimit());        // ⑥ 限流
```

- `requestId()` 用官方实现，`c.get('requestId')` 全链路可用；日志字段统一从这里取，不自己生成 UUID。
- `authMiddleware` 成功后 `c.set('user', user)`；**未认证不返回 401 立即中断**，而是把 `user` 留空、由各路由按需判定「公开端点」还是「需要登录」。这样公开端点（health、登录、兑换邀请）与受保护端点共用一条链，不靠路径匹配做权限判断。
- `rateLimit` 放在认证之后：**按用户限流比按 IP 限流更准**，且能避免未认证流量打满共享配额。
- 全局错误兜底是 `app.onError(...)`，**不是中间件**（§2.1 纪律 2）。

### 8.3 错误模型

```ts
export type ErrorCode =
  | 'VALIDATION' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND'
  | 'CONFLICT' | 'RATE_LIMITED' | 'INTERNAL';

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status: number,
    readonly details?: Record<string, string>,
  ) { super(message); }
}
```

- service 抛领域错误，不返回错误对象；抛异常才能保证错误不会被忽略。
- 一个全局 `onError` 把领域错误映射成 HTTP 响应，handler 不写 try/catch。
- 未识别异常一律 500，响应体不含堆栈；堆栈只进日志。
- 响应体统一为 `{ ok: true, data }` 或 `{ ok: false, code, message, details? }`。

> `ARCH-HONO-07`（1.2 修正）：`onError` 必须**同时处理 `HTTPException`**。Hono 内置的 `validator` / `zValidator` 在校验失败时抛的是 `HTTPException(400)`（`zValidator` 默认还会附带 `ZodError`），`HTTPException` 不是我们的 `AppError`，若不显式处理，它会绕过统一错误体、直接以 Hono 的默认格式返回——**响应体契约就破了**。

```ts
app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json(
      { ok: false as const, code: err.code, message: err.message, details: err.details },
      err.status as ContentfulStatusCode,
    );
  }
  if (err instanceof HTTPException) {
    // zValidator / validator 的校验失败走这里；details 里带 ZodError 字段列表
    return c.json(
      { ok: false as const, code: 'VALIDATION', message: err.message },
      err.status as ContentfulStatusCode,
    );
  }
  logger.error({ err, requestId: c.get('requestId') }, 'unhandled error');
  return c.json({ ok: false as const, code: 'INTERNAL', message: '服务器内部错误' }, 500);
});
```

**`HTTPException.getResponse()` 的坑**（官方文档明确标注）：它**不感知 `Context`**，因此在 `Context` 上已设置的响应头不会出现在它生成的 `Response` 里。本项目**不使用** `getResponse()`，统一用 `c.json()` 自行构造响应——这样安全响应头（`secureHeaders`）与 `X-Request-Id` 才不会丢。

数据库错误集中映射——**两级：先看 SQLSTATE，再看约束名**（`ARCH-ERR-01`）：

**错误码的唯一权威在数据模型 §9.4**，本文不维护第二份映射表（`ARCH-AR-06` 单一真相源）。下表只说明**落地方式**：SQLSTATE 层如何归类、约束名如何做第二级细化。

```ts
// 第一级：SQLSTATE → 应用错误码。
// 应用错误码的**取值集合**来自 data-model §9.4，由 scripts/gen-sql.ts 生成，
// 不在本文件手写第二份（ARCH-AR-06）。
// 本表只做「SQLSTATE 归类」，不重新定义错误码语义与 HTTP 状态——那两件事在 data-model §9.4。
const PG_SQLSTATE_BUCKET: Record<string, ErrorCode[]> = {
  '23505': ['DUPLICATE_PRIMARY_NAME', 'INVITE_ALREADY_PENDING', 'RELATION_DUPLICATE'],
  '23503': ['NODE_PARENT_MISSING', 'PROJECT_SCOPE_VIOLATION', 'BOOK_HAS_RELEASE'],
  '23001': ['OWNER_MEMBER_REQUIRED'],
  '23514': ['SELF_RELATION', 'SYMMETRIC_ORDER', 'EVENT_SUBJECT_INVALID', 'BLANK_TEXT'],
  '42501': ['FORBIDDEN'],
  '22P02': ['INVALID_INPUT'],
  '55P03': ['LOCK_TIMEOUT'],
  '57014': ['STATEMENT_TIMEOUT'],
  'GX001': ['LINEAGE_CYCLE'],
  'GX002': ['SCOPE_IMMUTABLE'],
  'GX003': ['SNAPSHOT_IMMUTABLE'],
  'GX004': ['APPEND_ONLY'],
  'GX005': ['TARGET_INVALID'],
  'GX006': ['FORBIDDEN'],
  'GX007': ['INVALID_STATE'],
  'GX008': ['NO_AUTH_CONTEXT'],
  'GX009': ['INVITE_EMAIL_MISMATCH'],
  'GX010': ['CONCURRENT_MODIFICATION'],
  'GX011': ['ARTIFACT_MISSING'],
};
```

> **`23001` 与 `23503` 必须分开**（data-model §9.4 v1.2 修正）。合并处理会让「引用了被保护的对象」和「级联动作被拒」返回同一个错误，用户看到「无法删除」却不知道是保护机制在起作用还是数据有问题。
>
> **`GX010` 同时覆盖邀请兑换与所有权转移**两条并发抢占失败路径——两者的共同语义是「操作已被并发请求抢先」，不是「邀请已被兑换」。文案若只写邀请，会让所有权转移的 409 变成误导。
>
> **`GX011` 是 500 而非 409**：产物字节缺失是**服务端状态不一致**，不是客户端可以重试解决的问题。归到 409 会诱导客户端无限重试。

**第二级：约束名 → 具体文案。** 约束一律具名（`DM-GEN-13`），所以这条映射能落到具体原因。约束名以数据模型 §5 与实际 DDL 为准：

| 约束名                               | 文案                            | DDL 中的类型 |
| ------------------------------------ | ------------------------------- | ------------ |
| `uq_invite_pending_email`            | 该邮箱已有待处理邀请            | 唯一索引     |
| `uq_person_name_primary`             | 该人物已有主显示名              | 唯一索引     |
| `uq_node_one_primary`                | 该人物在本谱系已有 primary 节点 | 唯一索引     |
| `uk_node_path`                       | 该谱系下已存在相同路径的节点    | 唯一索引     |
| `uk_person_name_value`               | 该人物已有完全相同的姓名        | 唯一索引     |
| `uk_person_relation_kind`            | 这两位人物之间已存在同类关系    | 唯一索引     |
| `uk_book_release_version`            | 该谱书已存在相同版本号          | 唯一索引     |
| `uk_media_asset_object_key`          | 该对象 key 已被占用             | 唯一索引     |
| `ck_person_relation_symmetric_order` | 对称关系只能存一种方向          | CHECK        |
| `ck_event_subject_xor`               | 事件必须且只能关联一个主体      | CHECK        |
| `ck_source_citation_target_xor`      | 一条引用只能指向一个事实        | CHECK        |
| `ck_book_catalog_content_match`      | 目录项类型与内容引用不匹配      | CHECK        |
| `fk_organization_owner`              | 新 owner 必须是组织成员         | 外键         |

> **唯一索引也会上报 `constraint` 名**：PostgreSQL 对唯一索引冲突报的 `driverError.constraint` 是**索引名**，不是表约束名。因此 `uq_*` / `uk_*` 同样进入第二级匹配表。
>
> **`uq_person_relation_sort_order` 不存在**——展示顺序不是事实，唯一约束会制造 O(n) 重排工作（`DM-REL-04`）。若这张表里出现了它，说明有人把已删除的约束加回来了。

- 匹配顺序：先查 `PG_CONSTRAINT_MESSAGES[constraint_name]`，命中则用具体文案；否则退回 `PG_ERROR_MAP[sqlstate]`。
- PostgreSQL 的 `driverError` 里带 `constraint` 与 `code` 字段，取 `constraint` 做第二级匹配。
- `ON DELETE RESTRICT` 在 PostgreSQL 18 报 `23001`，不是 `23503`；两个都映射，避免遗漏。

### 8.4 依赖注入

依赖注入的完整约定见 §8.1.1（为什么不用 `createFactory`）与 §8.1.2（组装）。这里只列纪律：

| 纪律                                                         | 理由                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| 运行时依赖（`db` / `services` / `logger` / `storage`）通过 `AppEnv['Variables']` + `c.get()` 获取 | 作用域限定在真正使用它的 app 实例；`ContextVariableMap` 全局增强会掩盖 `undefined`（§8.1.1） |
| 依赖在**组装时**注入，不在模块顶层 new                       | 模块级单例让测试无法替换数据库，也让依赖关系隐形             |
| service 层通过参数接收依赖，不从 `c` 里取                    | service 不感知 HTTP（§5.2）；路由负责把 `c.get('services')` 转成参数 |
| 测试用 `app.request(path, init, env)` 注入 mock              | 官方调用约定，无额外 DI 框架（§14.1）                        |
| 共享中间件用 `factory.createMiddleware` 拿类型               | 自动带上 `AppEnv` 类型，不必每个文件重复标注泛型             |

### 8.5 Schema 单一真相源

- 数据模型定义表、字段、约束与索引。
- `packages/db/src/schema` 的 Drizzle 定义镜像数据模型；不另写业务规则。
- `packages/shared/src/schemas` 的 Zod 定义输入/输出契约；跨实体规则手写，单表 CRUD 用 `drizzle-zod` 派生。
- 前端表单与后端入参用同一个 Zod schema：前端 `safeParse` 即时校验，后端 `zValidator` 权威校验。
- 枚举、模块清单、表清单只在 `packages/shared/src/domain` 定义一次，生成 SQL CHECK 与函数体；CI 校验生成物与提交物一致。

### 8.6 校验的官方语义（`ARCH-HONO-08`）

`zValidator` 包装的 `validator` 中间件，各 target 的取值来源是**确定**的，写代码时必须知道，否则会出现「校验通过但拿到的是空对象」：

| target   | 取值来源             | 注意                                                         |
| -------- | -------------------- | ------------------------------------------------------------ |
| `json`   | `await c.req.json()` | **仅当 `Content-Type` 匹配 `application/json` 或 `*+json` 时才解析**；不匹配则取到空对象 `{}`。JSON 畸形抛 `HTTPException(400)` |
| `form`   | `FormData`           | 键名以 `[]` 结尾或重复出现时值为数组                         |
| `query`  | 查询参数对象         | 值一律是字符串；重复键为数组。数字/布尔必须用 `z.coerce.number()` / `z.coerce.boolean()` |
| `param`  | `c.req.param()`      | 路径参数一律是字符串                                         |
| `header` | `c.req.header()`     |                                                              |
| `cookie` | `getCookie(c)`       |                                                              |

由此得到四条纪律：

1. **`json` target 必须配 `Content-Type` 检查。** 客户端不发 `Content-Type: application/json` 时，`zValidator('json', …)` 拿到的是 `{}`——schema 若是全可选就会**静默通过**。写接口统一在中间件层校验 `Content-Type`，或在 schema 中保证必填字段。
2. **查询参数里的数字必须 `z.coerce`。** `?page=2` 到达 Zod 是字符串 `"2"`，不 coerce 就是类型不匹配。
3. **`GET`/`HEAD` 不能用 `json` / `form` target**（官方在类型层面已排除这两个组合）。
4. **校验失败可以短路请求。** `zValidator` 的第三个参数是 hook：返回 `Response` 则直接短路，不再进 handler。

```ts
zValidator('json', CreateNodeSchema, (result, c) => {
  if (!result.success) {
    return c.json({
      ok: false as const,
      code: 'VALIDATION' as const,
      message: '请求参数不合法',
      details: result.error.flatten().fieldErrors,
    }, 400);
  }
})
```

> `ARCH-HONO-09`：**校验失败的响应体格式由 hook 统一**，不依赖 `zValidator` 的默认行为（默认抛 `HTTPException`，走 §8.2 的 `onError` 分支）。两条路都产出 `{ ok: false, code, message }`，前端只需处理一种形状。

### 8.7 分页：keyset，不用 offset

> `ARCH-API-01`（1.1 修正）：`uuidv7()` 主键时间有序，**主键本身就是游标**。旧版示例按 `(created_at, id)` 排序翻页，却没有任何索引支撑——索引清单里 `person` 表根本没有 `(project_id, created_at, id)`，每页都是全扫加排序；同时 `created_at` 是冗余排序键，而文档自己说「uuidv7 可直接当游标」却没用它。**消掉这个特殊情形**：复合主键 `(project_id, id)` 就是现成索引，零新增。

```sql
SELECT *
FROM person
WHERE project_id = $1 AND id > $2
ORDER BY id
LIMIT $3;
```

- 游标即上一页最后一行的 `id`；`id` 是 UUIDv7，时间有序，插入新行不会造成重复或漏读已翻过的页。
- Node 列表按 `path` 排序（树视图不用游标分页，按父路径查子节点）；谱系树同理。
- 需要「按创建时间排序」的场景，用 `ORDER BY created_at, id` 的复合游标，并**同步建立** `(project_id, created_at, id)` 索引——有排序键必有索引，不留无索引的示例。
- 翻页期间插入新行不会重复或漏行。总数用单独的估算查询，不每次 `COUNT(*)`。

### 8.8 OpenAPI

用**官方 `@hono/zod-openapi`**：`createRoute` 定义路由元数据与请求/响应 schema，`OpenAPIHono` 承载路由，`app.doc()` 输出规格，Scalar 渲染。

```ts
import { createRoute, z } from '@hono/zod-openapi';

export const getNodeRoute = createRoute({
  method: 'get',
  path: '/lineages/{lineageId}/nodes/{nodeId}',
  request: { params: NodeIdParamsSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: NodeResponseSchema } },
      description: '节点详情',
    },
    404: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: '不存在',
    },
  },
});
```

- **请求 schema 与 `zValidator` 用同一个 Zod 对象**：`NodeIdParamsSchema` 既进 `createRoute` 又进 `zValidator('param', NodeIdParamsSchema)`，不存在两份定义。
- **`z` 从 `@hono/zod-openapi` 导入**（扩展版 Zod），才能用 `.openapi()` 挂载元数据与示例。
- 契约从代码生成，不手写 YAML；手写 OpenAPI 一定和代码漂移。
- 错误响应也在契约里声明（`ErrorSchema`），前端拿到的错误形状有文档可依。

### 8.9 端点骨架

| 方法               | 路径                                                      | 语义                       |
| ------------------ | --------------------------------------------------------- | -------------------------- |
| `POST`             | `/api/v1/auth/sign-in` `/sign-up` `/sign-out`             | 认证                       |
| `PATCH`            | `/api/v1/account`                                         | 资料                       |
| `POST`             | `/api/v1/account/password`                                | 改密                       |
| `GET/POST`         | `/api/v1/organizations`                                   | 我的组织 / 创建组织        |
| `GET/PATCH`        | `/api/v1/organizations/:organizationId`                   | 详情 / 改名或归档          |
| `GET/POST`         | `/api/v1/organizations/:organizationId/invites`           | 邀请列表 / 创建邀请        |
| `DELETE`           | `/api/v1/organizations/:organizationId/invites/:inviteId` | 撤销邀请                   |
| `PUT`              | `/api/v1/organizations/:organizationId/owner`             | 转移所有权                 |
| `GET/POST`         | `/api/v1/organizations/:organizationId/projects`          | 项目列表 / 创建            |
| `GET/PATCH/DELETE` | `/api/v1/projects/:projectId`                             | 项目详情 / 编辑 / 删除     |
| `GET/POST`         | `/api/v1/projects/:projectId/folders`                     | 分类                       |
| `GET/POST`         | `/api/v1/projects/:projectId/lineages`                    | 谱系列表 / 创建            |
| `GET/PATCH/DELETE` | `/api/v1/lineages/:lineageId`                             | 谱系详情 / 编辑 / 删除     |
| `GET/POST`         | `/api/v1/lineages/:lineageId/nodes`                       | 节点列表 / 建节点          |
| `PATCH/DELETE`     | `/api/v1/nodes/:nodeId`                                   | 改 / 删子树                |
| `GET/POST`         | `/api/v1/projects/:projectId/persons`                     | 人物列表 / 创建            |
| `GET/PATCH/DELETE` | `/api/v1/persons/:personId`                               | 人物详情 / 编辑 / 删除     |
| `GET/POST`         | `/api/v1/persons/:personId/names`                         | 姓名                       |
| `GET/POST`         | `/api/v1/persons/:personId/relations`                     | 关系边                     |
| `GET/POST`         | `/api/v1/persons/:personId/events`                        | 事件                       |
| `GET/POST`         | `/api/v1/projects/:projectId/sources`                     | 来源                       |
| `GET/POST`         | `/api/v1/projects/:projectId/citations`                   | 考证引用                   |
| `GET/POST`         | `/api/v1/projects/:projectId/articles`                    | 谱文                       |
| `GET/PATCH/DELETE` | `/api/v1/articles/:articleId`                             | 谱文详情                   |
| `PUT/DELETE`       | `/api/v1/articles/:articleId/pages/:pageId`               | 分页富文本                 |
| `GET/POST`         | `/api/v1/projects/:projectId/books`                       | 谱书                       |
| `GET/POST`         | `/api/v1/books/:bookId/catalog`                           | 编目树                     |
| `GET/POST`         | `/api/v1/books/:bookId/releases`                          | 出版快照（同步，见 §11.6） |
| `POST`             | `/api/v1/releases/:releaseId/revoke`                      | 作废版本                   |
| `POST`             | `/api/v1/releases/:releaseId/purge`                       | 清除版本（owner）          |
| `POST`             | `/api/v1/projects/:projectId/media-assets`                | 上传媒体                   |
| `GET`              | `/api/v1/media-assets/:mediaAssetId`                      | 鉴权下载                   |
| `GET`              | `/api/health`                                             | 探活                       |

**路径参数一律使用内部 UUID。** URL 不承担授权，授权由会话、RBAC 和 RLS 完成。请求体里的任何 ID 也必须是内部 UUID。

---
