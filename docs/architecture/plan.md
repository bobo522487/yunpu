# 云谱实施计划 · Plan 1.0



---

## 0. TL;DR

**云谱**是给修谱主事人与修谱工作室用的在线谱牒编纂 SaaS。组织（家族/工作室）建立项目，在项目中录入人物事实、关系、事件与谱系位置，撰写谱文、登记来源与引用，编排谱书目录并生成出版快照。

**一句话架构**：模块化单体。Bun 跑一个 Hono 服务，同时提供 API 与前端静态资源；一个 PostgreSQL 18 承载全部业务域，用 RLS 做租户隔离；对象存储存私有媒体。没有微服务、消息队列、缓存中间件和搜索引擎。

**四条不可协商的原则**：

1. **领域逻辑只有一份**（`ARCH-AR-01`）。每个业务域的规则只存在于该域的 service；HTTP 层是胶水，数据层是映射。同一规则出现两次就是 bug。
2. **隔离靠数据库**（`ARCH-AR-02`）。租户边界写在 RLS 策略里；应用代码漏写 `WHERE` 也读不到别人的数据。
3. **谱系是图，不是树**（`ARCH-AR-03`）。关系边是事实，`ltree` 路径是位置投影；树形只是图的一个人类可读视图。
4. **规则要有执行者**（`ARCH-AR-04`）。没有数据库约束、触发器、脚本或测试保证的「规则」不是规则，是愿望。

---

## 1. 设计原则

### 1.1 明确不做

**「明确不做」清单的唯一权威副本在 [`spec.md`](./spec.md) §8，编号 `OOS-01`..`OOS-19`。** 本文不复制该表——同一主题只在**一个**文档里定义（宪法 Article VI）。

架构视角补充的复评条件（spec.md 未覆盖的部分）：

| 编号     | 不做                        | 架构侧理由                                     | 复评触发条件                         |
| -------- | --------------------------- | ---------------------------------------------- | ------------------------------------ |
| `OOS-08` | 微服务                      | 单容器单进程，一个镜像一个端口一个健康检查     | 出现需要独立扩缩容的热点             |
| `OOS-09` | 消息队列 / Redis / 任务框架 | 没有第二个消费方；确有异步需求时先用 PG 表队列 | 出现第二个消费方                     |
| `OOS-16` | 多数据库 / 分库分表         | 一个 PostgreSQL 能装下十年数据                 | 连接数或单表规模逼近实测上限         |
| `OOS-17` | 第二套测试运行器            | `bun test` 能连真 PG 跑集成                    | 出现 `bun test` 无法覆盖的测试类型   |
| `OOS-18` | 多套画布渲染路径            | 三条路径要三个人养；只做一条，等信号出现再换   | 实测性能或交互需求确实需要第二条路径 |

### 1.2 五条硬约束

| #            | 约束                                                         | 执行者                            | 验证方式                |
| ------------ | ------------------------------------------------------------ | --------------------------------- | ----------------------- |
| `ARCH-AR-05` | **依赖单向**：前端 → API → service → 数据层。数据层不知道 API 存在，service 不知道 HTTP 存在 | Biome `noRestrictedImports`       | CI lint + 交叉探针测试  |
| `ARCH-AR-06` | **单一真相源**：一份 Zod schema 约束前后端入参；一份数据模型定义表结构；Drizzle schema 镜像数据模型 | `packages/db` + `packages/shared` | `schema verify` CI 任务 |
| `ARCH-AR-07` | **约束必须有执行者**                                         | 见各章「执行者」列                | 验收清单逐条对应        |
| `ARCH-AR-08` | **失败要响亮**：错误要么是明确的领域错误，要么向上抛；禁止静默吞异常、禁止 `catch { return null }` | `AppError` + 全局 `onError`       | 代码评审 + 集成测试     |
| `ARCH-AR-09` | **不猜未来**：接口按当前需要设计；确有扩展需求时留一个接口，不预埋空实现 | 代码评审                          | §16 演进触发条件        |

### 1.3 复杂度预算

> `ARCH-GOV-01`：**400 行红线是警报，不是合并门禁。** 为凑行数把内聚模块切碎，是指标驱动设计，不是设计驱动指标。超过 400 行触发评审讨论「是否内聚」，不触发自动拒绝。

| 项                                  | 参考上限                          | 性质   | 超了怎么办                               |
| ----------------------------------- | --------------------------------- | ------ | ---------------------------------------- |
| 单文件行数                          | 400                               | 警报   | 评审时确认模块是否内聚；确需拆分由人决定 |
| 依赖方向分区数（Biome `overrides`） | ≤ 8                               | 硬约束 | 合并目录，而不是加规则                   |
| 业务模块数                          | ≤ 8                               | 硬约束 | 域太大就拆；域太小就合并                 |
| 数据库表数量                        | ≤ 30（当前 22）                   | 硬约束 | 超了说明模型没想清楚                     |
| 同时运行的基础设施组件              | 3（应用 / PostgreSQL / 对象存储） | 硬约束 | 每加一个都要有人愿意运维它               |

### 1.4 Constitution Check（门禁）

> **GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.**
> 两个时点，两次检查，缺一不可。

**第一次（Phase 0 之前）——本计划自身的合规性自查：**

| #    | 宪法条款                   | 本计划的落点                                      | 通过 |
| ---- | -------------------------- | ------------------------------------------------- | ---- |
| 1    | Article I 简单胜过聪明     | 单进程单容器；8 个业务域；无抽象框架层            | ✅    |
| 2    | Article II 删掉就是删掉    | `OOS-06` 软删除不做；组织归档是状态列             | ✅    |
| 3    | Article III 规则要有执行者 | 本文所有约束均标注执行者与验证方式                | ✅    |
| 4    | Article IV 数据优于抽象    | 无 Family 表；家庭视图由关系推导（§6.3）          | ✅    |
| 5    | Article V 隔离靠数据库     | §7 RLS 策略是唯一租户隔离执行者                   | ✅    |
| 6    | Article VI 单一真相源      | §1.5 数据层权威；§5.3 模块清单只有一份            | ✅    |
| 7    | Article VII 不猜未来       | §16 演进触发条件；无预埋接口                      | ✅    |
| 8    | Article VIII 失败要响亮    | §8.3 错误模型；`AppError` + 全局 `onError`        | ✅    |
| 9    | Article IX 先测量再优化    | §6.6 索引策略按查询模式建                         | ✅    |
| 10   | 复杂度预算                 | 8 域 / 22 表 / 3 基础设施组件，均在预算内（§1.3） | ✅    |
| 11   | `OOS-01`..`OOS-19`         | 本计划未引入任何「不做」清单里的东西              | ✅    |

**第二次（Phase 1 设计之后）——写 `tasks.md` 之前的复核：**逐条回答「新增了什么、它的执行者是谁、编号是否已登记」。空着不写就等于不允许。

**触发 Complexity Tracking 的条件**：任何设计需要突破 §1.3 复杂度预算、引入新抽象层、或放宽「明确不做」清单。登记三列——Violation / Why Needed / Simpler Alternative Rejected Because（见 §20）。

### 1.5 数据层权威

- 表、字段、约束、索引、视图、RLS、数据库函数以 [`data-model.md`](./data-model.md) 为唯一权威。
- 本文只回答：**数据属于哪个模块、谁来写、跨模块怎么读、哪些不变量必须在数据库里**。
- 字段级变更先改数据模型，再改 Drizzle schema 与迁移；本文不维护第二份表结构。
- 任何「`plan.md` 里有一张表、`data-model.md` 里没有」或反过来的情况，都按缺陷处理。

---

## 2. 系统全景

```
                        ┌───────────────────────────────┐
   浏览器 ────HTTPS────> │  单容器 · 单进程 · Bun        │
                        │  ├─ Hono: /api/v1/**          │
                        │  └─ 静态资源: /* (SPA)        │
                        └───────────┬───────────────────┘
                                    │ 连接池 (PgBouncer)
                        ┌───────────▼───────────────────┐
                        │  PostgreSQL 18                │
                        │  ├─ public: 业务表 + RLS      │
                        │  ├─ auth:   Better Auth 表     │
                        │  └─ app:    SECURITY DEFINER   │
                        │             函数与只读视图      │
                        └───────────┬───────────────────┘
                                    │ 服务端代理上传 / 鉴权下载
                        ┌───────────▼───────────────────┐
                        │  对象存储（私有桶）            │
                        └───────────────────────────────┘
```

一个进程同时提供 API 与静态资源是刻意的：一个镜像、一个端口、一个健康检查、一个 Deployment。应用无状态，横向扩容只受数据库连接数限制。

### 2.1 一次请求的完整生命周期

```
浏览器
  │  POST /api/v1/projects/:projectId/lineages/:lineageId/nodes
  ▼
Hono 中间件链（洋葱模型）
  │  ① requestId()      生成/透传 X-Request-Id
  │  ② secureHeaders()  安全响应头
  │  ③ compress()       响应压缩
  │  ④ requestContext() 日志上下文与结构化字段
  │  ⑤ authMiddleware() 会话解析 → c.set('user', …)
  │  ⑥ rateLimit()      限流
  ▼
路由 handler（薄胶水）
  │  zValidator('param', …) → zValidator('json', …)
  │  c.req.valid('param') / c.req.valid('json')
  ▼
领域 service（唯一的规则所在）
  │  withUser(tx, userId)
  │    ── set_config('app.user_id', $1, true)
  │    ── SET LOCAL ROLE genealogy_app
  │    事务内：权限复核 → 领域校验 → 取锁 → 写入
  ▼
PostgreSQL 18
  │  RLS: organization_id = ANY(app.visible_org_array())
  │  复合外键 / CHECK / 唯一索引 / 触发器 / advisory lock
  ▼
显式 DTO 回传 → { ok: true, data } 或 { ok: false, code, message }
```

**中间件执行顺序的官方语义**（`ARCH-HONO-02`）：中间件在 `next()` **之前**按注册顺序执行，在 `next()` **之后**按注册顺序的**逆序**执行（洋葱模型）。由此得到三条纪律：

1. **注册顺序即语义顺序**。`requestId` 必须最先注册（后续所有日志都要用 `c.get('requestId')`）；`secureHeaders` / `compress` 必须早于认证，这样未认证请求也带安全头与压缩。
2. **错误兜底不放在链里**。`app.onError(...)` 是 app 级处理器，不是中间件；把它写成 `app.use(...)` 只会得到一个「捕获后自己返回响应」的普通中间件，绕过全局错误映射。
3. **`c.error` 可读**。handler 抛出的异常会放进 `c.error`；中间件在 `await next()` **之后**可以读它做补充日志或指标（见 §13）。这让「错误已在 `onError` 里处理过」和「需要额外上下文」两件事可以共存，而不重复写 try/catch。

**关键点**：租户上下文由**当前登录用户**推导，不由客户端传入的组织 ID 决定。`app.user_id` 在事务内设置（`is_local = true`），`visible_org_array()` 从成员关系计算可见组织。用会话级设置会让连接池把上下文借给下一个请求，这是跨租户泄露最经典的路径。

---

## 3. Technical Context（运行时与工具链）

