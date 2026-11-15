# Implementation Plan: 工作台控制台（首页/项目/成员/设置）

**Branch**: `003-workspace-console` | **Date**: 2026-11-15 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-workspace-console/spec.md`

## Summary

把控制台四页（首页 `/home`、项目 `/`、成员 `/members`、设置 `/settings`）从模板种子数据切换到真实后端：服务端补齐 [endpoints.md](../../docs/architecture/api/endpoints.md) §2.1–§2.3 **已定值但尚未实现**的契约端点（账号资料、组织详情/改名/归档/退出、成员列表/改角色/移除、邀请列表/创建/撤销、所有权转移、项目 CRUD），数据层新增 `project` 表（按 [schema.md](../../docs/architecture/data/schema.md) §5.4）与两个缺失的受控函数迁移（`app.revoke_invite()`、`app.transfer_organization_ownership()`，§9.1 既定）；前端以 API 数据替换 `useWorkspaceStore` 种子数据，接入组织切换器（切换即记住，调既有 `POST /organizations/:id/activate`）、创建组织弹窗（建议名称选项）、骨架屏与页内重试，并沿用 002 批次的 `apiRequest` 自动降级 Mock 机制。不新增契约、不新增表以外的存储、不引入新运行时依赖。

技术取舍与替代方案见 [research.md](research.md)。

## Technical Context

**Language/Version**: TypeScript（服务端 Bun 1.4.4；前端 TS ~5.8.2），包管理器 pnpm 12.18.0，运行时 Bun。

**Primary Dependencies**: 服务端 Hono 4.13.18、Zod 4.6.7、Drizzle ORM 0.45.4、`pg` 8.23.1、Better Auth 1.7.23（均已在 002 批次引入）；前端 React 19、react-router-dom 6.22（HashRouter）、zustand 5、Tailwind 4、lucide-react。**本批次不新增任何运行时依赖。**

**Storage**: PostgreSQL 18（开发/测试独立容器，Compose 提供）。本批次新增 `public.project` 一张业务表；`organization` / `organization_member` / `invite` / `audit_log` / `auth.*` 沿用 002 批次迁移。不引入缓存、队列或第二数据库。

**Testing**: `bun test --env-file .env.test`（真实 PG 18，集成用例打 `tests/console` 与 `apps/api/test`，路由用 `app.request()`）；前端 `pnpm --filter nocoapp-dev lint`（`tsc --noEmit`）。不引入第二套测试运行器（`OOS-17`）。

**Target Platform**: Linux 开发机；Bun 进程（API 3000）+ Vite 开发服务（5173，`/api` 代理到 3000）+ PostgreSQL 18 + MinIO。基础设施组件仍为 3 个。

**Project Type**: Web 服务（Hono API）+ 单页前端（`apps/web`）。

**Performance Goals**: 首页进入中位 ≤ 10 秒、首页关键数字与实际数据不一致的页面比例为 0（`SC-001`）；从任意主页面到常用操作 ≤ 3 步（`SC-008`）；列表接口按 Phase 0 结论 C4 使用 keyset 分页（`cursor` / `limit`，默认 50、上限 200）。

**Constraints**:

- 租户隔离唯一执行者是 RLS（`FR-TEN-01`）：谓词统一 `= ANY (app.visible_org_array())`，业务视图 `security_invoker = true`，`project` 表必须 `ENABLE` + `FORCE ROW LEVEL SECURITY`。
- 权限按 C3 已定值矩阵（`conventions.md` §1.13）：`project.read/create/update/delete`、`organization.member.*`、`organization.invite.*`、`organization.transfer_ownership`、`account.read/write`；界面禁用不是唯一防线，服务端必须同样拒绝（`FR-010`）。
- 错误码不新增：复用 `FORBIDDEN` / `TARGET_INVALID` / `CONCURRENT_MODIFICATION` / `VALIDATION_ERROR` / `RATE_LIMITED`（`errors.md` §9.4 已登记）。
- 邀请：token ≥ 256 bit CSPRNG、库内存 `sha256` 哈希、明文只在创建响应出现一次（`DM-INV-01`）；撤销与所有权转移必须走受控函数（`app.revoke_invite()`、`app.transfer_organization_ownership()`），业务角色无 `invite` 的 `UPDATE/DELETE` 权限。
- 删除即物理删除（`OOS-06`）：项目删除、成员移除均无软删除。
- 组织切换即记住：切换调用既有 `POST /organizations/:id/activate` 更新 `last_used_at`，与 spec 002 `FR-014` 一致；控制台不提供独立「设为默认」。
- 会话失效引导重新登录；加载中骨架屏、失败页内重试且不清空既有数据（spec 003 `FR-017`）。
- 文档门禁：若迁移触碰权限矩阵或错误映射，合并前 `scripts/check-docs.sh --root docs --strict --baseline docs/.check-docs-baseline.txt` exit=0。
- 002 批次约束继续有效：邮箱密码登录、7 天滑动会话、登录失败限流、注册即默认组织。

**Scale/Scope**: 单应用进程；单组织成员数个位数到几十，项目数十个；组织/项目列表走 keyset 分页。前端验收范围仅四页 + 组织切换器 + 引导状态；模板遗留的应用构建器、数据源、谱文编辑器路由保留原样，不在本批次验收。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Phase 0 之前

| # | 检查 | 结论 | 出处 |
| --- | --- | --- | --- |
| 1 | 是否引入新抽象层？消除了哪两处重复？ | 否。前端 `features/*/api.ts` 是 002 批次 `features/auth/api.ts` 已有模式的复用（同一模式第 2 次出现，不是新层）；服务端 `modules/project`、`modules/account` 照搬 `modules/organization` 的 router/service/queries 分层 | Article I、`ARCH-AR-05` |
| 2 | 是否引入新表？为什么不能用现有结构表达？ | 是，`project` 一张。它是 [schema.md](../../docs/architecture/data/schema.md) §5.4 的既定表（22 张表清单内），组织下没有「一份谱的数据边界」可复用；不建任何派生表 | Article IV、`DM-GEN` 表清单 |
| 3 | 是否新增依赖方向？依赖图是否仍单向？ | 否。方向仍是 `apps/api → packages/db / packages/shared`、`apps/web → lib/api → 后端端点`，无反向依赖 | `ARCH-AR-05` |
| 4 | 新约束的执行者是谁？ | `project` 非空白/状态枚举 → DB CHECK；租户隔离 → RLS 策略；成员角色与移除 → 服务层角色检查（`DM-ORG-07` 既有软约束）+ 集成测试；邀请撤销/所有权转移 → 受控函数；并发项目编辑 → `updated_at` 条件 UPDATE → 409；权限 → 服务层 + RLS | Article III |
| 5 | 新错误码是否已在 `errors.md` 登记？ | 不新增错误码。冲突复用 `CONCURRENT_MODIFICATION`，权限复用 `FORBIDDEN`，目标缺失复用 `TARGET_INVALID` | `DM-GEN-18`、`errors.md` §9.4 |
| 6 | 新编号是否在 `docs/README.md` 登记？ | 本计划不新增 `ARCH-*` / `DM-*` / `FR-*` 编号；`project` 表与两个受控函数均为既有编号下的实现 | Article VI、`DM-GEN-21` |
| 7 | 是否触碰「明确不做」清单？ | 否。无软删除、无缓存、无队列、无搜索引擎、无新依赖、无第二测试运行器、无 SSR | `OOS-06/09/10/14/17/12` |
| 8 | 复杂度预算 | 业务模块 4 个（auth、organization、project、account）≤ 8；业务表 5 张 ≤ 30；基础设施组件 3 个不变；运行时依赖 0 新增 | `.specify/memory/constitution.md` 复杂度预算 |

门禁：通过。无违规项，Complexity Tracking 为空表（见文末说明）。

### Phase 1 之后

| 检查 | 结论 |
| --- | --- |
| 是否新增没有执行者的约束？ | 否。逐条见上表第 4 行；spec 的每条 FR 均可指到 DB 约束 / RLS / 服务层 / 测试之一 |
| 是否出现跨文档矛盾？ | 否。**计划阶段发现并已修复**：spec 003 原澄清 Q1「切换不改默认组织指针」与 spec 002 `FR-013`/`FR-014`、US4 场景 3 冲突，已按用户裁决修订为「切换即记住」（spec.md 对应 4 处已回填） |
| 编号是否悬空？ | 否。引用的 `FR-*` / `DM-INV-*` / `DM-ORG-07` / `OOS-*` / `C3` / `C4` / `GX*` 均有定义 |
| 是否破坏 RLS 或单一真相源？ | 否。`project` 纳入 `visible_org_array` 策略与 `FORCE ROW LEVEL SECURITY`；枚举与错误映射仍由单一来源生成或引用 |

门禁：通过。

## Project Structure

### Documentation (this feature)

```text
specs/003-workspace-console/
├── plan.md              # 本文件
├── research.md          # Phase 0 输出
├── data-model.md        # Phase 1 输出
├── quickstart.md        # Phase 1 输出
├── contracts/
│   ├── console-api.md   # 控制台消费的端点契约（请求/响应形状 + Mock 对齐）
│   └── ui-states.md     # 四页 + 切换器的加载/空/错误/权限状态契约
├── checklists/
│   └── requirements.md  # 规格质量检查单（specify 阶段产出）
└── tasks.md             # Phase 2 输出，由 /speckit-tasks 生成
```

### Source Code (repository root)

```text
packages/shared/src/schemas.ts          # 新增 UpdateAccountSchema、ChangePasswordSchema、
                                        # CreateInviteSchema、UpdateMemberRoleSchema、
                                        # TransferOwnerSchema、CreateProjectSchema、UpdateProjectSchema
packages/db/
├── migrations/
│   ├── 0007_project.sql                # 新增：project 表 + CHECK + 触发器 + RLS + grants
│   └── 0008_org_management.sql         # 新增：app.revoke_invite()、app.transfer_organization_ownership()
└── src/schema/tenant.ts                # 新增 project 表 Drizzle 定义

apps/api/src/
├── modules/account/                    # 新增模块：GET/PATCH /account、POST /account/password
│   ├── router.ts
│   └── service.ts                      # 走 Better Auth updateUser / changePassword
├── modules/project/                    # 新增模块：项目 CRUD
│   ├── router.ts
│   ├── service.ts
│   ├── queries.ts                      # keyset 分页列表、updated_at CAS 更新
│   ├── schema.ts
│   └── errors.ts
├── modules/organization/               # 扩展既有模块
│   ├── router.ts                       # + 详情/改名归档/退出、成员列表/改角色/移除、
│   │                                   #   邀请列表/创建/撤销、所有权转移
│   ├── service.ts
│   ├── queries.ts
│   └── schema.ts
└── app.ts                              # 挂载 account / project 路由

apps/web/
├── app/App.tsx                         # 登录后落地 /home（首页）；通配跳转 /home；
│                                       # 新增 /invite/:token → /onboarding?invite=<token> 预填兑换
├── features/
│   ├── auth/api.ts                     # 不变；登录成功跳转 /home
│   ├── dashboard/
│   │   ├── api.ts                      # 新增：控制台 API 模块（org/project/member/invite/account）
│   │   ├── mockConsole.ts              # 新增：不可达时的 Mock 处理器（结构与真实信封一致）
│   │   ├── components/                 # 新增：PageSkeleton、PageError、ConfirmDialog
│   │   └── pages/
│   │       ├── WorkspaceHomePage.tsx   # 改造为 spec 首页（项目数/成员数/邀请数/最近 5 条/快捷入口）
│   │       ├── DashboardPage.tsx       # 改造为项目页（API 项目列表 + 新建/编辑/删除）
│   │       ├── MembersPage.tsx         # 改造为成员页（成员/邀请/角色/移除/转移 + 链接弹窗）
│   │       └── WorkspaceSettingsPage.tsx # 改造为设置页（组织分区 + 账号分区）
│   ├── workspace/components/
│   │   └── CreateWorkspaceDialog.tsx   # 改造：创建组织弹窗 + 建议名称选项（显示名/邮箱前缀）
│   └── auth/pages/OnboardingPage.tsx   # 校对：引导状态两入口（创建组织/接受邀请）
├── components/layout/Sidebar.tsx       # 组织切换器接 API；切换调 activate（切换即记住）
└── store/useWorkspaceStore.ts          # 种子 INITIAL_* 数据改为 API 灌入的运行时数据

tests/console/                          # 新增集成测试（真实 PG 18）
├── projects.test.ts                    # 项目 CRUD + 跨组织隔离 + CAS 冲突 + 权限
├── members.test.ts                     # 成员列表/改角色/移除 + owner 保护
├── invites.test.ts                     # 邀请列表/创建/撤销 + token 一次性 + 并发
├── ownership.test.ts                   # 转移 CAS 并发 + 非 owner 拒绝
└── account.test.ts                     # 资料读写 + 改密
apps/api/test/                          # 既有路由用例风格，补 account/project 路由用例
```

**Structure Decision**: 沿用 [modules.md](../../docs/architecture/modules.md) 的 monorepo 分层：服务端新增两个模块目录（`project`、`account`）与 `organization` 平级，均遵循既有 router/service/queries 三段式；前端不新建顶层目录，把控制台 API 与页面改造收敛在 `features/dashboard`（四页所在地）与既有 store，组织切换器改 `components/layout/Sidebar`。测试放 `tests/console`（与 `tests/auth` 平级），复用同一条 `bun test` 命令。

## Complexity Tracking

> Constitution Check 两个时点均通过，无违规项需要登记。

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| （无） | — | — |

计划阶段的两条范围说明（非违规）：

1. **本批次实现约 15 个尚未实现的契约端点**，而非只做界面——`endpoints.md` 已定值但 002 批次只落地了注册/登录/会话与三个组织入口，控制台的成员、邀请、项目、账号面全部没有服务端实现。契约已存在，故这是「实现既有契约」，不是新增能力。
2. **模板遗留路由（应用构建器、数据源、谱文编辑器）保留不动**——它们不属于 spec 范围，改造它们会扩大验收面；其本地种子数据仍由原 store 提供，仅控制台四页切换到 API 数据源。
