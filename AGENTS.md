# Yunpu Agent Instructions

本文件是 AI 协作的入口与规则导航。项目级规范分模块维护在 `docs/` 下，功能级规格维护在 `specs/` 下；**不要把全量架构或代码细节堆入本文件**，开始工作前按需查阅对应文档。

## 文档导航

| 文档 | 用途 | 路径 |
| :--- | :--- | :--- |
| 项目原则与约束 | 工程底线、SDD 治理原则、合并门禁 | [docs/constitution.md](docs/constitution.md) |
| 系统架构与边界 | 模块划分、技术栈、依赖方向、租户事务边界 | [docs/architecture.md](docs/architecture.md) |
| 编码与测试规范 | Lint/导入限制、错误映射、事务/RLS、测试与验收要求 | [docs/coding-standards.md](docs/coding-standards.md) |
| 业务术语表 | 统一领域术语与禁用同义词 | [docs/glossary.md](docs/glossary.md) |
| 架构决策记录 | 关键技术决策与历史取舍（ADR） | [docs/adr/](docs/adr/) |
| 功能级 Spec 模板 | SDD `spec.md` / `plan.md` / `tasks.md` 标准模板 | [specs/_templates/](specs/_templates/) |
| 功能 Spec 目录 | 各独立功能/变更规格（`001`~`002` 为历史档案） | [specs/INDEX.md](specs/INDEX.md) |

---

## SDD 开发工作流（Spec-Driven Development）

按以下流程推进需求，不允许跳过澄清或让 Spec 与代码脱节：

1. **需求分析（先提问，不直接写代码）**：识别业务目标、用户角色与权限、功能需求与业务规则、正常/异常/边界流程、模糊/冲突/缺失项、范围与非目标。关键业务规则未澄清前不得自行猜测补全。
2. **编写 `spec.md`**（模板：[specs/_templates/spec.md](specs/_templates/spec.md)）：只描述业务行为、规则、异常处理和可验证的验收标准，每条需求使用唯一 ID（如 `FR-001`），不写技术实现细节。
3. **技术设计 `plan.md`**（模板：[specs/_templates/plan.md](specs/_templates/plan.md)）：**先阅读现有代码与 `docs/` 文档，再制定方案**。优先复用现有架构，不无故引入依赖，所有设计必须可追溯到 `FR-*`，完成后等待确认再拆解/编码。
4. **任务拆解 `tasks.md`**（模板：[specs/_templates/tasks.md](specs/_templates/tasks.md)）：拆分为小型、可独立验证的任务（`T-001`...），明确依赖、关联 `FR-*`、修改范围、迁移/接口/配置影响及测试要求，优先纵向功能切片。
5. **AI 实施**：严格按 `tasks.md` 依赖顺序执行，改前先查现有实现，不擅自扩大范围或更改业务规则；每完成一项即运行对应测试并更新 `tasks.md` 状态，发现 Spec 缺失或设计冲突立即暂停并报告。
6. **自动测试**：运行静态检查、单元测试与真实 PostgreSQL 集成测试，验证正常、异常、并发、事务与权限边界。
7. **独立验收**：对照原始 `spec.md`、`plan.md`、`tasks.md` 和实际代码做独立质量审查，输出「需求 ID | 实现位置 | 测试用例 | 验收结果」追踪矩阵；不能只凭「代码能跑」或自证通过。
8. **规范同步**：代码、架构、边界、术语或原则发生变化时，同步更新 `docs/`、新增或更新 `docs/adr/`，保持 Spec 与代码一致。

### 分级执行策略

不同规模的任务采用匹配深度的流程：
- **简单修改**（单点文案、局部 bug、明确小改）：直接沟通 + 修改 + 对应测试。
- **普通功能**：`spec.md` + `plan.md` + `tasks.md` + 按任务实施与测试。
- **复杂模块**（跨表、权限、状态机、前端联动）：完整 SDD 8 步流程 + 自动化测试 + 独立验收 + 人工审核。
- **核心架构变更**：完整 SDD + 新增 `docs/adr/ADR-XXXX-*.md` + 安全审查 + 迁移验证。

---

## 领域术语与 ADR 规则

- **命名一致性**：在代码、测试、Issue、Spec 和评审输出中命名领域概念时，必须使用 [docs/glossary.md](docs/glossary.md) 定义的术语，避免混用其标注的禁用同义词（如勿将 `Organization` 称作 `Workspace`/`Team`，勿将 `Person` 称作 `User`/`Account`）。
- **ADR 冲突标记**：若新方案与 `docs/adr/` 中标记为 `accepted` 的决策冲突，必须显式说明原因并提起新 ADR 替代，不得静默覆盖。

---

## Issue Tracker 约定（GitHub）

仓库 Issue 托管在 GitHub `bobo522487/yunpu`，统一使用 `gh` CLI 操作（避免直接向外部上游仓库提 Issue）：

- **查看 / 列表**：`gh issue view <n> --json number,title,body,labels,comments`；`gh issue list --state open`。
- **创建 / 关联**：`gh issue create --title "..." --body "..."`；子任务使用 `--parent <parent>` 或在正文标注 `Part of #<parent>`；阻塞关系使用 `--blocked-by` 或 `Blocked by: #<n>`。
- **更新 / 关闭**：先 `gh issue comment <n> --body "..."` 说明结果，再 `gh issue close <n>`（先关后评可能丢失评论）。
- **编号消歧**：GitHub 的 Issue 与 PR 共享编号空间，可用 `gh pr view <n>` / `gh issue view <n>` 区分。
