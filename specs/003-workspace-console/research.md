# Phase 0 Research: 工作台控制台

**Feature**: `003-workspace-console` | **Date**: 2026-11-15

> 本文解决 Technical Context 中的未知项与设计取舍。每条按「Decision / Rationale / Alternatives considered」记录。契约端点的权威定义在 [endpoints.md](../../docs/architecture/api/endpoints.md)，本文不复制端点表。

## R1. 前端控制台数据层：API 灌入既有 zustand store，还是引入请求库？

**Decision**: 每个 feature 一个 API 模块（`features/dashboard/api.ts`）+ 既有 `useWorkspaceStore` 从「种子数据」改为「API 灌入的运行时数据」。加载/错误状态由页面级组件状态（骨架屏 / 页内重试）承担，不用全局请求库。

**Rationale**:

- `features/auth/api.ts` + `lib/api.ts` 的 `apiRequest` 信封与 Mock 降级机制已在 002 批次验证，控制台复用同一机制即可满足「AI Studio 无后端也能开发」的既有约束。
- `useWorkspaceStore` 已被 Sidebar、四页、命令面板消费；保留 store 形状只换数据源，改动面最小（Article I）。
- 引入 TanStack Query 之类的请求库会带来缓存一致性问题，而本产品是低频编辑的内部工具，页面进入时拉取 + 手动刷新已足够（spec Assumptions 已声明无实时推送）。

**Alternatives considered**:

- TanStack Query：缓存/失效模型更标准，但新增运行时依赖与一整套缓存心智，消重对象只有「loading/error 标志」，不满足「抽象必须消除两处以上重复」的举证要求。
- 每个组件内部 `useEffect` + `fetch`：会把 loading/error 逻辑复制到四个页面，且绕开 `apiRequest` 的信封校验与 Mock 降级。
- 保留种子数据只做展示：直接违反 `FR-001`~`FR-010`（数据必须来自当前组织的真实数据）。

## R2. 首页路由与登录落地页

**Decision**: 保持 Sidebar 既有映射——首页 `/home`、项目 `/`、成员 `/members`、设置 `/settings`；把登录成功与注册成功的跳转目标、以及通配路由跳转从 `/` 改为 `/home`。`/projects` 保留为项目页别名。

**Rationale**:

- Sidebar 导航四项已与 spec 四页一一对应，改路由结构不如改落地点。
- `FR-001`/`SC-001` 要求登录后进入首页；当前 `LoginPage` 跳 `from || '/'`、`RegisterPage` 跳 `/`，落点是项目页，与规格不符。

**Alternatives considered**:

- 把 `DashboardPage` 挂到 `/home`、`WorkspaceHomePage` 挂到 `/`：与 Sidebar 路径语义相反，后续维护者要记两套映射。
- 新增 `/console` 前缀统一四页：改动所有链接与 Sidebar，收益为零。

## R3. 首页与项目页的模板内容取舍

**Decision**: `WorkspaceHomePage` 按 spec `FR-003` 重写内容区：组织概览（项目数、成员数、待处理邀请数）、最近项目固定 5 条 + 「查看全部」、「新建项目」「邀请成员」快捷入口；移除模板的「应用构建器 / 外部数据源」快捷卡与应用列表。`DashboardPage` 收敛为项目页：项目列表 + 新建/打开/编辑/删除，移除 all/apps/datasources 三个 tab 中与项目无关的内容（对应独立路由 `/datasources`、`/files` 保留不动）。

**Rationale**: spec `FR-003` 明确首页不引入图表与跨组织聚合；`FR-004` 明确项目页只管项目。模板的 apps/datasources 是构建器演示数据，与本产品（谱牒 SaaS）无关，留着会让验收场景「首页数字与实际一致」无法判定。

**Alternatives considered**: 保留模板卡片只换数据——应用与数据源没有后端实体，无法「与实际一致」，属于虚构数据，违反 `FR-015`。

## R4. 成员管理与邀请管理的执行者划分

**Decision**:

