<!--
SYNC IMPACT REPORT
Scope: .specify/memory/constitution.md only (template layers untouched).
Version change: unversioned template scaffold → 1.0.0 (initial ratification)
Bump rationale: This is the first ratified constitution; the previous file was the
  unmodified Spec Kit scaffold with only [ALL_CAPS] placeholders and no governance
  content. Replacing a non-ratified scaffold with a full principle set is an initial
  MAJOR-equivalent adoption, set at 1.0.0 rather than 0.x.
Modified principles:
- [PRINCIPLE_1_NAME] .. [PRINCIPLE_5_NAME] (5 template slots) → Article I–IX,
  9 non-negotiable principles, each with 规范 / 执行者 / 验证方式 and rationale.
Added sections:
- 复杂度预算（Complexity Budget）
- 安全与数据约束（Security & Data Constraints）: 租户隔离 / 权限 / 数据完整 / 媒体与隐私
- 开发流程与质量门禁（Process & Quality Gates）: Constitution Check 门禁 / 检查清单 /
  开发流程 / 阻塞级门禁 / 文档规则
- Governance: 修订流程、违反处理（both from user input） plus 版本策略 and a
  合规评审 pointer, required by the template's Governance structure.
Removed sections:
- Template example comments and [SECTION_2_*], [SECTION_3_*], [GOVERNANCE_RULES],
  [GUIDANCE_FILE] placeholders — scaffold only; no previously ratified rules lost.
Follow-up TODOs (human review before commit):
- TODO(PRINCIPLE_COUNT): 输入标题写「五条不可变原则」，正文却列出 Article I–IX
  共 9 条。本次按正文完整保留 9 条、未删减，也未改写措辞（治理文本修改须走
  Governance 流程）；请确认标题措辞或调整条款数量。
- TODO(CROSS_REFERENCES): 文本引用 ARCH-AR-01..09、DM-GEN-01..21、data-model.md、
  plan.md、spec.md、§4.6 错误码表、§18 编号索引表、scripts/gen-sql.ts、
  packages/db、packages/shared 等。当前仓库仅有 .specify 脚手架，这些文档与编号
  尚无定义；按 Article III 与 DM-GEN-21 属悬空引用，需在后续 /speckit-specify、
  /speckit-plan 产物中补齐定义，或删除引用，不允许既不补也不删。
- TODO(PROJECT_NAME): [PROJECT_NAME] 由目录名推断为 Yunpu；若有正式项目名请修订标题。
- Intentionally retained bracket token: `[P]` in 开发流程 item 2 is the Spec Kit
  parallel-task marker from the user's own text, not an unresolved placeholder.
- This report is temporary scratch material: remove this HTML comment before committing.
-->

# Yunpu Constitution

## Core Principles

Core Principles（五条不可变原则）：这五条是 Linus 哲学在本项目里的落地形态。
它们不随版本变化。要修改，必须走 Governance 流程并写明代价。

### Article I — 简单胜过聪明（Simple Beats Clever）

规范：能用一张表说清的事，不建第二张表；能用一段 SQL 说清的事，不建抽象层；
能不抽象就不抽象。任何新引入的抽象层必须先证明它消除了至少两处重复，否则不引入。

- 执行者：代码评审 + ARCH-AR-09（不猜未来）
- 验证方式：新增抽象层时，PR 描述必须写出「消除了哪两处重复」；写不出来就驳回

Linus 原话：这是 Unix 哲学的核心。聪明是廉价的，复杂是昂贵的。
不要为了显示聪明而把简单事情搞复杂。

### Article II — 删掉就是删掉（Deletion Is Deletion）

规范：数据删除即物理删除，不做软删除；归档与完成是业务状态字段，不是删除的替代品。
业务状态写在状态列上，不写在「还活着吗」的隐式约定里。

- 执行者：表定义（无 deleted_at）、状态枚举
- 验证方式：DM-GEN-08；data-model.md §10 删除语义；
  表清单中不存在 deleted_at / is_deleted 字段

