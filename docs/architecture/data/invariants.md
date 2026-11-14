# 不变量、软约束与删除语义

> 本文件是「关键不变量、软约束登记表与删除语义」的唯一权威；其他主题见 `docs/README.md` 导航，同一主题不复制表格。

## 7. 关键不变量与执行者

**没有执行者的约束不是约束**（`DM-GEN-01`）。下表每条都必须能在数据库或测试里被指出。「类型」列区分 DB 级强制与软约束。

### 7.1 不变量表

| # | 不变量 | 执行者 | 类型 | 编号 |
|---|---|---|---|---|
| 1 | 跨 Organization 不可见 | RLS + `app.visible_org_array()` | DB | `DM-TEN-01` |
| 2 | 每条内容属于唯一 Organization / Project | `(organization_id, project_id)` 复合外键 | DB | `DM-SCP-02` |
| 3 | 不存在跨 Project 引用 | 所有实体外键带 `project_id` | DB | `DM-SCP-03` |
| 4 | 每个 Organization 恰好一个 owner | `organization.owner_user_id NOT NULL` | DB | `DM-ORG-01` |
| 5 | owner 必须是成员 | `fk_organization_owner` 复合外键 | DB | `DM-ORG-02` |
| 6 | 不能删除 owner 的成员行 | 外键 `ON DELETE RESTRICT` | DB | `DM-ORG-03` |
| 7 | 每人最多一个主姓名 | `uq_person_name_primary` | DB | `DM-NAM-01` |
| 8 | 关系两端同 Project、不同人物 | 两个复合外键 + `CHECK (from <> to)` | DB | `DM-REL-08` |
| 9 | 同一对人物同一 kind 不重复 | `UNIQUE (project_id, from, to, kind)` | DB | `DM-REL-09` |
| 10 | 对称关系只有一种物理表示 | `CHECK (kind NOT IN (...) OR from < to)` | DB | `DM-REL-03` |
| 11 | 世系父边不能形成环（含反向二元环） | advisory lock + 延迟递归 CTE 触发器 | DB | `DM-REL-01` / `DM-REL-05` |
| 12 | 非世系关系不参与环检查 | `app.relation_kind_is_lineage_parent()` | DB | `DM-REL-10` |
| 13 | Event 恰好关联 Person 或 Relation | `CHECK (num_nonnulls(...) = 1)` | DB | `DM-EVT-02` |
| 14 | Event 类型属于对应域 | 两个域 CHECK | DB | `DM-EVT-03` |
| 15 | Event 日期范围有序 | `CHECK (date_start <= date_end)` | DB | `DM-EVT-04` |
| 16 | Event 至少有一项非空白内容 | `btrim` 三值 OR CHECK | DB | `DM-EVT-01` |
| 17 | Node 的 path 唯一、格式合法 | `UNIQUE` + 正则 CHECK | DB | `DM-NOD-02` |
| 18 | Node 的父路径存在且严格更短（结构性无环） | STORED 生成列 + 延迟自引用外键 | DB | `DM-NOD-03` |
| 19 | 每人每 Lineage 最多一个 primary | `uq_node_one_primary` | DB | `DM-NOD-04` |
| 20 | annotation 无人物，人物节点有 Person | `CHECK ((kind='annotation') = (person_id IS NULL))` | DB | `DM-NOD-05` |
| 21 | 根是顶层节点 | 结构事实：`parent_path IS NULL` | DB | `DM-NOD-06` |
| 22 | 租户和 Project scope 不可迁移 | `app.guard_scope_immutable()` | DB | `DM-SCP-01` |
| 23 | `object_key` 物理唯一 | 全局 `UNIQUE (object_key)` | DB | `DM-MED-03` |
| 24 | 邀请 token 唯一、只存哈希、熵 ≥ 256 bit | `UNIQUE (token_hash)` + 32 字节 CHECK + 生成器 | DB + 生成器 | `DM-INV-01` |
| 25 | 同邮箱单条待处理邀请 | `uq_invite_pending_email` | DB | `DM-INV-04` |
| 26 | 邀请状态与时间一致 | 双蕴含 CHECK | DB | `DM-INV-05` |
| 27 | 邀请只能被本人兑换一次 | 条件 UPDATE 抢占 + `IS DISTINCT FROM` 邮箱比对 | DB | `DM-INV-02` / `DM-INV-03` |
| 28 | 出版快照不可修改 | 权限回收 + `app.guard_book_release_snapshot()` | DB | `DM-BOK-01` |
| 29 | 出版记录不可直接删除 | `REVOKE UPDATE, DELETE` + 受控函数 | DB | `DM-BOK-02` |
| 30 | Book 有 release 时不能删除 | 外键 `ON DELETE RESTRICT` | DB | `DM-BOK-03` |
| 31 | `audit_log` 只追加 | 权限回收 + `app.guard_append_only()` | DB | `DM-AUD-02` |
| 32 | 强审计路径的写操作必留痕 | 受控函数内 `INSERT audit_log` | DB | `DM-AUD-01` |
| 33 | `article_page.content` 至少含 `type` | 合法默认值 + CHECK | DB | `DM-ART-01` |
| 34 | `updated_at` 自动推进且严格递增 | `app.touch_updated_at()`（`clock_timestamp()`） | DB | `DM-GEN-15` |
| 35 | 媒体引用存在、同 Project | 复合外键 | DB | `DM-MED-04` |
| 36 | 每个对象字节有唯一主人 | `media_asset` / `book_release` 行 + 提交后删除纪律 | DB + 流程 | `DM-MED-01` |
| 37 | 编目项类型与内容引用匹配 | `ck_book_catalog_content_match` | DB | `DM-BOK-04` |
| 38 | 展示顺序不唯一 | 测试：排序断言固定 `ORDER BY (sort_order, id)` 顺序 | 测试 | `DM-REL-04` |
| 39 | Node 编排依据的语义正确 | Use Case + 测试 | App | `DM-NOD-07` |
| 40 | 组织归档后禁止新写入 | Use Case 检查 `organization.status` | App | `DM-ORG-05` |
| 41 | 成员角色授权 | Service 层角色检查（矩阵单一来源） | App | `DM-ORG-07` |
| 42 | Relation 类型与 Event 类型匹配 | Use Case + 测试 | App | `DM-EVT-05` |
| 43 | Person 物理清除（GDPR） | 测试：V1 不做；`DM-PURGE-01` 已在 §7.2 登记并附补偿用例 | 测试 | `DM-PURGE-01` |
| 44 | 所有外键的引用侧列有支撑索引 | 索引清单 + `db/verify/fk_indexes.sql` | DB | `DM-GEN-17` |
| 45 | 错误按 SQLSTATE + 约束名映射 | 应用层错误映射表 | App | `DM-GEN-18` |
| 46 | 清单类内容由生成物产出并反向校验 | `gen-sql.ts` + `db/verify/tables.sql` | DB + CI | `DM-GEN-19` |
| 47 | 不依赖数据库默认值（生成列显式 `STORED` 等） | DDL 审查 + `db/verify/generated_columns.sql` | DB | `DM-GEN-20` |
| 48 | 编号唯一且可追溯 | 测试：`scripts/check-docs.sh --strict` 的 R4/R5/R7 | 测试 | `DM-GEN-21` |
| 49 | 关系表 kind 取值单一来源 | 枚举生成器 | DB | `DM-REL-12` |
| 50 | 世系写锁不阻塞同 Project 其他写入 | advisory lock 语义 + 并发测试 | DB | `DM-REL-11` |

