---
status: accepted
---

# ADR-0006: PG 18 缺陷与约束决策记录（D1–D12）

> **说明**：本记录整理自早期 PostgreSQL 18 约束/RLS 缺陷分析（D1–D12）。其中部分表（如 `person_media`、`article_page_media`、`book_release`）尚未在当前库中创建，未在真实实例复现验证的条目仍标注为「待验证」；已落地表的相关修复已分别体现在 `packages/db/migrations/0012`–`0014` 及对应测试中。

## D1–D12 缺陷清单

| 编号 | 失效场景 | 触发方式 | 后果 | 当前状态 |
| :--- | :--- | :--- | :--- | :--- |
| D1 | RLS 核心谓词无法执行（`42883`） | 早期 1.1 版谓词类型/签名不匹配 | **全部 RLS 隔离失效** | 已通过 `0003`/`0004`/`0014` 及 `tests/security/` 覆盖 |
| D2 | `ALTER TABLE … ADD CONSTRAINT` 子句顺序错误 | 执行早期 1.1 版 §5.1 DDL | **DDL 无法应用** | 已规避 |
| D3 | 生成列未指定 `STORED` | 在 PG 18 建 `ltree` 生成列 | **`0A000`，表无法创建** | 现行 `lineage_projection` 使用显式 `ltree` 列 |
| D4 | `RESTRICT` 错误码误判 | 删除 owner 成员行 | 应用层把保护机制报错当成数据错误 | `mapDatabaseError` 显式映射 `23001`/`23503`（`fk_organization_owner` → 409） |
| D5 | `updated_at` 不递增 | 同事务两次 UPDATE | 乐观锁或更新时间失效 | 待验证（视具体触发器实现） |
| D6 | 邀请邮箱 NULL 绕过 | 用户邮箱为 NULL 时兑换 | **可兑换他人邀请** | 已在邀请兑换与测试中校验 |
| D7 | `invite` 列级 UPDATE 旁路 | 业务角色直接 UPDATE | **绕过邮箱校验与并发抢占** | 已通过 RLS 写策略（`0014_write_policies.sql`）约束 |
| D8 | `FOR NO KEY UPDATE` 权限不匹配 | 以 `rls_definer` 调用 | **所有权转移不可用** | 已通过 `tests/console/ownership.test.ts` 验证 |
| D9 | `person_media` / `article_page_media` 缺 Project 复合外键 | 插入脱离 Project 的关联行 | **跨 Project 数据污染** | 对应表尚未创建；后续新增媒体表时必须带 `(organization_id, project_id)` 复合外键 |
| D10 | `book_release` 主键形态不一致 | 跨 Project 引用 `book_release` | **Project Scope 约束被绕过** | 对应表尚未创建；后续新增时需统一复合主键 |
| D11 | 4 个外键缺引用侧索引 | 删除被引用行 | 删除操作全表扫描，锁持有期放大 | 已落地内容表均已建 `(organization_id, project_id)` 索引；`fk_organization_owner` 见 `ADR-0007` |
| D12 | `ALTER CONSTRAINT … SET NOT VALID` 语法不存在 | 执行该语句 | **迁移脚本无法应用** | 禁止使用该语法 |

## 约束要求

- 后续新增任何关联到 `project` 或 `book_release` 的表，必须纳入 D9/D10 检查并在真实 PG 18 实例上验证迁移与 RLS。
