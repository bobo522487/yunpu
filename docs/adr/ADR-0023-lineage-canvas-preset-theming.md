---
status: accepted
---

# ADR-0023: 谱系主画布、人物卡片与关联界面的配色预设语义令牌化

2026-11-28，为落实 [ADR-0015](ADR-0015-adopt-shadcn-admin-as-base.md) 对谱系模块的预设适配，并与 [ADR-0022](ADR-0022-project-rail-redesign-and-family-icon.md) 确立的平台级「配色预设（`Default` / `Solar Dusk` × 浅色/深色）」体系保持一致，作出如下架构与样式令牌决策。

## Context

1. **画布底色被历史样式劫持**：[domain.css](../../apps/web/src/styles/domain.css) 中的 `.fs-lineage-theme` 强制将全局 `--background` 覆写为冷青灰（`hsl(180 6% 94.5%)`）与冷深蓝（`hsl(214 18% 10.5%)`），并挂载在 [LineagePage.tsx](../../apps/web/src/features/lineage/pages/LineagePage.tsx) 及 6 个谱系弹窗上，导致切换到 `Solar Dusk` 时底色完全失效。
2. **硬编码冷青色与多处重复定义**：主画布中的 [PersonNode.tsx](../../apps/web/src/features/lineage/canvas/nodes/PersonNode.tsx)、[UnionNode.tsx](../../apps/web/src/features/lineage/canvas/nodes/UnionNode.tsx)、[ClanHeaderNode.tsx](../../apps/web/src/features/lineage/canvas/nodes/ClanHeaderNode.tsx)、[GenealogyCanvas.tsx](../../apps/web/src/features/lineage/canvas/GenealogyCanvas.tsx) 小地图，以及同屏右侧详情抽屉（[PersonAvatarPortrait.tsx](../../apps/web/src/features/lineage/components/PersonAvatarPortrait.tsx)、[PersonFamilySection.tsx](../../apps/web/src/features/lineage/components/PersonFamilySection.tsx)）与谱系弹窗（[AddRelativeModal.tsx](../../apps/web/src/features/lineage/components/AddRelativeModal.tsx)、[ParentChildRelationModal.tsx](../../apps/web/src/features/lineage/components/ParentChildRelationModal.tsx)、[PersonPortraitModal.tsx](../../apps/web/src/features/lineage/components/PersonPortraitModal.tsx)、[LineageStatsModal.tsx](../../apps/web/src/features/lineage/components/LineageStatsModal.tsx)）广泛硬编码 FamilySearch 冷青色（`#057091` / `#2097B7` / `#58B1CD`）、玫粉（`#ED5481`）、亮黄（`#FFC400`）与 Tailwind `sky-*` / `rose-*` / `slate-*` 色值；小地图还直接依赖 `usePreferencesStore.isDarkMode`，在 `system` 模式下存在同步缺口。
3. **通用令牌不足以覆盖谱系图底层次与领域语义**：[theme.css](../../apps/web/src/styles/theme.css) 中 `Default` 浅色的 `--background` 与 `--card` 同为纯白（`oklch(1 0 0)`），若画布直接复用 `--background`，白色人物卡片将失去图底层次；同时谱系中的性别识别色、开基始祖徽章与世系连线属于领域专用语义，无法直接等同于通用 `--primary`。
4. **深色模式打印风险**：[domain.css](../../apps/web/src/styles/domain.css) 的 `@media print` 未对画布与卡片的暗色变量做白纸覆写，深色模式下触发「打印谱系图」会输出暗底或低对比页面。

## Decision

1. **全谱系模块统一收口并废除 `.fs-lineage-theme` 对 `--background` 的覆写**：
   - 本次适配覆盖全谱系三圈：主画布区域（画布舞台、人物卡片、堂号标题、联姻/折叠节点、关系连线、小地图）、右侧人物详情抽屉（顶栏头像与家庭成员卡片/子女列表）以及全部谱系弹窗与深度统计弹窗。
   - 移除 `LineagePage` 与 6 个弹窗上覆写 `--background` 的 `.fs-lineage-theme` 依赖，避免污染弹窗与抽屉的全局语义底色。
