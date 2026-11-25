# Technical Plan: 架构精简

**Branch**: `006-architecture-slimming` | **Spec**: [spec.md](./spec.md) | **Decision**: [ADR-0009](../../docs/adr/ADR-0009-architecture-slimming.md)

> 本批次是对已批准并执行的设计做规范同步，不新增功能。详细取舍见 ADR-0009，需求与验收见 spec.md，执行状态见 tasks.md。

## 1. 上下文与复用分析

- **关联 Spec**：[spec.md](./spec.md)（`FR-001`–`FR-008`）
- **复用现有模块**：沿用 `apps/api/src/lib/`、`packages/shared` 与既有测试夹具，不新建包或中间层。
- **新增/修改范围**：删除零引用实现与空壳；把重复定义收进已有的 `lib/` 与 shared；修复类型错误后把类型检查并入 `pnpm lint`。

## 2. 模块职责与依赖关系

- `router` 只做校验与响应，共用助手放在 `lib/http.ts`；错误映射集中在 `lib/errors.ts`；时间戳格式集中在 `lib/sql.ts`。
- 跨端共用的枚举、Schema 与角色取值放在 `packages/shared`，模块不再写转出壳或字面量副本。
- 依赖方向不变：不新增反向依赖，不引入依赖注入容器。

## 3. 数据模型与数据库变更

- 无。RLS 策略、触发器、迁移与 Drizzle schema 一律不动（`FR-006`）。

## 4. API Contract

- HTTP 行为不变：状态码、响应信封、错误码与文案、Set-Cookie 行为均保持精简前结果（`FR-003`）。
- `AppType` 不改；不启用 `app.routes`，不重写 `export-contract.ts`（`FR-007`）。

## 5. 异常处理、事务与并发控制

- 错误仍按 SQLSTATE 与约束名映射，不解析错误消息文本；租户事务入口与重试边界不变。
- 放弃的两条 DI 版不变式从未进入生产，不新增等价实现。

## 6. 安全性、性能与兼容性

- 删除 `scripts/check-rls.ts` 后，RLS 强制行为仍由 `tests/security/force-rls.test.ts` 覆盖。
- 进程内限流不动；不引入新依赖，兼容性风险限于内部导入路径，对外可见结果不变。

## 7. 技术风险与取舍

- 选择「删除 + 收敛」而非重新分层：前者行为不变且可测量瘦身，后者会增加落点。理由见 ADR-0009。
- `tsc --noEmit` 门禁放在 14 个类型错误修完之后，避免用门禁倒逼范围扩张。
- 待验证项：`T-012`（门禁）与 `T-013`（全量验证）保持 pending，跑完 `pnpm lint` / `pnpm test:all` 后再勾选。
