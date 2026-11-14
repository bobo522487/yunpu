# 文档导航

> 本文件是目录导航、两次 Constitution Check、Complexity Tracking 与编号索引的唯一权威；其他文档引用编号，不复制表格。

## 目录与分工

- `docs/requirements/`：做什么与验收（`user-stories.md`、`functional.md`、`acceptance.md`、`out-of-scope.md`）
- `docs/architecture/`：怎么做与数据长什么样（`overview.md`、`stack.md`、`runtime.md`、`modules.md`、`operations.md`、`data/`、`api/`）
- `docs/decisions/`：为什么（ADR 与缺陷决策）
- `docs/verification/`：实测证据与「待验证」登记
- `docs/superpowers/`：本次评审报告与实施计划（历史快照，不参与规格校验）
- 本仓库的完整目标架构文档位于 `docs/`；`specs/<NNN>-<feature>/` 只在后期分批实现时由 spec-kit 生成，当前不存在。批次工件引用 `docs/` 编号，不复制表格。

## 谁定义什么（导航表）

> 同一主题只在一个文件定义。下表列出每个主题文件负责的主题、它作为唯一权威的编号族，以及统一的校验命令；其它文件引用编号，不复制表格（宪法 Article VI）。

| 主题文件 | 负责的主题 | 唯一权威的编号族 | 校验命令 |
| --- | --- | --- | --- |
| `architecture/overview.md` | 目标、范围、分层与复杂度预算总览 | 唯一权威：`ARCH-*` 编号族 | `scripts/check-docs.sh --root docs --strict` |
| `architecture/stack.md` | 技术选型、锁定版本、官方依据与 Phase 0 结论 | 唯一权威：`ARCH-*` 编号族 | `scripts/check-docs.sh --root docs --strict` |
| `architecture/runtime.md` | 请求生命周期、中间件链、依赖注入与错误映射落地 | 唯一权威：`ARCH-*` 编号族 | `scripts/check-docs.sh --root docs --strict` |
| `architecture/modules.md` | 模块划分、源码目录树与依赖方向 | 唯一权威：`ARCH-*` 编号族 | `scripts/check-docs.sh --root docs --strict` |
| `architecture/operations.md` | 构建、部署、观测与运维纪律 | 唯一权威：`ARCH-*` 编号族 | `scripts/check-docs.sh --root docs --strict` |
| `architecture/data/schema.md` | 表结构、字段、约束、函数与视图 | 唯一权威：`DM-*` 编号族 | `scripts/check-docs.sh --root docs --strict` |
| `architecture/data/security.md` | RLS 策略、租户谓词与权限矩阵 | 唯一权威：`DM-*` 编号族 | `scripts/check-docs.sh --root docs --strict` |
| `architecture/data/invariants.md` | 不变量、软约束登记表与删除语义 | 唯一权威：`DM-*` 编号族 | `scripts/check-docs.sh --root docs --strict` |
| `architecture/data/indexes.md` | 索引策略与外键引用侧覆盖白名单 | 唯一权威：`DM-*` 编号族 | `scripts/check-docs.sh --root docs --strict` |
| `architecture/data/errors.md` | 错误码到 HTTP 的单一映射 | 唯一权威：`EC-*` 编号族 | `scripts/check-docs.sh --root docs --strict` |
| `architecture/data/migrations.md` | 迁移、生成物与一致性校验 | 唯一权威：`DM-*` 编号族 | `scripts/check-docs.sh --root docs --strict` |
| `architecture/api/conventions.md` | 通用 API 约定与 Phase 0 处置指针 | 唯一权威：`ARCH-*` 编号族 | `scripts/check-docs.sh --root docs --strict` |
| `architecture/api/endpoints.md` | 端点形状、请求响应与逐端点约束 | 唯一权威：`ARCH-*` 编号族 | `scripts/check-docs.sh --root docs --strict` |
| `requirements/user-stories.md` | 用户场景与 Given/When/Then 验收 | 唯一权威：`SC-*` 编号族 | `scripts/check-docs.sh --root docs --strict` |
| `requirements/functional.md` | 功能与非功能需求、Phase 0 契约项 | 唯一权威：`SC-*` 编号族 | `scripts/check-docs.sh --root docs --strict` |
| `requirements/acceptance.md` | 成功标准与全量追溯矩阵 | 唯一权威：`SC-*` 编号族 | `scripts/check-docs.sh --root docs --strict` |
| `requirements/out-of-scope.md` | 明确不做清单（唯一副本） | 唯一权威：`OOS-*` 编号族 | `scripts/check-docs.sh --root docs --strict` |


