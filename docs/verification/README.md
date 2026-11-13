# 验证与实测登记

> 本文件是 PG 18 实测状态与官方依据索引的登记处；本机无 `psql`/`pg_ctl`，全部声明按用户决策降级为「待验证」。

## 原始素材（重构前基线，待 Task 4 去重）

## 17. PG 18 实测记录

**环境**：PostgreSQL 18.6 (Ubuntu 18.6-1.pgdg24.04+2)，`x86_64-pc-linux-gnu`，编译器 GCC 13.3.0。

**对象**：22 张表 + 55 条外键 + 42 个触发器 + 16 个 `app` 函数 + 2 个视图 + 21 条 RLS 策略，全部在真实实例上应用成功。

| # | 实测项 | 方法 | 结果 |
|---|---|---|---|
| #01 | `uuidv7()` 可用；生成列必须 `STORED` | `SELECT uuidv7() IS NOT NULL`；建含 `ltree` 的临时表用默认生成列 | `uuidv7()` 返回非空；**默认（VIRTUAL）生成列被拒：`SQLSTATE 0A000 virtual generated column "parent_path" cannot have a user-defined type`** → 必须显式 `STORED` |
| #02 | `ON DELETE RESTRICT` 的 SQLSTATE | 删除 owner 的 `organization_member` 行 | **`SQLSTATE 23001`**，消息 `violates RESTRICT setting of foreign key constraint "fk_organization_owner"`（**不是 `23503`**） |
| #03 | `updated_at` 严格递增 | 同一事务内连续两次 UPDATE，比对 `updated_at` | `now()` 版两次相同；**`clock_timestamp()` 版严格递增**（t1 `…41.006905` → t2 `…41.048754` → t3 `…41.048862`） |
| #04 | `NOT NULL` 具名约束进入 `pg_constraint` | 查 `pg_constraint` | 存在 `contype='n'` 的具名约束：`person_id_not_null`、`person_organization_id_not_null`、`person_project_id_not_null`、`person_sex_not_null`、`person_created_at_not_null`、`person_updated_at_not_null` |
| #05 | RLS 谓词写法对比 | 分别执行两种写法 | **`= ANY ((SELECT f()))` 被拒：`SQLSTATE 42883 operator does not exist: uuid = uuid[]`**；**`= ANY (f())` ACCEPTED** |
| #06 | RLS 谓词的执行计划 | `EXPLAIN` | `Filter: (organization_id = ANY (app.visible_org_array()))`——常量折叠为 InitPlan，非逐行求值 |
| #07 | RLS fail-closed 三路径 | 无 GUC / 非法 GUC / 合法成员 GUC | 无上下文 → **0 行**；`app.user_id='not-a-uuid'` → **0 行**且 `current_user_id() IS NULL` 为 `true`；成员上下文 → **1 行** |
| #08 | 邀请邮箱比较 | `NULL <> 'x'` vs `NULL IS DISTINCT FROM 'x'` | `<>` → **不抛错（校验被跳过，漏洞成立）**；`IS DISTINCT FROM` → 判定为不一致（正确） |
| #09 | 对称关系规范序 | 插入 `spouse` B→A（而 A→B 已存在） | **`23514 ck_person_relation_symmetric_order`** |
| #09b | 关系自环 | `from_person_id = to_person_id` | **`23514 ck_person_relation_not_self`** |
| #10 | 世系二元反向环 | 事务内插入 `biological_parent` A→B 与 B→A，提交 | **提交时 `GX001`**：`世系关系会形成祖先环路`（DETAIL 含 project/from/to/kind） |
| #10b | 非世系反向边允许 | `step_parent` 双向各插一条 | **两次都成功**（表中 2 行） |
| #11 | `ADD CONSTRAINT ... NOT VALID`（FK） | 对 `person` 加一条重复的复合 FK | **ACCEPTED** |
| #11b | `VALIDATE CONSTRAINT` | 验证上一条 | **ACCEPTED** |
| #11c | `ADD CONSTRAINT ... NOT VALID`（CHECK） | 加 `CHECK (surname <> 'x') NOT VALID` | **ACCEPTED** |
| #12 | 复合 GiST 被真正用于子树查询 | `EXPLAIN` 子树查询 | `Index Scan using node_path_gist on node`，`Index Cond: ((project_id = …) AND (lineage_id = …) AND (path <@ '0020'))`——**三列全部下推，无额外 Filter** |
| #13 | `EXPLAIN ANALYZE` 自动含 `BUFFERS` | `EXPLAIN (ANALYZE, TIMING off, COSTS off)` | `Aggregate`、`Seq Scan on person`、`Planning` **三者都输出 `Buffers: shared hit=1`** |
| #14 | FK → 索引覆盖 | 逐条比对 `pg_constraint.conkey` 与 `pg_index.indkey` 前缀 | **55 条外键：37 条 YES，18 条 `** MISSING **`**（全部为 17 条 `fk_*_project` 与 `fk_organization_owner`，处置见 §11.2） |
| #15 | 表清单与 RLS 覆盖 | 查 `pg_tables` / `pg_policies` | `tables = 22`，`rls_on = 21`（`organization_member` 未计入 DO 循环但已单独 `ENABLE`+`FORCE`），`policies = 21` |
| #16 | 触发器总数 | 查 `pg_trigger`（`tgisinternal = false`，`public` schema） | **42 个**，与 §9.2 逐条一致 |
| #17 | `ALTER CONSTRAINT ... SET NOT VALID` | 直接执行 | **`syntax error at or near "SET"`——PG 18 没有这个子句** |
| #17b | `VALIDATE CONSTRAINT` 对具名 `NOT NULL` | `VALIDATE CONSTRAINT person_surname_not_null` | **`42704 constraint "person_surname_not_null" of relation "person" does not exist`**（`NOT NULL` 不参与 `VALIDATE` 候选集） |
| #18 | `ON DELETE SET NULL (column_list)` | 建带列清单的外键 | **ACCEPTED** |
| #19 | 生成列 VIRTUAL vs STORED | 见 #01 | 虚拟 + `ltree` → `0A000`；`STORED` → 全部 22 表应用成功 |
| #20 | Drizzle 生成列默认模式 | 检查 `drizzle-orm@0.45.4` 的 `pg-core/columns/common.js` | 第 28 行**硬编码 `mode: "stored"`**——PG 方言默认已是 STORED，但本文仍要求显式书写 |
| #21 | `DROP NOT NULL` | `ALTER TABLE … ALTER COLUMN surname DROP NOT NULL` | ACCEPTED |

