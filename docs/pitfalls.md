<!-- sdd-init-template-version:0.1.0 sha256:b26526df99b0c238a911ef2bac49087f64acfb3ed7c7e01f294a56f13f5e3488 -->
# Pitfalls (anchored ledger)

A record of repeated mistakes. Every row carries a date or `@commit`; stale entries are marked `superseded` rather than silently rewritten.

| 锚点（日期 / Commit） | 命中次数 | 反模式（禁止 X） | 正确做法（必须 Y） | 晋升状态 |
|---|---|---|---|---|
| 2026-11-28 | 1 | 用户决策推翻既有 ADR 后，实施与 code-review 均未回写 ADR，直到审查才发现文档与代码冲突 | 决策反转（如恢复 ADR-0017 已移除的「概览」入口）必须在同轮 `/code-review` 收尾前新增或修订 ADR，并在原 ADR 标注 `amended_by` | 观察中 |
| 2026-11-28 | 1 | 用 `left-1/2` + `-translate-x-1/2` 把 1px 线居中到奇数宽热区上，锚点落在半像素，dpr=1 被抗锯齿摊成两列、dpr=2 变成两条平行线；同一侧栏边界还由侧栏 `border-r` 与手柄线各画一次 | 1px 装饰线必须钉在整数像素的容器边缘（`left-0` / `inset-y-0`），禁止 translate 居中；一条边界只允许一个绘制者，见 [ADR-0024](adr/ADR-0024-business-sidebar-separator-ownership.md) | 观察中 |

本表严控 ≤ 30 条，原位更新（update in place），新增前先查是否已有同类锚点。

**晋升阶梯**：同类失误命中 ≥ 2 次必须固化为「唯一入口 > 静态类型 > `dependency-cruiser`/Lint 门禁 > 测试」，固化后删掉文字描述，只留门禁。
