# Yunpu Glossary

Yunpu 是一个谱牒协作产品：用户登录后成为某个组织中的成员，并在该组织内管理谱系项目与人物世系。本文固定项目中的核心领域术语，避免界面、接口、测试与文档各自造词。

---

## 一、身份、权限与协作（Tenant & Auth）

### User
一个登录 Yunpu 的人；`User` 专指持有登录账号、能发起会话的身份，可以同时属于多个 `Organization`。谱系中的人物不因此成为 `User`。
- _Avoid_: Account（指人时）, Person（仅指「已登录账号」时避免；谱系里已故或没有账号的人物叫 `Person`）

### Session
一次登录产生的、可被持续验证的登录状态；它决定当前请求以哪个 `User` 身份执行。
- _Avoid_: Login state, Auth state

### Member
在某个 `Organization` 中拥有 `Membership` 的 `User`。
- _Avoid_: Team member, Account

### Membership
一个 `User` 与一个 `Organization` 之间的关系，带有 `admin`、`editor` 或 `viewer` 角色，并记录该 `User` 最近一次使用这个 `Organization` 的时间（`lastUsedAt`）。
- _Avoid_: Role assignment, Team membership

### Owner
持有一个 `Organization` 所有权的 `User`；所有权不是 `Membership` 角色，且只能转交给该组织的 `Member`。
- _Avoid_: Admin, Root user

### Organization
`User` 协作和拥有 `Project` 的租户边界，具有 `active` 或 `archived` 状态，并且恰好有一个 `Owner`。归档（`archived`）后禁止业务写入与切换进入。
- _Avoid_: Workspace（指租户边界时）, Tenant, Team

### Current Organization
用户当前正在其中工作的 `Organization`；切换后立即改变，`archived` 的 `Organization` 不能成为 `Current Organization`。
- _Avoid_: Active organization（避免与状态 `active` 混淆）

### Default Organization
用户最近一次使用的 `active` `Organization`；用户重新登录时回到这里。
- _Avoid_: Home organization, Fixed organization

### Invite
针对特定邮箱、以指定 `Membership` 角色加入某个 `Organization` 的邀请；状态为 `pending`、`accepted` 或 `revoked`，仅在 `pending` 且未过期时可兑换，且永不授予所有权。
- _Avoid_: Invitation, Join link

---

## 二、项目与谱系核心（Project & Genealogy）

### Project
归属于一个 `Organization` 且创建后不可更换归属的谱系工作项，状态为 `planning`、`in_progress` 或 `completed`，可附姓氏、堂号、源流、说明、主题色（`colorTheme`）与分级（`projectLevel`）。
- _Avoid_: Workspace, Genealogy record, App

### Person
谱系人物；谱系图中的一个人物节点，归属于特定 `Project`，记录其性别（`sex`）、姓氏（`surname`）、生卒年份（`birthYear`/`deathYear`）、在世状态（`isLiving`）与乐观锁版本号（`version`）。`Person` 可以是已故者，也可以没有 Yunpu 登录账号，只描述谱系事实。
- _Avoid_: User, Account, Member, Profile（这些指账号或组织身份，不是谱系人物）
- _Example_: 谱中一位已故祖父从未注册过 Yunpu，他在谱系里是一个 `Person` 而非 `User`；已登录的 `User` 只有被录入某条谱系时才对应其中的 `Person`。

### PersonName
隶属于某位 `Person` 的名称记录，支持多种名号类型（`formal` 本名、`courtesy` 字、`art` 号、`milk` 乳名、`genealogy` 谱名、`posthumous` 谥号、`other` 其他），每位 `Person` 在同一 `Project` 内至多有一条主名（`isPrimary`）。
- _Avoid_: Alias（泛指所有名称时；仅在 UI 展示别名列表时可作补充说明）

### PersonRelation
同一 `Project` 内两位 `Person` 之间的人物关系边（`fromPersonId` → `toPersonId`），支持血缘/拟制亲子与配偶关系（`biological_parent`、`adoptive_parent`、`ritual_heir`、`step_parent`、`foster_parent`、`spouse`、`partner`），禁止自环；对称关系（`spouse`、`partner`）在存储上强制规范序（`fromPersonId < toPersonId`）。
- _Avoid_: Edge, Link（在领域语义中应明确为关系类型或 `PersonRelation`）

### LineageProjection
针对 `Project` 内人物的派生世系投影视图，记录基于 PostgreSQL `ltree` 的主脉路径（`primaryPath`）与世代号（`generation`），随人物及亲子关系变更在同一事务内维护，用于受控子图与世系树快速查询。
- _Avoid_: Tree cache, Primary node

---

## 三、前端界面与工作台术语（UI 展示规范）

代码标识符、API 载荷、数据库字段与规格文档统一遵守前两节的领域术语（如 `Organization`、`Project`、`Person`、`LineageProjection`）；**界面中文展示文案**统一采用下列规范，避免把内部英文名词直接暴露给修谱用户：

### 组织空间（UI 对应 `Organization`）
在账号下管理成员、家族项目与设置的顶层协作边界的中文界面称呼。
- _Avoid (UI)_: 工作区、workspace

### 家族项目（UI 对应 `Project`）
组织空间中的一个家族谱牒项目，拥有独立的谱系、谱文与谱书；历史 URL 与 store 字段保留 `project` / `lineage` 以维持路由与本地兼容。
- _Avoid (UI)_: 仅在明确指家族谱牒上下文时避免笼统称「项目」或英文 `project`

### 谱系（UI 对应 `LineageProjection` / `PersonRelation`）
家族项目中人物之间的关系与血缘结构。
- _Avoid (UI)_: 世系（仅用于界面菜单/导航统一称呼时）、`lineage`

### 谱文（UI 对应前端 Article 模块）
一个家族项目中的一篇正文，带有自己的版本号。
- _Avoid (UI)_: 文章、文档、`article`

### 版本与修订（UI 文案区分）
- **版本**：一篇谱文被写下或保存时的递增序号（对应并发控制版本号）；_Avoid (UI)_: 修订、`revision`
- **修订**：一篇谱文在某个时刻留下的正文快照，供回看或恢复；_Avoid (UI)_: 版本、`version`
- **谱文冲突**：同一篇谱文的本地正文与服务器正文版本不一致（HTTP `409`）；_Avoid (UI)_: 保存失败、CAS 失败

### 谱书（UI 对应前端 Book 模块）
按卷册编排的家族谱牒成书。
- _Avoid (UI)_: 书籍、`book`

### 工作台导航区域
- **图标导航条**：进入家族项目后常驻的最左侧导航区域，以图标和文字呈现谱系、谱文、谱书与设置入口；_Avoid (UI)_: MiniRail、迷你侧栏、compact 侧栏
- **业务侧栏**：在谱系、谱文或谱书页面中提供该部分目录与操作的常驻导航区域；_Avoid (UI)_: 二级侧栏、子侧栏
