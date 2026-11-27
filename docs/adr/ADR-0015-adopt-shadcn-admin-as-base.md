---
status: accepted
---

# ADR-0015: 以 shadcn-admin 为新基座重建前端 UI

采用 [satnaing/shadcn-admin](https://github.com/satnaing/shadcn-admin) v2.2.1（MIT）作为新基座，在 `rebuild/shadcn-admin` 分支上重建 UI 层；现有 `main` 保留作回退与参照。只换「壳 + 组件 + 主题」，业务逻辑层原样搬迁。

## 决策

- **路由**：代码式 `createRoute` 改为文件式路由 + 生成的 `routeTree.gen.ts`。URL 路径与 `beforeLoad` 守卫语义（鉴权、onboarding、邀请重定向）保持不变，迁移期不改 URL。
- **数据层**：`lib/api.ts`、Zustand store、鉴权与现有单测先原样搬入；页面跑通后再按页逐步引入 TanStack Query（混合方案），不在首轮同时更换数据方案。
- **主题**：支持 `Default` 与 `Solar Dusk`（shadcn.io 预设）两套 preset，各含 light/dark。preset 只负责颜色、圆角、图表色、密度；字体为「预设 Latin 字体 + 中文回退栈」，选择持久化到现有 preferences store。
- **迁移顺序**：登录/注册 → 壳（sidebar/topbar/nav） → dashboard 首页 → 成员/设置类表格页 → books/articles → lineage（最重，含 d3/elk 画布，最后迁移）。
- **成功标准**：功能零回归 + 视觉统一为成熟后台；开发效率与多主题为加分项。
- **命名**：包名 `nocoapp-dev` 修正为 `yunpu`（合仓后工作区包名为 `@yunpu/web`）；产品与仓库统一使用 yunpu，不再使用 nocoapp。

## 考虑过的做法

- 只借视觉 token、不动架构：改动最小，但拿不到表格、弹层、设置页等现成结构。
- 只引入 shadcn/ui 组件层、保留现有布局与路由：收益集中且风险低，但拿不到 sidebar/header 与 data-table 套件。
- 只换壳、保留代码式路由：壳层与模板的目录约定不一致，后续维护割裂。
- 整仓作为新基座：成本最高，但一次对齐路由、布局、组件与主题；用户明确选择此路径。

模板中的示例业务（faker 数据、tasks/users/chats、Clerk 演示、mock 登录、英文文案）一律不引入。

## 后果

- 迁移期内新旧两套 UI 并存，`main` 是唯一回退点。
- 模板自身没有鉴权守卫与 service 层，鉴权与 API 接线由本项目补齐。
- 模板有 10 个 RTL 改造组件与上游 shadcn/ui 已分叉，后续升级需手工合并。
- lineage 的图谱画布依赖现有布局假设，放到最后迁移并单独验证。
