# Phase 1 Data Model: 用户注册、登录与默认组织

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-11-14

> 本文件只记录本批次新增或首次落地的最小数据面。表结构、约束与函数的完整权威仍是 [`docs/architecture/data/schema.md`](../../docs/architecture/data/schema.md)；本文引用而不复制其表格。凡与 `docs/` 冲突，以 `docs/` 为准并在实现时同步修订。

## 1. 范围

本批次落地 6 类数据：

| 数据 | 归属 | 来源 |
| --- | --- | --- |
| `auth."user"` / `auth.session` / `auth.account` / `auth.verification` | 认证层（Better Auth） | Better Auth 1.7.23 约定 |
| `organization` | 业务租户 | `docs/.../schema.md` §5.1 |
| `organization_member`（新增 `last_used_at`） | 业务租户 | `docs/.../schema.md` §5.2 + 本批次新增列 |
| `invite` | 业务租户 | `docs/.../schema.md` §5.3 |
| `audit_log` | 平台服务 | `docs/.../schema.md` §5.22 |

不新增业务表；默认组织不建表；登录失败计数不落库。其余 18 张业务表留给后续批次。

## 2. 实体关系

```text
auth.user 1 ─── n auth.session
auth.user 1 ─── n auth.account
auth.user 1 ─── n organization_member n ─── 1 organization
organization 1 ─── n invite
organization 1 ─── n audit_log
organization 1 ─── 1 owner (owner_user_id → organization_member)
```

- `organization.owner_user_id` 是唯一 owner 的事实来源；owner 的成员角色固定写 `admin`，owner 不是成员角色值。
- `organization_member` 的 `last_used_at` 是账号级「上次使用组织」的存储位置；默认组织由查询推导。
- `auth.user` 只被认证层写入；业务表通过外键引用 `auth.user(id)`。

## 3. 认证表（auth schema）

由 Better Auth 持有，业务迁移不创建这组表的业务副本。关键字段：

| 表 | 关键字段 | 约束 / 说明 |
| --- | --- | --- |
| `auth."user"` | `id uuid PK`、`name text`、`email text`、`email_verified boolean`、`image text`、`created_at`、`updated_at` | `email` 唯一；注册时 `name` 缺省为邮箱前缀；邮箱在应用层规范化后写入 |
| `auth.session` | `id uuid PK`、`token text`、`user_id uuid FK → auth.user`、`expires_at`、`ip_address`、`user_agent`、`created_at`、`updated_at` | 数据库会话；一个账号可有多个并存会话；登出只删当前会话 |
| `auth.account` | `id uuid PK`、`user_id uuid FK → auth.user`、`provider_id text`、`account_id text`、`password text`、`created_at`、`updated_at` | `provider_id = 'credential'` 时 `password` 存哈希；不得明文 |
| `auth.verification` | `id uuid PK`、`identifier text`、`value text`、`expires_at`、`created_at`、`updated_at` | 本批次不启用邮箱验证，但保留 Better Auth 约定表 |

**ID 策略**: 认证表 ID 由应用生成 UUIDv7（`apps/api/src/lib/ids.ts`），保证 `uuid` 类型与时间有序；业务表主键由数据库 `uuidv7()` 生成。

**会话参数**: `expiresIn = 604800`、`updateAge = 86400`、`cookieCache.enabled = false`、无绝对上限。

## 4. 组织与成员

### 4.1 `organization`

沿用 `docs/.../schema.md` §5.1：

- `id uuid PK DEFAULT uuidv7()`
- `name text NOT NULL` + `ck_organization_name_not_blank`
- `status text NOT NULL DEFAULT 'active'`，取值 `active` / `suspended` / `archived`
- `owner_user_id uuid NOT NULL`，复合外键 `(id, owner_user_id) → organization_member (organization_id, user_id) ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE`
- `created_at` / `updated_at`

**状态转换**：`active → suspended → archived`；归档只改状态列，不删除数据；已归档组织不参与默认组织解析，写入由服务层拒绝（`DM-ORG-05`）。

### 4.2 `organization_member`

沿用 §5.2，并新增一列：

