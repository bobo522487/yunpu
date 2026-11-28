---
status: accepted
---

# ADR-0024: 业务侧栏分隔线由拖拽手柄独占绘制

2026-11-28，为解决**业务侧栏**与**内容区**之间那条分隔线在真实设备上被渲染成「三条竖线」的缺陷，并与 [ADR-0017](ADR-0017-project-rail-icon-text-navigation.md) 确立的可拖拽业务侧栏宽度、[ADR-0022](ADR-0022-project-rail-redesign-and-family-icon.md) 确立的「不保留冗余装饰竖线」取向保持一致，作出如下架构与样式决策。

## Context

1. **同一个边界被画了两遍**：[project-sidebar.tsx](../../apps/web/src/components/layout/project-sidebar.tsx) 的桌面态根节点带 `border-r border-border`，而 [project-shell-layout.tsx](../../apps/web/src/components/layout/project-shell-layout.tsx) 紧随其后又渲染了一个拖拽手柄，手柄内部再用 `w-px bg-border` 画一条线。两条线在 `leftOffset: 75` 的约束下精确相邻（实测 `侧栏 right = 327` 与 `手柄 left = 327` 重合），于是同一条边界出现两列墨迹。
2. **线被 translate 到半像素上**：手柄原实现为 `w-1`（4px）热区，线用 `left-1/2 -translate-x-1/2` 居中，锚点为 `W + 1.5px`。在 dpr=1 下这条 1px 线跨在两个设备像素之间，被抗锯齿摊成两列各约 50% 覆盖的浅色（实测 `rgb(240,243,247)` 两列），肉眼读作「第三条线」；在 dpr=2 下则变成两条相距 1.5 CSS px 的清晰平行线。
3. **半像素摊薄在深色模式下退化为灰雾**：`--border` 在深色下为 `oklch(1 0 0 / 10%)`（[theme.css](../../apps/web/src/styles/theme.css)），50% 覆盖后仅剩 5% 白叠深底，几乎不可见，于是深色下呈现「一条实线 + 一团灰雾」，与浅色下的观感不一致。
4. **手柄只有鼠标一种操作方式**：原手柄无 `tabIndex`、无 `aria-valuenow`、无键盘响应，键盘用户无法调整业务侧栏宽度；且 `useResizable` 在越界时直接 `return`，拖到边界后继续移动会卡住。
5. **领域词汇存在真实缺口**：`docs/glossary.md` 未定义这条分隔线，组件 `aria-label` 使用的「侧边栏」既非权威术语也未列入禁用同义词；而「分割线」一词已被谱文编辑器的水平分割线占用（[slashCommands.ts](../../apps/web/src/features/articles/domain/slashCommands.ts)）。

## Decision

1. **一条边界只允许一个绘制者：分隔线归拖拽手柄独占**。
   - 移除 [project-sidebar.tsx](../../apps/web/src/components/layout/project-sidebar.tsx) 桌面态（`!inDrawer`）的 `border-r border-border`，仅保留 `z-30` 叠放层级；移动端抽屉态不受影响。
   - 手柄内部保留唯一的 `<span>` 作为那条线，业务侧栏与**内容区**均不得再画相邻边框。
2. **线钉在手柄左边缘，且必须是整数像素**。
   - 热区宽度由 `w-1`（4px）调整为 `w-2`（8px），线改用 `left-0` 对齐，删除 `left-1/2` 与 `-translate-x-1/2`。因为手柄紧贴业务侧栏右边缘，线因此精确落在业务侧栏的右边界上，既不留缝也不重复描边。
   - [useResizable.ts](../../apps/web/src/hooks/useResizable.ts) 的 `setWidth` 统一做 `Math.round` 并 clamp 到 `[minWidth, maxWidth]`，保证业务侧栏宽度恒为整数，边界不会因拖拽落到小数上；越界改为 clamp 而非 `return`，消除拖到边界后卡死的手感。
3. **颜色沿用 `--border`，强调态沿用 `--primary`，且强调时不加粗**。
   - 静止态 `bg-border`，悬停、聚焦与拖拽中一律切换为 `bg-primary`；线宽在任何状态下恒为 1px，不用加粗表达强调（加粗会重新引入半像素问题）。
