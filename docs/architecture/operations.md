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

逐端点的 `bodyLimit` / `timeout` 取值见 [api/conventions.md](api/conventions.md) §1.9；本文不复制表格。

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

## 16. 演进与决策记录

演进触发条件与关键决策摘要属于过程记录，已迁往 [../decisions/0001-pg18-defects.md](../decisions/0001-pg18-defects.md)；本文只保留可执行的构建、部署与运维步骤（宪法 Article VII 不猜未来、Article II 删掉就是删掉）。