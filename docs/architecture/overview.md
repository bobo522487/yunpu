# 架构总览与横切关注点

> 本文件是「系统目标、边界、分层、横切约束与项目结构」的唯一权威；其他主题见 `docs/README.md` 导航，同一主题不复制表格。

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

**「明确不做」清单的唯一权威副本在 [`functional.md`](../requirements/functional.md) §8，编号 `OOS-01`..`OOS-19`。** 本文不复制该表——同一主题只在**一个**文档里定义（宪法 Article VI）。

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

### 1.5 数据层权威

- 表、字段、约束、索引、视图、RLS、数据库函数以 [`schema.md`](data/schema.md) 为唯一权威。
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

## 3. 文档布局（事实）

本仓库的完整目标架构文档位于 docs/，按主题组织；specs/<NNN>-<feature>/ 只在后期分批实现时由 /speckit-specify 生成，当前不存在。
`docs/` 是目标架构基线，`specs/` 是后期分批实现的批次工件；批次工件引用 `docs/` 的编号，不复制表格。

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

## 19. 文档边界

- 本文是架构基线：运行时、模块、数据边界、API、前端、认证、并发、媒体、部署。
- 表、字段、约束、索引、视图、RLS 策略与数据库函数以《云谱数据模型》为准。
- 两者冲突时，数据模型优先；字段级变更先改数据模型，再改本文与代码。
- 本文不维护第二份表结构；读者按当前描述落地即可。
- **规则冲突的处理**：本文与数据模型出现互相否定的表述时，按「编号更新者优先」处理——带编号的规格条目优先于散文段落；两条都带编号且冲突时，视为缺陷，必须在同一次提交里改掉，不允许「以后再说」。

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