| 操作 | 执行者 | 依据 |
| --- | --- | --- |
| 成员列表 | 服务层查询 + RLS | `organization.member.read` |
| 修改成员角色 | 服务层 `UPDATE organization_member SET role`（列级授权已存在）+ 角色检查 | `DM-ORG-07`：成员增删改由应用层做角色授权 |
| 移除成员 | 服务层 `DELETE`（列级授权已存在）+ 角色检查；owner 行由既有 `RESTRICT` 外键兜底 | 同上；验收 #2（owner 成员行不可删） |
| 创建邀请 | 服务层 `INSERT invite`（授权已存在）+ token 生成与哈希 | `DM-INV-01` |
| 撤销邀请 | 受控函数 `app.revoke_invite()`（**本批次补迁移**） | `schema.md` §5.3 v1.2：`invite` 无业务 `UPDATE` 权限 |
| 转移所有权 | 受控函数 `app.transfer_organization_ownership()`（**本批次补迁移**） | §9.1 既定；CAS 并发 + 强审计 |
| 组织改名/归档/退出 | 服务层 `UPDATE organization` + `organization.update`/`archive` 权限 | 既有表与授权 |

**Rationale**: 这些函数在 [schema.md](../../docs/architecture/data/schema.md) §9.1 已定义（17 个函数清单内），但 `packages/db/migrations` 目前只建了 7 个——`revoke_invite` 与 `transfer_organization_ownership` 是 002 批次未覆盖的缺口。受控函数缺失时业务角色又没有 `invite` 的 `UPDATE` 权限，撤销功能根本无法实现（§9.2 的原话：补上才有唯一入口）。

**Alternatives considered**:

- 给 `genealogy_app` 加回 `invite.UPDATE`：正是 §8.4 明确收回的旁路，等于绕过邮箱一致性与抢占逻辑，驳回。
- 所有成员操作都写成受控函数：成员增删改在文档中明确是应用层授权 + RLS 边界，另建函数是第二真相源（Article I）。

## R5. 项目 CRUD 的实现方式与并发编辑

**Decision**: 服务层 `INSERT/UPDATE/DELETE project`，全部在 `withUser(userId, ...)` 事务内执行，依赖 RLS `visible_org_array` 做租户隔离；**不建 `app.create_project()` 函数**（文档未定义该函数，项目也不是强审计路径）。并发编辑用 `updated_at` 条件更新做乐观锁：

```sql
UPDATE project SET name = ..., updated_at = clock_timestamp()
WHERE id = ? AND organization_id = ? AND updated_at = ?  -- 客户端上次读到的值
RETURNING ...;  -- 0 行 → 409 CONCURRENT_MODIFICATION
```

**Rationale**:

- 文档的强审计清单只有组织创建、owner 转移、邀请兑换/撤销、出版 revoke/purge（§5.22），项目 CRUD 不在其中。
- `project` 表没有 `version` 列（§5.4 字段表），spec `US-002` 场景 4 又要求并发修改收到明确冲突提示。`updated_at` 由 `clock_timestamp()` 严格单调推进（`DM-GEN-15`），天然可作乐观锁令牌，**不加新列**（Article IV：能用既有列就不加列）。
- 删除项目为物理删除（`OOS-06`）；未来内容表对 `project` 的 `RESTRICT` 外键会让「有内容的项目不可删」在数据库层执行，本批次尚无内容表，删除即真删。

**Alternatives considered**:

- 加 `version` 列：多一列且与 `updated_at` 语义重复；文档 §5.4 未定义该列，改表要回写契约。
- 应用层读-改-写不带条件：两个并发请求静默覆盖，违反 spec 验收。
- advisory lock：为低频编辑引入锁表，过度设计。

## R6. 「切换即记住」的落地方式

**Decision**: 组织切换器切换时调用既有 `POST /api/v1/organizations/:organizationId/activate`（服务层把 `last_used_at` 更新为 `clock_timestamp()`），随后前端把该组织设为当前上下文并刷新四页数据。控制台不提供「设为默认」按钮。

**Rationale**:

- spec 002 `FR-014` 与 US4 场景 3 要求「切换后重新登录进入该组织」，解析依据就是 `organization_member.last_used_at`（schema.md §5.2）。
- 计划阶段发现 spec 003 澄清 Q1 原答案与此冲突，已由用户裁决为「切换即记住」并回填 spec 003 四处文本——本决策是该裁决的实现方式。
- 复用既有端点，不加字段、不加端点。

**Alternatives considered**: 前端本地记住 + 服务端不动——换设备不一致，与 002「跨设备一致」冲突；新增「固定默认」字段——多一列且产生两个默认概念（Article I / Article IV）。

## R7. Mock 降级范围

**Decision**: 新增 `features/dashboard/mockConsole.ts`，通过既有 `registerMockHandler` 注册，覆盖控制台消费的全部新端点（organizations 详情/成员/邀请/项目/账号），数据结构与真实响应信封、错误码完全一致；`MockModeIndicator` 沿用。

