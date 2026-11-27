# Technical Plan: 004 谱系工作区后端持久化与演示数据初始化

> **前置要求**：本方案基于现行代码及 [docs/constitution.md](../../docs/constitution.md)、[docs/architecture.md](../../docs/architecture.md)、[docs/coding-standards.md](../../docs/coding-standards.md)、[docs/glossary.md](../../docs/glossary.md) 制定，所有设计项可追溯至 [spec.md](./spec.md) 的 `FR-001`~`FR-010`。**待人工确认后再拆解 `tasks.md` 与编码。**

---

## 1. 上下文与复用分析

- **关联 Spec**：[spec.md](./spec.md)
- **复用现有模块与机制**：
  - 租户事务与瞬态重试：`apps/api/src/db/with-tenant-transaction.ts`（`withTenantTransaction`）
  - 成员与项目权限校验：`apps/api/src/access.ts`（`requireMember`、`requireProjectMember`）
  - 数据库错误翻译与统一响应信封：`apps/api/src/lib/errors.ts`（`mapDatabaseError`、`tryMapDatabaseError`）、`apps/api/src/lib/http.ts`（`parseJson`、`parseParams`、`parseQuery`）
  - 契约单一权威：`packages/shared/src/` + `apps/api/src/openapi/operations.ts` + `scripts/export-contract.ts`
  - 世系图谱与时间/地点前端核心算法：`apps/web/src/features/lineage/domain/`、`apps/web/src/features/date-input/`、`apps/web/src/features/place-input/`
- **新增 / 修改范围**：
  - **共享包**：`packages/shared/src/{enums.ts,schemas.ts}`
  - **数据库与迁移**：`packages/db/src/schema/{tenant.ts,genealogy.ts,index.ts}`、`packages/db/migrations/0027_lineage_workspace_persistence.sql`（及必要的策略/约束迁移）
  - **后端 API**：`apps/api/src/modules/{folder,lineage,project,person,auth}/`、`apps/api/src/app.ts`、`apps/api/src/lib/errors.ts`、`apps/api/src/openapi/operations.ts`
  - **前端 Web**：`apps/web/src/lib/api.ts`、`apps/web/src/features/auth/`（去 mock）、`apps/web/src/features/dashboard/`（去 mock、`ancestor` 同步）、`apps/web/src/features/lineage/`（新增 `api.ts`、`queries.ts`、DTO 适配）、`apps/web/src/features/project/`（`LineageTreePanel.tsx` 平铺目录交互）、`apps/web/src/store/useLineageStore.ts`（瘦身为 UI 临时态）
  - **文档与 ADR**：`docs/architecture.md`、`docs/glossary.md`、新增 `docs/adr/ADR-0018-*.md`

---

## 2. 模块职责与依赖关系

严格遵守 `biome.json` 的包/模块边界与 `router → service → queries` 三层链路：

1. **新增领域模块 `apps/api/src/modules/folder/`**（`FR-001`）：
   - 负责 `folder` 表的 CRUD 与项目级排序校验。
   - 后续谱文（`article`）、谱书（`book`）模块将直接关联并复用 `folder`，不耦合进 `lineage` 模块内部。
2. **新增领域模块 `apps/api/src/modules/lineage/`**（`FR-002`、`FR-008`）：
   - 负责 `lineage`（谱系图）元数据的 CRUD、`version` CAS、归属 `folderId` 校验与整图读取（聚合下属 `person`、`person_name`、`person_relation`、`person_event` 与 `lineage_projection`）。
   - 创建 `lineage` 时若携带 `progenitor`，在同一个 `withTenantTransaction` 内调用 `person/service.ts` 对外函数（或共享事务内建人助手）初始化第一世始祖 `Person`；`biome.json` 禁止跨模块直接导入 `queries.ts`。
3. **扩展 `apps/api/src/modules/project/`**（`FR-003`）：
   - `CreateProjectSchema` / `UpdateProjectSchema` / `ProjectRecord` 增加 `ancestor`。
   - `createProject` 若传入 `ancestor`，在同一事务内（复用传 `tx` 的内部/service 协作入口）创建首张 `lineage` 与第一世始祖 `person`。
4. **扩展 `apps/api/src/modules/person/`**（`FR-004`~`FR-008`）：
   - 在保留现有 `person` / `person_relation` / `subgraph` 契约兼容性的基础上，补齐前端展示的 `Person` 全字段、`PersonName` CRUD、`PersonEvent` CRUD 与全部 7 种 `PersonRelation` 类型及扩展标签。
