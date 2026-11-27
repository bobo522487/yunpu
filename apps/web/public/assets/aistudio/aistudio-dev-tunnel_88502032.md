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

- **当前生效的公网主机名是 `yunpu-dev.t-plus.com.cn`**（隧道 ingress 配置 version=7）。旧名 `yunpu.t-plus.com.cn` 已从 ingress 移除，Cloudflare DoH 仍返回旧记录 `152.32.252.221`、443 拒绝连接，勿再用。
- Cloudflare 边缘 IP：`172.67.205.120` / `104.21.52.240`（两者均实测 200）。新主机名在本机 DNS 也已正确返回这两个 IP。
- 旧 ISP DNS 缓存问题只影响已废弃的 `yunpu.t-plus.com.cn`；新名无需 `--resolve`，保留该写法只为可复现实测。AI Studio 位于 Google Cloud，不受本地 DNS 影响。
- `cloudflared` 容器：`podman run --network host --name cloudflared cloudflare/cloudflared:latest tunnel --no-autoupdate --protocol http2 run --token <TOKEN>`；Zero Trust 应用 Service URL 必须是 **`http://localhost:3001`**（`http`，不是 `https`，否则 `tls: first record does not look like a TLS handshake`）。API 只监听 `127.0.0.1:3001`，`--network host` 让容器可直接到达。
- **只需要 1 条 Published Application：`yunpu-dev.t-plus.com.cn → http://localhost:3001`。** 实测另外两条都是多余且有风险的：
  - `yunpu-dev-postgres.t-plus.com.cn → http://localhost:5432`：PostgreSQL 是 TCP 协议、不是 HTTP，实测 `HTTP 502`，cloudflared 日志 `EOF`；把 dev 数据库（模板示例口令）暴露公网毫无收益，应删除。
  - `yunpu-dev-mino.t-plus.com.cn → http://localhost:9000`：媒体走后端 `/api/media` 流式中转（无预签名 URL），前端不会直连对象存储；实测可见 `200`，但暴露 dev 存储同样无收益，应删除。
  - 需要直接从本机连 dev DB/S3 时用 `localhost:5432` / `localhost:9000`（`env.sh up development` 映射的宿主机端口），不要走隧道。

## 全局约束（照抄实际代码，勿凭印象改）

| 项 | 实际值 | 依据 |
| :-- | :-- | :-- |
| API 端口 | `3001`（不是 3000，3000 归 Vite） | `scripts/env.sh:63`、`.env.development:7` |
| 前端代理变量名 | `VITE_API_PROXY_TARGET`（不是 `API_PROXY_TARGET`） | `yunpu-web/vite.config.ts:7-25`、`yunpu-web/lib/apiMode.ts:8-12` |
| 关闭 mock | `VITE_ENABLE_MOCK=0`（有代理时 mock 本就不注册） | `yunpu-web/README.md:20-22`、`yunpu-web/features/auth/enableMock.ts:4-13` |
| CORS 来源 | `CORS_ORIGINS`，逗号分隔，**精确匹配**，无通配符 | `apps/api/src/app.ts:63-73`（`allowed.includes(origin)`） |
| Better Auth 信任来源 | `[BETTER_AUTH_URL, ...CORS_ORIGINS]`，**支持**通配符 | `apps/api/src/modules/auth/better-auth.ts:25` |
| XFF 开关 | `TRUST_PROXY=true` 才读 `x-forwarded-for` | `apps/api/src/middleware/login-rate-limit.ts:144-152` |
| 环境文件 | `scripts/env.sh` 每次 `up` 重新生成 `.env.development`，手改会被覆盖 | `scripts/env.sh:265-287` |
| 进程启动 | `env -i HOME PATH node --env-file=...`，宿主 shell 变量**不会**进入 app | `scripts/env.sh:316-326` |

> ⚠️ 原「落地步骤.md」里的 `EXTRA_TRUSTED_ORIGINS` / `advanced.trustedProxyHeaders` / `API_PROXY_TARGET` / `http://localhost:3000` / `--allowed-mail` / 预签名 URL 说法均与当前代码不符，勿采用。对象存储走 `POST /api/media` + `GET /api/media/*` 流式中转（`apps/api/src/media.ts:53-132`），返回的是同源 `/api` 路径，不存在 `localhost` 预签名 URL。

## 步骤 1：后端——把联调参数交给 env.sh

新增了两个**仅 development 生效**的输入变量（本次已改 `scripts/env.sh`）：

