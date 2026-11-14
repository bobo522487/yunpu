# Contract: 默认组织解析与切换

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md) | **Date**: 2026-11-14

本文件定义「登录后进入哪个组织」的解析规则，以及用户主动切换组织的接口。数据存储见 [data-model.md](../data-model.md) §4。

## 1. 默认组织解析

对当前登录账号 `u`，在所有满足以下条件的组织中选一个：

1. `u` 是该组织成员；
2. 组织 `status = 'active'`。

排序：

1. `organization_member.last_used_at` 降序（`NULLS LAST`）；
2. `organization_member.created_at` 升序；
3. `organization.id` 升序（仅用于稳定结果）。

判定：

| 情况 | 结果 |
| --- | --- |
| 至少一个 active 成员关系 | 排序第一的组织为默认组织 |
| 没有 active 成员关系 | `defaultOrganization = null`，`onboarding = true` |
| 上次使用的组织已归档 | 跳过该组织，继续按排序选择下一个 active 组织 |
| 上次使用的组织成员关系已消失 | 同上，跳过 |
| 账号从未切换过组织 | 回退到最早加入的 active 组织 |

解析在每次登录、`GET /api/v1/auth/session` 与切换组织后执行；不缓存默认组织。

## 2. `GET /api/v1/organizations`

返回当前账号可进入的组织列表。需要登录。

**Success `200`**

```json
{
  "ok": true,
  "data": {
    "organizations": [
      { "id": "uuid", "name": "组织 A", "role": "admin", "isOwner": true, "lastUsedAt": "2026-11-14T12:00:00Z" },
      { "id": "uuid", "name": "组织 B", "role": "viewer", "isOwner": false, "lastUsedAt": null }
    ],
    "defaultOrganizationId": "uuid"
  }
}
```

- 只返回 `active` 组织；归档组织不在列表中。
- 排序与默认组织解析一致（最近使用优先，其次最早加入）。
- `defaultOrganizationId` 为解析结果，可能为 `null`。

**Errors**: `401 UNAUTHORIZED`。

## 3. `POST /api/v1/organizations`

创建一个新组织，创建者成为唯一 owner 与 `admin` 成员。需要登录。

**Request body**

```json
{ "name": "第二组织" }
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `name` | string | 是 | 去除首尾空白后不得为空；允许重名 |

**Success `201`**

```json
{
  "ok": true,
  "data": {
    "organization": { "id": "uuid", "name": "第二组织", "role": "admin", "isOwner": true }
  }
}
```

- 通过受控函数 `app.create_organization(name)` 在同一事务内插入组织、owner 成员行与审计。
- 创建成功后把该成员行的 `last_used_at` 置为当前时间，使其成为下次登录的默认组织。
- 创建者始终是 owner；不接受客户端指定 owner 或角色。

**Errors**

| 状态 | code | 场景 |
| --- | --- | --- |
| `400` | `VALIDATION` | `name` 缺失或纯空白 |
| `401` | `UNAUTHORIZED` | 无会话 |
| `401` | `NO_AUTH_CONTEXT` | 数据库函数缺少 `app.user_id` 上下文（`GX008`） |

## 4. `POST /api/v1/organizations/:organizationId/activate`

把指定组织设为当前账号的默认组织。需要登录。

**路径参数**: `organizationId`（uuid）。

**Success `200`**

```json
{
  "ok": true,
  "data": {
    "organization": { "id": "uuid", "name": "组织 B", "role": "editor", "isOwner": false }
  }
}
```

**语义**

- 仅当当前账号是该组织成员且组织为 `active` 时成功。
- 成功后将该成员行的 `last_used_at` 置为当前时间；下一次登录（任意设备）进入该组织。
- 不改变成员角色、不改变其他成员行、不写 `audit_log`（不是强审计动作）。

**Errors**

| 状态 | code | 场景 |
| --- | --- | --- |
| `400` | `VALIDATION` | `organizationId` 不是合法 uuid |
| `401` | `UNAUTHORIZED` | 无会话 |
| `404` | `TARGET_INVALID` | 不是成员、组织不存在或已归档；三种情况使用一致提示，不泄漏存在性 |

## 5. 引导状态

当 `defaultOrganization = null` 时，登录后的页面显示引导状态：

- 提供「创建组织」入口，调用 `POST /api/v1/organizations`。
- 提供「接受邀请」入口（见 [invite-acceptance.md](invite-acceptance.md)）。
- 不自动创建组织；不把任何归档组织作为默认组织。

## 6. 边界

- 默认组织解析不接受客户端传入的 `organizationId` 作为隔离依据；租户上下文始终由当前会话用户推导。
- 组织切换不改变 RLS 的可见范围定义；可见范围只由成员关系决定。
- 同一账号在多台设备并发切换时，以最后一次成功写入的 `last_used_at` 为准；不实时推送其他已打开页面。
