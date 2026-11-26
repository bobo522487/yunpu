# Technical Plan: 组织与成员协作（003）

> **Goal**：把 spec.md 的 FR-001~FR-020 落成最小改动：不新增业务概念、不推翻 002 已归档语义、不改数据模型主键与租户边界；把已实现行为补齐规格缺口，只修正两条经确认的新规则（FR-009、FR-014）与一条治理缺口（FR-020 审计）。
>
> **Spec**：[spec.md](./spec.md)（已评审通过，2026-11-26，用户选「通过，两条新规则保留」）
>
> **Architecture / Tech Stack**：Node 26 + pnpm 12 API（`apps/api`）；Hono `router → service → queries`；Drizzle + PG18（FORCE RLS、`app.user_id`、`withTenantTransaction`）；契约权威 `apps/api/src/openapi/operations.ts` + `packages/shared`，导出到 `contracts/openapi.json`；`pnpm lint` / `pnpm test:all` / `pnpm contract:check` 为合并门禁。前端在独立仓库 `yunpu-web`，本仓库只负责契约与后端行为。
>
> **Global Constraints**
> - 非法状态下沉 DB 约束，业务不变量不在应用层靠约定维持（`docs/constitution.md`）。
> - 同一事实一处权威：组织状态枚举只在 `packages/shared/src/enums.ts` 定义，TS 内联 union 与 OpenAPI enum 必须改为引用它，禁止再抄一份。
> - owner 不可移除 / 退出 / 降级是「所有权只能靠移交解除」的推论，不新增第三条角色或特权标记。
> - 禁止 Bun、禁止模块内直接导入 `createDb` / `businessPool` / 裸 `db`；所有租户写走 `withTenantTransaction`。
> - 审计记录只写标识符与动作，不写邀请 token、tokenHash、会话令牌或密码。
> - 迁移号从 0023 递增（历史上缺 0020 是既有事实，不复用）。
>
> **Review Focus**
> - FR-009 的 DB CHECK 收窄是否覆盖存量数据且不做静默数据篡改。
> - FR-014 默认值是否只改「请求侧可选」，响应侧 `role` 仍必填（DB `NOT NULL`）。
> - FR-020 补审计是否引入额外语义（移交时提升 admin 的双记录）或破坏 append-only / RLS。
> - 契约再生成后 `contract:check` 是否只出现预期差异。

## 1. 上下文与复用分析

- **关联 Spec**：[spec.md](./spec.md)；002 的注册/登录/默认组织/邀请落位语义不变。
- **已实现、本轮只补测试与追踪的行为**：FR-001、FR-002、FR-003、FR-004、FR-005、FR-006、FR-007、FR-008、FR-010~FR-013、FR-015~FR-019。recon 证据：
  - `apps/api/src/access.ts:40-49` `requireMember()` 统一非成员 404 / 权限不足 403；所有 `:organizationId/*` 写路由都经过它。
  - 租户上下文只有 `app.user_id`（`apps/api/src/db/with-tenant-transaction.ts:73-84`）；`app.current_org_id` 已在 ADR-0010 移除，当前组织由 `organization_member.last_used_at` 派生。
  - 所有权移交 `apps/api/src/modules/organization/service.ts:266-281` → `queries.ts:464-472` → `packages/db/migrations/0015_wave1_p0_invariants.sql:107-180` 的 CAS `UPDATE ... WHERE owner_user_id = v_prev`；并发失败为 `GX010` → 409。
  - 归档写拒绝由 `packages/db/migrations/0013_shape_invariants.sql:48-96` 的 `app.reject_archived_org_write()` 触发器对 project / person / person_name / person_relation / lineage_projection / organization_member / invite 统一拦截（GX012 → 409）；改名与归档由应用层 `service.ts:291-297` 检查。
  - 邀请 token 生成与一次性下发 `service.ts:220-245`：32 字节 CSPRNG、base64url、sha256 入库，仅响应 `inviteUrl` 携带明文；列表 `queries.ts:366-382` 无 token 字段。
- **需改动的范围**：
  - `packages/shared/src/enums.ts`、`packages/shared/src/schemas.ts`
  - `apps/api/src/modules/organization/queries.ts`、`apps/api/src/modules/organization/service.ts`
  - `packages/db/migrations/0023_remove_suspended_organization_status.sql`（新）、`0024_organization_collaboration_audit.sql`（新）
  - `packages/db/src/schema/tenant.ts`（仅类型注释侧，实际枚举来自 shared）
  - `contracts/openapi.json`（再生成）
  - `docs/glossary.md`、`docs/constitution.md`、`docs/architecture.md`、`specs/002-user-auth-default-org/spec.md`（陈旧状态描述）、`specs/INDEX.md`（状态推进）
  - `tests/console/*`、`tests/security/validation-shape.test.ts`、`tests/auth/fixtures.ts`

## 2. 模块职责与依赖关系

