# Tasks: 组织与成员协作（003）

> **执行原则**：按依赖顺序逐批执行；修改前先查看现有实现；不擅自扩大范围；每完成一个任务即运行对应测试并更新状态；发现 `spec.md` 缺失或 `plan.md` 冲突时立即暂停报告。
>
> - **输入**：[spec.md](./spec.md)、[plan.md](./plan.md)
> - **门禁命令**：`pnpm lint`、`pnpm test:all`、`pnpm contract:check`（每次契约变更后必须跑）
> - **本轮性质**：大部分行为已实现并有测试；本轮以「补规格缺口 + 两条确认的新规则 + 审计治理缺口 + 回归覆盖」为主，禁止顺手重构。

## 1. 开发任务清单

| ID | 状态 | 依赖 | 关联需求 | 任务描述 | 修改范围 & 变更类型（迁移/API/配置） | 测试要求 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `T-001` | `[x]` | - | `FR-009` | 把组织状态单一来源收窄为 `active`/`archived`：删除 enum 中的 `suspended`，两处手写 union 与测试 helper 参数改为引用 `OrganizationStatus` | `packages/shared/src/enums.ts:4-9`、`apps/api/src/modules/organization/queries.ts:102,341`、`tests/auth/fixtures.ts:160`（代码） | `pnpm lint`；`pnpm test:auth`（fixtures 编译通过，既有 archived 用例不回归） |
| `T-002` | `[x]` | `T-001` | `FR-009` | 新增迁移 0023 收紧 `ck_organization_status`；先把任何存量 `suspended` 行改为 `active`（dev/test 实测无此类行），再 drop/re-add CHECK；同步改 0001 使全新库一致 | `packages/db/migrations/0023_remove_suspended_organization_status.sql`（新，迁移）、`packages/db/migrations/0001_auth_tenant.sql:114`（迁移源） | `pnpm db:migrate` 在 test 库通过；`pnpm test:env`；用真实 PG 直接 `UPDATE ... SET status='suspended'` 断言 SQLSTATE 23514 |
| `T-003` | `[x]` | `T-002` | `FR-009`、`FR-004` | 新增 API 层负向测试：PATCH 传 `suspended` 返回 400 且行不变；生成契约后断言全文件不再出现 `suspended` | `tests/console/organization-status.test.ts`（新，测试）、`tests/security/validation-shape.test.ts`（测试）、`contracts/openapi.json`（再生成） | `pnpm contract:export` 后 `pnpm contract:check` 零差异；新增两用例通过 |
| `T-004` | `[x]` | `T-003` | `FR-009` | 同步陈旧文档：术语表、宪法约束、架构、002 的历史状态描述；003 spec 中的「无 suspended」表述保持不变 | `docs/glossary.md:30`、`docs/constitution.md:36`、`docs/architecture.md`（若含该枚举）、`specs/002-user-auth-default-org/spec.md:170`、`specs/INDEX.md`（文档） | 全仓检索 `suspended` 仅剩 003 spec 的说明性文字与历史 CHANGELOG；`pnpm lint` |
| `T-005` | `[x]` | - | `FR-014`、`AC-009` | 邀请角色改为可选、默认 viewer：`CreateInviteSchema.role` 加 `.default("viewer")`，service 入参 `role?: MemberRole` 且写库用 `values.role ?? "viewer"`（DB 列无默认值） | `packages/shared/src/schemas.ts:75-79`、`apps/api/src/modules/organization/service.ts:220-245`（API/契约） | `tests/console/invites.test.ts` 新增「不传 role → 201 且角色 viewer、兑换后为 viewer」 |
| `T-006` | `[x]` | `T-005` | `FR-014`、`FR-015` | 契约再生成并核对差异仅限预期：`required` 去掉 `role`、role 增加 `default: "viewer"`；响应 Invite.role 仍必填 | `contracts/openapi.json`（生成物）、`apps/api/src/openapi/operations.ts:424`（仅核对，无需改）（契约） | `pnpm contract:export` + `pnpm contract:check`；差异逐项与 plan §4 比对 |
| `T-007` | `[x]` | `T-001`、`T-006` | `FR-020`、`AC-012` | 新增迁移 0024 补齐 4 类审计触发器：invite.created、organization_member.role_changed、organization_member.removed、organization.archived；SECURITY DEFINER + 固定 search_path，actor 取 `app.user_id`，payload 只含 id/角色枚举 | `packages/db/migrations/0024_organization_collaboration_audit.sql`（新，迁移） | `pnpm db:migrate`；迁移可重复执行前先确认 runner 跳过已应用文件；手工触发一次四类操作后查 `audit_log` |
| `T-008` | `[x]` | `T-007` | `FR-020` | 审计断言测试：四类新事件各一条完整记录；移交若提升 admin 允许 role_changed 与 owner_transferred 并存；payload 不含 token/tokenHash/邮箱/密码 | `tests/console/audit-organization.test.ts`（新，测试） | `pnpm test:console`（全绿）；扫描 `payload::text` 不含敏感词 |
| `T-009` | `[x]` | `T-003` | `FR-007`、`FR-008`、`FR-014`、`FR-011`~`FR-013` | 补 archived 只读回归缺口：改名、邀请创建、邀请兑换、成员角色调整、成员移除、成员退出全部 409；archived 不出现在列表、activate 404 | `tests/console/settings.test.ts`、`tests/console/invites.test.ts`、`tests/console/members.test.ts`（测试） | `pnpm test:console`；每个操作独立断言 SQLSTATE/错误码而非仅看 HTTP 状态 |
| `T-010` | `[x]` | - | `FR-001`~`FR-005`、`AC-001`~`AC-004` | 复核 owner 单一不变量与跨租户隔离：owner 不可移除/退出/降级、移交后接收方按 admin、跨租户详情/成员/邀请/移交/改名/归档统一 404 且不泄漏 | `tests/console/ownership.test.ts`、`tests/console/members.test.ts`、`tests/console/organization.test.ts`（仅补缺口测试） | `pnpm test:console` + `pnpm test:auth`；确认既有断言仍覆盖 404 文案一致性 |
| `T-011` | `[x]` | - | `FR-006`、`FR-017`~`FR-019`、`AC-005`、`AC-010`、`AC-011` | 复核切换当前组织、并发兑换唯一、并发移交唯一、写操作原子性；不改实现，只在缺口处补断言 | `tests/console/settings.test.ts`、`tests/auth/invite-acceptance.test.ts`、`tests/console/ownership.test.ts`（测试） | `pnpm test:all`；并发用例重复 3 次无 flaky |
| `T-012` | `[x]` | `T-002`~`T-011` | `FR-001`~`FR-020` | 合并门禁与独立验收：跑全部门禁，按 §3 矩阵逐条对照 spec/plan/代码/测试填写验收结果，未通过项回滚或报告 | 不新增源码改动；仅更新本文件状态与矩阵 | `pnpm lint` + `pnpm test:all` + `pnpm contract:check` 全绿；矩阵 20 行全部有证据 |

