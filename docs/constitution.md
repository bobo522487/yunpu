# Yunpu Constitution

本文档定义 Yunpu 项目的长期工程红线、系统不变量、SDD 研发治理规范与合并门禁，与上游 `mattpocock/skills` 叠加而非替代。若需修改或废止下列原则，必须在 [docs/adr/](adr/) 新增或更新对应架构决策记录，写明背景、替代方案与放弃的权衡。

---

## 一、AI 协作与通用工程红线

### 1. 语言与表达

- 全程简体中文：思考、沟通、文档与代码注释；专有名词、代码标识符保留原文。
- 结论先行：先给方案和结果，再给理由；不说套话，不无端推诿。
- 文件、接口、测试结果只写已核实的；不确定的地方直接说明，绝不编造。

### 2. 先定方案，再动代码

- 多文件修改、新功能架构、复杂重构：先输出简洁的修改计划与文件清单（或走 SDD 唯一主干），确认后再动手。
- 局部小改动直接执行；遵循最小改动原则，不顺手重写或格式化无关代码。

### 3. 工程与代码规范

- 严格遵循现有目录结构、代码风格、命名规范，以及既有包管理器（`pnpm`）与锁文件；未经明确要求，不升级依赖版本，不引入不必要的重型库。
- **深模块优先**：用小而稳的接口隐藏复杂度，杠杆来自接口压缩而非文件数量。
- **先减后加、零双轨**：新路径上线前移除旧路径，同一件事只留一套写法。
- **测行为不测实现**：断言可观察结果与边界状态，不依赖内部调用与私有结构。
- **单 schema 边界校验**：外部输入在边界按同一 schema 校验一次，内部信任已校验的结构。
- **依赖要有理由**：新增依赖必须写明它解决的具体问题，以及现有技术栈为何覆盖不了。

### 4. 安全红线

- 严禁在代码、日志或提交记录中硬编码 API Key、密码等敏感信息；敏感值只从外部注入。
- 不可逆或高风险操作（批量删除文件、覆盖重要数据、`git push --force`、修改系统全局环境变量等），执行前必须先提示并征得同意。

### 5. 验证与交付

- 每次修改后，跑对应层级的本地构建、静态检查或测试，确认改动生效。
- 汇报时列出修改的文件与跑过的验证；严格区分「已实测通过」与「未验证」。

---

## 二、Yunpu 系统不变量

### 1. 非法状态存不进去

能由 PostgreSQL 拒绝的非法数据组合，必须下沉到数据库约束（`CHECK`、`UNIQUE`、部分唯一索引、复合外键、`RESTRICT`/`CASCADE`、延迟/立即约束触发器）执行。禁止把核心数据完整性仅寄托于散落的应用层判断或口头约定。

### 2. 同一事实只有一处权威

- **数据结构、约束与策略**：以 `packages/db/migrations/` 已执行迁移及同次变更中与之对齐的 Drizzle schema（`packages/db/src/schema/`）为准。
- **对外 HTTP 契约**：以 `apps/api/src/openapi/operations.ts`（导出 `contracts/openapi.json`）、`apps/api/src/app.ts` 导出的 `AppType` 及 `packages/shared/src/schemas.ts`、`enums.ts` 为准。
- **错误码与 HTTP 状态映射**：以 `packages/shared/src/errors.ts` 的 `ERROR_STATUS` 与 `apps/api/src/lib/errors.ts` 的 `mapDatabaseError`（按 SQLSTATE 和约束名映射，不解析错误文本）为准。
- **业务规则与验收契约**：新功能以 GitHub 仓库 `bobo522487/yunpu` 对应功能的 Spec Issue（含 `FR-xxx` 与验收标准）为准；历史功能 `001`~`004` 以只读归档 `specs/NNN-*/spec.md` 为准（见 [ADR-0020](adr/ADR-0020-adopt-minimal-sdd-workflow.md)）。

### 3. 失败对调用方显式可见

禁止静默吞掉异常或把失败伪装成成功。后端错误必须通过 `AppError` 或 `mapDatabaseError` 转换为标准错误响应向上返回；非预期的未处理错误必须携带 `requestId` 记录结构化日志。

### 4. 租户数据严格隔离

租户数据隔离由 PostgreSQL `FORCE ROW LEVEL SECURITY` 策略强制执行。业务模块与普通后台任务只能通过 `withTenantTransaction` 进入事务，在事务内切换 `SET LOCAL ROLE genealogy_app` 并设置事务局部 `app.user_id`，断言角色已切换后才执行业务 SQL；连接归还即清空身份。回滚失败或连接级故障的会话必须销毁，不得放回池中复用。禁止业务模块绕过该入口直接借用连接池。

例外入口（健康检查、认证库、数据库迁移、离线孤立媒体对账 GC）明确登记在 [docs/architecture.md](architecture.md)，严禁扩展或挪用。

