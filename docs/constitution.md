# Yunpu Constitution

本文档定义 Yunpu 项目的长期工程原则、SDD 研发治理规范与合并约束。若需修改或废止下列原则，必须在 [docs/adr/](adr/) 新增或更新对应架构决策记录，写明背景、替代方案与放弃的权衡。

---

## 一、工程原则与系统不变量

### 1. 非法状态存不进去

能由 PostgreSQL 拒绝的非法数据组合，必须下沉到数据库约束（`CHECK`、`UNIQUE`、部分唯一索引、复合外键、`RESTRICT`/`CASCADE`、延迟约束触发器）执行。禁止把核心数据完整性仅寄托于散落的应用层判断或口头约定。

### 2. 同一事实只有一处权威

- **数据结构、约束与策略**：以 `packages/db/migrations/` 已执行迁移及同次变更中与之对齐的 Drizzle schema（`packages/db/src/schema/`）为准。
- **对外 HTTP 契约**：以 `apps/api/src/app.ts` 导出的 `AppType` 及 `packages/shared/src/schemas.ts`、`enums.ts` 为准。
- **错误码与 HTTP 状态映射**：以 `packages/shared/src/errors.ts` 的 `ERROR_STATUS` 与 `apps/api/src/lib/errors.ts` 的 `mapDatabaseError`（按 SQLSTATE 和约束名映射，不解析错误文本）为准。
- **业务规则与验收契约**：以对应功能的 `specs/NNN-*/spec.md` 为准，并与代码变更同步维护。

### 3. 失败对调用方显式可见

禁止静默吞掉异常或把失败伪装成成功。后端错误必须通过 `AppError` 或 `mapDatabaseError` 转换为标准错误响应向上返回；非预期的未处理错误必须携带 `requestId` 记录结构化日志。

### 4. 租户数据严格隔离

租户数据隔离由 PostgreSQL `FORCE ROW LEVEL SECURITY` 策略强制执行。业务模块与普通后台任务只能通过 `withTenantTransaction` 进入事务，在事务内切换 `SET LOCAL ROLE genealogy_app` 并设置事务局部 `app.user_id`（以及可选的 `app.current_org_id`），连接归还即清空身份。禁止业务模块绕过该入口直接借用连接池。

例外入口（健康检查、认证库、数据库迁移）明确登记在 [docs/architecture.md](architecture.md)，严禁扩展或挪用。

### 5. 简单胜过聪明

优先使用清晰直接的表结构、数据库约束、显式依赖和单层服务调用；不为尚未落地的需求预建空表、空索引或过度抽象层（如无意义的透传 Repository/Mapper 或 DI 容器）。当且仅当模块边界在演进中反复出现耦合时再调整划分。

### 6. 删除即物理删除

业务实体的删除语义为物理删除（由外键级联或 `RESTRICT` 保护关联完整性）。`archived` / `suspended` 等状态仅用于表达生命周期状态，不替代删除语义。

---

## 二、SDD 研发治理原则

### 7. 需求先澄清，Spec 只描述契约

- 新功能或复杂变更在需求关键规则未明确前，不得自行猜测业务规则或直接编写实现代码。
- `spec.md` 只描述业务目标、用户故事、带唯一编号的功能需求（`FR-xxx`）、业务规则、异常处理和验收标准，不混入 SQL、框架或内部类名等实现细节。

### 8. 先读代码再设计，按任务受控实施

- 编写 `plan.md` 前必须先阅读现行代码与 `docs/` 文档，优先复用既有模块与模式，不无故引入新依赖，所有设计项可追溯至 `FR-xxx`。
- 编写 `tasks.md` 时拆分为带唯一 ID（`T-xxx`）的小型纵向切片，明确依赖与关联 `FR-xxx`；实施阶段严格按任务执行，不擅自扩范围，每步完成即运行对应测试。

### 9. 独立验收与规范同步

- 开发完成不等于交付完成：需对照原始 `spec.md`、`plan.md`、`tasks.md` 与真实代码输出需求追踪矩阵（`FR-xxx` | 实现位置 | 测试用例 | 验收结果）进行独立验收。
- **规范同步更新**：功能上线或架构调整时，必须同步更新受影响的 `specs/`、`docs/` 或新增 `docs/adr/`，严禁 Spec 与实现长期脱节。

---

## 三、合并与交付门禁

满足以下条件方可合并：

1. **静态检查通过**：`pnpm lint`（含前端 `tsc --noEmit` 与根目录 `biome check .` 依赖方向/运行时禁令检查）全部通过。
2. **自动化测试通过**：在真实 PostgreSQL 18（及 S3 存储服务）环境下执行受影响测试集及全量回归（`pnpm test:all`）全部通过。
3. **契约与文档同步**：按任务分级完成对应的 `specs/` 工件（含独立验收追踪矩阵），涉及核心架构/边界/术语变更时已同步更新 `docs/` 或 `docs/adr/`。
