<!-- sdd-init-template-version:0.1.0 sha256:b26526df99b0c238a911ef2bac49087f64acfb3ed7c7e01f294a56f13f5e3488 -->
# Pitfalls (anchored ledger)

A record of repeated mistakes. Every row carries a date or `@commit`; stale entries are marked `superseded` rather than silently rewritten.

| 锚点（日期 / Commit） | 命中次数 | 反模式（禁止 X） | 正确做法（必须 Y） | 晋升状态 |
|---|---|---|---|---|
| _(示例待填：YYYY-MM-DD 或 @commit)_ | 0 | _(禁止的做法)_ | _(必须的做法)_ | 观察中 |

本表严控 ≤ 30 条，原位更新（update in place），新增前先查是否已有同类锚点。

**晋升阶梯**：同类失误命中 ≥ 2 次必须固化为「唯一入口 > 静态类型 > `dependency-cruiser`/Lint 门禁 > 测试」，固化后删掉文字描述，只留门禁。