4. **手柄是完整的可访问分隔件，而非纯鼠标热区**。
   - `role='separator'`、`aria-orientation='vertical'`、`aria-label='调整业务侧栏宽度'`、`aria-controls` 指向业务侧栏、`aria-valuenow/min/max` 分别取当前宽度与 220/380。
   - `tabIndex={0}`，聚焦时用 `focus-visible:ring-2 ring-ring ring-inset` 提示；`ArrowLeft`/`ArrowRight` 以 16px 步进，`Home`/`End` 直达上下限。
5. **术语收口**：`docs/glossary.md` 新增**业务侧栏分隔线**与**内容区**两条，并把「分割线」明确留给谱文编辑器的水平分割线；手柄 `aria-label` 由「调整侧边栏宽度」改为「调整业务侧栏宽度」。

## Considered Options

- **只把线改成 `left-0` 而保留业务侧栏的 `border-r`**：否决。两条线会严丝合缝地重叠成 2px 深色实线，比原来的三线更粗更脏。
- **只删业务侧栏的 `border-r` 而保留 `left-1/2 -translate-x-1/2`**：否决。半像素锚点仍在，dpr=1 下依旧被摊成两列浅色，用户看到的问题不消失。
- **给手柄加 `transform: translateZ(0)` 或 `will-change` 触发独立合成层来「吸附」像素**：否决。合成层无法保证线的几何位置落在整数设备像素上，且在缩放与不同 dpr 下行为不可预测，属于用渲染副作用掩盖布局错误。
- **把线画成 2px 以规避半像素**：否决。会与全站 1px 边框体系不一致，且用户在 dpr=2 下会看到 4 个设备像素的粗线。
- **保留 4px 热区（`w-1`）**：否决。4px 热区在触控板与高 dpr 屏上都偏窄，而 8px 仍不侵占**内容区**的可读宽度。
- **用业务侧栏的 `border-r` 兼作拖拽手柄（把 `onMouseDown` 挂到侧栏上）**：否决。手柄需要独立的热区与焦点，挂在侧栏上会让侧栏内部任意位置都成为拖拽起点。
- **让键盘调整走 `useResizable` 内部而非布局层**：否决。`useResizable` 同时服务谱系人物详情抽屉（`edge: 'right'`），把方向键语义塞进通用 hook 会让两处耦合；键盘步进属于布局层对分隔件的解释。

## Consequences

- 业务侧栏与**内容区**之间在 dpr=1 与 dpr=2、浅色与深色、静止与悬停的六种组合下都只有一条 1px 实线：实测 dpr=1 墨迹仅 `x=327` 一列满色 `rgb(226,232,240)`，dpr=2 为 `x=654,655` 两个设备像素连成一段。
- 业务侧栏宽度不再出现小数，拖拽到 220/380 边界时钳制而非卡死；键盘用户可用方向键、Home、End 调整宽度。
- 新增测试锁定该契约：[project-shell-layout.test.tsx](../../apps/web/src/components/layout/project-shell-layout.test.tsx) 断言业务侧栏 `borderRightWidth` 为 `0px`、手柄宽 8px、线宽 1px、线左边缘严格等于业务侧栏右边缘、线无 `transform`、线色与页头底线同源，以及方向键/Home/End 的步进与钳制行为。
- 本决策不与 [ADR-0017](ADR-0017-project-rail-icon-text-navigation.md)（`leftOffset: 75`、业务侧栏 252px 可拖拽）或 [ADR-0022](ADR-0022-project-rail-redesign-and-family-icon.md)（移除冗余竖线、三栏顶线统一）冲突，属对二者「不保留冗余装饰竖线」取向的具体收口。
- 遗留同类问题：谱系人物详情抽屉仍由 [PersonDetailPanel.tsx](../../apps/web/src/features/lineage/components/PersonDetailPanel.tsx) 的 `border-l border-border` 与 [LineagePage.tsx](../../apps/web/src/features/lineage/pages/LineagePage.tsx) 的 1px 拖拽线重复描边，本次未纳入范围；后续若处理，应复用本 ADR 的「线归手柄独占」原则。
