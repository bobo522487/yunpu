---
status: accepted
---

# ADR-0023: 谱系主画布、人物卡片与关联界面的配色预设语义令牌化

2026-11-28，为落实 [ADR-0015](ADR-0015-adopt-shadcn-admin-as-base.md) 对谱系模块的预设适配，并与 [ADR-0022](ADR-0022-project-rail-redesign-and-family-icon.md) 确立的平台级「配色预设（`Default` / `Solar Dusk` × 浅色/深色）」体系保持一致，作出如下架构与样式令牌决策。

## Context

1. **画布底色被历史样式劫持**：[domain.css](../../apps/web/src/styles/domain.css) 中的 `.fs-lineage-theme` 强制将全局 `--background` 覆写为冷青灰（`hsl(180 6% 94.5%)`）与冷深蓝（`hsl(214 18% 10.5%)`），并挂载在 [LineagePage.tsx](../../apps/web/src/features/lineage/pages/LineagePage.tsx) 及 6 个谱系弹窗上，导致切换到 `Solar Dusk` 时底色完全失效。
2. **硬编码冷青色与多处重复定义**：主画布中的 [PersonNode.tsx](../../apps/web/src/features/lineage/canvas/nodes/PersonNode.tsx)、[UnionNode.tsx](../../apps/web/src/features/lineage/canvas/nodes/UnionNode.tsx)、[GenealogyCanvas.tsx](../../apps/web/src/features/lineage/canvas/GenealogyCanvas.tsx) 小地图，以及同屏右侧详情抽屉（[PersonAvatarPortrait.tsx](../../apps/web/src/features/lineage/components/PersonAvatarPortrait.tsx)、[PersonFamilySection.tsx](../../apps/web/src/features/lineage/components/PersonFamilySection.tsx)）与谱系弹窗（[AddRelativeModal.tsx](../../apps/web/src/features/lineage/components/AddRelativeModal.tsx)、[ParentChildRelationModal.tsx](../../apps/web/src/features/lineage/components/ParentChildRelationModal.tsx)、[PersonPortraitModal.tsx](../../apps/web/src/features/lineage/components/PersonPortraitModal.tsx)、[LineageStatsModal.tsx](../../apps/web/src/features/lineage/components/LineageStatsModal.tsx)）广泛硬编码 FamilySearch 冷青色（`#057091` / `#2097B7` / `#58B1CD`）、玫粉（`#ED5481`）、亮黄（`#FFC400`）与 Tailwind `sky-*` / `rose-*` / `slate-*` 色值；小地图还直接依赖 `usePreferencesStore.isDarkMode`，在 `system` 模式下存在同步缺口。
3. **通用令牌不足以覆盖谱系图底层次与领域语义**：[theme.css](../../apps/web/src/styles/theme.css) 中 `Default` 浅色的 `--background` 与 `--card` 同为纯白（`oklch(1 0 0)`），若画布直接复用 `--background`，白色人物卡片将失去图底层次；同时谱系中的性别识别色、开基始祖徽章与世系连线属于领域专用语义，无法直接等同于通用 `--primary`。
4. **深色模式打印风险**：[domain.css](../../apps/web/src/styles/domain.css) 的 `@media print` 未对画布与卡片的暗色变量做白纸覆写，深色模式下触发「打印谱系图」会输出暗底或低对比页面。

## Decision

1. **全谱系模块统一收口并废除 `.fs-lineage-theme` 对 `--background` 的覆写**：
   - 本次适配覆盖全谱系三圈：主画布区域（画布舞台、人物卡片、联姻/折叠节点、关系连线、小地图）、右侧人物详情抽屉（顶栏头像与家庭成员卡片/子女列表）以及全部谱系弹窗与深度统计弹窗。
   - 移除 `LineagePage` 与 6 个弹窗上覆写 `--background` 的 `.fs-lineage-theme` 依赖，避免污染弹窗与抽屉的全局语义底色。