| 字段 | 类型 | 空 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `organization_id` | `uuid` | 否 | | PK 部分；`fk_organization_member_org`，`ON DELETE RESTRICT` |
| `user_id` | `uuid` | 否 | | PK 部分；`fk_organization_member_user → auth.user(id)`，`ON DELETE RESTRICT` |
| `role` | `text` | 否 | | `admin` / `editor` / `viewer`；无 `owner` |
| **`last_used_at`** | `timestamptz` | 是 | | **本批次新增**：该成员最近一次进入/切换到该组织的时间；用于解析默认组织 |
| `created_at` | `timestamptz` | 否 | `now()` | 「最早加入」的排序依据 |
| `updated_at` | `timestamptz` | 否 | `now()` | 触发器维护 |

- `PRIMARY KEY (organization_id, user_id)`；`ck_organization_member_role`。
- `idx_organization_member_user (user_id)` 已存在，支撑默认组织查询的入口。
- `last_used_at` 只允许当前登录用户自己的成员行被更新；执行者为服务层条件更新（`WHERE user_id = app.current_user_id()`）+ 集成测试。登记为 `DM-ORG-07` 范围内的软约束。
- 更新 `last_used_at` 会触发 `app.touch_updated_at()`，因此 `genealogy_app` 的列级授权需同时包含 `last_used_at` 与 `updated_at`。

### 4.3 默认组织解析

```sql
SELECT o.id, o.name, om.role
FROM public.organization_member om
JOIN public.organization o ON o.id = om.organization_id
WHERE om.user_id = app.current_user_id()
  AND o.status = 'active'
ORDER BY om.last_used_at DESC NULLS LAST, om.created_at ASC, o.id
LIMIT 1;
```

- 有 `last_used_at`：取最近使用。
- 无任何 `last_used_at`：取最早加入。
- 无 active 成员关系：返回空，进入引导状态。
- 已归档组织被 `status = 'active'` 排除。
- 每次登录、页面引导与切换组织后都调用同一查询，不缓存。

### 4.4 创建与切换组织

`POST /api/v1/organizations` 通过 `app.create_organization(name)` 建组织，并在同一事务内把创建者成员行的 `last_used_at` 置为当前时间。

`POST /api/v1/organizations/:organizationId/activate` 在业务事务内：

1. 校验当前用户是该组织成员且组织为 `active`（`SELECT ... FOR UPDATE` 不需要；条件 UPDATE 足够）。
2. `UPDATE organization_member SET last_used_at = clock_timestamp() WHERE organization_id = $1 AND user_id = app.current_user_id()`。
3. 影响行数为 0 → 返回「不存在或无权」，不泄漏组织存在性。

## 5. 邀请

沿用 `docs/.../schema.md` §5.3：

- `invite.status`：`pending → accepted` 或 `pending → revoked`；`accepted_at` / `revoked_at` 与状态双蕴含。
- `token_hash bytea NOT NULL`，`sha256(token)`；明文 token 只在创建时返回一次；本批次不提供创建端点。
- `UNIQUE (token_hash)`；部分唯一索引 `uq_invite_pending_email (organization_id, email) WHERE status='pending'`。
- `expires_at > created_at`；邀请不能授予 owner。
- 兑换只经 `app.resolve_invite_by_token()` / `app.accept_invite()`；业务角色不直接更新 `invite`。
- 并发兑换用条件 UPDATE 抢占；邮箱一致性用 `IS DISTINCT FROM`，防止 NULL 邮箱绕过。

## 6. 审计

沿用 §5.22：

- `audit_log` 只追加；`organization_id NOT NULL`，组织级动作 `project_id IS NULL`。
- 强审计路径：`app.create_organization()`、`app.accept_invite()` 在同一事务内写 `audit_log`。
- 认证事件（注册、登录、登出）写结构化日志，不写 `audit_log`（未加入任何组织时 `organization_id` 不可得）；日志不得包含密码、会话令牌或邀请明文。

## 7. RLS 与权限（本批次四张表）

