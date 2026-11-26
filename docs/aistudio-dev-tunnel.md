# AI Studio 联调：同源 `/api` 代理 + Cloudflare 隧道

> 本文是**开发期联调运行手册**，不是架构变更。它保持 [ADR-0008](adr/ADR-0008-polyrepo-contract.md) 不变：前端仍在独立仓库 `yunpu-web`，本仓库只提供 `/api/*` JSON 服务。它**不**实现「把整套栈搬进 AI Studio + Cloud SQL」那个更大的目标（该目标仍待 A/B 决策）。

## 目标与已验证链路

让 AI Studio 预览里的 `yunpu-web` 通过**同源 `/api` 代理**访问本地后端，避免跨域 Cookie 问题：

```
浏览器 (AI Studio 预览 Origin)
  │  fetch('/api/...')  ← 同源，无 CORS 预检
  ▼
AI Studio Node 服务端 Vite server.proxy  →  https://yunpu-dev.t-plus.com.cn  (changeOrigin: true)
  ▼
Cloudflare 边缘  →  cloudflared 隧道 (podman, --network host)
  ▼
http://127.0.0.1:3001  ← 本地 Hono API (apps/api/src/index.ts)
  ▼
本地 PostgreSQL 18 + pgsty/silo (env.sh up development)
```

**隧道已打通并实测**（2026-11-26）：

```bash
curl -sS -o /dev/null -w '%{http_code}\n' \
  --resolve yunpu-dev.t-plus.com.cn:443:172.67.205.120 \
  https://yunpu-dev.t-plus.com.cn/api/health
# → 200；响应 {"ok":true,"checks":{"process":"up","database":"up"}}
# 响应头含 access-control-allow-credentials: true
```

- **当前生效的公网主机名是 `yunpu-dev.t-plus.com.cn`**（隧道 ingress 配置 version=9，只剩这一条路由 + `http_status:404`）。旧名 `yunpu.t-plus.com.cn` 已从 ingress 移除，Cloudflare DoH 仍返回旧记录 `152.32.252.221`、443 拒绝连接，勿再用。
- Cloudflare 边缘 IP：`172.67.205.120` / `104.21.52.240`（两者均实测 200）。新主机名在本机 DNS 也已正确返回这两个 IP。
- 旧 ISP DNS 缓存问题只影响已废弃的 `yunpu.t-plus.com.cn`；新名无需 `--resolve`，保留该写法只为可复现实测。AI Studio 位于 Google Cloud，不受本地 DNS 影响。
- `cloudflared` 容器：`podman run --network host --name cloudflared cloudflare/cloudflared:latest tunnel --no-autoupdate --protocol http2 run --token <TOKEN>`；Zero Trust 应用 Service URL 必须是 **`http://localhost:3001`**（`http`，不是 `https`，否则 `tls: first record does not look like a TLS handshake`）。API 只监听 `127.0.0.1:3001`，`--network host` 让容器可直接到达。
- **只需要 1 条 Published Application：`yunpu-dev.t-plus.com.cn → http://localhost:3001`。** 实测另外两条都是多余且有风险的：
  - `yunpu-dev-postgres.t-plus.com.cn → http://localhost:5432`：PostgreSQL 是 TCP 协议、不是 HTTP，实测 `HTTP 502`，cloudflared 日志 `EOF`；把 dev 数据库（模板示例口令）暴露公网毫无收益，应删除。
  - `yunpu-dev-mino.t-plus.com.cn → http://localhost:9000`：媒体走后端 `/api/media` 流式中转（无预签名 URL），前端不会直连对象存储；实测可见 `200`，但暴露 dev 存储同样无收益，应删除。
  - 需要直接从本机连 dev DB/S3 时用 `localhost:5432` / `localhost:9000`（`env.sh up development` 映射的宿主机端口），不要走隧道。

**整条链路已在本机用 Vite 实测通过**（不需要 AI Studio 即可复现）：

