# Contract: 运行时收口与租户护栏

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md) | **Date**: 2026-11-24

## 1. 单一运行时

| 能力 | 约定命令（示意） | 禁止 |
| --- | --- | --- |
| 启动 API | `node apps/api/src/index.ts`（或 package script 等价） | `bun apps/api/...` 作为业务启动 |
| 迁移 | `node packages/db/src/migrate.ts` | `bun …/migrate.ts` |
| 测试 | `pnpm test` → Vitest | 业务路径 `bun test` |

就绪：既有 `/api/ready`（或等价）在依赖可用时返回成功。优雅关闭：SIGTERM/SIGINT → 停收新请求 → 排空 → 关 pool → exit 0。

## 2. 租户事务入口

```text
withTenantTransaction({ userId, orgId }, async (tx) => { … })
```

事务内必须：

1. `SET LOCAL ROLE genealogy_app`
2. `set_config('app.user_id', userId, true)`
3. `set_config('app.current_org_id', orgId, true)`

模块不得 import 裸 pool / 未绑定 `db`。静态门禁失败即 CI 红。

重试：最多 3 次，仅针对连接重置、`40001`、`40P01`。唯一键与版本冲突 → 409，不重试。

## 3. 错误信封

沿用 runtime 约定：

```json
{ "ok": false, "code": "CYCLE_DETECTED", "message": "…", "details": {} }
```

- 成功：`{ "ok": true, "data": … }`
- 响应头带 `X-Request-Id`；日志字段含 `requestId`
- 越权对外：不可发现（404 语义）；审计记真实 403

## 4. AppType 导出

`apps/api/src/app.ts` 链式注册 `/api/v1` 下 auth / organizations / projects / account / persons（或 genealogy）路由后：

```ts
export type AppType = typeof apiRoutes;
```

前端以该类型为契约真相源，不维护第二份手写 DTO 清单。

## 5. FORCE RLS 断言（测试契约）

迁移后查询返回行集必须为空（白名单除外）：

```sql
SELECT c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname NOT IN ('__drizzle_migrations' /* + 明示白名单 */)
  AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity);
```