## 阅读顺序

> 1. 先读 `docs/README.md`（本文件）：导航、两次门禁、复杂度例外与编号索引。
> 2. 再读 `docs/requirements/`：做什么、验收标准与明确不做。
> 3. 然后读 `docs/architecture/overview.md`：目标、范围与分层总览。
> 4. 接着读 `docs/architecture/data/`：表结构、RLS、不变量、索引、错误码与迁移。
> 5. 最后读 `docs/architecture/api/`：端点与通用约定；技术栈、运行时、模块与运维按需查该目录其余文件。

## docs/ 与 `specs/` 的分工

> 用户决策（m00401，逐字）：我希望还是保持在 docs 目录下放完整的目标架构文档。specs/ 目录下后期再分批一步一步的实现。架构文档的目录肯定不是这几个文件名；

> `docs/` 是完整目标架构基线：按主题稳定组织，与实现批次无关；编号族只定义一次，批次工件只引用不复制。

> `specs/<NNN>-<feature>/` 只在后期分批实现时由 `/speckit-specify` 生成，按 spec-kit 官方 Project Structure 放置 `spec.md` / `plan.md` / `research.md` / `data-model.md` / `quickstart.md` / `contracts/` / `tasks.md`；其中 `tasks.md` 是 Phase 2 `/speckit-tasks` 的产物，不由 `/speckit-plan` 创建。每批次引用 `docs/` 编号，不复制表格。

> `.specify/feature.json` 是 gitignored 的本地状态；CI 用 `SPECIFY_FEATURE_DIRECTORY` 指定批次目录。二者都属于工具状态，不属于文档树。**本次重构不创建 `specs/`，不生成 `tasks.md`/`quickstart.md`**，也不写 `.specify/feature.json`。

## spec-kit 运行时状态（如实记录）

> 运行 `.specify/scripts/bash/check-prerequisites.sh --json` 的当前结果（2026-11-14 复核）：

> `ERROR: Feature directory not found. Set SPECIFY_FEATURE_DIRECTORY or run the specify command to create .specify/feature.json.`
> `ERROR: Failed to resolve feature paths`
> `prereq_exit=1`

> 当前未开始任何实现批次，故无特性目录；这不是缺陷，也不需要为了变绿而造一个 `specs/` 或伪造 `.specify/feature.json`。该事实只作记录，不改变 `docs/` 的完整性；等第一批 `/speckit-specify` 生成特性目录后再复测。

## Constitution Check（两次门禁）

> 两次门禁均已完成逐条回答：第一次 11 项自查见下方，第二次 7 行复核见其后。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| 400 行警报：`overview.md`（447 行）与 `user-stories.md`（451 行） | 两文件分别是实施计划总览与 45 条 Given/When/Then 验收清单，内容内聚，机械切分会制造跨文件重复定义 | 按行数切碎违反 `ARCH-GOV-01`（400 行是警报不是合并门禁）；保持单文件并在此登记内聚理由 |
| 400 行警报：`data/schema.md`（1496 行） | 表清单、字段、约束、RLS、索引与删除语义是同一主题，机械切分会制造跨文件重复定义 | 按行数切碎违反 `ARCH-GOV-01`（400 行是警报不是合并门禁）；保持单文件并在此登记内聚理由 |
| 18 条外键引用侧无支撑索引 | 55 条外键中 18 条缺少引用侧索引，按 Article IX 先测量再优化，逐条给理由 | 盲目补齐 18 条索引会引入写放大且未证明查询收益；改在 `data/invariants.md` 软约束登记表登记例外，由 `SC-INT-03` 断言未登记例外 = 0 |
| PgBouncer + Sentry + APM + WAF 使基础设施组件超出 3 个预算 | 连接池、错误聚合、性能追踪、边缘防护各自不可替代，缺一会造成线上不可观测 | 合并进单进程会丢失连接池复用或错误上报；按宪法 Governance 显式登记例外，不假装预算内 |
| `app.current_user_id()` 的 `EXCEPTION ... RETURN NULL` 容错 | 非法 GUC 上下文时返回 NULL，让 RLS 谓词 fail-closed（0 行），而不是抛错拖垮整库 | 抛异常会让所有含 RLS 的请求在配置错误时全量 500；按 Article VIII 登记为受控降级，补偿用例断言 0 行 |
| 模块口径 9 行表 / 8 个模块 / 7 个业务域 | 宪法复杂度预算按业务域计 7 个，`auth` 与横切 `audit` 不计入；表格行数是展示粒度不是模块数 | 强行统一成单一数字会抹掉平台服务与业务能力的差别；以 `modules.md` 的 `MODULES` 常量为唯一清单 |

