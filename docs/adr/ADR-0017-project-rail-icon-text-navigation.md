---
status: accepted
supersedes: ADR-0016-project-workspace-three-pane-shell
amended_by: ADR-0021-project-rail-overview-reentry
---

# ADR-0017: 项目图标导航条改为 75px 图标+文字导航

> **状态说明（2026-11-28）：** 本 ADR 第 8、12、19 行关于「移除非业务入口『概览』」「概览页不再有选中项」的决定已被 [ADR-0021](ADR-0021-project-rail-overview-reentry.md) 推翻。用户明确要求在项目内 mini rail 首位恢复「概览」入口并指向项目首页；其余决定（75px 宽度、图标+文字、返回按钮、三栏关系）继续有效。

取代 [ADR-0016](ADR-0016-project-workspace-three-pane-shell.md) 中关于图标导航条尺寸与入口清单的决定：移除非业务入口「概览」，把最左侧导航区加宽到 75px，并用约 25px 图标配文字呈现谱系、谱文、谱书、设置。项目首页路由仍保留，可从组织空间与面包屑进入。文字标签让四个业务入口无需悬停即可自解释，同时保持图标导航条、业务侧栏与内容区的三栏关系。

## Considered Options

- 保持 48px 纯图标并按 `title` 提示：否决。入口语义依赖悬停，且概览入口模糊了业务导航的边界。
- 只移除概览但仍使用纯图标：否决。剩余入口仍无法自解释。
- 加宽到 75px，四个业务入口使用图标+文字，返回按钮保留 logo 加箭头：采纳。

## Consequences

- `leftOffset` 必须与图标导航条宽度同步为 75；业务侧栏自身仍为 252px 且可拖拽。
- 概览页不再有选中项；用户从组织空间或面包屑进入项目首页。
- 用户可见术语仍为「谱系 / 谱文 / 谱书」；代码标识符继续保留 `lineage` 以兼容既有数据。
