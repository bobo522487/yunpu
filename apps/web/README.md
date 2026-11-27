# 云谱前端

云谱工作区前端（`@yunpu/web`）。React 19 + Vite 8 + TypeScript + Tailwind 4 + Zustand + TanStack Router + TanStack Query。

包管理与运行统一使用 **Node.js 26 + pnpm**（见根目录 `pnpm-workspace.yaml`）。

## 本机对接本地后端

在仓库根目录一键联调前后端：

```bash
pnpm dev
```

或单独启动前端（代理到 `VITE_API_PROXY_TARGET`，默认 `http://127.0.0.1:3001`）：

```bash
pnpm run dev:web
```

开发服务器是 http://localhost:3000 ，`/api` 代理到 `VITE_API_PROXY_TARGET`。此时代码不注册 mock。后端关掉时页面停在错误态。

## AI Studio 或无代理预览

不设置 `VITE_API_PROXY_TARGET` 时，`features/auth/enableMock.ts` 注册 direct mock，请求不发往网络。预览打开后停在登录页。演示账号是 `demo@yunpu.cn` / `demo123456`。

显式关闭 mock：`VITE_ENABLE_MOCK=0`。有代理时即使设了 `VITE_ENABLE_MOCK=1` 也不会走 mock。

## 检查

```bash
pnpm --filter @yunpu/web run test
pnpm --filter @yunpu/web run lint
pnpm --filter @yunpu/web run typecheck
pnpm --filter @yunpu/web run build
```

## 目录结构

- `src/routes/` — TanStack Router 文件式路由与守卫
- `src/components/layout/` — 工作区壳与项目三栏壳
- `src/features/auth/` — 登录、注册、邀请、会话与 mock 注册
- `src/features/dashboard/` — 工作区首页、成员、设置、组织与项目 API / Query
- `src/features/project/` — 项目首页、项目设置与世系/传记/宗谱壳
- `src/features/lineage/` — 世系核心（图谱、人物详情、布局）
- `src/features/articles/` — 谱文编辑器、版本冲突与修订
- `src/features/books/` — 谱书编排与版次
- `src/store/` — Zustand 状态（会话偏好、未对接后端模块的本地持久化）
- `src/lib/` — 统一 HTTP 客户端 `apiRequest` 与通用工具
