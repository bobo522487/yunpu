# PG 18 实测暴露的真实缺陷（D1–D12）

> 本文件是 D1–D12 缺陷与修复决议的唯一权威；由 Task 4 收敛三份复述并补齐修复决议。

## 原始素材（重构前基线，待 Task 4 去重）

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