- `YUNPU_DEV_CORS_ORIGINS` → 写入生成 `.env` 的 `CORS_ORIGINS`
- `YUNPU_DEV_TRUST_PROXY` → 写入生成 `.env` 的 `TRUST_PROXY`，只接受 `true` / `false`

`test` 环境的 `.env` 保持原样，现有测试基线不变。

```bash
# <PREVIEW_ORIGIN> 从 AI Studio 预览页 DevTools → Network → 任一请求的 Origin 头精确复制
# 例：https://abc123.e2b.app 或 https://xxx.scF.usercontent.goog（以实际为准，可逗号分隔多个）
cd /home/bobo/Projects/yunpu

pnpm env down development   # 停掉旧进程；development 卷保留
YUNPU_DEV_CORS_ORIGINS='<PREVIEW_ORIGIN>' \
YUNPU_DEV_TRUST_PROXY=true \
  pnpm env up development   # 重新生成 .env 并启动新进程（关键：必须重启，见下）

grep -nE '^(TRUST_PROXY|CORS_ORIGINS)=' .env.development
# → TRUST_PROXY=true
# → CORS_ORIGINS=<PREVIEW_ORIGIN>
```

**为什么必须重启**：`perform_up()` 在 development 已 ready 时只重写 `.env` 文件、不重启进程（`scripts/env.sh:365-370`）。环境变量在进程启动时由 `--env-file` 读取一次，改文件不会热生效。所以先 `down` 再 `up`。

- `CORS_ORIGINS` 必须**精确**：`app.ts:68` 用 `allowed.includes(origin)`，写 `https://*.ai.studio` 这类通配符对 CORS 无效（只有 Better Auth 的 `trustedOrigins` 认通配符）。同时填进 `CORS_ORIGINS` 的来源会自动进入 Better Auth 白名单，登录不会报 `Invalid origin`。
- `TRUST_PROXY=true` 的原因：隧道容器在 host 网络，socket 对端是 `127.0.0.1`；不开则所有访客共用一个限流桶，很快 429。开了以后取 `x-forwarded-for` 第一段。⚠️ 这是**开发专用**配置：公网隧道下 XFF 可被伪造，只用于联调，不得放真实数据。

## 步骤 2：前端——AI Studio Secrets

在 AI Studio 项目 Settings → Secrets 增加（改名/新增后需重新部署预览）：

| Secret | 值 | 作用 |
| :-- | :-- | :-- |
| `VITE_API_PROXY_TARGET` | `https://yunpu-dev.t-plus.com.cn` | 打开 Vite `/api` 代理，同时关闭 direct-mock |
| `VITE_ENABLE_MOCK` | `0` | 显式关闭 mock，请求必须真实发出 |

**两项待验证的 AI Studio 假设**（外部文档未确认，靠步骤 3 烟测判定）：

1. AI Studio 的 Node 服务端是否真的执行 `vite.config.ts` 里的 `server.proxy`；
2. Secrets 是否在 Vite 配置求值阶段就已注入 `process.env`（`vite.config.ts:7` 读的是 `process.env` 而非 `import.meta.env`）。

若 S3 失败（请求直接打后端或仍走 mock），说明假设 1/2 不成立，改用备选：不设 `VITE_API_PROXY_TARGET`，前端直接请求 `https://yunpu-dev.t-plus.com.cn`（需把该 Origin 加入 `CORS_ORIGINS`），但 Cookie 会变成跨站，Safari/Chrome 第三方 Cookie 限制下需另配 `cookieDomainRewrite`，不在本文范围。

## 步骤 3：烟测清单（按顺序执行，逐项打勾）