## Phase 0 契约项状态

> Phase 0 的九类契约项（C1–C9）均已定值，当前**无未决项**，不再阻塞 `/speckit-tasks`。结论见 [stack.md](architecture/stack.md)，需求侧索引见 [functional.md](requirements/functional.md)。

## 编号索引

> 以下为重构前的编号索引原文；由 Task 5/9 去重、纠正位置并补齐引用。

### 1.4 Constitution Check（门禁）

> **GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.**
> 两个时点，两次检查，缺一不可。

**第一次（Phase 0 之前）——本计划自身的合规性自查：**

| #    | 宪法条款                   | 本计划的落点                                      | 通过 |
| ---- | -------------------------- | ------------------------------------------------- | ---- |
| 1    | Article I 简单胜过聪明     | 单进程单容器；8 个业务域；无抽象框架层            | ✅    |
| 2    | Article II 删掉就是删掉    | `OOS-06` 软删除不做；组织归档是状态列             | ✅    |
| 3    | Article III 规则要有执行者 | 逐条执行者见 `invariants.md` 不变量表与本文第二次门禁 7 行 | 复核 |
| 4    | Article IV 数据优于抽象    | 无 Family 表；家庭视图由关系推导（[`schema.md`](architecture/data/schema.md)） | ✅    |
| 5    | Article V 隔离靠数据库     | §7 RLS 策略是唯一租户隔离执行者                   | ✅    |
| 6    | Article VI 单一真相源      | §1.5 数据层权威；§5.3 模块清单只有一份            | ✅    |
| 7    | Article VII 不猜未来       | §16 演进触发条件；无预埋接口                      | ✅    |
| 8    | Article VIII 失败要响亮    | §8.3 错误模型；`AppError` + 全局 `onError`        | ✅    |
| 9    | Article IX 先测量再优化    | 索引策略按查询模式建，见 [`indexes.md`](architecture/data/indexes.md) | ✅    |
| 10   | 复杂度预算                 | 8 域 / 22 表 / 3 基础设施组件，均在预算内（§1.3） | ✅    |
| 11   | `OOS-01`..`OOS-19`         | 本计划未引入任何「不做」清单里的东西              | ✅    |

**第二次（Phase 1 设计之后）——写 `tasks.md` 之前的复核：**逐条回答「新增了什么、它的执行者是谁、编号是否已登记」。空着不写就等于不允许。

| # | 新增项 | 执行者 | 编号 | 编号索引登记位置 |
|---|---|---|---|---|
| 1 | 主题化 20 份文档文件 + 文档一致性校验脚本 | 测试：`scripts/check-docs.sh --strict` | `SC-DOC-01` | `docs/README.md` 编号索引表 |
| 2 | 租户隔离 RLS 策略矩阵 | DB 约束：`FORCE ROW LEVEL SECURITY` + 具名策略 | `DM-RLS-01` | `docs/README.md` 编号索引表 |
| 3 | 删除语义与级联规则 | DB 约束：具名 `fk_*` 外键 `RESTRICT` / `CASCADE` | `DM-GEN-02` | `docs/README.md` 编号索引表 |
| 4 | 事务提交后删除对象字节 | 服务层：提交后回调 + 对账脚本（软约束，见 §7.2） | `DM-MED-05` | `docs/README.md` 编号索引表 |
| 5 | 归档后禁止新写入 | 服务层：写入前状态检查（软约束，见 §7.2） | `DM-ORG-05` | `docs/README.md` 编号索引表 |
| 6 | 错误码到 HTTP 的单一映射 | 测试：`tests/docs/check-docs.test.sh` 断言 `errors.md` 的映射表与 `ErrorCode` 枚举一致 | `ARCH-ERR-01` | `docs/README.md` 编号索引表 |
| 7 | 模块清单与源码目录树 | 服务层：`MODULES` 常量 + 测试断言，清单只一份 | `ARCH-MOD-01` | `docs/README.md` 编号索引表 |