2. **在四套配色预设下定义谱系专用语义令牌（`--lineage-*`）**：
   - 与 [ADR-0022](ADR-0022-project-rail-redesign-and-family-icon.md) 删除冗余 `--rail-*` 令牌不同，谱系画布具备通用 shadcn 令牌未涵盖的领域视觉维度，因此按 `:root` / `.dark` / `[data-preset='solar-dusk']` / `.dark[data-preset='solar-dusk']` 维护精简的 `--lineage-*` 语义令牌组：
     - **沉降纯色画布舞台（`--lineage-canvas-bg`）**：四套预设均相对 `--card` 适度沉降以保证清晰图底对比（`Default` 微冷浅灰 / 深石板蓝；`Solar Dusk` 温润浅米褐 / 暖暮咖），且保持纯色无点阵网格。
     - **色相稳定、色温调和的性别与状态令牌（`--lineage-male-*`、`--lineage-female-*`、`--lineage-unknown-*`、`--lineage-living-*`）**：`Default` 保持「男 = 蓝/青系、女 = 红/玫系、不详/已故 = 中性灰、健在 = 绿系」的稳定认知且零视觉回归；`Solar Dusk` 下性别色**整体转为暖色家族**——男 = 深琥珀/赭（浅色 `oklch(0.58 0.135 50)` / 深色 `oklch(0.72 0.125 52)`），女 = 温润暖棕（`oklch(0.74 0.085 68)` / `oklch(0.82 0.065 70)`），不详/已故 = 暖褐灰（`oklch(0.66 0.032 65)` / `oklch(0.56 0.032 62)`），与暖米褐/深咖画布同色温。男性刻意压暗至约 `L 0.58`，明显深于选中框与开基始祖徽章的亮金（`L 0.76`–`0.80`），因此在改用琥珀系后仍与二者保持语义可区分度（见 Considered Options 第 2 条）。主画布上已故人物卡片与健在人物卡片保持同等清晰度，不做额外置灰或降透明。
     - **性别色仅由令牌驱动，禁止硬编码**：主画布人物节点（顶部色条、头像底、聚焦底）、右侧详情抽屉的自动生成头像框（[PersonAvatarPortrait.tsx](../../apps/web/src/features/lineage/components/PersonAvatarPortrait.tsx)）与家庭成员卡片（[PersonFamilySection.tsx](../../apps/web/src/features/lineage/components/PersonFamilySection.tsx)）全部经 [lineageTheme.ts](../../apps/web/src/features/lineage/utils/lineageTheme.ts) 的 `getGenderTopStripeClass` / `getGenderBarClass` / `getGenderAvatarToneClass` / `getGenderFocusBgClass` / `getGenderCardSurfaceClass` 映射到 `--lineage-male|female|unknown`；组件层不得出现 Tailwind 色阶（`sky-*` / `rose-*` / `slate-*`）或十六进制字面量，新增配色预设时无需改动任何组件。
     - **开基始祖徽章令牌（`--lineage-progenitor-bg` / `--lineage-progenitor-fg`）**：保留荣誉金色语义，在 `Solar Dusk` 下微调为温润鎏金（配深暖褐图标），与琥珀主色选中框保持可区分度。
     - **世系连线与小地图令牌（`--lineage-edge`、`--lineage-minimap-node`）**：在 `Solar Dusk` 深色下提供暖调连线而非冷感半透明白；小地图完全改由 CSS 变量驱动（选中人物 `var(--primary)`、一世始祖 `var(--lineage-progenitor-bg)`、普通人物与联姻节点各司其色），消除 JS `isDarkMode` 分支，并修正小地图遮罩 `color-mix` 透明度 `0.75%` 笔误为 `75%`。
3. **非性别交互态、阴影、圆角与暗房控件对齐平台语义**：
   - 人物卡片底色、文字、阴影、选中框、聚焦环、`+` 亲属按钮及弹出菜单、`UnionNode` 展开/折叠按钮及 `LineageStatsModal` 顶栏范围徽章全部改用平台预设语义令牌（`--card`、`--card-foreground`、`--muted-foreground`、`--popover`、`--primary`、`--ring`、`--surface-*`、`--shadow-*`）。
   - 人物卡片圆角接入 `--radius-md`（`Default` 下仍精确为 `8px`，`Solar Dusk` 下自动柔和为约 `11.6px`），不改变 `123px × 220px` 卡片几何尺寸与布局坐标。
   - `PersonPortraitModal` 裁剪区保留深色校色暗房背景，但由冷 `slate-950` / `rgba(15,23,42,0.58)` 调整为中性纯黑 `neutral-950` / `rgba(0,0,0,0.6)`。
