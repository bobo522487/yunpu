# 003-workspace-console Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除已随前端移出仓库而过时的 `003-workspace-console` 规格目录，并清理 `specs/INDEX.md` 中的档案行，使规格索引只保留仍与本仓相关的历史档案。

**Architecture:** 纯文档变更：用 `git rm -r` 删除 9 个已跟踪文件，编辑 `specs/INDEX.md` 的两处文本，然后以 grep/glob/`git diff --check`/`pnpm lint` 验证无悬空引用、无空白错误、无代码影响。不修改源码、不改 ADR、不新增业务规则、不提交。

**Tech Stack:** Git、Markdown、ripgrep/grep、pnpm lint（仅作仓库现状回归检查）。

**Spec:** `specs/INDEX.md:6,12`；本次用户决定（m01073 选择「B 直接删除 003」，m01081 批准短设计）——理由：前端已在提交 `336d12f` 移出本仓，当前仓库只提供 JSON API。

## Global Constraints

- 目标目录精确为 `/home/bobo/Projects/yunpu/specs/003-workspace-console`；删除前用 `realpath` 确认，禁止用通配符或 `rm -rf` 指向未校验路径。
- 仅删除以下 9 个已跟踪文件：`spec.md`、`plan.md`、`tasks.md`、`research.md`、`data-model.md`、`quickstart.md`、`checklists/requirements.md`、`contracts/console-api.md`、`contracts/ui-states.md`。
- 仓库内唯一的目录外引用是 `specs/INDEX.md:12`；`docs/adr/` 无引用，禁止扩大修改范围到 ADR、架构文档或代码。
- 不得修改 `specs/001-dev-test-environment/`、`specs/002-user-auth-default-org/`、`specs/_templates/`。
- `git rm -r` 会暂存其删除，这是允许的删除机制；除此之外不得 `git add .`、不得 `git commit`。工作区中已有的 `004`/`005`/`006` 删除与 ADR 清理是本次任务之前的未提交改动，必须保留且不被回退；`specs/INDEX.md` 的编辑保持未暂存。
- 本计划文件本身会提及 `003-workspace-console`，属于过程记录；最终悬空引用检查须排除 `docs/superpowers/plans/`，只覆盖仍对用户可见的规范面。

## Review Focus

- **误删相邻规格**：`specs/001-*`、`specs/002-*`、`specs/_templates/` 必须原样存在；用 `git status --short -- specs/` 与 `glob specs/**/*` 对照删除前后的集合，只出现 003 的 9 个 `D` 与 INDEX 的 `M`。
- **悬空引用**：删除后 `specs/`、`docs/adr/`、`docs/architecture.md`、`docs/constitution.md` 中不应再出现 `003-workspace-console` 或 `workspace-console`；用带路径范围的 grep 固定这一点。
- **索引自相矛盾**：`specs/INDEX.md:6` 不能再声称 `001`~`003` 都是历史档案；必须把 `003` 单列为因 `336d12f` 前端移出而删除，并删除第 12 行表格行。
- **工作区污染**：执行前已存在的未提交改动不能被进一步暂存、提交或回退（其中 `004`/`005`/`006` 删除本来已在暂存区）；用 `git status --short` 前后比对，并禁止额外 `git add`/`git commit`。
- **格式回归**：`specs/INDEX.md` 的表格与列表语法不能破坏；用 `git diff --check` 和 `pnpm lint` 验证。

---

### Task 1: 删除 003 规格目录

**Files:**
- Delete: `specs/003-workspace-console/spec.md`
- Delete: `specs/003-workspace-console/plan.md`
- Delete: `specs/003-workspace-console/tasks.md`
- Delete: `specs/003-workspace-console/research.md`
- Delete: `specs/003-workspace-console/data-model.md`
- Delete: `specs/003-workspace-console/quickstart.md`
- Delete: `specs/003-workspace-console/checklists/requirements.md`
- Delete: `specs/003-workspace-console/contracts/console-api.md`
- Delete: `specs/003-workspace-console/contracts/ui-states.md`

**Interfaces:**
- Consumes: 无。
- Produces: `specs/003-workspace-console/` 不再存在；Task 2 只处理 `specs/INDEX.md`。

- [ ] **Step 1: 校验删除目标与工作区基线**

Run:
```bash
pwd
realpath specs/003-workspace-console
git status --short -- specs/
```
Expected: `pwd` 为 `/home/bobo/Projects/yunpu`；`realpath` 输出 `/home/bobo/Projects/yunpu/specs/003-workspace-console`；`git status --short -- specs/` 显示 003 目录尚未删除，且 `001`/`002` 改动为既有状态。

- [ ] **Step 2: 用 git 删除整个目录**

Run:
```bash
git rm -r -- specs/003-workspace-console
```
Expected: 命令列出上列 9 个文件均被 `rm 'specs/003-workspace-console/...'`；退出码 0。不要使用 `rm -rf`。