软删除把一个问题（不想真删）换成两个问题（怎么删、怎么查活着的），并且两个都做不好。
真删需要时，从备份恢复——这是运维问题，不是数据模型问题。

### Article III — 规则要有执行者（Rules Need Enforcers）

规范：没有执行者的规则不是规则，是愿望。每条不变量必须能指出执行者：
DB 约束 / DB 触发器 / 服务层 / 测试。四者都没有的不写进文档。

- 执行者：文档评审
- 验证方式：data-model.md §7 不变量表「执行者」列无「待定」；
  DM-GEN-01、ARCH-AR-04、ARCH-AR-07

talk is cheap, show me the code. 落到文档即：文档里的每条约束都能指到一个可运行的强制点。

### Article IV — 数据优于抽象（Data Over Abstraction）

规范：事实只存一次，可推导的东西不落库。家庭视图、兄弟姐妹、世次、祖先环检测
全部由关系事实推导，不建第二份存储。能用列 / 约束 / 外键表达的规则，
不写成应用层 if（DM-GEN-04、DM-GEN-05）。

- 执行者：复合外键 + 派生查询 + 服务层纯函数
- 验证方式：data-model.md §5 无冗余派生表；§6 视图全部 security_invoker

存两份就有一致性问题。没有第二个消费方的抽象，是负债不是资产。

### Article V — 隔离靠数据库（Isolation Lives in the Database）

规范：租户边界写在 RLS 策略里，不依赖应用代码记得加 WHERE。
应用漏写过滤条件时，仍读不到别人的数据。RLS 策略是唯一的租户隔离执行者。

- 执行者：PostgreSQL RLS 策略 + rls_definer 角色
- 验证方式：data-model.md §8.2；验收清单中跨租户隔离用例全部通过；ARCH-AR-02

安全边界不能靠每个工程师每次都记得。这不是信任问题，是工程问题。

### Article VI — 约束要有单一真相源（One Source of Truth）

规范：同一份事实只在一处定义，其余由生成器产出并被反向校验。
表清单、枚举、权限矩阵、RLS 策略矩阵一律生成，不手写。

- 执行者：scripts/gen-sql.ts + packages/db + packages/shared
- 验证方式：CI 任务 `gen:sql && git diff --exit-code`；DM-GEN-02、DM-GEN-19、ARCH-AR-06

### Article VII — 不猜未来（Do Not Guess the Future）

规范：接口按当前需要设计。确有扩展需求时留一个接口，不预埋空实现、不留空表、
不加投机性通用层。YAGNI。

- 执行者：代码评审
- 验证方式：plan.md §16 演进触发条件表；ARCH-AR-09

需求没来的时候写下的代码，是要维护的代码。维护没人用的代码，比不写它更贵。

### Article VIII — 失败要响亮（Fail Loudly）

规范：错误要么是明确的领域错误，要么向上抛。禁止静默吞异常，
禁止 `catch { return null }`。应用错误按「SQLSTATE + 约束名」两级映射，
不解析消息文本。

- 执行者：AppError + 全局 onError + app.raise_* 函数
- 验证方式：代码评审 + 集成测试；ARCH-AR-08、DM-GEN-18

静默失败把 bug 变成数据损坏，而数据损坏比崩溃贵得多。

### Article IX — 先测量再优化（Measure Before Optimizing）

规范：索引按真实查询模式建，用 `EXPLAIN (ANALYZE)` 验证。约束同理：
先确认它在真实 PG 18 上稳定执行，需要解析 JSON 或靠自觉的，
降级为软约束并显式登记。

- 执行者：索引清单 + 集成测试
- 验证方式：data-model.md §11.4 测量方法、§7.2 软约束登记表；
  DM-GEN-06、DM-GEN-10、DM-GEN-16

## 复杂度预算（Complexity Budget）

