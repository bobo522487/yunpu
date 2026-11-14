# Implementation Plan: 用户注册、登录与默认组织

**Branch**: `002-user-auth-default-org` | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-user-auth-default-org/spec.md`

## Summary

用 Better Auth 1.7.23 + Drizzle 0.45.4 在现有 Bun/Hono 进程内落地邮箱密码认证：注册成功后在同一业务流程内创建默认组织（或兑换邀请），登录后按「成员关系上的 last_used_at → created_at」解析默认组织，跨设备一致；会话 7 天滑动续期、无绝对上限；登录失败按「邮箱 + 来源地址」5 次 / 15 分钟限流。为使无组织用户的引导状态可用，同时提供 `POST /api/v1/organizations`（复用 `app.create_organization`）。数据层只引入认证表与 `organization`、`organization_member`、`invite`、`audit_log` 四张租户表，RLS 与受控函数沿用 `docs/` 的既定设计。

技术取舍与替代方案见 [research.md](research.md)。

## Technical Context

**Language/Version**: TypeScript 7.0.2，运行时 Bun 1.4.4

**Primary Dependencies**: Hono 4.13.18、Zod 4.6.7、`pg` 8.23.1、Better Auth 1.7.23、Drizzle ORM 0.45.4；`drizzle-kit` 仅作为生成迁移的开发工具。包管理器 pnpm 12.18.0。`apps/web` 已克隆为独立的 Vite + React 工程，但本批次不接认证 API；认证验证仍走服务端最小页面。

**Storage**: PostgreSQL 18。Schema 划分沿用数据模型：`auth`（Better Auth 表）与 `public`（`organization`、`organization_member`、`invite`、`audit_log`）。不新增数据库、缓存或消息队列。

**Testing**: `bun test --env-file .env.test`，集成用例打在测试环境的真实 PostgreSQL 18 上；路由用例用 `app.request()`；RLS、唯一约束、邀请抢占与限流窗口不得用替身跳过。

**Target Platform**: Linux 开发机；Bun 进程在宿主机，PostgreSQL 18 与 MinIO 由 Compose 提供。同时运行的基础设施组件仍为 3 个。

**Project Type**: Web 服务（Hono API + 本批次最小服务端认证页面）。`apps/web` 的 Vite/React SPA 不在本批次。

**Performance Goals**: 登录后进入默认组织的中位耗时 ≤ 3 秒、95% ≤ 5 秒（`SC-004`）；默认组织解析为一次按 `user_id` 收敛的查询，不引入额外往返；注册到进入默认组织的中位耗时 ≤ 2 分钟（`SC-001`）。

**Constraints**:

- 会话：7 天有效期、滑动续期 1 天、`cookieCache.enabled = false`、无绝对最长寿命。
- 登录失败：同一「邮箱 + 来源地址」连续 5 次失败后，15 分钟内拒绝该组合；成功登录清零；提示不区分邮箱是否存在。
- 注册只要求邮箱与密码；邮箱去首尾空白并转小写后唯一；密码最低 8 个字符；密码不得明文落库或进日志。
- 注册与默认组织创建必须一致：任一步失败则补偿删除刚创建的认证用户，响应完成后不得留下「有账号无组织」的半成品。
- 默认组织解析顺序：`last_used_at` 最新的 active 组织 → 最早加入的 active 组织 → 引导状态；归档组织不参与。
- 租户隔离由 RLS 执行；业务连接角色 `genealogy_app` 无 `BYPASSRLS`；`SECURITY DEFINER` 函数属主为 `rls_definer`。
- 本批次不实现微信 OAuth、邮箱验证、找回密码、修改密码、永久锁定、验证码、MFA 与 `apps/web` SPA。
- 保留 001 批次 `/` 的既有语义（开发环境示例工作区 / 测试环境空白页）；认证后工作区使用 `/app`，不破坏环境批次的验收锚点。
- 文档门禁：涉及数据模型、权限矩阵或错误映射的改动，合并前必须通过 `scripts/check-docs.sh --root docs --strict --baseline docs/.check-docs-baseline.txt`。

**Scale/Scope**: 单应用进程；每个账号的组织成员关系数量为个位数到几十。登录失败计数是进程内状态，按单实例部署设计；出现多实例需求时再迁移到共享存储（不预埋）。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Phase 0 之前

| # | 检查 | 结论 | 出处 |
| --- | --- | --- | --- |
| 1 | 是否引入新抽象层？消除了哪两处重复？ | 否。Better Auth 与 Drizzle 是 `docs/` 已定的技术选型；`packages/db` 与 `packages/shared` 是既定目录，不是新造抽象 | Article I、`ARCH-AR-06` |
| 2 | 是否引入新表？为什么不能用现有结构表达？ | 认证表由 Better Auth 持有，不计入 22 张业务表；业务侧只建 `organization` / `organization_member` / `invite` / `audit_log`，均为文档既定表。默认组织不建新表，复用成员关系 | Article IV、`DM-ORG-01`~`07` |
| 3 | 是否新增依赖方向？依赖图是否仍单向？ | 是新增 `apps/api → packages/db / packages/shared`，方向与 `ARCH-AR-05` 一致，无反向依赖 | `ARCH-AR-05` |
| 4 | 新约束的执行者是谁？ | 唯一邮箱：唯一索引 + 服务层规范化；注册一致性：编排服务 + 补偿删除 + 集成测试；默认组织：查询 + `organization_member` 约束；限流：中间件 + 测试；邀请：`app.accept_invite()` 抢占 | Article III、Article VIII |
| 5 | 新错误码是否已在 `errors.md` 登记？ | 复用 `GX005` / `GX008` / `GX009` / `GX010` 与 `RATE_LIMITED`；新增邮箱冲突映射（`23505` → 409）需在 `errors.md` §9.4 登记 | `DM-GEN-18` |
| 6 | 新编号是否在 `docs/README.md` 登记？ | 本计划不新增 `ARCH-*` / `DM-*` 编号；`organization_member.last_used_at` 作为既有 `DM-ORG-07` 软约束范围内的实现细节登记到 `invariants.md` §7.2 | Article VI、`DM-GEN-21` |
| 7 | 是否触碰「明确不做」清单？ | 否。未引入软删除、缓存、队列、搜索引擎、第二数据库、OAuth 或 SPA | `OOS-06`、`OOS-09`、`OOS-10`、`OOS-14`、`OOS-16` |
| 8 | 复杂度预算 | 业务模块 2 个（`auth`、`organization`），累计 ≤ 8；业务表 4 张，累计 ≤ 30；基础设施组件仍为 3 | `.specify/memory/constitution.md` 复杂度预算 |

门禁：通过。补偿删除、进程内限流与新增运行时依赖登记在下方 Complexity Tracking。

### Phase 1 之后

| 检查 | 结论 |
| --- | --- |
| 是否新增没有执行者的约束？ | 否。`last_used_at` 只允许当前用户更新，执行者为服务层条件更新 + 集成测试；邀请规则由受控函数执行 |
| 是否出现跨文档矛盾？ | 否。数据模型只新增 `last_used_at` 一列；认证表归属 `auth` schema；未复制 `docs/` 表格 |
| 编号是否悬空？ | 否。引用 `FR-*` / `DM-*` / `GX*` 均有定义；新增映射按上表回写 `docs/` |
| 是否破坏 RLS 或单一真相源？ | 否。四张租户表全部启用 `ENABLE` + `FORCE ROW LEVEL SECURITY`；枚举与错误映射仍由单一来源生成或引用 |

门禁：通过。

## Project Structure

### Documentation (this feature)

```text
specs/002-user-auth-default-org/
├── plan.md              # 本文件
├── research.md          # Phase 0 输出
├── data-model.md        # Phase 1 输出
├── quickstart.md        # Phase 1 输出
├── contracts/
│   ├── auth-api.md
│   ├── organization-selection.md
│   ├── invite-acceptance.md
│   └── web-pages.md
└── tasks.md             # Phase 2 输出，由 /speckit-tasks 生成
```

### Source Code (repository root)

```text
package.json                       # 新增 db:generate / db:migrate 脚本
pnpm-workspace.yaml                # 纳入 packages/*
apps/api/
├── package.json
├── src/
│   ├── index.ts                  # Bun 入口，装配路由
│   ├── app.ts                    # 中间件链、错误处理、路由挂载
│   ├── env.ts                    # 环境变量校验（新增认证变量）
│   ├── auth/
│   │   ├── index.ts              # Better Auth 实例（Drizzle adapter、会话配置）
│   │   └── provisioning.ts       # 注册编排：建用户 → 兑换邀请/建默认组织 → 失败补偿
│   ├── middleware/
│   │   ├── auth.ts               # getSession → c.set('user')
│   │   └── login-rate-limit.ts   # 邮箱 + 来源地址失败窗口
│   ├── db/
│   │   └── with-user.ts          # 事务内 SET LOCAL ROLE / app.user_id
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── router.ts
│   │   │   ├── service.ts
│   │   │   ├── schema.ts
│   │   │   └── errors.ts
│   │   └── organization/
│   │       ├── router.ts
│   │       ├── service.ts
│   │       ├── queries.ts
│   │       ├── schema.ts
│   │       └── errors.ts
│   ├── pages/
│   │   └── auth.ts               # 最小注册/登录/工作区/引导页
│   └── lib/
│       ├── errors.ts             # AppError 与 SQLSTATE 映射
│       ├── ids.ts                # UUIDv7（认证表 ID）
│       └── logger.ts
├── test/
│   ├── auth-router.test.ts
│   └── organization-router.test.ts
apps/web/                          # 已克隆的 Vite + React UI；端口 5173，本批次不接认证
packages/
├── db/
│   ├── package.json
│   ├── drizzle.config.ts
│   ├── src/
│   │   ├── schema/
│   │   │   ├── auth.ts
│   │   │   ├── tenant.ts
│   │   │   └── index.ts
│   │   ├── client.ts
│   │   └── migrate.ts
│   └── migrations/
│       ├── 0000_roles.sql
│       ├── 0001_auth_tenant.sql
│       ├── 0003_functions.sql
│       ├── 0004_rls.sql
│       ├── 0005_grants.sql
│       └── 0006_fix_user_email_grant.sql
└── shared/
    ├── package.json
    └── src/
        ├── schemas.ts
        ├── errors.ts
        └── enums.ts
