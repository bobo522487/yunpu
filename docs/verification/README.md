# 验证与实测登记

> 本文件只登记「如何复现」与「哪些结论尚未复现」，不复制实测表、官方依据清单或文档元信息（宪法 Article VI「同一主题只定义一次」）。D1–D12 的唯一权威见 [../decisions/0001-pg18-defects.md](../decisions/0001-pg18-defects.md)；错误码的唯一权威见 [../architecture/data/errors.md](../architecture/data/errors.md)。

## 当前状态（2026-11-13）

| 结论 | 状态 | 阻塞原因 |
| --- | --- | --- |
| 21 组 PG 18 实测（生成列、`23001`、`42883`、`uuidv7()`、FORCE RLS 等） | 待验证 | 本机 `psql` / `pg_ctl` NOT FOUND |
| D1–D12 缺陷与修复决策 | 待验证 | 同上 |
| 55 条外键中 37 条有引用侧索引、18 条例外 | 待验证 | 同上 |
| Drizzle `pgPolicy()` 不生成 `FORCE ROW LEVEL SECURITY` | 待验证 | 需 Drizzle 0.45.4 源码核对 |
| `clock_timestamp()` vs `now()` 的严格递增行为 | 待验证 | 需真实事务复现 |

## 复现步骤（执行后把上表状态改为「已验证」并附日志路径）

1. 准备 PostgreSQL 18 实例，记录 `SELECT version();` 输出。
2. 应用 [../architecture/data/migrations.md](../architecture/data/migrations.md) 的迁移顺序，含手写 `FORCE ROW LEVEL SECURITY` 迁移。
3. 逐条执行 [../decisions/0001-pg18-defects.md](../decisions/0001-pg18-defects.md) 的 D1–D12 触发方式。
4. 运行 `bash tests/docs/check-docs.test.sh` 与 `scripts/check-docs.sh --root docs --strict`。
5. 把每条结论的日志路径写回本文件，并同步 [../architecture/data/invariants.md](../architecture/data/invariants.md) 的软约束登记表。

## 文档一致性校验

- 执行者：`scripts/check-docs.sh --strict`（测试）。
- 验证方式：`scripts/check-docs.sh --root docs --strict` exit=0，R1 断链 / R3 重复定义 / R4 悬空 / R5 一号两义 / R7 章节引用全为 0。