```bash
cd /home/bobo/Projects/yunpu-web
VITE_API_PROXY_TARGET=https://yunpu-dev.t-plus.com.cn VITE_ENABLE_MOCK=0 \
  node_modules/.bin/vite --port=3000 --host=127.0.0.1
# 另开一个终端：
curl -sS http://127.0.0.1:3000/api/health
# → 200 {"ok":true,"checks":{"process":"up","database":"up"}}
```

`127.0.0.1:3000/api/*` 是**同源**请求，由 Vite 的 `server.proxy` 转发到隧道再回本地 Hono，因此 Cookie 无 `Domain`、无预检。这条命令证明的正是 AI Studio 侧假设 1/2 要做的事——只是把"AI Studio 的 Node 服务端"换成了本机 Vite。若 AI Studio 里烟测第 3 条（S3）不过，先用这条命令确认后端侧没问题，再怀疑 AI Studio。

## 全局约束（照抄实际代码，勿凭印象改）

| 项 | 实际值 | 依据 |
| :-- | :-- | :-- |
| API 端口 | `3001`（不是 3000，3000 归 Vite） | `scripts/env.sh:89`、`.env.development:7` |
| 前端代理变量名 | `VITE_API_PROXY_TARGET`（不是 `API_PROXY_TARGET`） | `yunpu-web/vite.config.ts:7-25`、`yunpu-web/lib/apiMode.ts:8-12` |
| 关闭 mock | `VITE_ENABLE_MOCK=0`（有代理时 mock 本就不注册） | `yunpu-web/README.md:20-22`、`yunpu-web/features/auth/enableMock.ts:4-13` |
| CORS 来源 | `CORS_ORIGINS`，逗号分隔，**精确匹配**，无通配符 | `apps/api/src/app.ts:63-73`（`allowed.includes(origin)`） |
| Better Auth 信任来源 | `[BETTER_AUTH_URL, ...CORS_ORIGINS]`，**支持**通配符；但本项目的 `/api/v1/auth/*` 走 `auth.api.*` 服务端调用，不经过 Better Auth handler，故该白名单**实际不生效** | `apps/api/src/modules/auth/better-auth.ts:25`、`modules/auth/service.ts:51,140,189` |
| XFF 开关 | `TRUST_PROXY=true` 才读 `x-forwarded-for`，且只取**第一段**（可伪造）→ 隧道场景应保持 `false` | `apps/api/src/middleware/login-rate-limit.ts:144-152` |
| 环境文件 | `scripts/env.sh` 每次 `up` 重新生成 `.env.development`，手改会被覆盖 | `scripts/env.sh:263-296` |
| 进程启动 | `env -i HOME PATH node --env-file=...`，宿主 shell 变量**不会**进入 app | `scripts/env.sh:315-332` |

> ⚠️ 原「落地步骤.md」里的 `EXTRA_TRUSTED_ORIGINS` / `advanced.trustedProxyHeaders` / `API_PROXY_TARGET` / `http://localhost:3000` / `--allowed-mail` / 预签名 URL 说法均与当前代码不符，勿采用。对象存储走 `POST /api/media` + `GET /api/media/*` 流式中转（`apps/api/src/media.ts:53-132`），返回的是同源 `/api` 路径，不存在 `localhost` 预签名 URL。

## 步骤 1：后端——把联调参数交给 env.sh

新增了两个**仅 development 生效**的输入变量（本次已改 `scripts/env.sh`）：

- `YUNPU_DEV_CORS_ORIGINS` → 写入生成 `.env` 的 `CORS_ORIGINS`
- `YUNPU_DEV_TRUST_PROXY` → 写入生成 `.env` 的 `TRUST_PROXY`，只接受 `true` / `false`

`test` 环境的 `.env` 保持原样，现有测试基线不变。