ARCH-GOV-01：400 行红线是警报，不是合并门禁。为凑行数把内聚模块切碎，
是指标驱动设计，不是设计驱动指标。超过 400 行触发评审讨论「是否内聚」，
不触发自动拒绝。

| 项 | 参考上限 | 性质 | 超了怎么办 |
| --- | --- | --- | --- |
| 单文件行数 | 400 | 警报 | 评审时确认模块是否内聚；确需拆分由人决定 |
| 依赖方向分区数（Biome overrides） | ≤ 8 | 硬约束 | 合并目录，而不是加规则 |
| 业务模块数 | ≤ 8 | 硬约束 | 域太大就拆；域太小就合并 |
| 数据库表数量 | ≤ 30（当前 22） | 硬约束 | 超了说明模型没想清楚 |
| 同时运行的基础设施组件 | 3（应用 / PostgreSQL / 对象存储） | 硬约束 | 每加一个都要有人愿意运维它 |

违反预算的处理：确需突破时，在 plan.md 的 Complexity Tracking 表中登记三列——
Violation / Why Needed / Simpler Alternative Rejected Because。空着不写就等于不允许。

## 安全与数据约束（Security & Data Constraints）

### 租户隔离

- RLS 策略是租户隔离的唯一执行者（Article V）。
- 租户谓词必须写成 `= ANY (app.visible_org_array())`。
  不得写成 `= ANY ((SELECT app.visible_org_array()))`——后者被 PostgreSQL 解析为
  表子查询比较，实测报 `42883 operator does not exist: uuid = uuid[]`，
  核心租户谓词直接无法执行。
- RLS 业务视图必须 `security_invoker = true`（DM-GEN-07）。
- FORCE ROW LEVEL SECURITY 必须由手写迁移显式声明——Drizzle 的 `pgPolicy()`
  不生成它，故不能作为策略的唯一来源。

### 权限

- 应用连接角色 `genealogy_app` 无 BYPASSRLS；`rls_definer` 为 NOLOGIN BYPASSRLS，
  仅持有必要的列级授权。
- 所有 SECURITY DEFINER 函数必须 `SET search_path = pg_catalog`。
- 连接串下发
  `PGOPTIONS='-c lock_timeout=3000 -c statement_timeout=30000 -c idle_in_transaction_session_timeout=60000'`。
  会话级 SET 与 PgBouncer 事务池化不兼容，因此参数必须由连接串下发。

### 数据完整

- 每个外键显式声明 RESTRICT / CASCADE / SET NULL 的业务含义（DM-GEN-08）。
- 每条外键的引用侧列必须有支撑索引——PostgreSQL 不会自动建（DM-GEN-17）。
- 约束必须具名（DM-GEN-13）；「非空文本」字段必须带 `btrim(x) <> ''`（DM-GEN-14）。
- 不依赖数据库默认值：凡默认值会随版本变化的语法，必须显式写出关键字（DM-GEN-20）。
- `updated_at` 由 DB 推进且严格单调递增，用 `clock_timestamp()` 而非 `now()`（DM-GEN-15）。

### 媒体与隐私

- 媒体存私有桶，服务端代理上传与鉴权下载。对象存储不做公开读。
- 审计日志只追加，不更新不删除。

## 开发流程与质量门禁（Process & Quality Gates）

### Constitution Check 门禁

GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.

本条是 spec-kit 的 Constitution Check 语义在本项目的落地：两个时点，两次检查，缺一不可。

| 时点 | 检查什么 | 不通过怎么办 |
| --- | --- | --- |
| Phase 0 之前（写 research/ 与技术选型之前） | 方案是否违反 Article I–IX？是否触发复杂度预算？是否引入「明确不做」清单里的东西？ | 停止，先改方案或走 Complexity Tracking 登记 |
| Phase 1 之后（写完 design/tasks 之前） | 是否新增了没有执行者的约束？是否出现跨文档矛盾？编号是否悬空？ | 回退到对应文档修订，不带着矛盾往下走 |

