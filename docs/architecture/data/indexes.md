# 索引策略与 EXPLAIN 口径

> 本文件是「索引清单与查询验证口径」的唯一权威；其他主题见 `docs/README.md` 导航，同一主题不复制表格。

## 11. 索引清单

索引由查询模式决定（`DM-IDX-01`：不设机械规则）。本清单中所有内容表索引以 `project_id` 开头，因为查询永远先按 project 收敛——这来自查询模式，不是形式规则。

### 11.1 索引全表

| 索引 | 表 | 列 | 用途 |
|---|---|---|---|
| `idx_organization_owner` | organization | `owner_user_id` | owner 查询 |
| `idx_organization_member_user` | organization_member | `user_id` | `visible_org_array()` |
| `uq_invite_pending_email`（部分） | invite | `organization_id, email` WHERE `status='pending'` | 同邮箱单条 pending |
| `uk_invite_token_hash` | invite | `token_hash` | token 查询 |
| `idx_invite_org_status` | invite | `organization_id, status` | 组织邀请列表 |
| `idx_invite_invited_by` | invite | `invited_by` | 「我发出的邀请」 |
| `idx_project_org_status` | project | `organization_id, status` | 组织项目列表 |
| `idx_folder_project_seq` | folder | `project_id, seq` | 分类排序 |
| `idx_folder_folder_ref` | folder | `project_id, id` | 自引用 |
| `idx_person_project_surname`（部分） | person | `project_id, surname` WHERE `surname IS NOT NULL` | 姓氏筛选 |
| `uq_person_name_primary`（部分） | person_name | `project_id, person_id` WHERE `is_primary` | 每人一个主显示名 |
| `uk_person_name_value` | person_name | `project_id, person_id, kind, value` | 同人同类型同值唯一 |
| `idx_person_name_person` | person_name | `project_id, person_id` | 人物姓名列表 |
| `uk_person_relation_kind` | person_relation | `project_id, from_person_id, to_person_id, kind` | 通用关系去重 |
| `idx_person_relation_from` | person_relation | `project_id, from_person_id, kind` | 出向查询 / 环检查 |
| `idx_person_relation_to` | person_relation | `project_id, to_person_id, kind` | 入向查询 |
| `idx_event_person`（部分） | event | `project_id, person_id, kind` | 人物事件 |
| `idx_event_relation`（部分） | event | `project_id, relation_id, kind` | 关系事件 |
| `idx_event_date` | event | `project_id, date_start` | 时间筛选 |
| `idx_lineage_project_seq` | lineage | `project_id, seq` | 谱系排序 |
| `idx_lineage_folder` | lineage | `project_id, folder_id` | 分类引用 |
| `uk_node_path` | node | `project_id, lineage_id, path` | 同 Lineage 路径唯一（即时约束，重排须单语句） |
| `node_path_gist` | node | GiST `(project_id, lineage_id, path)` | 子树 / 祖先查询 |
| `idx_node_parent` | node | `project_id, lineage_id, parent_path` | 按父路径查子节点；`fk_node_parent` 的支撑索引 |
| `idx_node_person` | node | `project_id, person_id` | 人物编纂位置 |
| `idx_node_placement_relation`（部分） | node | `project_id, placement_relation_id` | `fk_node_placement_relation` 的支撑索引 |
| `uq_node_one_primary`（部分） | node | `project_id, lineage_id, person_id` WHERE `kind='primary'` | 每人每 Lineage 一个 primary |
| `idx_source_project_kind` | source | `project_id, kind` | 来源分类 |
| `idx_source_citation_source` | source_citation | `project_id, source_id` | 来源引用列表 |
| `idx_source_citation_person`（部分） | source_citation | `project_id, person_id` | 人物引用 |
| `idx_source_citation_person_name`（部分） | source_citation | `project_id, person_name_id` | 姓名引用 |
| `idx_source_citation_relation`（部分） | source_citation | `project_id, relation_id` | 关系引用 |
| `idx_source_citation_event`（部分） | source_citation | `project_id, event_id` | 事件引用 |
| `idx_source_citation_media`（部分） | source_citation | `project_id, media_asset_id` | 扫描件引用 |
| `idx_article_project_kind` | article | `project_id, kind` | 谱文分类 |
| `idx_article_subject`（部分） | article | `project_id, subject_person_id` | 人物相关文章 |
| `idx_article_lineage`（部分） | article | `project_id, lineage_id` | 谱系引用 |
| `idx_article_folder` | article | `project_id, folder_id` | 分类引用 |
| `uk_article_page_seq` | article_page | `project_id, article_id, seq` | 同篇页序唯一 |
| `idx_article_page_article` | article_page | `project_id, article_id, seq` | 页列表 |
| `uk_media_asset_object_key` | media_asset | `object_key` | 对象 key 全局唯一 |
| `idx_media_asset_project_created` | media_asset | `project_id, created_at` | 媒体列表 |
| `idx_media_asset_created_by`（部分） | media_asset | `created_by` | `fk_media_asset_created_by` 的支撑索引 |
| `idx_person_media_media` | person_media | `project_id, media_asset_id` | 删除检查 |
| `idx_article_page_media_media` | article_page_media | `project_id, media_asset_id` | 删除检查 |
| `idx_book_project_created` | book | `project_id, created_at` | 谱书列表 |
| `idx_book_folder` | book | `project_id, folder_id` | 分类引用 |
| `uk_book_catalog_path` | book_catalog | `project_id, book_id, path` | 同书路径唯一 |