| 层         | 选型                         | 版本                  | 为什么是它                                                   |
| ---------- | ---------------------------- | --------------------- | ------------------------------------------------------------ |
| 运行时     | **Bun**                      | ≥ 1.4.4               | 冷启动快、`bun test` 开箱即用、安装快。Playwright 不在 Bun 上跑 → E2E 用 Node |
| Web 框架   | **Hono**                     | v4（≥ 4.11.2）        | 基于 Web Standard，不绑定运行时；RPC 模式免 codegen；中间件洋葱模型 |
| 前端构建   | **Vite**                     | 7.x                   | 冷启动毫秒级；Hono 路由可在 dev 下热重载                     |
| UI         | React                        | 19.x                  | 生态与人才池最大                                             |
| 语言       | TypeScript                   | 5.x                   | `strict` + `noUncheckedIndexedAccess`                        |
| 校验       | **Zod**                      | v4（`^3.25 \|\| ^4`） | 一份 schema 驱动前端表单与后端入参；`drizzle-zod` 从表定义派生单表 CRUD。`@hono/zod-validator` 的 peerDependency 同时支持 Zod 3.25 与 4，选 v4 不冲突 |
| ORM        | **Drizzle**                  | 0.45.x                | SQL 原生，适合递归 CTE、`ltree`、RLS；无冷启动引擎           |
| 数据库     | **PostgreSQL**               | 18                    | `uuidv7()`、`ltree`、RLS、生成列、延迟约束、advisory lock    |
| 服务端状态 | TanStack Query               | v5                    | 缓存、失效、请求去重                                         |
| 视图状态   | Zustand                      | v5                    | 画布、面板、临时选择                                         |
| 路由       | TanStack Router              | v1                    | 文件式、类型安全                                             |
| 组件       | Radix UI + Tailwind CSS      | v4                    | 无样式可访问原语 + CSS-first 令牌                            |
| 画布       | `@xyflow/react`              | v12                   | 小规模家谱树可视化                                           |
| 富文本     | TipTap                       | v3                    | ProseMirror 系，正文存 JSON                                  |
| 认证       | Better Auth                  | 1.7.x                 | Drizzle adapter、数据库会话、自定义 access control           |
| API 文档   | `@hono/zod-openapi` + Scalar |                       | 契约从代码生成，不手写 YAML；官方维护的 `@hono/zod-openapi` 而非第三方 `hono-openapi`（`ARCH-HONO-06`） |
| 测试       | `bun test` + Playwright      |                       | 单元/路由/集成用 Bun；E2E 用 Node（`ARCH-TST-03`）           |
| 质量       | Biome                        | 2.x                   | lint + format + 依赖方向规则                                 |
| 包管理     | **pnpm**                     | 12.x                  | workspace 与依赖隔离可控；**全仓库唯一包管理器**（`ARCH-BLD-01`） |

> `ARCH-HONO-06`（1.2 修正）：OpenAPI 方案改用 **官方 `@hono/zod-openapi`**（`createRoute` + `OpenAPIHono` + `app.doc()`），不再用第三方的 `rhinobase/hono-openapi`。理由：官方包与 Zod v4、`zValidator` 同源，`createRoute` 里请求与响应 schema 与校验 schema 是**同一份 Zod 对象**，不存在两处定义漂移；第三方包需要额外维护 `resolver` 适配层，属于「同一规则两处」的变体。Scalar 仍作为渲染器挂在 `/api/docs`。

### 3.1 Hono 内置中间件选用表

Hono 自带一批经过审计的内置中间件。**先用内置的，不要自己写**（`ARCH-HONO-03`）：

| 中间件            | import                | 用途                                                         | 本项目决定                                                   |
| ----------------- | --------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `requestId()`     | `hono/request-id`     | 读入站 `X-Request-Id` 或生成，回写到响应头，设置 `c.get('requestId')` | **采用**，作为最外层中间件                                   |
| `secureHeaders()` | `hono/secure-headers` | 默认已启用 HSTS / `X-Frame-Options: SAMEORIGIN` / `X-Content-Type-Options: nosniff` / `Referrer-Policy: no-referrer` / COOP / CORP，并移除 `X-Powered-By` | **采用**；CSP 按需配置                                       |
| `compress()`      | `hono/compress`       | gzip/deflate，默认阈值 1024 字节；带 `Cache-Control: no-transform` 的响应自动跳过 | **采用**                                                     |
| `bodyLimit()`     | `hono/body-limit`     | 限制请求体大小，默认抛 `413`；有 `Content-Length` 且无 `transfer-encoding` 时直接拒绝，否则按流读取到上限 | **采用**，上传端点必配                                       |
| `timeout()`       | `hono/timeout`        | 超时抛 `504`；`next()` 先完成则自动清除定时器                | **采用**，长耗时端点按需挂载                                 |
| `cors()`          | `hono/cors`           | CORS 头与预检 `204`                                          | **不采用**：前后端同源部署，由反向代理处理                   |
| `etag()`          | `hono/etag`           | GET/HEAD 条件请求，`304`                                     | **不采用**：谱牒数据不缓存，缓存是浏览器的事                 |
| `cache()`         | `hono/cache`          | 响应缓存                                                     | **不采用**：会缓存到边缘，且必须置于认证之后并带 `vary: Cookie` 才安全；本项目无此需求 |
| `timing()`        | `hono/timing`         | `Server-Timing` 响应头与分段计时                             | **不采用**：性能观测走 APM + `Server-Timing` 由网关补        |
| `logger()`        | `hono/logger`         | 控制台访问日志                                               | **不采用**：自研结构化日志（§13）需要 JSON 输出与字段裁剪    |
| `ipRestriction()` | `hono/ip-restriction` | IP 白/黑名单                                                 | **不采用**：边缘层已做 WAF                                   |

> `ARCH-HONO-03` 纪律：新增中间件前先查这张表。内置件不采用时必须写明理由——这张表本身是「不用什么」的记录，避免下一个人重新论证一遍。

> `ARCH-BLD-01`（1.1 修正）：包管理纪律与 Dockerfile 必须一致。旧版 §3 写「pnpm，不要混用 Bun 的安装器」，而 §15.1 镜像却是 `COPY bun.lock` + `bun install --frozen-lockfile`——两份文档互相否定，执行者不知道听谁的。**现统一为 pnpm**，镜像使用 `pnpm-lock.yaml` + `pnpm install --frozen-lockfile`。CI 与本地安装一律使用 pnpm；禁止出现 `bun install`、`bun add`、`bun.lock`。

### 3.2 Drizzle 驱动

生产用 `drizzle-orm/node-postgres`（`pg`）。它在 Bun 的 Node 兼容层下可用，并被 PgBouncer 长期验证。`drizzle-orm/bun-sql` 是官方路径，但 ORM 的查询构建与结果映射会吃掉驱动层的性能优势，连接池行为也与 `pg` 不同。**先用 `pg`，等实测证明连接池是瓶颈再换。**

### 3.3 Bun 与 Playwright

Playwright 不在 Bun 上运行。因此：

- E2E 跑在 Node，与 Bun 应用分离；
- 应用本体不做 `bun build --compile`（与 Playwright 不兼容，对容器化也没有收益）。

这条纪律写进 CI：应用镜像跑 Bun，E2E job 跑 Node。

---

## 4. Project Structure

### 4.1 文档结构（spec-kit 标准布局）

> **遵循 spec-kit 的官方文档树**，不另创体系。官方约定见 `plan-template.md` 的 `Project Structure`：
> `specs/[###-feature]/` 下放 `spec.md`、`plan.md`、`research.md`、`data-model.md`、`quickstart.md`、`contracts/`、`tasks.md`。

```
yunpu/
├─ .specify/                        ← spec-kit 基础设施（工具生成，不手改）
│  ├─ memory/
│  │  └─ constitution.md            宪法：最高约束，Article I–IX
│  ├─ templates/                   官方模板（spec / plan / tasks / constitution / checklist）
│  ├─ scripts/                     bash / python / powershell 辅助脚本
│  ├─ workflows/                   工作流定义
│  ├─ integrations/                集成清单
│  └─ feature.json                 当前特性上下文
├─ .codebuddy/
│  └─ commands/                    斜杠命令（speckit.specify / plan / tasks / …）
├─ specs/
│  └─ 001-cloud-genealogy-v1/       ← 特性目录（spec-kit 的产物全部落在这里）
│     ├─ spec.md                   需求规格：做什么、验收标准、OOS 清单
│     ├─ plan.md                   本文：怎么做
│     ├─ research.md               Phase 0 调研：官方依据 + PG 18 实测
│     ├─ data-model.md             Phase 1 设计：表、约束、RLS、删除语义
│     ├─ quickstart.md             Phase 1 交付：验证指南
│     ├─ contracts/
│     │  └─ api.md                 API 契约：端点、请求响应形状
│     └─ tasks.md                  Phase 2 任务清单（[P] 并行标记 + 依赖）
└─ data/
   ├─ schema_v12.sql               DDL 交付物（由 data-model.md 派生）
   └─ functions_v12.sql            函数 / 触发器交付物
```

**SDD 命令与产物的对应**：

| 命令                    | 阶段    | 产出                                           | 本项目状态            |
| ----------------------- | ------- | ---------------------------------------------- | --------------------- |
| `/speckit.constitution` | —       | `.specify/memory/constitution.md`              | ✅ 已完成（宪法 1.0）  |
| `/speckit.specify`      | 需求    | `specs/<NNN>-<name>/spec.md`                   | ✅ 已完成（001）       |
| `/speckit.plan`         | Phase 0 | `research.md`                                  | ✅ 已完成              |
| `/speckit.plan`         | Phase 1 | `data-model.md`、`contracts/`、`quickstart.md` | ✅ 已完成              |
| `/speckit.tasks`        | Phase 2 | `tasks.md`                                     | ✅ 已完成（81 个任务） |
| `/speckit.implement`    | 执行    | 代码                                           | ⏳ 未开始              |
| `/speckit.analyze`      | 复核    | 一致性报告                                     | 可用于跨文档校验      |

**文档树与「谁定义什么」的对应**（宪法 Article VI）：

| 主题                    | 唯一权威                           | 其他文档的做法              |
| ----------------------- | ---------------------------------- | --------------------------- |
| 做什么、验收标准        | `spec.md`                          | 引用 `FR-*` / `SC-*` 编号   |
| 明确不做                | `spec.md` §8（`OOS-01`..`OOS-19`） | 引用编号，**不复制表格**    |
| 怎么做、分层、依赖      | `plan.md`（本文）                  | —                           |
| 表结构、约束、RLS、删除 | `data-model.md`                    | 引用 `DM-*` 编号            |
| 端点形状                | `contracts/api.md`                 | 引用端点 ID                 |
| 官方依据、实测          | `research.md`                      | 引用，不复述                |
| 最高约束                | `.specify/memory/constitution.md`  | 引用 Article 号，不复制条款 |

> **`.specify/` 下的文件由工具管理，不要手改。** 宪法正文是唯一的例外——它是项目资产，由 `/speckit.constitution` 命令写入。

### 4.2 源码目录结构