**触发 Complexity Tracking 的条件**：任何设计需要突破 §1.3 复杂度预算、引入新抽象层、或放宽「明确不做」清单。登记三列——Violation / Why Needed / Simpler Alternative Rejected Because（见 §20）。

## 20. Complexity Tracking（复杂度例外登记）

> 复杂度例外的唯一权威表是本文开头的 `## Complexity Tracking` 三列表（Violation / Why Needed / Simpler Alternative Rejected Because）；本节只保留 spec-kit §20 编号锚点，不复制表格（Article VI）。
> 登记三列缺一不可：**违反了什么 / 为什么必须 / 更简单的替代方案为何被否**。本表不得事后补记；设计评审时未登记的例外视为未获批准，实现按缺陷处理（宪法 Governance · 违反处理）。

---

## 21. 编号索引表（`ARCH-*`）

> 与数据模型 §18 的 `DM-*` 索引表同构：**引用编号必须能在本表找到定义**。
> 校验目标（由 `scripts/check-docs.sh --root docs --strict` 执行）：悬空引用 0、一号两义 0、断链 0、无 CRLF、无未决澄清标记。「未引用 0」无执行者，不作为门禁（见任务 ledger Ruling）。

| 编号           | 一句话定义                                           | 本文位置         |
| -------------- | ---------------------------------------------------- | ---------------- |
| `ARCH-AR-01`   | 领域逻辑只有一份：规则只存在于该域的 service         | §0, §5.2         |
| `ARCH-AR-02`   | 隔离靠数据库：租户边界写在 RLS 策略里                | §0, §7           |
| `ARCH-AR-03`   | 谱系是图不是树：关系边是事实，`ltree` 路径是位置投影 | [`schema.md`](architecture/data/schema.md) |
| `ARCH-AR-04`   | 规则要有执行者：没有执行者的条目不写进文档           | §0, §1.2         |
| `ARCH-AR-05`   | 依赖单向：前端 → API → service → 数据层              | §1.2, §5.2, §5.3 |
| `ARCH-AR-06`   | 单一真相源：一份 Zod schema、一份数据模型            | §1.2, §5.3, §8.5 |
| `ARCH-AR-07`   | 约束必须有执行者                                     | §1.2             |
| `ARCH-AR-08`   | 失败要响亮：禁止静默吞异常                           | §1.2, §8.3       |
| `ARCH-AR-09`   | 不猜未来：不预埋空实现                               | §1.2, §16        |
| `ARCH-API-01`  | `uuidv7()` 主键时间有序，主键本身即游标              | §8.7             |
| `ARCH-AUD-01`  | 审计完整性诚实降级为软约束并登记                     | §12.2            |
| `ARCH-BLD-01`  | pnpm 是全仓库唯一包管理器，Dockerfile 与之一致       | §3, §15.1        |
| `ARCH-CC-01`   | 并发控制用事务级 advisory lock，不锁 project 行      | §11.2            |
| `ARCH-ERR-01`  | 错误两级映射：先看 SQLSTATE，再看约束名              | §8.3             |
| `ARCH-FE-05`   | 只做一条画布渲染路径                                 | §9.2             |
| `ARCH-GOV-01`  | 400 行红线是警报，不是合并门禁（定义见 `.specify/memory/constitution.md`） | [`constitution.md`](../.specify/memory/constitution.md) |
| `ARCH-HONO-01` | DI 选 `Hono<AppEnv>` + `c.get()`；官方 `createFactory({ initApp })` 亦可跨文件注入 | [`runtime.md`](architecture/runtime.md) |
| `ARCH-RPC-01`  | RPC 类型推断：全链式调用 + 具名变量推断               | [`stack.md`](architecture/stack.md) |
| `ARCH-HONO-02` | 中间件洋葱模型：进入正序、返回逆序                   | [`runtime.md`](architecture/runtime.md) |
| `ARCH-HONO-03` | 优先用 Hono 内置中间件，不采用须写明理由             | §10.1            |
| `ARCH-HONO-04` | 路径参数与查询参数必须经 `zValidator` 校验           | [`runtime.md`](architecture/runtime.md) |
| `ARCH-HONO-05` | 不用全局 `declare module 'hono'` 扩展变量            | [`runtime.md`](architecture/runtime.md) |
| `ARCH-HONO-06` | OpenAPI 用官方 `@hono/zod-openapi`                   | §3, §8.8         |
| `ARCH-HONO-07` | `onError` 必须同时处理 `HTTPException`               | §8.3             |
| `ARCH-HONO-08` | 校验的官方语义（各 target 取值来源）                 | §8.6             |
| `ARCH-HONO-09` | 校验失败响应体由 hook 统一                           | [`runtime.md`](architecture/runtime.md) |
| `ARCH-HONO-10` | Bun 入口与静态资源：媒体走 API 鉴权代理              | §15.1.1          |
| `ARCH-HONO-11` | Hono 升级大版本前重核官方实践表                      | §18              |
| `ARCH-HONO-12` | RPC 客户端用官方 `hc<AppType>`，不手写路径           | [`stack.md`](architecture/stack.md) |
| `ARCH-IDX-01`  | 索引按查询模式建，不设机械的「RLS 谓词列首列」规则   | [`indexes.md`](architecture/data/indexes.md) |
| `ARCH-MOD-01`  | 模块清单只有一份：`MODULES` 常量                     | §5, §9.3         |
| `ARCH-OPS-01`  | 回滚 = 恢复备份，不是 down migration                 | §15.3, §15.5     |
| `ARCH-PERM-01` | 同一授权规则不允许写两遍                             | §7.5, §10        |
| `ARCH-PUB-01`  | 出版同步起步，有明确上限，不留白                     | §11.6            |
| `ARCH-TST-03`  | 测试分层：`bun test` + Playwright，均可跑在 Bun 1.4 上 | [`stack.md`](architecture/stack.md) |
| `ARCH-TST-04`  | 路由测试用 `app.request()` 官方调用约定              | §14.1            |

