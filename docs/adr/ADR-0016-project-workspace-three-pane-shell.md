---
status: superseded
supersededBy: ADR-0017-project-rail-icon-text-navigation
---

# ADR-0016: 项目工作台采用三栏导航外壳

恢复 shadcn-admin 基座前的项目工作台信息架构：组织空间保持单主侧栏；进入家族项目后切换为图标导航条、业务侧栏和内容区三栏。业务侧栏只在谱系、谱文、谱书页面出现，并复用已迁移的业务面板；用户可见文案统一为「谱系」，URL 与 store 字段继续保留 `lineage` 以兼容既有数据。

## Considered Options

- 继续用单一 shadcn 侧栏，在菜单项里动态切换：否决。这样会丢掉原产品里目录与正文并列的层级关系，也改变用户熟悉的导航几何。
- 原样复制 `main` 分支的 DOM 与组件：否决。这样会绕过当前主题 token 和 shadcn Sidebar 基础能力，后续难以跟随 preset 变化。
- 采用 shadcn Sidebar 基础组件重建外壳，同时保留原布局尺寸、导航顺序和 `nc-*` 语义标识：采纳。

## Consequences

- 项目模式与组织模式需要明确的路由边界：`/projects/$projectId/*` 进入项目三栏，其余组织页面维持单主侧栏。
- `LineageTreePanel`、`ArticleTreePanel`、`BookListPanel` 的内部逻辑不重写；本决策只约束外层导航壳。
- 「谱系」是用户可见术语；代码中的 `lineage` 是兼容性术语，不应被重命名。
