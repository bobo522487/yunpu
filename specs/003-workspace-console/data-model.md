# Phase 1 Data Model: 工作台控制台

**Feature**: `003-workspace-console` | **Date**: 2026-11-15

> 权威定义在 [schema.md](../../docs/architecture/data/schema.md)，本文件只记录本批次**实际落地的表、字段、约束与执行者**，不复制 22 张表清单。本批次新增 1 张表（`project`），消费 4 张既有表（`organization`、`organization_member`、`invite`、`auth.user`），不新增任何派生存储。

## 1. 新增表：`project`

字段与约束逐条对应 schema.md §5.4：

| 字段 | 类型 | 空 | 约束 / 说明 | 执行者 |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | 否 | 主键，`uuidv7()` | DB |
| `organization_id` | `uuid` | 否 | `fk_project_org` → `organization(id)`，`ON DELETE RESTRICT` | DB |
| `name` | `text` | 否 | `ck_project_name_not_blank`（`btrim(name) <> ''`） | DB + Zod（400 先行） |
| `status` | `text` | 否 | `ck_project_status`：`planning` / `in_progress` / `completed`，默认 `'planning'` | DB |
| `surname` | `text` | 是 | 有值时非空白（`ck_project_surname_not_blank`） | DB |
| `hall_name` | `text` | 是 | 有值时非空白（`ck_project_hall_name_not_blank`） | DB |
| `origin_text` | `text` | 是 | 不规范化 | — |
| `description` | `text` | 是 | | — |
| `created_at` | `timestamptz` | 否 | `now()` | DB |
| `updated_at` | `timestamptz` | 否 | `clock_timestamp()`，由 `trg_touch_updated_at` 推进，严格单调 | DB 触发器 |

- 主键 `PRIMARY KEY (id)`；**`UNIQUE (organization_id, id)`**：为未来内容表复合外键预留（§4.3），本批次无内容表但必须一并建出，否则后续迁移要改表。
- 索引：`idx_project_org_status (organization_id, status)`（§5.4 既定）。
- **scope 不可迁移**：按 `schema.md` §9.2，`trg_guard_scope_immutable` 的 20 张表清单**不含** `project`（`project` 无内容表引用时由 RLS `WITH CHECK` 与服务层保证，内容表落地后由复合外键天然锁住）；`trg_touch_updated_at` 覆盖本表（§5.4「updated_at 触发器维护」）。
- 无 `version` 列、无 `deleted_at`、无 `ref` 列（URL 直接用 `id`；`OOS-06` 永久性决定）。

### 1.1 RLS 与授权（迁移 `0007_project.sql`）

```sql
ALTER TABLE public.project ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.project
  USING (organization_id = ANY (app.visible_org_array()))
  WITH CHECK (organization_id = ANY (app.visible_org_array()));
-- 谓词必须写成 = ANY (app.visible_org_array())，不得加 SELECT 子查询（宪法「租户隔离」节）
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project TO genealogy_app;
-- rls_definer 对 project 不授予任何权限（security.md §8.5「没有授予」清单）
```

执行者：RLS 策略（`FR-TEN-01`）；验证：`db/verify/rls.sql` 断言表数与策略数同步增加、跨租户用例。

## 2. 既有表的消费方式（不改结构）

### 2.1 `organization`

| 本批次操作 | 字段变化 | 权限 / 执行者 |
| --- | --- | --- |
| 改名 | `name`（`btrim <> ''`） | 服务层校验 + `organization.update`（C3） |
| 归档 | `status: active → archived` | `organization.archive`；归档后写入被拒（`EC-08`，软约束由服务层执行并登记） |
| 退出组织 | 删除本人成员行 | owner 必须先转移所有权，否则 409 |

不新增字段。归档是状态变化，不是删除（`FR-ORG-02`）。

### 2.2 `organization_member`

| 本批次操作 | 执行者 | 说明 |
| --- | --- | --- |
| 列表 | 服务层查询 + RLS | 返回 role、`isOwner`（由 `organization.owner_user_id` 推导，不落第二份数据） |
| 改角色 | 服务层 `UPDATE role`（列级授权已存在）+ `organization.member.write` | **owner 角色不可改**（`owner` 不是成员角色，`DM-ORG-06`） |
| 移除成员 | 服务层 `DELETE` + 同上权限 | owner 行由 `fk_organization_member_org RESTRICT` 兜底（验收 #2，`23001`） |
| 切换组织 = 记住 | `POST .../activate` → `last_used_at = clock_timestamp()` | 「切换即记住」的唯一写点，跨设备一致 |

