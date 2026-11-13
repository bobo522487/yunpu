# 迁移、Drizzle 落地边界与回滚

> 本文件是「Drizzle 落地边界、生成物与迁移回滚」的唯一权威；其他主题见 `docs/README.md` 导航，同一主题不复制表格。

## 12. Drizzle 落地边界

**分工原则**：Drizzle 负责「表长什么样」，手写 SQL 负责「数据库怎么管住它」。凡是 Drizzle 表达不了的语义（延迟外键、RLS 策略、角色权限、函数、触发器、`SECURITY DEFINER` 属主），一律手写迁移，并在 §12.4 明确登记「为什么不用 Drizzle 表达」。

### 12.1 归 Drizzle schema

表、列、主键、普通/复合外键、`CHECK`、唯一索引、部分唯一索引、普通索引（含 GiST）、生成列、视图定义。

**`ltree` 自定义类型**：

```ts
import { customType } from 'drizzle-orm/pg-core';

export const ltree = customType<{ data: string; driverData: string }>({
  dataType: () => 'ltree',
});
```

**生成列——必须显式写 `mode: "stored"`**：

```ts
parentPath: ltree('parent_path').generatedAlwaysAs(
  sql`CASE WHEN nlevel(path) > 1
           THEN subpath(path, 0, nlevel(path) - 1)
           ELSE NULL END`,
  { mode: 'stored' },        // ← 不写会随 PG 版本变化（见下）
),
```

> **v1.2 补充说明（重要，但结论是「安全」）**：Drizzle 官方文档中 `generatedAlwaysAs` 的 `mode` 选项支持 `'stored'` 与 `'virtual'`。`drizzle-orm@0.45.4` 的 `pg-core/columns/common.js` 第 28 行默认值**待验证**（源码核对与复现登记见 [`../../verification/README.md`](../../verification/README.md)），故本文按 `DM-GEN-20` 一律显式写 `{ mode: 'stored' }`，不依赖任何库默认值。
>
> 但**本文仍要求显式写 `{ mode: 'stored' }`**，理由是 `DM-GEN-20`：语义不能依赖某个库的当前默认值。Drizzle 未来若跟随 PG 18 改成 `virtual` 默认，`ltree` 列会立刻报 `0A000`（用户自定义类型不允许虚拟生成列）。**显式写出来，这个风险就不存在。**

**复合主键**：

```ts
primaryKey({ columns: [t.projectId, t.id] })
```

**复合外键**：

```ts
foreignKey({
  columns: [t.organizationId, t.projectId],
  foreignColumns: [project.organizationId, project.id],
})
```

**部分唯一索引**：

```ts
uniqueIndex('uq_person_name_primary')
  .on(t.projectId, t.personId)
  .where(sql`is_primary`)
```

**GiST 索引**：

```ts
index('node_path_gist').using('gist', t.projectId, t.lineageId, t.path)
```

**视图（`security_invoker`）**：

```ts
export const lineageRoot = pgView('lineage_root', {
  projectId: t.projectId,
  lineageId: t.lineageId,
  nodeId: t.id,
  label: t.displayName,
  note: t.placementNote,
}).with({ securityInvoker: true }).as(...)
```

**`pgSchema` 分离 `app` 与 `public`**：业务表在 `public`，函数与视图在 `app`。用 `pgSchema('app')` 显式声明，避免依赖 `search_path`。

### 12.2 归手写 SQL 迁移（`drizzle-kit generate --custom`）

