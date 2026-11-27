# Yunpu Agent Instructions

本文件是 AI 协作的入口与操作手册。项目级原则、架构与编码细则维护在 `docs/` 下；**不要把全量架构或代码细节堆入本文件**，动手前按需查阅对应文档。

## 文档导航（先查再动手）

| 文档 | 用途 | 路径 |
| :--- | :--- | :--- |
| 工程宪法与合并门禁 | AI 协作红线、Yunpu 系统不变量、SDD 治理原则、合并门禁 | [docs/constitution.md](docs/constitution.md) |
| 系统架构与边界 | 模块划分、技术栈、依赖方向、租户事务边界 | [docs/architecture.md](docs/architecture.md) |
| 编码与测试规范 | Lint/导入限制、错误映射、事务/RLS、测试与验收细则 | [docs/coding-standards.md](docs/coding-standards.md) |
| 业务术语表 | 唯一权威领域术语与禁用同义词 | [docs/glossary.md](docs/glossary.md) |
| 架构决策记录 | 关键技术决策与历史取舍（ADR） | [docs/adr/](docs/adr/) |
| 高频错题本 | 动手前必看；严控 ≤ 30 条，必带日期或 `@commit` | [docs/pitfalls.md](docs/pitfalls.md) |
| Spec 增强格式模板 | `FR-xxx` + 正常/异常态 + Seams + 验收追踪矩阵（配合 `/to-spec`） | [docs/spec-template.md](docs/spec-template.md) |
| 历史 Spec 归档（只读） | 旧版三件套 SDD 历史归档（`001`~`004`），新需求统一走 GitHub Issues | [specs/INDEX.md](specs/INDEX.md) |

---

## 研发工作流（对齐 `bobo522487/agent-skills`）

### 1. 唯一主干工作流

- **极小微调直通**：改文案、一行修补或明确局部小改，直接对话修改并跑局部验证，不敲任何斜杠命令。
- **唯一 5 步主干**（凡是需要设计/动脑的需求统一走此链路，不做 L0~L3 分级）：
  1. `/grill-with-docs` — 拷问对齐，同步维护 [docs/glossary.md](docs/glossary.md) 与 [docs/adr/](docs/adr/)
  2. `/to-spec` — 锁定契约（叠加 [docs/spec-template.md](docs/spec-template.md) 编 `FR-xxx`、正常/异常态、Seams 与验收矩阵），发布到 GitHub Spec Issue
  3. `/to-tickets` — 拆垂直切片并建立原生阻塞边（DAG），发布为 GitHub 子 Issue
  4. `/swarm`（或单票 `/goal`）+ `/tdd` — 内核驱动实施与行为测试
  5. `/code-review` — 双轴只读证据审查（Standards + Spec）并输出需求追踪矩阵；PASS 后回写 [docs/glossary.md](docs/glossary.md) / [docs/adr/](docs/adr/) / [docs/pitfalls.md](docs/pitfalls.md) 完成复利沉淀
- **按需挂件与常态抗熵增**：
  - 硬核 Bug / 竞态 / 性能回退：`/boost` + `/diagnosing-bugs`
  - 含前端页面与交互变更：`/browser` 实测验收
  - 旁路提问：`/btw`；阶段切换清上下文：`/compact`
  - 常态抗熵增（每 3~5 天）：`/improve-codebase-architecture`，挑 1 个浅模块做深

### 2. 六条硬纪律

1. **不问可查事实**：代码/文档可查清的事实与跑小实验可证伪的分叉自己消化，提问只留给业务规则与异常四态。
2. **需求可追踪**：`/to-spec` 每条功能需求必编唯一 ID（`FR-001`…）；`/code-review` Spec 轴收尾必输出矩阵：`需求 ID | 实现位置 | 测试用例 | 验收结果`。
3. **只读证据制审查**：Review 严禁边审边改；每条 Blocker/Major 必附 `文件:行号` 与触发路径，严查重复造轮子与「新旧两套写法并存」。
4. **两级有界验证**：单票实施只跑本领域局部快测（`<= 30s`）；合并收尾统一跑完整合并门禁（见 [docs/constitution.md](docs/constitution.md) 第四节）。
5. **2 轮熔断（Attack the Premise）**：同一问题返修满 2 轮未过，禁止第 3 轮盲修——必须先列出并证伪前两轮共同依赖的底层假设，或交人工拍板。
6. **记忆单一真源与错题晋升**：`/learn` 仅记跨项目个人偏好，项目踩坑一律进 [docs/pitfalls.md](docs/pitfalls.md) 且标日期/`@commit`（过时标 `superseded`）；同类失误命中 `>= 2` 次必须固化为「唯一入口 > 静态类型 > 物理边界/Lint 门禁（`biome.json` / `apps/web/eslint.config.js` / `tests/runtime/`，后续接入则含 `dependency-cruiser`）> 测试」，固化后删文字。

---

## Agent skills

### Issue tracker

仓库 Issue 托管在 GitHub（`bobo522487/yunpu`），统一使用 `gh` CLI 操作。详见 `docs/agents/issue-tracker.md`。

### Triage labels

采用默认 5 个标准分诊标签（`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`）。详见 `docs/agents/triage-labels.md`。

### Domain docs

Single-context 布局：统一术语表位于 `docs/glossary.md`，架构决策位于 `docs/adr/`。详见 `docs/agents/domain.md`。