```
yunpu/
├─ apps/
│  ├─ api/                          Hono 服务（API + 静态资源）
│  │  ├─ src/
│  │  │  ├─ index.ts                Bun.serve 入口 + 启动自检
│  │  │  ├─ app.ts                  组装中间件与路由（链式，勿拆）
│  │  │  ├─ env.ts                  环境变量解析与校验（唯一读取方）
│  │  │  ├─ middleware/             request-context · auth · rate-limit
│  │  │  ├─ modules/                ← 业务域，见 §5
│  │  │  │  └─ <domain>/
│  │  │  │     ├─ router.ts       Hono 子路由（export default + export const routes）
│  │  │  │     ├─ service.ts      领域规则（唯一的规则所在）
│  │  │  │     ├─ queries.ts      只读查询
│  │  │  │     ├─ schema.ts       本域 Zod schema（引用 packages/shared）
│  │  │  │     └─ errors.ts       本域特有错误
│  │  │  ├─ middleware/             request-id · request-context · auth · rate-limit
│  │  │  ├─ db/                     连接池 · 事务 · RLS 上下文
│  │  │  ├─ lib/                    errors · logger · ids · openapi
│  │  │  └─ plugins/                第三方接入（对象存储等）
│  │  └─ test/                      路由与集成测试
│  └─ web/                          Vite + React SPA
│     ├─ src/
│     │  ├─ routes/                 TanStack Router 文件式路由
│     │  ├─ features/               ← 域内组件，域清单同 §5.3
│     │  ├─ components/             跨域通用件（UI / 画布 / 编辑器）
│     │  ├─ lib/                    api-client · query-keys · 格式化
│     │  └─ main.tsx
│     └─ public/
├─ packages/
│  ├─ db/                           Drizzle schema + 迁移 + 策略 + 函数
│  │  ├─ src/
│  │  │  ├─ schema/                 表定义（镜像数据模型）
│  │  │  ├─ policies/               RLS 策略与角色
│  │  │  ├─ functions/              SECURITY DEFINER 函数（SQL）
│  │  │  ├─ generated/              由枚举常量生成的 SQL
│  │  │  └─ client.ts               drizzle 实例 + withUser
│  ├─ shared/                       前后端唯一契约
│  │  ├─ src/
│  │  │  ├─ schemas/                Zod schema（手写 + drizzle-zod 派生）
│  │  │  ├─ domain/                 领域枚举与表清单（唯一来源）
│  │  │  ├─ permissions.ts          角色 → 权限矩阵（唯一来源）
│  │  │  └─ errors.ts               错误码与 AppError 层次
├─ scripts/                         门禁与生成脚本
│  │  ├─ gen-sql.ts                 枚举/表清单 → SQL 生成器
│  │  ├─ reorder-node-siblings.ts   谱系兄弟重排（单语句，见 DM §5.11）
│  │  └─ reconcile-media.ts         对象存储与 DB 的孤儿字节对账
├─ tests/                           跨包集成与 E2E
└─ docs/
```

**为什么是 monorepo**：`packages/db` 与 `packages/shared` 被 API 与 Web 同时依赖，是真实的复用边界；把 schema 复制两份是 DRY 灾难。**但不要过度**：只有一个前端、一个后端，不需要额外的 UI 包。

---

## 5. 领域模块划分

按业务能力划分，不按技术分层划分。`router/service/queries` 是模块**内部**的事，不是模块之间的划分方式。

| 模块           | 拥有的表                                                     | 职责                                 | 公开接口（其他模块只能调这些）                               |
| -------------- | ------------------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------ |
| `auth`         | `auth.*`（Better Auth）                                      | 注册、登录、会话、账号安全           | `getSession()`、`requireUser()`                              |
| `organization` | `organization`、`organization_member`、`invite`              | 组织、成员、邀请、所有权转移         | `requireOrganization()`、`acceptInvite()`、`transferOwner()` |
| `project`      | `project`、`folder`                                          | 项目与单层分类                       | `requireProject()`、`listFolders()`                          |
| `genealogy`    | `person`、`person_name`、`person_relation`、`event`、`lineage`、`node` | 人物事实、关系、事件、谱系与编纂位置 | `createPerson()`、`linkRelation()`、`placeNode()`、`getSubtree()` |
| `source`       | `source`、`source_citation`                                  | 来源与考证引用                       | `createSource()`、`cite()`、`listCitations()`                |
| `article`      | `article`、`article_page`                                    | 谱文与分页富文本                     | `createArticle()`、`savePage()`                              |
| `media`        | `media_asset`、`person_media`、`article_page_media`          | 媒体资产与人物/页面关联              | `uploadAsset()`、`attachToPerson()`、`attachToPage()`        |
| `book`         | `book`、`book_catalog`、`book_release`                       | 谱书、编目树、出版快照               | `createBook()`、`getCatalog()`、`release()`、`revoke()`      |
| `audit`        | `audit_log`                                                  | 写操作留痕（平台服务，不是业务域）   | `record()`                                                   |

- **8 个模块（含 `auth`），其中 7 个业务域**，符合复杂度预算。
- `audit` 是横切平台服务，不对应业务能力，不计入 8 个模块。
- **每个域的 `router.ts` 是一个独立的 `Hono` 实例**，`export default app` + `export const routes`；顶层 `app.ts` 用 `app.route()` 链式挂载。这是 Hono 官方对大型应用的推荐结构，也是 RPC 类型推断能生效的前提（§8.1）。

> `ARCH-MOD-01`（1.1 修正）：模块清单**只有一份**——`src/domain/enums.ts` 的 `MODULES` 常量。本文档 §5、前端 `features/` 目录说明、数据模型 §3.1 的「归属模块」列全部由它生成或引用。旧版 §4 的目录树漏列 `media`、§9.3 列了 7 个域，与本表的 7 个业务域不一致——**重复清单是 bug，当场应验**。CI 加一条检查：文档与代码中的域清单与 `MODULES` 一致。

### 5.1 模块内部结构

```
modules/genealogy/
├─ router.ts        路由定义（薄胶水，只做校验与错误映射）
├─ service.ts       领域规则（唯一的规则所在）
├─ queries.ts       只读查询（复杂读走这里，不要塞进 service）
├─ schema.ts        本域 Zod schema（引用 packages/shared）
├─ errors.ts        本域特有错误（继承 AppError）
└─ *.test.ts        单元测试
```

### 5.2 依赖方向

```
router.ts  →  service.ts  →  db
     ↓            ↓
 shared/      shared/
```

- `router.ts` **不得** import `db`（必须经 service），否则 SQL 会散进 HTTP 层。
- `service.ts` **不得** import 任何 HTTP 类型（`Context`、`Response`）。
- 跨模块调用**只能**走对方模块的 service 导出函数，不得直接查对方的表。
- 一个表只能被一个模块写；跨模块读取走 service 或只读视图。
- `audit` 只能被追加，不能被业务模块修改或删除。

### 5.3 用 Biome 强制，而不是靠自觉

```jsonc
// biome.json（节选）
{
  "overrides": [
    {
      "include": ["apps/api/src/modules/**/router.ts"],
      "linter": { "rules": { "correctness": { "noRestrictedImports": {
        "patterns": [{ "group": ["**/db/**", "drizzle-orm"], "message": "路由层不得直接访问数据库，走 service" }]
      } } } }
    },
    {
      "include": ["apps/api/src/modules/**/service.ts", "packages/db/**"],
      "linter": { "rules": { "correctness": { "noRestrictedImports": {
        "patterns": [{ "group": ["hono", "hono/**"], "message": "领域层与数据层不感知 HTTP" }]
      } } } }
    },
    {
      "include": ["apps/web/src/**"],
      "linter": { "rules": { "correctness": { "noRestrictedImports": {
        "patterns": [{ "group": ["drizzle-orm", "**/db/**"], "message": "客户端不得依赖数据库" }]
      } } } }
    }
  ]
}
```

Biome 的 `overrides` 对同名 `noRestrictedImports` **不合并 options**：一个文件命中多个 override 时，后匹配的组会整体替换前面的禁物清单。因此分区必须互斥，每个分区自带该目录被禁的全部 import；用交叉探针测试「拦得住且无误伤」。

---

## 6. 数据层边界

### 6.1 权威与形态

数据层的确切表结构、字段、约束、索引、视图、RLS 策略和数据库函数，以《云谱数据模型》为准。本节只定义：

- 22 张表分别属于哪个模块；
- 哪些不变量必须在数据库里执行；
- 哪些删除是允许的、哪些必须被拒绝；
- 查询与索引的使用边界。

**不在这里重复字段清单。** 架构文档与数据模型出现冲突时，以数据模型为准。

### 6.2 表归属

见数据模型 §3.1 的「归属模块」列（由 `MODULES` 生成）。此处不重复手抄。

### 6.3 模型的关键形状

| 决策            | 形状                                                         | 规格             |
| --------------- | ------------------------------------------------------------ | ---------------- |
| 主键            | 实体用 `id uuid default uuidv7()`；项目内容表用 `(project_id, id)`；纯关联表用业务键复合主键 | `DM-SCP-*`       |
| 租户/项目 scope | 内容表同时带 `organization_id` 与 `project_id`，由复合外键锁定一致；scope 不可迁移 | `DM-SCP-01`      |
| 跨项目引用      | 所有实体外键带 `project_id`；跨 Project 引用由数据库拒绝     | `DM-SCP-03`      |
| 关系            | 一张 `person_relation`；7 种 kind；对称类强制规范顺序；兄弟姐妹是派生查询，不落库 | `DM-REL-*`       |
| 位置            | `node.path ltree` 是投影；关系边是事实；根 = `parent_path IS NULL` | `DM-NOD-*`       |
| 世次            | 由 `nlevel(path)` 与 `lineage.base_generation` 读时派生，不落人物列 | `DM-NOD-06`      |
| 姓名            | `person_name.kind` 为 formal/courtesy/art/milk/genealogy/posthumous/other | `DM-NAM-01`      |
| 事件            | 主体是 `person_id` 或 `relation_id`，二选一                  | `DM-EVT-02`      |
| 引用            | `source_citation` 的四个目标（人物、姓名、关系、事件）恰好一个；媒体扫描件是附加定位 | `DM-EVT-02`      |
| 媒体            | `media_asset` + 人物/页面关联表；对象 key 全局唯一           | `DM-MED-03`      |
| 出版            | `book_release` 快照不可变；作废与清除走受控函数              | `DM-BOK-01`/`02` |
| 审计            | `audit_log` 只追加；分强审计与尽力而为两级                   | `DM-AUD-01`/`02` |
| 删除            | 无软删除；依赖关系用 RESTRICT / CASCADE / SET NULL 明确表达  | `DM-GEN-08`      |
| 排序            | 展示顺序**不唯一**，按 `(sort_order, id)` 排序               | `DM-REL-04`      |

**不建 Family 表。** 家庭是 `person_relation` 的组合视图；兄弟姐妹、祖孙、堂表亲都是派生查询，不落库。

### 6.4 关键不变量与执行者

完整清单见数据模型 §7（43 条，逐条带编号与执行者）。架构侧只列「架构负责执行」的部分：