- `router.ts` 只做鉴权 `requireUser`、参数解析 `parseParams/parseJson`、调用 service、返回标准信封；不写业务判断。
- `service.ts` 负责权限编排（`requireMember`）、冲突语义（409）、跨 service 调用（`acceptInvite`）；本次只在 `createInviteForOrg` 的入参上放宽 `role`。
- `queries.ts` 负责 SQL 与行映射；本次把两处手写状态 union 换成 `OrganizationStatus` 单一来源。
- DB 层负责不可绕过的不变量：状态 CHECK、`ck_invite_role`、archived 写触发器、owner FK RESTRICT、owner 移交 CAS 函数、审计追加触发器。
- 契约链：`packages/shared` → `apps/api/src/openapi/operations.ts` → `pnpm contract:export` → `contracts/openapi.json`；`pnpm contract:check` 拦截未同步提交。
- 不新增模块、不新增依赖、不新增接口路径；无前端改动。

## 3. 数据模型与数据库变更

- **迁移 0023：收窄组织状态（FR-009、AC-007）**
  - 现状：`packages/db/migrations/0001_auth_tenant.sql:114` `ck_organization_status CHECK ("status" IN ('active','suspended','archived'))`；列是 `text` + CHECK，不是 PG enum。
  - 新迁移 `DROP CONSTRAINT ck_organization_status` → `ADD CONSTRAINT ... CHECK ("status" IN ('active','archived'))`。
  - 存量数据处置：实测 dev 22 行全 active、test 52 active + 2 archived，**无 suspended 行**。迁移仍须防御性处理：若发现 `status='suspended'`，统一映射为 `active` 后再收紧约束。理由：`archived` 不可逆且会关闭全部写入，把未知状态映射过去等于静默删数据；`suspended` 在本代码中没有任何专属行为（列表排除、写入不特殊放行），回到 `active` 与现状最接近。
  - 同步把 `0001_auth_tenant.sql` 的 CHECK 改为两态，保证全新库与迁移库一致（迁移 runner 按文件名跳过已应用文件，见 `packages/db/src/migrate.ts:35-44`）。
  - 移除 `packages/shared/src/enums.ts:6` 的 `"suspended"`，并把 `apps/api/src/modules/organization/queries.ts:102,341` 与 `tests/auth/fixtures.ts:160` 的内联 union 改为 `OrganizationStatus`。
  - `activated` 路由 `POST /organizations/:id/activate` **保留**：它只更新 `last_used_at`（`queries.ts:185-203`），实现 FR-006 的当前组织切换，不是 suspended 复活开关。
- **迁移 0024：补齐审计记录（FR-020、AC-012）**
  - recon 结果：7 类关键事件中已有 3 类落库 —— `organization.created`（`0003_functions.sql:94-95`）、`invite.accepted`（`0003:190-191`）、`organization.owner_transferred`（`0015:170-178`）；`invite.revoked` 也在 `0008_org_management.sql:46-50`。**缺口实为 4 类**（spec 第 159 行写「六类」，按列举项计为 7 类，以 FR-020 正文列举为准）：邀请创建、成员角色调整、成员移除、组织归档。
  - 通过 DB 触发器统一补齐，避免存在绕过 service 的写路径漏审计；与既有 `app.reject_archived_org_write()` 同一风格，`SECURITY DEFINER` + 固定 `search_path`，`actor_user_id` 取当前租户会话的 `app.user_id`。
  - 新事件命名沿用点分小写：`invite.created`、`organization_member.role_changed`、`organization_member.removed`、`organization.archived`；`entity_type` 使用 `invite` / `organization_member` / `organization`（均在 `0012_genealogy_core.sql:235-240` 的 CHECK 白名单内，无需扩枚举）。
  - payload 规则：`role_changed` 仅记 from/to 角色；`removed` 与 `created` 仅记实体 id；`archived` 空 payload。**禁止**写入 invite token / tokenHash / 邮箱 / 会话令牌 / 密码。
  - 触发器条件收紧：组织仅在 `OLD.status <> NEW.status AND NEW.status='archived'` 时记录，改名不产生归档审计。
  - 已存在的 `trg_audit_log_append_only`（`0003_functions.sql:235-236`）与 audit_log 授权保持不变。
- **不做的数据变更**：不加第五种角色、不恢复 suspended、不改 owner FK、不改 organization_member 主键、不加软删除列（物理删除是既有约定）。

## 4. API Contract

- `CreateInviteSchema`（`packages/shared/src/schemas.ts:75-79`）：`role: RoleSchema` → `role: RoleSchema.default("viewer")`。请求侧变为可选，响应侧 `Invite.role` 仍必填（DB `NOT NULL`，`operations.ts:92-99` 不变）。
- `service.ts:220-245` `createInviteForOrg` 参数类型改为 `role?: MemberRole`，写库时用 `values.role ?? "viewer"`（`organization_member` / `invite` 的 role 列无 DB 默认值，不能依赖数据库补齐）。
- `UpdateOrganizationSchema.status`（`schemas.ts:45`）随 `ORGANIZATION_STATUSES` 自动收窄为 active/archived，不再接受 suspended。
- `apps/api/src/openapi/operations.ts` 的 status enum 均引用 `ORGANIZATION_STATUSES`（`:75` 已是），`OrganizationDetailSchema` 无需结构改动；`POST /organizations/:id/activate` 契约保持。
- 再生成 `contracts/openapi.json`：`pnpm contract:export`。预期差异仅：7 处组织状态 enum 去掉 `suspended`、`CreateInviteSchema` 的 `required` 从 `["email","role"]` 变为 `["email"]` 且 `role` 带 `default: "viewer"`。任何额外差异视为异常，需停下核对（`contract:check` 是合并门禁）。
- `AppType` 由上述 schema 自动推导，无需手写类型修改。

