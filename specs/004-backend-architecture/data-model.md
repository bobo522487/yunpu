# Phase 1 Data Model: 后端架构收口与谱系核心数据落地

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-11-24

> 完整权威仍是 [`docs/architecture/data/schema.md`](../../docs/architecture/data/schema.md)。本文只记录本批次首次落地或相对文档的增量。冲突时以 `docs/` 为准并在实现中同步修订。

## 1. 范围

| 数据 | 动作 | 说明 |
| --- | --- | --- |
| `person` | 新建表 + 增量列 | 文档 §5.6 + `version` / 生卒便利字段 |
| `person_name` | 新建表 | 文档 §5.7；主姓名作显示名 |
| `person_relation` | 新建表 | 文档 §5.8；API 本批次只写 3 种 kind |
| `lineage_projection` | **新建加速表** | 非文档 `lineage`/`node`；见 §5 |
| `organization` / `project` / 认证表 | 复用 | 外键挂载点 |

不落地：`event`、`lineage`、`node`、媒体、谱文、文件夹。

## 2. 实体关系

```text
organization 1 ─── n project
project 1 ─── n person
person 1 ─── n person_name
person 1 ─── n person_relation (as from / to)
person 1 ─── 0..1 lineage_projection
```

## 3. `person`

| 字段 | 类型 | 空 | 说明 |
| --- | --- | --- | --- |
| `id` | `uuid` | 否 | `uuidv7()` |
| `organization_id` | `uuid` | 否 | 租户 |
| `project_id` | `uuid` | 否 | 谱项目 |
| `sex` | `text` | 否 | `male` / `female` / `unknown` / `other`，默认 `unknown` |
| `surname` | `text` | 是 | 宗族姓；有值非空白 |
| `birth_year` | `int` | 是 | 本批次便利字段；公历年 |
| `death_year` | `int` | 是 | 本批次便利字段 |
| `is_living` | `boolean` | 否 | 默认 `true`；与 death_year 一致性由服务层软约束 |
| `version` | `int` | 否 | 默认 `1`；`> 0`；乐观锁 |
| `created_at` / `updated_at` | `timestamptz` | 否 | 触发器维护 `updated_at` |

- `PRIMARY KEY (project_id, id)`；`UNIQUE (organization_id, id)` 若沿用租户外壳复合键惯例则按现网 project 模式对齐。
- 复合外键 `(organization_id, project_id) → project(organization_id, id)`。
- RLS：`ENABLE` + `FORCE`；谓词 `organization_id = ANY (app.visible_org_array())`。
- 物理删除；`ON DELETE` 策略：姓名/关系/投影随人物清除（见下）。

## 4. `person_name`

沿用文档 §5.7。本批次保证：创建人物时至少一条 `is_primary=true` 的姓名，其 `value` 即 API「显示名」。

- `ON DELETE CASCADE` from person。
- 每人最多一个 primary（部分唯一索引）。

## 5. `person_relation`

沿用文档 §5.8 列与 7 种 `kind` CHECK。本批次写入限制：

| kind | API 本批次 | 防环 | 父母基数 |
| --- | --- | --- | --- |
| `biological_parent` | 是 | 是 | 对 **to** 端计数 ≤2 |
| `adoptive_parent` | 是 | 是 | 对 **to** 端计数 ≤2 |
| `spouse` | 是 | 否 | 无序对唯一，`from < to` |
| 其余 4 种 | 否（DB 允许、API 拒绝） | 按文档 | — |

方向约定（父母类）：`from` = 父母，`to` = 子女。

执行者：

- 自环 / 配偶序 / kind 域：DB CHECK
- 同向同 kind 唯一：`UNIQUE (project_id, from, to, kind)`
- 祖先环：`GX001` 延迟触发器（仅世系父边）
- 父母 ≤2：服务层计数 + 集成测试（软约束登记）

删除：物理删除单边；删人物时级联删除其作为 from/to 的全部边。

## 6. `lineage_projection`

| 字段 | 类型 | 空 | 说明 |
| --- | --- | --- | --- |
| `organization_id` | `uuid` | 否 | |
| `project_id` | `uuid` | 否 | |
| `person_id` | `uuid` | 否 | PK 与 person 对齐 |
| `primary_path` | `ltree` | 否 | 主路径加速 |
| `generation` | `int` | 否 | 可由 path 导出；显式存储便于过滤 |
| `updated_at` | `timestamptz` | 否 | |

- `PRIMARY KEY (project_id, person_id)`；FK → person，`ON DELETE CASCADE`
- GiST 索引于 `(project_id, primary_path)`（需 `btree_gist` / `ltree`）
- **永不单独作为真相源**；仅父母类边变更时同事务刷新；配偶边不改 path
- RLS 同业务表 FORCE

## 7. 不变量与执行者

| ID | 不变量 | 执行者 |
| --- | --- | --- |
| INV-01 | 租户数据只能经绑定 org 的事务访问 | `withTenantTransaction` + RLS |
| INV-02 | 业务表 FORCE RLS | 迁移 SQL + `pg_class` 测试 |
| INV-03 | 世系父边无环 | DB 触发器 `GX001` |
| INV-04 | 配偶无向唯一 | CHECK `from < to` + UNIQUE |
| INV-05 | 血亲/收养父母各 ≤2 | 服务层 + 测试 |
| INV-06 | 投影与边同事务一致 | 写路径编排 + 回滚测试 |
| INV-07 | 人物更新乐观锁 | `version` 条件更新 → 409 |
| INV-08 | 物理删除无软删列 | 表定义无 `deleted_at` |

## 8. 状态 / 生命周期

- 人物 / 边：无状态机；存在即有效；删除即物理删除。
- 投影：随边变更重算或删除；无独立生命周期 API。

## 9. 扩展前提（非本批次）

- `ltree` + `btree_gist` 扩展须在业务迁移中创建（文档已列迁移前置）。
- 完整 `lineage`/`node`、事件生卒权威化、其余 relation kind 的产品 API → 后续批次。