| 不变量                             | 执行者                                | 规格             |
| ---------------------------------- | ------------------------------------- | ---------------- |
| 跨 Organization 不可见             | RLS + `app.visible_org_array()`       | `DM-TEN-01`      |
| scope 不可迁移                     | 触发器 `app.guard_scope_immutable()`  | `DM-SCP-01`      |
| 关系排序不唯一                     | 无唯一索引；查询按 `(sort_order, id)` | `DM-REL-04`      |
| 世系父边不能形成环（含反向二元环） | advisory lock + 延迟递归 CTE 触发器   | `DM-REL-01`/`05` |
| 出版快照不可修改                   | 权限回收 + 快照守卫触发器             | `DM-BOK-01`      |
| 出版记录不可直接删除               | `REVOKE UPDATE, DELETE` + 受控函数    | `DM-BOK-02`      |
| 审计只追加                         | 权限回收 + 追加守卫触发器             | `DM-AUD-02`      |
| 媒体被引用时不可删除               | 复合外键 `ON DELETE RESTRICT`         | `DM-MED-04`      |

### 6.5 删除语义

见数据模型 §10。架构侧补充纪律：

- 删除组织、谱系、谱书、人物**不级联删业务事实**；谱系只级联 `node`（位置不是事实）。
- 对象存储字节在**数据库提交后**清理；先删字节再提交会产生悬空引用。
- 物理删除 Project 前必须显式预览和确认。

### 6.6 索引策略

> `ARCH-IDX-01`（1.1 修正，统一口径）：索引按**查询模式**建。旧版本文写「RLS 谓词列必须是索引首列：内容表 `organization_id`」，而数据模型写「不设机械规则，按查询模式建」，且实际索引全部以 `project_id` 开头——**两份文档互相否定**。事实上 `organization_id` 由 `project_id` 经复合外键强制推出，查询永远先按 project 收敛，RLS 的 org 谓词是安全网而非访问路径。**现以数据模型 §11 为唯一说法，机械规则删除。** 规则冲突比没有规则更糟，因为执行者不知道听谁的。

- 谱系/编目路径用 GiST；按父路径查子节点用 B-tree `(project_id, lineage_id, parent_path)`。
- 关系边双向查询：`(project_id, from_person_id, kind)` 与 `(project_id, to_person_id, kind)`。
- 主姓名、每人每 Lineage 的 primary Node、邀请邮箱等用部分唯一索引。
- **不建** `uq_person_relation_sort_order`：展示顺序不是事实，唯一约束会制造 O(n) 重排工作，且在对称关系上语义不成立（`DM-REL-04`）。
- 不为「以后可能搜」预置冗余搜索列。人名搜索基于 `person_name.value`；是否加 `pg_trgm` 索引由数据模型的索引清单决定。
- 索引按查询模式建，用 `EXPLAIN (ANALYZE, BUFFERS)` 验证；不为了用新特性调整索引顺序。

### 6.7 PostgreSQL 18 的能力与运维约束

| 能力          | 用法                                                         |
| ------------- | ------------------------------------------------------------ |
| `uuidv7()`    | 所有主键默认值；时间有序，可直接当 keyset 游标               |
| `ltree`       | `node.path` / `book_catalog.path`；`nlevel`、`subpath`、GiST |
| RLS           | 租户隔离；`FORCE ROW LEVEL SECURITY`；策略谓词走索引         |
| 生成列        | `parent_path` 必须是 **STORED**，因为它参与唯一约束与外键；虚拟列不能建索引 |
| 延迟约束      | 自引用父外键、owner 外键；只在需要的事务内 `SET CONSTRAINTS ... DEFERRED` |
| 递归 CTE      | 祖先/后代查询与环检查                                        |
| advisory lock | 事务级 `pg_advisory_xact_lock`，串行化同 Project 的世系写入（`DM-REL-05`） |
| 锁超时        | `lock_timeout` / `statement_timeout` / `idle_in_transaction_session_timeout` 连接级统一设置（`DM-REL-06`） |
| AIO           | 顺序扫描、位图堆扫描、vacuum 的吞吐优化；按实际负载开启      |

**运维注意**：`initdb` 默认启用数据校验和；MD5 密码认证已弃用；`VACUUM/ANALYZE` 会处理继承子表，需要只处理当前表时用 `ONLY`；`COPY FROM` 不再把单独的 `.` 当 EOF。把这些写进运维手册，不靠记忆。

---

## 7. 多租户与 RLS

### 7.1 角色

| 角色                            | 职责                                                         |
| ------------------------------- | ------------------------------------------------------------ |
| 迁移角色                        | 创建/修改 schema、表、索引、策略、函数、触发器；只用于迁移   |
| `genealogy_app`                 | 业务 API 数据库角色；非表 owner，无 `BYPASSRLS`              |
| `genealogy_api`                 | 登录角色；只被授予 `genealogy_app`，无直接表权限；连接后 `SET LOCAL ROLE genealogy_app` |
| `rls_definer`                   | `NOLOGIN BYPASSRLS`；`SECURITY DEFINER` 函数的属主。权限清单见数据模型 §8.5 |
| `auth_service` / `auth_runtime` | Better Auth 专用连接；不与业务连接共用                       |

### 7.2 统一谓词

```sql
ALTER TABLE person ENABLE ROW LEVEL SECURITY;
ALTER TABLE person FORCE ROW LEVEL SECURITY;   -- 表 owner 也受管

CREATE POLICY tenant_isolation ON person
  AS PERMISSIVE FOR ALL TO genealogy_app
  USING      (organization_id = ANY (app.visible_org_array()))
  WITH CHECK (organization_id = ANY (app.visible_org_array()));
```

要点：

1. **谓词必须写 `= ANY (app.visible_org_array())`，不能写 `= ANY ((SELECT app.visible_org_array()))`**。后者被 PostgreSQL 解析为表子查询而非标量数组表达式，实测报 `42883 operator does not exist: uuid = uuid[]`——核心租户谓词无法执行。正确写法被常量折叠为 InitPlan 求值一次。详见数据模型 §2.1 #1、§17 #05。
2. `FORCE ROW LEVEL SECURITY`：否则表 owner 绕过 RLS。业务连接必须用非 owner 角色。
3. 上下文缺失时返回 `'{}'::uuid[]`，默认拒绝，不报错、不返回全表。
4. `organization` 表自身用 `id = ANY (...)`；其余业务表用 `organization_id`。
5. 所有业务表都启用 `ENABLE` + `FORCE ROW LEVEL SECURITY`。

### 7.3 `app.visible_org_array()`

```sql
CREATE FUNCTION app.visible_org_array()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT COALESCE(array_agg(om.organization_id), '{}'::uuid[])
  FROM public.organization_member om
  WHERE om.user_id = app.current_user_id()
$$;
```

`app.current_user_id()` 单独解析 GUC：为空 → NULL；不是合法 UUID → 捕获 `22P02` 返回 NULL。**不能让非法 GUC 直接抛错**——那会变成 500 而不是「拒绝访问」。两种情况的结果一致：无可见组织（fail-closed）。完整定义见数据模型 §8.3。

- 属主 `rls_definer`，`BYPASSRLS`，`NOLOGIN`。
- 显式 `public.organization_member`，不依赖 `search_path`。
- `REVOKE ALL ... FROM PUBLIC`；只 `GRANT EXECUTE ... TO genealogy_app`。
- `rls_definer` 需要 `public` schema 的 `USAGE` 与 `organization_member` 的 `SELECT`。

### 7.4 请求事务

```ts
export async function withUser<T>(
  userId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    await tx.execute(sql`set local role genealogy_app`);
    return fn(tx);
  });
}
```

- `set_config(..., true)` 的 `is_local` 必须是 `true`。
- 所有租户查询必须在同一事务内完成。
- 不接受客户端传入的 `organization_id` 作为隔离依据；组织可见性只由成员关系推导。

### 7.5 RLS 与 RBAC 的边界

- **RLS** 回答「能看到哪些行」：组织成员可见该组织的行。
- **RBAC** 回答「能不能做这个操作」：`organization_member.role` 为 admin/editor/viewer，owner 由 `organization.owner_user_id` 派生，始终按 admin 处理。
- 权限复核必须在事务内执行（`requirePermission(tx, ...)`），不能只在路由层查一次；页面校验通过后角色被改的窗口是真实的越权路径。
- 角色矩阵集中在 `packages/shared/src/permissions.ts`，业务代码只传权限名，不比较角色名。

> `ARCH-PERM-01`（1.1 修正）：**同一授权规则不允许写两遍。** 旧版 TS 里有一份角色→权限矩阵，SQL 函数体里又手写「校验 admin 或 owner」，同一规则两处，违反本文第一条不可协商原则。现明确分工：
>
> | 层                | 负责什么                                                     | 单一来源                             |
> | ----------------- | ------------------------------------------------------------ | ------------------------------------ |
> | 应用层（service） | 完整的角色→权限判定                                          | `packages/shared/src/permissions.ts` |
> | 数据库函数        | **只守最小不变量**：purge 仅 owner、转移仅当前 owner、创建需登录上下文 | 数据模型 §9.2 的受控函数             |
>
> 两侧的一致性由一条测试保证：`packages/shared/src/permissions.ts` 导出的矩阵与数据库函数体中出现的角色判定做静态比对（`scripts/check-permission-parity.ts`），CI 失败即阻断。DB 函数**不得**新增与矩阵无关的角色判断；若确需（例如 purge 的 owner 专属），必须在权限矩阵中显式登记为 `release.purge` 并标注 `ownerOnly`。

### 7.6 安全边界

- 自定义 GUC 是应用连接可设置的上下文，不是数据库认证身份。持有业务凭据且能执行任意 SQL 的攻击者可以伪造 `app.user_id`；RLS 降低遗漏租户条件的风险，但不能单独抵御凭据失陷。
- 超级用户和 `BYPASSRLS` 角色始终绕过 RLS；它们只用于迁移、备份和函数属主，不作为业务连接。
- 业务视图必须 `security_invoker = true`；否则视图属主权限会绕过 RLS。
- `SECURITY DEFINER` 函数：属主 `rls_definer`，`SET search_path = pg_catalog`，对象全部 schema-qualified，撤销 `PUBLIC` 执行权限。`rls_definer` 的完整权限清单见数据模型 §8.5，并由 `db/verify/permissions.sql` 断言。
- `organization.owner_user_id` 只能由转移函数修改；`book_release` 与 `audit_log` 只允许受控写入。

---

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

## 9. 前端

### 9.1 数据获取

- 路由 loader 做 scope 解析与预取，避免瀑布式往返。
- 服务端状态归 TanStack Query，视图状态归 Zustand，不混。
- 新鲜度由单一 `staleTime` 决定，禁止 `refetchOnMount: 'always'`。
- 失效按 key 精确做，不整树失效；key 命名集中在 `lib/query-keys.ts`。
- 写操作成功后只失效受影响的 key；不要用全量刷新掩盖依赖关系。

**RPC 客户端**（`ARCH-HONO-12`）：用官方 `hc<AppType>(baseUrl)`，类型从后端 `AppType` 推导，不手写请求路径。