5. **扩展 `apps/api/src/modules/auth/provisioning.ts`**（`FR-009`）：
   - `provisionDefaultOrganization` 在创建个人默认 `Organization` 后（非有效邀请加入他人组织分支），调用范例家族初始化服务（通过 `project/service.ts`、`folder/service.ts`、`lineage/service.ts`、`person/service.ts` 或专用 demo seed 协作服务）为该新组织创建一套完整的范例家族项目。

---

## 3. 数据模型与数据库变更

通过顺序 SQL 迁移（`0027_lineage_workspace_persistence.sql`）落地，并同步更新 `packages/db/src/schema/`：

### 3.1 `project` 表扩展（`FR-003`）
- 新增 `ancestor text NULL`，约束 `ck_project_ancestor_not_blank CHECK (ancestor IS NULL OR btrim(ancestor) <> '')`。

### 3.2 新增 `folder` 表（`FR-001`）
| 列名 | 类型 | 可空 | 默认 | 约束 / 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `project_id` | `uuid` | 否 | — | 复合主键第一列 |
| `id` | `uuid` | 否 | `uuidv7()` | 复合主键第二列 |
| `organization_id` | `uuid` | 否 | — | 外键 `(organization_id, project_id)` → `project(organization_id, id) ON DELETE CASCADE` |
| `name` | `text` | 否 | — | `CHECK (btrim(name) <> '')`、`UNIQUE (project_id, name)`（约束名 `uq_folder_project_name`） |
| `seq` | `integer` | 否 | `0` | `CHECK (seq >= 0)` |
| `created_at` | `timestamptz` | 否 | `now()` | — |
| `updated_at` | `timestamptz` | 否 | `now()` | — |
- **平铺约束**：无 `parent_folder_id` 列；仅作为一级分组容器。
- **RLS 策略**：启用 `FORCE ROW LEVEL SECURITY`，`SELECT` 允许组织成员、`INSERT`/`UPDATE`/`DELETE` 校验 `member_role(organization_id) IN ('admin', 'editor')` 与归档组织拦截（`GX012`）。

### 3.3 新增 `lineage` 表（`FR-002`）
| 列名 | 类型 | 可空 | 默认 | 约束 / 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `project_id` | `uuid` | 否 | — | 复合主键第一列 |
| `id` | `uuid` | 否 | `uuidv7()` | 复合主键第二列 |
| `organization_id` | `uuid` | 否 | — | 外键 `(organization_id, project_id)` → `project(organization_id, id) ON DELETE CASCADE` |
| `folder_id` | `uuid` | 是 | `NULL` | 复合外键 `(project_id, folder_id)` → `folder(project_id, id) ON DELETE SET NULL (folder_id)` |
| `name` | `text` | 否 | — | `CHECK (btrim(name) <> '')` |
| `surname` | `text` | 是 | `NULL` | `CHECK (surname IS NULL OR btrim(surname) <> '')` |
| `hall_name` | `text` | 是 | `NULL` | `CHECK (hall_name IS NULL OR btrim(hall_name) <> '')` |
| `progenitor` | `text` | 是 | `NULL` | `CHECK (progenitor IS NULL OR btrim(progenitor) <> '')` |
| `region` | `jsonb` | 是 | `NULL` | 结构化 `GenealogyPlace` |
| `seq` | `integer` | 否 | `0` | `CHECK (seq >= 0)` |
| `version` | `integer` | 否 | `1` | `CHECK (version > 0)` |
| `created_at` | `timestamptz` | 否 | `now()` | — |
| `updated_at` | `timestamptz` | 否 | `now()` | — |
- 启用 `FORCE ROW LEVEL SECURITY`，写策略同 `folder`。

### 3.4 `person` 表扩展（`FR-002`、`FR-004`）
- 新增 `lineage_id uuid`：迁移中先为已存在 `person` 但尚无 `lineage` 的 `project` 补建默认 `lineage` 并回填 `lineage_id`，随后 `ALTER COLUMN lineage_id SET NOT NULL`，建立复合外键 `(project_id, lineage_id)` → `lineage(project_id, id) ON DELETE CASCADE`，并建立复合唯一索引 `(project_id, lineage_id, id)` 与索引 `idx_person_project_lineage(project_id, lineage_id)`。
- 新增前端展示字段（均遵守非空白或非负约束）：
  - `given_name text NULL`（与既有 `surname`、`person_name(is_primary)` 配合；不破坏既有只传 `displayName` 的接口）
  - `romanized_surname text NULL`、`romanized_name text NULL`、`romanized_suffix text NULL`
  - `birth_info jsonb NULL`（结构化出生日期、出生地点、摘要）
  - `death_info jsonb NULL`（结构化死亡日期、死亡地点、葬期、葬地、死因、手动享年、摘要）
  - `generation_word text NULL`（字辈字）
  - `relation_title text NULL`（称谓标题，如「始祖」）
  - `sibling_order integer NULL CHECK (sibling_order IS NULL OR sibling_order >= 0)`
  - `biography text NULL`、`notes text NULL`、`avatar_key text NULL`
