# 云谱前端（apps/web）

云谱工作区前端，基于 React 19 + Vite 6 + TypeScript + Tailwind 4 + Zustand + React Router 6。

## 本地运行

前置条件：Node.js、pnpm 12（仓库根 `package.json` 声明）。

```bash
pnpm install
pnpm --filter nocoapp-dev dev        # 开发服务器 http://localhost:3000，/api 代理到 127.0.0.1:3001
pnpm --filter nocoapp-dev lint       # tsc --noEmit
pnpm --filter nocoapp-dev build      # 生产构建
```

代理目标可用 `VITE_API_PROXY_TARGET` 覆盖（见 `.env.example`）。

## 离线 Mock 开发

开发阶段前后端分离时，可启用 Mock 后端（**仅开发环境生效，生产构建剔除**）：

```bash
cp .env.example .env.local
# 把 VITE_ENABLE_MOCK 设为 1
pnpm --filter nocoapp-dev dev
```

开关逻辑在 `features/auth/enableMock.ts`：`import.meta.env.DEV && VITE_ENABLE_MOCK === '1'` 时才注册 mock handler。未启用时后端不可达会明确报错，不会静默返回假数据。

## 目录结构

- `app/` — 路由与外壳（工作区壳 / 项目壳）
- `features/auth/` — 登录、注册、邀请、会话与 mock 注册
- `features/dashboard/` — 工作区首页、成员、设置、组织 API
- `features/project/` — 项目页与世系/传记/宗谱模块
- `features/lineage/` — 世系核心（图谱、人物详情、布局）
- `components/` — 布局与通用组件
- `store/` — Zustand store
- `lib/` — API 封装与工具
