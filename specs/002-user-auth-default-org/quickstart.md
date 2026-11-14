# Quickstart: 用户注册、登录与默认组织

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-11-14

用于在实现完成后验证规格是否被满足。接口形状见 [contracts/auth-api.md](contracts/auth-api.md)、[contracts/organization-selection.md](contracts/organization-selection.md)、[contracts/invite-acceptance.md](contracts/invite-acceptance.md)；数据规则见 [data-model.md](data-model.md)。

## 前置条件

- Docker、pnpm 12.18.0、Bun 1.4.4 已安装。
- `pnpm install --frozen-lockfile` 成功。
- 测试环境已启动并完成迁移：

```bash
scripts/env.sh up test
pnpm db:migrate -- --env test
curl -s http://127.0.0.1:3010/api/ready
```

期望：`/api/ready` 的 `ok` 为 `true`，`version` 包含 `PostgreSQL 18`。

> 下面的请求默认打到测试环境 `http://127.0.0.1:3010`。开发环境把端口换成 `3000` 即可。

## 1. 注册并获得默认组织

```bash
curl -s -c /tmp/yunpu-a.cookies -X POST http://127.0.0.1:3010/api/v1/auth/sign-up \
  -H 'content-type: application/json' \
  -d '{"email":"owner@example.com","password":"correct-horse"}'
```

期望：

- 状态 `201`；`data.user.email` 为 `owner@example.com`。
- `data.defaultOrganization` 存在，`role` 为 `admin`，`isOwner` 为 `true`。
- `data.invite.accepted` 为 `false`（未携带邀请）。
- 响应头包含会话 `Set-Cookie`。

再访问工作区：

```bash
curl -s -b /tmp/yunpu-a.cookies http://127.0.0.1:3010/api/v1/auth/session
curl -s -b /tmp/yunpu-a.cookies http://127.0.0.1:3010/app | grep -q 'owner@example.com' && echo workspace-ok
```

期望：`defaultOrganization` 与注册响应一致；`user` 非空；`/app` 页面包含当前组织与账号信息。

## 2. 邮箱唯一与密码下限

```bash
curl -s -o /tmp/dup.json -w '%{http_code}\n' -X POST http://127.0.0.1:3010/api/v1/auth/sign-up \
  -H 'content-type: application/json' \
  -d '{"email":"OWNER@example.com ","password":"correct-horse"}'
```

期望：`409`，响应体 `code` 为 `CONFLICT`；数据库中没有第二条同邮箱用户。

```bash
curl -s -o /tmp/short.json -w '%{http_code}\n' -X POST http://127.0.0.1:3010/api/v1/auth/sign-up \
  -H 'content-type: application/json' \
  -d '{"email":"short@example.com","password":"short"}'
```

期望：`400`，`code` 为 `VALIDATION`；没有创建账号，也没有创建组织。

## 3. 登录、登出与会话

```bash
curl -s -c /tmp/yunpu-a2.cookies -X POST http://127.0.0.1:3010/api/v1/auth/sign-in \
  -H 'content-type: application/json' \
  -d '{"email":"owner@example.com","password":"correct-horse"}'
```

期望：`200`；`defaultOrganization.id` 与注册时相同；`onboarding` 为 `false`。

错误凭证：

```bash
curl -s -o /tmp/bad.json -w '%{http_code}\n' -X POST http://127.0.0.1:3010/api/v1/auth/sign-in \
  -H 'content-type: application/json' \
  -d '{"email":"owner@example.com","password":"wrong-password"}'
```

期望：`401`，`code` 为 `UNAUTHORIZED`。把邮箱换成 `nobody@example.com` 再试一次，提示必须完全一致。

登出只影响当前会话：

```bash
curl -s -b /tmp/yunpu-a.cookies -X POST http://127.0.0.1:3010/api/v1/auth/sign-out
curl -s -b /tmp/yunpu-a2.cookies http://127.0.0.1:3010/api/v1/auth/session
```

期望：第一个请求 `200`；第二个请求仍能读到 `user` 与默认组织。

## 4. 登录失败限流

对同一邮箱与同一来源地址连续提交 5 次错误密码，第 6 次：

```bash
for i in 1 2 3 4 5; do
  curl -s -o /dev/null -X POST http://127.0.0.1:3010/api/v1/auth/sign-in \
    -H 'content-type: application/json' \
    -d '{"email":"owner@example.com","password":"wrong-password"}'
done
curl -s -o /tmp/limited.json -w '%{http_code}\n' -X POST http://127.0.0.1:3010/api/v1/auth/sign-in \
  -H 'content-type: application/json' \
  -d '{"email":"owner@example.com","password":"correct-horse"}'
```

