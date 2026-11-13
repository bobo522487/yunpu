# 租户隔离与安全（RLS）

> 本文件是「RLS 策略、租户谓词、角色与权限矩阵」的唯一权威；其他主题见 `docs/README.md` 导航，同一主题不复制表格。

## 8. RLS、角色与权限

### 8.1 角色

| 角色 | 职责 |
|---|---|
| 迁移角色 | 创建/修改 schema、表、索引、策略、函数、触发器；只用于迁移 |
| `genealogy_app` | 业务 API 数据库角色；非表 owner，无 `BYPASSRLS` |
| `genealogy_api` | 登录角色；只被授予 `genealogy_app`，无直接表权限；连接后 `SET LOCAL ROLE genealogy_app` |
| `rls_definer` | `NOLOGIN BYPASSRLS`；`SECURITY DEFINER` 函数的属主 |
| `auth_service` / `auth_runtime` | Better Auth 专用连接；不与业务连接共用 |

### 8.2 租户谓词

```sql
CREATE POLICY tenant_isolation ON person
  AS PERMISSIVE FOR ALL TO genealogy_app
  USING      (organization_id = ANY (app.visible_org_array()))
  WITH CHECK (organization_id = ANY (app.visible_org_array()));
```

要点：

1. **谓词必须写成 `= ANY (app.visible_org_array())`，不能写 `= ANY ((SELECT app.visible_org_array()))`**。后者会被 PostgreSQL 解析为**表子查询**比较而非标量数组表达式，预期（待验证）报 `42883 operator does not exist: uuid = uuid[]`（§17 #05）——**核心租户谓词直接无法执行**。正确写法会被常量折叠为 InitPlan 求值一次（§17 #06）。
2. `FORCE ROW LEVEL SECURITY`：表 owner 也受策略约束。业务连接必须用非 owner 角色。
3. 上下文缺失时返回 `'{}'::uuid[]`，默认拒绝，不报错、不返回全表（`DM-RLS-01`）。
4. `organization` 表自身用 `id = ANY (...)`。
5. **所有业务表都启用 `ENABLE` + `FORCE ROW LEVEL SECURITY`**（`DM-RLS-02`）。1.1 版只给了 `person` 的样例策略，没有逐表矩阵——审计表与邀请表一旦漏掉策略就是跨租户泄露。v1.2 把策略矩阵变成生成物 `db/generated/rls_policies.sql`，并由 `db/verify/rls.sql` 逐表断言。

**逐表策略矩阵（v1.2 完整化）**：

| 表 | 策略谓词 | 备注 |
|---|---|---|
| `organization` | `id = ANY (...)` | 作用域是组织本身 |
| `organization_member` | `organization_id = ANY (...)` | |
| `invite` | `organization_id = ANY (...)` | 非成员看不到邀请；解析靠 `SECURITY DEFINER` 函数 |
| `project` | `organization_id = ANY (...)` | |
| `folder` / `person` / `person_name` / `person_relation` / `event` / `lineage` / `node` / `source` / `source_citation` / `article` / `article_page` / `media_asset` / `person_media` / `article_page_media` / `book` / `book_catalog` / `book_release` | `organization_id = ANY (...)` | 全部 18 张内容表同策略 |
| `audit_log` | `organization_id = ANY (...)` | 组织级审计 `project_id IS NULL` 仍受 `organization_id` 约束 |

> **表数与策略数的唯一口径**：`pg_tables` 共 22 张表 = 18 张内容表（上表合并行 17 张 + `project`） + 4 张平台/租户表（`organization` / `organization_member` / `invite` / `audit_log`），逐表清单见 [`schema.md`](./schema.md) §3.1。`db/verify/rls.sql` 断言 22 张表全部 `rowsecurity = true` 且 `forcerowsecurity = true`，并断言策略数 = 21（`organization_member` 采用独立策略形式，见 [`migrations.md`](./migrations.md) §12.3）。18 与 21 不是同一个计数维度，不构成矛盾。