**编号规则**：`ARCH-<域>-<序号>`。域代码含义——`AR` 架构原则 / `API` 接口分页 / `AUD` 审计 / `BLD` 构建 / `CC` 并发控制 / `ERR` 错误 / `FE` 前端 / `GOV` 治理 / `HONO` Hono 官方实践 / `IDX` 索引 / `MOD` 模块 / `OPS` 运维 / `PERM` 权限 / `PUB` 出版 / `TST` 测试。

**编号唯一性**（`DM-GEN-21`）：同一编号不得承载两条规则。历史版本修订保留原编号并标注版本号，不复用编号表达新规则。

---

## 18. 编号索引表

**规则（`DM-GEN-21`）**：每个编号在全文档中只承载一条规则；引用编号必须在下表中有定义；下表中的编号全部有正文定义。

### 18.1 编号交叉引用

`ARCH-*` 与 `DM-*` 的定义分别见本文 §21 与 §18；两侧主题文件用编号互相引用，不复制规则正文（宪法 Article VI）。

> **反向引用规则**：架构侧引用本文用 `DM-*`，本文引用架构侧用 `ARCH-*`。任何一个编号必须能在本文 §21 / §18 找到定义——由 [`check-docs.sh`](../scripts/check-docs.sh)（`SC-DOC-01`）保证。