2. **在四套配色预设下定义谱系专用语义令牌（`--lineage-*`）**：
   - 与 [ADR-0022](ADR-0022-project-rail-redesign-and-family-icon.md) 删除冗余 `--rail-*` 令牌不同，谱系画布具备通用 shadcn 令牌未涵盖的领域视觉维度，因此按 `:root` / `.dark` / `[data-preset='solar-dusk']` / `.dark[data-preset='solar-dusk']` 维护精简的 `--lineage-*` 语义令牌组：
     - **沉降纯色画布舞台（`--lineage-canvas-bg`）**：四套预设均相对 `--card` 适度沉降以保证清晰图底对比（`Default` 微冷浅灰 / 深石板蓝；`Solar Dusk` 温润浅米褐 / 暖暮咖），且保持纯色无点阵网格。
     - **色相稳定、色温调和的性别与状态令牌（`--lineage-male-*`、`--lineage-female-*`、`--lineage-unknown-*`、`--lineage-living-*`）**：保持「男 = 蓝/青系、女 = 红/玫系、不详/已故 = 中性灰、健在 = 绿系」的稳定认知；`Default` 维持现行清冽观感（零视觉回归），`Solar Dusk` 调和为低饱和石青/靛蓝、温润珊瑚胭脂红、暖褐灰与青竹/鼠尾草绿，避免荧光冷色漂浮或与 `Solar Dusk` 琥珀主色撞色。主画布上已故人物卡片与健在人物卡片保持同等清晰度，不做额外置灰或降透明。
     - **开基始祖徽章令牌（`--lineage-progenitor-bg` / `--lineage-progenitor-fg`）**：保留荣誉金色语义，在 `Solar Dusk` 下微调为温润鎏金（配深暖褐图标），与琥珀主色选中框保持可区分度。
     - **世系连线与小地图令牌（`--lineage-edge`、`--lineage-minimap-node`）**：在 `Solar Dusk` 深色下提供暖调连线而非冷感半透明白；小地图完全改由 CSS 变量驱动（选中人物 `var(--primary)`、一世始祖 `var(--lineage-progenitor-bg)`、普通人物与联姻节点各司其色），消除 JS `isDarkMode` 分支，并修正小地图遮罩 `color-mix` 透明度 `0.75%` 笔误为 `75%`。
3. **非性别交互态、阴影、圆角与暗房控件对齐平台语义**：
   - 人物卡片底色、文字、阴影、选中框、聚焦环、`+` 亲属按钮及弹出菜单、`ClanHeaderNode`、`UnionNode` 展开/折叠按钮及 `LineageStatsModal` 顶栏范围徽章全部改用平台预设语义令牌（`--card`、`--card-foreground`、`--muted-foreground`、`--popover`、`--primary`、`--ring`、`--surface-*`、`--shadow-*`）。
   - 人物卡片圆角接入 `--radius-md`（`Default` 下仍精确为 `8px`，`Solar Dusk` 下自动柔和为约 `11.6px`），不改变 `123px × 220px` 卡片几何尺寸与布局坐标。
   - `PersonPortraitModal` 裁剪区保留深色校色暗房背景，但由冷 `slate-950` / `rgba(15,23,42,0.58)` 调整为中性纯黑 `neutral-950` / `rgba(0,0,0,0.6)`。
4. **打印介质白纸高对比覆写**：
   - 在 `@media print` 中显式将画布舞台、卡片表面、文字与世系连线令牌覆写为白纸与深墨高对比浅色值，确保用户在任意深色模式或 `Solar Dusk` 预设下均可正常打印谱系图。

## Considered Options

- **画布直接复用 `--background`**：否决。`Default` 浅色中 `--background` 与 `--card` 同为纯白，人物卡片会失去图底边界。
- **将男性识别色直接绑定 `--primary`**：否决。在 `Solar Dusk` 下男性会变为琥珀橙/金，与卡片选中框和开基始祖徽章发生严重语义撞色。
- **性别色与始祖徽章跨预设保持固定十六进制**：否决。高饱和冷青/霓虹粉与亮柠檬黄在 `Solar Dusk` 暖米褐与深咖表面上显得割裂。
- **仅适配主画布，不改动抽屉卡片与谱系弹窗**：否决。同屏打开人物详情抽屉、添加亲属或深度统计弹窗时会跳回冷天蓝色，且残留 `.fs-lineage-theme` 对弹窗底色的劫持。

## Consequences

- 谱系全模块四套主题组合由单一 CSS 语义令牌契约驱动，新增平台配色预设时只需补充对应 `--lineage-*` 变量块即可自动生效。
- 彻底消除 `MiniMap` 在 `system` 外观下的 `isDarkMode` 不同步隐患，以及亲属/关系/肖像弹窗中 `sky-*` 底色叠加 `--primary` 暖橙文字的撞色缺陷。
- 本决策不与 [ADR-0015](ADR-0015-adopt-shadcn-admin-as-base.md) 或 [ADR-0022](ADR-0022-project-rail-redesign-and-family-icon.md) 冲突，属对 ADR-0015 谱系预设适配项的正式收口。