### 5. 简单胜过聪明

优先使用清晰直接的表结构、数据库约束、显式依赖和单层服务调用；不为尚未落地的需求预建空表、空索引或过度抽象层（如无意义的透传 Repository/Mapper 或 DI 容器）。当且仅当模块边界在演进中反复出现耦合时再调整划分。

### 6. 删除即物理删除

业务实体的删除语义为物理删除（由外键级联或 `RESTRICT` 保护关联完整性）。`archived` 等状态仅用于表达生命周期状态，不替代删除语义。

---

## 三、SDD 研发治理原则

### 1. 唯一主干与先澄清再锁契约

- 极小微调（改文案、一行修补）直接对话修改并跑局部验证；凡涉及设计或跨模块变更的需求，取消 L0~L3 分级，统一走 5 步主干：`/grill-with-docs` → `/to-spec` → `/to-tickets` → `/swarm`（或单票 `/goal`）+ `/tdd` → `/code-review`。
- 关键业务规则与异常四态未对齐前，禁止自行猜测或直接写实现代码；可查代码/文档或小实验证伪的事实自行核查，不向用户提问。
- `/to-spec` 叠加 [docs/spec-template.md](spec-template.md) 格式发布到 GitHub Spec Issue：每条功能需求必编唯一 ID（`FR-001`…），明确正常态、异常态、测试接缝（Seams）与验收标准，不混入易过期的实现细节。

### 2. 垂直切片与行为驱动实施

- `/to-tickets` 将 Spec 拆分为可独立验证的垂直切片子 Issue（非按层横切），在 GitHub 上使用原生阻塞依赖（DAG）声明顺序，每个切片控制在单个干净上下文窗口内；仅全仓机械重构可例外采用 expand–contract 序列。
- 实施前先读现行代码、[docs/glossary.md](glossary.md)、相关 [docs/adr/](adr/) 与 [docs/pitfalls.md](pitfalls.md)，优先复用既有模块与深模块边界，结合 `/tdd` 测行为不测实现。

### 3. 双轴只读验收、2 轮熔断与复利沉淀

- 开发完成不等于交付完成：须运行 `/code-review` 执行双轴只读审查（Standards 轴对照规范与异味基线，Spec 轴对照 GitHub Spec Issue 输出 `需求 ID | 实现位置 | 测试用例 | 验收结果` 追踪矩阵）。审查严禁边审边改，每条 Blocker/Major 须附 `文件:行号` 与触发路径。
- **2 轮熔断（Attack the Premise）**：同一问题返修满 2 轮仍未通过，禁止第 3 轮盲修——必须先列出并证伪前两轮共同依赖的底层假设，或交人工拍板。
- **规范同步与错题晋升**：验收 PASS 后同步更新受影响的 [docs/glossary.md](glossary.md)、[docs/architecture.md](architecture.md) 或 [docs/adr/](adr/)；项目踩坑一律记入 [docs/pitfalls.md](pitfalls.md)（带日期或 `@commit`，过时标 `superseded`，严控 ≤ 30 条）。同类失误命中 `>= 2` 次必须固化为物理门禁（优先级：`唯一入口 > 静态类型 > 物理边界/Lint 门禁（biome.json / apps/web/eslint.config.js / tests/runtime/，后续接入则含 dependency-cruiser）> 测试`），固化后删掉文字描述。

---

## 四、合并与交付门禁

遵循**两级有界验证**：单票切片开发期仅跑本领域局部快测（`<= 30s`）与局部静态检查；合并前须满足以下全部门禁（与 `.github/workflows/verify.yml` 对齐）：

1. **静态与边界检查通过**：`pnpm lint`（`lint:api`：`biome check .` + API `tsc --noEmit`；`lint:web`：`eslint .` + `tsr generate && tsc -b`）全部通过。
2. **契约无漂移**：`pnpm contract:check` 通过（修改路由或共享 Schema 后已执行 `pnpm contract:export` 并提交 `contracts/openapi.json`）。
3. **真实环境后端回归通过**：在真实 PostgreSQL 18 与 S3 存储服务环境下执行 `pnpm test:all` 全部通过（禁止仅用 Mock 验证数据库约束、RLS、触发器或事务重试）。
4. **前端构建与测试通过**（涉及前端变更时）：`pnpm run build:web`、`pnpm run test:web` 通过；涉及页面交互或渲染变动时补跑 `pnpm run test:web:browser` 或 `/browser` 实测验收。
5. **双轴审查与文档同步**：非极小微调已完成 `/code-review` 双轴只读审查通过并附 `FR-xxx` 需求追踪矩阵；涉及核心架构、边界、术语、原则或踩坑时已同步更新 `docs/`、`docs/adr/` 与 [docs/pitfalls.md](pitfalls.md)。