期望：第 6 次为 `429`，`code` 为 `RATE_LIMITED`；响应不区分邮箱是否存在。窗口结束（或重置测试环境）后，正确密码可以再次登录。

## 5. 多组织与跨设备默认组织

用当前会话创建第二组织：

```bash
curl -s -b /tmp/yunpu-a2.cookies -X POST http://127.0.0.1:3010/api/v1/organizations \
  -H 'content-type: application/json' \
  -d '{"name":"第二组织"}'
```

期望：状态 `201`；`data.organization.role` 为 `admin`，`isOwner` 为 `true`；该组织成为当前默认组织。随后再次激活第二组织，验证切换结果被持久化：

```bash
curl -s -b /tmp/yunpu-a2.cookies -X POST \
  http://127.0.0.1:3010/api/v1/organizations/<第二组织id>/activate
```

在新设备上登录（新的 cookie 文件），默认组织应为第二组织：

```bash
curl -s -c /tmp/yunpu-a3.cookies -X POST http://127.0.0.1:3010/api/v1/auth/sign-in \
  -H 'content-type: application/json' \
  -d '{"email":"owner@example.com","password":"correct-horse"}'
```

期望：`defaultOrganization.id` 为第二组织 id。

归档默认组织：

```bash
bun --env-file .env.test tests/auth/fixtures.ts archive-org --id <第二组织id>
curl -s -b /tmp/yunpu-a3.cookies http://127.0.0.1:3010/api/v1/auth/session
```

期望：默认组织跳过已归档组织；若没有其他 active 组织，`defaultOrganization` 为 `null` 且 `onboarding` 为 `true`。

## 6. 邀请注册与邮箱一致性

用夹具创建一个发给 `invitee@example.com` 的邀请：

```bash
bun --env-file .env.test tests/auth/fixtures.ts create-invite --org <第二组织id> --email invitee@example.com --role editor
```

期望：命令输出明文 token（只输出一次）。

```bash
curl -s -c /tmp/yunpu-invitee.cookies -X POST http://127.0.0.1:3010/api/v1/auth/sign-up \
  -H 'content-type: application/json' \
  -d '{"email":"invitee@example.com","password":"correct-horse","inviteToken":"<token>"}'
```

期望：`201`；`invite.accepted` 为 `true`；`defaultOrganization.id` 为邀请组织；没有创建个人组织。

用另一个邮箱携带同一 token 注册：

```bash
curl -s -X POST http://127.0.0.1:3010/api/v1/auth/sign-up \
  -H 'content-type: application/json' \
  -d '{"email":"other@example.com","password":"correct-horse","inviteToken":"<token>"}'
```

期望：注册成功；`invite.accepted` 为 `false`，`reason` 为 `email_mismatch` 或 `already_used`；`defaultOrganization` 为新建的个人组织。

## 7. 租户隔离

用 `owner@example.com` 的会话访问一个不属于自己的组织：

```bash
curl -s -o /tmp/foreign.json -w '%{http_code}\n' -b /tmp/yunpu-a3.cookies \
  -X POST http://127.0.0.1:3010/api/v1/organizations/<另一个用户的组织id>/activate
```

期望：`404`，`code` 为 `TARGET_INVALID`；响应不包含该组织的名称或成员信息。

```bash
curl -s -b /tmp/yunpu-invitee.cookies http://127.0.0.1:3010/api/v1/organizations
```

期望：只返回该账号自己的 active 组织，不含其他账号的组织。

## 8. 文档与测试门禁

```bash
pnpm test:auth
scripts/check-docs.sh --root docs --strict --baseline docs/.check-docs-baseline.txt
```

期望：两条命令退出码均为 0。若本批次按 [data-model.md](data-model.md) §10 回写了 `docs/`，文档门禁必须同时通过。

## 失败判据

出现以下任一情况即判定本功能未满足规格：

- 注册成功后 `defaultOrganization` 为空，或组织没有 owner。
- 同一邮箱出现两个账号，或大小写/空白差异被当成不同邮箱。
- 登录失败提示能区分「邮箱不存在」与「密码错误」。
- 登出导致其他设备会话失效，或会话存在绝对到期时间。
- 第 6 次失败未被限流，或窗口结束后无法自动恢复。
- 多组织用户换设备登录后进入的不是上次使用的组织。
- 已归档组织被解析为默认组织，或无组织时静默创建新组织。
- 邀请注册额外创建了个人组织，或邮箱不一致仍加入组织。
- 任何跨租户数据可见。
