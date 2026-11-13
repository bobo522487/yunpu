# 成功标准与追溯矩阵

> 本文件是「成功标准 SC-* 与需求追溯矩阵」的唯一权威；其他主题见 `docs/README.md` 导航，同一主题不复制表格。

## 5. 成功标准（Success Criteria）

> 技术无关、可度量。**每条都能被测试判定真假。**

| 编号          | 标准                                             | 测量方式          |
| ----------- | ---------------------------------------------- | ------------- |
| `SC-FUN-01` | US-001..US-010 的全部验收场景有对应自动化测试且通过              | 测试报告          |
| `SC-FUN-02` | 一个完整垂直切片（人物→姓名→关系→家庭视图→谱系位置→引用）可在无人工干预下跑通      | 端到端测试         |
| `SC-TEN-01` | 跨租户隔离用例 100% 通过，且至少一例**故意**在应用层漏写过滤条件仍被 RLS 拦住 | 测试报告          |
| `SC-TEN-02` | 任意两个 Organization 之间的可见性交集恒为空（自动化遍历断言）         | 属性测试          |
| `SC-INT-01` | 全部不变量都有具名执行者，不变量表中「待定」行数为 0                    | 文档核对          |
| `SC-INT-02` | 数据模型中「明确不做」的项在实现里出现次数为 0                       | 代码/表结构审查      |
| `SC-INT-03` | 外键引用侧列的支撑索引覆盖率 = 100%                          | 索引覆盖表核对       |
| `SC-DOC-01` | 编号一致性校验：悬空引用 0、一号两义 0、断链 0、无 CRLF           | `scripts/check-docs.sh --root docs --strict` |
| `SC-PER-01` | 列表接口在 1 万行数据集上 P95 响应 < 200ms（keyset 分页）       | 压测            |
| `SC-ERR-01` | 领域错误 100% 映射到具名应用错误码，无静默吞异常                    | 代码评审 + 错误码表核对 |
| `SC-OPS-01` | 迁移可在已有数据的库上零停机执行成功                             | 迁移演练          |
| `SC-EXT-01` | 导出快照在底稿修改后内容不变（逐字节校验）                          | 集成测试          |

---

## 9. 追溯矩阵

> 每行是「编号 → 实现位置 → 验证方式」三段式；编号定义见各权威主题文件，本表只做追溯，不复制规则正文。