```bash
# <PREVIEW_ORIGIN> 从 AI Studio 预览页 DevTools → Network → 任一请求的 Origin 头精确复制
# 实测形态：https://ais-dev-<hash>-<project>.us-west1.run.app（dev 预览）
#           https://ais-pre-<hash>-<project>.us-west1.run.app（共享预览）
# 可逗号分隔多个；本机 Vite 联调再额外带上 http://127.0.0.1:3000,http://localhost:3000
cd /home/bobo/Projects/yunpu

pnpm env down development   # 停掉旧进程；development 卷保留
YUNPU_DEV_CORS_ORIGINS='<PREVIEW_ORIGIN>,<SHARED_PREVIEW_ORIGIN>,http://127.0.0.1:3000,http://localhost:3000' \
  pnpm env up development   # 重新生成 .env 并启动新进程（关键：必须重启，见下）

grep -nE '^(TRUST_PROXY|CORS_ORIGINS)=' .env.development
# → TRUST_PROXY=false
# → CORS_ORIGINS=<PREVIEW_ORIGIN>,...
```

**多机联调（2026-11-26）**：第二台机器跑前端时，它自己的 AI Studio 预览域也在 `CORS_ORIGINS` 里逐个加进去；当前运行态共 6 个来源（两台机器各 dev/pre 两个域 + 本机 Vite 两个）：

```bash
cd /home/bobo/Projects/yunpu
CORS='http://127.0.0.1:3000,http://localhost:3000,https://ais-dev-wquyj2j6c3727rgv5drbun-568561774058.us-west1.run.app,https://ais-pre-wquyj2j6c3727rgv5drbun-568561774058.us-west1.run.app,https://ais-dev-jgb3v34infiklsdpwskq7v-434322240129.us-east1.run.app,https://ais-pre-jgb3v34infiklsdpwskq7v-434322240129.us-east1.run.app'
pnpm env down development
YUNPU_DEV_CORS_ORIGINS="$CORS" pnpm env up development
```

`down` 不需要带变量；但 `up` 必须重新给一遍，否则 `env.sh` 会把空值写进 `.env`。

**实测记录（2026-11-26）**：把两个 AI Studio 工作区的 `ais-dev-…run.app` / `ais-pre-…run.app` 都写入后，经隧道 `OPTIONS /api/health` 对 6 个来源逐个验证：
每个允许来源均 `204` + `access-control-allow-origin: <该来源>` + `access-control-allow-credentials: true`；`https://evil.example.com` → `204` 但**无** ACAO。
早先对 `GET /api/v1/auth/session` / `POST /api/v1/auth/sign-up` 的验证同样是 `200` / `201` + ACAO，sign-up 的 `set-cookie: better-auth.session_token=…; Path=/; HttpOnly; SameSite=Lax` 无 `Domain`。

`YUNPU_DEV_TRUST_PROXY` 保持缺省（`false`）。它只在你要验证"按真实客户端 IP 分桶"时才临时设为 `true`，理由见下一条。

**为什么必须重启**：`perform_up()` 在 development 已 ready 时只重写 `.env` 文件、不重启进程（`scripts/env.sh:379-384`）。环境变量在进程启动时由 `--env-file` 读取一次，改文件不会热生效。所以先 `down` 再 `up`。

- `CORS_ORIGINS` 必须**精确**：`app.ts:68` 用 `allowed.includes(origin)`，写 `https://*.ai.studio` 这类通配符对 CORS **无效**（通配符只被 Better Auth 的 `trustedOrigins` 接受，而本项目实际不走它的 handler，见"安全与回滚"）。同源代理路径下浏览器不触发预检，这一项主要是给"直连隧道排查"用的。
- **`TRUST_PROXY` 保持 `false`（默认）——这是实测结论，不要按直觉打开。** 隧道容器在 host 网络，socket 对端恒为 `127.0.0.1`，于是所有隧道访客共用一个 IP 桶。看似"打开 `TRUST_PROXY` 就能按真实 IP 分桶"，但 `login-rate-limit.ts:144-152` 取的是 `x-forwarded-for` 的**第一段**，而 Cloudflare 把真实客户端 IP 追加在**最右**，第一段由客户端自己写、完全可伪造：

  | 配置 | 伪造轮换 XFF 的连续失败登录 | 结论 |
  | :-- | :-- | :-- |
  | `TRUST_PROXY=true` | 7 次全部 401，**永不 429** | 限流被绕过 |
  | `TRUST_PROXY=false` | 第 6 次起 429 | 限流有效 |

  代价是所有人共用一个 `127.0.0.1` 桶：IP 桶 50 次/15 分钟，账号+来源对 5 次/15 分钟、账号桶 20 次且指数升级（`WINDOW_MS = 15 * 60 * 1000`）。单机联调够用；真要按真实 IP 分桶，得先把 `sourceAddress()` 改成读 `CF-Connecting-IP` 或 XFF **最后一段**，那是行为变更，需要单独决策 + 测试，不在联调配置里顺手改。

