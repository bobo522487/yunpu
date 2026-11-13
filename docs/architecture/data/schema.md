# 数据结构（表、字段、约束、视图）

> 本文件是「表结构、字段、约束、枚举、函数与触发器」的唯一权威；其他主题见 `docs/README.md` 导航，同一主题不复制表格。

# 云谱数据模型 1.2（PG 18 / Drizzle 官方规范重构版）

> **状态**：数据层唯一权威基线。  
> **技术基线**：PostgreSQL 18 + Drizzle ORM；所有主键默认 `uuidv7()`。  
> **范围**：实体、字段、约束、索引、关键不变量、RLS 与权限、删除语义、Drizzle 落地边界。  
> **不在范围**：API 形状、UI、部署、计费。  
> **规格编号**：`DM-<域>-<序号>`。编号一旦发布不复用；被废弃的规格标 `已废弃` 并保留编号。  
> **上游**：[`functional.md`](../../requirements/functional.md) 定义做什么与验收标准；[`.specify/memory/constitution.md`](../../../.specify/memory/constitution.md) 是最高约束。  
> **架构侧对应**：[`overview.md`](../overview.md) 只定义边界与归属；本文定义数据结构与执行者。冲突时以本文为准（plan.md §1.5）。  
> **SDD 角色**：**Phase 1 设计产物**（spec-kit 流水线）。下游是 `tasks.md`（由 `/speckit-tasks` 在 `specs/` 后期分批生成，当前不存在） 与 `packages/db` 的 Drizzle schema。  
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

### 2.2 PG 18 新能力中「本模型明确不做」的部分

pgEnum、hstore、xml、继承表、规则系统、软删除列、通用 `entity_type/entity_id` 业务外键、虚拟生成列、`NOT ENFORCED` 约束、`PERIOD` / `WITHOUT OVERLAPS` 均不使用；「明确不做」的唯一权威清单见 [../../requirements/out-of-scope.md](../../requirements/out-of-scope.md)，本文不写 V2 复评条件表（宪法 Article VII）。

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
> 表清单、模块归属、枚举、**RLS 策略矩阵**四处清单均由 `src/domain/enums.ts` 生成，本文与 [`overview.md`](../overview.md) §5 的清单都从它派生，不再手抄（`DM-GEN-02` / `DM-GEN-19`）。生成物：`db/generated/enums.sql`、`db/generated/tables.sql`、`db/generated/rls_policies.sql`。

---

## 4. 通用约定

### 4.1 命名

- 表名单数 `snake_case`；独立实体主键 `id`；纯关联表用业务键复合主键，不加代理 `id`。
- 约束前缀：`pk_`、`fk_`、`uk_`、`ck_`、`idx_`、`uq_`（部分唯一索引）、`trg_`。
- 函数：`app.verb_noun()`；视图：`app.noun`。
- **约束必须具名**（`DM-GEN-13`）：匿名约束无法在错误处理、迁移和审计里被引用。错误映射按「SQLSTATE + 约束名」两级匹配（见 [`overview.md`](../overview.md) §8.3）。
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

## 14. 明确不做（数据层视角）

「明确不做」的唯一权威副本见 [../../requirements/out-of-scope.md](../../requirements/out-of-scope.md)（`OOS-01`..`OOS-19`）；数据层只引用编号，不复制表格。