`DM-ORG-07`（成员增删改由应用层做角色授权，RLS 只管隔离）是既有软约束，本批次按其执行者实现，不改文档。

### 2.3 `invite`

| 本批次操作 | 执行者 | 说明 |
| --- | --- | --- |
| 列表 | 服务层查询 + RLS | 仅 `pending` 可撤销；已兑换/过期反映真实状态（`FR-015`） |
| 创建 | 服务层 `INSERT` + Zod 校验 | token ≥ 32 字节 CSPRNG（`DM-INV-01`），库存 `sha256`；同组织同邮箱已有 pending → 409（`uq_invite_pending_email`） |
| 撤销 | **`app.revoke_invite(uuid, text)`**（本批次迁移 `0008` 补建） | 业务角色无 `invite.UPDATE`；强审计；非管理员 `GX006`，重复撤销 `GX005` |
| 兑换 | 既有 `app.accept_invite()` | 002 已交付，本批次不改 |

状态机（不变，仅列出执行者为 DB CHECK + 受控函数）：

```text
pending ──accept_invite──> accepted (accepted_at NOT NULL)
   │
   └──revoke_invite──────> revoked  (revoked_at NOT NULL)
```

### 2.4 `auth.user`（账号设置分区）

| 操作 | 执行者 | 说明 |
| --- | --- | --- |
| 读资料 | `GET /account` → Better Auth session | id、email、name |
| 改显示名 | `PATCH /account` → `auth.updateUser({ name })` | 只对本人生效（`FR-006`） |
| 改密码 | `POST /account/password` → Better Auth `changePassword` | 需当前密码；密码不进日志（`FR-003` spec 002） |

不新增账号字段，不建偏好表。

## 3. 关键不变量与执行者（本批次涉及）

| # | 不变量 | 执行者 | 验证 |
| --- | --- | --- | --- |
| 1 | 项目只属于一个组织，创建后 scope 不可迁移 | `fk_project_org` + `trg_guard_scope_immutable` | 集成测试（跨组织 UPDATE 被拒） |
| 2 | 项目名非空白 | `ck_project_name_not_blank` + Zod | 集成测试 + 路由 400 |
| 3 | 组织行只能被可见成员读写 | RLS `visible_org_array` | `tests/console` 跨租户用例 |
| 4 | owner 成员行不可删、角色不可改 | `RESTRICT` 外键（`23001`）+ 服务层前置检查 | `members.test.ts` |
| 5 | 同组织同邮箱最多一个 pending 邀请 | `uq_invite_pending_email` | `invites.test.ts` 并发用例 |
| 6 | 邀请明文只出现一次 | 服务层仅在创建响应返回 token，库中只有哈希 | 契约测试（列表响应不含 token） |
| 7 | 所有权转移并发只成功一次 | `app.transfer_organization_ownership()` CAS（`GX010`） | `ownership.test.ts` 并发用例 |
| 8 | 项目并发编辑不静默覆盖 | `updated_at` 条件 UPDATE → 409 `CONCURRENT_MODIFICATION` | `projects.test.ts` 并发用例 |
| 9 | 归档组织不可进入为当前组织 | 服务层 `activate` 的 `status='active'` 条件（既有实现） | `SC-007` |
| 10 | 只读成员写操作 0 成功 | 服务层角色检查（C3）+ 界面禁用 | `SC-003` 用例 |

## 4. 数据量与分页

- 组织、成员、邀请、项目列表均按 C4 使用 `cursor` / `limit`（默认 50、上限 200）keyset 分页（`NFR-PER-01`）；成员数为个位数到几十，分页主要服务项目列表。
- 不引入缓存层（`OOS-14`）：首页概览数字由一次聚合查询直接得出，进入页面时拉取。

## 5. 本批次不做的事

- 不建「当前组织」持久化表或字段——当前组织是会话级上下文，「记住」落在既有 `last_used_at`。
- 不建「固定默认组织」字段——与「上次使用的组织」二选一，保留后者（Article IV，spec 002 已定）。
- 不建通知、审计查看、统计聚合表（spec Assumptions：图表/审计查看/通知中心不在范围）。
- 不动 `folder` 及一切 Project 内容表（`person`/`lineage`/`article` 等仍属后续批次）。