```ts
import { hc } from 'hono/client';
import type { AppType } from '@yunpu/api/app';   // 后端 export type AppType = typeof routes

const client = hc<AppType>(import.meta.env.VITE_API_BASE_URL);

const res = await client.api.v1.lineages[':lineageId'].nodes.$get({
  param: { lineageId },
});
if (!res.ok) {
  // 官方约定：先判 res.ok，再解析 body
  throw new Error(await res.text());
}
const body = await res.json();
```

- `hc` 的类型完全依赖后端 `AppType`，因此后端路由**必须**链式且从具名变量推断（§8.1）——否则这里会退化成 `any`，且不报错。
- 需要精确的请求/响应类型时用官方的 `InferRequestType` / `InferResponseType`。
- `client.path.$url()` / `$path()` 可以在不发请求的情况下构造 URL（用于 TanStack Query 的 `queryFn` 与预取）。

### 9.2 谱系画布

> `ARCH-FE-05`（1.1 修正）：**只做一条渲染路径。** 旧版在设计期就规定 DOM / Canvas 2D+LOD / 分片虚拟滚动三套方案，与本文 §16「只在信号出现时行动」自相矛盾。1–3 人团队维护三条画布代码路径，正是本文反对的「为以后可能提前建设」。
>
> **1.1 决定：只做 `@xyflow/react` DOM 渲染 + 视口裁剪。** Canvas 2D 与分片虚拟滚动降级为 §16 演进触发条件下的备选方案，不在设计期规定。
>
> 触发换路径的信号（客观、可测）：单谱系节点数 > 5 000 **且** 画布交互 P95 > 1 s（两个条件同时成立才动）。先做的补救是视口裁剪、按世代请求、Web Worker 布局——这些不换渲染后端，成本低得多。

- 家谱动辄数千人，DOM 方案在未裁剪时会崩——因此**视口裁剪是当前路径的必要组成部分**，不是可选项。
- 垂丝图布局放 Web Worker，不占主线程。首屏只加载当前世代 ± 2 代，其余按需。

### 9.3 组件分层

- `components/` 只放跨域通用件（UI 基元、画布、编辑器）。
- `features/<域>/` 放域内组件，域清单与 §5 一致（`organization` / `project` / `genealogy` / `source` / `article` / `media` / `book`，共 7 个业务域），由 `MODULES` 生成，不手抄。
- 前端组件禁止 import `packages/db`（Biome 强制）。
- 富文本编辑器按页加载 `article_page.content`，保存时带 `version` 做乐观锁。

---

## 10. 认证与授权

**认证**：Better Auth + 数据库会话 + 邮箱密码 + 微信 OAuth。会话 7 天、滑动续期 1 天；`cookieCache.enabled: false`（每次校验查库，安全优先于性能）。

**授权**：两层，不混。

1. **RBAC**——能不能做这个操作：`organization_member.role` 为 `admin` / `editor` / `viewer`。
2. **RLS**——能看到哪些行：`organization_id` 谓词。

**owner 不是成员角色**：`organization.owner_user_id` 是唯一 owner 的事实来源；owner 始终按 `admin` 处理。邀请不能授予 owner；所有权只能通过 `transferOwner()` 显式转移。这样「恰好一个 owner」「owner 必须是成员」「不能删除 owner」由列、外键和 `RESTRICT` 直接表达，不需要角色特例。

**权限复核必须在事务内**（`requirePermission(tx, ...)`），不能只在路由层查一次。角色矩阵集中在 `packages/shared/src/permissions.ts`，业务代码只传权限名（如 `person.write`、`release.purge`），不比较角色名。

**转移所有权**（`DM-ADR-13`）：用 **CAS 条件更新**——`UPDATE organization SET owner_user_id = :new WHERE id = :org AND owner_user_id = :prev`。不用 `SELECT ... FOR NO KEY UPDATE`：它需要**表级** `UPDATE` 权限，而 `rls_definer` 只有列级授权（`owner_user_id`, `updated_at`），两者不匹配。CAS 把「读旧值 → 校验 → 写新值」合并成一条原子语句，并发时只有一个能命中，其余抛 `GX010`。详见数据模型 §8.5。

**兑换邀请**（`DM-INV-01`~`03`）：token 熵 ≥ 256 bit（CSPRNG）；兑换时校验**当前登录用户邮箱与邀请邮箱一致**（不一致抛 `GX009`）；并发兑换用 `UPDATE ... WHERE status='pending' AND expires_at > now() RETURNING` 抢占，只有一条能成功，其余抛 `GX010`。

---

## 11. 并发与一致性

### 11.1 谱文：乐观锁

`article_page` 带 `version`。保存时：

```sql
UPDATE article_page
SET content = $3, version = version + 1
WHERE project_id = $1 AND id = $2 AND version = $4
RETURNING version;
```

影响行数为 0 → 版本冲突 → `409`，前端提示「内容已在别处修改，请刷新或另存」。不做编辑锁：锁会带来超时、僵尸锁和「谁先打开谁赢」的荒谬规则。

### 11.2 谱系位置：路径分配

Node 的 `path` 是固定四位数字段，兄弟步长 10。新增或移动节点时：

1. 取 `pg_advisory_xact_lock('yunpu:lineage:' || lineage_id)`（事务级），锁住该谱系的路径分配；
2. 计算目标父路径下的下一个可用段（如 `0030`）；
3. 插入或更新节点；子树移动时在一个事务内改写 `path`，`parent_path` 由 STORED 生成列自动维护；
4. 该父节点下没有可用间隙时，在同一事务内重排兄弟段位；重排是运维级操作，不进入日常写入路径。

**重排纪律**（`DM-NOD-01`）：`uk_node_path` 是即时唯一约束，兄弟重编号时「0010 改成 0020 而 0020 还在」会在语句中途自撞。**重排脚本必须用单条 `UPDATE ... SET path = CASE id ... END` 一次写完**（唯一性在语句结束时才检查），约束保持即时，不改成 DEFERRABLE。「重排是运维级操作」不是豁免理由——运维脚本也会撞。脚本 `scripts/reorder-node-siblings.ts` 必须在事务内执行。

自引用父外键是 `DEFERRABLE INITIALLY DEFERRED`，允许父与子在同一事务内任意顺序写入。世次由 `nlevel(path)` 与 `lineage.base_generation` 读时派生，不落列。

### 11.3 关系环：数据库兜底

`person_relation` 的世系父边（`biological_parent` / `adoptive_parent` / `ritual_heir`）在写入时：

- 语句级触发器取**事务级 advisory lock**，串行化同一 Project 的世系写入；
- 延迟约束触发器在提交时用递归 CTE 检查是否形成环，形成则抛 `GX001`；
- `step_parent` / `foster_parent` 不参与环检查：继亲与寄养可以合法形成家庭环，**互称父母的两条反向继亲边允许并存**；
- 世系父边的**反向二元边**（A→B 与 B→A 都是 `biological_parent`）本身就是祖先环，必然被 `GX001` 拒绝——它不是「允许并存」的情况。验收用例必须按此写（见 §14 用例 4 与数据模型验收 #8）。

**为什么用 advisory lock 而不是锁 project 行**（`ARCH-CC-01`）：

PostgreSQL 的外键检查机制会对被引用的 `project` 行加 `FOR KEY SHARE` 锁（官方锁冲突矩阵 Table 13.3 中 `FOR UPDATE` 与 `FOR KEY SHARE` 冲突）。因此 `SELECT ... FROM project WHERE id = ... FOR UPDATE` 的实际影响远大于预期：**该 Project 下所有表的所有 INSERT（人物、节点、谱文、媒体……）都会在外键检查上排队**。你以为锁的是「世系变更」，实际锁住的是整个项目的写入。

改法：

```sql
PERFORM pg_advisory_xact_lock(
  hashtextextended('yunpu:relation:' || NEW.project_id::text, 0));
```

事务级 advisory lock 随事务结束自动释放，不与任何外键锁冲突，只约束真正需要串行化的写者。

**锁顺序与超时**（`DM-REL-06`）：

| 项                                    | 规定                                                         |
| ------------------------------------- | ------------------------------------------------------------ |
| 锁顺序                                | 全局唯一：`yunpu:relation:<project_id>` → `yunpu:lineage:<lineage_id>`。前缀字母序固定，禁止反向获取 |
| 与行锁混用                            | 事务内**先取 advisory lock，再取行锁**                       |
| `lock_timeout`                        | 连接级 `3s`。拿不到锁即失败回滚，不无限等待                  |
| `statement_timeout`                   | 连接级 `30s`                                                 |
| `idle_in_transaction_session_timeout` | 连接级 `60s`，防 advisory lock 长期占用                      |

三个超时在连接池初始化连接时统一 `SET`。

service 不需要预先做图遍历；它只需要捕获 `GX001` 并转换成领域错误。**并发正确性由数据库保证，不由应用层的「先查再写」保证。**

### 11.4 邀请与所有权

- 同一组织同一邮箱只允许一条 `pending` 邀请：部分唯一索引。
- `token_hash` 全局唯一；明文 token 只返回一次；兑换走受控函数（见 §10 与数据模型 §9.2）。
- 所有权转移是一次 `organization.owner_user_id` 更新；新 owner 必须已是成员；旧 owner 的成员行在转移后可删除。外键会阻止删除当前 owner 的成员行。

### 11.5 其余写入

- 人物、关系、事件、来源、引用、谱书目录：最后写入获胜；不做编辑锁。
- 出版版本：只能 `revoke` / `purge`，不能改快照。
- 审计：只追加；完整性分级见 §12。
- 媒体上传：同一文件重复上传会产生新资产；数据库不按 checksum 去重，去重是产品策略，不是数据完整性要求。

### 11.6 出版：同步起步，有明确上限

> `ARCH-PUB-01`（1.1 修正）：出版是全系统唯一的重量级操作，同步/异步不能留白。「留白不是简单，是把决策推给将来加班的人」。导出整本谱书可能几十秒到几分钟，`POST /books/:id/releases` 同步跑必然超时——但**这是设计期就能预见的真实问题，不是「以后可能」**。

**1.1 决定：起步同步 + 规模上限 + 硬超时。**

| 项       | 规定                                                         |
| -------- | ------------------------------------------------------------ |
| 执行方式 | 同步，在 `POST /api/v1/books/:bookId/releases` 内完成        |
| 规模上限 | 单次发布的编目节点数 ≤ 2 000、文章页总数 ≤ 5 000。超出返回 `413`，提示「规模超出版本同步上限」 |
| 超时     | 服务端 120s（`statement_timeout` 覆盖）；客户端 180s         |
| 部分成功 | 无。发布是全有或全无：快照写入与 `book_release` 行在同一事务；产物字节先写，行后写 |
| 升级条件 | 规模上限被真实用户触达（即有 ≥ 1 次因超限被拒），**且** 同步发布 P95 > 60s → 按本文 §16 引入 PG 表队列 + 独立 worker |

**产物字节纪律**（`DM-REL-08`）：产物字节归 `book_release` 行所有。生成顺序是「先写字节 → 再写行」；删除顺序是「先删行并提交 → 再删字节」。反序会产生悬空引用或悬空字节。`purge` 时若 `artifact_uri` 非空但对象不存在，抛 `GX011`，不静默放过。