`CHECK` 只验证当前行，不查询其他行。跨行图规则、跨表语义、角色授权必须用唯一约束、外键、触发器或用例；不用 `CHECK` 假装。

### 7.2 软约束登记表（`DM-GEN-16`）

**软约束不是垃圾桶。** 每一条软约束必须在此登记，并写明补偿手段（用例 / 测试）。未登记的软约束视为文档缺陷。

| 编号 | 软约束 | 为什么 DB 不做 | 补偿手段 | 验收 |
|---|---|---|---|---|
| `DM-ORG-05` | 组织归档后禁止新写入 | 需要跨表查 `organization.status`，放触发器会让每次写入都多一次锁与查表；且归档是低频事件 | Use Case 层检查 | #38 |
| `DM-ORG-07` | 成员增删改的角色授权；`last_used_at` 只由当前用户自己的成员行更新 | 「谁能改成员」与「谁在切换自己的默认组织」是业务规则，不是结构规则 | Service 层角色矩阵（单一来源）+ `user_id = app.current_user_id()` 条件更新 | #41 |
| `DM-EVT-05` | Relation 类型与 Event 类型匹配（`marriage` 只挂 `spouse`/`partner`） | 跨表语义推断 | Use Case + 测试 | #42 |
| `DM-NOD-07` | `placement_relation_id` 的语义正确性 | 跨表语义推断 | Use Case + 测试 | #39 |
| `DM-PURGE-01` | Person 物理清除（GDPR） | V1 不做 | 独立运维流程 + 审计 | — |
| `DM-MED-05` | 对象字节在事务提交后删除 | 跨系统事务，无两阶段提交 | 应用层提交后回调 + 对账脚本 | #34 / #26 |
| [`DM-AUD-01`](./schema.md) | 尽力而为审计路径 | 「大家记得调」不是约束 | 指标 `audit_write_failures_total` + 告警 | #32 |
| 待验证（PG 18） | PG 18 语义、D1–D12 与 21 组结论 | 本机无 `psql` / `pg_ctl`，无法复现 | `docs/verification/README.md` 复现步骤 + `scripts/check-docs.sh --strict` 门禁 | 待验证 |
| 索引覆盖例外（18 条） | 55 条外键中 18 条引用侧无支撑索引 | 建索引需按真实查询模式先测量（Article IX） | `indexes.md` §11.2 白名单逐条给理由 + `SC-INT-03` 断言未登记例外 = 0 | #44 |

> **PG 18 结论降级登记（用户 2026-11-13 决策）**：本机无 `psql` / `pg_ctl`，`docs/decisions/0001-pg18-defects.md` 的 D1–D12 与 21 组 PG 18 结论全部标为待验证，本文档不保留以完成口吻陈述的验证断言；复现步骤见 `docs/verification/README.md`，补偿手段是 `scripts/check-docs.sh --strict` 门禁与目标仓库真实 PG 18 复现，通过后再升级为「已验证」。