- [ ] **Step 3: 验证目录已消失且只删了目标文件**

Run:
```bash
find specs/003-workspace-console -type f 2>/dev/null
git status --short -- specs/003-workspace-console
```
Expected: `find` 无输出（目录不存在）；`git status` 恰好 9 行 `D  specs/003-workspace-console/...`，没有其它路径。

- [ ] **Step 4: 验证补丁无空白错误**

Run: `git diff --check -- specs/003-workspace-console`
Expected: 无输出，退出码 0。

- [ ] **Step 5: 不额外暂存或提交**

不要额外运行 `git add` 或 `git commit`；Task 1 的 `git rm` 已暂存 9 个删除，保持该状态，Task 2 只编辑 `specs/INDEX.md`。

### Task 2: 更新规格索引并清理引用

**Files:**
- Modify: `specs/INDEX.md:6`
- Modify: `specs/INDEX.md:12`

**Interfaces:**
- Consumes: Task 1 产生的 `specs/003-workspace-console/` 删除状态。
- Produces: `specs/INDEX.md` 不再列出 003，且说明其删除原因；Final Verification 依赖此状态。

- [ ] **Step 1: 读取索引当前内容**

Run: 读取 `specs/INDEX.md` 第 1–12 行。
Expected: 第 6 行含 `001`~`003` 为历史 Spec Kit 迭代归档；第 12 行是 `003-workspace-console` 的 Archived (Done) 表格行。

- [ ] **Step 2: 改写第 6 行**

在 `specs/INDEX.md` 中，把第 6 行整行替换为：

```markdown
- **历史档案**：`001`~`002` 为历史 Spec Kit 迭代归档，保持只读；`003` 随前端移出本仓（提交 `336d12f`）而删除；`004`~`006` 已在架构精简收口后删除，其结论以 [docs/adr/](../docs/adr/) 为准；现行全局约束与架构见 [docs/](../docs/constitution.md)。
```

Expected: 只替换这一行，链接目标与原有措辞保留，不新增其它说明段落。

- [ ] **Step 3: 删除第 12 行的 003 表格行**

删除整行：

```markdown
| `003-workspace-console` | Archived (Done) | [spec.md](./003-workspace-console/spec.md) | [plan.md](./003-workspace-console/plan.md) | [tasks.md](./003-workspace-console/tasks.md) |
```

Expected: 表格仍保留表头、分隔行、`001` 与 `002` 两行；末尾无多余空行。

- [ ] **Step 4: 验证索引中没有 003 链接或归档行**

Run:
```bash
grep -n './003-workspace-console/' specs/INDEX.md
grep -n 'Archived (Done).*workspace' specs/INDEX.md
grep -n '`001`~`002`' specs/INDEX.md
```
Expected: 前两条命令无输出；第三条命中第 6 行，且该行包含 `003` 随前端移出本仓（提交 `336d12f`）而删除。允许第 6 行因删除说明而出现 `003`，但不得出现指向已删目录的链接或 Archived 表格行。

- [ ] **Step 5: 验证补丁无空白错误**

Run: `git diff --check -- specs/INDEX.md`
Expected: 无输出，退出码 0。

### Task 3: 最终验证（不提交）

**Files:**
- 无新增修改；只运行检查。

**Interfaces:**
- Consumes: Task 1 的删除与 Task 2 的索引更新。
- Produces: 可交付给用户复核的最终工作区状态。

- [ ] **Step 1: 检查规范面无悬空引用**

Run:
```bash
grep -rn '003-workspace-console\|workspace-console' specs/ docs/adr/ docs/architecture.md docs/constitution.md
```
Expected: 无输出。不要扫描 `docs/superpowers/plans/`，因为实施计划会按名称记录本次删除。

- [ ] **Step 2: 检查规格目录集合**

Run: `find specs -maxdepth 1 -mindepth 1 -printf '%f\n' | sort`
Expected: 输出集合恰为 `_templates`、`001-dev-test-environment`、`002-user-auth-default-org`、`INDEX.md`（顺序不限），无 `003-workspace-console`。

- [ ] **Step 3: 全仓补丁与 lint 回归**

Run:
```bash
git diff --check
pnpm lint
```
Expected: `git diff --check` 无输出；`pnpm lint` 输出 `No fixes applied.` 且退出码 0。

- [ ] **Step 4: 核对最终工作区状态**

Run: `git status --short`
Expected: 工作区状态包含本次 9 个已暂存的 `D  specs/003-workspace-console/...` 与未暂存的 ` M specs/INDEX.md`；此前已存在的 `004`/`005`/`006` 删除、ADR 清理、环境修复等改动仍在。`git diff --cached --name-only` 应包含 003 的 9 个删除和既有 004/005/006 删除，但不得包含 `specs/INDEX.md` 或任何源码文件。

- [ ] **Step 5: 不提交**

不要运行 `git add` 或 `git commit`；由用户决定何时提交与推送。