---

## 12. 媒体与审计

### 12.1 媒体

- **私有桶**。上传走服务端代理：浏览器 → API → 对象存储；API 校验会话、项目权限、大小（10 MB）、content-type，并计算 SHA-256。
- `media_asset.object_key` 由服务端生成，带项目前缀；数据库全局唯一。客户端不能指定 key。
- 人物图、文章页图、引用扫描件分别通过 `person_media`、`article_page_media`、`source_citation.media_asset_id` 关联。
- 删除媒体资产时，数据库用 `ON DELETE RESTRICT` 检查引用；有引用就拒绝。**删除文章或人物不会自动删除媒体资产**；先解绑，再由明确的清理动作删除无引用资产，并写审计。
- 下载走鉴权代理或短时签名 URL；不暴露桶的公共读。
- 缩略图是对象存储中的派生文件，不改变数据模型，不新增表。

**每个字节都有主人**（`DM-MED-01`）：

| 字节       | 主人              | 删除时机           |
| ---------- | ----------------- | ------------------ |
| 媒体原文件 | `media_asset` 行  | 该行删除并提交之后 |
| 出版产物   | `book_release` 行 | `purge` 提交之后   |

**孤儿字节的回收路径**（`DM-MED-02`）：代理上传的固有代价是「上传成功但 DB 写入失败」会留下没有数据库行的字节。而「清理无引用资产」是按数据库行找对象的，**看不见这类孤儿**——旧版文档只写了删除方向，漏了失败方向。必须有桶级对账脚本：

- `scripts/reconcile-media.ts`：定期（每日）列出对象存储 `p/` 前缀下全部对象，与 `media_asset.object_key` 求差集。
- 差集对象写入报告，**默认不自动删除**（避免删掉正在上传中的对象）；修改时间早于 24 小时的一律跳过。
- 确认无主后才删除，并记日志与指标。

### 12.2 审计

> `ARCH-AUD-01`（1.1 修正）：「写操作留痕」原文没有执行者——审计完整性靠各 service 自觉调 `record()`，漏写没有任何东西拦得住。按本文自己的原则，这不是规则，是愿望。**诚实降级 + 明确分级**（详见数据模型 §5.22 `DM-AUD-01`）：

| 级别             | 范围                                               | 执行者                                              | 保证                               |
| ---------------- | -------------------------------------------------- | --------------------------------------------------- | ---------------------------------- |
| **强审计**       | 组织创建、owner 转移、邀请兑换、出版 revoke/purge  | 受控 `SECURITY DEFINER` 函数内部 `INSERT audit_log` | **DB 级保证**：不依赖调用方自觉    |
| **尽力而为审计** | 人物、关系、事件、谱文、来源、媒体、目录等常规写入 | 各域 service 调 `audit.record()`                    | **应用级保证**：明确**不承诺完整** |

规则：

- 强审计路径上的写操作**必须**在受控函数里留痕。
- 尽力而为路径上 `audit.record()` 失败**不得**让业务写入回滚（审计不能是可用性单点），但必须写日志并计入指标 `audit_write_failures_total`。
- **本文不声称审计日志完整无缺。** 需要全量审计时，先加 `AFTER` 写触发器统一落审计，再把对应条目升级为「强审计」——这是显式的后续动作，不是隐含保证。

---

## 13. 可观测性

- **请求 ID**：用官方 `requestId()` 中间件（`hono/request-id`）。它读入站 `X-Request-Id`（长度上限 255）或生成一个，并回写到响应头，同时把值放进 `c.get('requestId')`。**必须作为最外层中间件注册**，否则后面的日志拿不到它。
- **结构化日志**（JSON）：`request_id`（取自 `c.get('requestId')`）、`user_id`、`organization_id`、`project_id`、`route`、`status`、`duration_ms`。不记录姓名、邮箱、谱文正文、token。
- **错误追踪**：Sentry 捕获未处理异常；同一 `request_id` 可关联日志与事件。
- **中间件读 `c.error`**：handler 抛出的异常会放进 `c.error`。日志中间件在 `await next()` 之后读它，可补记路由与用户维度，**不需要在每个 handler 里写 try/catch**。
- **指标**：请求量、P95 延迟、5xx 比例、数据库连接池占用、慢查询、对象存储错误率、**审计写入失败数**、**对象存储孤儿字节数**。指标只保留聚合值，不建用户画像。
- **健康检查**：`/api/health` 只检查进程与数据库连通性；不检查对象存储，避免外部依赖抖动导致容器反复重启。
- **启动自检**：迁移状态、关键函数、RLS 策略、扩展是否存在；缺一项就拒绝启动。
- **部署验证**：部署后跑一支只读脚本，确认关键表、视图、函数、策略存在；失败则回滚。
- **路由清单**：可用官方 `@hono/cli` 的 `hono routes` 命令导出路由表（JSON），作为契约快照纳入 CI，防止路由意外漂移。

---

## 14. 测试策略

### 14.1 分层

| 层   | 工具                            | 覆盖                                               |
| ---- | ------------------------------- | -------------------------------------------------- |
| 单元 | `bun test`                      | 领域规则、权限矩阵、路径分配、错误映射             |
| 路由 | `bun test` + Hono `app.request` | 入参校验、状态码、DTO 形状；service 用 mock        |
| 集成 | `bun test` + 真实 PostgreSQL 18 | 事务、RLS、复合外键、触发器、并发、advisory lock   |
| E2E  | Playwright（Node）              | 登录、建组织、建项目、录人物、连关系、写谱文、发布 |

> `ARCH-TST-03`（1.1 修正）：旧版列了三套 runner（`bun test` + Vitest + Playwright），但**没给 Vitest 存在的硬理由**。`bun test` 一样能连真 PG 跑集成；Playwright 需要 Node 是 E2E 的事，不构成单元/集成再开一个 runner 的理由。**收敛成 `bun test` + Playwright。** 每多一个工具链，就多一份升级、配置和 CI 维护成本。

**路由测试的官方调用约定**（`ARCH-TST-04`）：`app.request(input, requestInit?, env?, executionCtx?)`

- `input` 可以是 `Request`、字符串路径或 `URL`；纯路径会补成 `http://localhost/...`。
- 第三个参数 `env` 就是 `E['Bindings']`，用来注入 `db` / `services` / `logger` / `storage`；**这就是「不连真库也能测路由」的实现方式**，不需要额外的 DI 框架。

```ts
const res = await app.request(
  '/api/v1/lineages/l1/nodes',
  { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ … }) },
  { db: fakeDb, services: fakeServices, logger: fakeLogger, storage: fakeStorage },
);
expect(res.status).toBe(201);
```

> 注意：`Content-Type` 必须显式带上。缺省时 `zValidator('json', …)` 拿到的是空对象（§8.6），测试会假通过。

### 14.2 阻塞级用例（不过不许合并）

1. 跨租户读取返回空；不带 `app.user_id` 时 fail-closed。
2. 连接池复用后不继承上一个事务的用户上下文。
3. 跨 Project 的关系、节点、引用被复合外键拒绝。
4. 世系父边成环被 `GX001` 拒绝（含 A→B 与 B→A 的**二元环**）；**继亲/寄养**成环**允许**。
5. 每人每 Lineage 第二个 `kind='primary'` 节点被拒绝；annotation 无人物。
6. 每人第二个主姓名被拒绝。
7. Citation 四目标恰好一个；零个或两个都拒绝。
8. BookRelease 快照字段不可改；直接 DELETE 被权限拒绝；非 owner purge 被 `GX006` 拒绝；owner purge 成功并写审计；产物对象缺失时 purge 抛 `GX011`。
9. 存在 BookRelease 时删除 Book 被拒绝。
10. AuditLog 的 UPDATE/DELETE 被拒绝。
11. 邀请 token 一次性；过期/错误 token 返回 `GX005`；**他人邮箱兑换返回 `GX009`**；**并发兑换只有一条成功，另一条 `GX010`**；同邮箱重复 pending 被拒绝。
12. 删除 owner 的成员行被外键拒绝；转移后可删。
13. ArticlePage 版本冲突返回 409。
14. 被引用的 MediaAsset 删除被拒绝。
15. Node 根 `parent_path IS NULL`；子节点父路径不存在时提交失败；子树移动事务内成功；**兄弟重排用单条 UPDATE 完成，不撞即时唯一约束**。
16. **同 Project 的人物 INSERT 不被世系 advisory lock 阻塞**（回归用例，防回退到 `FOR UPDATE` 锁 project 行）。
17. **并发竞争世系边恰好一条成功，无死锁**。
18. **错误约束名映射到具体文案**（如 `uq_invite_pending_email` → 「该邮箱已有待处理邀请」）。
19. **权限矩阵与 DB 函数体一致**（`scripts/check-permission-parity.ts`）。
20. **`rls_definer` 权限集合与数据模型 §8.5 完全一致**（`db/verify/permissions.sql`）。

> 集成测试库每个用例在事务内跑并回滚；需要真实并发的用例单独起连接。覆盖率门槛：`service` ≥ 80%，权限矩阵 100%，关键负向用例 100%。

---

## 15. 构建与部署

### 15.1 镜像

> `ARCH-BLD-01`（1.1 修正）：包管理器统一为 **pnpm**。旧版镜像用 `COPY bun.lock` + `bun install --frozen-lockfile`，与 §3「不要混用 Bun 的安装器」直接矛盾。**现用 `pnpm-lock.yaml` + `pnpm install --frozen-lockfile`，并修正 runtime 阶段拷全量 `node_modules`（含 devDependencies）导致镜像变胖的问题。**

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json      apps/api/
COPY apps/web/package.json      apps/web/
COPY packages/db/package.json   packages/db/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @yunpu/web build
RUN pnpm --filter @yunpu/api build

# 生产依赖单独一层：只含 production dependencies
FROM node:22-alpine AS prod-deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json      apps/api/
COPY packages/db/package.json   packages/db/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --prod

FROM oven/bun:1-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build   /app/apps/api/dist ./dist
COPY --from=build   /app/apps/web/dist ./web
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/packages/shared/dist ./packages/shared/dist
COPY --from=prod-deps /app/packages/db/dist     ./packages/db/dist
USER bun
EXPOSE 3000
HEALTHCHECK CMD bun -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1))"
CMD ["bun", "dist/index.js"]
```

- **包管理器只有 pnpm**：禁止 `bun install` / `bun add` / 提交 `bun.lock`。CI 加检查：仓库里存在 `bun.lock` 即失败。
- **runtime 只带生产依赖**：`prod-deps` 阶段用 `pnpm install --prod`，不再从 `deps` 拷全量 `node_modules`（旧版把 devDependencies 一起带进镜像）。
- 非 root 运行。
- 前端构建产物由 Hono 的静态资源中间件提供；SPA fallback 只对非 `/api` 路径生效。
- 一个镜像、一个进程、一个端口。

### 15.1.1 Bun 入口与静态资源（`ARCH-HONO-10`）

**Bun 入口**：Hono 在 Bun 下的官方启动方式是**默认导出**，Bun 会直接接管服务（无需自己 `Bun.serve`，也无需自己管关闭）。

```ts
// apps/api/src/index.ts
export default {
  port: Number(process.env.PORT ?? 3000),
  fetch: app.fetch,
};
```

- Node 与 Bun 的差别（Bun / Deno 原生管理 server，Node 的 `serve()` 才需要自己关）。
- 优雅关闭：Bun 侧只需处理 `SIGTERM`，关闭数据库连接池；HTTP server 由 Bun 负责。

**静态资源**：用 `@hono/bun` 的 `serveStatic`（Hono 官方适配器）。

```ts
import { serveStatic } from '@hono/bun';