## 步骤 2：前端——AI Studio Secrets

在 AI Studio 项目 Settings → Secrets 增加（改名/新增后需重新部署预览）：

| Secret | 值 | 作用 |
| :-- | :-- | :-- |
| `VITE_API_PROXY_TARGET` | `https://yunpu-dev.t-plus.com.cn` | 打开 Vite `/api` 代理，同时关闭 direct-mock |
| `VITE_ENABLE_MOCK` | `0` | 显式关闭 mock，请求必须真实发出 |

**两项 AI Studio 假设 — 2026-11-26 已在容器内实测通过**：

1. AI Studio 的 Node 服务端确实执行 `vite.config.ts` 里的 `server.proxy`；
2. Secrets 在 Vite 配置求值阶段就已注入 `process.env`（`vite.config.ts:7` 读的是 `process.env` 而非 `import.meta.env`）。

实测证据（用户提供的 AI Studio 容器验证报告）：运行中 Vite 进程的环境变量含 `VITE_API_PROXY_TARGET=https://yunpu-dev.t-plus.com.cn` 与 `VITE_ENABLE_MOCK=0`，`import.meta.env` 两项均生效、direct-mock 已关闭；容器内无头浏览器访问 `http://127.0.0.1:3000/` 跳转 `/login?redirect=%2F`，发出的 `http://127.0.0.1:3000/api/v1/auth/session` 返回 `200` + `{"ok":true,"data":{"user":null,"defaultOrganization":null,"onboarding":false}}`，响应头 `server: cloudflare` 证明请求经 Vite `server.proxy` → 隧道 → 本地后端。本地后端日志 `.local/runtime/development/app.log` 在 02:21–02:31Z 出现 `auth.registered` / `auth.signed_in` / `auth.signed_out`，与预览操作时间吻合，说明预览请求确实贯通到本机。

**仍未验证的只是最后一跳**：外部预览域 `https://ais-dev-...run.app/api/*` 经 AI Studio 前置网关转发到容器内 Vite 的这一段。容器内无登录态直连预览域会被外层鉴权 `302` 到 `/__cookie_check.html`（Google 会话 Cookie 无法代带），因此必须由已登录的浏览器在 DevTools 里确认（见 S3）。

若最后一跳失败，**不要**退回"前端直连隧道"：那会让请求变成跨站，Cookie 变第三方 Cookie（Chrome/Safari 默认拦截，`SameSite=Lax` 下更不会随 fetch 发送），而 `cookieDomainRewrite` 是代理选项、直连时根本用不上。正确做法是换一个能做服务端同源转发的载体（AI Studio 的 Node 入口若可自定义，就自己写一层 `/api` 转发；否则先用本机 Vite 联调，见上文实测命令）。

## 步骤 3：烟测清单（按顺序执行，逐项打勾）