## 2. 每任务完成汇报模板

完成每个任务后记录/输出：

1. 修改了哪些文件
2. 实现了哪些功能
3. 执行了哪些测试及命令
4. 测试结果
5. 是否存在遗留问题

---

## 3. 独立验收与需求追踪矩阵

> 由独立质量视角对照原始 `spec.md`、`plan.md`、`tasks.md` 与实际代码逐项核验，不能仅凭开发自证通过。

| 需求 ID | 实现位置 | 测试用例 | 静态/集成检查 | 验收结果 |
| :--- | :--- | :--- | :--- | :--- |
| `FR-001` | `apps/api/src/modules/organization/service.ts:createOrganizationForUser` → `packages/db/migrations/0003_functions.sql:app.create_organization` | `tests/console/organization.test.ts` | `pnpm lint` / `pnpm test:all` | ✅ |
| `FR-002` | `apps/api/src/modules/organization/service.ts:updateMemberRole/removeMember/leaveOrganizationForUser` + `0001_auth_tenant.sql:fk_organization_owner` | `tests/console/members.test.ts`、`tests/console/settings.test.ts`、`tests/console/ownership.test.ts` | `pnpm test:all` | ✅ |
| `FR-003` | `apps/api/src/modules/organization/service.ts:transferOwnerForOrg` → `0015_wave1_p0_invariants.sql:app.transfer_organization_ownership` | `tests/console/ownership.test.ts` | `pnpm test:all` | ✅ |
| `FR-004` | `apps/api/src/access.ts:requireMember` + `apps/api/src/modules/organization/router.ts` | `tests/console/members.test.ts`、`tests/console/invites.test.ts` | `pnpm lint` / `pnpm test:all` | ✅ |
| `FR-005` | `apps/api/src/access.ts:40-49` + `apps/api/src/db/with-tenant-transaction.ts` | `tests/console/organization.test.ts:81`、`tests/console/members.test.ts:144`、`tests/console/invites.test.ts:140` | `pnpm test:all` | ✅ |
| `FR-006` | `apps/api/src/modules/organization/queries.ts:activateOrganization,listOrganizations` | `tests/console/settings.test.ts`、`tests/auth/default-organization.test.ts` | `pnpm test:all` | ✅ |
| `FR-007` | `apps/api/src/modules/organization/service.ts:updateOrganizationForUser` | `tests/console/settings.test.ts:31,102`、`tests/console/organization-status.test.ts` | `pnpm test:all` | ✅ |
| `FR-008` | `0013_shape_invariants.sql:app.reject_archived_org_write` + `service.ts:294-297` | `tests/console/settings.test.ts:65`、`tests/console/organization-status.test.ts`、`tests/console/audit-organization.test.ts` | `pnpm test:all` | ✅ |
| `FR-009` | `packages/shared/src/enums.ts:ORGANIZATION_STATUSES`、`packages/db/migrations/0023_*.sql`、`apps/api/src/modules/organization/queries.ts:99-109,341` | `tests/console/organization-status.test.ts`、`tests/security/validation-shape.test.ts` | `pnpm contract:check` / `pnpm test:all` | ✅ |
| `FR-010` | `apps/api/src/modules/organization/queries.ts:listMembers` | `tests/console/members.test.ts` | `pnpm test:all` | ✅ |
| `FR-011` | `apps/api/src/modules/organization/queries.ts:updateMemberRoleRecord` + `0013_shape_invariants.sql:91` | `tests/console/members.test.ts:35,71` | `pnpm test:all` | ✅ |
| `FR-012` | `apps/api/src/modules/organization/queries.ts:removeMemberRecord` + `fk_organization_owner` | `tests/console/members.test.ts:109` | `pnpm test:all` | ✅ |
| `FR-013` | `apps/api/src/modules/organization/service.ts:leaveOrganizationForUser` | `tests/console/settings.test.ts:117` | `pnpm test:all` | ✅ |
| `FR-014` | `packages/shared/src/schemas.ts:CreateInviteSchema`、`apps/api/src/modules/organization/service.ts:createInviteForOrg` | `tests/console/invites.test.ts:7,44`、`tests/security/validation-shape.test.ts` | `pnpm contract:check` / `pnpm test:all` | ✅ |
| `FR-015` | `apps/api/src/modules/organization/queries.ts:listInvites` | `tests/console/invites.test.ts:7` | `pnpm test:all` | ✅ |
| `FR-016` | `apps/api/src/modules/organization/service.ts:revokeInvite` → `0008_org_management.sql:app.revoke_invite` | `tests/console/invites.test.ts:100,185` | `pnpm test:all` | ✅ |
| `FR-017` | `0003_functions.sql:app.accept_invite`（GX009/GX010） | `tests/auth/invite-acceptance.test.ts:24,59,84,106,133,163` | `pnpm test:all` | ✅ |
| `FR-018` | `apps/api/src/db/with-tenant-transaction.ts` + `0015_wave1_p0_invariants.sql` CAS | `tests/console/ownership.test.ts:118`、`tests/auth/invite-acceptance.test.ts:163` | `pnpm test:all` | ✅ |
| `FR-019` | `0015_wave1_p0_invariants.sql:160-168`、`0003_functions.sql:170-181` | `tests/console/ownership.test.ts:118`、`tests/auth/invite-acceptance.test.ts:163` | `pnpm test:all` | ✅ |
| `FR-020` | `packages/db/migrations/0024_organization_collaboration_audit.sql`（新）+ 已有 `0003/0008/0015` 审计写入 | `tests/console/audit-organization.test.ts`、`tests/console/ownership.test.ts:13`、`tests/auth/invite-acceptance.test.ts:24` | `pnpm lint` / `pnpm test:all` | ✅ |

