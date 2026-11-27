---
status: accepted
---

# ADR-0020: 切换至 Antigravity 极简 SDD 工作流与 GitHub Issues 单轨契约

## Context

Yunpu 早期在 [docs/constitution.md](../constitution.md) 中固化了文件式三件套 SDD（`specs/NNN-*/{spec,plan,tasks}.md` 与 `specs/_templates/`），并在迭代中引入过任务分级。随后本仓库引入 `bobo522487/agent-skills`（`@9747f0a`）与精选 `mattpocock/skills`，在仓库中形成了明显的新旧双轨与自相矛盾：

1. **Spec 契约双轨**：新流程通过 `/to-spec`（叠加 `docs/spec-template.md`）与 `/to-tickets` 将契约与垂直切片发布到 GitHub Issues，但 `docs/constitution.md`、`docs/coding-standards.md` 与 `AGENTS.md` 仍指向 `specs/_templates/` 及仓库内 `spec.md`/`plan.md`/`tasks.md`。
2. **规则与术语路径漂移**：`AGENTS.md` 混杂了纯文本粘入的操作规则与 `GLOSSARY.md` 错误引用，与项目权威术语表 [docs/glossary.md](../glossary.md) 及 [docs/agents/domain.md](../agents/domain.md) 冲突。
3. **宪法修改约束**：现行 `docs/constitution.md` 明文规定，修改或废止其工程原则与 SDD 治理规范时必须在 `docs/adr/` 留存决策记录。

## Decision

1. **采用唯一 5 步主干 + 极小微调直通**：取消 L0~L3 任务分级；极小微调直接对话修改并跑局部验证，其余需要设计的需求统一走 `/grill-with-docs` → `/to-spec` → `/to-tickets` → `/swarm`（或单票 `/goal`）+ `/tdd` → `/code-review` → 复利沉淀，按需挂载 `/boost` + `/diagnosing-bugs`、`/browser`、`/btw`、`/compact` 及常态 `/improve-codebase-architecture`。
2. **契约与切片单轨切至 GitHub Issues，退场 `specs/_templates/`**：新需求的权威契约统一为 `bobo522487/yunpu` 中的 GitHub Spec Issue（叠加 [docs/spec-template.md](../spec-template.md) 编 `FR-xxx`、正常/异常态、Seams 与验收矩阵）及垂直切片子 Issue（原生阻塞依赖 DAG）；保留 `specs/001`~`004` 与 [specs/INDEX.md](../../specs/INDEX.md) 仅作只读历史归档，删除 `specs/_templates/` 贯彻「先减后加、零双轨」。
3. **单文件融合 `docs/constitution.md`，解耦 `AGENTS.md`**：
   - [docs/constitution.md](../constitution.md) 单文件融合 `agent-skills` 五类通用工程红线、Yunpu 既有 6 条系统不变量、新版 SDD 治理原则与合并门禁，不加 `sdd-init` 版本 marker（作为项目定制宪法，避免被自动覆盖）。
   - [AGENTS.md](../../AGENTS.md) 重构为规范 Markdown，聚焦文档导航、5 步主干、六条硬纪律与 `## Agent skills` 入口，同样不加 `sdd-init` marker，与宪法各司其职不互相抄录。
   - [docs/pitfalls.md](../pitfalls.md) 与 [docs/spec-template.md](../spec-template.md) 保持 `sdd-init 0.1.0` 模板原样与哈希，保留后续自动升级能力。
4. **保持权威术语表位于 `docs/glossary.md`**：不迁移至根目录 `GLOSSARY.md`，避免破坏既有 ADR 与文档相对链接；统一修正 `AGENTS.md` 引用，并由 [docs/agents/domain.md](../agents/domain.md) 声明权威路径。术语表仅承载谱牒业务概念，不混入流程元术语。
5. **两级有界验证与真实工具链门禁**：单票切片开发期仅跑本领域局部快测（`<= 30s`）；合并前完整对齐 `.github/workflows/verify.yml`（`pnpm lint`、`pnpm contract:check`、真实 PG18/S3 `pnpm test:all`，及涉及前端时的 `build:web`、`test:web`、`test:web:browser` / `/browser` 实测）与 `/code-review` 双轴只读审查（满 2 轮触发 `Attack the Premise` 熔断）。错题晋升阶梯优先固化至 Yunpu 现行物理门禁（`biome.json`、`apps/web/eslint.config.js`、`tests/runtime/`，后续接入则含 `dependency-cruiser`）。
6. **同步清理关联文档**：同步更新 [docs/coding-standards.md](../coding-standards.md)（§七.3 与 §八）及 [specs/INDEX.md](../../specs/INDEX.md)，消除全仓旧三件套 SDD 残留。

## Considered Options

- **保留 `specs/_templates/` 维持 GitHub Issues 与仓库文件双轨**：放弃。同时维护两套契约入口会造成权威分裂，违背「先减后加、零双轨」。
- **将 `docs/constitution.md` 直接替换为 `agent-skills` 通用模板，把 Yunpu 系统不变量拆到其他文档**：放弃。拆分会削弱 PostgreSQL 约束与 `FORCE RLS` 租户隔离作为项目最高红线的可见性。
- **将 `docs/glossary.md` 迁移至根目录 `GLOSSARY.md`**：放弃。全仓已有大量相对链接指向 `docs/glossary.md`，且 `docs/agents/domain.md` 已明确告知各技能读取路径。

## Consequences

- `AGENTS.md`、`docs/constitution.md`、`docs/coding-standards.md`、`docs/agents/*.md`、`specs/INDEX.md` 与 `.github/workflows/verify.yml` 达成单一口径，零双轨残留。
- 新需求契约与垂直切片统一在 GitHub Issues 协作追踪；`001`~`004` 历史规格仍在 `specs/` 只读可查。
- 保留 [docs/agents/triage-labels.md](../agents/triage-labels.md)（虽不安装 `triage` 技能，但 `to-spec` 与 `to-tickets` 仍依赖 `ready-for-agent` 标签）。
- 若未来通过 `/setup-ts-deep-modules` 引入 `dependency-cruiser`，可直接作为错题晋升阶梯中的物理边界门禁层接入，无需再次调整治理流程。

## Status

Accepted & Implemented。
