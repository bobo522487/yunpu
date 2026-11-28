---
status: accepted
amends: ADR-0021-project-rail-overview-reentry
---

# ADR-0022: 图标导航条扁平化激活态、两字入口简写与可配置家族图标

2026-11-28，针对项目工作台最左侧图标导航条的视觉与信息层级优化需求，作出以下三项架构与界面决策：

## Context

1. **图标导航条激活态与表面色失效**：[theme.css](../../apps/web/src/styles/theme.css) 定义的表面色令牌为 `oklch(...)` 值，但 [project-mini-rail.tsx](../../apps/web/src/components/layout/project-mini-rail.tsx) 与 [project-shell-layout.tsx](../../apps/web/src/components/layout/project-shell-layout.tsx) 误写为 `bg-[hsl(var(--surface-*))]`，导致导航条背景、悬停色与激活底色全部失效，只剩左侧 2px 竖线承担状态识别；同时三栏顶部基准线（64px / 52px / 56px）未能对齐。
2. **文案齐整度**：[ADR-0021](ADR-0021-project-rail-overview-reentry.md) 将导航条末项定名为「家族设置」，在 75px 窄栏中出现四字标签与其余四项两字标签（概览/谱系/谱文/谱书）字长不齐的问题。
3. **家族身份标识统一与可配置性**：导航条顶部原本固定展示云谱品牌印章，各处家族列表、面包屑与概览页也各自采用不同图标组件，用户在家族设置中无法上传专属家族图标，也未与平台「配色预设」（`Default` / `Solar Dusk`）联动。

## Decision

1. **图标导航条扁平化激活态与视觉分区**：
   - 彻底移除左侧 2px 竖线，修复无效 `hsl(var(--surface-*))` 调用，不再维护独立 `--rail-*` 令牌，而是直接复用与二级业务侧栏（`TreeItem` / `ProjectSidebar`）完全一致的扁平语义样式：`bg-[var(--surface-subtle)]` 导航底色、`hover:bg-[var(--surface-hover)]` 悬停反馈，以及 `bg-[var(--surface-active)] text-accent-foreground border-primary/20 font-semibold` 激活态（无 3D 阴影与高光）。
   - 保持 `75px` 栏宽与 `leftOffset: 75` 不变；四个高频编修视图（概览 / 谱系 / 谱文 / 谱书）置顶，设置入口经短分割线锚定底部；桌面端将图标导航条顶区、业务侧栏头与 `AppHeader` 统一对齐至 `56px`（`h-12 md:h-14`）。
   - 修订 `ADR-0021`：仅图标导航条视觉标签简写为两字「设置」（保留 `aria-label="家族设置"` 与 `title="家族设置"`），面包屑、家族设置页标题与页内入口仍保留「家族设置」，确保上下文与「组织设置」可区分。
2. **可配置家族图标与全站统一组件**：
   - `public.project` 新增可空 `icon_key` 列（`0029_project_icon_key.sql`），保留历史 `color_theme` 既有 6 色约束与默认值 `'sky'` 以维持契约兼容，不在家族设置中增加项目级主题色配置。
   - 抽离统一 `<FamilyIcon />` 组件：优先展示已鉴权媒体图片 `icon_key`，未配置或加载失败时按姓氏首字（缺省取家族名首字或「谱」）生成扁平实心主色方印（`bg-primary text-primary-foreground` + `border-primary-foreground/28`），直接忽略 `colorTheme` 并自动适配平台当前的「配色预设」（`Default` / `Solar Dusk` 及其浅/深模式）；全站图标导航条顶部、家族卡片、面包屑家族切换器、概览页头与家族编辑弹窗全部接入同一组件。
   - 图标导航条顶部常态展示当前家族图标，悬停或键盘聚焦时平滑淡出并切为返回箭头 + Tooltip，保留一键返回组织空间（`/home`）的直达路径；家族设置页采用单表单草稿，仅提供上传自定义图片（经 `/api/v1/projects/:projectId/media`）与恢复默认姓氏图标，随「保存更改」CAS 一并落盘。
3. **媒体 GC 对账保护与跨项目副本边界**：
   - 延伸 [ADR-0019](ADR-0019-project-media-guard-and-gc.md)，将 `public.project.icon_key` 纳入 [scripts/gc-media.ts](../../scripts/gc-media.ts) 的 `BEGIN READ ONLY` 特权对账查询，避免有效家族图标超过 24 小时宽限期后被孤立清理误删。
   - 家族媒体对象路径按 `projects/<projectId>/` 隔离且受跨项目成员鉴权保护，因此前端 `duplicateProject` 复制家族时不跨项目透传源 `iconKey`。

## Consequences

- `Default` 与 `Solar Dusk` 浅/深四套配色预设下，一级图标导航条与二级业务侧栏保持完全一致的扁平语义状态色阶、56px 齐平顶线与两汉字视觉节奏，默认家族图标亦同步跟随配色预设变化。
- 新增数据库迁移 `0029_project_icon_key.sql`（仅新增 `icon_key` 列，契约零破坏）；所有家族图标上传与未保存草稿复用既有的媒体魔数校验与离线 GC 机制，无额外孤立清理窗口。
- `project-mini-rail.test.ts`、`FamilyIcon.test.ts` 与 `tests/console/foundation.test.ts`、`tests/genealogy/project-media-guard.test.ts` 同步覆盖新结构、新字段与 GC 引用保护。
