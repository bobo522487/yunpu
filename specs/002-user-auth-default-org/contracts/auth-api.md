# Contract: 认证 API

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md) | **Date**: 2026-11-14

本文件定义本批次对外暴露的认证接口。错误响应体沿用 [`docs/architecture/runtime.md`](../../../docs/architecture/runtime.md) §8.3：成功 `{ ok: true, data }`，失败 `{ ok: false, code, message, details? }`。状态码不超出 `C2` 的集合；限流返回 `429`（`RATE_LIMITED`）。

## 1. 通用约定

- 邮箱在服务端去除首尾空白并转为小写后再用于唯一性与查询。
- 密码最小长度 8；不接受空密码或纯空白密码。
- 会话通过 `Set-Cookie` 下发；Cookie 为 HttpOnly、SameSite=Lax，生产环境 Secure。
- 认证响应不得包含密码、哈希、会话 token 或邀请明文。
- 未登录访问需要登录的端点返回 `401`，响应体 `code = "UNAUTHORIZED"`，不返回任何组织数据。

## 2. `POST /api/v1/auth/sign-up`

注册。公开端点。

**Request body**

```json
{
  "email": "user@example.com",
  "password": "至少8个字符",
  "inviteToken": "可选，邀请明文 token"
}
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `email` | string | 是 | 规范化后必须唯一 |
| `password` | string | 是 | 长度 ≥ 8 |
| `inviteToken` | string | 否 | 来自邀请链接；只在注册请求内使用，不落库 |

**Success `201`**

```json
{
  "ok": true,
  "data": {
    "user": { "id": "uuid", "email": "user@example.com", "name": "user" },
    "defaultOrganization": {
      "id": "uuid",
      "name": "user 的组织",
      "role": "admin",
      "isOwner": true
    },
    "invite": { "accepted": true }
  }
}
```

- 未携带邀请或邀请无效：`defaultOrganization` 为新建的个人组织，`invite.accepted = false`，`invite.reason` 取 `expired` / `revoked` / `already_used` / `email_mismatch` 之一。
- 邀请有效且邮箱一致：不创建个人组织，`defaultOrganization` 为邀请组织，`role` 为邀请拟授予的角色，`isOwner = false`。
- 响应同时下发会话 Cookie；客户端不需要再次登录。

**Errors**

| 状态 | code | 场景 |
| --- | --- | --- |
| `400` | `VALIDATION` | 邮箱格式非法、密码不足 8 位、字段缺失 |
| `409` | `CONFLICT` | 规范化后的邮箱已存在 |
| `429` | `RATE_LIMITED` | 平台统一限流触发（本端点不做邮箱组合限流） |
| `500` | `INTERNAL` | 默认组织创建失败且补偿完成；响应后不留下半成品账号 |

## 3. `POST /api/v1/auth/sign-in`

登录。公开端点；受登录失败限流保护。

**Request body**

```json
{ "email": "user@example.com", "password": "..." }
```

**Success `200`**

```json
{
  "ok": true,
  "data": {
    "user": { "id": "uuid", "email": "user@example.com", "name": "user" },
    "defaultOrganization": {
      "id": "uuid",
      "name": "组织名",
      "role": "admin",
      "isOwner": true
    },
    "onboarding": false
  }
}
```

- `defaultOrganization` 按 [organization-selection.md](organization-selection.md) 解析。
- 用户没有任何 active 组织时，`defaultOrganization = null`，`onboarding = true`。
- 登录成功不得重置其他设备的会话。

**Errors**

| 状态 | code | 场景 |
| --- | --- | --- |
| `400` | `VALIDATION` | 字段缺失或格式非法 |
| `401` | `UNAUTHORIZED` | 邮箱不存在或密码错误；两种情况使用完全一致的提示 |
| `429` | `RATE_LIMITED` | 同一「规范化邮箱 + 来源地址」连续失败 5 次后，15 分钟窗口内 |
| `500` | `INTERNAL` | 未识别错误 |

**限流语义**

- 只统计凭证校验失败；参数校验失败不计数。
- 成功登录立即清零该组合的计数。
- 窗口结束自动解除，无需人工解锁。
- 限流响应不得区分邮箱是否存在。

## 4. `POST /api/v1/auth/sign-out`

登出当前会话。需要登录。

**Success `200`**

```json
{ "ok": true, "data": { "signedOut": true } }
```

- 只删除当前会话；同一账号在其他设备上的会话保持有效。
- 清除当前 Cookie。

**Errors**: `401 UNAUTHORIZED`（无会话）。

## 5. `GET /api/v1/auth/session`

读取当前会话与默认组织。公开端点，用于页面加载与前端引导。

**Success `200`（已登录）**

```json
{
  "ok": true,
  "data": {
    "user": { "id": "uuid", "email": "user@example.com", "name": "user" },
    "defaultOrganization": { "id": "uuid", "name": "组织名", "role": "admin", "isOwner": true },
    "onboarding": false
  }
}
```

**Success `200`（未登录）**

```json
{
  "ok": true,
  "data": { "user": null, "defaultOrganization": null, "onboarding": false }
}
```

- 未登录不返回 `401`，与 `runtime.md` §8.2 的「公开端点与受保护端点共用一条链」一致。
- 不返回会话 token。

## 6. 安全与日志

- 密码、会话 token、邀请明文不得出现在响应、日志或错误 `details` 中。
- 注册、登录、登出写结构化日志：`event`、`request_id`、`user_id`（可用时）、`organization_id`（可用时）、结果。
- 登录失败日志只记录规范化邮箱的哈希或掩码，不记录明文邮箱与密码。