| 表 | 策略 | 业务角色权限 |
| --- | --- | --- |
| `organization` | `id = ANY (app.visible_org_array())` | `SELECT`；`UPDATE (name, status, updated_at)`；无 `INSERT` / `DELETE` / `UPDATE (owner_user_id)` |
| `organization_member` | `organization_id = ANY (app.visible_org_array())` | `SELECT`、`INSERT`、`UPDATE (role, last_used_at, updated_at)`、`DELETE` |
| `invite` | `organization_id = ANY (app.visible_org_array())` | `SELECT`、`INSERT`；无 `UPDATE` / `DELETE`（状态只经受控函数） |
| `audit_log` | `organization_id = ANY (app.visible_org_array())` | `SELECT`、`INSERT`；无 `UPDATE` / `DELETE` |

- 四张表全部 `ENABLE` + `FORCE ROW LEVEL SECURITY`。
- `app.visible_org_array()` 与 `app.current_user_id()` 按 `docs/.../security.md` §8.3 实现；上下文缺失返回空数组，fail-closed。
- `rls_definer` 额外需要：`auth."user"(email)` 的 `SELECT`（邀请邮箱一致性）、`organization_member` 的 `SELECT` / `INSERT` / `UPDATE (role, last_used_at, updated_at)`、`organization` 的 `SELECT` / `INSERT`、`invite` 的 `SELECT` / `UPDATE (status, accepted_at, revoked_at, updated_at)`、`audit_log` 的 `INSERT`。
- 不把 `auth` schema 的任何权限授予 `genealogy_app`；Better Auth 使用独立 `auth_runtime` 连接。

## 8. 注册编排的数据状态

注册请求内的状态序列：

```text
无账号
  └─(signUpEmail 成功)─> 有账号 + 会话 + 无组织
       ├─(有效邀请且邮箱一致)─> 有账号 + 选中的邀请组织成员（last_used_at=now）
       ├─(无邀请 / 邀请无效)─> 有账号 + 个人默认组织 owner（last_used_at=now）
       └─(默认组织创建失败)─> 补偿删除账号、会话与账号凭证 → 无账号
```

- 补偿顺序：`auth.session` → `auth.account` → `auth.user`。
- 补偿失败必须响亮记录并返回 `500`，不得把注册报告为成功；失败日志带 `request_id` 与用户 id 掩码，便于人工清理。
- 邀请失败不触发补偿；注册成功，响应中说明邀请未生效。
- 并发同邮箱注册由 `auth.user.email` 唯一索引兜底，只有一个成功。

## 9. 校验规则映射

| 规格 | 执行者 |
| --- | --- |
| 邮箱唯一、去空白、转小写 | 服务层规范化 + `auth.user.email` 唯一索引 |
| 密码 ≥ 8 字符 | Zod schema + Better Auth `minPasswordLength` |
| 密码不可还原、不进日志 | Better Auth 哈希 + 日志字段裁剪 + 测试断言 |
| 注册与默认组织一致 | 编排服务 + 补偿删除 + 集成测试 |
| 默认组织顺序 | 4.3 查询 + 集成测试 |
| 归档组织不作为默认 | `o.status = 'active'` + 集成测试 |
| 邀请只能兑换一次 | `app.accept_invite()` 条件 UPDATE + 集成测试 |
| 邮箱一致性 | `app.accept_invite()` 的 `IS DISTINCT FROM` + 集成测试 |
| 登录失败限流 | 中间件 + 时间窗口用例 |
| 租户隔离 | 四张表的 RLS + 跨租户集成测试 |

## 10. 需要回写 `docs/` 的最小改动

1. `docs/architecture/data/schema.md` §5.2：`organization_member` 增加 `last_used_at`，并说明 `updated_at` 触发器的含义。
2. `docs/architecture/data/security.md` §8.4 / §8.5：增加 `last_used_at` 列级授权；`rls_definer` 增加 `auth."user"(email)` 读取。
3. `docs/architecture/data/errors.md` §9.4：增加 `23505` + 认证邮箱唯一约束 → 409 的映射。
4. `docs/architecture/data/invariants.md` §7.2：登记「`last_used_at` 只由当前用户自己的成员行更新」为软约束，并补测试。
5. `docs/architecture/api/endpoints.md` §2.1 / §2.2：本批次端点已随 C8 定值登记；实现若偏离文档形状，必须回写并重新跑文档门禁。