| # | 操作 | 期望 | 判定 |
| :-- | :-- | :-- | :-- |
| S0 | 本机先跑一遍（不依赖 AI Studio）：`cd ../yunpu-web && VITE_API_PROXY_TARGET=https://yunpu-dev.t-plus.com.cn VITE_ENABLE_MOCK=0 node_modules/.bin/vite --port=3000`，然后 `curl http://127.0.0.1:3000/api/health` 与 `curl http://127.0.0.1:3000/api/v1/auth/session` | 两条都 `200`，第二条是 `{"ok":true,"data":{"user":null,...}}` | 后端 + 隧道 + 同源代理三者都通；S3 不过时用它区分是 AI Studio 的问题还是后端的问题 |
| S1 | `curl --resolve yunpu-dev.t-plus.com.cn:443:172.67.205.120 https://yunpu-dev.t-plus.com.cn/api/health` | `200`，`{"ok":true,...}` | 隧道通 |
| S2 | 确认 `.env.development` 中 `TRUST_PROXY=false`、`CORS_ORIGINS` 列出**所有预览 Origin**（两台机器各 dev/pre + 本机 Vite），且 API 在开始烟测**之前**已重启（`down` 再 `up`） | 两行都在，共 6 个来源 | 后端配置生效 |
| S3 | **在已登录的预览页**按 F12 → Network → 刷新，找 `auth/session`（页面启动时 `app/App.tsx:13-17` 会调 `GET /api/v1/auth/session`）。容器内无法代做这一跳：无登录态请求预览域会被外层鉴权 `302` 到 `/__cookie_check.html` | 请求 URL 是**预览同源**路径 `https://ais-dev-...run.app/api/v1/auth/session`，`200`，响应 `{"ok":true,"data":{"user":null,...}}`（未登录）。若是 `direct-mock` 则 Network 里**根本没有这条请求**；若返回 HTML / 502 / 404，则问题在**外层预览网关转发**而不是 Vite 代理（容器内 S3 已过，见上） | 最后一跳（预览网关 → 容器 Vite）贯通；服务端代理与 mock 关闭已在容器内验证 |
| S4 | `curl -sS -o /dev/null -D - -X OPTIONS -H 'Origin: <PREVIEW_ORIGIN>' -H 'Access-Control-Request-Method: GET' --resolve yunpu-dev.t-plus.com.cn:443:172.67.205.120 https://yunpu-dev.t-plus.com.cn/api/health \| grep -i 'access-control'`（每个预览域各跑一次） | 出现 `access-control-allow-origin: <PREVIEW_ORIGIN>` 与 `access-control-allow-credentials: true`；`evil.example.com` 无 ACAO | `CORS_ORIGINS` 精确匹配生效（同源代理路径不触发预检，此条只用于排查直连）。2026-11-26 六来源已全部通过 |
| S5 | 预览页用 sign-up 自建的测试账号登录（不要用真实账号），DevTools → Application → Cookies | Cookie 挂在**预览域**、无 `Domain=yunpu-dev.t-plus.com.cn`；刷新后仍登录 | 同源 Cookie 正常 |
| S6 | 用一个不存在的邮箱连续错误登录 6 次 | 第 6 次出现 429（共用 `127.0.0.1` 桶属预期）；换一个新邮箱仍可正常尝试，说明"账号+来源"桶按邮箱隔离 | 限流有效 |
| S7 | 观察后端日志 `cat .local/runtime/development/app.log`，预览里触发一个写操作（如新建组织） | 请求真的落到后端（日志有记录）、无 502/503；**注意**：不要期待 `Invalid origin` 报错——服务端不校验 Origin（见"安全与回滚"） | 请求贯通到本地 API |

> S3 的服务端部分（Secrets 注入 + Vite `server.proxy`）已于 2026-11-26 在 AI Studio 容器内验证通过：容器内 `127.0.0.1:3000/api/v1/auth/session` → 200 真实 JSON，响应头 `server: cloudflare`。**只剩公网预览域最后一跳**需要已登录浏览器确认；若它失败而容器内 S3 通过，直接定位到 AI Studio 预览网关，不必再查后端/隧道/Vite。

## 排错对照