| 条款（链接到定义） | 对应实现 | 对应验证 |
|---|---|---|
| [`FR-ART-01`](functional.md) | [`schema.md`](../architecture/data/schema.md) | `SC-INT-01`、`SC-FUN-02` |
| [`FR-ART-02`](functional.md) | [`schema.md`](../architecture/data/schema.md) | `SC-INT-01`、`SC-FUN-02` |
| [`FR-AUD-01`](functional.md) | [`schema.md`](../architecture/data/schema.md) | `SC-INT-01`、`SC-FUN-02` |
| [`FR-BOK-01`](functional.md) | [`schema.md`](../architecture/data/schema.md) | `SC-INT-01`、`SC-FUN-02` |
| [`FR-BOK-02`](functional.md) | [`schema.md`](../architecture/data/schema.md) | `SC-INT-01`、`SC-FUN-02` |
| [`FR-LIN-01`](functional.md) | [`schema.md`](../architecture/data/schema.md) | `SC-INT-01`、`SC-FUN-02` |
| [`FR-LIN-02`](functional.md) | [`schema.md`](../architecture/data/schema.md) | `SC-INT-01`、`SC-FUN-02` |
| [`FR-MED-01`](functional.md) | [`schema.md`](../architecture/data/schema.md) + [`errors.md`](../architecture/data/errors.md) | `SC-INT-01`、`SC-FUN-02` |
| [`FR-ORG-01`](functional.md) | [`security.md`](../architecture/data/security.md) | `SC-TEN-01`、`SC-TEN-02` |
| [`FR-ORG-02`](functional.md) | [`security.md`](../architecture/data/security.md) | `SC-TEN-01`、`SC-TEN-02` |
| [`FR-ORG-03`](functional.md) | [`security.md`](../architecture/data/security.md) | `SC-TEN-01`、`SC-TEN-02` |
| [`FR-PER-01`](functional.md) | [`schema.md`](../architecture/data/schema.md) | `SC-INT-01`、`SC-FUN-02` |
| [`FR-PER-02`](functional.md) | [`schema.md`](../architecture/data/schema.md) | `SC-INT-01`、`SC-FUN-02` |
| [`FR-PER-03`](functional.md) | [`schema.md`](../architecture/data/schema.md) | `SC-INT-01`、`SC-FUN-02` |
| [`FR-REL-01`](functional.md) | [`schema.md`](../architecture/data/schema.md) | `SC-INT-01`、`SC-FUN-02` |
| [`FR-REL-02`](functional.md) | [`schema.md`](../architecture/data/schema.md) | `SC-INT-01`、`SC-FUN-02` |
| [`FR-REL-03`](functional.md) | [`schema.md`](../architecture/data/schema.md) | `SC-INT-01`、`SC-FUN-02` |
| [`FR-REL-04`](functional.md) | [`schema.md`](../architecture/data/schema.md) | `SC-INT-01`、`SC-FUN-02` |
| [`FR-REL-05`](functional.md) | [`schema.md`](../architecture/data/schema.md) | `SC-INT-01`、`SC-FUN-02` |
| [`FR-SRC-01`](functional.md) | [`schema.md`](../architecture/data/schema.md) | `SC-INT-01`、`SC-FUN-02` |
| [`FR-SRC-02`](functional.md) | [`schema.md`](../architecture/data/schema.md) | `SC-INT-01`、`SC-FUN-02` |
| [`FR-TEN-01`](functional.md) | [`security.md`](../architecture/data/security.md) | `SC-TEN-01`、`SC-TEN-02` |
| [`FR-TEN-02`](functional.md) | [`security.md`](../architecture/data/security.md) | `SC-TEN-01`、`SC-TEN-02` |
| [`FR-TEN-03`](functional.md) | [`security.md`](../architecture/data/security.md) | `SC-TEN-01`、`SC-TEN-02` |
| [`NFR-ERR-01`](functional.md) | [`errors.md`](../architecture/data/errors.md) | `SC-ERR-01` |
| [`NFR-OBS-01`](functional.md) | [`operations.md`](../architecture/operations.md) | `SC-INT-01`、`SC-FUN-02` |
| [`NFR-OPS-01`](functional.md) | [`operations.md`](../architecture/operations.md) | `SC-OPS-01` |
| [`NFR-PER-01`](functional.md) | [`indexes.md`](../architecture/data/indexes.md) | `SC-PER-01` |
| [`NFR-SEC-01`](functional.md) | [`security.md`](../architecture/data/security.md) | `SC-TEN-01`、`SC-TEN-02` |
| [`NFR-SEC-02`](functional.md) | [`security.md`](../architecture/data/security.md) | `SC-TEN-01`、`SC-TEN-02` |
| [`NFR-SEC-03`](functional.md) | [`security.md`](../architecture/data/security.md) | `SC-TEN-01`、`SC-TEN-02` |
| [`NFR-TST-01`](functional.md) | [`user-stories.md`](user-stories.md) | `SC-FUN-01` |
| [`SC-DOC-01`](acceptance.md) | [`acceptance.md`](acceptance.md) | `scripts/check-docs.sh --root docs --strict` |
| [`SC-ERR-01`](acceptance.md) | [`acceptance.md`](acceptance.md) | `SC-FUN-01`、`SC-FUN-02` |
| [`SC-EXT-01`](acceptance.md) | [`acceptance.md`](acceptance.md) | `SC-FUN-01`、`SC-FUN-02` |
| [`SC-FUN-01`](acceptance.md) | [`acceptance.md`](acceptance.md) | `SC-FUN-01`、`SC-FUN-02` |
| [`SC-FUN-02`](acceptance.md) | [`acceptance.md`](acceptance.md) | `SC-FUN-01`、`SC-FUN-02` |
| [`SC-INT-01`](acceptance.md) | [`acceptance.md`](acceptance.md) | `SC-FUN-01`、`SC-FUN-02` |
| [`SC-INT-02`](acceptance.md) | [`acceptance.md`](acceptance.md) | `SC-FUN-01`、`SC-FUN-02` |
| [`SC-INT-03`](acceptance.md) | [`acceptance.md`](acceptance.md) | `SC-FUN-01`、`SC-FUN-02` |
| [`SC-OPS-01`](acceptance.md) | [`acceptance.md`](acceptance.md) | `SC-FUN-01`、`SC-FUN-02` |
| [`SC-PER-01`](acceptance.md) | [`acceptance.md`](acceptance.md) | `SC-FUN-01`、`SC-FUN-02` |
| [`SC-TEN-01`](acceptance.md) | [`acceptance.md`](acceptance.md) | `SC-FUN-01`、`SC-FUN-02` |
| [`SC-TEN-02`](acceptance.md) | [`acceptance.md`](acceptance.md) | `SC-FUN-01`、`SC-FUN-02` |
| [`EC-01`](functional.md) | [`invariants.md`](../architecture/data/invariants.md) | `SC-INT-01`、`SC-INT-02` |
| [`EC-02`](functional.md) | [`invariants.md`](../architecture/data/invariants.md) | `SC-INT-01`、`SC-INT-02` |
| [`EC-03`](functional.md) | [`invariants.md`](../architecture/data/invariants.md) | `SC-INT-01`、`SC-INT-02` |
| [`EC-04`](functional.md) | [`invariants.md`](../architecture/data/invariants.md) | `SC-INT-01`、`SC-INT-02` |
| [`EC-05`](functional.md) | [`invariants.md`](../architecture/data/invariants.md) | `SC-INT-01`、`SC-INT-02` |
| [`EC-06`](functional.md) | [`invariants.md`](../architecture/data/invariants.md) | `SC-INT-01`、`SC-INT-02` |
| [`EC-07`](functional.md) | [`invariants.md`](../architecture/data/invariants.md) | `SC-INT-01`、`SC-INT-02` |
| [`EC-08`](functional.md) | [`invariants.md`](../architecture/data/invariants.md) | `SC-INT-01`、`SC-INT-02` |
| [`EC-09`](functional.md) | [`invariants.md`](../architecture/data/invariants.md) | `SC-INT-01`、`SC-INT-02` |
| [`EC-10`](functional.md) | [`invariants.md`](../architecture/data/invariants.md) | `SC-INT-01`、`SC-INT-02` |
| [`EC-11`](functional.md) | [`invariants.md`](../architecture/data/invariants.md) | `SC-INT-01`、`SC-INT-02` |
| [`EC-12`](functional.md) | [`invariants.md`](../architecture/data/invariants.md) | `SC-INT-01`、`SC-INT-02` |
| [`EC-13`](functional.md) | [`invariants.md`](../architecture/data/invariants.md) | `SC-INT-01`、`SC-INT-02` |
| [`EC-14`](functional.md) | [`invariants.md`](../architecture/data/invariants.md) | `SC-INT-01`、`SC-INT-02` |
| [`EC-15`](functional.md) | [`invariants.md`](../architecture/data/invariants.md) | `SC-INT-01`、`SC-INT-02` |
| [`EC-16`](functional.md) | [`invariants.md`](../architecture/data/invariants.md) | `SC-INT-01`、`SC-INT-02` |
| [`EC-17`](functional.md) | [`invariants.md`](../architecture/data/invariants.md) | `SC-INT-01`、`SC-INT-02` |
| [`EC-18`](functional.md) | [`invariants.md`](../architecture/data/invariants.md) | `SC-INT-01`、`SC-INT-02` |
| [`EC-19`](functional.md) | [`invariants.md`](../architecture/data/invariants.md) | `SC-INT-01`、`SC-INT-02` |
| [`EC-20`](functional.md) | [`invariants.md`](../architecture/data/invariants.md) | `SC-INT-01`、`SC-INT-02` |
| [`OOS-01`](out-of-scope.md) | [`out-of-scope.md`](out-of-scope.md) | `SC-TEN-01`、`SC-TEN-02` |
| [`OOS-02`](out-of-scope.md) | [`out-of-scope.md`](out-of-scope.md) | `SC-TEN-01`、`SC-TEN-02` |
| [`OOS-03`](out-of-scope.md) | [`out-of-scope.md`](out-of-scope.md) | `SC-TEN-01`、`SC-TEN-02` |
| [`OOS-04`](out-of-scope.md) | [`out-of-scope.md`](out-of-scope.md) | `SC-TEN-01`、`SC-TEN-02` |
| [`OOS-05`](out-of-scope.md) | [`out-of-scope.md`](out-of-scope.md) | `SC-TEN-01`、`SC-TEN-02` |
| [`OOS-06`](out-of-scope.md) | [`out-of-scope.md`](out-of-scope.md) | `SC-TEN-01`、`SC-TEN-02` |
| [`OOS-07`](out-of-scope.md) | [`out-of-scope.md`](out-of-scope.md) | `SC-TEN-01`、`SC-TEN-02` |
| [`OOS-08`](out-of-scope.md) | [`out-of-scope.md`](out-of-scope.md) | `SC-TEN-01`、`SC-TEN-02` |
| [`OOS-09`](out-of-scope.md) | [`out-of-scope.md`](out-of-scope.md) | `SC-TEN-01`、`SC-TEN-02` |
| [`OOS-10`](out-of-scope.md) | [`out-of-scope.md`](out-of-scope.md) | `SC-TEN-01`、`SC-TEN-02` |
| [`OOS-11`](out-of-scope.md) | [`out-of-scope.md`](out-of-scope.md) | `SC-TEN-01`、`SC-TEN-02` |
| [`OOS-12`](out-of-scope.md) | [`out-of-scope.md`](out-of-scope.md) | `SC-TEN-01`、`SC-TEN-02` |
| [`OOS-13`](out-of-scope.md) | [`out-of-scope.md`](out-of-scope.md) | `SC-TEN-01`、`SC-TEN-02` |
| [`OOS-14`](out-of-scope.md) | [`out-of-scope.md`](out-of-scope.md) | `SC-TEN-01`、`SC-TEN-02` |
| [`OOS-15`](out-of-scope.md) | [`out-of-scope.md`](out-of-scope.md) | `SC-TEN-01`、`SC-TEN-02` |
| [`OOS-16`](out-of-scope.md) | [`out-of-scope.md`](out-of-scope.md) | `SC-TEN-01`、`SC-TEN-02` |
| [`OOS-17`](out-of-scope.md) | [`out-of-scope.md`](out-of-scope.md) | `SC-TEN-01`、`SC-TEN-02` |
| [`OOS-18`](out-of-scope.md) | [`out-of-scope.md`](out-of-scope.md) | `SC-TEN-01`、`SC-TEN-02` |
| [`OOS-19`](out-of-scope.md) | [`out-of-scope.md`](out-of-scope.md) | `SC-TEN-01`、`SC-TEN-02` |
| [`US-001`](user-stories.md) | [`user-stories.md`](user-stories.md) | `SC-FUN-01`、`SC-FUN-02` |
| [`US-002`](user-stories.md) | [`user-stories.md`](user-stories.md) | `SC-FUN-01`、`SC-FUN-02` |
| [`US-003`](user-stories.md) | [`user-stories.md`](user-stories.md) | `SC-FUN-01`、`SC-FUN-02` |
| [`US-004`](user-stories.md) | [`user-stories.md`](user-stories.md) | `SC-FUN-01`、`SC-FUN-02` |
| [`US-005`](user-stories.md) | [`user-stories.md`](user-stories.md) | `SC-FUN-01`、`SC-FUN-02` |
| [`US-006`](user-stories.md) | [`user-stories.md`](user-stories.md) | `SC-FUN-01`、`SC-FUN-02` |
| [`US-007`](user-stories.md) | [`user-stories.md`](user-stories.md) | `SC-FUN-01`、`SC-FUN-02` |
| [`US-008`](user-stories.md) | [`user-stories.md`](user-stories.md) | `SC-FUN-01`、`SC-FUN-02` |
| [`US-009`](user-stories.md) | [`user-stories.md`](user-stories.md) | `SC-FUN-01`、`SC-FUN-02` |
| [`US-010`](user-stories.md) | [`user-stories.md`](user-stories.md) | `SC-FUN-01`、`SC-FUN-02` |

---