- 保留 `ck_person_life_years`：前端写入 `birth_info` / `death_info` 时，服务层若解析出公历整数年且调用方未显式传 `birthYear` / `deathYear`，同步提取写入 `birth_year` / `death_year`，保持数据库生卒年不变量有效。

### 3.5 `person_name` 表扩展与 `person_event` 新表（`FR-005`、`FR-007`）
- **`person_name`** 新增：`surname text NULL`、`romanized_surname text NULL`、`romanized_name text NULL`、`label text NULL`（用于前端「曾用名」等自定义展示标签）。
- **新增 `person_event` 表**：
  - 列：`project_id uuid NOT NULL`、`id uuid NOT NULL DEFAULT uuidv7()`、`organization_id uuid NOT NULL`、`person_id uuid NOT NULL`、`type text NOT NULL`、`structured_date jsonb NULL`、`structured_place jsonb NULL`、`description text NULL`、`sort_order integer NOT NULL DEFAULT 0`、`created_at`、`updated_at`
  - 约束：`PRIMARY KEY (project_id, id)`、`FOREIGN KEY (organization_id, project_id) REFERENCES project(organization_id, id) ON DELETE CASCADE`、`FOREIGN KEY (project_id, person_id) REFERENCES person(project_id, id) ON DELETE CASCADE`、`CHECK (type IN ('birth', 'education', 'career', 'marriage', 'residence', 'death', 'other'))`、`CHECK (sort_order >= 0)`；启用 `FORCE ROW LEVEL SECURITY`。

### 3.6 `person_relation` 跨谱系图保护与 `project` 删除级联（`FR-006`、`FR-009`）
- **跨 `Lineage` 防护**：在 `person_relation` 写入前触发器中检查 `from_person_id` 与 `to_person_id` 对应的 `person.lineage_id` 必须一致；不一致则抛出自定义 SQLSTATE `GX014`（因 `GX013` 已由 `guard_owner_role_admin` 占用）。
- **项目删除级联**：现有 `0012` 迁移中 `person`/`person_name`/`person_relation`/`lineage_projection` 对 `project` 的外键使用了 `ON DELETE RESTRICT`。为了满足宪法「删除即物理删除」及 `FR-009`（用户可直接删除含人物与谱系图的范例项目），需在迁移 `0027` 中将 `person`、`person_name`、`person_relation`、`lineage_projection` 对 `project` 的外键重建为 `ON DELETE CASCADE`（或在 `removeProject` 事务中按序清理；外键 `CASCADE` 更简洁且避免漏表，详见第 7 节待确认项 1）。
- **世系投影 `reflow` 作用域核对**：现有 `lineage_projection` 主键为 `(project_id, person_id)`；由于不同 `lineage` 的 `person_id` 均是 UUID 且 `person_relation` 禁止跨 `lineage` 连边，单 `project` 内同一张 `lineage` 的连通分量天然彼此隔离，既有 `reflow_lineage_from` / `check_ancestor_cycle` 不受跨表串边影响。

---

## 4. API Contract

所有契约 Schema 落在 `packages/shared/src/` 并注册到 `apps/api/src/openapi/operations.ts`，执行 `pnpm contract:export` 更新 `contracts/openapi.json`。

### 4.1 共享枚举与 Schema（`packages/shared`）
- `packages/shared/src/enums.ts`：
  - 放开 `API_RELATION_KINDS` 与 `RELATION_KINDS` 对齐（涵盖全部 7 种）。
  - 新增 `PERSON_EVENT_TYPES = ["birth", "education", "career", "marriage", "residence", "death", "other"] as const`。
  - 新增 `TABLE_NAMES` 条目：`folder`、`lineage`、`person_event`。