## 5. 异常处理、事务与并发控制

- 错误码与 SQLSTATE 映射保持现状：`GX010` → 409 并发冲突（`errors.ts:77-80`），`GX012` → 409 归档只读（`errors.ts:57-60`），owner FK RESTRICT → 409「不能移除组织所有者」（`errors.ts:37-43`），显式 owner 退出检查 → 409（`service.ts:317-319`）。
- `withTenantTransaction` 只对 `40001`/`40P01`/`ECONNRESET` 重试，不重试 `GX010`；并发移交与并发兑换的冲突方收到 409 即为预期结果，不增加重试逻辑（避免吞掉确定性冲突）。
- 本次新增的两处 DB 变更均不改变事务边界：CHECK 在语句级生效，审计触发器与原 DML 同一事务，满足 FR-018「要么全成要么全不成」。
- 表单校验失败（空名 / 超长 / 非法状态 / 非法角色）仍由 `parseJson` 返回 400，资源不创建。

## 6. 安全性、性能与兼容性

- **租户隔离**：所有路径不变，仍靠 `app.user_id` + `requireMember` + FORCE RLS；新增触发器读取同一会话变量，不引入跨租户写入通道。非成员对 B 组织的操作继续统一 404，不泄漏存在性。
- **审计脱敏**：新触发器 payload 只写枚举值与 id；回归测试扫描 `audit_log.payload::text` 不含 `token`/`secret`/`password` 及任何邀请明文 token。
- **性能**：状态 CHECK 与审计触发器均为常量开销；不新增索引（现有 `organization_member` 唯一键与 `invite.uk_invite_token_hash`、`organization.status` 行量级足够）。候选列表 / 邀请列表继续沿用 keyset 分页（limit 50）。
- **兼容性**：`suspended` 在 API 层本就不可设置、列表本就不返回，收窄是契约对齐而非行为破坏；邀请 `role` 改可选是向后兼容放宽，旧客户端显式传 role 仍有效。002 的注册 / 登录 / 默认组织 / 邀请兑换落位不改。
- **前端**：下游 `yunpu-web` 消费再生成的契约；本仓库不做前端改动，不违反 ADR-0008。

## 7. 技术风险与取舍

- **存量 suspended 行的映射**：选 `active` 而非 `archived`，因为后者不可逆且关闭写入，等于静默销毁数据；当前 dev/test 无此类行，风险仅存在于未知环境。若评审认为应「迁移失败并人工介入」，需在编码前明确，我不自行改动该决定。
- **移交时角色提升产生两条审计**：接收方若为 viewer/editor，`0015` 会将其提升为 admin，新触发器会额外写一条 `organization_member.role_changed`，与已有的 `organization.owner_transferred`（payload 含 `promoted_to_admin`）并存。取舍：保留两条，可审计性优先；不接受用调用栈探测来抑制记录（脆弱且不必要）。
- **改名审计缺口**：FR-020 列举的 7 类事件不含改名；本轮不为改名补审计，避免扩大范围。
- **activate 契约与运行时 DTO 既有不一致**：OpenAPI 声明 `OrganizationDetailSchema`，运行时返回 `OrganizationSummary`（recon 指出）。这是历史问题，不属 FR-001~FR-020；本轮仅保持现状，另开条目处理。
- **无需新 ADR**：FR-009 与 FR-014 已在 spec 评审中显式批准，且未推翻 002 的权威语义；本轮不引入核心架构变更。

## 8. Self-Review

- **Spec coverage**：FR-001~FR-020 全部映射到「已实现 + 测试」或明确改动；两条新规则（FR-009/FR-014）与一条治理缺口（FR-020）都有迁移/代码/测试落点。
- **Step scan**：每个任务都给出可观察结果（迁移可应用、契约 diff 符合预期、测试通过），无「顺便重构」类模糊步骤。
- **Type consistency**：`OrganizationStatus` 单一来源；service 参数 `role?: MemberRole` 与 Zod `.default("viewer")` 对齐；响应侧 `role` 保持必填；触发器 payload 键名与事件名全库统一。
- **Review Focus**：存量数据映射、默认角色只改请求侧、双审计记录、契约 diff 均已在上文明确。
- **Proportion**：改动限 2 个新迁移 + 4 个源文件 + 契约再生成 + 文档同步 + 测试；未新建模块或依赖，规模与本轮 spec 增量相称。

> **下一步等待人工审核**：plan 通过后再按模板拆解 `tasks.md`，然后由用户选择执行方式（主会话内实现 / 子代理逐任务实现）。