## 19. 官方依据

本文所有 PostgreSQL 与 Drizzle ORM 相关结论均取自下列官方文档（经 context7 拉取），并已在真实 PostgreSQL 18.6 实例上实测（§17）。

### 19.1 PostgreSQL 18

- [Generated Columns](https://www.postgresql.org/docs/18/ddl-generated-columns.html)：`STORED` / `VIRTUAL`；用户定义类型不支持虚拟生成列。
- [Constraints](https://www.postgresql.org/docs/18/ddl-constraints.html)：CHECK、UNIQUE、复合外键、列清单式 `ON DELETE SET NULL (col)`、可延迟约束、`NOT NULL` 具名。
- [ALTER TABLE](https://www.postgresql.org/docs/18/sql-altertable.html)：`ADD table_constraint [ NOT VALID]`、`VALIDATE CONSTRAINT`；**无** `ALTER CONSTRAINT … SET NOT VALID`。
- [Row Security Policies](https://www.postgresql.org/docs/18/ddl-rowsecurity.html)：默认拒绝、`FORCE ROW LEVEL SECURITY`、`BYPASSRLS`、`PERMISSIVE` / `RESTRICTIVE`。
- [Explicit Locking](https://www.postgresql.org/docs/18/explicit-locking.html)：表 13.3 锁冲突矩阵（`FOR UPDATE` 与 `FOR KEY SHARE` 冲突）；[Advisory Locks](https://www.postgresql.org/docs/18/explicit-locking.html#ADVISORY-LOCKS)：`pg_advisory_xact_lock`。
- [CREATE TRIGGER](https://www.postgresql.org/docs/18/sql-createtrigger.html)：`CONSTRAINT TRIGGER`、`DEFERRABLE INITIALLY DEFERRED`；PG 18 的 `AFTER` 触发器以入队时角色执行。
- [CREATE FUNCTION](https://www.postgresql.org/docs/18/sql-createfunction.html)：`SECURITY DEFINER`、`SET search_path`、属主权限。
- [CREATE VIEW](https://www.postgresql.org/docs/18/sql-createview.html)：`security_invoker`。
- [CREATE INDEX](https://www.postgresql.org/docs/18/sql-createindex.html)：`USING gist`；[btree_gist](https://www.postgresql.org/docs/18/btree-gist.html)。
- [ltree](https://www.postgresql.org/docs/18/ltree.html)：数字标签、`nlevel`、`subpath`、GiST 操作符类。
- [UUID Functions](https://www.postgresql.org/docs/18/functions-uuid.html)：`uuidv7()`。
- [GRANT](https://www.postgresql.org/docs/18/sql-grant.html)：列级权限与函数授权。
- [Error Codes](https://www.postgresql.org/docs/18/errcodes-appendix.html)：`23001`（`restrict_violation`）与 `23503`（`foreign_key_violation`）的区分。
- [Lock Management](https://www.postgresql.org/docs/18/runtime-config-client.html)：`lock_timeout`、`statement_timeout`、`idle_in_transaction_session_timeout`。
- [EXPLAIN](https://www.postgresql.org/docs/18/sql-explain.html)：PG 18 的 `ANALYZE` 自动输出 `BUFFERS`。
- [Backup and Upgrade](https://www.postgresql.org/docs/18/backup-upgrade.html)：PG 18 `initdb` 默认启用数据校验和，`pg_upgrade` 要求两端一致。

### 19.2 Drizzle ORM

|  |  |
| --- | --- |
- [Generated Columns](https://orm.drizzle.team/docs/column-types/pg)：`generatedAlwaysAs(sql, { mode: 'stored' | 'virtual' })`。
- [Custom Types](https://orm.drizzle.team/docs/advanced/custom-types)：`customType` 定义 `ltree`。
|  |  |
| --- | --- |
- [Indexes](https://orm.drizzle.team/docs/indexes)：`index().using('gist' | 'gin', ...)`、`uniqueIndex().on().where()`。
- [Composite Primary Keys](https://orm.drizzle.team/docs/primary-keys) 与 [Foreign Keys](https://orm.drizzle.team/docs/foreign-keys)：`primaryKey()`、`foreignKey({ columns, foreignColumns })`。
- [Row Level Security](https://orm.drizzle.team/docs/rls)：`pgPolicy()` 的参数与限制（不生成 `FORCE`）。
- [Views](https://orm.drizzle.team/docs/views)：`pgView`、`.with({ securityInvoker: true })`。
- [Schemas](https://orm.drizzle.team/docs/schemas)：`pgSchema`。
- [drizzle-kit generate](https://orm.drizzle.team/docs/drizzle-kit-generate)：`--custom` 生成空迁移文件。
- [drizzle-zod](https://orm.drizzle.team/docs/zod)：`createInsertSchema` / `createSelectSchema` / `createUpdateSchema` 及其 refine 机制。

---

## 附录 A. 文档元信息

| 项 | 值 |
|---|---|
| 版本 | 1.2 |
| SDD 角色 | **Phase 1 设计产物**（spec-kit 流水线） |
| 上游文档 | `docs/requirements/functional.md` · `.specify/memory/constitution.md` |
| 下游产物 | `docs/verification/README.md` · `packages/db` Drizzle schema · `docs/architecture/data/schema.md` · `docs/architecture/data/schema.md` |
| 架构侧对应 | `docs/architecture/overview.md`（`ARCH-*` 编号，双向映射见 §18.1） |
| 基线 | PostgreSQL 18.6 + Drizzle ORM 0.45.4 |
| 表数量 | 22 |
| 外键数量 | 55（37 条有引用侧索引，18 条登记例外） |
| 触发器数量 | 42 |
| `app` 函数数量 | 16 |
| 视图数量 | 2 |
| RLS 策略数量 | 21（覆盖 22 张表，`organization_member` 用独立策略形式） |
| 规范编号数量 | 97（零悬空、零冲突） |
| 验收用例数量 | 53 |
| 修订记录 | 26 项 |
| PG 18 实测项 | 21 组 |
| 软约束 | 7 条（全部登记于 §7.2） |
