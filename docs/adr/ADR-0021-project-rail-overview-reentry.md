---
status: accepted
amends: ADR-0017-project-rail-icon-text-navigation
---

# ADR-0021: 项目 mini rail 恢复「概览」入口并统一设置入口命名

2026-11-28，组织空间侧栏优化需求（GitHub Spec #5 / FR-005 / FR-007）要求去掉全局侧栏的「当前项目」分组，并在项目内 mini rail 首位恢复「概览」入口（指向 `/projects/:projectId`），将原「设置」入口改名为「家族设置」以与全局「组织设置」同屏区分。

## Context

[ADR-0017](ADR-0017-project-rail-icon-text-navigation.md) 曾以「概览入口模糊业务导航边界」为由移除 mini rail 的「概览」，仅保留四个业务入口，项目首页改由组织空间卡片与面包屑进入。本次需求在拷问阶段（Q4）由用户明确修订：去掉全局「当前项目」分组后，mini rail 必须新增第五项「概览」并置于首位，确保项目首页仍有稳定、可发现的一级入口。原 ADR 的「移除概览」与「概览页不再有选中项」决定与新决策冲突，故以本 ADR 修订，其余决定（75px 宽度、图标+文字、返回按钮、三栏关系）继续有效。

## Considered Options

- 维持 ADR-0017：不恢复概览，靠家族卡片与面包屑进入项目首页：否决。用户 Q4 明确要求 mini rail 增加第五项入口，且全局分组移除后需要稳定一级入口。
- 恢复概览并命名为「项目首页」：否决。与全局侧栏原「项目概览」用语混淆；采用简短的「概览」并与面包屑一致。
- 恢复概览置于首位，其余四项顺序不变，末项改名「家族设置」：采纳。满足 Q4/Q7 决策，改动局限于 `railItems` 数据与高亮逻辑。

## Consequences

- mini rail 共五项：概览 / 谱系 / 谱文 / 谱书 / 家族设置；`railItems` 显式携带 `to` 模板，概览无法由 `key` 拼接，避免误指向 `/projects/:projectId/overview`。
- 项目首页（`section === ''`）时概览高亮；返回按钮仍指向 `/home`，保留 `/home` 路由。
- 全局侧栏「组织设置」（`/settings`）与项目内「家族设置」（`/projects/:projectId/settings`）同屏可区分。
- `apps/web/src/components/layout/project-mini-rail.tsx` 的测试为 Seam B 纯数据单测；真实导航行为由 e2e 与 `/browser` 实测覆盖。