4. **移除堂号标题节点（`ClanHeaderNode`）**：
   - 删除 `ClanHeaderNode.tsx` 及其在 [types.ts](../../apps/web/src/features/lineage/canvas/types.ts) 的 `ClanHeaderNodeData` / `ClanHeaderFlowNode` 类型、[GenealogyCanvas.tsx](../../apps/web/src/features/lineage/canvas/GenealogyCanvas.tsx) 的 `nodeTypes` 注册，以及 [layoutBuilder.ts](../../apps/web/src/features/lineage/canvas/utils/layoutBuilder.ts) 中在始祖卡片上方 `58px` 处生成 `clan-header-${root.id}` 节点的逻辑；`GenealogyFlowNode` 收窄为 `PersonFlowNode | UnionFlowNode`。
   - 始祖身份仍由保留的开基始祖人物卡片与金色徽章（`--lineage-progenitor-bg`）表达，不再重复以「某 氏」文字标题呈现；原先为标题预留的纵向版面一并回收，始祖卡片整体上移，画布更紧凑。
   - 姓氏（`clanSurname`）仍参与人物命名与拓扑签名，仅不再渲染独立标题节点。
5. **打印介质白纸高对比覆写**：
   - 在 `@media print` 中显式将画布舞台、卡片表面、文字与世系连线令牌覆写为白纸与深墨高对比浅色值，确保用户在任意深色模式或 `Solar Dusk` 预设下均可正常打印谱系图。
   - 该白纸配色表本身是 `Default` 的冷色快照，若不加区分会让 `Solar Dusk` 打印时男性节点悄悄退回蓝色。因此追加一条 `[data-preset='solar-dusk']` / `.dark[data-preset='solar-dusk']` 的打印覆写，改用暖色纸面对应值（男 `#b45309`、女 `#a8763e`、不详 `#78716c`，均 ≥3:1 于白纸），并以单测锁定「暖色通道红 > 蓝」，防止回退。

## Considered Options

- **画布直接复用 `--background`**：否决。`Default` 浅色中 `--background` 与 `--card` 同为纯白，人物卡片会失去图底边界。
- **将男性识别色直接绑定 `--primary`**：否决。`--primary` 在 `Solar Dusk` 下是亮琥珀金，直接复用会让男性卡片与卡片选中框、开基始祖徽章发生语义撞色。注意此否决针对的是「绑定 `--primary` 这个令牌」，而非「男性不可用暖色」——本 ADR 后续修订改为独立的深琥珀 `--lineage-male` 令牌（`L 0.58`，明显深于 `--primary` 的亮金），既保留暖色温度又避免了撞色。
- **性别色与始祖徽章跨预设保持固定十六进制**：否决。高饱和冷青/霓虹粉与亮柠檬黄在 `Solar Dusk` 暖米褐与深咖表面上显得割裂。
- **仅适配主画布，不改动抽屉卡片与谱系弹窗**：否决。同屏打开人物详情抽屉、添加亲属或深度统计弹窗时会跳回冷天蓝色，且残留 `.fs-lineage-theme` 对弹窗底色的劫持。

## Consequences

- 谱系全模块四套主题组合由单一 CSS 语义令牌契约驱动，新增平台配色预设时只需补充对应 `--lineage-*` 变量块即可自动生效。
- 彻底消除 `MiniMap` 在 `system` 外观下的 `isDarkMode` 不同步隐患，以及亲属/关系/肖像弹窗中 `sky-*` 底色叠加 `--primary` 暖橙文字的撞色缺陷。
- 堂号标题节点移除后，画布纵向版面回收 `58px`，始祖卡片直接作为世系顶点；「某 氏」不再作为独立文字出现，姓氏信息仍通过人物命名与详情抽屉呈现。
- 打印谱系图在 `Solar Dusk` 下保持暖色性别语义，不再因白纸覆写而退回 `Default` 的冷蓝/玫红。
- 本决策不与 [ADR-0015](ADR-0015-adopt-shadcn-admin-as-base.md) 或 [ADR-0022](ADR-0022-project-rail-redesign-and-family-icon.md) 冲突，属对 ADR-0015 谱系预设适配项的正式收口。
