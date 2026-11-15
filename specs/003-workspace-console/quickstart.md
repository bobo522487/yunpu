# Quickstart: 工作台控制台验收指南

**Feature**: `003-workspace-console` | **Date**: 2026-11-15

> 本文是**验证与运行指南**，不含实现代码。载荷形状见 [contracts/console-api.md](contracts/console-api.md)，页面状态见 [contracts/ui-states.md](contracts/ui-states.md)，表结构见 [data-model.md](data-model.md)。

## 1. 前置条件

- Docker 可用（PostgreSQL 18 + MinIO 独立容器，开发/测试环境隔离）。
- Bun ≥ 1.4、pnpm 12.18。
- 依赖已安装：`pnpm install`。

## 2. 启动与迁移

```bash
# 1. 起环境（开发 + 测试两套，互不影响）
scripts/env.sh up development
scripts/env.sh up test

# 2. 迁移（本批次新增 0007_project.sql、0008_org_management.sql）
bun packages/db/src/migrate.ts                # 开发库
bun packages/db/src/migrate.ts --env test     # 测试库

# 3. 起 API（3000）与前端（5173，/api 代理到 3000）
bun apps/api/src/index.ts &
pnpm --filter nocoapp-dev dev
```

预期：`bun packages/db/src/migrate.ts --env test` 无报错；`psql` 中 `public.project` 存在且 `rowsecurity = true`、`forcerowsecurity = true`；`app.revoke_invite`、`app.transfer_organization_ownership` 存在于 `app` schema。

## 3. 自动化测试

```bash
# 服务端集成测试（真实 PG 18，覆盖 RLS / CAS / 并发）
bun test --env-file .env.test --max-concurrency=1 tests/console

# 既有批次回归（认证 + 组织，防止本批次破坏 002 行为）
bun test --env-file .env.test --max-concurrency=1 tests/auth apps/api/test

# 前端类型门禁
pnpm --filter nocoapp-dev lint

# 文档门禁（若迁移触碰权限矩阵/错误映射）
scripts/check-docs.sh --root docs --strict --baseline docs/.check-docs-baseline.txt
```

预期：全部 exit=0。`tests/console` 必含以下断言（对应 data-model §3 不变量）：

| 用例 | 断言 |
| --- | --- |
| 跨租户隔离 | A 组织会话读不到 B 的项目/成员/邀请；按 ID 直访返回「不存在或无权」 |
| owner 保护 | 删 owner 成员行 → `23001`；改 owner 角色 → 409 |
| 邀请一次性 | 同 token 并发兑换一次成功；创建响应后任何查询不再返回明文 token |
| 所有权并发 | 两事务同时转移 → 一方成功、一方 `CONCURRENT_MODIFICATION` |
| 项目并发编辑 | 同 `expectedUpdatedAt` 并发 PATCH → 一方 201/200、一方 409 |
| 只读成员 | `viewer` 调写端点 → 403 `FORBIDDEN` |
| 归档组织 | `activate` 归档组织 → 不被选中；`project` 写入被 RLS/服务层拒绝 |
| RLS fail-closed | 不带 `app.user_id` 查询 `project` → 空集 |

## 4. 手工验收脚本（对应 spec SC）

> **核对表**：逐步执行时在方框内打勾；任一步失败即记录缺陷并停止后续依赖步骤。
>
> - [ ] 步骤 1 首页落地与数字一致
> - [ ] 步骤 2 快捷入口 ≤2 步
> - [ ] 步骤 3 最近项目 5 条 + 查看全部
> - [ ] 步骤 4 项目新建/改名/删除
> - [ ] 步骤 5 并发改名冲突提示
> - [ ] 步骤 6 邀请链接弹窗一次性
> - [ ] 步骤 7 邀请链接兑换
> - [ ] 步骤 8 改角色/移除成员
> - [ ] 步骤 9 转移所有权
> - [ ] 步骤 10 改名/归档与去向
> - [ ] 步骤 11 显示名/密码修改
> - [ ] 步骤 12 切换即记住
> - [ ] 步骤 13 viewer 只读
> - [ ] 步骤 14 Mock 降级与恢复
> - [ ] 步骤 15 会话过期跳登录
> - [ ] 步骤 16 空状态展示

准备：注册两个账号 A（组织 OA）与 B；在成员页邀请 B 并复制链接。

| # | 步骤 | 预期（spec 编号） |
| --- | --- | --- |
| 1 | A 登录 | 落地 `/home` 首页，显示 OA 的项目数/成员数/邀请数，数字与项目页、成员页一致（`SC-001`） |
| 2 | 首页点「新建项目」 | ≤2 步到达项目创建弹窗；创建后首页与项目页同时出现该项目（`SC-002`、`SC-008`） |
| 3 | 首页最近项目 | 固定 5 条，「查看全部」跳项目页（`FR-003`） |
| 4 | 项目页新建/改名/删除 | 空名称被拒；删除有确认弹窗；改名刷新后保持（`SC-005`） |
| 5 | 两个标签页同时改同一项目名 | 后提交者收到冲突提示，不静默覆盖（`SC-005`、data-model 不变量 8） |
| 6 | A 创建邀请 | 弹窗展示可复制链接；关闭后列表无明文 token（`FR-005`） |
| 7 | B 打开 `/#/invite/<token>` | 跳 `/onboarding` 预填并兑换成功，B 成为 OA 成员（`SC-008`） |
| 8 | A 改 B 角色 → 移除 B | 名单即时变化；B 旧会话刷新看不到 OA 任何数据（`SC-004`） |
| 9 | A 转移所有权给 B | 仅一方成功；转移后 A 不再是 owner（`SC-006`） |
| 10 | 设置页改组织名 → 归档 | 改名生效；归档后自动进入下一个可用组织，无则 `/onboarding`（`SC-007`） |
| 11 | 设置页改显示名/密码 | 只对本人生效；改密后旧密码登录失败（`FR-006`） |
| 12 | 切换组织 | 四页数据整体替换无残留；登出重登回到该组织（切换即记住，`SC-004`、spec 002 `FR-014`） |
| 13 | viewer 账号浏览四页 | 可查看；写入口不可用且直调端点 403（`SC-003`） |
| 14 | 停掉 API 进程后刷新 | Mock 模式指示出现，四页仍可用（既有降级约束）；恢复 API 后自动回真实数据 |
| 15 | 会话过期后操作 | 跳登录，不返回组织数据（`SC-009`） |
| 16 | 空组织首页 | 「尚无项目」空状态 + 入口，无错误样式与示例数据（`SC-010`） |

## 5. 已知边界

- 首页概览数字为进入页面时的查询结果，无实时推送；并发变更以刷新后为准（spec Assumptions）。
- 项目内容表（人物、谱系等）尚未建表，删除项目当前无 `RESTRICT` 阻挡；内容表落地后由外键接管。
- 应用构建器、数据源、谱文编辑器路由保留模板行为，不在本批次验收。