| 现象 | 先查 | 正确做法 |
| :-- | :-- | :-- |
| `tls: first record does not look like a TLS handshake` | 隧道 Service URL 协议 | 改成 `http://localhost:3001` |
| 公网域名 443 拒绝连接 | DNS 是否 CNAME 到 Cloudflare 且已「代理」（旧名 `yunpu.t-plus.com.cn` 已从 ingress 移除，勿用） | Cloudflare DoH 查新名应返回 `172.67.205.120` / `104.21.52.240` |
| POSTGRES 路由返回 502 | 用 `http://localhost:5432` 代理 TCP 协议 | 删掉这条路由；本机直连 `localhost:5432` |
| 本机 `curl` 超时但 AI Studio 正常 | 本地 ISP DNS 旧记录 | 本机用 `--resolve`，别改代码 |
| 浏览器报 CORS 错误（Network 里响应有、JS 读不到） | 请求的 Origin 是否在 `CORS_ORIGINS` 里精确存在 | 从 DevTools 复制 Origin 原文填进去并重启 API；同源代理路径不该出现这个错，出现说明代理没生效 |
| 登录立刻 429 | 是否有别的客户端已打满共用 IP 桶（50 次/15 分钟） | 等窗口过去，或 `pnpm env down && up development` 重置进程内计数；**不要**为此打开 `TRUST_PROXY` |
| 页面停在 mock 登录页 | `VITE_API_PROXY_TARGET` 拼写 / 未重新部署 | 必须是 `VITE_` 前缀；另设 `VITE_ENABLE_MOCK=0` |
| `curl` 预览域名得到 `302` + `__cookie_check.html` | 正常现象，不是后端问题 | 预览前置了 nginx 的 Cookie 检查（`set-cookie: __SECURE-aistudio_auth_flow_may_set_cookies`），浏览器会自动跟随；`curl` 想直连预览必须自己带 cookie，所以**验证后端请直接打隧道域名** |
| 出现 `localhost` 开头的媒体 URL | 用了旧方案文档 | 当前实现无预签名 URL，媒体都走同源 `/api/media` |

## 安全与回滚

- 隧道是**公网可达**的 development 环境，`BETTER_AUTH_SECRET` / capability token 都是模板示例值（`example-...`）。联调期间不要录入真实隐私数据；用完可在 Cloudflare Zero Trust 给应用加 Access 策略。
- ⚠️ **服务端不校验 Origin（已实测）**：带 `Origin: https://evil.example.com` 的 `POST /api/v1/auth/sign-up` 仍返回 201 并下发 session cookie；带合法 cookie 的跨站 `POST /api/v1/organizations` 也返回 201。CORS 只让浏览器拒绝**读取**响应，不阻止**状态变更**。
  - 根因：Better Auth 在本项目里是**当库用**的，不是挂 HTTP handler。`apps/api/src/app.ts:178` 挂的是自己的 `authRouter`（`apps/api/src/modules/auth/router.ts:17,35,65,78`），内部调用 `auth.api.signUpEmail / signInEmail / signOut / getSession`（`apps/api/src/modules/auth/service.ts:51,140,189`、`session.ts:8`）。Better Auth 的 `trustedOrigins` 校验发生在**它自己的 handler** 里，走 `auth.api.*` 服务端调用时根本不经过，所以那份白名单对本站 `/api/v1/auth/*` 不生效。
  - 全仓也没有 Origin/Referer 中间件：`app.ts:63-73` 只有 CORS 回调，`modules/organization/router.ts:166-172` 只是用 Origin 拼邀请链接。
  - 影响与处置：隧道开着期间等于把可写 API 暴露给公网，务必只在自己联调时开隧道、用完 `podman stop cloudflared`、不要用真实账号或真实数据。要根治需加 Origin 校验中间件（属行为变更，另开 Spec 走 SDD，不在联调里顺手改）。
- dev 库**没有预置 demo 账号**（`demo@yunpu.cn` 登录会 401 `邮箱或密码错误`，原因是零用户而非密码错）。首次联调用 `POST /api/v1/auth/sign-up` 自建账号；它会同时创建默认组织（`role: admin`、`isOwner: true`）。
- 恢复默认：`unset YUNPU_DEV_CORS_ORIGINS YUNPU_DEV_TRUST_PROXY && pnpm env down development && pnpm env up development`，`.env.development` 回到 `TRUST_PROXY=false` / `CORS_ORIGINS=`（空）。
- 移除前端 Secrets 后重新部署预览，即回到 direct-mock。
- 关闭隧道：`podman stop cloudflared && podman rm cloudflared`（token 不入库、不进文档）。

## 局域网用 DBeaver 直连 dev 库

