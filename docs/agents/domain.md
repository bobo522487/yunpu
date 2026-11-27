# 领域文档消费规范（Domain Docs）

本文件约定各工程技能在探索代码库时如何读取和使用本仓库的领域文档。

**布局（Layout）**：`single-context`。

## 探索代码前先读这些

- **`docs/glossary.md`**：本项目唯一的权威领域术语表（含禁用同义词）。
- **`docs/adr/`**：查阅与本次改动领域相关的架构决策记录（`ADR-XXXX-*.md`）。

如果某个文件暂不存在，**静默跳过即可**，不要报错提示缺失，也不要在仓库根目录新建重复的 `GLOSSARY.md`。当讨论中敲定新术语或新决策时，由 `/domain-modeling` 技能（经由 `/grill-with-docs` 与 `/improve-codebase-architecture` 触发）同步更新 `docs/glossary.md` 与 `docs/adr/`。

## 目录结构

单上下文（single-context）仓库（`apps/api`、`apps/web`、`packages/db`、`packages/shared` 共享同一谱牒领域）：

```
/
├── docs/
│   ├── glossary.md
│   └── adr/
│       ├── ADR-0001-node26-runtime.md
│       └── ...
├── apps/
└── packages/
```

## 严格使用术语表词汇

在代码、测试、Issue 标题、Spec、重构方案或代码评审中提及领域概念时，必须使用 `docs/glossary.md` 中定义的标准术语，禁止漂移到术语表明确禁用的同义词（例如：不要将 `Organization` 称为「Workspace」/「Team」，不要将 `Person` 称为「User」/「Account」）。

如果所需概念尚未收录在 `docs/glossary.md` 中，说明可能出现两种情况：要么你在自行造词（应重新审视），要么存在真实的领域模型缺口（记录下来交由 `/domain-modeling` 补齐）。

## 显式标出 ADR 冲突

如果输出方案与 `docs/adr/` 中标记为 `accepted` 的既有 ADR 冲突，必须显式指明并提议新的替代 ADR，不得静默覆盖：

> _与 ADR-0002（租户上下文）冲突，但值得重新讨论，因为……_