---

## 10. 删除语义

**默认 `ON DELETE RESTRICT`。** 只有明确从属的数据才 `CASCADE`；`SET NULL` 只用于可选的分类引用。

| 操作 | 结果 | 相关外键动作 |
|---|---|---|
| 归档 Organization | `UPDATE status='archived'`；数据保留；新写入由服务层拦截（`DM-ORG-05`）；**归档是业务状态，不替代删除** | 服务层 |
| 删除 Organization | 服务层按依赖顺序显式清理后物理删除（`DM-PURGE-01`）；归档不是删除的替代 | `fk_*_org` 均 `RESTRICT` |
| 删除账号 | `organization_member.user_id` → `RESTRICT`；先转移 owner、处理成员身份 | `fk_organization_member_user` `RESTRICT` |
| 删除 Project | 有任何内容或 release 时拒绝；按依赖顺序显式清理 | `fk_*_project` 均 `RESTRICT` |
| 删除 Folder | 只把 `article/lineage/book.folder_id` 置 NULL；`project_id` 不动 | `ON DELETE SET NULL (folder_id)` |
| 删除 Lineage | 级联删除 `node`；`book_catalog` 引用时拒绝；Person / Relation / Event / Source 不受影响 | `fk_node_lineage` `CASCADE`；`fk_article_lineage`、`fk_book_catalog_lineage` `RESTRICT` |
| 删除 Node | 删除子树（显式事务）；不删除 Person / Relation / Event / PersonName | `fk_node_parent` 自引用 `NO ACTION`（延迟） |
| 删除 Person | 先清理 Relation / Node / Event / SourceCitation / Article 引用；`person_name` / `person_media` 随人物级联；有 citation 的姓名会阻止 | `fk_person_name_person`、`fk_person_media_person` `CASCADE`；其余 `RESTRICT` |
| 删除 PersonName | 被 Citation 引用时拒绝 | `fk_source_citation_pname` `RESTRICT` |
| 删除 PersonRelation | 被 Event / SourceCitation / Node 编排依据引用时拒绝；不删除两端 Person | `fk_event_relation`、`fk_source_citation_relation`、`fk_node_placement_relation` 均 `RESTRICT` |
| 删除 Event | 被 Citation 引用时拒绝 | `fk_source_citation_event` `RESTRICT` |
| 删除 Source | 被 Citation 引用时拒绝 | `fk_source_citation_source` `RESTRICT` |
| 删除 Article | 被 BookCatalog 引用时拒绝；`article_page` / `article_page_media` 级联；对象字节在提交后清理 | `fk_article_page_article` `CASCADE`；`fk_book_catalog_article` `RESTRICT` |
| 删除 MediaAsset | 被 `person_media` / `article_page_media` / `source_citation` 引用时拒绝；无引用后才删除对象字节 | 三处均 `RESTRICT` |
| 删除 Book | 存在任何 `book_release`（无论是否作废）时拒绝；全部 purge 后可删；`book_catalog` 级联 | `fk_book_release_book` `RESTRICT`；`fk_book_catalog_book` `CASCADE` |
| 删除 BookRelease | **不可直接删除**；先 `revoke`，再由 owner `purge`；字节在提交后删除 | `REVOKE DELETE` + `app.purge_book_release()` |
| 修改 AuditLog | **不可修改、不可删除** | `REVOKE UPDATE, DELETE` + `app.guard_append_only()` |

**v1.2 澄清的两点**：

1. **`ON DELETE SET NULL (folder_id)` 用的是列清单式**（PG 15+ 语法），不是整行置空。`folder_id` 被置 NULL，但同一行的 `organization_id` / `project_id` 保持不变——否则会破坏 scope 不变量（`DM-SCP-01`）。这一语法需在 PG 18 上复现验证（§17 #18），结论待验证。
2. **`fk_node_parent` 与 `fk_book_catalog_parent` 是自引用外键**，未声明 `ON DELETE`，即默认 `NO ACTION`；配合 `DEFERRABLE INITIALLY DEFERRED`，删除一整棵子树时必须**在单个事务内**完成，否则中途提交会因「父行已删、子行还在」而被拒绝。

**关键纪律**：

- **Node 是编纂位置，不拥有 Person**；删除谱系或节点不得自动清理「当前没有 Node 引用」的人物。
- **Relation 是人物关系事实，不拥有 Person**；删除关系不删除人物。
- **对象存储字节在数据库提交后清理**；先删对象再提交会产生悬空引用（`DM-MED-05`）。
- **物理删除 Project 前必须显式预览和确认**；不以大范围 `CASCADE` 代替业务删除流程。
- V1 不提供 Person 物理清除（GDPR）；需要时走独立运维流程，逐表清理并写审计（`DM-PURGE-01`）。
- **`RESTRICT` 的报错是 `23001`**（PG 18），不是 `23503`。应用层按 §9.4 映射（`DM-GEN-18`）。

---
