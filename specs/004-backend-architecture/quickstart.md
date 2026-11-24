# Quickstart: 后端架构收口验收指南

**Feature**: `004-backend-architecture` | **Date**: 2026-11-24

> 验证与运行指南，不含实现代码。契约见 [contracts/](contracts/)，表结构见 [data-model.md](data-model.md)。

## 1. 前置条件

- Docker（PostgreSQL 18 + MinIO）
- Node.js ≥ 26.13、pnpm 12.x
- `pnpm install`

## 2. 启动与迁移

```bash
scripts/env.sh up development
scripts/env.sh up test

pnpm db:migrate
pnpm db:migrate -- --env test
# 等价：node --import ./scripts/ts-ext-register.mjs packages/db/src/migrate.ts

pnpm start:api
# 预期：就绪探针成功；进程可被 SIGTERM 优雅退出
```

预期：`person` / `person_name` / `person_relation` / `lineage_projection` 存在且 `rowsecurity`+`forcerowsecurity` 为真；仓库业务脚本无 `bun ` 启动/迁移/测试残留。

## 3. 自动化测试

```bash
# Node 26 + Vitest（根 package.json；无 bun test）
pnpm test
# 或：pnpm test:auth / pnpm exec vitest run --config vitest.config.ts <path>

# 依赖方向
pnpm exec biome check .

# 文档（若改了 schema/错误映射）
scripts/check-docs.sh --root docs --strict --baseline docs/.check-docs-baseline.txt

# 子图性能（默认跳过；显式开启）
YUNPU_PERF=1 pnpm exec vitest run --config vitest.config.ts tests/genealogy/subgraph-perf.test.ts
```

必过断言：

| 用例 | 期望 |
| --- | --- |
| FORCE RLS | `pg_class` 断言空结果 |
| 跨租户读写 | 空或 404；无泄露 |
| 父母环 | `CYCLE_DETECTED` / GX001；无脏行 |
| 父母第 3 条 | `PARENT_LIMIT` |
| 配偶反向 | `CONFLICT`，仍一条 |
| 删人物 | 边与投影一并消失 |
| 事务失败 | 完整回滚 |
| 子图默认 | 深度/上限生效；`hasMore*` 正确 |
| 子图性能 | ~5k 人 P95 &lt; 200ms（仅 `YUNPU_PERF=1`） |

## 4. 手动冒烟

1. 登录（既有认证）→ 取项目 id。  
2. 创建两人并建 `biological_parent` → 读回。  
3. 再提交成环的父母边 → 409。  
4. `GET …/subgraph?rootPersonId=…` → 集合有限。  
5. 删父人物 → 子边与投影清理。  
6. 用另一组织会话读上述 id → 404/空。

## 5. 非阻塞收尾（可不挡合并）

- 删除服务端鉴权 HTML 页（前端已接管后）。  
- 将 `birth_year` 等便利字段是否迁入 `event` 的决策记入后续批次。