| 编号 | 规则摘要 | 定义位置 |
|---|---|---|
| `DM-GEN-01` | 每条不变量必须能指出执行者 | §1 |
| `DM-GEN-02` | 枚举 / 权限矩阵 / 表清单只有一份来源 | §1, §4.5 |
| `DM-GEN-03` | 规范之间不得互相否定 | §1 |
| `DM-GEN-04` | 事实只存一次，可推导的不落库 | §1 |
| `DM-GEN-05` | 能用约束表达的规则不写成应用层 if | §1 |
| `DM-GEN-06` | 约束必须能在真实 PG 18 上稳定执行 | §1 |
| `DM-GEN-07` | 视图是只读投影，必须 `security_invoker` | §1, §6 |
| `DM-GEN-08` | 每个外键显式声明删除动作的业务含义 | §1, §10 |
| `DM-GEN-09` | 数据库不猜语义：原文不被规范化值覆盖 | §1, §5.6 |
| `DM-GEN-10` | 先测量再优化 | §1, §11.4 |
| `DM-GEN-11` | 约束保护事实，不保护排版 | §1, §5.8 |
| `DM-GEN-12` | 锁只加在真正需要串行化的写者上 | §1, §5.8 |
| `DM-GEN-13` | 约束必须具名 | §1, §4.1 |
| `DM-GEN-14` | 非空文本字段必须带 `btrim(x) <> ''` | §1, §4.2 |
| `DM-GEN-15` | `updated_at` 由 DB 推进且严格单调递增 | §1, §4.4 |
| `DM-GEN-16` | 软约束必须登记并有补偿测试 | [`schema.md`](architecture/data/schema.md) |
| `DM-PURGE-01` | Person 物理清除（GDPR）V1 不做，走独立运维流程 + 审计 | [`invariants.md`](architecture/data/invariants.md) |
| `DM-GEN-17` | 每条外键的引用侧列必须有支撑索引 | §1, §11.2 |
| `DM-GEN-18` | 应用错误按「SQLSTATE + 约束名」映射，不解析文本 | §1, §4.6, §9.4 |
| `DM-GEN-19` | 清单类内容由生成物产出并被反向校验 | §1, §4.5, §12.3 |
| `DM-GEN-20` | 不依赖数据库默认值 | §1, §2.1 |
| `DM-GEN-21` | 编号唯一且可追溯 | §1, §18 |
| `DM-TEN-01` | 跨 Organization 不可见 | §7.1 #1 |
| `DM-SCP-01` | 租户和 Project scope 不可迁移 | §4.3, §7.1 #22 |
| `DM-SCP-02` | 每条内容属于唯一 Organization / Project | §4.3, §7.1 #2 |
| `DM-SCP-03` | 不存在跨 Project 引用 | §7.1 #3 |
| `DM-ORG-01` | 每个 Organization 恰好一个 owner | §5.1, §7.1 #4 |
| `DM-ORG-02` | owner 必须是成员 | §5.1, §7.1 #5 |
| `DM-ORG-03` | 不能删除 owner 的成员行 | §5.1, §7.1 #6 |
| `DM-ORG-04` | 创建组织必须在同一事务内插组织 + owner 成员行 | §5.1 |
| `DM-ORG-05` | 组织归档后禁止新写入（软约束） | §7.2 |
| `DM-ORG-06` | `organization_member.role` 无 `owner` 值 | §5.2 |
| `DM-ORG-07` | 成员增删改的角色授权（软约束） | §7.2 |
| `DM-PER-01` | `surname` 的三条硬规则 | §5.6 |
| `DM-NAM-01` | 每人最多一个主姓名 | §5.7, §7.1 #7 |
| `DM-NAM-02` | 同人同类型同值唯一 | §5.7 |
| `DM-REL-01` | 世系父边反向二元环被拒 | §5.8 |
| `DM-REL-02` | 反向非世系边允许并存 | §5.8 |
| `DM-REL-03` | 对称关系唯一物理表示 | §5.8, §7.1 #10 |
| `DM-REL-04` | 展示顺序不唯一 | §5.8, §7.1 #38 |
| `DM-REL-05` | 世系父边不能形成环 | §5.8, §7.1 #11 |
| `DM-REL-06` | 锁顺序与超时 | §5.8 |
| `DM-REL-07` | 并发正确性必须在目标仓库真实 PG 18 上实测 | §5.8 |
| `DM-REL-08` | 关系两端同 Project 且不同人物 | §5.8, §7.1 #8 |
| `DM-REL-09` | 同一对人物同一 kind 不重复 | §5.8, §7.1 #9 |
| `DM-REL-10` | 非世系关系不参与环检查 | §5.8, §7.1 #12 |
| `DM-REL-11` | 世系写锁不阻塞同 Project 其他写入 | §5.8, §7.1 #50 |
| `DM-REL-12` | `kind` 取值单一来源 | §5.8, §7.1 #49 |
| `DM-EVT-01` | Event 至少有一项非空白内容 | §5.9, §7.1 #16 |
| `DM-EVT-02` | Event 恰好关联 Person 或 Relation | §5.9, §7.1 #13 |
| `DM-EVT-03` | Event 类型属于对应域 | §5.9, §7.1 #14 |
| `DM-EVT-04` | Event 日期范围有序 | §5.9, §7.1 #15 |
| `DM-EVT-05` | Relation 类型与 Event 类型匹配（软约束） | §7.2 |
| `DM-NOD-01` | Node 重排纪律（单语句一次写完） | §5.11 |
| `DM-NOD-02` | Node 的 path 唯一、格式合法 | §5.11, §7.1 #17 |
| `DM-NOD-03` | 父路径存在且严格更短（结构性无环） | §5.11, §7.1 #18 |
| `DM-NOD-04` | 每人每 Lineage 最多一个 primary | §5.11, §7.1 #19 |
| `DM-NOD-05` | annotation 无人物，人物节点有 Person | §5.11, §7.1 #20 |
| `DM-NOD-06` | 根是顶层节点 | §5.11, §7.1 #21 |
| `DM-NOD-07` | Node 编排依据的语义正确（软约束） | §7.2 |
| `DM-SRC-01` | Citation 目标同 Project | §5.13 |
| `DM-ART-01` | `article_page.content` 至少含 `type` | §5.15, §7.1 #33 |
| `DM-MED-01` | 每个对象字节有唯一主人 | [`schema.md`](architecture/data/schema.md) |
| `DM-MED-02` | 孤儿字节回收靠桶级对账 | [`schema.md`](architecture/data/schema.md) |
| `DM-MED-05` | 对象字节在事务提交后删除（软约束，有补偿测试） | [`invariants.md`](architecture/data/invariants.md) |
| `DM-MED-03` | `object_key` 物理唯一 | §5.16, §7.1 #23 |
| `DM-MED-04` | 媒体引用存在、同 Project | §7.1 #35 |
| `DM-INV-01` | token 唯一、只存哈希、熵 ≥ 256 bit | §5.3, §7.1 #24 |
| `DM-INV-02` | 邀请邮箱一致性 | §5.3, §7.1 #27 |
| `DM-INV-03` | 邀请并发兑换抢占 | §5.3, §7.1 #27 |
| `DM-INV-04` | 同邮箱单条待处理邀请 | §5.3, §7.1 #25 |
| `DM-INV-05` | 邀请状态与时间一致 | §5.3, §7.1 #26 |
| `DM-BOK-01` | 出版快照不可修改 | §5.21, §7.1 #28 |
| `DM-BOK-02` | 出版记录不可直接删除 | §5.21, §7.1 #29 |
| `DM-BOK-03` | Book 有 release 时不能删除 | §5.21, §7.1 #30 |
| `DM-BOK-04` | 编目项类型与内容引用匹配 | §5.20, §7.1 #37 |
| `DM-BOK-05` | 产物字节纪律 | §5.21 |
| `DM-AUD-01` | 审计的完整性分级（强 / 尽力而为） | §5.22, §7.2 |
| `DM-AUD-02` | `audit_log` 只追加 | §5.22, §7.1 #31 |
| `DM-RLS-01` | 上下文缺失时默认拒绝 | §8.2 |
| `DM-RLS-02` | 所有业务表启用 `ENABLE` + `FORCE` | §8.2 |
| `DM-RLS-03` | 业务视图必须 `security_invoker` | §6 |
| `DM-PERM-01` | `rls_definer` 的权限清单按函数最小化 | §8.5 |
| `DM-POOL-01` | 会话超时由连接串下发，Drizzle `prepare: false` | §5.8, §12.5 |
| `DM-IDX-01` | 索引按查询模式建，无机械规则 | §8.2, §11 |
| `DM-ADR-01` | 世系写入用事务级 advisory lock | §15 |
| `DM-ADR-02` | 关系排序不唯一 | §15 |
| `DM-ADR-03` | 世系反向二元环拒绝 | §15 |
| `DM-ADR-04` | 索引首列无机械规则 | §15 |
| `DM-ADR-05` | 审计完整性两级分级 | §15 |
| `DM-ADR-06` | 产物字节归 `book_release` 行 | §15 |
| `DM-ADR-07` | 孤儿字节靠对账脚本 | §15 |
| `DM-ADR-08` | Node 重排单语句写完 | §15 |
| `DM-ADR-09` | 权限规则来源单一 | §15 |
| `DM-ADR-10` | 路径容量上限触达时重建 lineage | §5.11, §15 |
| `DM-ADR-11` | 生成列一律显式 `STORED` | §15 |
| `DM-ADR-12` | `invite` 状态变更只经受控函数 | §15 |
| `DM-ADR-13` | 所有权并发控制用 CAS | §15 |
| `DM-ADR-14` | 会话超时由 `PGOPTIONS` 下发 | §15 |

**统计**：编号清单与一致性由 [`check-docs.sh`](../scripts/check-docs.sh) 的 `--strict` 输出（R4/R5/R7）与 CI 生成；人工不维护手写计数。

---