**Rationale**: 002 批次已确立「真实 API 不可达时自动降级到内存 Mock」的机制与验证场景（memory: 前端 AI Studio 开发约束）。控制台新增约 15 个端点，不补齐 Mock 会让同步代码后开发中断——这是既有约束的延续，不是新机制。

**Alternatives considered**: 不做 Mock——违背既有工作流约束；做 Service Worker 拦截——额外组件，违反最小化。

## R8. 权限在界面与服务端的双层表达

**Decision**: 会话与组织成员角色（来自 `GET /organizations/:organizationId` 的 `myRole` / `isOwner`）驱动界面：`viewer` 隐藏或禁用新建/编辑/删除/成员管理入口；`editor` 可建改项目但不可管理成员；`admin` 全量；owner 额外拥有转移所有权。服务端按 C3 矩阵逐端点校验，403 返回 `FORBIDDEN`。

**Rationale**: `FR-010` 明确「界面禁用不是唯一防线」；C3 权限矩阵已定值，前端只是它的投影，不发明新规则。

**Alternatives considered**: 前端只做展示不做禁用——用户点了才报错，体验差且不符合 `SC-003`（只读成员成功执行写操作比例 0）。

## R9. 引导状态（无可用组织）的判定

**Decision**: 复用 002 批次语义——`GET /api/v1/auth/session` 返回 `onboarding: true`（无可用组织）时，控制台四页路由重定向到 `/onboarding`；`OnboardingPage` 提供「创建组织」「接受邀请（输入链接）」两入口，创建成功后进入该组织首页。

**Rationale**: spec `FR-002` 与 002 批次 `FR-015` 同义，`OnboardingPage` 已存在，只需校对两入口齐全。

**Alternatives considered**: 在四页内渲染空状态代替引导页——`FR-002` 明确「不展示四个主页面」。

## R10. 邀请链接的生成与展示

**Decision**: `POST .../invites` 由服务端用 CSPRNG 生成 ≥32 字节随机 token（Base64URL），库存 `sha256` 哈希，**响应只返回一次明文** `inviteUrl`（形如 `{WEB_BASE}/#/invite/{token}`）；前端弹窗展示 + 一键复制，关闭后列表只显示邮箱/角色/状态（spec US3 场景 8）。

**Rationale**: `DM-INV-01` 的既有约定；spec 003 澄清 Q3 已确认「弹窗展示、明文只出现一次」。前端用 HashRouter，邀请链接必须带 `#` 路由才能落到兑换页。

**Alternatives considered**: 邮件投递——产品无邮件基础设施（002 批次 Assumptions）；列表常驻显示明文——违反「只出现一次」。

## R11. 会话与账号资料的读写通道

**Decision**:

- `GET /api/v1/account`：从 Better Auth session 取用户（id、email、name）。
- `PATCH /api/v1/account`：`auth.updateUser({ name })` 改显示名。
- `POST /api/v1/account/password`：Better Auth `changePassword`（需当前密码），成功后既有会话按 Better Auth 配置处理。

**Rationale**: 002 批次已选定 Better Auth 作为账号与会话的唯一写入口，绕开它手写密码哈希是第二套真相源（Article I / 002 plan Complexity Tracking 已登记同结论）。

**Alternatives considered**: 直接 `UPDATE auth.account`——绕过哈希与会话逻辑，安全风险高，002 已驳回。

## R12. 测试与验收路径

**Decision**:

- 服务端：`tests/console/*.test.ts` 打真实 PG 18，覆盖跨租户隔离（`US-007`）、owner 保护、并发转移/并发兑换/并发项目编辑、RLS fail-closed；路由形状用 `app.request()`。
- 前端：`tsc --noEmit` 门禁 + `quickstart.md` 的手工验收脚本（对应 spec 的 SC-001~010 关键场景）。
- 不新增测试框架（`OOS-17`）。

**Rationale**: 宪法要求集成测试连真 PostgreSQL 18，mock 掉的正是最容易出错的部分（RLS、约束、CAS）。

**Alternatives considered**: 为前端引入 Playwright 端到端——002 批次约束「本批次不引入 Playwright 等额外依赖」的同族决定，且验收以人工脚本足够覆盖四页交互。

## 遗留说明

- 无 NEEDS CLARIFICATION：Technical Context 各项均已在本文件定值。
- 分页参数、权限名、状态码沿用 Phase 0 结论 C2/C3/C4，本批次不产生新的契约项。
