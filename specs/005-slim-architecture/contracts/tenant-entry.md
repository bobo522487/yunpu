# Contract: 租户事务入口

## 唯一业务入口

租户表的读取和写入调用 `withTenantTransaction({ userId, orgId? }, fn)`。

入口必须：

1. 开始事务。
2. `SET LOCAL ROLE genealogy_app`。
3. 用事务局部配置设置 `app.user_id`。传入 `orgId` 时同样以事务局部配置设置 `app.current_org_id`。
4. 确认当前角色是 `genealogy_app`，否则失败。
5. 执行 `fn`。
6. 提交，或在失败时回滚。
7. 归还连接。下一次借出看不到上一次的 `app.user_id`。

瞬态失败最多再试到共计 3 次。唯一冲突（`23505`）不重试。这个行为保持现状。

## 禁止

- 业务模块导入连接池、`createDb`，或已删除的 `withUser`。
- 普通请求、后台任务、脚本使用迁移连接或认证库连接来读写家谱租户表。

## 三个例外

| 入口 | 允许的语句 | 禁止 |
| --- | --- | --- |
| 健康检查的短连接 | `SELECT version()` | 查询租户表 |
| 认证库连接 | Better Auth 自己的表 | 查询家谱租户表 |
| 迁移命令的独立连接 | 迁移 SQL | 被请求处理或普通任务借用 |

例外写在 `docs/boundaries.md`。新增第四种例外必须同时改这份边界说明和本契约，不能只在某个服务里直接拿一条连接。