检查清单（逐条回答「是/否 + 出处」）：

1. 是否引入了新抽象层？——引入了，消除了哪两处重复？
2. 是否引入了新表？——为什么不能用现有结构表达？
3. 是否新增了依赖方向？——依赖图是否仍然单向？
4. 新约束的执行者是谁？——写不出名字就删掉这条约束。
5. 新错误码是否已在 §4.6 错误码表登记？
6. 新编号是否在 §18 编号索引表登记？——引用编号必须能找到定义。
7. 是否触碰「明确不做」清单？——触碰就必须写 Complexity Tracking。

### 开发流程（Superpowers 方法论）

1. 先写规格：功能开发前先在 `specs/<编号>-<特性名>/` 下产出 spec.md，
   明确验收标准（Given / When / Then），再动手。
2. 写实施计划：产出 plan.md（含 Constitution Check）与 tasks.md
   （可执行、标 [P] 并行标记与依赖），再写代码。
3. 测试驱动：先写会失败的测试，再写实现。集成测试连真 PostgreSQL 18，
   不 mock 掉约束与触发器——mock 掉的正是最容易出错的部分。
4. 代码评审：按本文 Article I–IX 逐条对照，不按个人偏好。
5. 收尾：合并前 `gen:sql && git diff --exit-code` 通过，编号一致性校验零悬空。

### 阻塞级门禁（不过不许合并）

- CI lint（含 Biome 依赖方向检查）通过。
- 集成测试在真 PG 18 上通过，RLS 跨租户隔离用例必须覆盖。
- 编号一致性校验：悬空引用 0、一号两义 0、未引用 0。
- 变更涉及数据模型时，data-model.md 同步更新并重跑生成物校验。

### 文档规则

- 文档分层不重叠：spec.md 说「做什么与验收」，plan.md 说「怎么做与边界」，
  data-model.md 说「数据长什么样」。同一主题只在一个文档里定义，其余用编号引用。
- 「明确不做」清单只存一份（spec.md），其他文档引用编号，不复制表格。
- 每条可验证规范写成「规范陈述 + 执行者 + 验证方式」三段式。
- 编号唯一且可追溯：同一编号不得承载两条规则，引用编号必须有定义（DM-GEN-21）。

## Governance

本宪法优先于其他实践。修订必须留文档、走流程，并评估影响面；
所有 PR 与代码评审必须验证合规性，复杂度必须有理由。

### 修订流程

1. 提出修订：说明违反了哪条现有条款、为什么必须改、不改的后果。
2. 影响面评估：列出受影响的文档与编号（用脚本核对引用关系）。
3. 决策：
   - 技术性修订（澄清、修正错别字、补执行者）——直接改，同步更新 Version / Last Amended。
   - 实质性修订（增删 Article、放宽预算、改变「明确不做」）——必须写明放弃的是什么，
     并回溯检查已有文档是否违反新条款。
4. 落地：宪法先改，再改文档；不允许先改文档后补宪法。

### 违反处理

违反宪法的设计不是「不合规但可用」，而是缺陷：要么改设计，要么改宪法并承担代价。
不允许既不改设计也不改宪法，把问题留在文档里。

### 版本策略

- MAJOR：向后不兼容的治理变更（删除或重新定义原则）。
- MINOR：新增原则或章节，或实质性扩充指引。
- PATCH：澄清、措辞与错别字修正、非语义精修。
- 每次修订同步更新 Version 与 Last Amended；Ratified 保持首次采纳日期不变。

### 合规评审

合规评审的期望见「开发流程与质量门禁」：Article I–IX 逐条对照的代码评审、
Phase 0 之前与 Phase 1 之后各一次的 Constitution Check 门禁、
以及 plan.md 的 Complexity Tracking 登记。本节不重复定义，只作引用。

**Version**: 1.0.0 | **Ratified**: 2026-11-13 | **Last Amended**: 2026-11-13