tests/
└── auth/
    ├── registration.test.ts
    ├── login-session.test.ts
    ├── default-organization.test.ts
    ├── invite-acceptance.test.ts
    ├── login-rate-limit.test.ts
    └── fixtures.ts           # 邀请/第二组织种子（仅测试）
docker/postgres/init/01-role.sql   # 补充本地角色
scripts/env.sh                     # 迁移与角色口令引导
.env.example / .env.test           # 新增 AUTH_DATABASE_URL / BETTER_AUTH_*
```

**Structure Decision**: 采用 `docs/architecture/modules.md` 的 monorepo 结构，`apps/web` 为已克隆的独立 Vite + React 前端（端口 5173，代理 `/api` 到 3000），本批次不把它接入认证流程；认证验证仍由 API 进程内的最小页面承担，避免前后端同批变动。`packages/db` 与 `packages/shared` 为本批次新增的契约层。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| 注册跨认证层与业务层，采用补偿删除而非单一事务 | Better Auth 的用户/密码写入与业务组织创建不在同一事务边界 | 直接写 `auth.user` / `auth.account` 会绕过密码哈希、会话与 cookie 逻辑；把认证写入塞进业务事务需要依赖 Better Auth 内部 API，升级即碎 |
| 登录失败计数为进程内状态 | 单应用进程部署，15 分钟窗口无需新增表或缓存；本批次不引入 Redis | 新建计数表会带来每次失败写入与清理任务，并增加一张表；引入 Redis 违反 `OOS-09` / `OOS-14` |
| 本批次引入 Better Auth + Drizzle 运行时依赖 | `docs/architecture/stack.md` §10 明确认证与 ORM 选型；不使用会让实现与目标基线分叉 | 手写认证会复制密码哈希、会话和 cookie 逻辑，安全风险更高；继续只用 `pg` 会形成第二套数据访问路径 |
| `organization_member.last_used_at` 新列 | 默认组织需要账号级、跨设备地记录「上次使用的组织」 | 新建 `user_preference` 表会多一张表、一套 RLS 策略；放进 `auth.user` 额外字段则把业务偏好塞进认证层 |
