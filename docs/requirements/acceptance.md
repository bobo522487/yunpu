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
| `SC-DOC-01` | 编号一致性校验：悬空引用 0、一号两义 0、未引用 0                    | 校验脚本          |
| `SC-PER-01` | 列表接口在 1 万行数据集上 P95 响应 < 200ms（keyset 分页）       | 压测            |
| `SC-ERR-01` | 领域错误 100% 映射到具名应用错误码，无静默吞异常                    | 代码评审 + 错误码表核对 |
| `SC-OPS-01` | 迁移可在已有数据的库上零停机执行成功                             | 迁移演练          |
| `SC-EXT-01` | 导出快照在底稿修改后内容不变（逐字节校验）                          | 集成测试          |

---

## 9. 追溯矩阵

| 本文件条款                    | 对应实现                                                                       | 对应验证                      |
| ------------------------ | -------------------------------------------------------------------------- | ------------------------- |
| `FR-PER-01`..`FR-PER-03` | [`schema.md`](../architecture/data/schema.md) §5.6、§5.7                               | 同上 §13 验收清单               |
| `FR-REL-01`..`FR-REL-05` | [`schema.md`](../architecture/data/schema.md) §5.8、§9.2                               | 同上 §13 验收清单               |
| `FR-LIN-01`..`FR-LIN-02` | [`schema.md`](../architecture/data/schema.md) §5.10、§5.11、§6.1                        | `SC-FUN-01`               |
| `FR-SRC-01`..`FR-SRC-02` | [`schema.md`](../architecture/data/schema.md) §5.12、§5.13                             | 同上 §13 验收清单               |
| `FR-ART-01`..`FR-ART-02` | [`schema.md`](../architecture/data/schema.md) §5.14、§5.15                             | `EC-11`                   |
| `FR-BOK-01`..`FR-BOK-02` | [`schema.md`](../architecture/data/schema.md) §5.19–§5.21                             | `EC-13`、`EC-14`           |
| `FR-MED-01`              | [`schema.md`](../architecture/data/schema.md) §5.16                                   | `EC-02`（授权下载）             |
| `FR-ORG-01`..`FR-ORG-03` | [`schema.md`](../architecture/data/schema.md) §5.1–§5.4                               | `EC-08`、`EC-12`           |
| `FR-TEN-01`..`FR-TEN-03` | [`schema.md`](../architecture/data/schema.md) §8                                      | `SC-TEN-01`、`SC-TEN-02`   |
| `OOS-01`..`OOS-19`       | [`schema.md`](../architecture/data/schema.md) §14、[`overview.md`](../architecture/overview.md) §1.1（引用本节编号） | `SC-INT-02`               |
| 全部                       | 宪法 Article I–IX                                                            | 宪法 Constitution Check（两次） |

---