app.use('/assets/*', serveStatic({ root: './web/assets' }));
app.get('*', serveStatic({ path: './web/index.html' }));   // SPA fallback
```

> **官方明确警告的一条安全边界**：路由匹配是**大小写敏感**的，但**文件系统不一定**。在 Windows / macOS 上 `/ADMIN/secret.txt` 会解析到同一个文件，Windows 还接受 8.3 短名（`PROTEC~1`）。因此**不要依赖 `/xxx/*` 作用域中间件来保护静态目录下的文件**——`app.use('/admin/*', auth)` 拦不住 `/ADMIN/secret.txt`。
>
> 本项目的处置：**静态根目录里不放任何需要授权的文件**（前端构建产物只有公开的 JS/CSS/图片），需要授权的资源一律走 API。媒体通过 API 鉴权代理下载（§12.1），从不落到静态目录。

### 15.1.2 请求体大小与超时

| 端点                                                     | 中间件                   | 值                                            |
| -------------------------------------------------------- | ------------------------ | --------------------------------------------- |
| 媒体上传 `POST /api/v1/projects/:projectId/media-assets` | `bodyLimit({ maxSize })` | 10 MB；超出抛 `413`                           |
| 出版 `POST /books/:bookId/releases`                      | `timeout(ms)`            | 120s，超时抛 `504`；与 §11.6 的服务端上限一致 |
| 其余写接口                                               | `bodyLimit({ maxSize })` | 1 MB                                          |
| 全局                                                     | 无 `timeout`             | 全局超时会让长查询难以排查；按端点挂载更精确  |

- `bodyLimit` 有 `Content-Length` 且无 `transfer-encoding` 时直接拒绝；否则按流读取到上限再重建请求。
- `timeout` 的定时器在 `next()` 先完成时自动清除，不会误伤。
- **业务层的 10 MB 校验与 `bodyLimit` 并存**：中间件是粗筛（防止把超大请求读进内存），service 里的校验是业务规则（返回领域错误文案）。二者不是重复，是不同层。

### 15.2 数据库连接

| 连接        | 走哪里                           | 说明                                                 |
| ----------- | -------------------------------- | ---------------------------------------------------- |
| 业务 API    | PgBouncer（transaction pooling） | `genealogy_api` 登录，`SET LOCAL ROLE genealogy_app` |
| Better Auth | 独立连接（可直连）               | 它的查询模式与业务不同，不共用池                     |
| 迁移        | 直连，不用 PgBouncer             | DDL 不能在事务池里跑                                 |

连接池上限按数据库 `max_connections` 反推，不按应用实例数拍脑袋。应用实例扩容前先算池。

### 15.3 备份与恢复

- 每日全量备份 + WAL 连续归档；对象存储开启版本化。
- 每季度做一次恢复演练；没有演练的备份不算备份。
- 明确 RPO / RTO，并写进运维手册。
- 迁移前先备份。

> `ARCH-OPS-01`（1.1 修正）：「10 分钟内回滚」与「迁移只前进」原文档没说清关系，像是打架。**明确：回滚 = 恢复备份（PITR / 备份还原），不是 down migration。** 迁移文件不写反向脚本；「只前进」说的是**代码与迁移的发布顺序**，不是禁止恢复数据。

### 15.4 CI/CD

```
lint → typecheck → unit → integration(PG18) → build → E2E → schema verify → deploy
```

- `schema verify` 对比 `information_schema` / `pg_catalog` 与 Drizzle 定义；不一致就失败。
- `db/generated/enums.sql` 必须与枚举常量一致；`gen:sql && git diff --exit-code`。
- `check-permission-parity` 校验应用层权限矩阵与 DB 函数体一致。
- `check-module-manifest` 校验文档与代码的域清单一致（防重复清单漂移）。
- 迁移与业务代码分开提交；迁移只前进，不回滚代码。
- 部署前跑备份；部署后跑健康检查与只读验证脚本。

### 15.5 零停机迁移

- 先加可空列 / 新表，再回填，再加约束；约束先 `NOT VALID` 再 `VALIDATE`。
- 不在大表上直接加会重写表的 `NOT NULL` / 默认值；按 PostgreSQL 18 的行为评估锁。
- 长事务、长 `VACUUM`、大索引构建安排在低峰；必要时用 `CONCURRENTLY`。
- 破坏性变更分两次发布：先停止写入待删列，再删除。

---

## 16. 演进触发条件

只在信号出现时行动，不提前建设：

| 信号                                          | 行动                                                         | 编号           |
| --------------------------------------------- | ------------------------------------------------------------ | -------------- |
| 单谱系节点 > 5 000 **且** 画布交互 P95 > 1 s  | 先加视口裁剪与按世代请求；仍不够再评估 Canvas 2D / 服务端布局 | `ARCH-FE-05`   |
| 同步发布 P95 > 60 s **且** 规模上限被真实触达 | 引入 PG 表队列 + 独立 worker                                 | `ARCH-PUB-01`  |
| `audit_log` > 1 000 万行，查询 P95 > 500 ms   | 按月分区 + 归档冷数据                                        | —              |
| 数据库 CPU 持续 > 70%，连接池占用 > 80%       | 调池、加只读副本、拆分重查询                                 | —              |
| 人名搜索 P95 > 1 s                            | 增加 `pg_trgm` 表达式索引；仍不够再评估外部搜索              | —              |
| 异步任务积压 > 30 s 或重试率 > 5%             | 引入 PG 表队列 + 独立 worker；仍不够再评估消息队列           | —              |
| 团队 > 10 人，模块合并冲突成为常态            | 按域拆包/拆服务；先拆数据库 schema 边界                      | —              |
| 单客户要求独占实例                            | 独立部署一份，不做代码级多租户分支                           | —              |
| 合规要求全量审计                              | 加 `AFTER` 写触发器统一落审计，把对应条目升级为强审计        | `ARCH-AUD-01`  |
| 对象存储孤儿字节数持续增长                    | 提升对账频率；考虑上传即入库的两阶段提交                     | `DM-MED-02`    |
| 前端要跨域调 API（同源部署被放弃）            | 启用 `cors()`，并把 `credentials` 与 `allowedOrigins` 写死，不用 `origin: '*'` | `ARCH-HONO-03` |
| 同一响应被反复请求且可共享                    | 评估 `cache()`，**必须**置于认证之后并带 `vary: Cookie`      | `ARCH-HONO-03` |
| 静态资源需要按用户定制                        | 不做；静态目录只放公开产物，个性化走 API                     | `ARCH-HONO-10` |
| Hono 升级大版本                               | 用 Context7 重新核对 §18 官方实践表                          | `ARCH-HONO-11` |

**不因为「以后可能」提前做**：不预置消息队列、不预置搜索集群、不预置分库分表、不预置插件系统、**不预置第二条画布渲染路径**、**不预置第二套测试运行器**。

---

## 17. 关键决策摘要

| 决策            | 选择                                                         | 理由                                                         | 代价 / 可逆性                                        |
| --------------- | ------------------------------------------------------------ | ------------------------------------------------------------ | ---------------------------------------------------- |
| 架构形态        | 模块化单体                                                   | 1–3 人团队，运维成本最低                                     | 后期拆服务有成本；可逆                               |
| 数据库          | PostgreSQL 18                                                | `uuidv7`、`ltree`、RLS、延迟约束、advisory lock 都在一个引擎里 | 单点；靠备份与只读副本                               |
| 主键            | UUIDv7                                                       | 全局唯一、时间有序、可直接当 keyset 游标                     | 比 bigint 占空间；可接受                             |
| 租户隔离        | RLS + `app.user_id`                                          | 应用漏写条件也读不到别家数据                                 | 每请求一次成员查询；可接受                           |
| 人物关系        | 一张 `person_relation`，7 种 kind                            | 不建 Family，不存派生关系                                    | 复杂查询要递归 CTE                                   |
| 世系串行化      | 事务级 advisory lock                                         | `FOR UPDATE` 会与外键的 `FOR KEY SHARE` 冲突，堵住整个 Project 的写入 | 需遵守全局锁顺序；可逆                               |
| 关系排序        | 不唯一，靠 `(sort_order, id)`                                | 唯一约束制造 O(n) 重排；对称关系上语义不成立                 | 平局靠 id；可逆                                      |
| 谱系位置        | `node.path ltree` 投影                                       | 树操作简单、可索引；父路径严格更短带来结构性无环             | 移动子树要改路径（单语句重排）                       |
| 姓名            | `person_name` 多行 + 主姓名                                  | 一名多写、原文保留                                           | 查询要 join                                          |
| 引用            | `source_citation` 四目标 XOR                                 | 一条引用只支持一个事实                                       | 多事实要建多条                                       |
| 出版            | 快照不可变 + revoke/purge；**同步起步 + 规模上限**           | 重量级操作必须定，不能留白给将来                             | 超限需升级队列                                       |
| 审计            | 强审计（DB 强制）+ 尽力而为（应用保证）                      | 「靠自觉」不是约束                                           | 明确不承诺完整                                       |
| 认证            | Better Auth                                                  | 数据库会话、Drizzle adapter                                  | 绑定其表结构                                         |
| 媒体            | 私有桶 + 服务端代理 + 桶级对账                               | 不暴露桶、可审计、覆盖孤儿字节                               | 多一跳代理 + 一个对账脚本                            |
| 前端            | SPA + TanStack Query                                         | 工具型产品，无需 SSR                                         | 首屏稍慢；可接受                                     |
| 分页            | keyset，用 `id` 当游标                                       | 复合主键即索引，零新增                                       | 不能跳页                                             |
| 包管理          | pnpm 单一包管理器                                            | 与 Dockerfile 一致                                           | 禁用 Bun 安装器                                      |
| 测试            | `bun test` + Playwright                                      | 收敛工具链                                                   | 集成测试需 Bun 侧 PG 驱动                            |
| Hono 路由组织   | 子路由独立 `Hono` 实例 + `app.route()` 链式挂载              | 官方 RPC 类型推断要求「全链式 + 从具名变量推断」             | 每个模块多一个 router.ts                             |
| Hono 依赖注入   | `Hono<AppEnv>` + `c.get()`；**不用** `createFactory` 注入运行时对象 | `Factory` 只有 `createApp/createMiddleware/createHandlers`，且 `ContextVariableMap` 全局增强会掩盖 `undefined` | 无 DI 框架，测试靠 `app.request` 第三参注入 Bindings |
| Hono 内置中间件 | 优先用内置（`requestId`/`secureHeaders`/`compress`/`bodyLimit`/`timeout`），不用的一律写明理由 | 自研中间件没有安全审计价值                                   | 少一份自研代码，多一张选用表                         |
| OpenAPI         | 官方 `@hono/zod-openapi`                                     | 请求 schema 与 `zValidator` 同一份 Zod 对象                  | 绑定官方包 API                                       |
| 校验失败响应    | `zValidator` hook 统一形状                                   | 默认抛 `HTTPException`，形状与业务错误不一致                 | 每个写端点写一次 hook                                |
| 静态资源        | `@hono/bun` 的 `serveStatic`；静态目录不放需授权文件         | 路由大小写敏感、文件系统不一定，大小写路径可绕过作用域中间件 | 媒体必须走 API 鉴权代理                              |

---

## 18. Hono 官方实践依据

本文所有与 Hono 相关的表述，均对照 Hono 官方文档与源码核实（经 Context7 拉取）：

| 主题                                                         | 官方来源                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| 中间件执行顺序（注册顺序进入、逆序返回）                     | [Middleware Guide](https://hono.dev/docs/guides/middleware)  |
| `c.error` 在 `await next()` 之后可读                         | [Context API](https://hono.dev/docs/api/context)             |
| `Factory` 的真实 API：`createApp` / `createMiddleware` / `createHandlers` | [hono/factory 源码](https://github.com/honojs/hono/blob/main/src/factory.ts) |
| `ContextVariableMap` 全局增强会掩盖 `undefined`              | [Context API — ContextVariableMap](https://hono.dev/docs/api/context) |
| RPC 类型推断要求：全链式 + 从具名变量推断                    | [RPC Guide](https://hono.dev/docs/guides/rpc) · [Best Practices](https://hono.dev/docs/guides/best-practices) |
| `validator` 各 target 取值来源与 `Content-Type` 门控         | [hono/validator 源码](https://github.com/honojs/hono/blob/main/src/validator/validator.ts) |
| `zValidator` hook 可短路请求；peer 支持 Zod 3.25 / 4         | [@hono/zod-validator](https://github.com/honojs/middleware/tree/main/packages/zod-validator) |
| `HTTPException.getResponse()` 不感知 `Context` 的 header     | [Exception API](https://hono.dev/docs/api/exception)         |
| 内置中间件清单与默认行为                                     | [Built-in Middleware](https://hono.dev/docs/middleware/builtin) |
| `serveStatic` 的大小写 / 8.3 短名绕过风险                    | [Bun Getting Started](https://hono.dev/docs/getting-started/bun) |
| Bun 默认导出 `{ port, fetch }` 启动方式                      | [Bun Getting Started](https://hono.dev/docs/getting-started/bun) |
| `app.request(input, requestInit?, env?, executionCtx?)` 测试约定 | [Hono API](https://hono.dev/docs/api/hono)                   |
| `@hono/zod-openapi` 的 `createRoute` / `OpenAPIHono` / `app.doc()` | [zod-openapi 示例](https://github.com/honojs/website/blob/main/examples/zod-openapi.md) |

> `ARCH-HONO-11`：升级 Hono 大版本前，先用 Context7 重新拉一遍上表对应条目，逐条核对本文表述是否仍成立。框架语义会变，本文对框架的断言必须跟着变。

---

## 19. 文档边界

- 本文是架构基线：运行时、模块、数据边界、API、前端、认证、并发、媒体、部署。
- 表、字段、约束、索引、视图、RLS 策略与数据库函数以《云谱数据模型》为准。
- 两者冲突时，数据模型优先；字段级变更先改数据模型，再改本文与代码。
- 本文不维护第二份表结构；读者按当前描述落地即可。
- **规则冲突的处理**：本文与数据模型出现互相否定的表述时，按「编号更新者优先」处理——带编号的规格条目优先于散文段落；两条都带编号且冲突时，视为缺陷，必须在同一次提交里改掉，不允许「以后再说」。

---

## 20. Complexity Tracking（复杂度例外登记）

> **只有违反宪法或突破复杂度预算的设计才登记在这里。**
> 本表为空，表示当前设计完全在宪法与预算之内（§1.4 第一次检查 11 项全通过）。
> 登记三列缺一不可：**违反了什么 / 为什么必须 / 更简单的替代方案为何被否**。

| #    | Violation（违反了什么） | Why Needed（为什么必须） | Simpler Alternative Rejected Because（更简单的替代为何被否） | 决策人 | 日期 |
| ---- | ----------------------- | ------------------------ | ------------------------------------------------------------ | ------ | ---- |
| —    | 当前无例外              | —                        | —                                                            | —      | —    |

> **规则**：本表不得事后补记。设计评审时未登记的例外，视为未获批准，实现按缺陷处理（宪法 Governance · 违反处理）。

---

## 21. 编号索引表（`ARCH-*`）

> 与数据模型 §18 的 `DM-*` 索引表同构：**引用编号必须能在本表找到定义**。
> 校验目标：悬空引用 0、一号两义 0、未引用 0（宪法 Development Process · 阻塞级门禁）。

| 编号           | 一句话定义                                           | 本文位置         |
| -------------- | ---------------------------------------------------- | ---------------- |
| `ARCH-AR-01`   | 领域逻辑只有一份：规则只存在于该域的 service         | §0, §5.2         |
| `ARCH-AR-02`   | 隔离靠数据库：租户边界写在 RLS 策略里                | §0, §7           |
| `ARCH-AR-03`   | 谱系是图不是树：关系边是事实，`ltree` 路径是位置投影 | §0, §6.3         |
| `ARCH-AR-04`   | 规则要有执行者：没有执行者的条目不写进文档           | §0, §1.2         |
| `ARCH-AR-05`   | 依赖单向：前端 → API → service → 数据层              | §1.2, §5.2, §5.3 |
| `ARCH-AR-06`   | 单一真相源：一份 Zod schema、一份数据模型            | §1.2, §5.3, §8.5 |
| `ARCH-AR-07`   | 约束必须有执行者                                     | §1.2             |
| `ARCH-AR-08`   | 失败要响亮：禁止静默吞异常                           | §1.2, §8.3       |
| `ARCH-AR-09`   | 不猜未来：不预埋空实现                               | §1.2, §16        |
| `ARCH-API-01`  | `uuidv7()` 主键时间有序，主键本身即游标              | §8.7             |
| `ARCH-AUD-01`  | 审计完整性诚实降级为软约束并登记                     | §12.2            |
| `ARCH-BLD-01`  | pnpm 是全仓库唯一包管理器，Dockerfile 与之一致       | §3, §15.1        |
| `ARCH-CC-01`   | 并发控制用事务级 advisory lock，不锁 project 行      | §11.2            |
| `ARCH-ERR-01`  | 错误两级映射：先看 SQLSTATE，再看约束名              | §8.3             |
| `ARCH-FE-05`   | 只做一条画布渲染路径                                 | §9.2             |
| `ARCH-GOV-01`  | 400 行红线是警报，不是合并门禁                       | §1.3             |
| `ARCH-HONO-01` | 不用 `createFactory` 注入运行时对象                  | §8.1.1           |
| `ARCH-HONO-02` | 中间件洋葱模型：进入正序、返回逆序                   | §3.1, §8.2       |
| `ARCH-HONO-03` | 优先用 Hono 内置中间件，不采用须写明理由             | §3.1             |
| `ARCH-HONO-04` | 路径参数与查询参数必须经 `zValidator` 校验           | §8.2             |
| `ARCH-HONO-05` | 不用全局 `declare module 'hono'` 扩展变量            | §8.2             |
| `ARCH-HONO-06` | OpenAPI 用官方 `@hono/zod-openapi`                   | §3, §8.8         |
| `ARCH-HONO-07` | `onError` 必须同时处理 `HTTPException`               | §8.3             |
| `ARCH-HONO-08` | 校验的官方语义（各 target 取值来源）                 | §8.6             |
| `ARCH-HONO-09` | 校验失败响应体由 hook 统一                           | §8.3, §8.6       |
| `ARCH-HONO-10` | Bun 入口与静态资源：媒体走 API 鉴权代理              | §15.1.1          |
| `ARCH-HONO-11` | Hono 升级大版本前重核官方实践表                      | §18              |
| `ARCH-HONO-12` | RPC 客户端用官方 `hc<AppType>`，不手写路径           | §8.1, §9.1       |
| `ARCH-IDX-01`  | 索引按查询模式建，不设机械的「RLS 谓词列首列」规则   | §6.6             |
| `ARCH-MOD-01`  | 模块清单只有一份：`MODULES` 常量                     | §5, §9.3         |
| `ARCH-OPS-01`  | 回滚 = 恢复备份，不是 down migration                 | §15.3, §15.5     |
| `ARCH-PERM-01` | 同一授权规则不允许写两遍                             | §7.5, §10        |
| `ARCH-PUB-01`  | 出版同步起步，有明确上限，不留白                     | §11.6            |
| `ARCH-TST-03`  | 测试分层：`bun test` 跑集成，E2E 用 Node             | §3, §14.1        |
| `ARCH-TST-04`  | 路由测试用 `app.request()` 官方调用约定              | §14.1            |

**编号规则**：`ARCH-<域>-<序号>`。域代码含义——`AR` 架构原则 / `API` 接口分页 / `AUD` 审计 / `BLD` 构建 / `CC` 并发控制 / `ERR` 错误 / `FE` 前端 / `GOV` 治理 / `HONO` Hono 官方实践 / `IDX` 索引 / `MOD` 模块 / `OPS` 运维 / `PERM` 权限 / `PUB` 出版 / `TST` 测试。

**编号唯一性**（`DM-GEN-21`）：同一编号不得承载两条规则。历史版本修订保留原编号并标注版本号，不复用编号表达新规则。

---

## 22. 与上游规格的对应

| `spec.md` 需求     | 本文对应章节                                                 | 状态                  |
| ------------------ | ------------------------------------------------------------ | --------------------- |
| `FR-PER-*`         | §5（`genealogy` 模块）、§6.3                                 | 数据模型 §5.6、§5.7   |
| `FR-REL-*`         | §5（`genealogy`）、§11.3                                     | 数据模型 §5.8、§9.2   |
| `FR-LIN-*`         | §6.3、§9.2                                                   | 数据模型 §5.10、§5.11 |
| `FR-SRC-*`         | §5（`source` 模块）                                          | 数据模型 §5.12、§5.13 |
| `FR-ART-*`         | §5（`article`）、§11.1                                       | 数据模型 §5.14、§5.15 |
| `FR-BOK-*`         | §5（`book`）、§11.6                                          | 数据模型 §5.19–§5.21  |
| `FR-MED-*`         | §5（`media`）、§12.1、§15.1.1                                | 数据模型 §5.16        |
| `FR-ORG-*`         | §5（`organization`）、§10、§11.4                             | 数据模型 §5.1–§5.4    |
| `FR-TEN-*`         | §7 全部                                                      | 数据模型 §8           |
| `FR-AUD-01`        | §12.2                                                        | 数据模型 §5.22        |
| `NFR-*`            | §3（技术栈）、§8.3（错误）、§8.7（分页）、§15（部署）、§14（测试） | —                     |
| `OOS-01`..`OOS-19` | §1.1（架构侧理由补充）                                       | spec.md §8 为主       |