> **索引策略的唯一说法**（`DM-IDX-01`）：索引按**查询模式**建，不设「RLS 谓词列必须是索引首列」这类机械规则。理由：`organization_id` 由 `project_id` 经复合外键强制推出，查询永远先按 project 收敛；RLS 的 org 谓词是安全网，不是访问路径。**本规则取代旧版「谓词列必须是首列」的表述，全文以本条为准。**
>
> **PG 18 补充**：多列 B-tree 现在支持 skip scan（§2.1 #7），因此 `(project_id, X)` 这类索引在 `project_id` 未被约束时也可能被用于 `X` 的查找。索引清单无需因此改动，但**测量方法**要变（§11.4）。

请求事务内设置上下文：

```sql
SET LOCAL ROLE genealogy_app;
SELECT set_config('app.user_id', $1, true);
```

`set_config(..., true)` 的 `is_local` 必须是 `true`；连接池复用不得继承上一个事务的上下文。

**v1.2 补充两条 fail-closed 纪律**：

1. **上下文解析必须容错**。`app.current_user_id()` 统一解析 `app.user_id`：GUC 为空 → 返回 NULL；GUC 不是合法 UUID → 捕获 `22P02` 并返回 NULL。**不得**让非法 GUC 直接抛错——那会变成 500 而不是「拒绝访问」。两种情况的结果一致：无可见组织。
2. **每事务开始断言角色**。`SET LOCAL ROLE genealogy_app` 失败不会使事务中止，只是不生效。因此每个事务入口必须断言 `current_user = 'genealogy_app'`，否则请求会在错误的权限下执行。

### 8.3 `app.visible_org_array()`

```sql
CREATE FUNCTION app.current_user_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_raw text;
BEGIN
  v_raw := NULLIF(current_setting('app.user_id', true), '');
  IF v_raw IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN v_raw::uuid;
EXCEPTION WHEN invalid_text_representation THEN
END;
$$;

CREATE FUNCTION app.visible_org_array()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT COALESCE(array_agg(om.organization_id), '{}'::uuid[])
  FROM public.organization_member om
  WHERE om.user_id = app.current_user_id()
$$;
```

- 属主 `rls_definer`，`BYPASSRLS`，`NOLOGIN`。
- 显式 `public.organization_member`，不依赖 `search_path`。
- `REVOKE ALL ON FUNCTION app.visible_org_array() FROM PUBLIC;`
- `GRANT EXECUTE ... TO genealogy_app;`
- `rls_definer` 必须拥有 `public` schema 的 `USAGE` 和 `organization_member` 的 `SELECT`。
- `app.current_user_id()` 为 `INVOKER` 权限的 `STABLE` 函数，**不要**加 `SECURITY DEFINER`——它只读 GUC，不需要绕过任何东西。

### 8.4 权限矩阵（`genealogy_app`）

| 表 | 权限 |
|---|---|
| `organization` | `SELECT`；`UPDATE (name, status, updated_at)`；**无** `INSERT` / `DELETE`；**无** `UPDATE (owner_user_id)` |
| `organization_member` | `SELECT`、`INSERT`、`UPDATE (role, updated_at)`、`DELETE` |
| `invite` | `SELECT`、`INSERT`；**无** `UPDATE` / `DELETE`（v1.2 变更，见下） |
| `project`、`folder` | `SELECT`、`INSERT`、`UPDATE`、`DELETE` |
| `person`、`person_name`、`person_relation`、`event` | 全 DML |
| `lineage`、`node` | 全 DML |
| `source`、`source_citation` | 全 DML |
| `article`、`article_page` | 全 DML |
| `media_asset`、`person_media`、`article_page_media` | 全 DML |
| `book`、`book_catalog` | 全 DML |
| `book_release` | `SELECT`、`INSERT`；**无** `UPDATE` / `DELETE` |
| `audit_log` | `SELECT`、`INSERT`；**无** `UPDATE` / `DELETE` |

- 业务角色没有 `CREATE` on schema；没有 `TRUNCATE`；没有 `BYPASSRLS`。
- 列级 `UPDATE` 授权必须包含 `updated_at`，否则 `app.touch_updated_at()` 触发器会因列权限失败；本表已显式列出。
- `organization.owner_user_id` 只能由 `app.transfer_organization_ownership()` 修改。
- `invite.token_hash` 不可更新：不在列级 `UPDATE` 白名单内。