- `packages/shared/src/schemas.ts`：
  - 扩展 `CreateProjectSchema`、`UpdateProjectSchema` 增加可选/可空 `ancestor`（非空不纯白，上限 120 字符）。
  - 新增 `FolderSchema`、`CreateFolderSchema`、`UpdateFolderSchema`、`FolderIdParamsSchema`。
  - 新增 `LineageSchema`、`CreateLineageSchema`、`UpdateLineageSchema`（含 `version` CAS）、`LineageIdParamsSchema`。
  - 新增结构化日期 `GenealogyDateSchema` 与结构化地点 `GenealogyPlaceSchema`（与前端 `date-input`/`place-input` JSON 结构一致，保证未知非法格式在边界被拒绝）。
  - 扩展 `CreatePersonSchema` / `UpdatePersonSchema`（新增可选 `lineageId` 与界面全量展示字段）。
  - 新增 `CreatePersonNameSchema` / `UpdatePersonNameSchema` / `PersonNameIdParamsSchema`。
  - 扩展 `CreateRelationSchema` 与新增 `UpdateRelationSchema`（`fromRoleLabel`、`toRoleLabel`、`sortOrder`、`note`）。
  - 新增 `CreatePersonEventSchema` / `UpdatePersonEventSchema` / `PersonEventIdParamsSchema`。

### 4.2 REST 端点规划（均挂载于 `/api/v1`）
| 资源 | 方法与路径 | 权限 | 关键行为 / 追溯 |
| :--- | :--- | :--- | :--- |
| `Folder` | `GET /projects/:projectId/folders` | 成员 | 按 `seq, created_at` 列出平铺分组（`FR-001`） |
| `Folder` | `POST /projects/:projectId/folders` | `editor+` | 创建平铺分组，重名返回 `409 CONFLICT`（`FR-001`） |
| `Folder` | `PATCH /projects/:projectId/folders/:folderId` | `editor+` | 重命名或调整 `seq`（`FR-001`） |
| `Folder` | `DELETE /projects/:projectId/folders/:folderId` | `editor+` | 物理删除分组，数据库 `ON DELETE SET NULL (folder_id)` 解绑旗下 `Lineage`（`FR-001`） |
| `Lineage` | `GET /projects/:projectId/lineages` | 成员 | 一次返回 `{ folders, lineages }` 目录清单（`FR-002`） |
| `Lineage` | `POST /projects/:projectId/lineages` | `editor+` | 创建谱系图；传 `progenitor` 时同事务创建 1 世始祖 `Person`（`FR-002`） |
| `Lineage` | `PATCH /projects/:projectId/lineages/:lineageId` | `editor+` | 带 `version` CAS 更新名称/姓氏/堂号/始祖/地区/`folderId`/`seq`（`FR-002`） |
| `Lineage` | `DELETE /projects/:projectId/lineages/:lineageId` | `editor+` | 物理删除谱系图并级联清理下属人物/关系/事件/投影（`FR-002`） |
| `Lineage` | `GET /projects/:projectId/lineages/:lineageId/graph` | 成员 | 返回 `{ lineage, persons, relations, projections }` 全量谱表数据（`FR-008`） |
| `Person` | `GET/POST /projects/:projectId/persons`、`GET/PATCH/DELETE .../persons/:personId` | 成员 / `editor+` | 兼容既有测试（不传 `lineageId` 时自动定位或新建项目默认 `Lineage`），并扩展界面全量字段读写（`FR-004`） |
| `PersonName` | `POST/PATCH/DELETE /projects/:projectId/persons/:personId/names(/:nameId)` | `editor+` | 管理名号/别名、主名唯一约束（`FR-005`） |
| `PersonRelation` | `POST /.../relations`、`PATCH/DELETE /.../relations/:relationId` | `editor+` | 开放 7 种关系 + 角色标签/排序/备注；跨谱系图返回 `409 CONFLICT`（`FR-006`） |
| `PersonEvent` | `POST/PATCH/DELETE /projects/:projectId/persons/:personId/events(/:eventId)` | `editor+` | 管理时间线事件（`FR-007`） |