| # | 操作 | 期望 | 判定 |
| :-- | :-- | :-- | :-- |
| S1 | `curl --resolve yunpu-dev.t-plus.com.cn:443:172.67.205.120 https://yunpu-dev.t-plus.com.cn/api/health` | `200`，`{"ok":true,...}` | 隧道通 |
| S2 | 确认 `.env.development` 中 `TRUST_PROXY=true`、`CORS_ORIGINS=<PREVIEW_ORIGIN>`，且 API 已在 S1 之前重启 | 两行都在 | 后端配置生效 |
| S3 | AI Studio 预览打开 DevTools → Network，刷新页面，找 `/api/health` | 请求 URL 是**预览同源**路径（如 `<preview>/api/health`），`200`，响应是真实 JSON | 服务端代理已生效、mock 已关（验证假设 1/2） |
| S4 | `curl -sS -o /dev/null -D - -X OPTIONS -H 'Origin: <PREVIEW_ORIGIN>' -H 'Access-Control-Request-Method: GET' https://yunpu-dev.t-plus.com.cn/api/health \| grep -i 'access-control'` | 出现 `access-control-allow-origin: <PREVIEW_ORIGIN>` 与 `access-control-allow-credentials: true` | CORS 白名单正确（备选方案才需要；同源代理路径不会触发预检） |
| S5 | 预览页用真实账号登录，DevTools → Application → Cookies | Cookie 挂在**预览域**、无 `Domain=yunpu-dev.t-plus.com.cn`；刷新后仍登录 | 同源 Cookie 正常 |
| S6 | 连续快速错误登录（十几二十次），看是否过早 429 | 不应因为「所有人共用 127.0.0.1 桶」而秒触发；若触发，回查 S2 的 `TRUST_PROXY` | XFF 生效 |
| S7 | 观察后端日志 `cat .local/runtime/development/app.log`，预览里触发一个写操作 | 无 `Invalid origin`、无 CORS 报错、无 502/503 | Better Auth 信任来源正确 |

> S3 是最关键的一条：它同时验证了「AI Studio 服务端代理可用」和「Secrets 注入到 Vite 配置」两个未确认假设。S3 不过就走上面的备选方案。

## 排错对照

| 现象 | 先查 | 正确做法 |
| :-- | :-- | :-- |
| `tls: first record does not look like a TLS handshake` | 隧道 Service URL 协议 | 改成 `http://localhost:3001` |
| 公网域名 443 拒绝连接 | DNS 是否 CNAME 到 Cloudflare 且已「代理」（旧名 `yunpu.t-plus.com.cn` 已从 ingress 移除，勿用） | Cloudflare DoH 查新名应返回 `172.67.205.120` / `104.21.52.240` |
| POSTGRES 路由返回 502 | 用 `http://localhost:5432` 代理 TCP 协议 | 删掉这条路由；本机直连 `localhost:5432` |
| 本机 `curl` 超时但 AI Studio 正常 | 本地 ISP DNS 旧记录 | 本机用 `--resolve`，别改代码 |
| `Invalid origin` | `CORS_ORIGINS` 是否含精确 Origin | 从 DevTools 复制 Origin 原文填进去，重启 API |
| 登录立刻 429 | `TRUST_PROXY` 未生效 / 进程未重启 | S2 + `pnpm env down && up development` |
| 页面停在 mock 登录页 | `VITE_API_PROXY_TARGET` 拼写 / 未重新部署 | 必须是 `VITE_` 前缀；另设 `VITE_ENABLE_MOCK=0` |
| 出现 `localhost` 开头的媒体 URL | 用了旧方案文档 | 当前实现无预签名 URL，媒体都走同源 `/api/media` |

## 安全与回滚

- 隧道是**公网可达**的 development 环境，`BETTER_AUTH_SECRET` / capability token 都是模板示例值（`example-...`）。联调期间不要录入真实隐私数据；用完可在 Cloudflare Zero Trust 给应用加 Access 策略。
- 恢复默认：`unset YUNPU_DEV_CORS_ORIGINS YUNPU_DEV_TRUST_PROXY && pnpm env down development && pnpm env up development`，`.env.development` 回到 `TRUST_PROXY=false` / `CORS_ORIGINS=`（空）。
- 移除前端 Secrets 后重新部署预览，即回到 direct-mock。
- 关闭隧道：`podman stop cloudflared && podman rm cloudflared`（token 不入库、不进文档）。

## 复核来源

- 代码：`scripts/env.sh`、`apps/api/src/{env.ts,app.ts,index.ts,media.ts}`、`apps/api/src/modules/auth/better-auth.ts`、`apps/api/src/middleware/login-rate-limit.ts`、`yunpu-web/{vite.config.ts,lib/apiMode.ts,README.md}`
- 决策：[ADR-0008](adr/ADR-0008-polyrepo-contract.md)（同源 `/api` 代理优先）、[架构](architecture.md)
- 外部（仅作背景，已标注未确认项）：[Better Auth cookies / 反向代理](https://better-auth.com/docs/concepts/cookies.md#using-a-reverse-proxy)、[Better Auth options](https://better-auth.com/docs/reference/options#dynamic-base-url)、[AI Studio 全栈运行](https://aistudio.google.com/docs/aistudio-fullstack)、[Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)