用 [Custom migrations](https://orm.drizzle.team/docs/kit-custom-migrations) 的 `--custom` 生成空迁移文件后手写（抓取日期：2026-11-13）：

```bash
pnpm drizzle-kit generate --custom --name=rls_policies
```

| 归手写的内容 | 为什么 Drizzle 表达不了 / 不该由它表达 |
|---|---|
| `DEFERRABLE INITIALLY DEFERRED` 外键 | Drizzle 的 `foreignKey()` 不暴露 deferrable 选项 |
| 自引用延迟外键（`fk_node_parent`） | 同上，且需要 `STORED` 生成列配合 |
| `ENABLE` / `FORCE ROW LEVEL SECURITY` | Drizzle 的 `pgPolicy()` 只生成 `CREATE POLICY`，不生成 `FORCE`；本模型必须 `FORCE`（表 owner 也受限） |
| 角色定义（`genealogy_app` / `genealogy_api` / `rls_definer`） | 属于部署环境，不属于 schema |
| `GRANT` / `REVOKE`，含**列级**授权 | Drizzle 无权限模型 |
| `rls_definer` 的最小权限清单（§8.5） | 同上；这是安全边界的核心，必须手写并被反向校验 |
| 函数与触发器、`SECURITY DEFINER` 属主切换 | Drizzle 无函数/触发器 DSL |
| 视图 `security_invoker = true` | Drizzle 有 `.with({ securityInvoker: true })`，但**函数体与视图定义仍需手写迁移**以保证与 §6 一致；schema 声明仅用于类型推导 |
| `ON DELETE SET NULL (column_list)` 列清单式 | Drizzle 的 `onDelete` 不支持列清单 |
| `btree_gist` 扩展安装 | 扩展属迁移前置（§2） |
| 生成物 `db/generated/enums.sql`、`tables.sql`、`rls_policies.sql` | 由 `scripts/gen-sql.ts` 产出，不由 Drizzle 生成 |

> **关于 `pgPolicy()`**：Drizzle 官方确实提供 `pgPolicy(name, { as, to, for, using, withCheck })` 并作为 `pgTable` 的 `extraConfig` 参数传入。但本模型**不采用**它生成 RLS，原因有二：① 它不生成 `FORCE ROW LEVEL SECURITY`，而 `DM-RLS-02` 要求全部 22 张表都 `FORCE`；② RLS 策略矩阵必须与 §8.2 的生成物 `db/generated/rls_policies.sql` 同源（`DM-GEN-19`），手写迁移才能保证「一份来源 → 两处产出 → CI 反向校验」。Drizzle 的 `pgPolicy` 保留为可选路径，但**不作为策略的唯一来源**。

### 12.3 一致性与校验

| 工具 | 断言内容 | 失败后果 |
|---|---|---|
| `scripts/gen-sql.ts` | 从 `src/domain/enums.ts` 与 `TABLE_NAMES` 生成 `db/generated/enums.sql`、`tables.sql`、`rls_policies.sql` | — |
| `db/verify/tables.sql` | 断言 `pg_tables` 中 `public` schema 恰有 22 张表，表名与生成物一致 | CI 失败 |
| `db/verify/generated_columns.sql` | 断言所有生成列的 `generation_expression` 非空且 `is_generated='ALWAYS'`；断言 `node.parent_path` / `book_catalog.parent_path` 为 **STORED**（VIRTUAL 会报 `0A000`） | CI 失败 |
| `db/verify/fk_indexes.sql` | 逐条断言外键引用侧索引覆盖（§11.2）；未覆盖项必须在 `EXCEPTIONS` 白名单里显式列出并附理由 | CI 失败 |
| `db/verify/rls.sql` | 断言 22 张表全部 `rowsecurity = true` 且 `forcerowsecurity = true`；断言策略数 = 21（`organization_member` 用独立策略形式） | CI 失败 |
| `db/verify/permissions.sql` | 断言 `rls_definer` 的权限集合与 §8.5 **完全一致**（多一项即失败——多一项就意味着多一条越权路径） | CI 失败 |
| `db/verify/constraints.sql` | 断言 `pg_constraint` 中不存在匿名约束（`conname` 全部非空且符合前缀规范）；断言 `contype='n'` 的具名 `NOT NULL` 存在 | CI 失败 |
| `db/verify_schema_consistency.ts` | 对比 `information_schema` / `pg_catalog` 与 Drizzle 定义（表、列、CHECK 名单、唯一索引名单） | CI 失败 |
| `db/verify/*.sql` 行为断言 | **每个触发器至少一条负向用例**（证明它会拒绝，而不只是存在） | CI 失败 |
| CI | `pnpm gen:sql && git diff --exit-code db/generated/`；迁移与 schema 不一致即失败 | 合并被阻塞 |

> **实现状态**：上表中的 `scripts/gen-sql.ts`、`db/verify/*.sql` 与 `pnpm gen:sql` 是设计目标，本仓库尚未落地（见 `docs/verification/README.md`）。本次重构唯一可执行的门禁是 `scripts/check-docs.sh --root docs --strict`；不得把未实现的校验写成已生效。

### 12.4 Drizzle 边界总表


| 能力 | Drizzle | 手写 SQL | 说明 |
|---|---|---|---|
| 表 / 列 / 类型 | ✅ | | |
| `ltree` 自定义类型 | ✅ `customType` | | |
| 生成列 | ✅（须显式 `mode: 'stored'`） | | |
| 主键（单列 / 复合） | ✅ | | |
| 外键（单列 / 复合） | ✅ | | 复合外键用于 Project Scope |
| 可延迟外键 | ❌ | ✅ | `DEFERRABLE INITIALLY DEFERRED` |
| `CHECK` | ✅ | | |
| 唯一索引 / 部分唯一索引 | ✅ | | `uniqueIndex().on().where()` |
| GiST / GIN 索引 | ✅ `.using('gist', ...)` | | |
| 视图 | ✅ `pgView` + `securityInvoker` | ✅ 定义体 | 声明与迁移都要有 |
| RLS 策略 | ⚠️ `pgPolicy()` 不生成 `FORCE` | ✅ | **不作为唯一来源** |
| `FORCE ROW LEVEL SECURITY` | ❌ | ✅ | `DM-RLS-02` 硬要求 |
| 角色 / 权限（列级） | ❌ | ✅ | §8.5 |
| 函数 / 触发器 | ❌ | ✅ | |
| `SECURITY DEFINER` + 属主 | ❌ | ✅ | |
| 扩展安装（`ltree` / `btree_gist`） | ❌ | ✅ | 迁移前置条件 |
| 校验 schema（`drizzle-zod`） | ✅ | | 只做 API 入参校验，**不替代 DB 约束** |

**`drizzle-zod` 的定位**（v1.2 明确）：

```ts
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod';

export const PersonInsert = createInsertSchema(person);
export const PersonSelect = createSelectSchema(person);
```

`drizzle-zod` 生成的是 **API 边界**的输入输出校验，**不是**数据完整性机制。DB 约束永远强于应用校验：

- 应用校验可以被绕过（直连数据库、内部脚本、并发竞态）。
- 因此**任何一条规则都不得只写在 `drizzle-zod` 里**；`drizzle-zod` 只用于「快速失败、给出友好提示」，DB 约束负责「最终裁决」。
- `createInsertSchema` 的 `refine` 可用于表达 `DM-GEN-14`（非空白文本）等规则，但**必须同时有对应的 DB CHECK**。只写在 Zod 里的规则在 §7.1 不变量表中不得标记为 `DB` 类型。

### 12.5 连接配置

```ts
export const db = drizzle(pool, {
  schema,
  prepare: false,     // ← 必须
});
```

- **`prepare: false` 是硬要求**：服务端 prepared statement 与 `SET LOCAL ROLE genealogy_app` / `SET LOCAL app.user_id` 组合时，语句在连接池化复用下会带着上一个会话的角色与上下文执行。这是越权风险，不是性能问题。
- **超时由连接串下发**，不由应用 `SET`（`DM-POOL-01`，见 §5.8）：

```
PGOPTIONS='-c lock_timeout=3000 -c statement_timeout=30000 -c idle_in_transaction_session_timeout=60000'
```

- 每个事务入口必须 `SET LOCAL ROLE genealogy_app` 并 `set_config('app.user_id', $1, true)`，随后断言 `current_user = 'genealogy_app'`（§8.2 fail-closed 纪律第 2 条）。

---

## 13. 迁移与验收

### 13.1 迁移路径

- **无生产数据**：用 1.0 重建单一基线 `0001_init.sql`，删除 V4 的 0001–0008 拆分。这是推荐路径。
- **已有环境**：新增 `0009_data_model_v1.sql`，按「删索引/触发器 → 改列 → 加列 → 回填 → 加约束」顺序执行。
- 两条路径都必须在真实 PostgreSQL 18 上跑完整验收，才允许合并。
- **回滚的定义**：迁移**只前进**。「10 分钟内回滚」指的是**恢复备份**，不是 down migration。两者不冲突：迁移文件不写反向脚本，回滚靠 PITR / 备份还原。

### 13.2 PG 18 迁移注意（v1.2 新增）

| 事项 | 规则 |
|---|---|
| 生成列 | 一律显式 `STORED`。PG 18 默认 VIRTUAL，且 `ltree` 属用户自定义类型，VIRTUAL 会报 `0A000` |
| `NOT NULL` | 具名（`CONSTRAINT x_not_null NOT NULL`）。PG 18 起 `NOT NULL` 进入 `pg_constraint`（`contype='n'`） |
| 大表加约束 | `ADD CONSTRAINT ... NOT VALID` → `VALIDATE CONSTRAINT` 两步。**没有** `ALTER CONSTRAINT ... SET NOT VALID`（待验证：官方无此语法） |
| `NOT NULL` 的低锁路径 | `NOT NULL` 不能走 `NOT VALID` 路线（`VALIDATE CONSTRAINT` 不接受 `contype='n'`）。先加 `CHECK (col IS NOT NULL) NOT VALID` → `VALIDATE` → 再 `ALTER COLUMN ... SET NOT NULL` |
| 外键 | 显式声明 `ON DELETE`；`RESTRICT` 的报错码是 `23001`（不是 `23503`） |
| `initdb` | 默认启用数据校验和；`pg_upgrade` 要求两端一致 |
| `EXPLAIN` | `EXPLAIN (ANALYZE)` 自动含 `BUFFERS`，不需手写 |
| 迁移后校验 | 必须跑 §12.3 的全部 `db/verify/*.sql`；`db/verify/fk_indexes.sql` 的白名单必须与 §11.2 完全一致 |

**迁移顺序（已有环境）**：

1. `CREATE EXTENSION IF NOT EXISTS ltree; CREATE EXTENSION IF NOT EXISTS btree_gist;`
2. 删旧索引与旧触发器（可逆性靠备份，不靠 down migration）。
3. 改列 / 加列（显式 `STORED` / 具名 `NOT NULL`）。
4. 回填数据。
5. 加约束：先 `NOT VALID` 再 `VALIDATE`。
6. 建索引（`CREATE INDEX CONCURRENTLY` 在迁移脚本外单独执行，不进事务）。
7. 建函数 / 触发器 / 视图。
8. 建角色并授权（§8.4、§8.5）。
9. `ENABLE` + `FORCE` RLS，建策略。
10. 跑 §12.3 全部校验。
