# 云谱数据模型 1.2（PG 18 / Drizzle 官方规范重构版）

> **状态**：数据层唯一权威基线。  
> **技术基线**：PostgreSQL 18 + Drizzle ORM；所有主键默认 `uuidv7()`。  
> **范围**：实体、字段、约束、索引、关键不变量、RLS 与权限、删除语义、Drizzle 落地边界。  
> **不在范围**：API 形状、UI、部署、计费。  
> **规格编号**：`DM-<域>-<序号>`。编号一旦发布不复用；被废弃的规格标 `已废弃` 并保留编号。  
> **上游**：[`spec.md`](./spec.md) 定义做什么与验收标准；[`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) 是最高约束。  
> **架构侧对应**：[`plan.md`](./plan.md) 只定义边界与归属；本文定义数据结构与执行者。冲突时以本文为准（plan.md §1.5）。  
> **SDD 角色**：**Phase 1 设计产物**（spec-kit 流水线）。下游是 [`tasks.md`](./tasks.md) 与 `packages/db` 的 Drizzle schema。  
> **本版**：1.2 —— 按 PostgreSQL 18 与 Drizzle ORM 官方文档重构。全部结论在真实 PostgreSQL 18.0 实例上实测（§17）。

---

## 0. 摘要

人物是事实，关系是事实，节点是编纂位置；来源是证据，谱书是交付物。数据库只保存事实与位置，派生关系、家庭视图、世次都在查询时算。

**本文的写法约定**（SDD 规范）：

1. 每一条可验证的规范都带编号，写成「规范陈述 + 执行者 + 验证方式」三段式。
2. **没有执行者的约束不是约束**（`DM-GEN-01`）。标不出执行者的条目一律删除，不留在文档里当愿望。
3. **同一规则只允许一份来源**（`DM-GEN-02`）。枚举、角色权限矩阵、表清单由单一常量文件生成，其余位置引用生成物。
4. 规范之间不允许互相否定。规则冲突比没有规则更糟——执行者不知道该听谁的（`DM-GEN-03`）。
5. 验收清单写成 Given/When/Then，可直接落成测试用例。
6. **编号必须唯一且可追溯**（`DM-GEN-21`）。每个编号在附录 §18 只出现一次；引用编号必须在 §18 索引表中有定义。

### 0.1 v1.2 重构摘要

1.1 版的模型骨架（人物 / 关系 / 节点 / 来源 / 谱文 / 媒体 / 谱书）经审查**成立，保留不动**。本版重构的是三件事：

| 维度           | 动作                                | 结果                |
| ------------ | --------------------------------- | ----------------- |
| **规范编号**     | 全量重编 + 补齐悬空编号 + 消除一编号两义           | §18 编号索引表，零悬空、零冲突 |
| **PG 18 语义** | 逐条比对 PG18 官方文档，修正 8 处依赖旧版本默认行为的写法 | §2.1 PG18 语义差异表   |
| **约束完整性**    | 补齐缺失的外键、索引、权限、RLS 策略；修正 5 处真实缺陷   | §16 修订记录（26 项）    |

**本版不改变**：实体划分、表数量（22 张）、Project Scope 模型（`(organization_id, project_id)` 复合外键）、派生关系查询时计算的原则、删除语义的整体策略。

---

## 1. 设计原则（规范）

| 编号          | 规范                                                                | 执行者                                           | 验证方式                                 |
| ----------- | ----------------------------------------------------------------- | --------------------------------------------- | ------------------------------------ |
| `DM-GEN-01` | 每条不变量必须能指出执行者（DB 约束/触发器/服务层/测试）                                   | 文档评审                                          | §8 不变量表无「待定」行                        |
| `DM-GEN-02` | 枚举值、权限矩阵、表清单只有一份来源，其余由生成器产出                                       | `scripts/gen-sql.ts`                          | CI `gen:sql && git diff --exit-code` |
| `DM-GEN-03` | 规范之间不得互相否定；冲突以本表为准并同步修订                                           | 文档评审                                          | 验收清单第 30 条                           |
| `DM-GEN-04` | 事实只存一次，可推导的东西不落库                                                  | 复合外键 + 派生查询                                   | §8 不变量 #1–#3                         |
| `DM-GEN-05` | 能用列/约束/外键表达的规则，不写成应用层 if                                          | DB 约束                                         | §8 不变量表「类型」列                         |
| `DM-GEN-06` | 约束必须能在真实 PG 18 上稳定执行；需要解析 JSON 或靠自觉的，降级为软约束并显式声明                  | 集成测试                                          | §13 验收清单                             |
| `DM-GEN-07` | 视图不是第二真相源，只做只读投影，业务视图必须 `security_invoker`                        | `security_invoker = true`                     | 验收清单 #16                             |
| `DM-GEN-08` | 删除是一等公民，每个外键显式声明 `RESTRICT`/`CASCADE`/`SET NULL` 的业务含义            | 外键定义                                          | §10                                  |
| `DM-GEN-09` | 数据库不猜语义：姓名、日期、地名原文是证据，规范化值不得覆盖原文                                  | 列语义 + 服务层                                     | §5.6 / §5.9                          |
| `DM-GEN-10` | 先测量再优化：索引按查询模式建，用 `EXPLAIN (ANALYZE)` 验证                          | 索引清单                                          | §11                                  |
| `DM-GEN-11` | 约束保护事实，不保护排版。展示顺序类字段不做唯一约束                                        | 索引清单                                          | `DM-REL-04`                          |
| `DM-GEN-12` | 锁只加在真正需要串行化的写者上，不与外键检查隐含的锁冲突                                      | 触发器 + 事务                                      | `DM-REL-05`                          |
| `DM-GEN-13` | 约束必须具名                                                            | 外键/检查/唯一/外键定义                                 | §13.4 实测 #12                         |
| `DM-GEN-14` | 任何「非空文本」字段必须带 `btrim(x) <> ''`，纯空白不是内容                            | CHECK 约束                                      | §8 不变量 #17                           |
| `DM-GEN-15` | `updated_at` 由 DB 推进且**严格单调递增**（用 `clock_timestamp()`，不用 `now()`） | `app.touch_updated_at()`                      | §13.4 实测 #03                         |
| `DM-GEN-16` | 软约束必须登记在 §8.2「软约束登记表」并有补偿测试；软约束不是垃圾桶                              | 文档评审 + 用例                                     | 验收清单 #38                             |
| `DM-GEN-17` | 每条外键的引用侧列必须有支撑索引（PostgreSQL 不会自动建）                                | 索引清单                                          | §11 FK→索引覆盖表                         |
| `DM-GEN-18` | 应用错误按「SQLSTATE + 约束名」两级映射，**不解析消息文本**                             | 应用层                                           | §4.6 错误码表                            |
| `DM-GEN-19` | 清单类内容（表清单、枚举、RLS 策略矩阵、权限矩阵）必须由生成物产出并被反向校验                         | `scripts/gen-sql.ts` + `db/verify/tables.sql` | CI `gen:sql && git diff --exit-code` |
| `DM-GEN-20` | **不依赖数据库默认值**：凡默认值会随版本变化的语法，必须显式写出关键字                             | DDL 审查                                        | §13.4 实测 #01                         |
| `DM-GEN-21` | 编号唯一且可追溯：同一编号不得承载两条规则，引用编号必须有定义                                   | 文档评审                                          | §18 编号索引表                            |

---

## 2. 技术基线

| 项      | 选择                                              | 说明                                                         |
| ------ | ----------------------------------------------- | ---------------------------------------------------------- |
| 数据库    | PostgreSQL 18.0                                 | `uuidv7()`、虚拟生成列、具名 `NOT NULL`、`PERIOD` 排他约束、skip scan、AIO |
| ORM    | Drizzle ORM 0.45.x                              | 表/列/CHECK/索引/视图；复杂 DDL 走手写迁移                               |
| 主键     | `uuidv7()`                                      | 时间有序，B-tree 局部性好；应用不生成                                     |
| 扩展     | `ltree`、`btree_gist`                            | `ltree` 管路径；`btree_gist` 让 uuid 与 `ltree` 共处一个复合 GiST 索引   |
| Schema | `public` 业务表 / `app` 函数与视图 / `auth` Better Auth | 业务迁移不建 `auth` 表                                            |
| 认证     | Better Auth                                     | `auth.user` 由认证层持有；业务表只加外键                                 |

**迁移前置条件**：`auth` schema 与 `auth.user` 必须已由认证层迁移创建；`ltree` 与 `btree_gist` 扩展必须在业务迁移之前安装。

**不使用的特性**：`pgEnum`（改值需 DDL 锁，错误信息不友好）、`hstore`、`xml`、继承表、规则系统、软删除列、通用 `entity_type/entity_id` 业务外键。

### 2.1 PG 18 语义差异表（v1.2 新增）

**这一节是 1.1 版最缺的东西**：1.1 大量写法依赖「PG 默认行为」，而 PG 18 恰好改了几个默认值。以下差异全部经真实 PG 18.0 实测（§17）。

| # | 主题                          | PG 17 及以前               | **PG 18 实际行为**                                                                                            | 本模型的处理                                                           | 实测  |
| - | --------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | --- |
| 1 | 生成列默认类型                     | 只能 `STORED`             | `GENERATED ALWAYS AS (...)` **默认是 `VIRTUAL`**                                                             | 全部生成列**显式写 `STORED`**；`ltree` 是用户自定义类型，VIRTUAL 生成列**不允许**用户自定义类型 | #01 |
| 2 | `RESTRICT` 违规的 SQLSTATE     | `23503`                 | **`23001` (`restrict_violation`)**                                                                        | 错误映射表把 `23001` 与 `23503` 分开列                                     | #02 |
| 3 | `AFTER` 触发器的执行角色            | 提交时的当前角色                | **入队时的角色**                                                                                                | 延迟约束触发器以 `genealogy_app` 身份在提交时执行；已在权限设计中预留该角色所需的 `SELECT`       | #13 |
| 4 | `NOT NULL` 约束               | 匿名，不可进 `pg_constraint`  | **存入 `pg_constraint`（`contype='n'`），可具名**                                                                 | `NOT NULL` 一律具名（`ck_*_not_null`），配合 `DM-GEN-13`                  | #12 |
| 5 | 约束的 `NOT VALID`             | 只在 `ADD CONSTRAINT` 时可用 | **`ADD CONSTRAINT ... NOT VALID` + `VALIDATE CONSTRAINT`**；**没有** `ALTER CONSTRAINT ... SET NOT VALID` 子句 | 大表加 CHECK/FK 走 `ADD ... NOT VALID` → `VALIDATE CONSTRAINT` 两步    | #11 |
| 6 | `EXPLAIN ANALYZE` 的 BUFFERS | 需显式 `BUFFERS`           | **自动包含 `BUFFERS`**                                                                                        | `DM-GEN-10` 统一写 `EXPLAIN (ANALYZE)`                              | #14 |
| 7 | 多列 B-tree                   | 首列无约束即不可用               | 支持 **skip scan**                                                                                          | `(project_id, X)` 模式在首列缺失时仍可能命中；索引策略按此放宽                         | #15 |
| 8 | `initdb` 默认                 | 无数据校验和                  | **默认启用数据校验和**                                                                                             | 部署文档需说明 `pg_upgrade` 要求两端校验和设置一致                                 | —   |

> `DM-GEN-20` 的含义：**凡是「不写关键字就可能变义」的地方，一律显式写。** 这不是冗余，是把版本风险变成可见的文本差异。
>
> **关于 `NOT VALID` 的精确边界（实测 #11、#21、#22）**：
>
> - `ADD CONSTRAINT ... NOT VALID` **只对 `CHECK` 和 `FOREIGN KEY` 有效**（实测 `ALTER TABLE ... ADD CONSTRAINT ... CHECK (...) NOT VALID` → ACCEPTED；`ADD CONSTRAINT ... FOREIGN KEY ... NOT VALID` → ACCEPTED）。
> - `ALTER TABLE ... VALIDATE CONSTRAINT name` 是**唯一**的验证入口。
> - **PG 18 没有 `ALTER CONSTRAINT ... SET NOT VALID` 这个子句**（实测 `syntax error at or near "SET"`）。想撤除一个已 `NOT VALID` 的约束，只能 `DROP CONSTRAINT` 后重建。
> - **具名 `NOT NULL` 约束无法走 `NOT VALID` 路线**：`VALIDATE CONSTRAINT person_surname_not_null` → `42704 constraint ... does not exist`（`NOT NULL` 走 `contype='n'`，不参与 `VALIDATE` 的候选集）。因此给大表加 `NOT NULL` 的唯一低锁路径是：先加 `CHECK (col IS NOT NULL) NOT VALID` → `VALIDATE` → 再 `ALTER COLUMN ... SET NOT NULL`（后者会短暂持锁）。

### 2.2 PG 18 新能力中「本模型明确不用」的部分

| 能力                               | 为何不用                                                                      | 复评时机                  |
| -------------------------------- | ------------------------------------------------------------------------- | --------------------- |
| `PERIOD` 时间区间约束（FK 排他）           | `invite` 的「同邮箱单条 pending」用部分唯一索引已足够；`PERIOD` 会让「有效期不重叠」成为强约束，反而限制「提前重发邀请」 | V2 若引入 `invite` 有效期语义 |
| `WITHOUT OVERLAPS`（PK/UNIQUE 排他） | 同上                                                                        | V2                    |
| `NOT ENFORCED` 约束                | 会把 DB 级保证降级为「看起来像约束」                                                      | 永不                    |
| 虚拟生成列                            | `ltree` / `jsonb` 属用户自定义类型，VIRTUAL 不允许；且虚拟列不能作为 FK 引用侧                    | 永不                    |

---

## 3. 实体全景

```mermaid
erDiagram
  organization ||--o{ organization_member : has
  organization ||--o{ invite : issues
  organization ||--o{ project : owns
  organization ||--o{ audit_log : records

  project ||--o{ folder : contains
  project ||--o{ person : contains
  project ||--o{ person_relation : contains
  project ||--o{ event : contains
  project ||--o{ lineage : contains
  project ||--o{ source : contains
  project ||--o{ article : contains
  project ||--o{ media_asset : contains
  project ||--o{ book : contains

  person ||--o{ person_name : has
  person ||--o{ person_relation : from
  person ||--o{ person_relation : to
  person ||--o{ event : subject
  person ||--o{ node : placed_at
  person ||--o{ person_media : has

  lineage ||--o{ node : contains
  person_relation ||--o{ event : subject
  source ||--o{ source_citation : cited_by
  person ||--o{ source_citation : target
  person_name ||--o{ source_citation : target
  person_relation ||--o{ source_citation : target
  event ||--o{ source_citation : target
  media_asset ||--o{ source_citation : scan

  article ||--o{ article_page : has
  article_page ||--o{ article_page_media : uses
  media_asset ||--o{ article_page_media : used_by
  media_asset ||--o{ person_media : used_by

  book ||--o{ book_catalog : contains
  book ||--o{ book_release : releases
  article ||--o{ book_catalog : referenced
  lineage ||--o{ book_catalog : referenced
```

### 3.1 表清单（22 张，由 `src/domain/enums.ts` 的 `TABLE_NAMES` 生成）

| 层  | 表                     | 主键                                              | 归属模块             |
| -- | --------------------- | ----------------------------------------------- | ---------------- |
| 租户 | `organization`        | `id`                                            | organization     |
| 租户 | `organization_member` | `(organization_id, user_id)`                    | organization     |
| 租户 | `invite`              | `id`                                            | organization     |
| 项目 | `project`             | `id`（另 `UNIQUE (organization_id, id)`）          | project          |
| 项目 | `folder`              | `(project_id, id)`                              | project          |
| 人物 | `person`              | `(project_id, id)`                              | genealogy        |
| 人物 | `person_name`         | `(project_id, id)`                              | genealogy        |
| 人物 | `person_relation`     | `(project_id, id)`                              | genealogy        |
| 人物 | `event`               | `(project_id, id)`                              | genealogy        |
| 谱系 | `lineage`             | `(project_id, id)`                              | genealogy        |
| 谱系 | `node`                | `(project_id, id)`                              | genealogy        |
| 资料 | `source`              | `(project_id, id)`                              | source           |
| 资料 | `source_citation`     | `(project_id, id)`                              | source           |
| 谱文 | `article`             | `(project_id, id)`                              | article          |
| 谱文 | `article_page`        | `(project_id, id)`                              | article          |
| 媒体 | `media_asset`         | `(project_id, id)`                              | media            |
| 媒体 | `person_media`        | `(project_id, person_id, media_asset_id)`       | media            |
| 媒体 | `article_page_media`  | `(project_id, article_page_id, media_asset_id)` | media            |
| 谱书 | `book`                | `(project_id, id)`                              | book             |
| 谱书 | `book_catalog`        | `(project_id, id)`                              | book             |
| 谱书 | `book_release`        | `(project_id, id)`                              | book             |
| 治理 | `audit_log`           | `id`                                            | audit（平台服务，非业务域） |

> **v1.2 变更**：`book_release` 的主键由 1.1 版的 `id` 改为 `(project_id, id)`，与「所有 Project 内容表用复合主键」的通则（§4.3）一致。1.1 版只有它和 `audit_log` 两张表例外，而 `audit_log` 的例外有明确理由（无外键、日志留存），`book_release` 没有。
>
> 表清单、模块归属、枚举、**RLS 策略矩阵**四处清单均由 `src/domain/enums.ts` 生成，本文与 [`plan.md`](./plan.md) §5 的清单都从它派生，不再手抄（`DM-GEN-02` / `DM-GEN-19`）。生成物：`db/generated/enums.sql`、`db/generated/tables.sql`、`db/generated/rls_policies.sql`。

---

## 4. 通用约定

### 4.1 命名

- 表名单数 `snake_case`；独立实体主键 `id`；纯关联表用业务键复合主键，不加代理 `id`。
- 约束前缀：`pk_`、`fk_`、`uk_`、`ck_`、`idx_`、`uq_`（部分唯一索引）、`trg_`。
- 函数：`app.verb_noun()`；视图：`app.noun`。
- **约束必须具名**（`DM-GEN-13`）：匿名约束无法在错误处理、迁移和审计里被引用。错误映射按「SQLSTATE + 约束名」两级匹配（见 [`plan.md`](./plan.md) §8.3）。
  - **v1.2 补充**：PG 18 起 `NOT NULL` 也可具名（`CONSTRAINT ck_person_name_not_null NOT NULL`），因此 `NOT NULL` 一律具名。

### 4.2 类型约定

| 用途             | 类型            | 说明                                                                           |
| -------------- | ------------- | ---------------------------------------------------------------------------- |
| 主键 / 外键        | `uuid`        | 默认 `uuidv7()`；应用不生成                                                          |
| 名称、描述、原文       | `text`        | 不做长度限制；非空用 `CHECK (btrim(x) <> '')`                                          |
| 序号 / 版本 / 世次   | `integer`     | 不用 `smallint` 省空间，省不出什么                                                      |
| 文件大小           | `bigint`      | `byte_size > 0`                                                              |
| 时间戳            | `timestamptz` | 统一 UTC；默认 `now()`（写入时刻语义见 §4.4）                                              |
| 日期范围           | `date`        | 只存可可靠换算的公历日期                                                                 |
| 路径             | `ltree`       | 扩展类型；固定四位数字段                                                                 |
| 文档 / 快照 / 审计载荷 | `jsonb`       | 仅 `article_page.content`、`book_release.content_snapshot`、`audit_log.payload` |
| token 哈希       | `bytea`       | `sha256()` 结果，32 字节                                                          |
| 布尔             | `boolean`     | 列名 `is_*`                                                                    |


> 全文约定：任何「非空文本」字段一律带 `btrim(x) <> ''`。纯空白字符串不是内容（`DM-GEN-14`）。这条消除了「`summary=' '` 通过 CHECK」的漏洞。

### 4.3 主键与 Project Scope

- `organization`、`invite`、`audit_log` 用 `id` 主键。
- 所有 Project 内容表（含 `book_release`）用 `(project_id, id)` 复合主键。
- `project` 额外声明 `UNIQUE (organization_id, id)`，供内容表的复合外键引用。
- 内容表同时保存 `organization_id` 与 `project_id`，并用
  `FOREIGN KEY (organization_id, project_id) REFERENCES project (organization_id, id)`
  保证两者一致。`organization_id` 是 RLS 的物化连接键，不是第二真相源——它被复合外键强制。
- 任何跨 Project 引用都由复合外键拒绝；应用层不需要「记得带 project_id」。
- `organization_id` / `project_id` 创建后不可修改，由 `app.guard_scope_immutable()` 触发器保护（`DM-SCP-01`）。
- **v1.2 补充**：`person_media` 与 `article_page_media` 这两张纯关联表同样必须带
  `FOREIGN KEY (organization_id, project_id) REFERENCES project (organization_id, id)`（`DM-SCP-02`）。1.1 版遗漏了这两条，是真实漏洞。

### 4.4 时间戳约定

| 表 | `created_at` | `updated_at` |
|---|---|---|
| `organization` | 有 | 有 |
| `organization_member` | 有 | 有（role 变更） |
| `invite` | 有 | 有（status 变更） |
| `project` / `folder` | 有 | 有 |
| `person` / `person_name` / `person_relation` / `event` | 有 | 有 |
| `lineage` / `node` | 有 | 有 |
| `source` / `source_citation` | 有 | 有 |
| `article` / `article_page` | 有 | 有 |
| `media_asset` | 有 | 有 |
| `person_media` / `article_page_media` | 有 | 无（关联行重建） |
| `book` / `book_catalog` | 有 | 有 |
| `book_release` | 有 | 无（只有 `revoked_at`） |
| `audit_log` | 有 | 无（只追加） |

**`now()` 与 `clock_timestamp()` 的分工（`DM-GEN-15`，v1.2 新增）**：

| 用途 | 函数 | 理由 |
|---|---|---|
| 列默认值 `created_at` | `now()` | 同一事务内的多行应当有相同的事务时间戳——它们是同一笔业务事实 |
| 触发器推进 `updated_at` | **`clock_timestamp()`** | `now()` 是**事务开始时间**；同一事务内第二次 UPDATE 不会推进，插入后立即更新也不会推进 → `updated_at` 不满足「严格大于原值」 |
| `audit_log.created_at` | **`clock_timestamp()`** | 同一事务内多条审计必须有可区分的先后顺序，否则按时间排序与分区裁剪都失效 |
| `invite.accepted_at` / `revoked_at` | `now()` | 状态切换是一次业务事实，与事务同生 |

> **实测结论（§17 #03）**：`now()` 版触发器在同一事务内两次 UPDATE，`updated_at` 完全不变；`clock_timestamp()` 版严格递增。这是 1.1 版验收清单 #31「`updated_at` 严格大于原值」在真实 PG 18 上**必然失败**的原因。

`updated_at` 由 `app.touch_updated_at()` 在 `BEFORE UPDATE` 统一推进；应用不得手写该列。

### 4.5 枚举单一来源

`src/domain/enums.ts` 是唯一来源：

```ts
export const RELATION_KINDS = [
  'biological_parent', 'adoptive_parent', 'ritual_heir',
  'step_parent', 'foster_parent', 'spouse', 'partner',
] as const;

export const LINEAGE_PARENT_KINDS = [
  'biological_parent', 'adoptive_parent', 'ritual_heir',
] as const;

export const SYMMETRIC_RELATION_KINDS = ['spouse', 'partner'] as const;
export const MEMBER_ROLES = ['admin', 'editor', 'viewer'] as const;
export const TABLE_NAMES = [/* 22 张表 */] as const;
export const AUDIT_ENTITY_TYPES = [/* 由 TABLE_NAMES 派生 */] as const;
```

`scripts/gen-sql.ts` 生成 `db/generated/enums.sql`，内容包含：

- 各 `ck_*` 的取值清单；
- `app.relation_kind_is_lineage_parent(text)` 的函数体；
- 对称类的 kind 清单；
- `ck_audit_log_entity_type` 的取值清单（由 `TABLE_NAMES` 派生，不再手抄第二份）。

**v1.2 追加**：同一生成器同时产出 `db/generated/tables.sql`（表清单 + 主键形态）与 `db/generated/rls_policies.sql`（逐表策略表达式），使 §3.1 与 §8.2 的矩阵也变成生成物（`DM-GEN-19`）。

CI 只做一件事：`bun run gen:sql && git diff --exit-code db/generated/`。不再解析 `pg_indexes` / `pg_proc` 文本。

### 4.6 约束名与错误码

触发器使用自定义 SQLSTATE，应用按码映射，不解析中文消息：

| SQLSTATE | 含义 | 触发点 |
|---|---|---|
| `GX001` | 世系关系会形成祖先环路 | `app.check_ancestor_cycle()` |
| `GX002` | scope 不可迁移 | `app.guard_scope_immutable()` |
| `GX003` | 出版快照不可修改 | `app.guard_book_release_snapshot()` |
| `GX004` | 审计日志只可追加 | `app.guard_append_only()` |
| `GX005` | 邀请无效或已过期 / 目标不存在 | `app.resolve_invite_by_token()` / `app.accept_invite()` / `app.revoke_invite()` |
| `GX006` | 权限不足（仅 owner / 仅 admin） | `app.purge_book_release()` / `app.transfer_organization_ownership()` |
| `GX007` | 出版版本尚未作废，不能清除 | `app.purge_book_release()` |
| `GX008` | 组织创建缺少已认证用户上下文 | `app.create_organization()` |
| `GX009` | 邀请邮箱与当前登录用户邮箱不一致 | `app.accept_invite()` |
| `GX010` | 并发抢占失败（邀请已被兑换 / 所有权已被并发转移） | `app.accept_invite()` / `app.transfer_organization_ownership()` |
| `GX011` | 出版产物字节缺失，状态不一致 | `app.purge_book_release()` |

**原生 SQLSTATE（v1.2 按 PG 18 修正，`DM-GEN-18`）**：

| SQLSTATE | 含义 | **v1.2 变更** |
|---|---|---|
| `23505` | `unique_violation` | 不变 |
| `23503` | `foreign_key_violation` | **仅**表示 `NO ACTION` / `SET NULL` / `SET DEFAULT` 动作下的引用违规 |
| `23001` | `restrict_violation` | **`ON DELETE RESTRICT` 的专属码**。PG 18 起 RESTRICT 不再报 `23503`（§2.1 #2，实测 #02） |
| `23514` | `check_violation` | 不变 |
| `42501` | `insufficient_privilege` | 权限不足（不是约束错误，不进约束名匹配分支） |
| `22P02` | `invalid_text_representation` | 输入格式错误（如非法 UUID 字符串） |
| `55P03` | `lock_not_available` | 拿不到 advisory lock（`lock_timeout` 触发） |
| `57014` | `query_canceled` | `statement_timeout` 触发 |

> **1.1 版的错误**：「唯一、外键、CHECK 错误沿用原生 `23505` / `23503` / `23514` / `23001`」把 `23001` 和 `23503` 并列而未区分触发条件。按 PG 18 实测，`ON DELETE RESTRICT` 与普通外键违规是**两个不同的码**。应用若把两者合并处理，就无法区分「引用了被保护的对象」和「级联动作被拒」。
>
> 错误映射按「SQLSTATE → 约束名 → 文案」两级解析（[`plan.md`](./plan.md) §8.3），**不解析中文消息**（`DM-GEN-18`）。

---

## 5. 实体定义

### 5.1 `organization` — 租户

| 字段 | 类型 | 空 | 默认 | 约束 / 说明 |
|---|---|---|---|---|
| `id` | `uuid` | 否 | `uuidv7()` | 主键 |
| `name` | `text` | 否 | | `ck_organization_name_not_blank` |
| `status` | `text` | 否 | `'active'` | `active` / `suspended` / `archived` |
| `owner_user_id` | `uuid` | 否 | | 恰好一个 owner；必须是组织成员 |
| `created_at` | `timestamptz` | 否 | `now()` | |
| `updated_at` | `timestamptz` | 否 | `now()` | 触发器维护（`clock_timestamp()`） |

```sql
ALTER TABLE organization
  ADD CONSTRAINT ck_organization_status
  CHECK (status IN ('active', 'suspended', 'archived'));

ALTER TABLE organization
  ADD CONSTRAINT fk_organization_owner
  FOREIGN KEY (id, owner_user_id)
  REFERENCES organization_member (organization_id, user_id)
  DEFERRABLE INITIALLY IMMEDIATE
  ON DELETE RESTRICT;
```

- 「恰好一个 owner」= `owner_user_id NOT NULL`（`DM-ORG-01`）。
- 「owner 必须是成员」= 复合外键（`DM-ORG-02`）。
- 「不能删除 owner 的成员行」= `ON DELETE RESTRICT`（`DM-ORG-03`）。
- 创建组织必须在同一事务内先插 `organization`、再插 owner 的 `organization_member`，并执行 `SET CONSTRAINTS public.fk_organization_owner DEFERRED;`。此流程只允许通过 `app.create_organization()` 调用（`DM-ORG-04`）。
- 迁移顺序：先建 `organization`（不带 owner 外键）→ 建 `organization_member`（含指向 `organization` 的外键）→ 再 `ALTER TABLE organization ADD CONSTRAINT fk_organization_owner`。循环外键必须分两步建立。
- owner 的成员角色固定写 `admin`；owner 的权限由 `owner_user_id` 派生，不由 `role` 派生。
- 物理删除组织不支持；使用 `status='archived'`。归档后禁止新写入是**应用层软约束**，数据库不拦截（`DM-ORG-05`，见 §8.2 软约束登记表）。
- **v1.2**：`NOT NULL` 一律具名（`organization_name_not_null` 等），PG 18 起 NOT NULL 可进 `pg_constraint`，错误映射可以精确到列（`DM-GEN-13`）。

索引：主键；`idx_organization_owner (owner_user_id)`。

### 5.2 `organization_member` — 成员

| 字段 | 类型 | 空 | 默认 | 约束 / 说明 |
|---|---|---|---|---|
| `organization_id` | `uuid` | 否 | | `fk_organization_member_org`，`ON DELETE RESTRICT` |
| `user_id` | `uuid` | 否 | | `fk_organization_member_user` → `auth.user(id)`，`ON DELETE RESTRICT` |
| `role` | `text` | 否 | | `admin` / `editor` / `viewer` |
| `created_at` | `timestamptz` | 否 | `now()` | |
| `updated_at` | `timestamptz` | 否 | `now()` | 触发器维护 |

- `PRIMARY KEY (organization_id, user_id)`。
- `ck_organization_member_role`：`role IN ('admin', 'editor', 'viewer')`。**没有 `owner` 值**（`DM-ORG-06`）。
- `idx_organization_member_user (user_id)`：`app.visible_org_array()` 的入口索引，必须有。
- 成员的增删改由应用层做角色授权；RLS 只负责租户隔离，不负责「谁能改成员」。这是明确的边界，不是遗漏（`DM-ORG-07`，软约束，登记于 §8.2）。

### 5.3 `invite` — 邀请

| 字段 | 类型 | 空 | 默认 | 约束 / 说明 |
|---|---|---|---|---|
| `id` | `uuid` | 否 | `uuidv7()` | 主键 |
| `organization_id` | `uuid` | 否 | | `fk_invite_org`，`ON DELETE RESTRICT` |
| `email` | `text` | 否 | | 小写；非空白 |
| `role` | `text` | 否 | | `admin` / `editor` / `viewer` |
| `token_hash` | `bytea` | 否 | | `sha256(token)`；32 字节；全局唯一 |
| `status` | `text` | 否 | `'pending'` | `pending` / `accepted` / `revoked` |
| `expires_at` | `timestamptz` | 否 | | 必须晚于 `created_at` |
| `accepted_at` | `timestamptz` | 是 | | 与 `status` 双蕴含 |
| `revoked_at` | `timestamptz` | 是 | | 与 `status` 双蕴含 |
| `invited_by` | `uuid` | 否 | | `fk_invite_invited_by` → `auth.user(id)`，`ON DELETE RESTRICT` |
| `created_at` | `timestamptz` | 否 | `now()` | |
| `updated_at` | `timestamptz` | 否 | `now()` | 触发器维护 |

```sql
CHECK (email = lower(email) AND btrim(email) <> '')
CHECK (role IN ('admin', 'editor', 'viewer'))
CHECK (status IN ('pending', 'accepted', 'revoked'))
CHECK (octet_length(token_hash) = 32)
CHECK (expires_at > created_at)
CHECK ((status = 'accepted') = (accepted_at IS NOT NULL))
CHECK ((status = 'revoked')  = (revoked_at  IS NOT NULL))
UNIQUE (token_hash)
```

```sql
CREATE UNIQUE INDEX uq_invite_pending_email
  ON invite (organization_id, email)
  WHERE status = 'pending';
```

- **token 熵**（`DM-INV-01`）：明文 token 由应用用 CSPRNG 生成，≥ 32 字节随机（≥ 256 bit），Base64URL 编码；数据库只存 `sha256(convert_to(token,'UTF8'))`（32 字节 `bytea`）。明文只在创建响应里返回一次。
- **邮箱一致性**（`DM-INV-02`）：`app.accept_invite()` 比对邀请 `email` 与当前登录用户的邮箱（小写化后），不一致抛 `GX009`。用户不能兑换发给别人的邀请。
  - **v1.2 修复**：比对必须用 `IS DISTINCT FROM`，不能用 `<>`。当登录用户没有邮箱（`v_email IS NULL`）时，`<>` 的结果是 NULL，`IF NULL THEN` 不成立 → **校验被静默跳过**，任何持有有效 token 的人都能兑换他人邀请。实测见 §17 #08。
- **并发兑换**（`DM-INV-03`）：兑换用单条条件更新抢占：
  `UPDATE invite SET status='accepted', accepted_at=now() WHERE token_hash = $1 AND status='pending' AND expires_at > now() RETURNING id;`
  返回 0 行 → 抛 `GX010`（已被兑换/已撤销）或 `GX005`（过期）。抢占成功后才插入成员行，因此同一 token 只可能被兑换一次。
- 兑换只走 `app.resolve_invite_by_token()` / `app.accept_invite()`，业务角色不直接查 `invite`（未加入组织时 RLS 可见集为空）。
- 已接受/已撤销的历史邀请不阻止再次邀请。
- 邀请不能授予 owner；owner 只能通过显式转移产生。
- **v1.2 新增 `app.revoke_invite()`**：撤销也必须走受控函数（见 §9.2）。1.1 版把 `UPDATE (status, accepted_at, revoked_at, updated_at)` 直接授予业务角色，等于给出一条绕过邮箱一致性与抢占逻辑的旁路——业务代码只要有 UPDATE 权限就能把任意邀请改成 `accepted` 并自行填 `accepted_at`。v1.2 收回该权限（§8.4）。

索引：`uq_invite_pending_email`；`uk_invite_token_hash`；`idx_invite_org_status (organization_id, status)`；**`idx_invite_invited_by (invited_by)`（v1.2 补，`DM-GEN-17`）**。

### 5.4 `project` — 谱项目

| 字段 | 类型 | 空 | 默认 | 约束 / 说明 |
|---|---|---|---|---|
| `id` | `uuid` | 否 | `uuidv7()` | 主键 |
| `organization_id` | `uuid` | 否 | | `fk_project_org`，`ON DELETE RESTRICT` |
| `name` | `text` | 否 | | 非空白 |
| `status` | `text` | 否 | `'planning'` | `planning` / `in_progress` / `completed` |
| `surname` | `text` | 是 | | 谱项目归属姓氏；有值时非空白 |
| `hall_name` | `text` | 是 | | 堂号；有值时非空白 |
| `origin_text` | `text` | 是 | | 原始地名，不强行规范化 |
| `description` | `text` | 是 | | |
| `created_at` | `timestamptz` | 否 | `now()` | |
| `updated_at` | `timestamptz` | 否 | `now()` | 触发器维护 |


- `PRIMARY KEY (id)`；`UNIQUE (organization_id, id)`：供内容表复合外键引用。
- `ck_project_status`、`ck_project_name_not_blank`、`ck_project_surname_not_blank`、`ck_project_hall_name_not_blank`。
- 不同 Project 可以有同名人物、同名谱系、同名分类。
- `project` 没有 `ref` 列；URL 直接使用 `id`。公开寻址不承担授权。

索引：`idx_project_org_status (organization_id, status)`。

### 5.5 `folder` — 单层分类

| 字段 | 类型 | 空 | 默认 | 约束 / 说明 |
|---|---|---|---|---|
| `id` | `uuid` | 否 | `uuidv7()` | |
| `organization_id` | `uuid` | 否 | | 复合外键的一部分 |
| `project_id` | `uuid` | 否 | | 复合外键的一部分 |
| `name` | `text` | 否 | | 同 Project 内唯一；非空白 |
| `seq` | `integer` | 否 | `0` | `>= 0` |
| `created_at` | `timestamptz` | 否 | `now()` | |
| `updated_at` | `timestamptz` | 否 | `now()` | 触发器维护 |

- `PRIMARY KEY (project_id, id)`。
- `fk_folder_project`：`(organization_id, project_id) → project(organization_id, id)`，`ON DELETE RESTRICT`。
- `uk_folder_name`：`UNIQUE (project_id, name)`。
- 引用 Folder 的表使用列清单式 `SET NULL`：

```sql
FOREIGN KEY (project_id, folder_id)
  REFERENCES folder (project_id, id)
  ON DELETE SET NULL (folder_id)
```

这只清空 `folder_id`，不会清空复合外键里的 `project_id`。PostgreSQL 15+ 支持该语法。

索引：`idx_folder_project_seq (project_id, seq)`。

### 5.6 `person` — 人物事实

| 字段 | 类型 | 空 | 默认 | 约束 / 说明 |
|---|---|---|---|---|
| `id` | `uuid` | 否 | `uuidv7()` | |
| `organization_id` | `uuid` | 否 | | 复合外键的一部分 |
| `project_id` | `uuid` | 否 | | 复合外键的一部分 |
| `sex` | `text` | 否 | `'unknown'` | `male` / `female` / `unknown` / `other` |
| `surname` | `text` | 是 | | **宗族姓氏归属**；有值时非空白 |
| `created_at` | `timestamptz` | 否 | `now()` | |
| `updated_at` | `timestamptz` | 否 | `now()` | 触发器维护 |

- `PRIMARY KEY (project_id, id)`；`fk_person_project`；`ck_person_sex`、`ck_person_surname_not_blank`。

**`surname` 的三条硬规则**（`DM-PER-01`）：

1. **独立事实。** 表达「此人属于哪个宗族」，不由 `person_name` 派生；迁移、触发器、生成列都不得把两者自动同步。
2. **不自动裁剪。** `person_name.value` 以 `surname` 开头时，数据库不改任何一边；应用层可以提示，但不能静默修正。
3. **冲突可选留痕。** 编者可创建 `source_citation` 说明存疑，但不列为不变量。

> `surname` 与 `project.surname` 不互相约束：Project 内可以有外来联姻、旁支、史料人物。

索引：`idx_person_project_surname (project_id, surname) WHERE surname IS NOT NULL`。

### 5.7 `person_name` — 姓名

| 字段 | 类型 | 空 | 默认 | 约束 / 说明 |
|---|---|---|---|---|
| `id` | `uuid` | 否 | `uuidv7()` | |
| `organization_id` | `uuid` | 否 | | |
| `project_id` | `uuid` | 否 | | |
| `person_id` | `uuid` | 否 | | 所属人物 |
| `kind` | `text` | 否 | | `formal` / `courtesy` / `art` / `milk` / `genealogy` / `posthumous` / `other` |
| `value` | `text` | 否 | | 原文完整书写形式，可以包含姓 |
| `is_primary` | `boolean` | 否 | `false` | 默认显示名 |
| `created_at` | `timestamptz` | 否 | `now()` | |
| `updated_at` | `timestamptz` | 否 | `now()` | 触发器维护 |

- `PRIMARY KEY (project_id, id)`。
- `fk_person_name_project`、`fk_person_name_person`：`(project_id, person_id) → person(project_id, id)`，`ON DELETE CASCADE`。姓名从属于人物；但引用姓名的 citation 是 `RESTRICT`，会阻止「带着证据一起静默消失」。
- `UNIQUE (project_id, person_id, kind, value)`（`DM-NAM-02`）。
- 每人最多一个主姓名（`DM-NAM-01`）：

```sql
CREATE UNIQUE INDEX uq_person_name_primary
  ON person_name (project_id, person_id)
  WHERE is_primary;
```

- `ck_person_name_kind`、`ck_person_name_value_not_blank`。

> `kind='formal'` 表示本名/正式名。`value='张明德'` 是合法的「本名」，包含姓；`kind='courtesy'` 的「字」也可按原文完整记录。`value` 是证据，不做拆分。

索引：`idx_person_name_person (project_id, person_id)`。

### 5.8 `person_relation` — 关系事实

一张表保存所有人际关系事实。不建 `Family`，不建第二张关系表。

| 字段 | 类型 | 空 | 默认 | 约束 / 说明 |
|---|---|---|---|---|
| `id` | `uuid` | 否 | `uuidv7()` | |
| `organization_id` | `uuid` | 否 | | |
| `project_id` | `uuid` | 否 | | |
| `from_person_id` | `uuid` | 否 | | 上位/发起人物；对称类为规范序较小者 |
| `to_person_id` | `uuid` | 否 | | 下位/承接人物；对称类为规范序较大者 |
| `kind` | `text` | 否 | | 7 种，见下表 |
| `from_role_label` | `text` | 是 | | from 端称谓，如「父」「嫡妻」 |
| `to_role_label` | `text` | 是 | | to 端称谓，如「长子」「嗣子」 |
| `sort_order` | `integer` | 是 | | 同起点同 kind 的展示顺序；有值时 `>= 0` |
| `note` | `text` | 是 | | |
| `created_at` | `timestamptz` | 否 | `now()` | |
| `updated_at` | `timestamptz` | 否 | `now()` | 触发器维护 |

**关系类型（7 种）：**

| `kind` | 含义 | 方向 | 对称 | 世系父边 | 参与环检查 |
|---|---|---|---|---|---|
| `biological_parent` | 生物学父母 | 父母 → 子女 | 否 | 是 | 是 |
| `adoptive_parent` | 收养父母 | 养父母 → 子女 | 否 | 是 | 是 |
| `ritual_heir` | 传统继嗣/承嗣 | 立嗣方 → 承嗣人 | 否 | 是 | 是 |
| `step_parent` | 继亲 | 继亲 → 子女 | 否 | 否 | 否 |
| `foster_parent` | 寄养关系 | 寄养方 → 子女 | 否 | 否 | 否 |
| `spouse` | 配偶 | 无向，只存一条 | 是 | 否 | 否 |
| `partner` | 其他伴侣 | 无向，只存一条 | 是 | 否 | 否 |

```sql
CHECK (from_person_id <> to_person_id)
CHECK (kind IN (
  'biological_parent', 'adoptive_parent', 'ritual_heir',
  'step_parent', 'foster_parent', 'spouse', 'partner'
))
-- 对称类必须规范顺序，保证 A—B 只有一种物理表示
CHECK (kind NOT IN ('spouse', 'partner') OR from_person_id < to_person_id)
CHECK (from_role_label IS NULL OR btrim(from_role_label) <> '')
CHECK (to_role_label   IS NULL OR btrim(to_role_label)   <> '')
CHECK (sort_order IS NULL OR sort_order >= 0)

UNIQUE (project_id, from_person_id, to_person_id, kind)
```

- `DM-REL-01` **反向有向边**：对**世系父边**（`biological_parent` / `adoptive_parent` / `ritual_heir`），A→B 与 B→A 构成二元祖先环，写入时必然被 `GX001` 拒绝。这不是「允许并存」——数据库禁止并存。
- `DM-REL-02` **反向非世系边**：对 `step_parent` / `foster_parent`，A→B 与 B→A **可以并存**（互称父母是合法的家庭结构，数据库不猜测）。数据库不判「谁是谁的父亲」，那是编者的事实判断。
- `DM-REL-03` **对称关系唯一物理表示**：`spouse` / `partner` 由 `from < to` 的 CHECK 保证只有一种存法；反向插入被 CHECK 拒绝。
- `DM-REL-08` **两端同 Project 且不同人物**：`(project_id, from_person_id)` 与 `(project_id, to_person_id)` 两个复合外键 + `CHECK (from <> to)`。
- `DM-REL-09` **同一对人物同一 kind 不重复**：`UNIQUE (project_id, from, to, kind)`。
- `DM-REL-12` **`kind` 取值单一来源**：由 `src/domain/enums.ts` 的 `RELATION_KINDS` 生成 `ck_person_relation_kind`。
- 不同 `kind` 可以并存于同一对人物（如既是 `spouse` 又是 `biological_parent` 的罕见情况由数据决定）。
- `from_role_label` / `to_role_label` 各管一端，解决「嫡妻」和「长子」不能塞进同一列的问题。
- `DM-REL-04` **排序不唯一**：`sort_order` 是编者排版提示，不是事实，**不建唯一索引**。理由：(a) 唯一索引使任何中间插入都需要 O(n) 重排兄弟，而 `node` 路径用步长 10 恰恰是为了避免重排，两套相反解法只留一套；(b) 对称关系里 `from` 是 UUID 较小者，「给我的配偶们排序」在 `from_person_id` 维度上根本聚不拢，唯一索引连语义都是歪的。查询统一按 `(sort_order NULLS LAST, id)` 排序，平局用 `id` 打破。

**索引：**

- `idx_person_relation_from (project_id, from_person_id, kind)`：出向查询、环检查。
- `idx_person_relation_to (project_id, to_person_id, kind)`：入向查询。

#### 祖先环检查（只覆盖世系父边）

`DM-REL-05` 环检查的并发正确性由数据库保证，结构如下：

1. **语句时**：`BEFORE INSERT OR UPDATE OF from_person_id, to_person_id, kind`，若 `kind` 属于世系父边，取**事务级 advisory lock**（见下），把同一 Project 的世系写入串行化。
2. **提交时**：`CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED` 用递归 CTE 从 `NEW.to_person_id` 沿世系父边向下走；若到达 `NEW.from_person_id`（排除 `NEW.id` 自身），抛 `GX001`。
3. `step_parent` / `foster_parent` 不参与第 1、2 步。
4. 删除关系不会形成环，不需要触发器。
5. **v1.2 补充（PG 18 语义）**：PG 18 起 `AFTER` 触发器**以事件入队时的角色**执行，而不是提交时的当前角色（§2.1 #3，实测 #13）。本模型在事务开始即 `SET LOCAL ROLE genealogy_app`，因此延迟约束触发器以 `genealogy_app` 身份运行——它必须能 `SELECT person_relation`。该权限已在 §8.4 明确给出；**撤销 `genealogy_app` 对 `person_relation` 的 SELECT 会让环检查在提交阶段失败**，而不是在写入阶段，这是 PG 18 的新行为，必须写进权限变更评审清单。

**为什么用 advisory lock 而不是 `FOR UPDATE` 锁 project 行**（`DM-GEN-12`）：

PostgreSQL 的外键检查机制会对被引用的 `project` 行加 `FOR KEY SHARE` 锁（官方锁冲突矩阵 Table 13.3 中 `FOR UPDATE` 与 `FOR KEY SHARE` 冲突）。因此 `SELECT ... FROM project WHERE id = ... FOR UPDATE` 的实际影响远大于预期：**该 Project 下所有表的所有 INSERT（人物、节点、谱文、媒体……）都会在外键检查上排队**。你以为锁的是「世系变更」，实际锁住的是整个项目的写入。

改法：改用事务级 advisory lock，只约束真正需要串行化的写者，且不与任何外键锁冲突：

```sql
-- 语句时：串行化同 Project 的世系父边写入
PERFORM pg_advisory_xact_lock(hashtextextended('yunpu:relation:' || NEW.project_id::text, 0));
```

`pg_advisory_xact_lock` 随事务结束自动释放，不存在锁泄漏；`hashtextextended` 是 PG11+ 内置函数，无需扩展。

> 最小改动替代方案：`FOR NO KEY UPDATE` 也不与 `KEY SHARE` 冲突，但会锁住 project 行并把 project 表纳入事务冲突面，仍劣于 advisory lock。**本项目选 advisory lock。**

**`DM-REL-11` 锁的作用域断言**：advisory lock 只作用于**世系父边写入者**，不得影响同一 Project 的其他写入。验收清单 #13 必须同时验证「冲突边互相阻塞」与「同 Project 的人物 INSERT 不被阻塞」。

**锁顺序与超时**（`DM-REL-06`）：

| 项 | 规定 |
|---|---|
| 锁键 | `hashtextextended('yunpu:relation:' \|\| project_id::text, 0)`；世系锁在前，谱系锁在后 |
| 锁顺序 | 全局唯一：`yunpu:relation:<project_id>` → `yunpu:lineage:<lineage_id>`。字母序前缀固定，禁止反向获取；跨域事务一律按此序。 |
| 与行锁混用 | 任何事务内**先取 advisory lock，再取行锁**（如 `lineage` 行锁）。禁止先取行锁再取 advisory lock。 |
| `lock_timeout` | 连接级默认 `3s`。拿不到锁即失败并回滚，不无限等待。 |
| `statement_timeout` | 连接级默认 `30s`。单条语句超时即报错回滚。 |
| `idle_in_transaction_session_timeout` | 连接级默认 `60s`。挂起的事务自动终止，防止 advisory lock 长期占用。 |

三个超时是**会话级 GUC**，**必须由连接串下发，不能靠应用每次 `SET`**：

```
PGOPTIONS='-c lock_timeout=3000 -c statement_timeout=30000 -c idle_in_transaction_session_timeout=60000'
```

> **v1.2 修复（`DM-POOL-01`）**：1.1 版写「三个超时在连接池的连接初始化时统一 `SET`」。会话级 `SET` 与 **PgBouncer 事务池化**不兼容——事务池化会把同一个后端连接交给不同会话，会话级设置会串味；而如果不用池化直接用应用侧池（如 `pg` 的 `max` 池），`SET` 只在池化连接上生效一次，之后新建的连接就没有设置。这条必须落到连接串 `PGOPTIONS`，由服务端在每次连接建立时施加，与池化模式无关。
>
> 另一条配套要求：Drizzle 连接必须设 `prepare: false`。服务端 prepared statement 与 `SET LOCAL ROLE` / `SET LOCAL` 组合时，语句在池化复用下会带着上一个会话的角色执行。

> `DM-REL-07` 并发正确性必须在目标仓库的真实 PostgreSQL 18 上实测（验收清单 #9、#10），文档描述不替代验证。

### 5.9 `event` — 事件

| 字段 | 类型 | 空 | 默认 | 约束 / 说明 |
|---|---|---|---|---|
| `id` | `uuid` | 否 | `uuidv7()` | |
| `organization_id` | `uuid` | 否 | | |
| `project_id` | `uuid` | 否 | | |
| `kind` | `text` | 否 | | 见下方域 |
| `person_id` | `uuid` | 是 | | Person 事件主体 |
| `relation_id` | `uuid` | 是 | | Relation 事件主体 |
| `date_text` | `text` | 是 | | 原文日期，如「康熙二十年冬月」 |
| `calendar` | `text` | 否 | `'unknown'` | `gregorian` / `chinese_lunisolar` / `other` / `unknown` |
| `date_precision` | `text` | 否 | `'unknown'` | `day` / `month` / `year` / `approximate` / `before` / `after` / `unknown` |
| `date_start` | `date` | 是 | | 可可靠换算的公历下界 |
| `date_end` | `date` | 是 | | 可可靠换算的公历上界 |
| `place_text` | `text` | 是 | | 原始地名 |
| `summary` | `text` | 是 | | |
| `created_at` | `timestamptz` | 否 | `now()` | |
| `updated_at` | `timestamptz` | 否 | `now()` | 触发器维护 |

```sql
CHECK (num_nonnulls(person_id, relation_id) = 1)

CHECK (person_id IS NULL OR kind IN (
  'birth', 'death', 'burial', 'migration', 'office', 'exam', 'other'
))
CHECK (relation_id IS NULL OR kind IN (
  'marriage', 'divorce', 'adoption', 'heir_transfer', 'other'
))

CHECK (calendar IN ('gregorian', 'chinese_lunisolar', 'other', 'unknown'))
CHECK (date_precision IN (
  'day', 'month', 'year', 'approximate', 'before', 'after', 'unknown'
))
CHECK (date_start IS NULL OR date_end IS NULL OR date_start <= date_end)

-- 至少一个字段有实质内容：纯空白不算内容
CHECK (
  (date_text  IS NOT NULL AND btrim(date_text)  <> '')
  OR (place_text IS NOT NULL AND btrim(place_text) <> '')
  OR (summary    IS NOT NULL AND btrim(summary)    <> '')
)
```


外键（v1.2 补齐，1.1 版只用散文描述）：

```sql
FOREIGN KEY (project_id, person_id)   REFERENCES person(project_id, id)         ON DELETE RESTRICT
FOREIGN KEY (project_id, relation_id) REFERENCES person_relation(project_id, id) ON DELETE RESTRICT
```

- `DM-EVT-02` 事件恰好关联 Person 或 Relation = `CHECK (num_nonnulls(...) = 1)`。
- `DM-EVT-03` 事件类型属于对应域 = 两个域 CHECK。
- `DM-EVT-04` 事件日期范围有序 = `CHECK (date_start <= date_end)`。
- `DM-EVT-01` 上面的 CHECK 取代旧版 `date_text IS NOT NULL OR place_text IS NOT NULL OR summary IS NOT NULL`——旧写法可被纯空白字符串满足，属于漏洞。
- **不建**「每人最多一条被采纳的出生/死亡事件」索引。事件表没有「被采纳」列，多份史料并存是常态。
- `other` 同时属于两个域；归属由 `person_id` / `relation_id` 二选一决定，不引入 `event.scope`。
- 「Relation 类型与 Event 类型匹配」（`marriage` 事件只挂在 `spouse`/`partner` 关系上）是**应用层软不变量**，用测试保证；数据库不做跨表语义推断（`DM-EVT-05`，登记于 §8.2）。
- 日期原文是证据；`date_start/date_end` 是可空辅助，不得用规范化值覆盖 `date_text`。

索引：

- `idx_event_person (project_id, person_id, kind) WHERE person_id IS NOT NULL`。
- `idx_event_relation (project_id, relation_id, kind) WHERE relation_id IS NOT NULL`。
- `idx_event_date (project_id, date_start)`。

### 5.10 `lineage` — 谱系

| 字段 | 类型 | 空 | 默认 | 约束 / 说明 |
|---|---|---|---|---|
| `id` | `uuid` | 否 | `uuidv7()` | |
| `organization_id` | `uuid` | 否 | | |
| `project_id` | `uuid` | 否 | | |
| `folder_id` | `uuid` | 是 | | 删除 Folder 时置空 |
| `name` | `text` | 否 | | 同 Project 内唯一；非空白 |
| `description` | `text` | 是 | | |
| `poem_text` | `text` | 是 | | 字辈诗/派语 |
| `base_generation` | `integer` | 否 | `1` | `> 0`；根节点的世次 |
| `seq` | `integer` | 否 | `0` | `>= 0` |
| `created_at` | `timestamptz` | 否 | `now()` | |
| `updated_at` | `timestamptz` | 否 | `now()` | 触发器维护 |

- `PRIMARY KEY (project_id, id)`。
- `fk_lineage_project`、`fk_lineage_folder`（列清单式 `SET NULL (folder_id)`）。
- `UNIQUE (project_id, name)`。
- `ck_lineage_name_not_blank`、`ck_lineage_base_generation`、`ck_lineage_seq`。
- 世次读时派生：`generation = nlevel(path)`；展示代数 = `nlevel(path) + base_generation - 1`。不在 Person 上存储 generation。

索引：`idx_lineage_project_seq (project_id, seq)`；**`idx_lineage_folder (project_id, folder_id)`（v1.2 补，`DM-GEN-17`）**。

### 5.11 `node` — 编纂位置

Node 是「一个人在某条 Lineage 中的编纂位置」，不是人物事实本身。

| 字段 | 类型 | 空 | 默认 | 约束 / 说明 |
|---|---|---|---|---|
| `id` | `uuid` | 否 | `uuidv7()` | |
| `organization_id` | `uuid` | 否 | | |
| `project_id` | `uuid` | 否 | | |
| `lineage_id` | `uuid` | 否 | | |
| `person_id` | `uuid` | 是 | | `annotation` 必须为 NULL，其余必须非空 |
| `path` | `ltree` | 否 | | 固定四位数字段 |
| `parent_path` | `ltree` | 是 | 生成列 | 根为 NULL；**必须 `STORED`** |
| `kind` | `text` | 否 | | `primary` / `reference` / `annotation` |
| `display_name` | `text` | 是 | | 该位置的显示覆盖值；有值时非空白 |
| `placement_relation_id` | `uuid` | 是 | | 编者判断依据 |
| `placement_note` | `text` | 是 | | |
| `created_at` | `timestamptz` | 否 | `now()` | |
| `updated_at` | `timestamptz` 否 | `now()` | 触发器维护 |

生成列与自引用外键：

```sql
parent_path ltree
  GENERATED ALWAYS AS (
    CASE WHEN nlevel(path) > 1
         THEN subpath(path, 0, nlevel(path) - 1)
         ELSE NULL END
  ) STORED,

FOREIGN KEY (project_id, lineage_id, parent_path)
  REFERENCES node (project_id, lineage_id, path)
  DEFERRABLE INITIALLY DEFERRED
```

> **`STORED` 是强制的**（v1.2，实测 #01）：PG 18 起 `GENERATED ALWAYS AS (...)` **默认是 `VIRTUAL`**；而虚拟生成列**不允许使用用户自定义类型**，`ltree` 正是用户自定义类型。省略 `STORED` 的 DDL 在 PG 18 上直接被拒绝。同时，虚拟生成列不能出现在外键的引用侧，而 `parent_path` 正是被引用的那一侧——双重不兼容。这条必须写死（`DM-GEN-20`）。

> 必须用 `CASE`。`subpath(path, 0, nlevel(path) - 1)` 在根节点返回空 ltree，不是 `NULL`；直接写会让所有根共享空路径并触发外键失败。

其余约束：

```sql
CHECK (path::text ~ '^[0-9]{4}([.][0-9]{4})*$')
CHECK (kind IN ('primary', 'reference', 'annotation'))
CHECK ((kind = 'annotation') = (person_id IS NULL))
CHECK (display_name IS NULL OR btrim(display_name) <> '')
UNIQUE (project_id, lineage_id, path)
```

- `UNIQUE (project_id, lineage_id, path)` 是父外键的被引用键，也是子树的结构性无环保证：父路径必须严格短于子路径，环在结构上不可能出现。
- 每人每 Lineage 最多一个 primary（`DM-NOD-04`）：

```sql
CREATE UNIQUE INDEX uq_node_one_primary
  ON node (project_id, lineage_id, person_id)
  WHERE kind = 'primary';
```

- **根 = `parent_path IS NULL` 的节点**。1.0 不建 `lineage_root` 表；需要兼容查询时使用只读视图 `app.lineage_root`。
- 路径段固定 4 位，兄弟采用步长 10。达到上限时在事务内重排该父节点下的兄弟及其子树；这是运维/重排脚本的职责，不是日常写入路径。
- **路径容量（v1.2 显式化）**：4 位段 + 步长 10 ⇒ 单层最多 9990 个兄弟节点，且第 10 层以后路径长度超过 PostgreSQL `ltree` 标签上限前的实际容量。**上限触达时的处置是「重建该 lineage」**，不是「扩展路径段宽」——扩展段宽会让 `ck_node_path_format` 的正则、既有数据、以及所有依赖 4 位的解析逻辑同时失效。该结论记入 `DM-ADR-10`。
- `placement_relation_id` 的语义（同 Project、`to_person_id` 是当前 Node 的 Person、`kind` 属于世系父边）是**软不变量**（`DM-NOD-07`），由用例和测试保证；外键只保证关系存在且同 Project。

**`DM-NOD-01` 重排纪律**：`uk_node_path` 是**即时**约束（不可延迟），因此兄弟重编号时「0010 改成 0020 而 0020 还在」会在语句中途自撞。两种合法做法，二选一：

- **推荐**：单条 `UPDATE ... SET path = CASE id ... END` 一次写完。唯一性在**语句结束**时才检查，语句内不撞。语句同时改写整棵子树的 `path`，`parent_path` 由 STORED 生成列自动维护。
- **备选**：把约束建成 `DEFERRABLE INITIALLY DEFERRED`，同一事务内分步改写。

**选定：推荐方案（单语句一次写完），约束保持即时。** 重排脚本 `scripts/reorder-node-siblings.ts` 必须遵循此纪律，且必须在事务内执行。

索引：

- `node_path_gist`：**v1.2 改为复合 GiST** `USING gist (project_id, lineage_id, path)`，需 `btree_gist` 扩展（§2）。理由：1.1 版的单列 GiST 只索引 `path`，而实际查询（子树、祖先、按谱系取节点）永远同时带 `project_id` 与 `lineage_id`；单列 GiST 会把不同谱系的同形路径混在一个索引里，靠回表再过滤。`btree_gist` 让 `uuid` 的等值算子与 `ltree` 的范围/子串算子共存于一个 GiST 索引。
- `idx_node_parent (project_id, lineage_id, parent_path)`：按父路径查子节点。
- `idx_node_person (project_id, person_id)`：查某人的所有编纂位置。

### 5.12 `source` — 来源

| 字段 | 类型 | 空 | 默认 | 约束 / 说明 |
|---|---|---|---|---|
| `id` | `uuid` | 否 | `uuidv7()` | |
| `organization_id` | `uuid` | 否 | | |
| `project_id` | `uuid` | 否 | | |
| `kind` | `text` | 否 | `'other'` | `genealogy_book` / `local_chronicle` / `inscription` / `contract` / `oral` / `photograph` / `official_record` / `other` |
| `title` | `text` | 否 | | 非空白 |
| `author_text` | `text` | 是 | | |
| `publication_text` | `text` | 是 | | |
| `repository_text` | `text` | 是 | | 收藏地/馆藏 |
| `external_ref` | `text` | 是 | | 外部编号/链接 |
| `notes` | `text` | 是 | | |
| `created_at` | `timestamptz` | 否 | `now()` | |
| `updated_at` | `timestamptz` | 否 | `now()` | 触发器维护 |

- `PRIMARY KEY (project_id, id)`；`fk_source_project`；`ck_source_kind`、`ck_source_title_not_blank`。
- 索引：`idx_source_project_kind (project_id, kind)`。

### 5.13 `source_citation` — 考证引用

一行 Citation = 一个可判定的考证断言：某一页/某一图支持某一个具体事实。

| 字段 | 类型 | 空 | 默认 | 约束 / 说明 |
|---|---|---|---|---|
| `id` | `uuid` | 否 | `uuidv7()` | |
| `organization_id` | `uuid` | 否 | | |
| `project_id` | `uuid` | 否 | | |
| `source_id` | `uuid` | 否 | | 所属来源 |
| `person_id` | `uuid` | 是 | | 目标之一 |
| `person_name_id` | `uuid` | 是 | | 目标之一 |
| `relation_id` | `uuid` | 是 | | 目标之一 |
| `event_id` | `uuid` | 是 | | 目标之一 |
| `media_asset_id` | `uuid` | 是 | | 附加定位：扫描件/页图，不参与目标 XOR |
| `locator` | `text` | 是 | | 卷/页/条目 |
| `quotation` | `text` | 是 | | 原文摘录 |
| `reliability` | `text` | 否 | `'unknown'` | `high` / `medium` / `low` / `unknown` |
| `note` | `text` | 是 | | |
| `created_at` | `timestamptz` | 否 | `now()` | |
| `updated_at` | `timestamptz` | 否 | `now()` | 触发器维护 |

```sql
CHECK (num_nonnulls(person_id, person_name_id, relation_id, event_id) = 1)
CHECK (reliability IN ('high', 'medium', 'low', 'unknown'))
```

外键（v1.2 补齐显式定义，1.1 版只有散文）：

```sql
FOREIGN KEY (project_id, source_id)      REFERENCES source(project_id, id)            ON DELETE RESTRICT
FOREIGN KEY (project_id, person_id)      REFERENCES person(project_id, id)            ON DELETE RESTRICT
FOREIGN KEY (project_id, person_name_id) REFERENCES person_name(project_id, id)       ON DELETE RESTRICT
FOREIGN KEY (project_id, relation_id)    REFERENCES person_relation(project_id, id)   ON DELETE RESTRICT
FOREIGN KEY (project_id, event_id)       REFERENCES event(project_id, id)             ON DELETE RESTRICT
```

- 四个目标列恰好一个非空。不允许多目标、不引入引用组表。
- 同一页支持多个事实时，建立多条 Citation，可共用同一个 `source_id` 和 `locator`。
- `media_asset_id` 与四个目标列可以并存，仅表示「这条引用对应的扫描图/页图」；其外键为 `(project_id, media_asset_id) → media_asset(project_id, id)`，`ON DELETE RESTRICT`。
- 所有目标、Source、MediaAsset 必须同 Project，由复合外键保证（`DM-SRC-01`）。
- `reliability` 是编者对「这条引用支持该目标」的评价，不是对整份 Source 的绝对评级。
- **v1.2 说明**：本表**不加**「同断言去重」唯一约束。理由：四目标列均为可空，PostgreSQL 的普通 `UNIQUE` 在含 NULL 时视为互不相同（`NULLS DISTINCT` 语义），去重约束需要 `UNIQUE NULLS NOT DISTINCT`（PG 15+），而该写法会连带把 `locator`、`quotation` 等自由文本列纳入去重键，导致「同一断言的两次不同摘录」被误判为重复。考证场景下「同页同目标的两次引用」是有意义的留痕，不应被数据库阻止。若 V2 需要，改用 `NULLS NOT DISTINCT` 且只覆盖 `(project_id, source_id, 目标列, locator)`。

索引：`idx_source_citation_source`、`_person`、`_person_name`、`_relation`、`_event`、`_media`（均含 `project_id` 首列，四个目标索引为部分索引）。

### 5.14 `article` — 谱文

| 字段 | 类型 | 空 | 默认 | 约束 / 说明 |
|---|---|---|---|---|
| `id` | `uuid` | 否 | `uuidv7()` | |
| `organization_id` | `uuid` | 否 | | |
| `project_id` | `uuid` | 否 | | |
| `folder_id` | `uuid` | 是 | | 删除 Folder 时置空 |
| `title` | `text` | 否 | | 非空白 |
| `kind` | `text` | 否 | `'other'` | `biography` / `preface` / `appendix` / `essay` / `other` |
| `author_text` | `text` | 是 | | |
| `date_text` | `text` | 是 | | 原文纪年 |
| `subject_person_id` | `uuid` | 是 | | 文章主体人物 |
| `lineage_id` | `uuid` | 是 | | 关联谱系 |
| `created_at` | `timestamptz` | 否 | `now()` | |
| `updated_at` | `timestamptz` | 否 | `now()` | 触发器维护 |

- `PRIMARY KEY (project_id, id)`。
- `fk_article_project`、`fk_article_folder`（`SET NULL (folder_id)`）、`fk_article_subject_person`（`RESTRICT`）、`fk_article_lineage`（`RESTRICT`）。
- `ck_article_kind`、`ck_article_title_not_blank`。
- `subject_person_id` 与 `lineage_id` 可以同时存在。
- 被 `book_catalog` 引用时不允许删除。

索引：`idx_article_project_kind`、`idx_article_subject`（部分）、**`idx_article_lineage`（部分，v1.2 补）**、**`idx_article_folder`（v1.2 补）**。

### 5.15 `article_page` — 分页富文本

| 字段 | 类型 | 空 | 默认 | 约束 / 说明 |
|---|---|---|---|---|
| `id` | `uuid` | 否 | `uuidv7()` | |
| `organization_id` | `uuid` | 否 | | |
| `project_id` | `uuid` | 否 | | |
| `article_id` | `uuid` | 否 | | |
| `seq` | `integer` | 否 | | `> 0`；同篇唯一 |
| `content` | `jsonb` | 否 | 合法空文档 | 每页一个 TipTap 文档 |
| `version` | `integer` | 否 | `1` | `> 0`；乐观锁 |
| `created_at` | `timestamptz` | 否 | `now()` | |
| `updated_at` | `timestamptz` | 否 | `now()` | 触发器维护 |

```sql
content jsonb NOT NULL
  DEFAULT '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb
CHECK (content ? 'type')
CHECK (jsonb_typeof(content) = 'object')
CHECK (seq > 0)
CHECK (version > 0)
UNIQUE (project_id, article_id, seq)
```

- `fk_article_page_article`：`ON DELETE CASCADE`。页从属于文章。
- 乐观锁：`UPDATE ... WHERE project_id = ? AND id = ? AND version = ?`，成功后 `version = version + 1`。版本冲突返回 `409`。
- `content` 只校验存在 `type` 键且顶层是对象；更深的结构校验交给应用层，数据库不解析 TipTap 文档（`DM-ART-01`）。


索引：`idx_article_page_article (project_id, article_id, seq)`。

### 5.16 `media_asset` — 媒体资产

| 字段 | 类型 | 空 | 默认 | 约束 / 说明 |
|---|---|---|---|---|
| `id` | `uuid` | 否 | `uuidv7()` | |
| `organization_id` | `uuid` | 否 | | |
| `project_id` | `uuid` | 否 | | |
| `object_key` | `text` | 否 | | 对象存储 key；**全局唯一** |
| `filename` | `text` | 否 | | 非空白 |
| `content_type` | `text` | 否 | | 非空白 |
| `byte_size` | `bigint` | 否 | | `> 0` |
| `checksum` | `text` | 否 | | SHA-256 十六进制，64 字符 |
| `created_by` | `uuid` | 是 | | `ON DELETE SET NULL` |
| `created_at` | `timestamptz` | 否 | `now()` | |
| `updated_at` | `timestamptz` | 否 | `now()` | 触发器维护 |

- `PRIMARY KEY (project_id, id)`。
- `UNIQUE (object_key)`：对象存储的命名空间是全局的，唯一性作用域必须匹配物理作用域。跨 Project 复用 key 被明确拒绝（`DM-MED-03`）。
- `ck_media_asset_object_key_not_blank`、`_filename_not_blank`、`_content_type_not_blank`、`_byte_size`、`_checksum`。
- 应用层负责生成带 Project 前缀的 key（如 `p/{project_id}/{uuid}`）；数据库只保证全局唯一。
- 删除被 `person_media` / `article_page_media` / `source_citation` 引用的资产会被 `RESTRICT` 拒绝。

**`DM-MED-01` 字节归属**：每个对象字节有唯一主人。

| 字节 | 主人 | 删除时机 |
|---|---|---|
| 媒体原文件 | `media_asset` 行 | 该行被删除且数据库提交之后 |
| 出版产物（PDF/EPUB） | `book_release` 行 | `purge` 提交之后 |

索引：`idx_media_asset_project_created (project_id, created_at)`。

### 5.17 `person_media`

| 字段 | 类型 | 空 | 默认 | 约束 / 说明 |
|---|---|---|---|---|
| `organization_id` | `uuid` | 否 | | |
| `project_id` | `uuid` | 否 | | |
| `person_id` | `uuid` | 否 | | |
| `media_asset_id` | `uuid` | 否 | | |
| `role` | `text` | 否 | `'other'` | `portrait` / `photo` / `document` / `other` |
| `seq` | `integer` | 否 | `0` | `>= 0` |
| `created_at` | `timestamptz` | 否 | `now()` | |

- `PRIMARY KEY (project_id, person_id, media_asset_id)`。
- `fk_person_media_project`：`(organization_id, project_id) → project(organization_id, id)`，`ON DELETE RESTRICT`（**v1.2 补**，`DM-SCP-02`）。
- `fk_person_media_person`：`ON DELETE CASCADE`；`fk_person_media_media`：`ON DELETE RESTRICT`（不静默删文件）。
- `ck_person_media_role`、`ck_person_media_seq`。
- 索引：`idx_person_media_media (project_id, media_asset_id)`，供删除检查。

### 5.18 `article_page_media`

| 字段 | 类型 | 空 | 默认 | 约束 / 说明 |
|---|---|---|---|---|
| `organization_id` | `uuid` | 否 | | |
| `project_id` | `uuid` | 否 | | |
| `article_page_id` | `uuid` | 否 | | |
| `media_asset_id` | `uuid` | 否 | | |
| `created_at` | `timestamptz` | 否 | `now()` | |

- `PRIMARY KEY (project_id, article_page_id, media_asset_id)`。
- `fk_article_page_media_project`：`(organization_id, project_id) → project(organization_id, id)`，`ON DELETE RESTRICT`（**v1.2 补**，`DM-SCP-02`）。
- `fk_article_page_media_page`：`ON DELETE CASCADE`；`fk_article_page_media_media`：`ON DELETE RESTRICT`。
- 这张表只登记「TipTap JSON 中使用了哪些媒体」，不解析文档内容；一致性由应用层保存流程保证。
- 索引：`idx_article_page_media_media (project_id, media_asset_id)`。

### 5.19 `book` — 谱书

| 字段 | 类型 | 空 | 默认 | 约束 / 说明 |
|---|---|---|---|---|
| `id` | `uuid` | 否 | `uuidv7()` | |
| `organization_id` | `uuid` | 否 | | |
| `project_id` | `uuid` | 否 | | |
| `folder_id` | `uuid` | 是 | | 删除 Folder 时置空 |
| `title` | `text` | 否 | | 非空白 |
| `edition_text` | `text` | 是 | | 版次/版本描述 |
| `compiler_text` | `text` | 是 | | 纂修者 |
| `created_at` | `timestamptz` | 否 | `now()` | |
| `updated_at` | `timestamptz` | 否 | `now()` | 触发器维护 |

- `PRIMARY KEY (project_id, id)`；`fk_book_project`、`fk_book_folder`（`SET NULL (folder_id)`）；`ck_book_title_not_blank`。
- 存在任何 `book_release`（无论是否作废）时不能删除；必须先逐个 `purge`。

索引：`idx_book_project_created (project_id, created_at)`；**`idx_book_folder (project_id, folder_id)`（v1.2 补）**。

### 5.20 `book_catalog` — 编目树

| 字段 | 类型 | 空 | 默认 | 约束 / 说明 |
|---|---|---|---|---|
| `id` | `uuid` | 否 | `uuidv7()` | |
| `organization_id` | `uuid` | 否 | | |
| `project_id` | `uuid` | 否 | | |
| `book_id` | `uuid` | 否 | | |
| `path` | `ltree` | 否 | | 固定四位数字段 |
| `parent_path` | `ltree` | 是 | 生成列 | 根为 NULL；**必须 `STORED`** |
| `kind` | `text` | 否 | | `part` / `chapter` / `section` / `article` / `lineage` |
| `title` | `text` | 否 | | 非空白 |
| `article_id` | `uuid` | 是 | | `kind='article'` 时必填 |
| `lineage_id` | `uuid` | 是 | | `kind='lineage'` 时必填 |
| `created_at` | `timestamptz` | 否 | `now()` | |
| `updated_at` | `timestamptz` | 否 | `now()` | 触发器维护 |

生成列与自引用外键与 `node` 同款：

```sql
parent_path ltree
  GENERATED ALWAYS AS (
    CASE WHEN nlevel(path) > 1
         THEN subpath(path, 0, nlevel(path) - 1)
         ELSE NULL END
  ) STORED,

FOREIGN KEY (project_id, book_id, parent_path)
  REFERENCES book_catalog (project_id, book_id, path)
  DEFERRABLE INITIALLY DEFERRED
```

内容匹配 CHECK：

```sql
CHECK (
  (kind = 'article' AND article_id IS NOT NULL AND lineage_id IS NULL)
  OR (kind = 'lineage' AND lineage_id IS NOT NULL AND article_id IS NULL)
  OR (kind IN ('part', 'chapter', 'section')
      AND article_id IS NULL AND lineage_id IS NULL)
)
CHECK (kind IN ('part', 'chapter', 'section', 'article', 'lineage'))
CHECK (path::text ~ '^[0-9]{4}([.][0-9]{4})*$')
CHECK (btrim(title) <> '')
UNIQUE (project_id, book_id, path)
```

- `fk_book_catalog_book`：`ON DELETE CASCADE`；`fk_book_catalog_article` / `fk_book_catalog_lineage`：`ON DELETE RESTRICT`。
- 一个目录项最多引用一种内容，且引用类型必须与 `kind` 匹配（`DM-BOK-04`）。
- 索引：**复合 GiST** `USING gist (project_id, book_id, path)`（v1.2 同 `node`）、`idx_book_catalog_parent`、`idx_book_catalog_article`（部分）、`idx_book_catalog_lineage`（部分）。

### 5.21 `book_release` — 出版快照

已交付的出版快照。**快照不可变 ≠ 记录永不可删**。

| 字段 | 类型 | 空 | 默认 | 约束 / 说明 |
|---|---|---|---|---|
| `id` | `uuid` | 否 | `uuidv7()` | |
| `organization_id` | `uuid` | 否 | | |
| `project_id` | `uuid` | 否 | | |
| `book_id` | `uuid` | 否 | | |
| `version` | `integer` | 否 | | `> 0`；同书唯一 |
| `content_snapshot` | `jsonb` | 否 | | 生成时的完整内容快照 |
| `snapshot_checksum` | `text` | 否 | | SHA-256，64 字符 |
| `artifact_uri` | `text` | 是 | | 导出的 PDF/EPUB 等；**字节主人是本行** |
| `artifact_checksum` | `text` | 是 | | 与 `artifact_uri` 同生共死 |
| `format` | `text` | 否 | | `pdf` / `epub` / `docx` / `html` |
| `template_version` | `text` | 是 | | |
| `revoked_at` | `timestamptz` | 是 | | 作废时间 |
| `revoked_reason` | `text` | 是 | | 非空白 |
| `created_by` | `uuid` | 是 | | `ON DELETE SET NULL` |
| `created_at` | `timestamptz` | 否 | `now()` | |

```sql
PRIMARY KEY (project_id, id)
UNIQUE (project_id, book_id, version)
CHECK (version > 0)
CHECK (format IN ('pdf', 'epub', 'docx', 'html'))
CHECK (snapshot_checksum ~ '^[a-f0-9]{64}$')
CHECK (artifact_checksum IS NULL OR artifact_checksum ~ '^[a-f0-9]{64}$')
CHECK ((artifact_uri IS NULL) = (artifact_checksum IS NULL))
CHECK ((revoked_at IS NULL) = (revoked_reason IS NULL))
CHECK (revoked_reason IS NULL OR btrim(revoked_reason) <> '')
```

- `fk_book_release_book`：`ON DELETE RESTRICT`。Book 只有在所有 release 被 `purge` 后才能删除。
- **v1.2**：主键改为 `(project_id, id)`，与 §4.3 通则一致；同时补 `fk_book_release_project`（`(organization_id, project_id) → project`），否则本表可以脱离 Project 存在。
- 快照字段永不更新；触发器 `app.guard_book_release_snapshot()` 兜底。
- 业务角色只有 `SELECT` / `INSERT`；没有 `UPDATE` / `DELETE`。作废与清除只能走 `app.revoke_book_release()` / `app.purge_book_release()`。
- `revoke`：标记 `revoked_at` / `revoked_reason`，写审计；可逆性留痕。
- `purge`：要求已作废且调用者是组织 owner；物理删除行、写审计，并在**事务提交后**删除产物字节（`DM-MED-01`）。

**`DM-BOK-05` 产物字节纪律**：`artifact_uri` 指向的字节归 `book_release` 行所有。

- 生成：出版流程先写字节，再写 `book_release` 行（含 `artifact_uri` 与 `artifact_checksum`）。行不存在则字节是孤儿，见 `DM-MED-02`。
- 删除：`purge` 的顺序是 **先删行（提交）→ 再删字节**。反序会产生悬空引用。
- `purge` 时若 `artifact_uri` 非空但对象不存在，抛 `GX011`，不静默放过——状态不一致必须响亮。
- 若 `artifact_uri` 为空（未产出实体文件，仅有快照），`purge` 不涉及字节删除。

**`DM-MED-02` 孤儿字节回收**：代理上传方案的固有代价——上传成功但 DB 写入失败会留下没有数据库行的字节。「清理无引用资产」是按数据库行找对象的，看不见这类孤儿。因此必须有**桶级对账脚本**：

- `scripts/reconcile-media.ts`：定期（每日）列出对象存储中 `p/` 前缀下的全部对象，与 `media_asset.object_key` 求差集。
- 差集对象先写入候选表/报告，人工或策略确认后再删除；**默认不自动删除**（避免删掉正在上传中的对象）。
- 保护期：对象修改时间早于 24 小时的一律跳过。

索引：`idx_book_release_book (project_id, book_id, created_at)`。

### 5.22 `audit_log` — 审计

日志，不是业务事实来源。它没有外键，因为「目标实体删除后日志仍要保留」。

| 字段 | 类型 | 空 | 默认 | 约束 / 说明 |
|---|---|---|---|---|
| `id` | `uuid` | 否 | `uuidv7()` | 主键 |
| `organization_id` | `uuid` | 否 | | 租户 |
| `project_id` | `uuid` | 是 | | 组织级动作为 NULL |
| `actor_user_id` | `uuid` | 是 | | 系统动作为 NULL |
| `action` | `text` | 否 | | 如 `book_release.revoked` |
| `entity_type` | `text` | 否 | | 由 `TABLE_NAMES` 生成 |
| `entity_id` | `uuid` | 是 | | 目标删除后仍保留 |
| `payload` | `jsonb` | 否 | `'{}'` | 附加信息 |
| `created_at` | `timestamptz` | 否 | `clock_timestamp()` | **v1.2 变更** |

- `ck_audit_log_entity_type` 的取值清单由 `TABLE_NAMES` 派生生成，不再手抄第二份（`DM-GEN-02`）。
- `ck_audit_log_action_not_blank`。
- **只追加**：业务角色只有 `SELECT` / `INSERT`；`app.guard_append_only()` 对 UPDATE/DELETE 抛 `GX004` 作为第二道防线。
- 组织级动作（创建组织、转移 owner、邀请接受）写 `project_id = NULL`。
- **v1.2 变更**：`created_at` 默认改为 `clock_timestamp()`。1.1 版用 `now()`，导致同一事务内写入的多条审计日志时间戳完全相同——按时间排序无法定序，按时间分区也无法裁剪。这不是理论问题：一次 `purge` 会在同一事务里写多条审计。
- 索引：`idx_audit_log_org_created`、`idx_audit_log_project_created`（部分）、`idx_audit_log_entity`。

**`DM-AUD-01` 审计的完整性分级（诚实降级）**：审计不是靠「大家记得调」来保证的。本文档把审计拆成两级，并明确各自的保证强度：

| 级别 | 范围 | 执行者 | 保证 |
|---|---|---|---|
| **强审计** | 组织创建、owner 转移、邀请兑换/撤销、出版 revoke/purge | 对应的 `SECURITY DEFINER` 函数内部 `INSERT audit_log` | **DB 级保证**：绕过应用直接改表也留痕（受控路径本来就不给业务角色 UPDATE/DELETE 权限） |
| **尽力而为审计** | 人物、关系、事件、谱文、来源、媒体、目录等常规业务写入 | 各域 service 调 `audit.record()` | **应用级保证**：漏写不会被任何东西拦下，因此**不承诺完整** |

规则：

- 强审计路径上的每一条写操作**必须**在受控函数里留痕，不依赖调用方自觉。
- 尽力而为审计路径上，`audit.record()` 失败**不得**让业务写入回滚（审计不能成为可用性单点），但必须写日志并计入指标 `audit_write_failures_total`。
- **本模型不声称审计日志完整无缺。** 需要全量审计的场景（合规要求）必须先加 `AFTER` 写触发器统一落审计，再把对应条目从「尽力而为」升级为「强审计」——这是显式的后续动作，不是隐含保证。

---

## 6. 视图

业务视图只有两个，都是只读投影，且必须 `security_invoker = true`（`DM-RLS-03`）。

### 6.1 `app.lineage_root`

```sql
CREATE VIEW app.lineage_root
WITH (security_invoker = true) AS
SELECT n.project_id,
       n.lineage_id,
       n.id            AS node_id,
       n.display_name  AS label,
       n.placement_note AS note
FROM node n
WHERE n.parent_path IS NULL;
```

如果产品需要「只把人物节点算作根」，查询侧加 `AND n.kind <> 'annotation'`；数据库不为此增加第二份状态。

### 6.2 `app.citation_person`

把一条 Citation 归一化为「一行一个人物」，供「这条来源支持了哪些人物」的查询使用。

```sql
CREATE VIEW app.citation_person
WITH (security_invoker = true) AS
SELECT c.id AS citation_id, c.project_id, c.source_id, c.locator,
       'person'::text AS subject_kind, c.person_id AS person_id
FROM source_citation c
WHERE c.person_id IS NOT NULL

UNION ALL
SELECT c.id, c.project_id, c.source_id, c.locator,
       'person_name', pn.person_id
FROM source_citation c
JOIN person_name pn
  ON pn.project_id = c.project_id AND pn.id = c.person_name_id
WHERE c.person_name_id IS NOT NULL

UNION ALL
SELECT c.id, c.project_id, c.source_id, c.locator,
       'relation', r.from_person_id
FROM source_citation c
JOIN person_relation r
  ON r.project_id = c.project_id AND r.id = c.relation_id
WHERE c.relation_id IS NOT NULL

UNION ALL
SELECT c.id, c.project_id, c.source_id, c.locator,
       'relation', r.to_person_id
FROM source_citation c
JOIN person_relation r
  ON r.project_id = c.project_id AND r.id = c.relation_id
WHERE c.relation_id IS NOT NULL

UNION ALL
SELECT c.id, c.project_id, c.source_id, c.locator,
       'event', e.person_id
FROM source_citation c
JOIN event e
  ON e.project_id = c.project_id AND e.id = c.event_id
WHERE c.event_id IS NOT NULL AND e.person_id IS NOT NULL

UNION ALL
SELECT c.id, c.project_id, c.source_id, c.locator,
       'event', r.from_person_id
FROM source_citation c
JOIN event e
  ON e.project_id = c.project_id AND e.id = c.event_id
JOIN person_relation r
  ON r.project_id = e.project_id AND r.id = e.relation_id
WHERE c.event_id IS NOT NULL AND e.relation_id IS NOT NULL

UNION ALL
SELECT c.id, c.project_id, c.source_id, c.locator,
       'event', r.to_person_id
FROM source_citation c
JOIN event e
  ON e.project_id = c.project_id AND e.id = c.event_id
JOIN person_relation r
  ON r.project_id = e.project_id AND r.id = e.relation_id
WHERE c.event_id IS NOT NULL AND e.relation_id IS NOT NULL;
```


- 一行一个人物，天然去重；不需要 `ARRAY_REMOVE`。
- `subject_kind` 保留原始目标类型。
- `security_invoker = true` 保证 RLS 以调用者身份执行。

---

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
| 38 | 展示顺序不唯一 | 无唯一索引；查询按 `(sort_order, id)` | 结构决策 | `DM-REL-04` |
| 39 | Node 编排依据的语义正确 | Use Case + 测试 | App | `DM-NOD-07` |
| 40 | 组织归档后禁止新写入 | Use Case 检查 `organization.status` | App | `DM-ORG-05` |
| 41 | 成员角色授权 | Service 层角色检查（矩阵单一来源） | App | `DM-ORG-07` |
| 42 | Relation 类型与 Event 类型匹配 | Use Case + 测试 | App | `DM-EVT-05` |
| 43 | Person 物理清除（GDPR） | V1 不做；独立运维流程 + 审计 | 流程 | `DM-GEN-16` |
| 44 | 所有外键的引用侧列有支撑索引 | 索引清单 + `db/verify/fk_indexes.sql` | DB | `DM-GEN-17` |
| 45 | 错误按 SQLSTATE + 约束名映射 | 应用层错误映射表 | App | `DM-GEN-18` |
| 46 | 清单类内容由生成物产出并反向校验 | `gen-sql.ts` + `db/verify/tables.sql` | DB + CI | `DM-GEN-19` |
| 47 | 不依赖数据库默认值（生成列显式 `STORED` 等） | DDL 审查 + `db/verify/generated_columns.sql` | DB | `DM-GEN-20` |
| 48 | 编号唯一且可追溯 | §18 编号索引表 + 文档评审 | 文档 | `DM-GEN-21` |
| 49 | 关系表 kind 取值单一来源 | 枚举生成器 | DB | `DM-REL-12` |
| 50 | 世系写锁不阻塞同 Project 其他写入 | advisory lock 语义 + 并发测试 | DB | `DM-REL-11` |

`CHECK` 只验证当前行，不查询其他行。跨行图规则、跨表语义、角色授权必须用唯一约束、外键、触发器或用例；不用 `CHECK` 假装。

### 7.2 软约束登记表（`DM-GEN-16`）

**软约束不是垃圾桶。** 每一条软约束必须在此登记，并写明补偿手段（用例 / 测试）。未登记的软约束视为文档缺陷。

| 编号 | 软约束 | 为什么 DB 不做 | 补偿手段 | 验收 |
|---|---|---|---|---|
| `DM-ORG-05` | 组织归档后禁止新写入 | 需要跨表查 `organization.status`，放触发器会让每次写入都多一次锁与查表；且归档是低频事件 | Use Case 层检查 | #38 |
| `DM-ORG-07` | 成员增删改的角色授权 | 「谁能改成员」是业务规则，不是结构规则 | Service 层角色矩阵（单一来源） | #41 |
| `DM-EVT-05` | Relation 类型与 Event 类型匹配（`marriage` 只挂 `spouse`/`partner`） | 跨表语义推断 | Use Case + 测试 | #42 |
| `DM-NOD-07` | `placement_relation_id` 的语义正确性 | 跨表语义推断 | Use Case + 测试 | #39 |
| `DM-GEN-16` | Person 物理清除（GDPR） | V1 不做 | 独立运维流程 + 审计 | — |
| `DM-MED-01` | 对象字节在事务提交后删除 | 跨系统事务，无两阶段提交 | 应用层提交后回调 + 对账脚本 | #34 / #26 |
| `DM-AUD-01` | 尽力而为审计路径 | 「大家记得调」不是约束 | 指标 `audit_write_failures_total` + 告警 | #32 |

---

## 8. RLS、角色与权限

### 8.1 角色

| 角色 | 职责 |
|---|---|
| 迁移角色 | 创建/修改 schema、表、索引、策略、函数、触发器；只用于迁移 |
| `genealogy_app` | 业务 API 数据库角色；非表 owner，无 `BYPASSRLS` |
| `genealogy_api` | 登录角色；只被授予 `genealogy_app`，无直接表权限；连接后 `SET LOCAL ROLE genealogy_app` |
| `rls_definer` | `NOLOGIN BYPASSRLS`；`SECURITY DEFINER` 函数的属主 |
| `auth_service` / `auth_runtime` | Better Auth 专用连接；不与业务连接共用 |

### 8.2 租户谓词

```sql
CREATE POLICY tenant_isolation ON person
  AS PERMISSIVE FOR ALL TO genealogy_app
  USING      (organization_id = ANY (app.visible_org_array()))
  WITH CHECK (organization_id = ANY (app.visible_org_array()));
```

要点：

1. **谓词必须写成 `= ANY (app.visible_org_array())`，不能写 `= ANY ((SELECT app.visible_org_array()))`**。后者会被 PostgreSQL 解析为**表子查询**比较而非标量数组表达式，实测报 `42883 operator does not exist: uuid = uuid[]`（§17 #05）——**核心租户谓词直接无法执行**。正确写法会被常量折叠为 InitPlan 求值一次（§17 #06）。
2. `FORCE ROW LEVEL SECURITY`：表 owner 也受策略约束。业务连接必须用非 owner 角色。
3. 上下文缺失时返回 `'{}'::uuid[]`，默认拒绝，不报错、不返回全表（`DM-RLS-01`）。
4. `organization` 表自身用 `id = ANY (...)`。
5. **所有业务表都启用 `ENABLE` + `FORCE ROW LEVEL SECURITY`**（`DM-RLS-02`）。1.1 版只给了 `person` 的样例策略，没有逐表矩阵——审计表与邀请表一旦漏掉策略就是跨租户泄露。v1.2 把策略矩阵变成生成物 `db/generated/rls_policies.sql`，并由 `db/verify/rls.sql` 逐表断言。

**逐表策略矩阵（v1.2 完整化）**：

| 表 | 策略谓词 | 备注 |
|---|---|---|
| `organization` | `id = ANY (...)` | 作用域是组织本身 |
| `organization_member` | `organization_id = ANY (...)` | |
| `invite` | `organization_id = ANY (...)` | 非成员看不到邀请；解析靠 `SECURITY DEFINER` 函数 |
| `project` | `organization_id = ANY (...)` | |
| `folder` / `person` / `person_name` / `person_relation` / `event` / `lineage` / `node` / `source` / `source_citation` / `article` / `article_page` / `media_asset` / `person_media` / `article_page_media` / `book` / `book_catalog` / `book_release` | `organization_id = ANY (...)` | 全部 18 张内容表同策略 |
| `audit_log` | `organization_id = ANY (...)` | 组织级审计 `project_id IS NULL` 仍受 `organization_id` 约束 |

> **索引策略的唯一说法**（`DM-IDX-01`）：索引按**查询模式**建，不设「RLS 谓词列必须是索引首列」这类机械规则。理由：`organization_id` 由 `project_id` 经复合外键强制推出，查询永远先按 project 收敛；RLS 的 org 谓词是安全网，不是访问路径。**本规则取代旧版「谓词列必须是首列」的表述，全文以本条为准。**
>
> **PG 18 补充**：多列 B-tree 现在支持 skip scan（§2.1 #7），因此 `(project_id, X)` 这类索引在 `project_id` 未被约束时也可能被用于 `X` 的查找。索引清单无需因此改动，但**测量方法**要变（§11.4）。

请求事务内设置上下文：

```sql
SET LOCAL ROLE genealogy_app;
SELECT set_config('app.user_id', $1, true);
```

`set_config(..., true)` 的 `is_local` 必须是 `true`；连接池复用不得继承上一个事务的上下文。

**v1.2 补充两条 fail-closed 纪律**：

1. **上下文解析必须容错**。`app.current_user_id()` 统一解析 `app.user_id`：GUC 为空 → 返回 NULL；GUC 不是合法 UUID → 捕获 `22P02` 并返回 NULL。**不得**让非法 GUC 直接抛错——那会变成 500 而不是「拒绝访问」。两种情况的结果一致：无可见组织。
2. **每事务开始断言角色**。`SET LOCAL ROLE genealogy_app` 失败不会使事务中止，只是不生效。因此每个事务入口必须断言 `current_user = 'genealogy_app'`，否则请求会在错误的权限下执行。

### 8.3 `app.visible_org_array()`

```sql
CREATE FUNCTION app.current_user_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_raw text;
BEGIN
  v_raw := NULLIF(current_setting('app.user_id', true), '');
  IF v_raw IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN v_raw::uuid;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NULL;                 -- 非法上下文 → 视为无上下文 → 策略 fail-closed
END;
$$;

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

- 属主 `rls_definer`，`BYPASSRLS`，`NOLOGIN`。
- 显式 `public.organization_member`，不依赖 `search_path`。
- `REVOKE ALL ON FUNCTION app.visible_org_array() FROM PUBLIC;`
- `GRANT EXECUTE ... TO genealogy_app;`
- `rls_definer` 必须拥有 `public` schema 的 `USAGE` 和 `organization_member` 的 `SELECT`。
- `app.current_user_id()` 为 `INVOKER` 权限的 `STABLE` 函数，**不要**加 `SECURITY DEFINER`——它只读 GUC，不需要绕过任何东西。

### 8.4 权限矩阵（`genealogy_app`）

| 表 | 权限 |
|---|---|
| `organization` | `SELECT`；`UPDATE (name, status, updated_at)`；**无** `INSERT` / `DELETE`；**无** `UPDATE (owner_user_id)` |
| `organization_member` | `SELECT`、`INSERT`、`UPDATE (role, updated_at)`、`DELETE` |
| `invite` | `SELECT`、`INSERT`；**无** `UPDATE` / `DELETE`（v1.2 变更，见下） |
| `project`、`folder` | `SELECT`、`INSERT`、`UPDATE`、`DELETE` |
| `person`、`person_name`、`person_relation`、`event` | 全 DML |
| `lineage`、`node` | 全 DML |
| `source`、`source_citation` | 全 DML |
| `article`、`article_page` | 全 DML |
| `media_asset`、`person_media`、`article_page_media` | 全 DML |
| `book`、`book_catalog` | 全 DML |
| `book_release` | `SELECT`、`INSERT`；**无** `UPDATE` / `DELETE` |
| `audit_log` | `SELECT`、`INSERT`；**无** `UPDATE` / `DELETE` |

- 业务角色没有 `CREATE` on schema；没有 `TRUNCATE`；没有 `BYPASSRLS`。
- 列级 `UPDATE` 授权必须包含 `updated_at`，否则 `app.touch_updated_at()` 触发器会因列权限失败；本表已显式列出。
- `organization.owner_user_id` 只能由 `app.transfer_organization_ownership()` 修改。
- `invite.token_hash` 不可更新：不在列级 `UPDATE` 白名单内。

> **v1.2 变更（`invite`）**：1.1 版给了 `genealogy_app` `UPDATE (status, accepted_at, revoked_at, updated_at)`。这等于开了一条旁路——业务代码只要能 UPDATE，就可以把任意 `pending` 邀请直接改成 `accepted` 并自行填 `accepted_at`，**完全绕过** `app.accept_invite()` 的邮箱一致性校验与并发抢占。v1.2 收回该权限，`invite` 的所有状态变更只经 `app.accept_invite()` / `app.revoke_invite()` 两个受控函数。

### 8.5 `rls_definer` 的权限清单（完整，`DM-PERM-01`）


`rls_definer` 是全系统唯一能合法绕过 RLS 的角色。它是 `SECURITY DEFINER` 函数的属主，权限必须**按函数最小化**，一份不多。

| 对象 | 权限 | 服务于 |
|---|---|---|
| `public.organization` | `SELECT` | `create_organization` / `transfer_ownership` 读 owner |
| | `INSERT (id, name, status, owner_user_id, created_at, updated_at)` | `create_organization` |
| | `UPDATE (owner_user_id, updated_at)` | `transfer_organization_ownership` |
| `public.organization_member` | `SELECT` | `visible_org_array`、`create_organization`、`transfer_ownership`、`accept_invite` |
| | `INSERT` | `create_organization`、`accept_invite` |
| | `UPDATE (role, updated_at)` | `transfer_ownership`、`accept_invite` |
| `public.invite` | `SELECT` | `resolve_invite_by_token`、`accept_invite`、`revoke_invite` |
| | `UPDATE (status, accepted_at, revoked_at, updated_at)` | `accept_invite` 抢占兑换、`revoke_invite` |
| `public.book_release` | `SELECT` | `revoke_book_release`、`purge_book_release` |
| | `UPDATE (revoked_at, revoked_reason)` | `revoke_book_release` |
| | `DELETE` | `purge_book_release` |
| `public.audit_log` | `INSERT` | 全部强审计路径 |
| `public` schema | `USAGE` | 全部函数 |
| `app.visible_org_array()` | `EXECUTE`（函数自身） | — |

**没有授予**：`rls_definer` 不持有 `person`、`node`、`article`、`media_asset` 等业务表的任何权限；不持有 `TRUNCATE`；不持有 `CREATE`；不持有 `book_catalog`、`source_citation` 的写权限。受控函数一律通过业务角色已有的权限路径工作，或显式声明新增项。

> **v1.2 变更：`transfer_organization_ownership` 改用 CAS，不再用 `SELECT ... FOR NO KEY UPDATE`。**
>
> 原因：`SELECT ... FOR NO KEY UPDATE` 需要**表级** `UPDATE` 权限，而 `rls_definer` 只有列级 `UPDATE (owner_user_id, updated_at)`。两者不匹配。
>
> 替代方案：先普通 `SELECT` 读出当前 owner，再用**条件更新**做乐观并发控制：
>
> ```sql
> UPDATE organization
>    SET owner_user_id = p_new_owner, updated_at = clock_timestamp()
>  WHERE id = p_org AND owner_user_id = v_prev;   -- CAS
> ```
>
> 影响行数为 0 → 说明并发下已被别人转移 → 抛 `GX010`。这个写法**不需要行锁、不需要额外权限**，并发语义与原来的 `FOR NO KEY UPDATE` 等价（两个并发事务只有一个能命中条件更新）。
>
> **注意**：CAS 只保护 `organization` 一行。真正需要串行化的是「读 owner → 校验 → 写 owner」这一整段；`UPDATE ... WHERE owner_user_id = v_prev` 把校验与写入合并成一条原子语句，因此不需要显式锁。

### 8.6 安全边界

- 自定义 GUC 是应用连接可设置的上下文，不是数据库认证身份。持有业务凭据且能执行任意 SQL 的攻击者可以伪造 `app.user_id`；RLS 降低遗漏租户条件的风险，但不能单独抵御凭据失陷。
- `SECURITY DEFINER` 函数必须以 `rls_definer` 为属主，`SET search_path = pg_catalog`，所有对象 schema-qualified，撤销 `PUBLIC` 执行权限。
- 视图必须 `security_invoker = true`。
- 超级用户和 `BYPASSRLS` 角色始终绕过 RLS；它们只用于迁移、备份和函数属主，不作为业务连接。

---

---

## 9. 函数、触发器与错误码

### 9.1 函数清单

`app` schema 下 16 个函数。所有 `SECURITY DEFINER` 函数属主为 `rls_definer`（`NOLOGIN BYPASSRLS`），一律 `SET search_path = pg_catalog`，一律 `REVOKE ALL ON FUNCTION ... FROM PUBLIC`。

| 函数 | 种类 | 权限 | 用途 | 错误码 |
|---|---|---|---|---|
| `app.current_user_id()` | `STABLE INVOKER` | `genealogy_app` | 解析 `app.user_id` GUC，非法值返回 NULL | — |
| `app.visible_org_array()` | `STABLE SECURITY DEFINER` | `genealogy_app` | 当前用户可见的组织数组（RLS 物化连接键） | — |
| `app.relation_kind_is_lineage_parent(text)` | `IMMUTABLE INVOKER` | `genealogy_app` | 判断 kind 是否属于世系父边（单一来源：`RELATION_KINDS`） | — |
| `app.touch_updated_at()` | 触发器 `BEFORE UPDATE` | — | 推进 `updated_at`（`clock_timestamp()`） | — |
| `app.guard_scope_immutable()` | 触发器 `BEFORE UPDATE` | — | 拒绝修改 `organization_id` / `project_id` | `GX002` |
| `app.lock_relation_lineage_write()` | 触发器 `BEFORE INSERT OR UPDATE` | — | 世系父边写入取 advisory lock | `55P03` |
| `app.check_ancestor_cycle()` | `CONSTRAINT TRIGGER DEFERRABLE` | — | 提交时递归 CTE 检祖先环 | `GX001` |
| `app.guard_book_release_snapshot()` | 触发器 `BEFORE UPDATE` | — | 出版快照字段不可改 | `GX003` |
| `app.guard_append_only()` | 触发器 `BEFORE UPDATE OR DELETE` | — | 审计日志只可追加 | `GX004` |
| `app.create_organization(text)` | `SECURITY DEFINER` | `genealogy_api` | 建组织 + 建 owner 成员行 + 强审计 | `GX008` |
| `app.transfer_organization_ownership(uuid, uuid)` | `SECURITY DEFINER` | `genealogy_api` | CAS 转移 owner + 强审计 | `GX005`/`GX006`/`GX008`/`GX010` |
| `app.resolve_invite_by_token(text)` | `SECURITY DEFINER` | `genealogy_api` | 用 token 哈希查邀请（不泄露存在性） | `GX005` |
| `app.accept_invite(text)` | `SECURITY DEFINER` | `genealogy_api` | 抢占式兑换邀请 + 强审计 | `GX005`/`GX008`/`GX009`/`GX010` |
| `app.revoke_invite(uuid, text)` | `SECURITY DEFINER` | `genealogy_api` | 撤销待处理邀请 + 强审计 | `GX005`/`GX006`/`GX008` |
| `app.revoke_book_release(uuid, text)` | `SECURITY DEFINER` | `genealogy_api` | 作废出版版本 + 强审计 | `GX005`/`GX006`/`GX007` |
| `app.purge_book_release(uuid)` | `SECURITY DEFINER` | `genealogy_api` | 清除已作废出版版本 + 强审计 | `GX005`/`GX006`/`GX007`/`GX011` |

**`app.current_user_id()`**（v1.2 新增，RLS 容错的关键）：

```sql
CREATE FUNCTION app.current_user_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_raw text;
BEGIN
  v_raw := NULLIF(current_setting('app.user_id', true), '');
  IF v_raw IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN v_raw::uuid;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NULL;                 -- 非法上下文 → 视为无上下文 → 策略 fail-closed
END;
$$;
```

> **为什么必须是 `INVOKER` 而不是 `SECURITY DEFINER`**：这个函数只读自定义 GUC，不需要绕过任何权限检查。给它 `SECURITY DEFINER` 只会扩大一个本可以被审阅的函数的可信面——审阅者会下意识地跳过它。
>
> **实测（§17 #07）**：无上下文 → 0 行；`app.user_id = 'not-a-uuid'` → 0 行且 `current_user_id() IS NULL` 为 true；合法成员上下文 → 1 行。fail-closed 三种路径全部验证通过。

### 9.2 触发器清单

| 触发器 | 表 | 时机 | 事件 | 函数 | 数量 |
|---|---|---|---|---|---|
| `trg_touch_updated_at` | 18 张有 `updated_at` 的表 | `BEFORE` | `UPDATE` | `app.touch_updated_at()` | 18 |
| `trg_guard_scope_immutable` | 20 张带 scope 列的表（18 张 Project 内容表 + `organization_member` + `invite`；`project` 自身的 `organization_id` 与 `organization` 自身的 `id` 是主键，天然不可改） | `BEFORE` | `UPDATE` | `app.guard_scope_immutable()` | 20（DO 块批量） |
| `trg_person_relation_lock` | `person_relation` | `BEFORE` | `INSERT OR UPDATE OF from_person_id, to_person_id, kind` | `app.lock_relation_lineage_write()` | 1 |
| `trg_person_relation_no_cycle` | `person_relation` | `AFTER`（`CONSTRAINT TRIGGER`，`DEFERRABLE INITIALLY DEFERRED`） | `INSERT OR UPDATE` | `app.check_ancestor_cycle()` | 1 |
| `trg_book_release_snapshot` | `book_release` | `BEFORE` | `UPDATE` | `app.guard_book_release_snapshot()` | 1 |
| `trg_audit_log_append_only` | `audit_log` | `BEFORE` | `UPDATE OR DELETE` | `app.guard_append_only()` | 1 |

合计 **42 个触发器**（18 + 20 + 1 + 1 + 1 + 1）。触发器全部由脚本批量创建，不手写 42 遍——手写就会漏，漏一个就是一处静默失效。**实测（§17 #15）：`pg_trigger` 中 `tgisinternal = false` 且位于 `public` schema 的触发器共 42 个，与本表逐条一致。**

**关键实现：`app.touch_updated_at()`**

```sql
CREATE FUNCTION app.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := clock_timestamp();   -- 不是 now()：now() 是事务开始时间
  RETURN NEW;
END;
$$;
```

**关键实现：`app.guard_scope_immutable()`**

```sql
CREATE FUNCTION app.guard_scope_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.project_id IS DISTINCT FROM OLD.project_id THEN
    RAISE EXCEPTION 'scope 不可迁移：organization_id / project_id 创建后不可修改'
      USING ERRCODE = 'GX002';
  END IF;
  RETURN NEW;
END;
$$;
```

**关键实现：`app.check_ancestor_cycle()`**

```sql
CREATE FUNCTION app.check_ancestor_cycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_cycle boolean;
BEGIN
  IF NOT app.relation_kind_is_lineage_parent(NEW.kind) THEN
    RETURN NULL;
  END IF;

  WITH RECURSIVE down(person_id) AS (
    SELECT NEW.to_person_id
    UNION
    SELECT r.to_person_id
      FROM public.person_relation r
      JOIN down d ON r.from_person_id = d.person_id
     WHERE r.project_id = NEW.project_id
       AND app.relation_kind_is_lineage_parent(r.kind)
  )
  SELECT EXISTS (SELECT 1 FROM down WHERE person_id = NEW.from_person_id)
    INTO v_cycle;

  IF v_cycle THEN
    RAISE EXCEPTION '世系关系会形成祖先环路'
      USING ERRCODE = 'GX001',
            DETAIL  = format('project=%s from=%s to=%s kind=%s',
                             NEW.project_id, NEW.from_person_id, NEW.to_person_id, NEW.kind);
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_person_relation_cycle
  AFTER INSERT OR UPDATE ON public.person_relation
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION app.check_ancestor_cycle();
```

- **必须用 `CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED`**：环是跨行图规则，`CHECK` 做不到；`AFTER` 触发器在提交时统一跑，才能看到事务内全部写入。
- `down` 递归里**不含 `NEW.id`**，因此不会因为「刚插入的这一行」自我匹配。
- 只对世系父边生效（`app.relation_kind_is_lineage_parent`），`step_parent` / `foster_parent` 不参与（`DM-REL-10`）。
- **实测（§17 #10）**：世系二元反向环 → 提交时 `GX001`；`step_parent` 双向并存 → 两次都成功（2 行）。

**关键实现：`app.guard_book_release_snapshot()`**

```sql
CREATE FUNCTION app.guard_book_release_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.content_snapshot IS DISTINCT FROM OLD.content_snapshot
     OR NEW.snapshot_checksum IS DISTINCT FROM OLD.snapshot_checksum
     OR NEW.book_id           IS DISTINCT FROM OLD.book_id
     OR NEW.version           IS DISTINCT FROM OLD.version
     OR NEW.format            IS DISTINCT FROM OLD.format
     OR NEW.template_version  IS DISTINCT FROM OLD.template_version THEN
    RAISE EXCEPTION '出版快照不可修改' USING ERRCODE = 'GX003';
  END IF;

  IF NEW.revoked_at IS NOT NULL AND OLD.revoked_at IS NULL THEN
    IF NEW.revoked_reason IS NULL OR btrim(NEW.revoked_reason) = '' THEN
      RAISE EXCEPTION '作废必须给出原因' USING ERRCODE = 'GX003';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION '出版版本不能撤销作废' USING ERRCODE = 'GX003';
  END IF;

  RETURN NEW;
END;
$$;
```

**关键实现：`app.guard_append_only()`**

```sql
CREATE FUNCTION app.guard_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '审计日志只可追加' USING ERRCODE = 'GX004';
END;
$$;
```

### 9.3 受控函数（`SECURITY DEFINER`）

**`app.accept_invite(text)`** —— 抢占式兑换，**`IS DISTINCT FROM` 是关键**：

```sql
  -- 1) 抢占：条件 UPDATE，只在仍为 pending 时生效
  UPDATE public.invite
     SET status = 'accepted',
         accepted_at = now(),
         updated_at = clock_timestamp()
   WHERE id = v_invite_id
     AND status = 'pending'
     AND revoked_at IS NULL
  RETURNING id INTO v_claimed;

  IF v_claimed IS NULL THEN
    RAISE EXCEPTION '邀请无效或已过期' USING ERRCODE = 'GX010';
  END IF;

  -- 2) 邮箱一致性：NULL 安全比较
  IF (SELECT email FROM auth."user" WHERE id = app.current_user_id())
     IS DISTINCT FROM v_invite.email THEN
    RAISE EXCEPTION '邀请邮箱与当前用户邮箱不一致' USING ERRCODE = 'GX009';
  END IF;
```

> **v1.2 修复（真实漏洞）**：1.1 版用 `IF v_inv.email <> v_email THEN`。在 SQL 里 `a <> b` 遇到 `NULL` 结果是 `NULL`（不是 `TRUE`），`IF NULL` 走**不抛错**分支——**当登录用户邮箱为 NULL 时，邮箱一致性校验被整体跳过**，任何人都能兑换别人的邀请。实测（§17 #08）确认该漏洞成立。修法是 `IS DISTINCT FROM`，它把 `NULL` 与非 `NULL` 判为「不一致」，语义正确。
>
> 注意 `IS DISTINCT FROM` 是**对称**的：`NULL IS DISTINCT FROM NULL` 为 false，因此「邀请邮箱为空且用户邮箱也为空」不会误杀；但 `invite.email` 本身有 `NOT NULL` 约束，所以实际只有一侧可能为 NULL。


**`app.transfer_organization_ownership(uuid, uuid)`** —— CAS 版（v1.2 变更，理由见 §8.5）：

```sql
  SELECT owner_user_id INTO v_prev
    FROM public.organization WHERE id = p_org FOR SHARE;

  IF v_prev <> app.current_user_id() THEN
    RAISE EXCEPTION '只有组织 owner 可以转移所有权' USING ERRCODE = 'GX006';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organization_member
                  WHERE organization_id = p_org AND user_id = p_new_owner) THEN
    RAISE EXCEPTION '新 owner 必须是组织成员' USING ERRCODE = 'GX006';
  END IF;

  -- CAS：校验与写入合并为一条原子语句，不需要额外权限
  UPDATE public.organization
     SET owner_user_id = p_new_owner, updated_at = clock_timestamp()
   WHERE id = p_org AND owner_user_id = v_prev;

  IF NOT FOUND THEN
    RAISE EXCEPTION '所有权已被并发转移' USING ERRCODE = 'GX010';
  END IF;
```

> 用 `FOR SHARE`（而非 `FOR NO KEY UPDATE`）读旧值，是因为 `rls_definer` 只有列级 `UPDATE` 权限，没有表级 `UPDATE` 权限，而 `FOR NO KEY UPDATE` 需要后者。真正的正确性由 CAS 条件保证：`WHERE owner_user_id = v_prev` 让并发事务中只有一个能命中（先提交者改掉了旧值，后者 `NOT FOUND` → `GX010`）。

**`app.purge_book_release(uuid)`** —— 状态机 + 产物字节纪律：

```sql
  SELECT artifact_uri INTO v_artifact FROM public.book_release WHERE id = p_release_id;
  IF NOT FOUND THEN RAISE EXCEPTION '出版版本不存在' USING ERRCODE = 'GX005'; END IF;

  IF v_revoked_at IS NULL THEN
    RAISE EXCEPTION '出版版本尚未作废，不能清除' USING ERRCODE = 'GX007';
  END IF;
  IF v_actor <> owner THEN
    RAISE EXCEPTION '只有组织 owner 可以清除出版版本' USING ERRCODE = 'GX006';
  END IF;

  IF v_artifact IS NOT NULL AND NOT app.artifact_exists(v_artifact) THEN
    RAISE EXCEPTION '出版产物字节缺失，状态不一致' USING ERRCODE = 'GX011';
  END IF;

  DELETE FROM public.book_release WHERE id = p_release_id;
  INSERT INTO public.audit_log (...) VALUES (...);
  -- 字节删除在事务提交后由应用回调执行（DM-MED-01 / DM-BOK-05）
```

**`app.revoke_invite(uuid, text)`**（v1.2 新增）：

```sql
  UPDATE public.invite
     SET status = 'revoked', revoked_at = now(),
         revoked_reason = p_reason, updated_at = clock_timestamp()
   WHERE id = p_invite_id AND status = 'pending' AND revoked_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION '邀请不存在或已不是待处理状态' USING ERRCODE = 'GX005';
  END IF;
```

> **为什么必须新增这个函数**：v1.2 收回了 `genealogy_app` 对 `invite` 的 `UPDATE` 权限（否则存在绕过邮箱校验的旁路，见 §8.4）。收回之后，如果没有受控的撤销路径，管理员就只能「让邀请自然过期」——这是功能倒退。补上 `revoke_invite` 后，`invite` 的所有状态变更都有唯一入口。

### 9.4 错误码到应用错误的映射

应用侧错误映射表（[`plan.md`](./plan.md) §8.3 引用本文 §4.6）。**只按 SQLSTATE + 约束名匹配，不解析消息文本**（`DM-GEN-18`）。

| SQLSTATE | 约束名 / 场景 | 应用错误 | HTTP | 用户可见文案 |
|---|---|---|---|---|
| `23505` | `uq_person_name_primary` | `DUPLICATE_PRIMARY_NAME` | 409 | 该人物已有主姓名 |
| `23505` | `uq_invite_pending_email` | `INVITE_ALREADY_PENDING` | 409 | 该邮箱已有待处理邀请 |
| `23505` | `uk_person_relation_kind` | `RELATION_DUPLICATE` | 409 | 这条关系已存在 |
| `23503` | `fk_node_parent` | `NODE_PARENT_MISSING` | 409 | 父节点不存在或在同一事务中被移动 |
| `23503` | `fk_*_project` | `PROJECT_SCOPE_VIOLATION` | 409 | 记录不属于该谱项目 |
| `23503` | `fk_book_release_book` | `BOOK_HAS_RELEASE` | 409 | 谱书仍有出版版本，请先清除 |
| `23001` | `fk_organization_owner` | `OWNER_MEMBER_REQUIRED` | 409 | 不能删除组织所有者成员行 |
| `23514` | `ck_person_relation_not_self` | `SELF_RELATION` | 400 | 关系两端不能是同一人 |
| `23514` | `ck_person_relation_symmetric_order` | `SYMMETRIC_ORDER` | 400 | 对称关系需按规范顺序存储 |
| `23514` | `ck_event_subject_xor` | `EVENT_SUBJECT_INVALID` | 400 | 事件必须且只能关联人物或关系之一 |
| `23514` | `ck_*_not_blank` | `BLANK_TEXT` | 400 | 内容不能为空白 |
| `GX001` | 祖先环 | `LINEAGE_CYCLE` | 409 | 会形成祖先环路 |
| `GX002` | scope 不可迁移 | `SCOPE_IMMUTABLE` | 409 | 不能跨项目移动记录 |
| `GX003` | 快照不可改 | `SNAPSHOT_IMMUTABLE` | 409 | 出版快照不可修改 |
| `GX004` | 审计只追加 | `APPEND_ONLY` | 409 | 审计日志不可修改或删除 |
| `GX005` | 邀请/出版目标无效 | `TARGET_INVALID` | 404 | 目标不存在或已失效 |
| `GX006` | 权限不足（函数内） | `FORBIDDEN` | 403 | 无权执行该操作 |
| `GX007` | 状态机不允许 | `INVALID_STATE` | 409 | 当前状态不允许该操作 |
| `GX008` | 缺少认证上下文 | `NO_AUTH_CONTEXT` | 401 | 请求缺少认证上下文 |
| `GX009` | 邮箱不一致 | `INVITE_EMAIL_MISMATCH` | 403 | 邀请邮箱与当前账号不匹配 |
| `GX010` | 并发抢占失败 | `CONCURRENT_MODIFICATION` | 409 | 操作已被并发请求抢先，请重试 |
| `GX011` | 产物字节缺失 | `ARTIFACT_MISSING` | 500 | 出版产物缺失，请联系管理员 |
| `22P02` | 输入格式错误 | `INVALID_INPUT` | 400 | 参数格式错误 |
| `55P03` | advisory lock 超时 | `LOCK_TIMEOUT` | 503 | 系统繁忙，请重试 |
| `57014` | 语句超时 | `STATEMENT_TIMEOUT` | 503 | 查询超时，请缩小范围 |
| `42501` | 权限不足（原生） | `FORBIDDEN` | 403 | 无权访问该资源 |

> **`23001` 与 `23503` 必须分开**（v1.2 修正，§2.1 #2）。合并处理会导致「引用了被保护的对象」和「级联动作被拒」返回同一个错误，用户看到「无法删除」却不知道是保护机制在起作用还是数据有问题。

---

## 10. 删除语义

**默认 `ON DELETE RESTRICT`。** 只有明确从属的数据才 `CASCADE`；`SET NULL` 只用于可选的分类引用。

| 操作 | 结果 | 相关外键动作 |
|---|---|---|
| 归档 Organization | `UPDATE status='archived'`；数据保留；新写入由应用层拦截（`DM-ORG-05`） | — |
| 删除 Organization | **不支持物理删除** | `fk_*_org` 均 `RESTRICT` |
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

1. **`ON DELETE SET NULL (folder_id)` 用的是列清单式**（PG 15+ 语法），不是整行置空。`folder_id` 被置 NULL，但同一行的 `organization_id` / `project_id` 保持不变——否则会破坏 scope 不变量（`DM-SCP-01`）。这一语法在 PG 18 上实测通过（§17 #18）。
2. **`fk_node_parent` 与 `fk_book_catalog_parent` 是自引用外键**，未声明 `ON DELETE`，即默认 `NO ACTION`；配合 `DEFERRABLE INITIALLY DEFERRED`，删除一整棵子树时必须**在单个事务内**完成，否则中途提交会因「父行已删、子行还在」而被拒绝。

**关键纪律**：

- **Node 是编纂位置，不拥有 Person**；删除谱系或节点不得自动清理「当前没有 Node 引用」的人物。
- **Relation 是人物关系事实，不拥有 Person**；删除关系不删除人物。
- **对象存储字节在数据库提交后清理**；先删对象再提交会产生悬空引用（`DM-MED-01`）。
- **物理删除 Project 前必须显式预览和确认**；不以大范围 `CASCADE` 代替业务删除流程。
- V1 不提供 Person 物理清除（GDPR）；需要时走独立运维流程，逐表清理并写审计（`DM-GEN-16`）。
- **`RESTRICT` 的报错是 `23001`**（PG 18），不是 `23503`。应用层按 §9.4 映射（`DM-GEN-18`）。

---

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

> **v1.2 补充说明（重要，但结论是「安全」）**：Drizzle 官方文档中 `generatedAlwaysAs` 的 `mode` 选项支持 `'stored'` 与 `'virtual'`。实测 Drizzle ORM 0.45.4 的 `pg-core/columns/common.js` 源码，第 28 行**硬编码** `mode: "stored"`——即 PG 方言的默认值已经是 `STORED`，与 PG 18 的 VIRTUAL 默认相反。
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

用官方推荐的 `--custom` 生成空迁移文件后手写：

```bash
bunx drizzle-kit generate --custom --name=rls_policies
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
| CI | `bun run gen:sql && git diff --exit-code db/generated/`；迁移与 schema 不一致即失败 | 合并被阻塞 |

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
| 大表加约束 | `ADD CONSTRAINT ... NOT VALID` → `VALIDATE CONSTRAINT` 两步。**没有** `ALTER CONSTRAINT ... SET NOT VALID`（实测语法错误） |
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


### 13.3 验收清单（Given / When / Then）

编号即测试用例 ID。**v1.2 修订**的用例标 🔧，**新增**的标 ✚。

**#1 组织原子创建**
- Given 无组织
- When 调用 `app.create_organization('X')`
- Then 返回组织 id，成员表含 owner 且 role='admin'，audit_log 有 `organization.created` 且 `project_id IS NULL`

**#2 owner 成员行不可删**
- Given 组织的 owner 是 u1
- When `DELETE FROM organization_member WHERE ... user_id = u1`
- Then 被外键拒绝，**SQLSTATE 为 `23001`**（v1.2 修订：PG 18 的 `RESTRICT` 专属码，不是 `23503`）🔧

**#3 转移后旧 owner 可删**
- Given 已把 owner 转给 u2
- When 删除 u1 的成员行
- Then 成功

**#4 owner 必须是成员**
- Given u9 不是成员
- When `UPDATE organization SET owner_user_id = u9`
- Then 提交时被外键拒绝

**#5 跨 Project 引用被拒**
- Given p1、p2 两个 Project
- When 在 p1 下建指向 p2 人物的 relation / node / citation
- Then 被复合外键拒绝

**#6 同名项目内实体互不冲突**
- Given p1、p2
- When 各建同名人物、同名谱系、同名分类
- Then 全部成功

**#7 对称关系唯一物理表示**
- Given A、B
- When 插入 `spouse` A→B，再插入 `spouse` B→A
- Then 第二次被 CHECK 拒绝（`23514`，约束 `ck_person_relation_symmetric_order`）

**#8 世系父边反向二元环被拒**
- Given A、B
- When 插入 `biological_parent` A→B，再插入 `biological_parent` B→A
- Then 第二次**提交时**被 `GX001` 拒绝

**#9 非世系关系反向边允许**
- Given A、B
- When 插入 `step_parent` A→B，再插入 `step_parent` B→A
- Then 两次都成功（实测 2 行）

**#10 自环被拒**
- When `from_person_id = to_person_id`
- Then 被 `23514` 拒绝，约束名 `ck_person_relation_not_self`

**#11 三元世系环被拒**
- When A→B、B→C、C→A（均为世系父边）
- Then 提交时被 `GX001` 拒绝

**#12 继亲/寄养成环允许**
- When `step_parent` / `foster_parent` 形成环
- Then 提交成功

**#13 并发竞争世系边**
- Given 两个并发事务各写一条互相冲突的世系边
- When 同时提交
- Then 恰好一条成功，另一条被 `GX001` 明确拒绝；**无死锁、无超时**；同时验证同 Project 的人物 INSERT 不被该锁阻塞

**#14 关系排序不唯一**
- Given 同一 from、同一 kind 的两条关系
- When 两条 `sort_order` 相同
- Then 插入成功；查询按 `(sort_order, id)` 返回稳定顺序

**#15 Node 根与父子**
- Given 新 lineage
- When 插入根节点、再插入子节点
- Then 根的 `parent_path IS NULL`，子节点 `parent_path` 等于根 path

**#16 父路径不存在时提交失败**
- When 插入子节点，其父 path 不存在
- Then 提交时被延迟外键拒绝（`23503`，约束 `fk_node_parent`）

**#17 子树移动单事务完成**
- When 一个事务内重排子树 path
- Then 提交时延迟外键通过，全部节点 `parent_path` 正确

**#18 重排不撞即时唯一约束**
- Given 兄弟节点 0010 / 0020
- When 用单条 `UPDATE ... SET path = CASE id ... END` 交换两者
- Then 成功（唯一性在语句结束时才检查）

**#19 path 格式与重复**
- When `path` 格式非法 / 同 Lineage path 重复 / 同人同 Lineage 第二个 primary
- Then 分别被拒绝

**#20 annotation 与人物节点**
- When `kind='annotation'` 带 person_id，或非 annotation 缺 person_id
- Then 被 CHECK 拒绝

**#21 删除 Lineage 级联范围**
- When 删除 Lineage
- Then node 级联删除；Person、Relation、Event、PersonName、Source 保留

**#22 Citation XOR**
- When 四个目标列零个或两个非空
- Then 被 CHECK 拒绝；`media_asset_id` 可独立存在

**#23 citation_person 视图**
- Given 四类目标各一条 citation
- When 查询 `app.citation_person`
- Then 四类目标都返回「一行一人」；跨租户查询返回空（`security_invoker` 生效）

**#24 BookCatalog 匹配**
- When `kind` 与 `article_id`/`lineage_id` 不匹配
- Then 被 CHECK 拒绝

**#25 BookRelease 生命周期**
- Given 一条 release
- When 直接 UPDATE 快照字段 / 直接 DELETE
- Then 分别被触发器（`GX003`）与权限拒绝；`revoke` 成功并写审计；非 owner `purge` 被 `GX006` 拒绝；owner `purge` 成功并写审计；`artifact_uri` 存在但对象缺失时 `purge` 抛 `GX011`

**#26 Book 删除前置**
- Given 存在任何 release（含已作废）
- When 删除 Book
- Then 被外键拒绝；全部 purge 后可删

**#27 AuditLog 只追加**
- When UPDATE / DELETE `audit_log`
- Then 被权限拒绝；组织级审计 `project_id IS NULL` 可写入

**#28 邀请兑换**
- Given 一条 pending 邀请，token 熵 ≥ 256 bit
- When 用正确 token 兑换 → Then 成员建立、状态 accepted、审计写入
- When 用错误/过期 token → Then `GX005`
- When 用他人 token 兑换（邮箱不一致）→ Then `GX009`
- When 同一 token 并发兑换两次 → Then 一次成功，一次 `GX010`

**#28a ✚ 邀请邮箱为 NULL 时校验不得被跳过**
- Given 登录用户的 `auth."user".email` 为 NULL
- When 兑换一条邮箱非空的邀请
- Then 抛 `GX009`（**不是**放行）——验证 `IS DISTINCT FROM` 而非 `<>` 🔧

**#28b ✚ 业务角色不得直接改邀请状态**
- Given `genealogy_app` 角色
- When `UPDATE invite SET status='accepted'`
- Then 权限不足（`42501`）——验证 §8.4 收回 `invite` 的 `UPDATE` 授权

**#29 重复 pending 邀请**
- When 同组织同邮箱重复 pending
- Then 被部分唯一索引拒绝；已接受的历史邀请不阻止再次邀请

**#30 RLS fail-closed 与连接池**
- When 不带 `app.user_id` 查询
- Then 返回空；连接池复用后不继承上一个事务的用户上下文

**#30a ✚ 非法 GUC 上下文必须 fail-closed**
- Given `app.user_id` 被设为 `'not-a-uuid'`
- When 查询任意受 RLS 保护的表
- Then 返回空，且 `app.current_user_id() IS NULL` 为 true；**不抛 `22P02`** 🔧

**#30b ✚ 通用计划下 RLS 仍 fail-closed**
- Given 同一 prepared statement 被不同租户上下文复用执行 ≥ 5 次
- When 每次设置不同的 `app.user_id`
- Then 每次返回的行数都严格对应该租户，无跨租户泄露（验证 `prepare: false` 的必要性）

**#30c ✚ 角色断言**
- Given 事务入口 `SET LOCAL ROLE genealogy_app` 未生效
- When 事务开始
- Then 断言失败并中止事务，不在错误权限下继续执行

**#31 updated_at 推进**
- When UPDATE 任意带 `updated_at` 的行
- Then `updated_at` 严格大于原值——**包括同一事务内的第二次 UPDATE**（`clock_timestamp()` 而非 `now()`）🔧

**#32 media_asset key 跨 Project**
- When 两个 Project 用同一个 `object_key`
- Then 被唯一索引拒绝

**#33 article_page**
- Given 默认 content
- Then 是合法 TipTap 文档；缺 `type` 的 JSON 被拒；乐观锁冲突返回 409

**#34 媒体引用保护**
- Given asset 被 person_media / article_page_media / source_citation 引用
- When 删除 asset
- Then 被 RESTRICT 拒绝；无引用后可删；字节在提交后删

**#35 主姓名唯一**
- When 同人第二个 `is_primary = true`
- Then 被部分唯一索引拒绝；同人同类型同值唯一

**#36 枚举生成物一致**
- When CI 跑 `gen:sql`
- Then `db/generated/enums.sql` 无 diff；`relation_kind_is_lineage_parent()` 与生成物一致；`ck_audit_log_entity_type` 取值 = 22 张表名

**#37 Drizzle 与数据库一致**
- Then 表数、CHECK 名单、唯一索引名单一致；**且 `uq_person_relation_sort_order` 不存在**

**#37a ✚ 编号零悬空零冲突**
- When 扫描全文所有 `DM-<域>-<序号>` 引用
- Then 每个编号在 §18 索引表中恰有一条定义，无一号两义，无引用未定义 🔧

**#38 软约束显式**
- When 组织归档
- Then 应用层拒绝新写入，数据库层不拦截（已声明的软约束，不是 bug）

**#39 Node 编排依据语义**
- When `placement_relation_id` 指向错误人物/类型
- Then 用例测试拦住（软不变量）

**#40 权限一致性**
- When 跑 `db/verify/permissions.sql`
- Then `rls_definer` 的权限集合与 §8.5 完全一致；`genealogy_app` 无 `book_release` 的 UPDATE/DELETE；**也无 `invite` 的 UPDATE/DELETE** 🔧

**#41 锁超时**
- Given 事务 A 持有 `yunpu:relation:<pid>` advisory lock
- When 事务 B 写同 Project 世系边
- Then 在 `lock_timeout`（3s）内失败并回滚（`55P03`），而不是无限等待

**#42 事件内容非空白**
- When `summary = ' '`（纯空白）、`date_text`/`place_text`/`summary` 全为空
- Then 被 CHECK 拒绝

**#43 ✚ 所有约束具名**
- When 扫描 `pg_constraint` 中 `public` schema 的全部约束
- Then 无匿名约束；`contype='n'` 的 `NOT NULL` 具名（PG 18 新能力）

**#44 ✚ FK 引用侧索引覆盖**
- When 跑 `db/verify/fk_indexes.sql`
- Then 37 条外键有支撑索引；18 条未覆盖项全部在白名单中且附理由；白名单与 §11.2 完全一致

**#45 ✚ RLS 全表覆盖**
- When 跑 `db/verify/rls.sql`
- Then 22 张表全部 `rowsecurity = true` **且** `forcerowsecurity = true`；策略数 = 21

**#46 ✚ 生成列语义**
- When 跑 `db/verify/generated_columns.sql`
- Then `node.parent_path` 与 `book_catalog.parent_path` 为 STORED；断言虚拟 + `ltree` 会报 `0A000`

**#47 ✚ 错误码映射**
- Given 应用侧错误映射表
- When 触发 `RESTRICT` 违规（`23001`）与普通外键违规（`23503`）
- Then 映射到**不同的**应用错误；映射过程不解析消息文本

**#48 ✚ 视图 security_invoker**
- When 以非特权角色查询 `app.lineage_root` / `app.citation_person`
- Then 受调用者的 RLS 约束，跨租户数据不可见

**#49 ✚ `ON DELETE SET NULL` 列清单式**
- Given `article.folder_id` 指向某 folder
- When 删除该 folder
- Then `article.folder_id` 变 NULL，但 `organization_id` / `project_id` 不变（scope 不变量不被破坏）

**#50 ✚ 并发所有权转移**
- Given 两个事务同时转移同一组织的 owner
- When 同时提交
- Then 一个成功，一个 `GX010`（CAS 生效，无锁竞争死锁）

**#51 ✚ 出版产物字节纪律**
- Given `book_release.artifact_uri` 非空但对象不存在
- When owner `purge`
- Then 抛 `GX011`，行**不被**删除（状态不一致必须响亮）

**#52 ✚ 撤销邀请**
- Given 一条 pending 邀请
- When 组织管理员调用 `app.revoke_invite(id, '理由')`
- Then 状态变 `revoked`，写审计；非管理员调用抛 `GX006`；重复撤销抛 `GX005`

**#53 ✚ 连接池超时下发**
- Given PgBouncer 事务池化
- When 应用建立连接
- Then `lock_timeout` / `statement_timeout` / `idle_in_transaction_session_timeout` 由 `PGOPTIONS` 在服务端生效，而非应用侧 `SET`

---

## 14. 明确不做（数据层视角）

> **「明确不做」清单的唯一权威副本在 [`spec.md`](./spec.md) §8，编号 `OOS-01`..`OOS-19`。** 本文**不复制**该表——同一主题只在一个文档里定义（宪法 Article VI）。
>
> 本节只列**数据模型特有的**「不做」项（表、列、约束、PG 特性层面），以及本层特有的复评触发条件。产品与架构层面的「不做」见 `spec.md` §8。

### 14.1 数据层特有的「不做」

| 项 | 理由 | 关联 |
|---|---|---|
| `Family`、`FamilyPartner`、`FamilyChild`、`FamilyChildParent` 表 | 家庭是 Relation 的组合视图，不另建表 | `OOS-01` |
| 任意关系类型、JSONB 关系属性包 | 关系类型是封闭集合，属性包会绕过 CHECK | `OOS-03` |
| 通用关系引擎 / 规则引擎表 | 关系规则已有执行者（CHECK + 触发器） | `OOS-04` |
| 兄弟姐妹、祖孙、叔伯、堂表亲等派生关系表 | 可从 Relation 推导，存两份必有一致性问题 | `OOS-02` |
| 跨 Project 的全局 Person 主数据表 | 默认谱之间人物独立，合并需人工裁决 | `OOS-05` |
| 通用 `entity_type/entity_id` 多态业务外键 | `audit_log` 是日志，不是业务引用；多态外键无法建复合 FK | — |
| `event.scope` 列 | 可由「主体二选一」推导（`DM-EVT-02`） | — |
| `person.surname` 与 `person_name` 的自动同步 / 自动截取 | 规范化值不得覆盖原文（`DM-GEN-09`） | — |
| `lineage_root` 表 | 根是结构事实，由 `parent_path IS NULL` 表达 | — |
| `guardian` 关系类型 | 监护不参与祖先环检测，语义与承嗣不同，混用会让环检查失真 | — |
| 全量 GEDCOM 标签镜像表 | 无导入需求；镜像表是第二真相源 | — |
| 自动根据 Relation 生成或重排 Node | 关系是事实，位置是安排，两边互不改写 | — |
| 软删除列（`deleted_at` / `is_deleted`） | 删除就是删除；归档与完成是业务状态列 | `OOS-06` |
| 完整 Subscription / Billing 模型 | 当前产品不做计费 | `OOS-07` |
| 20 位随机公开 ID（slug / ref） | 公开 ID 会成为新的身份来源与越权面 | — |
| 多人 owner 与「邀请授予 owner」 | 所有权转移用 CAS 条件更新（`DM-ADR-13`），只有一条转移路径 | — |
| Person 物理清除（GDPR）的自动化通道 | 物理清除会破坏谱系结构；须人工裁决 | — |
| **全量审计的数据库触发器** | V1 只做「强审计路径」的 DB 级留痕；其余明确声明为尽力而为（`DM-AUD-01`） | — |
| **PG 18 的 `PERIOD` / `WITHOUT OVERLAPS` 排他约束** | 「同邮箱单条 pending」用部分唯一索引即可表达；排他约束会限制「提前重发邀请」这一合法业务动作 | — |
| **PG 18 的 `NOT ENFORCED` 约束** | 会把 DB 级保证降级为「看起来像约束」，永不采用 | — |
| **虚拟生成列** | `ltree` / `jsonb` 属用户定义类型，PG 18 不允许虚拟生成列；且虚拟列不能作为外键引用侧 | — |
| **`SKIP LOCKED` 队列表 / 事件溯源 / outbox 表** | V1 无异步任务需求 | `OOS-09` |

### 14.2 数据层特有的复评条件

| 项 | 复评触发条件 |
|---|---|
| 补建 17 个 `fk_*_project` 索引 | 支持「一键删除整个 Project」且内容表单表行数 > 10 万 |
| 引入 `PERIOD` 排他约束 | `invite` 引入「有效期不重叠」的业务语义 |
| 引入虚拟生成列 | PG 支持用户自定义类型的虚拟生成列 |
| 全量审计触发器 | 出现合规场景，要求审计完整无缺 |
| 引入 `pgPolicy()` 作为 RLS 唯一来源 | Drizzle 支持生成 `FORCE ROW LEVEL SECURITY` |
| 引入事件溯源 / outbox 表 | 出现第二个消费方 |

---

## 15. 决策记录（ADR 摘要）

| # | 决策 | 选择 | 理由 | 代价 / 可逆性 |
|---|---|---|---|---|
| `DM-ADR-01` | 世系写入的串行化手段 | 事务级 advisory lock | `FOR UPDATE` 与外键检查的 `FOR KEY SHARE` 冲突，会堵住整个 Project 的写入 | 需遵守全局锁顺序；可逆 |
| `DM-ADR-02` | 关系排序唯一性 | 不唯一 | 唯一约束制造 O(n) 重排；对称关系上语义不成立 | 排序稳定性靠 `(sort_order, id)`；可逆 |
| `DM-ADR-03` | 世系反向二元环 | 拒绝（`GX001`） | 它就是祖先环 | 与旧文档表述冲突，以本文为准 |
| `DM-ADR-04` | 索引首列规则 | 无机械规则，按查询模式建 | 机械规则与实际索引全部冲突；规则冲突比没有规则更糟 | 需要靠 EXPLAIN 验证 |
| `DM-ADR-05` | 审计完整性 | 两级分级，明确不承诺完整 | 「靠自觉调 record()」不是约束 | 未来可加触发器升级 |
| `DM-ADR-06` | 产物字节归属 | 归 `book_release` 行，提交后删字节 | 每个字节要有主人 | 需要删除顺序纪律 |
| `DM-ADR-07` | 孤儿字节 | 桶级对账脚本，默认不自动删 | 代理上传的固有代价 | 需运维定期跑 |
| `DM-ADR-08` | Node 重排 | 单条 UPDATE 一次写完，约束保持即时 | 「运维级操作」不是豁免理由，脚本也会撞 | 脚本必须原子化 |
| `DM-ADR-09` | 权限规则来源 | 应用层矩阵单一来源；DB 函数只守最小不变量 | 同一规则两处 = bug | 需一致性测试 |
| `DM-ADR-10` | Node 路径容量上限的处置 | 触达上限时**重建该 lineage**，不扩展路径段宽 | 扩展段宽会让 `ck_node_path_format` 正则、既有数据、以及所有依赖 4 位的解析逻辑同时失效 | 需要重建脚本；不可逆（数据迁移） |
| `DM-ADR-11` | 生成列类型 | 一律显式 `STORED` | PG 18 默认 VIRTUAL；`ltree` 属用户定义类型，VIRTUAL 直接报 `0A000` | 无代价 |
| `DM-ADR-12` | `invite` 状态变更入口 | 只经 `app.accept_invite()` / `app.revoke_invite()` 两个受控函数 | 业务角色直接 UPDATE 会绕过邮箱一致性校验与并发抢占 | 需为撤销补受控函数；已补 |
| `DM-ADR-13` | 所有权的并发控制 | CAS 条件更新（`WHERE owner_user_id = v_prev`） | `FOR NO KEY UPDATE` 需要表级 UPDATE 权限，与 `rls_definer` 的列级授权不匹配 | CAS 只保护一行；正确性由条件更新保证 |
| `DM-ADR-14` | 会话超时下发方式 | 由连接串 `PGOPTIONS` 下发 | 会话级 `SET` 与 PgBouncer 事务池化不兼容；应用侧池的 `SET` 也只在初始化时生效一次 | 需运维在连接串统一配置 |

---

## 16. v1.2 修订记录（26 项）

| # | 位置 | 1.1 的问题 | v1.2 的修订 | 类型 |
|---|---|---|---|---|
| 1 | §2.1 | 依赖 PG 旧版默认行为（生成列、SQLSTATE、触发器角色、`NOT NULL` 匿名） | 新增 §2.1「PG 18 语义差异表」8 项，逐条实测 | 真实缺陷 |
| 2 | §5.1 | `ALTER TABLE ... ADD CONSTRAINT` 子句顺序非法（`ON DELETE` 写在 `DEFERRABLE` 之后）→ **DDL 直接语法错误** | 改为 `ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE` | **致命缺陷** |
| 3 | §8.2 | RLS 谓词 `= ANY ((SELECT app.visible_org_array()))` → **`42883 operator does not exist: uuid = uuid[]`，核心谓词无法执行** | 改为 `= ANY (app.visible_org_array())` | **致命缺陷** |
| 4 | §8.2 | 只有 `person` 一张表的策略样例，审计表 / 邀请表可能跨租户泄露 | 补齐 21 张表的逐表策略矩阵，纳入生成物 | **安全缺陷** |
| 5 | §8.4 | `genealogy_app` 拥有 `invite` 的列级 `UPDATE` → 可绕过邮箱校验与并发抢占直接改 `accepted` | 收回该权限；新增 `app.revoke_invite()` 作为唯一撤销入口 | **安全缺陷** |
| 6 | §5.3 | 邮箱一致性用 `v_inv.email <> v_email`，`v_email IS NULL` 时校验被整体跳过 | 改用 `IS DISTINCT FROM` | **安全缺陷** |
| 7 | §8.5 | `transfer_organization_ownership` 用 `SELECT ... FOR NO KEY UPDATE`，与 `rls_definer` 的列级 UPDATE 授权不匹配 | 改 CAS 条件更新 | 真实缺陷 |
| 8 | §4.4 / §5.22 | `updated_at` 与 `audit_log.created_at` 用 `now()`（事务开始时间），同事务内多次写入时间戳不变 | 改用 `clock_timestamp()` | 真实缺陷 |
| 9 | §4.3 | `person_media` / `article_page_media` 缺 `(organization_id, project_id)` 复合外键 → 可脱离 Project 存在（违反 `DM-SCP-02`） | 补齐两条外键 | **完整性缺陷** |
| 10 | §3.1 | `book_release` 主键为 `id`，与「Project 内容表用 `(project_id, id)`」通则不一致，且无 `fk_book_release_project` | 主键改 `(project_id, id)`，补外键 | 完整性缺陷 |
| 11 | §11 | 索引清单漏 `uk_folder_name`、`uk_lineage_name` | 补入清单 | 清单缺陷 |
| 12 | §11 | 外键引用侧索引缺口：`fk_node_placement_relation`、`fk_source_citation_media`、`fk_media_asset_created_by`、`fk_book_release_created_by` | 补建 4 个索引 | 性能缺陷 |
| 13 | §11 | 无 FK→索引覆盖的核对机制 | 新增 §11.2 覆盖表 + `db/verify/fk_indexes.sql` | 机制缺失 |
| 14 | §5.8 | 超时用「连接池初始化时统一 `SET`」 | 改由 `PGOPTIONS` 连接串下发 + Drizzle `prepare: false` | 部署缺陷 |
| 15 | §4.6 | 错误表把 `23001` 与 `23503` 并列，未区分触发条件 | 分离两码，映射表按「SQLSTATE + 约束名」两级匹配 | 错误处理缺陷 |
| 16 | §7.1 | 不变量编号重编；`DM-REL-08` 一号两义；`DM-GEN-13/14/15/16`、`DM-REL-09`、`DM-REL-12`、`DM-EVT-02/03/04`、`DM-NAM-01`、`DM-MED-04` 悬空 | 全量重编，新增 §18 编号索引表（零悬空零冲突） | 追溯性缺陷 |
| 17 | §1 | 缺少「约束具名」「非空文本实质内容」「updated_at 严格递增」「不依赖数据库默认值」「编号唯一可追溯」等原则 | 新增 `DM-GEN-13` 至 `DM-GEN-21` | 原则补齐 |
| 18 | §4.5 | 生成物只含 `enums.sql`，表清单与策略矩阵靠手写 | 生成器同时产出 `tables.sql`、`rls_policies.sql`，CI 反向校验 | 机制补齐 |
| 19 | §8.3 | 无 `app.current_user_id()`，非法 GUC 会直接抛 `22P02` → 500 而非拒绝访问 | 新增该函数，非法上下文返回 NULL → fail-closed | 安全补强 |
| 20 | §8.2 | 未要求事务入口断言角色 | 新增「每事务开始断言 `current_user = 'genealogy_app'`」 | 安全补强 |
| 21 | §9 | 缺函数清单、触发器清单与错误映射表 | 新增 §9.1–§9.4 | 结构补齐 |
| 22 | §9 / §5.11 | `AFTER` 触发器在 PG 18 以**入队时角色**执行，未在权限设计中体现 | 在 §5.8 写明，并列入权限变更评审清单 | 语义适配 |
| 23 | §12 | 未区分「Drizzle 能表达」与「必须手写」，`pgPolicy()` 的能力边界未说明 | 新增 §12.2 归手写清单与 §12.4 边界总表 | 结构补齐 |
| 24 | §12 | 生成列未显式指定 `mode`，依赖 Drizzle 内部默认值 | 强制显式 `{ mode: 'stored' }` | 健壮性补强 |
| 25 | §13 | 验收清单未覆盖 PG 18 新语义与新修复项 | 修订 8 条 🔧，新增 18 条 ✚（共 53 条） | 验收补齐 |
| 26 | §2.1 / §13.2 | 误写 `ALTER CONSTRAINT ... SET NOT VALID`（PG 18 **不存在**该子句，实测 `syntax error`） | 修正为 `ADD CONSTRAINT ... NOT VALID` → `VALIDATE CONSTRAINT`；并补充「`NOT NULL` 不能走 `NOT VALID`」的准确边界 | **实测修正** |

**修订项统计**：真实缺陷 12 项（含 4 项致命/安全）、清单与机制缺失 8 项、语义适配与健壮性 4 项、验收补齐 1 项、实测修正 1 项。

---

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

### 17.1 实测暴露的 1.1 版真实缺陷汇总

| 编号 | 缺陷 | 复现条件 | 影响 |
|---|---|---|---|
| D1 | RLS 核心谓词无法执行（`42883`） | 直接执行 1.1 版谓词 | **全部 RLS 隔离失效**（策略创建即报错，或退化为无策略） |
| D2 | `ALTER TABLE … ADD CONSTRAINT` 子句顺序错误 | 执行 1.1 版 §5.1 DDL | **DDL 无法应用** |
| D3 | 生成列未指定 `STORED` | 在 PG 18 建 `ltree` 生成列 | **`0A000`，表无法创建** |
| D4 | `RESTRICT` 错误码误判 | 删除 owner 成员行 | 应用层把保护机制报错当成数据错误 |
| D5 | `updated_at` 不递增 | 同事务两次 UPDATE | 违反验收 #31；乐观锁失效 |
| D6 | 邀请邮箱 NULL 绕过 | 用户邮箱为 NULL 时兑换 | **可兑换他人邀请** |
| D7 | `invite` 列级 UPDATE 旁路 | 业务角色直接 UPDATE | **绕过邮箱校验与并发抢占** |
| D8 | `FOR NO KEY UPDATE` 权限不匹配 | 以 `rls_definer` 调用 | **所有权转移不可用** |
| D9 | `person_media` / `article_page_media` 缺 Project 复合外键 | 插入脱离 Project 的关联行 | **跨 Project 数据污染** |
| D10 | `book_release` 主键形态不一致 | 跨 Project 引用 book_release | **Project Scope 约束被绕过** |
| D11 | 4 个外键缺引用侧索引 | 删除被引用行 | 删除操作全表扫描，锁持有期放大阻塞 |
| D12 | `ALTER CONSTRAINT … SET NOT VALID` 语法不存在 | 执行该语句 | **迁移脚本无法应用**（此条是 1.2 初稿自身引入，已在 §16 #26 修正） |

---

## 18. 编号索引表

**规则（`DM-GEN-21`）**：每个编号在全文档中只承载一条规则；引用编号必须在下表中有定义；下表中的编号全部有正文定义。

### 18.1 与 `ARCH-*` 的双向映射

本文是**数据层权威**，架构文档 [`plan.md`](./plan.md) 是**架构层权威**。两边的编号在语义上对应处互相引用——**这不是重复定义，而是两个视角的交叉索引**。

| 本文章节 | 架构侧章节 | 架构编号 | 主题 |
|---|---|---|---|
| §5.1–§5.4 组织与项目 | plan.md §5 `organization` / `project` 模块 | `ARCH-AR-05` | 依赖单向：一个表只能被一个模块写 |
| §5.6–§5.7 人物与姓名 | plan.md §5 `genealogy` 模块 | `ARCH-MOD-01` | 域清单只有一份 |
| §5.8 关系事实 | plan.md §11.3 关系环数据库兜底 | `ARCH-CC-01` | 并发控制：advisory lock 而非锁行 |
| §5.11 节点与路径 | plan.md §9.2 谱系画布 | `ARCH-FE-05` | 只做一条渲染路径 |
| §5.14–§5.15 谱文与分页 | plan.md §11.1 谱文乐观锁 | `ARCH-AR-08` | 失败要响亮：冲突必须抛错不静默覆盖 |
| §5.21 出版快照 | plan.md §11.6 出版同步起步 | `ARCH-PUB-01` | 出版有明确上限，不留白 |
| §5.22 审计日志 | plan.md §12.2 审计 | `ARCH-AUD-01` | 审计完整性降级为软约束并登记 |
| §8 RLS 与角色 | plan.md §7 多租户与 RLS | `ARCH-AR-02` / `ARCH-PERM-01` | 隔离靠数据库；授权规则不写两遍 |
| §8.3 `visible_org_array()` | plan.md §7.3 | `ARCH-HONO-04` | 上下文参数必须经校验 |
| §9.4 错误码映射 | plan.md §8.3 错误模型 | `ARCH-ERR-01` | 两级映射：SQLSTATE + 约束名 |
| §11 索引清单 | plan.md §6.6 索引策略 | `ARCH-IDX-01` | 按查询模式建，不设机械规则 |
| §12 Drizzle 落地边界 | plan.md §15 构建与部署 | `ARCH-BLD-01` | pnpm 是唯一包管理器 |
| §13 验收清单 | plan.md §14 测试策略 | `ARCH-TST-03` | `bun test` 连真 PG 跑集成 |

> **反向引用规则**：架构侧引用本文用 `DM-*`，本文引用架构侧用 `ARCH-*`。**任何一个 `ARCH-*` 出现在本文，都必须在 plan.md §21 的索引表中有定义**——校验脚本保证这一点（`SC-DOC-01`）。


| 编号 | 规则摘要 | 定义位置 |
|---|---|---|
| `DM-GEN-01` | 每条不变量必须能指出执行者 | §1 |
| `DM-GEN-02` | 枚举 / 权限矩阵 / 表清单只有一份来源 | §1, §4.5 |
| `DM-GEN-03` | 规范之间不得互相否定 | §1 |
| `DM-GEN-04` | 事实只存一次，可推导的不落库 | §1 |
| `DM-GEN-05` | 能用约束表达的规则不写成应用层 if | §1 |
| `DM-GEN-06` | 约束必须能在真实 PG 18 上稳定执行 | §1 |
| `DM-GEN-07` | 视图是只读投影，必须 `security_invoker` | §1, §6 |
| `DM-GEN-08` | 每个外键显式声明删除动作的业务含义 | §1, §10 |
| `DM-GEN-09` | 数据库不猜语义：原文不被规范化值覆盖 | §1, §5.6 |
| `DM-GEN-10` | 先测量再优化 | §1, §11.4 |
| `DM-GEN-11` | 约束保护事实，不保护排版 | §1, §5.8 |
| `DM-GEN-12` | 锁只加在真正需要串行化的写者上 | §1, §5.8 |
| `DM-GEN-13` | 约束必须具名 | §1, §4.1 |
| `DM-GEN-14` | 非空文本字段必须带 `btrim(x) <> ''` | §1, §4.2 |
| `DM-GEN-15` | `updated_at` 由 DB 推进且严格单调递增 | §1, §4.4 |
| `DM-GEN-16` | 软约束必须登记并有补偿测试 | §1, §7.2 |
| `DM-GEN-17` | 每条外键的引用侧列必须有支撑索引 | §1, §11.2 |
| `DM-GEN-18` | 应用错误按「SQLSTATE + 约束名」映射，不解析文本 | §1, §4.6, §9.4 |
| `DM-GEN-19` | 清单类内容由生成物产出并被反向校验 | §1, §4.5, §12.3 |
| `DM-GEN-20` | 不依赖数据库默认值 | §1, §2.1 |
| `DM-GEN-21` | 编号唯一且可追溯 | §1, §18 |
| `DM-TEN-01` | 跨 Organization 不可见 | §7.1 #1 |
| `DM-SCP-01` | 租户和 Project scope 不可迁移 | §4.3, §7.1 #22 |
| `DM-SCP-02` | 每条内容属于唯一 Organization / Project | §4.3, §7.1 #2 |
| `DM-SCP-03` | 不存在跨 Project 引用 | §7.1 #3 |
| `DM-ORG-01` | 每个 Organization 恰好一个 owner | §5.1, §7.1 #4 |
| `DM-ORG-02` | owner 必须是成员 | §5.1, §7.1 #5 |
| `DM-ORG-03` | 不能删除 owner 的成员行 | §5.1, §7.1 #6 |
| `DM-ORG-04` | 创建组织必须在同一事务内插组织 + owner 成员行 | §5.1 |
| `DM-ORG-05` | 组织归档后禁止新写入（软约束） | §7.2 |
| `DM-ORG-06` | `organization_member.role` 无 `owner` 值 | §5.2 |
| `DM-ORG-07` | 成员增删改的角色授权（软约束） | §7.2 |
| `DM-PER-01` | `surname` 的三条硬规则 | §5.6 |
| `DM-NAM-01` | 每人最多一个主姓名 | §5.7, §7.1 #7 |
| `DM-NAM-02` | 同人同类型同值唯一 | §5.7 |
| `DM-REL-01` | 世系父边反向二元环被拒 | §5.8 |
| `DM-REL-02` | 反向非世系边允许并存 | §5.8 |
| `DM-REL-03` | 对称关系唯一物理表示 | §5.8, §7.1 #10 |
| `DM-REL-04` | 展示顺序不唯一 | §5.8, §7.1 #38 |
| `DM-REL-05` | 世系父边不能形成环 | §5.8, §7.1 #11 |
| `DM-REL-06` | 锁顺序与超时 | §5.8 |
| `DM-REL-07` | 并发正确性必须在目标仓库真实 PG 18 上实测 | §5.8 |
| `DM-REL-08` | 关系两端同 Project 且不同人物 | §5.8, §7.1 #8 |
| `DM-REL-09` | 同一对人物同一 kind 不重复 | §5.8, §7.1 #9 |
| `DM-REL-10` | 非世系关系不参与环检查 | §5.8, §7.1 #12 |
| `DM-REL-11` | 世系写锁不阻塞同 Project 其他写入 | §5.8, §7.1 #50 |
| `DM-REL-12` | `kind` 取值单一来源 | §5.8, §7.1 #49 |
| `DM-EVT-01` | Event 至少有一项非空白内容 | §5.9, §7.1 #16 |
| `DM-EVT-02` | Event 恰好关联 Person 或 Relation | §5.9, §7.1 #13 |
| `DM-EVT-03` | Event 类型属于对应域 | §5.9, §7.1 #14 |
| `DM-EVT-04` | Event 日期范围有序 | §5.9, §7.1 #15 |
| `DM-EVT-05` | Relation 类型与 Event 类型匹配（软约束） | §7.2 |
| `DM-NOD-01` | Node 重排纪律（单语句一次写完） | §5.11 |
| `DM-NOD-02` | Node 的 path 唯一、格式合法 | §5.11, §7.1 #17 |
| `DM-NOD-03` | 父路径存在且严格更短（结构性无环） | §5.11, §7.1 #18 |
| `DM-NOD-04` | 每人每 Lineage 最多一个 primary | §5.11, §7.1 #19 |
| `DM-NOD-05` | annotation 无人物，人物节点有 Person | §5.11, §7.1 #20 |
| `DM-NOD-06` | 根是顶层节点 | §5.11, §7.1 #21 |
| `DM-NOD-07` | Node 编排依据的语义正确（软约束） | §7.2 |
| `DM-SRC-01` | Citation 目标同 Project | §5.13 |
| `DM-ART-01` | `article_page.content` 至少含 `type` | §5.15, §7.1 #33 |
| `DM-MED-01` | 对象字节在事务提交后删除 | §5.16, §7.2 |
| `DM-MED-02` | 孤儿字节回收靠桶级对账 | §5.21 |
| `DM-MED-03` | `object_key` 物理唯一 | §5.16, §7.1 #23 |
| `DM-MED-04` | 媒体引用存在、同 Project | §7.1 #35 |
| `DM-INV-01` | token 唯一、只存哈希、熵 ≥ 256 bit | §5.3, §7.1 #24 |
| `DM-INV-02` | 邀请邮箱一致性 | §5.3, §7.1 #27 |
| `DM-INV-03` | 邀请并发兑换抢占 | §5.3, §7.1 #27 |
| `DM-INV-04` | 同邮箱单条待处理邀请 | §5.3, §7.1 #25 |
| `DM-INV-05` | 邀请状态与时间一致 | §5.3, §7.1 #26 |
| `DM-BOK-01` | 出版快照不可修改 | §5.21, §7.1 #28 |
| `DM-BOK-02` | 出版记录不可直接删除 | §5.21, §7.1 #29 |
| `DM-BOK-03` | Book 有 release 时不能删除 | §5.21, §7.1 #30 |
| `DM-BOK-04` | 编目项类型与内容引用匹配 | §5.20, §7.1 #37 |
| `DM-BOK-05` | 产物字节纪律 | §5.21 |
| `DM-AUD-01` | 审计的完整性分级（强 / 尽力而为） | §5.22, §7.2 |
| `DM-AUD-02` | `audit_log` 只追加 | §5.22, §7.1 #31 |
| `DM-RLS-01` | 上下文缺失时默认拒绝 | §8.2 |
| `DM-RLS-02` | 所有业务表启用 `ENABLE` + `FORCE` | §8.2 |
| `DM-RLS-03` | 业务视图必须 `security_invoker` | §6 |
| `DM-PERM-01` | `rls_definer` 的权限清单按函数最小化 | §8.5 |
| `DM-POOL-01` | 会话超时由连接串下发，Drizzle `prepare: false` | §5.8, §12.5 |
| `DM-IDX-01` | 索引按查询模式建，无机械规则 | §8.2, §11 |
| `DM-ADR-01` | 世系写入用事务级 advisory lock | §15 |
| `DM-ADR-02` | 关系排序不唯一 | §15 |
| `DM-ADR-03` | 世系反向二元环拒绝 | §15 |
| `DM-ADR-04` | 索引首列无机械规则 | §15 |
| `DM-ADR-05` | 审计完整性两级分级 | §15 |
| `DM-ADR-06` | 产物字节归 `book_release` 行 | §15 |
| `DM-ADR-07` | 孤儿字节靠对账脚本 | §15 |
| `DM-ADR-08` | Node 重排单语句写完 | §15 |
| `DM-ADR-09` | 权限规则来源单一 | §15 |
| `DM-ADR-10` | 路径容量上限触达时重建 lineage | §5.11, §15 |
| `DM-ADR-11` | 生成列一律显式 `STORED` | §15 |
| `DM-ADR-12` | `invite` 状态变更只经受控函数 | §15 |
| `DM-ADR-13` | 所有权并发控制用 CAS | §15 |
| `DM-ADR-14` | 会话超时由 `PGOPTIONS` 下发 | §15 |

**统计**：共 97 个编号，**零悬空、零冲突、零一号两义**。

---

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
| 上游文档 | `specs/001-cloud-genealogy-v1/spec.md` · `.specify/memory/constitution.md` |
| 下游产物 | `specs/001-cloud-genealogy-v1/tasks.md` · `packages/db` Drizzle schema · `data/schema_v12.sql` · `data/functions_v12.sql` |
| 架构侧对应 | `specs/001-cloud-genealogy-v1/plan.md`（`ARCH-*` 编号，双向映射见 §18.1） |
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
