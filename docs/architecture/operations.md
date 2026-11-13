# 构建、部署与演进

> 本文件是「构建、部署、演进触发与关键决策摘要」的唯一权威；其他主题见 `docs/README.md` 导航，同一主题不复制表格。

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