> **v1.2 变更（`invite`）**：1.1 版给了 `genealogy_app` `UPDATE (status, accepted_at, revoked_at, updated_at)`。这等于开了一条旁路——业务代码只要能 UPDATE，就可以把任意 `pending` 邀请直接改成 `accepted` 并自行填 `accepted_at`，**完全绕过** `app.accept_invite()` 的邮箱一致性校验与并发抢占。v1.2 收回该权限，`invite` 的所有状态变更只经 `app.accept_invite()` / `app.revoke_invite()` 两个受控函数。

### 8.5 `rls_definer` 的权限清单（完整，`DM-PERM-01`）


`rls_definer` 是全系统唯一能合法绕过 RLS 的角色。它是 `SECURITY DEFINER` 函数的属主，权限必须**按函数最小化**，一份不多。

| 对象 | 权限 | 服务于 |
|---|---|---|
| `public.organization` | `SELECT` | `create_organization` / `transfer_ownership` 读 owner |
| | `INSERT (id, name, status, owner_user_id, created_at, updated_at)` | `create_organization` |
| | `UPDATE (owner_user_id, updated_at)` | `transfer_organization_ownership` |
| `public.organization_member` | `SELECT` | `visible_org_array`、`create_organization`、`transfer_ownership`、`accept_invite` |
| | `INSERT` | `create_organization`、`accept_invite` |
| | `UPDATE (role, updated_at)` | `transfer_ownership`、`accept_invite` |
| `public.invite` | `SELECT` | `resolve_invite_by_token`、`accept_invite`、`revoke_invite` |
| | `UPDATE (status, accepted_at, revoked_at, updated_at)` | `accept_invite` 抢占兑换、`revoke_invite` |
| `public.book_release` | `SELECT` | `revoke_book_release`、`purge_book_release` |
| | `UPDATE (revoked_at, revoked_reason)` | `revoke_book_release` |
| | `DELETE` | `purge_book_release` |
| `public.audit_log` | `INSERT` | 全部强审计路径 |
| `public` schema | `USAGE` | 全部函数 |
| `app.visible_org_array()` | `EXECUTE`（函数自身） | — |

**没有授予**：`rls_definer` 不持有 `person`、`node`、`article`、`media_asset` 等业务表的任何权限；不持有 `TRUNCATE`；不持有 `CREATE`；不持有 `book_catalog`、`source_citation` 的写权限。受控函数一律通过业务角色已有的权限路径工作，或显式声明新增项。

> **v1.2 变更：`transfer_organization_ownership` 改用 CAS，不再用 `SELECT ... FOR NO KEY UPDATE`。**
>
> 原因：`SELECT ... FOR NO KEY UPDATE` 需要**表级** `UPDATE` 权限，而 `rls_definer` 只有列级 `UPDATE (owner_user_id, updated_at)`。两者不匹配。
>
> 替代方案：先普通 `SELECT` 读出当前 owner，再用**条件更新**做乐观并发控制：
>
> ```sql
> UPDATE organization
>    SET owner_user_id = p_new_owner, updated_at = clock_timestamp()
>  WHERE id = p_org AND owner_user_id = v_prev;   -- CAS
> ```
>
> 影响行数为 0 → 说明并发下已被别人转移 → 抛 `GX010`。这个写法**不需要行锁、不需要额外权限**，并发语义与原来的 `FOR NO KEY UPDATE` 等价（两个并发事务只有一个能命中条件更新）。
>
> **注意**：CAS 只保护 `organization` 一行。真正需要串行化的是「读 owner → 校验 → 写 owner」这一整段；`UPDATE ... WHERE owner_user_id = v_prev` 把校验与写入合并成一条原子语句，因此不需要显式锁。

### 8.6 安全边界

- 自定义 GUC 是应用连接可设置的上下文，不是数据库认证身份。持有业务凭据且能执行任意 SQL 的攻击者可以伪造 `app.user_id`；RLS 降低遗漏租户条件的风险，但不能单独抵御凭据失陷。
- `SECURITY DEFINER` 函数必须以 `rls_definer` 为属主，`SET search_path = pg_catalog`，所有对象 schema-qualified，撤销 `PUBLIC` 执行权限。
- 视图必须 `security_invoker = true`。
- 超级用户和 `BYPASSRLS` 角色始终绕过 RLS；它们只用于迁移、备份和函数属主，不作为业务连接。

---

---