### 4.3 前端接入与去 Mock 方案（`FR-008`、`FR-010`）
- 删除：`apps/web/src/features/auth/{mockAuth.ts,mockAuth.test.ts,enableMock.ts,demoAccount.ts}`、`apps/web/src/features/dashboard/{mockConsole.ts,mockConsole.test.ts}`、移除 `lib/api.ts` 中的 mock 分支与 `LoginPage.tsx` 中的 `isMockMode` 横幅。
- 新增 `apps/web/src/features/lineage/api.ts`、`queries.ts`（TanStack Query key：`['lineage', projectId, 'tree']`、`['lineage', projectId, 'graph', lineageId]`）与前端 `PersonRecord` ↔ 后端 DTO 的显式映射转换模块。
- 改造 `apps/web/src/store/useLineageStore.ts`：移除 `persist` 业务数据（`treesByProject`、`personsByChart`、`importDemoLineage`），只保留非持久化/UI 状态（`selectedLineageIdByProject`、`selectedPersonIdByLineage`、`viewModeByProject`）。
- 改造 `LineageTreePanel.tsx` 与 `LineagePage.tsx`：基于真实后端 `{ folders, lineages }` 与 `graph` 数据渲染和提交变更，禁用文件夹嵌套文件夹，删除文件夹后自动刷新目录看到未分组谱系图保持存在。

---

## 5. 异常处理、事务与并发控制

- **原子事务**：
  - `createProject`（含 `ancestor` 时连带建 `Lineage` + 始祖 `Person`）、`createLineage`（含 `progenitor` 时连带建始祖 `Person`）以及 `provisionDefaultOrganization`（建默认组织 + 范例家族项目）各自在单一 `withTenantTransaction` 内完成，失败全量回滚。
- **并发与 CAS**：
  - `project`、`lineage`、`person` 均以整数 `version` 执行 CAS 更新，不匹配抛出 `409 VERSION_CONFLICT`。
  - 前端捕获 `VERSION_CONFLICT` 后显式提示用户并失效重建对应 TanStack Query 缓存。
- **错误映射扩展**（`apps/api/src/lib/errors.ts`）：
  - `23505`：`uq_folder_project_name` → `409 CONFLICT`（「同项目下分组名称已存在」）；`uq_person_name_kind_value` → `409 CONFLICT`（「该人物已存在相同类型的名号」）。
  - `GX014` → `409 CONFLICT`（「不能跨越不同谱系图建立人物关系」）。

---

## 6. 安全性、性能与兼容性

- **租户隔离与 RLS**：`folder`、`lineage`、`person_event` 全部启用 `FORCE ROW LEVEL SECURITY`，并在 `apps/api/src/access.ts` 复用 `requireProjectMember` 做 404/403 前置拦截，禁止收到 `42501`。
- **新用户范例数据初始化对既有测试的影响**：
  - 既有 [tests/console/organization.test.ts](../../tests/console/organization.test.ts#L82) 断言新注册用户默认组织的 `projectCount === 0`。按 `FR-009` 落地后，新个人默认组织开局即带 1 个范例项目（`projectCount === 1`），需同步更新该断言并新增针对范例项目内容与邀请注册不写目标组织的专项测试。
  - 范例数据规模控制在单事务内约 8~10 位三代人物（精简而完整地覆盖主脉/配偶/别名/生平事件），保证单次用户注册延迟保持轻量，不影响现有百余条集成测试执行效率。
- **规范与文档同步**：落地时需同步更新 `docs/architecture.md`、`docs/glossary.md`（补充 `Folder`、`Lineage`、`PersonEvent`），并新增 `ADR-0018` 记录「去掉前端本地 Mock 体系、谱系工作区切换为数据库唯一权威」及 `project` 删除级联策略调整。

---

## 7. 技术风险与已确认决策

> 以下 4 项关键决策已获用户确认：

1. **`Project` 物理删除级联策略（已确认）**：在迁移 `0027` 中将 `person`、`person_name`、`person_relation`、`lineage_projection`（及新表 `folder`/`lineage`/`person_event`）对 `project` 的外键统一设为 `ON DELETE CASCADE`，以支持用户直接物理删除含人物/谱系图的范例家族项目。
2. **目录节点写删权限边界（已确认）**：任意组织成员可读；创建/编辑/删除 `Folder`、`Lineage`、`Person`、`PersonName`、`PersonRelation`、`PersonEvent` 均要求至少 `editor` 角色；删除整个 `Project` 维持 `admin` 角色。
3. **新用户默认范例家族规模（已确认）**：采用精简而完整的三代示范家族（1 个分组 + 1 张谱系图 + 三代约 8~10 位含别名/配偶/多种亲子关系/时间线事件的人物）。
4. **人物肖像图片存储边界（已确认采用选项 A）**：开放经成员权限校验的 `/api/v1/projects/:projectId/media` 上传与读取代理接口对接 S3 对象存储，`Person.avatarKey` 仅保存安全媒体文件名/引用，前端不再把 base64 data URL 写入业务数据。
