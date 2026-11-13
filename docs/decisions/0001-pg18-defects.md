# PG 18 缺陷决策记录（D1–D12 唯一权威）

> **状态：待验证。** 本机无 `psql` / `pg_ctl`，21 组 PG 18 实测与 D1–D12 结论均未在本次重构中复现；按用户 2026-11-13 决策降级为「待验证」，不得表述为已在真实实例上通过。复现步骤见 [../verification/README.md](../verification/README.md)。

> 本文件是 D1–D12 的唯一权威；`stack.md` 与 `verification/README.md` 只引用编号，不复制表格。修订记录属于 git 历史，不在本文保留。

## D1–D12 缺陷清单

| 编号 | 失效场景 | 触发方式 | 后果 |
| --- | --- | --- | --- |
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

## 验证门禁

- 每条结论必须登记执行者与验证方式（宪法 Article III）：执行者 = PG 18 实例上的复现脚本，验证方式 = [../verification/README.md](../verification/README.md) 的复现记录。
- 复现前，所有依赖这些结论的设计决策标注「待验证」，不计入已达标门禁。