# Contract: 邀请兑换

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md) | **Date**: 2026-11-14

本批次不提供邀请创建端点。邀请的生成、列表与撤销属于组织模块；本文件只定义「已有邀请如何被消费并落到默认组织」。邀请数据规则以 [`docs/architecture/data/schema.md`](../../../docs/architecture/data/schema.md) §5.3（`DM-INV-01`~`05`）为准。

## 1. 注册时携带邀请

`POST /api/v1/auth/sign-up` 的可选字段 `inviteToken` 见 [auth-api.md](auth-api.md) §2。

处理顺序：

1. 创建认证账号与会话。
2. 若 `inviteToken` 存在，计算 `sha256(token)` 并调用 `app.accept_invite(token)`。
3. 成功：账号成为邀请组织成员，默认组织为邀请组织；不创建个人组织；`invite.accepted = true`。
4. 失败：不删除账号，按无邀请注册创建个人默认组织；`invite.accepted = false`，`invite.reason` 取值见下表。

| `invite.reason` | 触发 | 注册结果 |
| --- | --- | --- |
| `email_mismatch` | 当前账号邮箱与邀请邮箱不一致（含 NULL 安全比较） | 成功，邀请未兑换，创建个人组织 |
| `expired` | `expires_at <= now()` | 成功，邀请未兑换，创建个人组织 |
| `revoked` | `status = 'revoked'` | 成功，邀请未兑换，创建个人组织 |
| `already_used` | `status = 'accepted'` 或并发抢占失败 | 成功，邀请未兑换，创建个人组织 |

- 邀请兑换失败不得导致注册失败（`FR-017`）。
- 提示文案只说明「邀请不可用 / 与当前邮箱不匹配」，不泄露邀请属于哪个组织或邀请给谁。

## 2. `POST /api/v1/invites/accept`

已登录账号接受邀请。需要登录。

**Request body**

```json
{ "token": "邀请明文 token" }
```

**Success `200`**

```json
{
  "ok": true,
  "data": {
    "organization": { "id": "uuid", "name": "组织名", "role": "editor", "isOwner": false },
    "defaultOrganizationChanged": true
  }
}
```

- 成功后把该成员行的 `last_used_at` 置为当前时间，使下次登录进入邀请组织。
- 若账号已经是该组织成员，返回当前角色并更新 `last_used_at`；邀请仍按规则标记为已兑换（仅一次）。
- 角色取邀请的 `role`；邀请不能授予 owner。

**Errors**

| 状态 | code | 场景 |
| --- | --- | --- |
| `400` | `VALIDATION` | token 为空或格式非法 |
| `401` | `UNAUTHORIZED` | 无会话 |
| `403` | `INVITE_EMAIL_MISMATCH` | 当前账号邮箱与邀请邮箱不一致（`GX009`） |
| `404` | `TARGET_INVALID` | token 不存在、已过期、已撤销（`GX005`） |
| `409` | `CONCURRENT_MODIFICATION` | 并发兑换失败，邀请已被使用（`GX010`） |

## 3. 并发与一次性

- 兑换使用条件更新抢占：`UPDATE invite SET status='accepted', accepted_at=now() WHERE ... AND status='pending' ... RETURNING id`。
- 只有抢占成功的一方能插入成员关系；其余返回 `GX010`。
- 同一邀请不得产生第二条成员关系；已存在成员时按「已加入」处理，不重复插入。
- 邀请邮箱一致性使用 `IS DISTINCT FROM`；登录用户邮箱为 NULL 时也必须判为不一致。

## 4. 审计与日志

- `app.accept_invite()` 在同一事务内写 `audit_log`，`project_id IS NULL`。
- 审计与日志不得包含邀请明文 token；只记录 `invite_id`、`organization_id`、结果。
