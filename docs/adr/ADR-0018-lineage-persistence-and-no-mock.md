---
status: accepted
---

# ADR-0018: 谱系工作区全量持久化、平铺分组与前端彻底去 Mock

## Context

在 [ADR-0013](ADR-0013-monorepo-web-integration.md) 将 `@yunpu/web` 重新纳入统一 pnpm Monorepo 后，用户认证与控制台 `Project` CRUD 已对接 PostgreSQL 真实 API，但谱系工作区核心数据流仍停留在浏览器本地状态与 Mock 分支：

- `useLineageStore` 通过 `persist` 将谱系树、人物、别名、关系与生平事件写入 `localStorage`，登录不同账号或切换设备后无法同步，也无法享受服务端 `version` CAS 与数据库不变量校验。
- `apps/web` 中仍残留 `mockAuth`、`mockConsole`、`enableMock`、`demoAccount` 与 `direct-mock` 传输切换，以及前端「导入演示数据」按钮，容易在无代理或异常环境下产生假成功。
- 后端尚未建模平铺目录分组（`Folder`）、多谱系图（`Lineage`）、生平时间线事件（`PersonEvent`）、`Project.ancestor` 始迁祖字段，也未在开放界面展示的全部人物/名号/7 类关系字段上形成完整持久化与新用户范例初始化能力。

## Decision

- **平铺一层 `Folder` 与 `Lineage` 模型（迁移 `0027_lineage_workspace_persistence.sql`）**：
  - 新增 `folder` 表（`(project_id, id)` 复合主键、同项目名称唯一 `UNIQUE (project_id, name)`、`seq >= 0`），严格保持**平铺一层无 `parent_folder_id`**，目录树层级留在后续成书阶段表达。
  - 新增 `lineage` 表，携带可空 `folder_id`（外键 `ON DELETE SET NULL`）与整型 `version` CAS；删除 `Folder` 仅解绑下属 `Lineage` 回到未分组根层级，不连带删除谱系内容；删除 `Lineage` 时在同一事务内级联物理清理下属 `Person`、`PersonName`、`PersonRelation`、`PersonEvent` 与投影。
  - 新建带 `progenitor` 的 `Lineage` 或新建带 `ancestor` 的 `Project` 时，在同一个租户事务内自动创建首张 `Lineage` 及第一世始祖 `Person`。
- **人物、名号、关系全集与事件持久化 + S3 肖像存储**：
  - 扩展 `person`（姓名与拼音、性别、在世状态、结构化出生/死亡/葬期葬地信息、字辈与称谓、排序、传记、备注与 `avatar_key`）、`person_name`（展示类型、别名姓氏与拼音）和 `person_relation`（开放全部 7 类亲子与配偶关系、双向角色标签、排序与备注，强制同 `Lineage`、防自环与环路检查）。
  - 新增 `person_event` 表支持生平事件 CRUD，随 `Person` 物理删除一并清除。
  - 人物肖像经已鉴权的 `/api/v1/projects/:projectId/media` 端点直接上传至 S3 兼容对象存储并以 `avatar_key` 引用，不再将 base64 图片内联写入业务文本。
- **新用户范例家族数据服务端初始化**：
  - 用户在无有效邀请且首次创建个人默认 `Organization` 时，由 `apps/api/src/modules/auth/demo-seed.ts` 在同事务内自动初始化 1 个可编辑、可物理删除的范例家族 `Project`（`义门陈氏宗谱（范例）`，含 1 个 `Folder`、1 张 `Lineage`、三代示范人物、名号与生平事件）；凭有效邀请加入他人 `Organization` 时不向目标组织写入范例数据。
- **前端彻底去 Mock 与纯 UI 状态收敛**：
  - 删除 `apps/web/src/features/auth/{mockAuth,enableMock,demoAccount}*`、`apps/web/src/features/dashboard/mockConsole*` 与 `api.ts`/`apiMode.ts` 中的 `direct-mock` 逻辑，以及前端本地演示谱系导入分支。
  - 剥离 `useLineageStore` 的 `persist` 中间件与所有业务实体映射，仅保留纯 UI 临时交互态（如选中节点、选中人物、视图模式与分组折叠状态）；通过 `apps/web/src/features/lineage/{api,adapter,queries,mutations}.ts` 使用 TanStack Query 直接消费真实服务端 API。

## Consequences

- PostgreSQL 与 S3 成为谱系工作区唯一事实来源，组织权限、归档只读（`409`）、整型 `version` CAS 与跨谱系防环约束在前后端全链路一致生效。
- 后续接入谱文（`Article`）与谱书（`Book`）持久化时，可直接复用同一套平铺 `folder` 分组模型。
- 相关模块结构与领域术语同步更新至 [architecture.md](../architecture.md) 与 [glossary.md](../glossary.md)。

## Status

Accepted & Implemented。