| `book_catalog_path_gist` | book_catalog | GiST `(project_id, book_id, path)` | 编目子树 |
| `idx_book_catalog_parent` | book_catalog | `project_id, book_id, parent_path` | 按父路径查子项；`fk_book_catalog_parent` 的支撑索引 |
| `idx_book_catalog_article`（部分） | book_catalog | `project_id, article_id` | 文章引用 |
| `idx_book_catalog_lineage`（部分） | book_catalog | `project_id, lineage_id` | 谱系引用 |
| `uk_book_release_version` | book_release | `project_id, book_id, version` | 同书版本唯一 |
| `idx_book_release_book` | book_release | `project_id, book_id, created_at` | 版本列表 |
| `idx_book_release_created_by`（部分） | book_release | `created_by` | `fk_book_release_created_by` 的支撑索引 |
| `idx_audit_log_org_created` | audit_log | `organization_id, created_at` | 组织审计 |
| `idx_audit_log_project_created`（部分） | audit_log | `project_id, created_at` | 项目审计 |
| `idx_audit_log_entity` | audit_log | `entity_type, entity_id` | 按实体追溯 |

**v1.2 补齐的三处缺失**（1.1 版 §11 清单与实际 DDL 不一致）：

| 缺失索引 | 表 | 为什么必须存在 |
|---|---|---|
| `uk_folder_name` | folder | 同项目内分类名唯一（1.1 只在正文提到，索引清单漏列） |
| `uk_lineage_name` | lineage | 同项目内谱系名唯一（同上） |
| `idx_node_placement_relation` | node | `fk_node_placement_relation` 的引用侧支撑索引（`DM-GEN-17`） |

**已删除的索引**（1.1 变更）：`uq_person_relation_sort_order` —— 展示顺序不是事实，唯一约束会制造 O(n) 重排工作，且在对称关系上语义不成立（`DM-REL-04`）。查询改为按 `(sort_order NULLS LAST, id)` 排序。

不要为预期规模提前建索引；用 `EXPLAIN (ANALYZE)` 验证实际查询，再决定是否增加。

### 11.2 FK → 索引覆盖表（`DM-GEN-17`）

**PostgreSQL 不会为外键的引用侧自动建索引。** 缺索引的后果是：删除或更新被引用行时，数据库要对引用表做全表扫描（`SELECT ... FROM child WHERE fk_col = $1 FOR KEY SHARE`）。表越大越慢，而且这种慢是**在删除操作的锁持有期间**发生的，会放大阻塞。

本表由 `db/verify/fk_indexes.sql` 自动生成并断言，逐条对应 `pg_constraint.conkey` 与 `pg_index.indkey` 的前缀匹配。**实测（§17 #14）：55 条外键中 37 条有支撑索引，18 条无。**

**已覆盖（37 条，无需动作）**：

`fk_organization_member_org`、`fk_organization_member_user`、`fk_invite_org`、`fk_invite_invited_by`、`fk_project_org`、`fk_person_name_person`、`fk_person_relation_from`、`fk_person_relation_to`、`fk_event_person`、`fk_event_relation`、`fk_lineage_folder`、`fk_node_lineage`、`fk_node_parent`、`fk_node_person`、`fk_node_placement_relation`、`fk_source_citation_source`、`fk_source_citation_person`、`fk_source_citation_pname`、`fk_source_citation_relation`、`fk_source_citation_event`、`fk_source_citation_media`、`fk_article_folder`、`fk_article_lineage`、`fk_article_subject_person`、`fk_article_page_article`、`fk_media_asset_created_by`、`fk_person_media_person`、`fk_person_media_media`、`fk_article_page_media_page`、`fk_article_page_media_media`、`fk_book_folder`、`fk_book_catalog_book`、`fk_book_catalog_article`、`fk_book_catalog_lineage`、`fk_book_catalog_parent`、`fk_book_release_book`、`fk_book_release_created_by`

**未覆盖（18 条，v1.2 显式决策：建索引 vs. 记录理由）**：

