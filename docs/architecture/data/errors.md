# 错误码、SQLSTATE 与用户文案

> 本文件是「错误码 → SQLSTATE/约束名 → HTTP/文案唯一映射」的唯一权威；其他主题见 `docs/README.md` 导航，同一主题不复制表格。

### 4.6 约束名与错误码

触发器使用自定义 SQLSTATE，应用按码映射，不解析中文消息：

| SQLSTATE | 含义 | 触发点 |
|---|---|---|
| `GX001` | 世系关系会形成祖先环路 | `app.check_ancestor_cycle()` |
| `GX002` | scope 不可迁移 | `app.guard_scope_immutable()` |
| `GX003` | 出版快照不可修改 | `app.guard_book_release_snapshot()` |
| `GX004` | 审计日志只可追加 | `app.guard_append_only()` |
| `GX005` | 邀请无效或已过期 / 目标不存在 | `app.resolve_invite_by_token()` / `app.accept_invite()` / `app.revoke_invite()` |
| `GX006` | 权限不足（仅 owner / 仅 admin） | `app.purge_book_release()` / `app.transfer_organization_ownership()` |
| `GX007` | 出版版本尚未作废，不能清除 | `app.purge_book_release()` |
| `GX008` | 组织创建缺少已认证用户上下文 | `app.create_organization()` |
| `GX009` | 邀请邮箱与当前登录用户邮箱不一致 | `app.accept_invite()` |
| `GX010` | 并发抢占失败（邀请已被兑换 / 所有权已被并发转移） | `app.accept_invite()` / `app.transfer_organization_ownership()` |
| `GX011` | 出版产物字节缺失，状态不一致 | `app.purge_book_release()` |

**原生 SQLSTATE（v1.2 按 PG 18 修正，`DM-GEN-18`）**：

| SQLSTATE | 含义 | **v1.2 变更** |
|---|---|---|
| `23505` | `unique_violation` | 不变 |
| `23503` | `foreign_key_violation` | **仅**表示 `NO ACTION` / `SET NULL` / `SET DEFAULT` 动作下的引用违规 |
| `23001` | `restrict_violation` | **`ON DELETE RESTRICT` 的专属码**。PG 18 起 RESTRICT 不再报 `23503`（§2.1 #2，待验证 #02） |
| `23514` | `check_violation` | 不变 |
| `42501` | `insufficient_privilege` | 权限不足（不是约束错误，不进约束名匹配分支） |
| `22P02` | `invalid_text_representation` | 输入格式错误（如非法 UUID 字符串） |
| `55P03` | `lock_not_available` | 拿不到 advisory lock（`lock_timeout` 触发） |
| `57014` | `query_canceled` | `statement_timeout` 触发 |

> **1.1 版的错误**：「唯一、外键、CHECK 错误沿用原生 `23505` / `23503` / `23514` / `23001`」把 `23001` 和 `23503` 并列而未区分触发条件。按 PG 18 官方文档推导（待验证），`ON DELETE RESTRICT` 与普通外键违规是**两个不同的码**。应用若把两者合并处理，就无法区分「引用了被保护的对象」和「级联动作被拒」。
>
> 错误映射按「SQLSTATE → 约束名 → 文案」两级解析（[`overview.md`](../overview.md) §8.3），**不解析中文消息**（`DM-GEN-18`）。

---

### 9.4 错误码到应用错误的映射

应用侧错误映射表（[`overview.md`](../overview.md) §8.3 引用本文 §4.6）。**只按 SQLSTATE + 约束名匹配，不解析消息文本**（`DM-GEN-18`）。

| SQLSTATE | 约束名 / 场景 | 应用错误 | HTTP | 用户可见文案 |
|---|---|---|---|---|
| `23505` | `uq_person_name_primary` | `DUPLICATE_PRIMARY_NAME` | 409 | 该人物已有主姓名 |
| `23505` | `uq_invite_pending_email` | `INVITE_ALREADY_PENDING` | 409 | 该邮箱已有待处理邀请 |
| `23505` | `uk_person_relation_kind` | `RELATION_DUPLICATE` | 409 | 这条关系已存在 |
| `23503` | `fk_node_parent` | `NODE_PARENT_MISSING` | 409 | 父节点不存在或在同一事务中被移动 |
| `23503` | `fk_*_project` | `PROJECT_SCOPE_VIOLATION` | 409 | 记录不属于该谱项目 |
| `23503` | `fk_book_release_book` | `BOOK_HAS_RELEASE` | 409 | 谱书仍有出版版本，请先清除 |
| `23001` | `fk_organization_owner` | `OWNER_MEMBER_REQUIRED` | 409 | 不能删除组织所有者成员行 |
| `23514` | `ck_person_relation_not_self` | `SELF_RELATION` | 400 | 关系两端不能是同一人 |
| `23514` | `ck_person_relation_symmetric_order` | `SYMMETRIC_ORDER` | 400 | 对称关系需按规范顺序存储 |
| `23514` | `ck_event_subject_xor` | `EVENT_SUBJECT_INVALID` | 400 | 事件必须且只能关联人物或关系之一 |
| `23514` | `ck_*_not_blank` | `BLANK_TEXT` | 400 | 内容不能为空白 |
| `GX001` | 祖先环 | `LINEAGE_CYCLE` | 409 | 会形成祖先环路 |
| `GX002` | scope 不可迁移 | `SCOPE_IMMUTABLE` | 409 | 不能跨项目移动记录 |
| `GX003` | 快照不可改 | `SNAPSHOT_IMMUTABLE` | 409 | 出版快照不可修改 |
| `GX004` | 审计只追加 | `APPEND_ONLY` | 409 | 审计日志不可修改或删除 |
| `GX005` | 邀请/出版目标无效 | `TARGET_INVALID` | 404 | 目标不存在或已失效 |
| `GX006` | 权限不足（函数内） | `FORBIDDEN` | 403 | 无权执行该操作 |
| `GX007` | 状态机不允许 | `INVALID_STATE` | 409 | 当前状态不允许该操作 |
| `GX008` | 缺少认证上下文 | `NO_AUTH_CONTEXT` | 401 | 请求缺少认证上下文 |
| `GX009` | 邮箱不一致 | `INVITE_EMAIL_MISMATCH` | 403 | 邀请邮箱与当前账号不匹配 |
| `GX010` | 并发抢占失败 | `CONCURRENT_MODIFICATION` | 409 | 操作已被并发请求抢先，请重试 |
| `GX011` | 产物字节缺失 | `ARTIFACT_MISSING` | 500 | 出版产物缺失，请联系管理员 |
| `22P02` | 输入格式错误 | `INVALID_INPUT` | 400 | 参数格式错误 |
| `55P03` | advisory lock 超时 | `LOCK_TIMEOUT` | 503 | 系统繁忙，请重试 |
| `57014` | 语句超时 | `STATEMENT_TIMEOUT` | 503 | 查询超时，请缩小范围 |
| `42501` | 权限不足（原生） | `FORBIDDEN` | 403 | 无权访问该资源 |

> **`23001` 与 `23503` 必须分开**（v1.2 修正，§2.1 #2）。合并处理会导致「引用了被保护的对象」和「级联动作被拒」返回同一个错误，用户看到「无法删除」却不知道是保护机制在起作用还是数据有问题。

---