## 4. 独立验收记录（T-012）

- 最终 HEAD：`702a3c8`（分支 `003-org-collab`）。门禁：`pnpm lint` exit 0；`pnpm test:all` exit 0（env 13/13 + 主套件 54 files passed / 1 skipped、232 tests passed / 3 skipped）；`pnpm contract:check` exit 0；工作树干净。
- 每条 FR 的「实现位置」已对照实际代码，「测试用例」已逐项落在该 FR 对应的测试文件；20 行全部有门禁证据，故标记 ✅。
- 各任务由独立 reviewer 逐任务复核并 Approved；T-003 的两轮 Minor 修复、T-011 的 `JsonResponse` 类型导入修复均已落地并复验。
- 已知遗留（不阻塞本次验收）：`apps/api/src/modules/organization/queries.ts:358` 的 `patch` TS 类型仍宽松（运行时 Zod 拒绝，pre-existing）；owner 移除返回通用 `记录仍被引用`（SQLSTATE 23001）而非更专门文案；并发移交测试用 `pg_locks` 屏障，依赖当前 `fileParallelism:false`，若将来并行化需加强过滤；`POST /organizations/:id/activate` 的契约声明 `OrganizationDetailSchema` 但运行时返回 `OrganizationSummary`（历史不一致，另案处理）。
- 本次未新增 ADR：FR-009/FR-014 属 003 批准范围内的规则收敛，未推翻已接受 ADR。