宿主机局域网地址 `10.10.10.45/24`（`ens34`，DHCP 可能变，用 `ip -4 addr show scope global` 复核）；
dev Postgres 由 rootless podman 以 `0.0.0.0:5432->5432/tcp` 发布，`listen_addresses='*'`，`pg_hba.conf` 末行是
`host all all all scram-sha-256`，即**局域网其他机器可以用口令连**，不需要走 Cloudflare 隧道（那条 TCP 路由已删，实测 502）。
本机防火墙 firewalld inactive、ufw `ENABLED=no`。`ssl=off`，DBeaver 里 SSL 模式选 `disable`。

| 项 | dev | test |
| :-- | :-- | :-- |
| Host / Port | `10.10.10.45:5432` | `10.10.10.45:5433` |
| Database | `yunpu_dev` | `yunpu_test` |
| 只读+业务视图推荐账号 | `postgres` / `postgres`（superuser、`rolbypassrls=t`，能看到全部数据） | 同左 |
| 应用运行账号 | `genealogy_app` / `example`（`NOSUPERUSER NOBYPASSRLS`，**默认看不到任何业务行**） | 同左 |
| 认证运行账号 | `auth_runtime` / `example`（只有 `auth.*` 四张表有权限） | 同左 |

**关键坑：FORCE RLS**。`public` 下 9 张业务表全部 `relrowsecurity=t, relforcerowsecurity=t`；
`genealogy_app` 没有 `BYPASSRLS`，不设会话变量时 `select count(*) from public.organization` 恒为 `0`——
这不是库空，是 RLS 在过滤。要在 DBeaver 里以应用视角看数据，先在同一 SQL 会话执行：

```sql
select set_config('app.user_id', '<用户UUID>', false);  -- false = 会话级，不是事务级
select id, name from public.organization;              -- 现在只看到该用户所属组织
```

用户 UUID 从 `auth."user"` 取（该表无 RLS，且 `genealogy_app` 实际可读；`has_table_privilege` 显示 `f` 但
`select count(*)` 成功，权限模型细节以实测为准，别依赖这个假设——直接用 `postgres` 账号最稳）。
`app.current_user_id()`（`packages/db/migrations/0003_functions.sql:6-22`）读的就是 `app.user_id`，
`app.visible_org_array()` 返回该用户所属组织数组。

**验证过的连通性（2026-11-26）**：
- 从容器内经 LAN IP：`PGPASSWORD=example psql -h 10.10.10.45 -U genealogy_app -d yunpu_dev` → 成功，`inet_client_addr()=10.89.1.1`。
- 从宿主机用 node-postgres 连 `postgres://genealogy_app:example@10.10.10.45:5432/yunpu_dev` → 成功；不设 `app.user_id` 时 0 组织，`set` 后 1 组织。
- `postgres` / `postgres` 经 LAN IP 连入是 superuser，`select count(*) from public.organization` 返回全部行。

**安全提醒**：`10.10.10.45:5432` 只对局域网开放即可，**不要**在路由器做端口映射，也不要复用之前那条公网 tunnel 路由；
口令是 `scripts/env.sh` 生成的 `example-*` / 模板默认值，不是生产凭据。

## 复核来源

- 代码：`scripts/env.sh`、`apps/api/src/{env.ts,app.ts,index.ts,media.ts}`、`apps/api/src/modules/auth/better-auth.ts`、`apps/api/src/middleware/login-rate-limit.ts`、`yunpu-web/{vite.config.ts,lib/apiMode.ts,README.md}`
- 决策：[ADR-0008](adr/ADR-0008-polyrepo-contract.md)（同源 `/api` 代理优先）、[架构](architecture.md)
- 外部（仅作背景，已标注未确认项）：[Better Auth cookies / 反向代理](https://better-auth.com/docs/concepts/cookies.md#using-a-reverse-proxy)、[Better Auth options](https://better-auth.com/docs/reference/options#dynamic-base-url)、[AI Studio 全栈运行](https://aistudio.google.com/docs/aistudio-fullstack)、[Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)