| 外键 | 表 | 引用列 | 决策 | 理由 |
|---|---|---|---|---|
| `fk_folder_project` | folder | `organization_id, project_id` | **不建** | Project 删除是低频、需显式预览的操作；建 18 个 `(organization_id, project_id)` 复合索引会让每个 Project 下的每张表多一个索引，代价（写放大、维护成本）大于收益（删除时的扫描） |
| `fk_person_project` | person | 同上 | **不建** | 同上 |
| `fk_person_name_project` | person_name | 同上 | **不建** | 同上 |
| `fk_person_relation_project` | person_relation | 同上 | **不建** | 同上 |
| `fk_event_project` | event | 同上 | **不建** | 同上 |
| `fk_lineage_project` | lineage | 同上 | **不建** | 同上 |
| `fk_node_project` | node | 同上 | **不建** | 同上 |
| `fk_source_project` | source | 同上 | **不建** | 同上 |
| `fk_source_citation_project` | source_citation | 同上 | **不建** | 同上 |
| `fk_article_project` | article | 同上 | **不建** | 同上 |
| `fk_article_page_project` | article_page | 同上 | **不建** | 同上 |
| `fk_media_asset_project` | media_asset | 同上 | **不建** | 同上 |
| `fk_person_media_project` | person_media | 同上 | **不建** | 同上 |
| `fk_article_page_media_project` | article_page_media | 同上 | **不建** | 同上 |
| `fk_book_project` | book | 同上 | **不建** | 同上 |
| `fk_book_catalog_project` | book_catalog | 同上 | **不建** | 同上 |
| `fk_book_release_project` | book_release | 同上 | **不建** | 同上 |
| `fk_organization_owner` | organization | `id, owner_user_id` | **不建** | 引用侧是 `organization_member (organization_id, user_id)`，其主键 `(organization_id, user_id)` 已天然覆盖前导列 `organization_id`；而 `id` 是 `organization` 自身主键。删除成员时该 FK 检查走 `organization_member` 主键索引，无全表扫描 |

> **这是一个显式决策，不是遗漏。** 决策依据：① `fk_*_project` 的引用侧列是 `(organization_id, project_id)`，而 `project` 表在每个租户内只有几十上百行；② 触发全表扫描的前提是「删 Project」，而本模型的纪律是**删除 Project 必须显式预览和确认**，是罕见操作；③ 建 17 个复合索引会让所有内容表的写路径多维护一个索引。
>
> **复评条件（写入 §14 的复评清单）**：若产品支持「一键删除整个 Project」且 Project 内容表行数超过 10 万，则必须补建这 17 个索引。届时以本表为改动清单。

### 11.3 GiST 复合索引的设计说明

`node_path_gist` 与 `book_catalog_path_gist` 都是 `gist (project_id, <uuid>, path)` 的三列复合索引。

- `ltree` 原生有 GiST 操作符类；`uuid` 没有，因此需要 **`btree_gist`** 扩展把 uuid 纳入 GiST。
- 有了 `btree_gist`，`uuid` 列可以作为 GiST 索引的前导列，从而在同一个索引里同时过滤「哪个 Project / 哪个谱系」和「路径子树」。
- **实测（§17 #12）**：`EXPLAIN` 显示 `Index Scan using node_path_gist on node`，`Index Cond: ((project_id = ...) AND (lineage_id = ...) AND (path <@ '0020'))`——**三列条件全部下推为 Index Cond**，没有额外的 Filter 行。这正是复合 GiST 想要的形状。
- 若只建 `gist (path)`，则 `project_id` / `lineage_id` 只能作为回表后的 Filter，扫描量放大到整个实例的所有节点。

### 11.4 测量方法（v1.2 修正）

`DM-GEN-10` 规定「先测量再优化」，PG 18 让测量工具本身变强了：

| 变化 | PG 17 及以前 | **PG 18** | 本模型的处理 |
|---|---|---|---|
| `EXPLAIN ANALYZE` 的缓冲区信息 | 必须显式加 `BUFFERS` | **自动包含 `BUFFERS`** | 统一写 `EXPLAIN (ANALYZE)`，不再手写 `BUFFERS` |
| 多列 B-tree 首列缺失 | 索引不可用 | 支持 **skip scan**，可能仍命中 | `(project_id, X)` 的索引在首列未约束时**可能**被用于 `X` 的查找，因此不能仅凭「首列缺失」断定索引无效，必须看实际计划 |
| `initdb` 默认 | 无数据校验和 | **默认启用数据校验和** | `pg_upgrade` 要求两端校验和设置一致，部署文档需写明 |

**实测（§17 #13）**：`EXPLAIN (ANALYZE, TIMING off, COSTS off) SELECT count(*) FROM person;` 的输出中，`Aggregate`、`Seq Scan on person`、`Planning` 三个节点**各自**都带 `Buffers: shared hit=1`——确认 PG 18 的 `ANALYZE` 已自动输出缓冲区信息。

---
