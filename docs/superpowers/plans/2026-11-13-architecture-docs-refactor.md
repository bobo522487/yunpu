# 目标架构文档重构 Implementation Plan（v2）

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `/home/bobo/project/yunpu/docs/architecture/` 下 5 份以 spec-kit 命令产物名命名、互相复制且状态造假的文档，在 `docs/` 内重构成按主题组织、单一真相源、有执行者的**完整目标架构文档**；`specs/` 本次不创建，留作后期分批实现。

**Architecture:** 先按 Governance 修宪法（把「文档分层」规则从 `spec.md`/`plan.md`/`data-model.md` 改写为主题化文件名、给 `SC-DOC-01` 装执行者），再用 TDD 写 `scripts/check-docs.sh` 校验器，然后在 `docs/` 内部按主题重组（`git mv` + 拆分 + 去重 + 统一 LF），修编号与引用、用 Context7 重核官方断言、补可测验收与两次门禁、写 `docs/README.md` 导航与 `docs/` ↔ `specs/` 分工约定，最后全绿收尾。全程只改 Markdown 与 1 个 POSIX sh 脚本，不新增依赖、不写业务代码、不创建 `specs/`。

**Tech Stack:** Markdown；POSIX `sh` + `grep`/`awk`/`sed`（无新依赖）；git；spec-kit v1.4.0（仅用 `.specify/scripts/bash/resolve-template.sh` 与 `check-prerequisites.sh` 做只读验证，不生成特性产物）；Context7（HTTP JSON-RPC，客户端 `/tmp/c7.py`）；`curl`/`gh` 核版本。已实测可用：Node v24.19.0、python3 3.14.4；**不可用**：`bun MISSING`、`psql NOT FOUND`、`pg_ctl NOT FOUND`。

**Spec:** [docs/superpowers/reviews/2026-11-13-architecture-docs-review.md](<docs/superpowers/reviews/2026-11-13-architecture-docs-review.md>) v2（评审报告即本计划的规格，§4 目录树、§5 收敛清单、§6 十条建议）＋ [/home/bobo/project/yunpu/.specify/memory/constitution.md](<.specify/memory/constitution.md>)（最高约束，v1.0.0 → 1.1.0）。执行者须同时读这两份。

## Global Constraints

- **用户决策（m00401，逐字）**：`我希望还是保持在 docs 目录下放完整的目标架构文档。specs/ 目录下后期再分批一步一步的实现。架构文档的目录肯定不是这几个文件名；` → 完整目标架构文档**留在 `docs/`**，按主题重组目录与文件名；**本计划不创建 `specs/`、不生成 `tasks.md`/`quickstart.md`、不写 `.specify/feature.json`**；v1 计划中「整体迁入 `specs/001-cloud-genealogy-v1/`、物理删除 `docs/architecture/`」全部作废。旧 5 个文件的内容保留（迁移/拆分），但旧文件名不再存在。
- 目标目录树（评审报告 §4.2，必须逐字落实）：`docs/README.md`；`docs/architecture/{overview,stack,runtime,modules,operations}.md`；`docs/architecture/data/{schema,security,invariants,indexes,errors,migrations}.md`；`docs/architecture/api/{conventions,endpoints}.md`；`docs/requirements/{user-stories,functional,acceptance,out-of-scope}.md`；`docs/decisions/0001-pg18-defects.md`；`docs/verification/README.md`；`docs/superpowers/{reviews,plans}/`。
- 治理顺序：`.specify/memory/constitution.md:252`「**落地：宪法先改，再改文档；不允许先改文档后补宪法。**」→ Task 1 必须先于所有文档修改完成并提交。
- 路径约定：Task 1–2 以 `docs/architecture/` 为只读基线；**Task 3 起所有文档根为 `docs/`**，主题文件路径见上。每个 Task 的 Files 块写明路径。
- 单文件 400 行是**警报不是门禁**：`constitution.md:140-142` `ARCH-GOV-01`「超过 400 行触发评审讨论『是否内聚』，不触发自动拒绝」；切分依据是「每个主题当前有 ≥2 份重复副本」（Article I），**禁止为凑行数机械拆文件**。
- 预算突破须登记：`constitution.md:152-153` 在 `docs/README.md` 的 Complexity Tracking 写三列 `Violation / Why Needed / Simpler Alternative Rejected Because`；「空着不写就等于不允许」。
- 「明确不做」只存一份：`constitution.md:235`；OOS 定义行只允许出现在 `docs/requirements/out-of-scope.md`。
- 三段式：`constitution.md:236` 每条规范＝「规范陈述 + 执行者 + 验证方式」；`constitution.md:69-70` 执行者只能是 `DB 约束 / DB 触发器 / 服务层 / 测试` 四者之一。
- 编号：`constitution.md:228`「悬空引用 0、一号两义 0、未引用 0」；`constitution.md:210`「引用编号必须能找到定义」。校验器 R4/R5/R7 是执行者。
- 文档分层（Task 1 改写后的新规则）：`docs/requirements/` 说「做什么与验收」、`docs/architecture/` 说「怎么做与数据长什么样」、`docs/decisions/` 说「为什么」、`docs/verification/` 说「实测证据」；同一主题只在一个文件定义。
- 收尾门禁：`constitution.md:222`「合并前 `gen:sql && git diff --exit-code` 通过，编号一致性校验零悬空」（本仓库暂无 `scripts/gen-sql.ts`，Task 10 只跑编号/链接校验并显式记录该门禁未满足，不伪装通过）。
- 删除语义：`constitution.md` Article II「删掉就是删掉」—— 删除的章节物理删除或迁入唯一权威文件，不留 `已删除`/`v1.2`/「修订记录」副本。
- 官方依据：每条必须 pinned URL + 抓取日期 `2026-11-13`；禁止 unpinned `main` 链接、禁止「链接未定义」、禁止「不做补链」。
- **版本策略（用户 5 问决策，覆盖 v2 初稿的「下限」写法）＝锁定到 2026-11-13 实测最新版**：工具链总表（唯一副本在 `docs/architecture/stack.md`）写精确版本 + 抓取日期 `2026-11-13`，禁止 `≥` / `x` 区间 / 浮动 tag：`hono 4.13.18` / `drizzle-orm 0.45.4` / `drizzle-kit 0.31.11` / `zod 4.6.7` / `@biomejs/biome 2.6.7` / `pnpm 12.18.0` / `Bun 1.4.4`（tag `bun-v1.4.4`） / `@hono/zod-validator 0.9.1` / `@hono/zod-openapi 1.6.3`。`@hono/zod-validator` 的 `zod: ^3.25.0 || ^4.0.0` 与 `@hono/zod-openapi` 的 `zod: ^4.0.0` 是**上游 peer 范围**，只能作为锁定版本的兼容性说明，不得写成项目约束。例外：PostgreSQL 按用户另一决策写「PostgreSQL 18（待验证）」，不写 18.0/18.6/18.7 等未经复现的小版本（见下条）。
- 行尾统一 **LF**；`docs/architecture/api.md` 现 467/467 行 CRLF、`plan.md` 1595/1595 行 CRLF，必须归一。
- 无 `bun`/`psql`/`pg_ctl` → 校验脚本只能用 POSIX sh；PG 18「实测」结论一律降级为「待验证」并在 `docs/architecture/data/invariants.md` 软约束登记表登记，禁止保留不可复现的实测声明。
- `.specify/feature.json` 被 `.specify/.gitignore` 忽略（本地状态，不提交）；本计划不写它。`check-prerequisites.sh --json` 当前 exit=1 属**预期事实**，Task 9 如实记录，不为让它变绿而创建 `specs/`。

## Review Focus

1. **重组后相对链接与 `§x.y` 仍然解析**：`data-model.md:10` 的 `./tasks.md` 与 40 处被引用路径在按主题拆分后易断 → Task 3 的 `check-docs.sh --root docs` 步骤，及校验器 R1/R7 的 `broken-link` / `section` fixture。
2. **删掉重复表后引用编号找不到定义**：删 `plan.md:30-36`、`data-model.md:2507-2528` 后 OOS 引用必须仍指向 `docs/requirements/out-of-scope.md` 定义 → Task 4 的 `grep -c '^| \`OOS-'` 步骤，及校验器 R4 的 `dangling` fixture。
3. **同一 ID 两处定义措辞不同（一号两义）**：`DM-GEN-16`、`DM-MED-01`、`EC-02`、`ARCH-HONO-01` 已实锤 → Task 5 的四组 `grep -n` 步骤，及校验器 R5 的 `dual` fixture。
4. **行尾混用与校验器自身误判**：CRLF 让 `git diff` 抖动；`### US-001（P1）…` 标题与 `[P]` 并行标记易被误报为悬空/未解析占位符 → Task 2 的 `us-heading` / `p-marker` 回归 fixture + Task 3 的 `grep -rlc $'\r' docs/` 步骤。
5. **官方 URL 死链与版本漂移**：`research.md:34` 的 `hono/src/factory.ts` 已 404、Hono 文档未版本化 → Task 6 的 `curl -sS -o /dev/null -w '%{http_code}'` 逐条步骤，及 pinned URL + 日期校验。
6. **不要把架构文档搬进 `specs/`**：用户明确否决 v1 方案；每个 Task 的 `git add` 只允许出现 `docs/`、`scripts/`、`tests/`、`.specify/memory/`，Task 10 用 `git status --short` 断言无 `?? specs/`。

---

### Task 1: 宪法先行修订（Governance）

**Files:**
- Modify: `/home/bobo/project/yunpu/.specify/memory/constitution.md`
- Read-only: `/home/bobo/project/yunpu/.specify/templates/constitution-template.md`、`/home/bobo/project/yunpu/.specify/memory/.constitution-template.json`

**Interfaces:**
- Consumes: 评审报告 v2 §7 的开放问题（`constitution.md:23-34` 的 TODO 全文）、§4.2 的目标目录树。
- Produces: 宪法 v1.1.0，含 `SC-DOC-01` 的执行者定义 `scripts/check-docs.sh` 与主题化文档分层规则；后续所有 Task 引用该执行者与目录约定。

- [ ] **Step 1: 删除临时 Sync Impact Report HTML 注释**（`constitution.md:1-34`，含 `This report is temporary scratch material: remove this HTML comment before committing.`）

Run: `grep -c 'This report is temporary scratch material' .specify/memory/constitution.md`
Expected: `0`（删除前为 `1`）。

- [ ] **Step 2: 修标题与三个 TODO**

`:41` `Core Principles（五条不可变原则）` → `Core Principles（九条不可变原则）`（正文 Article I–IX 共 9 条，保留全部 9 条措辞不改写）；删除 `TODO(PRINCIPLE_COUNT)`、`TODO(PROJECT_NAME)`（项目名确认为 Yunpu）；把 `TODO(CROSS_REFERENCES)` 改写为指向 `docs/architecture/`、`docs/requirements/`、`scripts/check-docs.sh` 的具体引用，不再写「尚无定义」。保留 `[P]` 标记并注明它是 Spec Kit 并行任务标记。

Run: `grep -n 'TODO(\|\[PROJECT_NAME\]\|五条不可变原则' .specify/memory/constitution.md; echo "grep_exit=$?"`
Expected: 无输出、`grep_exit=1`；`grep -c '^### Article ' .specify/memory/constitution.md` → `9`。

- [ ] **Step 3: 把「文档分层」规则改写为主题化文件名**

`constitution.md:233` 的 `spec.md 说「做什么与验收」，plan.md 说「怎么做与边界」，data-model.md 说「数据长什么样」` → `docs/requirements/ 说「做什么与验收」，docs/architecture/ 说「怎么做与边界、数据长什么样」，docs/decisions/ 说「为什么」，docs/verification/ 说「实测证据」`；`:235` 的「清单只存一份（spec.md）」→「只存一份（`docs/requirements/out-of-scope.md`）」；`:215` 开发流程第 1 步「先在 `specs/<编号>-<特性名>/` 下产出 spec.md」补一句「`docs/` 是完整目标架构基线，`specs/<编号>-<特性名>/` 只用于后期分批实现的批次工件，二者不互相复制」。修 `:209`「§4.6 错误码表」→ `docs/architecture/data/errors.md`、`:210`「§18 编号索引表」→ `docs/README.md` 编号索引（两处原指向不存在章节）。

Run: `grep -n 'spec.md 说\|清单只存一份（spec.md）\|§4.6 错误码表\|§18 编号索引表' .specify/memory/constitution.md; echo "grep_exit=$?"`
Expected: 无输出、`grep_exit=1`；`grep -c 'docs/requirements/' .specify/memory/constitution.md` ≥ 2。

- [ ] **Step 4: 给 `SC-DOC-01` 补执行者定义**

在两次门禁/阻塞级门禁段（`:224-229`）新增一行规范，三段式写全：`SC-DOC-01 | 编号一致性校验：悬空引用 0、一号两义 0、未引用 0、断链 0、无 CRLF | 执行者：`scripts/check-docs.sh --strict`（测试） | 验证：`scripts/check-docs.sh --root docs --strict` exit=0`。

Run: `grep -n 'scripts/check-docs.sh' .specify/memory/constitution.md`
Expected: 至少 1 行命中且含 `--strict` 与 `exit=0`。

- [ ] **Step 5: 版本号与日期**

末行 `**Version**: 1.0.0 | **Ratified**: 2026-11-13 | **Last Amended**: 2026-11-13` → `**Version**: 1.1.0 | **Ratified**: 2026-11-13 | **Last Amended**: 2026-11-13`。MINOR 理由（写入正文 Governance · 版本策略）：新增 `SC-DOC-01` 执行者定义、文档分层规则改为主题化目录、修正条款计数与悬空引用说明，未删除任何原则。

Run: `tail -n 1 .specify/memory/constitution.md`
Expected: 含 `1.1.0`。

- [ ] **Step 6: 验证模板层未被回写**

Run: `/home/bobo/project/yunpu/.specify/scripts/bash/resolve-template.sh constitution-template --json; echo "resolver_exit=$?"` 与 `head -n 1 .specify/templates/constitution-template.md`
Expected: `resolver_exit=0`；模板首行仍为 `# [PROJECT_NAME] Constitution`；`cat .specify/memory/.constitution-template.json` 的 `sha256` 仍为 `ce7549540fa45543cca797a150201d868e64495fdff39dc38246fb17bd4024b3`。

- [ ] **Step 7: Commit**

```bash
git add .specify/memory/constitution.md
git commit -m "docs: amend constitution to v1.1.0 (topic-based doc layout, define SC-DOC-01 executor)"
```

---

### Task 2: `scripts/check-docs.sh` —— 给规则装上执行者（TDD）

**Files:**
- Create: `/home/bobo/project/yunpu/scripts/check-docs.sh`（可执行 `-rwxr-xr-x`）
- Create: `/home/bobo/project/yunpu/tests/docs/check-docs.test.sh`
- Create: `/home/bobo/project/yunpu/tests/docs/fixtures/{ok,broken-link,crlf,oos-dup,dangling,dual,section,needs-clarification,us-heading,p-marker}/`（每个 fixture 1–2 个最小 `.md`）
- Modify: `/home/bobo/project/yunpu/.specify/memory/constitution.md`（仅当 Task 1 的执行者描述需与实现对齐）

**Interfaces:**
- Consumes: Task 1 定义的 `SC-DOC-01` 三段式规范。
- Produces: `scripts/check-docs.sh --root <dir> [--strict] [--json]` → `exit 0`（无违规）/ `1`（有违规）/ `2`（用法或 IO 错误）；stdout 每行 `<RULE> <file>:<line> <detail>`，末行 `VIOLATIONS=<n> WARN=<n>`。规则集：
  - `R1 link`：所有 `[text](./path)` / `[text](../path)` 目标存在；忽略 `http(s)://` 与纯 `#anchor`。
  - `R2 eol`：扫描到的 `.md` 无 `\r` 字节。
  - `R3 oos-dup`：`^\|\s*`OOS-\d+`\s*\|` 定义行只允许出现在 `requirements/out-of-scope.md`。
  - `R4 dangling`：`` `[A-Z][A-Z0-9]*(-[A-Z0-9]+)*-\d+` `` token 被引用但全文档集无定义；定义 = 表格首列恰为 `` `ID` `` / `^#{1,6}\s+ID` / `^\*\*`ID`\*\*`。`US-001..US-010` 的 `### US-001（P1）…` 标题算定义。
  - `R5 dual`：同一 ID 有 ≥2 条定义行且第二列文本（空白归一后）不同。
  - `R6 needs-clarification`：全文档集 `[NEEDS CLARIFICATION]` 出现次数 = 0（Phase 0 未决项必须给出结论）。
  - `R7 section`：文件内 `§x.y` 必须能在本文件找到 `^#{1,6}\s+x.y` 标题；跨文档引用改写为显式 `file.md §x.y` 链接，不保留裸 `§` 跨文档引用。
  - `R8 size`：默认 WARN；`--strict` 下升级为违规——每个 >400 行的 `.md` 必须在 `docs/README.md` 的 Complexity Tracking 有填齐三列的对应行。
  - 定义收集范围：`--root` 下递归所有 `.md` + `.specify/memory/constitution.md` + `docs/decisions/*.md`。

- [ ] **Step 1: 写失败的测试** `tests/docs/check-docs.test.sh`

一个纯 sh 的测试脚本：对 `fixtures/ok/` 期望 `exit 0`；对 `broken-link`/`crlf`/`oos-dup`/`dangling`/`dual`/`section`/`needs-clarification` 各期望 `exit 1` 且输出含对应 RULE 名；对 `us-heading`（`### US-001（P1）录入人物与多种姓名`）与 `p-marker`（`- [ ] [P] [US1] ...`）两个回归 fixture 期望 `exit 0`（不得误报悬空/未解析占位符）。fixture 内容按各自规则最小构造，例如 `dangling/` 放一行 `` `DM-XYZ-99` 被引用但无定义 ``。

- [ ] **Step 2: 跑测试，确认失败**

Run: `bash tests/docs/check-docs.test.sh; echo "test_exit=$?"`
Expected: `test_exit=1`，且报错为 `scripts/check-docs.sh: No such file or directory`（脚本尚不存在）。

- [ ] **Step 3: 实现 `scripts/check-docs.sh`**

按 Interfaces 的 8 条规则实现；`--root` 默认 `docs`；递归纳入 `docs/architecture/**/*.md`、`docs/requirements/*.md`、`docs/decisions/*.md`、`docs/verification/*.md`；`chmod 755`。不引入 `bun`/`node`/`python` 依赖，仅 POSIX sh + grep/awk/sed。

Run: `ls -l scripts/check-docs.sh`
Expected: 权限含 `-rwxr-xr-x`。

- [ ] **Step 4: 跑测试，确认通过**

Run: `bash tests/docs/check-docs.test.sh; echo "test_exit=$?"`
Expected: `test_exit=0`，10 个 fixture 全部按期望退出。

- [ ] **Step 5: 对当前文档建立红色基线**

Run: `scripts/check-docs.sh --root docs --strict; echo "check_exit=$?"`
Expected: `check_exit=1`；输出至少含 `R2 eol` 的 `api.md`/`plan.md`、`R1 link` 的 `data-model.md:10 ./tasks.md`、`R3 oos-dup` 的 `plan.md` 与 `data-model.md`、`R4 dangling` 的 `SC-DOC-01` 与 14 个 `ARCH-*`、`R5 dual` 的 `DM-GEN-16`/`DM-MED-01`/`EC-02`。记录 `VIOLATIONS=<n>` 作为基线数字。注意：此时 `docs/superpowers/` 下两份交付物也会被扫描，若产生噪声可在 R1–R8 之外加 `--exclude` 白名单（仅限 `docs/superpowers/`），并在测试里覆盖该白名单。

- [ ] **Step 6: Commit**

```bash
git add scripts/check-docs.sh tests/docs/
git commit -m "feat: add doc consistency checker (SC-DOC-01 executor) with fixture tests"
```

---

### Task 3: 在 `docs/` 内按主题重组目录与文件名 + 行尾归一

**Files:**
- Create: `/home/bobo/project/yunpu/docs/architecture/data/`、`/home/bobo/project/yunpu/docs/architecture/api/`、`/home/bobo/project/yunpu/docs/requirements/`、`/home/bobo/project/yunpu/docs/decisions/`、`/home/bobo/project/yunpu/docs/verification/`
- Move/Split: `docs/architecture/{api,data-model,plan,research,spec}.md` 的内容 → §4.2 的 17 个主题文件（见评审报告 §5 映射表）
- Delete: 旧 5 个平铺文件名（内容全部迁入新文件后删除，**不是丢弃知识**）
- Modify: 新 `docs/architecture/overview.md`（删掉原 `plan.md:224-282` §4.1 的假目录树与假状态表）

**Interfaces:**
- Consumes: Task 2 的校验器（R1/R2/R7）；评审报告 v2 §4.2 目录树与 §5 旧→新映射。
- Produces: `docs/` 下 17 个主题文件 + `README.md`（Task 9）+ `decisions/0001-*.md` + `verification/README.md`；旧 5 个文件名不再存在；全部 LF；**无 `specs/` 目录**。

- [ ] **Step 1: 建目录骨架并用 `git mv` 起手**

```bash
mkdir -p docs/architecture/data docs/architecture/api docs/requirements docs/decisions docs/verification
git mv docs/architecture/api.md docs/architecture/api/endpoints.md
git mv docs/architecture/data-model.md docs/architecture/data/schema.md
git mv docs/architecture/plan.md docs/architecture/overview.md
git mv docs/architecture/research.md docs/architecture/stack.md
git mv docs/architecture/spec.md docs/requirements/functional.md
```

（后续步骤按 §5 映射把各文件切成主题文件；`git mv` 保留历史，符合「内容保留，只重组」。）先建目录再 `git mv`，避免目标不存在。若 `docs/` 尚未被 git 跟踪（`git status --short` 显示 `?? docs/`），改用 `mv` 并在 Step 6 一次性 `git add docs/`。

Run: `find docs/architecture -maxdepth 1 -type f | sort`
Expected: 仅 `overview.md`（或无文件，取决于拆分进度），无 `api.md`/`data-model.md`/`research.md`/`spec.md`/`plan.md`。

- [ ] **Step 2: 按 §5 映射拆分六个 `data/` 主题文件**

从 `data/schema.md`（原 data-model.md）按二级标题行号切出：`§3/§5/§6` 留 `schema.md`；`§8` → `data/security.md`；`§7/§10` → `data/invariants.md`；`§11` → `data/indexes.md`；`§9.4` 合并 `§4.6` → `data/errors.md`；`§12/§13.1–13.2` → `data/migrations.md`；`§13.3` 的 59 条 Given/When/Then → `docs/requirements/user-stories.md`（Task 4 去重）；`§15/§16/§17/§18/§19/附录 A` → `docs/decisions/0001-pg18-defects.md`、`docs/verification/README.md`、`docs/README.md` 或直接删除（Task 4/9）。每个新文件首行写 `# <主题>` 与一行「本文件是 X 的唯一权威，其他文档引用编号」，正文用原章节内容，不改写技术结论。

Run: `ls docs/architecture/data/*.md | wc -l` 与 `grep -c '^| `GX' docs/architecture/data/errors.md`
Expected: 前者 = `6`；后者 ≥ `11`（GX001–GX011 只在此文件）。

- [ ] **Step 3: 按 §5 映射拆分 `architecture/` 与 `api/` 主题文件**

从 `overview.md`（原 plan.md）切出：`§0/§2` 留 `overview.md`；`§3` → `stack.md`（与 `research.md` 的官方依据合并去重）；`§4.2/§5` → `modules.md`；`§8` → `runtime.md`；`§15–§17` → `operations.md`；`§1.4/§20/§21` → `docs/README.md`（Task 8/9）。从 `api/endpoints.md` 切出 `§0/§1/§3` → `api/conventions.md`，`§4` 九类未定义项 → `docs/requirements/functional.md` + `stack.md` 的 Phase 0 结论（Task 7）。从 `docs/requirements/functional.md`（原 spec.md）切出 `§2` → `user-stories.md`、`§5/§9` → `acceptance.md`、`§8` → `out-of-scope.md`。

Run: `find docs/architecture docs/requirements -type f | sort`
Expected: `architecture/` 下 `overview/stack/runtime/modules/operations/data(6)/api(2)` 共 15 个 `.md`；`requirements/` 下 `user-stories/functional/acceptance/out-of-scope` 共 4 个 `.md`。

- [ ] **Step 4: 删除原 `plan.md` §4.1 假目录树与假状态表**

在 `overview.md` 中整节删除原 `:224-282`（`specs/001-cloud-genealogy-v1/` 树、`.codebuddy/commands/`、`.specify/feature.json`、`data/schema_v12.sql`、`data/functions_v12.sql`、`/speckit.tasks ✅ 已完成（81 个任务）`）；替换为一句事实：`本仓库的完整目标架构文档位于 docs/，按主题组织；specs/<NNN>-<feature>/ 只在后期分批实现时由 /speckit-specify 生成，当前不存在。` 命令状态表整表删除（状态由文件系统给出，不写进文档）。

Run: `grep -rn 'codebuddy\|81 个任务\|/speckit\.tasks\|schema_v12\|001-cloud-genealogy-v1' docs/ | grep -v docs/superpowers/; echo "grep_exit=$?"`
Expected: 无输出、`grep_exit=1`（`docs/superpowers/` 中的评审证据允许保留）。

- [ ] **Step 5: 行尾归一 →**

Run: `find docs -name '*.md' -exec sed -i 's/\r$//' {} +` 然后 `grep -rlc $'\r' docs/ --include='*.md' | grep -v docs/superpowers/; echo "crlf_grep_exit=$?"`
Expected: `crlf_grep_exit=1`（无输出）；原 `api.md` 467/467 与 `plan.md` 1595/1595 的 CRLF 全部消失。

- [ ] **Step 6: 修相对链接并断言无 `specs/`**

把 `data-model.md:10` 的 `[tasks.md](./tasks.md)` 等 40 处跨文档引用改成新的显式路径（如 `[错误码](../data/errors.md)`、`[OOS 唯一副本](../../requirements/out-of-scope.md)`）；所有裸 `§x.y` 跨文档引用改写成 `file.md §x.y` 链接。

Run: `scripts/check-docs.sh --root docs 2>&1 | grep '^R1 link'; echo "link_grep_exit=$?"` 与 `test ! -d specs && echo "NO_SPECS_OK"`
Expected: `link_grep_exit=1`（无断链）；输出 `NO_SPECS_OK`；`git status --short` 不出现 `?? specs/`。

- [ ] **Step 7: Commit**

```bash
git add docs/
git commit -m "docs: reorganize architecture docs by topic under docs/ (no specs/, LF normalized)"
```

---

### Task 4: 单一真相源清理（物理删除 8 主题的重复副本）

**Files:**
- Modify: `docs/architecture/overview.md`（原 `plan.md:20-36` §1.1、`:815-868` 错误码第二份、`:510-606` RLS 副本、`:481-490` 索引副本、`:124-131`/`:658-666`/`:717-729` 中间件链副本、`:686-712`/`:714-739`/`:870-880` DI 副本）
- Modify: `docs/architecture/stack.md`（原 `research.md:159-185` §7 工具链表、`:199`「不做补链」、`:224-320` §11/§12/§13 三份实测与缺陷复述）
- Modify: `docs/architecture/data/schema.md`（原 `data-model.md:2497-2542` §14、`:2564-2598` §16、`:2599-2652` §17、`:2784-2824` §19、`:2825-2845` 附录 A、`:2224-2494` §13.3、`:302` §4.6）
- Modify: `docs/architecture/api/endpoints.md`（原 `api.md:120/:138/:162` 三张错误码表、`:179` 重复行、`:468` 假声明）
- Create: `/home/bobo/project/yunpu/docs/decisions/0001-pg18-defects.md`（D1–D12 唯一权威副本）
- Create: `/home/bobo/project/yunpu/docs/verification/README.md`（说明 PG 18 结论待验证、登记项）

**Interfaces:**
- Consumes: Task 3 的新路径；Task 2 校验器 R3/R4；评审报告 v2 §2 P0-3 的 8 主题重复矩阵。
- Produces: OOS 定义行只在 `docs/requirements/out-of-scope.md`；跨文档逐字重复长行 = 0；`docs/` 总量从 5613 行降到约 2800–3300 行（净删而非拆分凑行数）。

- [ ] **Step 1: 删掉两份重复的 OOS 表**

删 `overview.md` 原 `plan.md:30-36` 的 5 行（OOS-08/09/16/17/18）与 `schema.md` 原 `data-model.md:2507-2528` 的 22 行；两处改为一句引用：`「明确不做」唯一权威副本见 [out-of-scope.md](../../requirements/out-of-scope.md)（OOS-01..OOS-19），本文仅引用编号。` `overview.md` 的「架构侧理由与复评触发条件」若确需保留，改写为不带 OOS 编号行的散文并登记到 `docs/README.md` Complexity Tracking。删 `docs/requirements/functional.md` 原 `spec.md:386` 的「`plan.md` §1.1 的『明确不做』表**已删除**」假声明。

Run: `grep -rc '^| `OOS-' docs/ --include='*.md' | grep -v ':0'`
Expected: 唯一命中为 `docs/requirements/out-of-scope.md`，计数 20（19 条 + 表头按实际计）。

- [ ] **Step 2: 删 `stack.md` 的工具链版本总表与「不做补链」声明**

原 `research.md:159-185` §7 整节删除，替换为一行指向 `overview.md` §3 Technical Context 的链接（若 §3 已并入 `stack.md` 则指向本文件对应节）；删原 `:199` 的「不做补链」声明。工具链版本总表只留 `stack.md` 一份。

Run: `grep -rn '不做补链\|工具链版本总表' docs/ | grep -v docs/superpowers/; echo "grep_exit=$?"`
Expected: 无输出、`grep_exit=1`。

- [ ] **Step 3: 把三份实测/缺陷记录收敛成一份决策记录**

D1–D12 与 21 组 PG 18「实测」逐字重复于原 `data-model.md` §17/§17.1、`research.md` §11/§12/§13。新建 `docs/decisions/0001-pg18-defects.md` 保存**一份** D1–D12 决策记录（含「本机无 `psql`/`pg_ctl`，结论待验证」的显式声明）；删除 5 个重复章节。删原 `data-model.md` §16「v1.2 修订记录（26 项）」——修订记录属于 git 历史；`docs/verification/README.md` 只写「如何复现 + 哪些结论尚未复现」，不复制实测表。

Run: `grep -rn '^## 1[6-9]\.\|^## 附录 A\|修订记录' docs/architecture/ docs/requirements/; echo "grep_exit=$?"` 与 `grep -c 'D1–D12\|## D1' docs/decisions/0001-pg18-defects.md`
Expected: 前者无输出、`grep_exit=1`；后者 ≥ 1。

- [ ] **Step 4: 收敛错误码（三张表 → 一份）**

`data/errors.md` 合并原 `data-model.md` §9.4（26 行/25 码）与 §4.6（GX001–GX011 + SQLSTATE）为唯一权威；删 `overview.md` 原 `plan.md:815-868` 的 `PG_SQLSTATE_BUCKET` 第二份、`api/endpoints.md` 原 `api.md:120/:138/:162` 三张表，改为引用 `GX*` / 错误码编号。消除全仓库无定义的 `PG_ERROR_MAP` / `PG_CONSTRAINT_MESSAGES`（`api.md:181`、`plan.md:866`）——要么在 `runtime.md` 给出定义，要么删引用。修 `api.md:468`「本文所有内容均出自 plan.md」与 `:118`「不构成第二份定义」两处假声明。

Run: `grep -rn 'PG_ERROR_MAP\|PG_CONSTRAINT_MESSAGES\|所有内容均出自 plan.md' docs/ | grep -v docs/superpowers/; echo "grep_exit=$?"`
Expected: 无输出、`grep_exit=1`；`grep -c '^| `GX' docs/architecture/data/errors.md` ≥ 11。

- [ ] **Step 5: 收敛 RLS、索引、中间件链、DI、删除语义五组副本**

`overview.md` 原 `plan.md:510-606`（角色/CREATE POLICY/`visible_org_array`/`withUser`）→ 一行指向 `data/security.md` §8，只保留 plan 自有的 RBAC 边界（原 §7.5）；原 `plan.md:481-490` 索引 6 条规则 → 指向 `data/indexes.md`，统一 `EXPLAIN (ANALYZE)` 一种口径（`plan.md:490` BUFFERS / `research.md:153` TIMING off 两种删掉）；中间件链 8 份 → 只留 `runtime.md` 一份（原 `plan.md:744-758` §8.2）；DI 5 份 → 只留 `runtime.md` §8.1.1，删原 §8.4 表与 §14.1 重复示例；删除语义 5 份 → 只留 `data/invariants.md`，`overview.md`/`api/endpoints.md`/`requirements/user-stories.md` 改为引用编号。

Run: `python3 - <<'PY'
import pathlib,collections
lines=collections.defaultdict(set)
for p in pathlib.Path('docs').rglob('*.md'):
    if 'superpowers' in p.parts: continue
    for s in p.read_text().splitlines():
        t=s.strip()
        if len(t)>60: lines[t].add(str(p))
print(sum(1 for v in lines.values() if len(v)>1))
PY`
Expected: `0`（跨文档逐字重复长行归零）。

- [ ] **Step 6: 净删体量核对**

Run: `find docs -name '*.md' -not -path '*/superpowers/*' -exec wc -l {} + | tail -n 1` 与 `scripts/check-docs.sh --root docs 2>&1 | tail -n 1`
Expected: 总行数 ≤ 3500（原 5613）；`VIOLATIONS` 计数较 Task 2 基线显著下降；`R3 oos-dup` 违规 = 0。

- [ ] **Step 7: Commit**

```bash
git add docs/
git commit -m "docs: enforce single source of truth (drop 8 duplicated topic tables)"
```

---

### Task 5: 编号与引用修复

**Files:**
- Modify: `docs/architecture/data/schema.md`（原 `data-model.md:61,2697,1314,1325,1335,1870` `DM-GEN-16`；`:965,1117,1307,1336,1780,2743` `DM-MED-01`；`:58,60,65` `§13.4`；`:46,49,50,59` `§8`；`:61,371,389,712` `§8.2`；`:2677` `SC-DOC-01`；`:2653-2783` §18；`:2780` 统计行）
- Modify: `docs/requirements/out-of-scope.md`、`docs/requirements/acceptance.md`（原 `spec.md:313`/`:374` `EC-02`、§9 追溯矩阵）
- Modify: `docs/architecture/runtime.md`、`docs/architecture/stack.md`（`ARCH-HONO-01` 四种含义、`ARCH-HONO-04` 冲突、原 `plan.md:1556/1558/1559/1563/1566` 五处 §21 位置错指）
- Modify: `docs/README.md`（§21 编号索引迁入处，Task 9 建立骨架后补内容）

**Interfaces:**
- Consumes: Task 2 校验器 R4/R5/R7；Task 4 去重后的文档集。
- Produces: `scripts/check-docs.sh --root docs --strict` 的 `R4 dangling` / `R5 dual` / `R7 section` 全部为 0；原 `data-model.md:2780` 的手写「零悬空」统计改由脚本生成。

- [ ] **Step 1: 拆 `DM-GEN-16` 一号两义**

原 `:61` / `:2697` 保留「软约束必须登记在 §7.2 并有补偿测试」；`:1314` / `:1325` / `:1335` / `:1870` 的「Person 物理清除（GDPR）V1 不做」改用新编号 `DM-PURGE-01`，并在 `docs/README.md` 编号索引登记该新编号（宪法 `:210`）。`§7.2` 登记表标题同步去掉 `（DM-GEN-16）` 之外的错指。

Run: `grep -rn 'DM-GEN-16\|DM-PURGE-01' docs/ | grep -v docs/superpowers/`
Expected: `DM-GEN-16` 只出现在软约束语境；`DM-PURGE-01` 出现在物理清除语境与编号索引各 1 次。

- [ ] **Step 2: 拆 `DM-MED-01` 一号两义**

原 `:965` / `:1307` 保留「每个对象字节有唯一主人」= `DM-MED-01`；`:1117` / `:1336` / `:1780` / `:2743` 的「对象字节在事务提交后删除」改用 `DM-MED-02`，§18 定义位置改为真实章节（原错指「§5.16, §7.2」）。

Run: `grep -rn 'DM-MED-01\|DM-MED-02' docs/ | grep -v docs/superpowers/ | head -20`
Expected: 两组语境各自一致；编号索引两行定义文本不同、位置正确。

- [ ] **Step 3: 拆 `ARCH-HONO-01` 四义、修 `EC-02` 与 § 引用错指**

`ARCH-HONO-01` 拆成：原 `plan.md:614`「createFactory 的 API 形态」（Task 6 会按官方 `initApp` 改写，可能整条删除）、原 `plan.md:1555`「不用 createFactory 注入运行时依赖」（同样随 Task 6 删除）、`api.md:434-435`「全链式调用 + 具名变量推断类型」→ 新编号 `ARCH-RPC-01`、`research.md:36` 同义引用改为 `ARCH-RPC-01`。`ARCH-HONO-04` 在 `plan.md:684`（路径/查询参数 zValidator）与 `data-model.md:2671`（「上下文参数必须经校验」）冲突 → 保留前者，后者改为引用。`spec.md:313` `EC-02` =「关系两端指向同一个人（自环）→ 拒绝」；`:374` 追溯矩阵误写「`EC-02`（授权下载）」→ 改为真实的授权下载编号（若不存在则新增 `EC-13` 并在 `docs/requirements/functional.md` 定义）。原 `data-model.md:58,60,65` 的 `§13.4` → `§17 #12/#03/#01`（或直接删该列）；`:46,49,50,59` 的「§8 不变量表」→ `data/invariants.md`；`:61,371,389,712` 的「§8.2 软约束登记表」→ `data/invariants.md` 对应节；`:2677` 的 `SC-DOC-01` 引用改为指向 `docs/requirements/acceptance.md` 定义 + `scripts/check-docs.sh`。所有跨文档裸 `§x.y` 改写成显式 `file.md §x.y` 链接。

Run: `scripts/check-docs.sh --root docs 2>&1 | grep -E '^R5 dual|^R7 section'; echo "grep_exit=$?"`
Expected: 无输出、`grep_exit=1`。

- [ ] **Step 4: 修 §21 五处位置错指并处理悬空/未引用 ID**

原 `plan.md:1556` HONO-02「§3.1, §8.2」→ 真实位置（`:149` §2.1 → 新 `runtime.md` 对应节）；`:1558` HONO-04「§8.2」→ `:684`（新 `runtime.md`）；`:1559` HONO-05 → `:712`；`:1563` HONO-09 → `:923`；`:1566` HONO-12 → `:1023`。原 `data-model.md` §18.1 的 14 个 `ARCH-*` 映射表各只出现一次 → 从数据模型侧删除（它是 `plan.md` 的内容），在 `docs/README.md` 编号索引补定义或删号。`ARCH-GOV-01`（`constitution.md:140` 与 `plan.md:50` 两份定义）→ 只留宪法一份；`ARCH-OPS-01` 与 27 个未引用 `DM-*`（如 `DM-ADR-01..09`）→ 补引用或删号（宪法 `:228`「未引用 0」）。`SC-DOC-01` 在 `requirements/acceptance.md` 已有定义，确认引用可解析。

Run: `scripts/check-docs.sh --root docs 2>&1 | grep '^R4 dangling'; echo "grep_exit=$?"`
Expected: 无输出、`grep_exit=1`。

- [ ] **Step 5: 统计改由脚本生成 + 追溯矩阵补全**

删原 `data-model.md:2780` 手写 `**统计**：共 97 个编号，**零悬空、零冲突、零一号两义**。`；改为 `统计由 \`scripts/check-docs.sh --root docs --strict\` 生成，见 CI 输出`。把 `docs/requirements/acceptance.md` §9 追溯矩阵补为全量：24 FR + 8 NFR + 12 SC + 12 EC + 19 OOS + 45 个 Given/When/Then 场景 ↔ 实现 ↔ 验证三列（原 11 行 → ≥80 行）。修 7 个悬空 FR token（`FR-ERR-01`/`FR-OBS-01`/`FR-OPS-01`/`FR-SEC-01..03`/`FR-TST-01`）→ 补定义或删引用。

Run: `grep -rc '零悬空、零冲突、零一号两义' docs/` 与 `wc -l docs/requirements/acceptance.md`
Expected: 前者所有文件 = `0`；后者 ≥ `80`。

- [ ] **Step 6: Commit**

```bash
git add docs/
git commit -m "docs: fix one-id-two-meanings (DM-GEN-16/DM-MED-01/EC-02/ARCH-HONO-01) and dangling refs"
```

---

### Task 6: 用 Context7 重核官方断言（按 `ARCH-HONO-11`）

**Files:**
- Modify: `docs/architecture/stack.md`（原 `research.md:14,25-52,34,59,60,75,92,93,100,119-136,159-199`）
- Modify: `docs/architecture/runtime.md`（原 `plan.md:164,168,183,290,614,688,696,710,1348,1484-1507` §18）
- Modify: `docs/architecture/operations.md`（原 `plan.md:1144`、`:1224`、`:199`、`:201` 与 `research.md:152` 的 PGOPTIONS 陈旧 1.1 文案）
- Modify: `docs/architecture/data/migrations.md`（原 `data-model.md:2096` `bunx`、`:300` `bun run gen:sql`）
- Read-only: `/tmp/c7.py`、`/tmp/c7-*.txt`（Context7 缓存）；`https://hono.dev/docs/helpers/factory`

**Interfaces:**
- Consumes: Context7 `query-docs`（`libraryId` = `/honojs/website`、`/github/spec-kit`、`/websites/postgresql/18`、`/pnpm/pnpm.io`、`/drizzle-team/drizzle-orm-docs`、`/colinhacks/zod`、`/biomejs/website`）；一查询一概念。
- Produces: `stack.md` 每条官方依据 = 「逐字引文 + pinned URL + 抓取日期 2026-11-13 + 对应编号」；无死链、无「链接未定义」、无 unpinned `main`。

- [ ] **Step 1: Hono Factory 断言翻案（含 plan.md 三处）**

官方文档 [Helpers / Factory](https://hono.dev/docs/helpers/factory)（web_fetch 200）明确：`createFactory() can receive the initApp option`，并给出 `createFactory<Env>({ initApp: (app) => { app.use(...) } })` + `factoryWithDB.createApp()` 跨文件 DI 示例。把 `stack.md` 原 `research.md:34` §1.1 与 `runtime.md` 原 `plan.md:614`「`Factory` 只有三个方法」、`:688`「不是注入运行时依赖」、`:696`「不提供 `use()`/`get()`/`post()`」、原 `plan.md:710`「两者不冲突」统一改写为「官方提供 `createFactory({initApp})` 跨文件 DI；本项目选择 X，理由 Y」，并在 `stack.md` §18 依据表同步。删除 `https://github.com/honojs/hono/blob/main/src/factory.ts`（实测 404）。

Run: `grep -rn '只有 `createApp`\|不用 `createFactory`\|不提供 `use()\|blob/main/src/factory.ts' docs/ | grep -v docs/superpowers/; echo "grep_exit=$?"`
Expected: 无输出、`grep_exit=1`；`grep -rc 'initApp' docs/architecture/` ≥ 2。

- [ ] **Step 2: Zod 版本表述纠偏**

`stack.md` 原 `research.md:25`/`:75`、`runtime.md` 原 `plan.md:168` 的 `v4（^3.25 || ^4）` 是 `@hono/zod-validator@0.9.1` 的 `peerDependencies`，不是项目约束；`@hono/zod-openapi@1.6.3` peer 要求 `zod: ^4.0.0`。统一改写为「项目锁定 `zod@4.6.7`（2026-11-13 实测 latest，见 `stack.md` 工具链总表）；`^3.25.0 || ^4.0.0` 仅为 `@hono/zod-validator@0.9.1` 的 peer 范围，`@hono/zod-openapi@1.6.3` 要求 `^4.0.0`，故不允许 Zod 3.25」。同时把 `stack.md` 原 `research.md` §7 与 `runtime.md` 原 `plan.md` §3 工具链表的 `≥4.11.2` / `≥1.4.4` / `12.x` / `0.45.x` / `v4（^3.25 || ^4）` 全部替换为 Global Constraints 锁定的精确版本，并标注抓取日期 `2026-11-13`。

Run: `grep -rn '\^3.25' docs/architecture/; grep -rn '≥ *4\.11\|12\.x\|0\.45\.x\|v4（' docs/architecture/`
Expected: 第一条命令的所有命中都带「peer 范围」限定词，不再作为项目版本约束；第二条命令无输出（exit=1），锁定版本表中不再有区间写法。

- [ ] **Step 3: 补齐 11–13 行「官方依据链接 = 未定义」**

用 `/tmp/c7.py` 的 `call('query-docs', {'libraryId': ..., 'query': ...})` 逐条拉官方页面，把 `stack.md` 原 `research.md` §7/§2/§3 的「未定义」替换为 pinned URL + 逐字引文 + 日期；原 `plan.md` §18 的 13 条 Hono 链接同样 pin 到版本或注明「文档未版本化，抓取于 2026-11-13，侧栏已含 Migrating to v5」。保留并标注官方已确认的结论（`security_invoker=true`、FORCE RLS、FK 不自动建引用侧索引、`clock_timestamp()` vs `now()`、`uuidv7()`、Hono 中间件顺序、pnpm `--frozen-lockfile`、Biome `overrides`）。原 `research.md:119` 标题「链接原文搬移」改为「官方依据（逐字引文）」。

Run: `grep -rc '未定义\|不做补链' docs/architecture/stack.md`
Expected: `0`。

- [ ] **Step 4: 逐条验活 URL**

Run: 对 `docs/architecture/*.md` 与 `docs/architecture/data/*.md` 中所有 `http(s)://` 逐条 `curl -sS -o /dev/null -w '%{http_code} %{url_effective}\n' <url>`
Expected: 全部 `200`（或 `301/302` 且最终 200）；任何 `404` 必须删除或替换为有效官方页面。删原 `research.md:126` 中不被 [CREATE TRIGGER](https://www.postgresql.org/docs/18/sql-createtrigger.html) 支持的「PG 18 的 `AFTER` 触发器以入队时角色执行」；原 `research.md:100` 的 `--custom` 改引 [Custom migrations](https://orm.drizzle.team/docs/mysql/kit-custom-migrations) 或降级为「待验证」。

- [ ] **Step 5: 处理不可复现的「实测」、版本漂移与包管理器矛盾**

原 `research.md:93`「实测确认 `drizzle-orm@0.45.4` 的 `pg-core/columns/common.js` 第 28 行硬编码 `mode: "stored"`」→「待验证」并在 `docs/verification/README.md` 登记；`:192`「见 `pg18-verification-log.md`」→ 指向 `docs/verification/README.md`；PG 18.0 / 18.6 / 18.7 统一为「PostgreSQL 18（待验证；本机无 `psql`，未实测）」并在 `docs/verification/README.md` 与 `docs/architecture/data/invariants.md` 软约束登记表登记。Drizzle `pgPolicy()` 不生成 FORCE RLS 的 claim 补官方证据或降级。原 `data-model.md:2096` `bunx drizzle-kit generate`、`:300` `bun run gen:sql` 改为 `pnpm`（`plan.md:205`/`:1340` 硬约束「包管理器只有 pnpm」）。原 `plan.md:163`/`:213`「Playwright 不在 Bun 上跑」按 [Bun 1.4](https://bun.sh/blog/bun-v1.4) 与 [Playwright release notes](https://playwright.dev/docs/release-notes) 复核，改为带出处的限定断言；`plan.md:1326` 浮动 tag `FROM oven/bun:1-slim` 改为固定 `FROM oven/bun:1.4.4`（用户版本锁定决策），并核对 `pnpm 12.18.0` / `Bun 1.4.4` 与 `stack.md` 锁定表一致。

Run: `grep -rn 'PostgreSQL 18\.0\|18\.6\|实测确认\|pg18-verification-log\|bunx\|bun run gen:sql' docs/architecture/ docs/verification/; echo "grep_exit=$?"`
Expected: 无输出、`grep_exit=1`。

- [ ] **Step 6: 修 PGOPTIONS 陈旧 1.1 文案与 Bun 入口矛盾**

`operations.md` 删原 `plan.md:1144`「三个超时在连接池初始化连接时统一 `SET`」与 `research.md:152` 同类文案，统一为 `PGOPTIONS='-c lock_timeout=3000 -c statement_timeout=30000 -c idle_in_transaction_session_timeout=60000'`（宪法 `:174-175`），并补 `data-model.md:2177` 的 `prepare: false` 硬要求。`runtime.md` 修原 `plan.md:290`「`Bun.serve` 入口」vs `:1348`「无需自己 `Bun.serve`」→ 二选一并给官方出处；修 `:293`/`:301` 两条同名 `middleware/` 目录内容不一致。

Run: `grep -rn '初始化连接时统一\|FROM oven/bun:1-slim\|Bun.serve 入口' docs/architecture/; echo "grep_exit=$?"`
Expected: 前者无输出、`grep_exit=1`；`PGOPTIONS` 至少 1 处命中，`prepare: false` 至少 1 处命中。

- [ ] **Step 7: Commit**

```bash
git add docs/
git commit -m "docs: re-verify official claims via Context7 (Hono initApp, Zod v4 peer, pinned URLs, pnpm)"
```

---

### Task 7: 验收可测化与 Phase 0 未决项闭环

**Files:**
- Modify: `docs/requirements/user-stories.md`（原 `spec.md:23-192` 45 个 Given/When/Then + 原 `data-model.md:2224-2494` 59 条验收清单去重）
- Modify: `docs/requirements/acceptance.md`（原 `spec.md:272-292` §5、`:364-380` §9）
- Modify: `docs/architecture/api/endpoints.md`（原 `api.md:5-13` §0、`:450-467` §4）
- Modify: `docs/architecture/stack.md`（Phase 0 结论）

**Interfaces:**
- Consumes: Task 5 的全量追溯矩阵；spec-kit 官方 Phase 0 规则「mark unknowns as `NEEDS CLARIFICATION`」+「Generate research.md (resolve all NEEDS CLARIFICATION)」。
- Produces: 每个 `**Then**` 含显式 oracle 与阈值；`scripts/check-docs.sh` 的 `R6 needs-clarification` = 0。

- [ ] **Step 1: 给含糊 `Then` 补 oracle**

原 `spec.md:35`「该姓名字段在界面上有独立的展示位置」、`:36`「不参与正式称谓排序」、`:106`「反向引用列表完整」、`:108`/`:192`「按声明的删除语义处理（不留下悬空引用）」等，逐条改写为可判定断言（指定具体表/视图/约束/查询与期望行数，或引用 `DM-*` 编号与 `scripts/check-docs.sh` 风格的可执行校验）。禁止使用「声明的语义」「完整」「独立」等无 oracle 措辞指向未定义文档。

Run: `grep -rc '声明的语义\|反向引用列表完整\|独立的展示位置' docs/requirements/`
Expected: 所有文件 `0`。

- [ ] **Step 2: 九类未定义项进需求并给出 Phase 0 结论**

把原 `api.md:450-467` §4 的 9 类（Zod schema 名、逐端点状态码、权限名矩阵、分页参数名、限流配额、幂等、批量、约 10 类端点、ErrorCode→HTTP 映射）以 `[NEEDS CLARIFICATION: ...]` 标记写入 `docs/requirements/functional.md`，在 `stack.md` Phase 0 逐条给出结论（能定的定值并回写需求，不能定的明确登记为「Phase 0 未决、阻塞该批次 /speckit-tasks」，写入 `docs/README.md` 未决项表），最后删除所有 `[NEEDS CLARIFICATION]` 标记。修原 `api.md:5-13` §0「需在实现阶段由 spec 补齐」与 §4「不得在实现阶段自行编造」的冲突，统一为「Phase 0 解决」。

Run: `grep -rc 'NEEDS CLARIFICATION' docs/ --include='*.md' | grep -v ':0' | grep -v superpowers; echo "grep_exit=$?"`
Expected: 无输出、`grep_exit=1`；`stack.md` 含 9 条 Phase 0 结论。

- [ ] **Step 3: 修 `SC-INT-03` / `SC-PER-01` 与实测冲突**

原 `spec.md:284` `SC-INT-03`「外键引用侧列的支撑索引覆盖率 = 100%」与 `data-model.md:1959`「55 条外键中 37 条有，18 条无」冲突：二者取其一 —— 要么把 18 条例外登记进 `data/invariants.md` 软约束登记表并改 `SC-INT-03` 为「登记例外 = 0 未登记」，要么补索引。`SC-PER-01`「1 万行 P95 < 200ms」未测量 → 标注「待压测，Article IX 先测量再优化」并登记，不得当作已达标。

Run: `grep -rn 'SC-INT-03\|SC-PER-01' docs/requirements/acceptance.md`
Expected: 两条都不含「= 100% 已达标」/「< 200ms 已验证」式既成事实表述。

- [ ] **Step 4: Commit**

```bash
git add docs/
git commit -m "docs: make acceptance criteria testable and close Phase 0 clarifications"
```

---

### Task 8: 两次门禁、复杂度登记与数值/实现矛盾

**Files:**
- Modify: `docs/README.md`（原 `plan.md:70-83` §1.4 两次 Constitution Check、`:1518-1531` §20 Complexity Tracking 三列、`:1532-1580` §21 编号索引、`:1508-1517` §19 文档边界）
- Modify: `docs/architecture/data/schema.md`、`data/invariants.md`（原 `data-model.md` 的 36 处数值/实现矛盾）
- Modify: `docs/architecture/overview.md`、`runtime.md`（原 `plan.md:209`、`:1449`、`:290`/`:1348`）

**Interfaces:**
- Consumes: 宪法 `:200-201`（两次门禁）、`:152-153`（三列登记）、`:69-70`（执行者四选一）、Article II/VIII/IX。
- Produces: `scripts/check-docs.sh --root docs --strict` 的 `R8 size` 违规 = 0（或每条 >400 行文件在 README 有登记）；所有成对矛盾各留一处真值。

- [ ] **Step 1: 补第二次 Constitution Check 逐条回答**

原 `plan.md:83` 要求「逐条回答『新增了什么、它的执行者是谁、编号是否已登记』。空着不写就等于不允许」—— 在 `docs/README.md` 插入 7 条清单（对应宪法 `:210` 的 7 问）的逐条回答表，每条含「新增项 / 执行者（DB 约束|触发器|服务层|测试）/ 编号 / 编号索引登记位置」。删掉原 §20 中「本表为空，表示当前设计完全在宪法与预算之内」的自证句（改为引用 `scripts/check-docs.sh` 输出）。修原 `plan.md:71`「本文所有约束均标注执行者与验证方式 ✅」的假 ✅。

Run: `grep -c '执行者' docs/README.md` 与 `grep -rc '当前设计完全在宪法与预算之内' docs/`
Expected: 前者 ≥ 7；后者所有文件 = `0`。

- [ ] **Step 2: 填 Complexity Tracking 三列**

登记 5 类真实例外：①超 400 行的主题文件（Why Needed：内聚主题不便拆分；Simpler Alternative Rejected Because：按 `ARCH-GOV-01` 拆分会制造指标驱动设计）；②18 条无支撑索引的 FK；③PgBouncer/Sentry/APM/WAF 隐含第 4+ 个基础设施组件（宪法上限 3）；④`data/invariants.md` 原 `data-model.md:1415-1416`/`:1556-1557` `EXCEPTION … RETURN NULL` 与 `plan.md:538`「默认拒绝，不报错」按 Article VIII 登记例外；⑤`plan.md:344-354` 9 行模块表 vs `:356`/`:1059` 8/7 域的模块数口径。每行三列填齐；表头从原 6 列改为宪法要求的 3 列。

Run: `awk '/## Complexity Tracking/,/^## /' docs/README.md | grep -c 'Why Needed\|Violation'`
Expected: ≥ 1 表头且数据行 ≥ 5。

- [ ] **Step 3: 数值矛盾收敛**

统一 PostgreSQL 版本为「18（目标，未实测）」；「修正 5 处」/「12 项真实缺陷」二选一并与 `docs/decisions/0001-pg18-defects.md` 对齐；「验收用例 53」与实际 59 个用例头对齐（或删计数）；「17 张表 / 全部 18 张」对齐；「22 张表 rowsecurity=true」vs `tables=22, rls_on=21, policies=21` 对齐并说明那 1 张为何无 RLS；`api.md:134`「细粒度码 24 个」vs `data-model.md:1802-1829` 26 行/25 码对齐。

Run: `grep -rn '18\.0\|18\.6\|5 处\|12 项\|用例 53\|全部 18 张\|rowsecurity = true' docs/architecture/ docs/decisions/ | head -30`
Expected: 每个矛盾只剩一处真值，无成对冲突行。

- [ ] **Step 4: 实现矛盾收敛**

原 `:2569` 说已改 `ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE` 但 `:361-362` 仍旧写法 → 按正确 DDL 顺序统一；`:1488/:1500/:1502/:2559`「不需要行锁」vs `:1739/:1759` `FOR SHARE` → 统一为 CAS 无锁的一份；`:1741` `IF v_prev <> app.current_user_id()` → `IS DISTINCT FROM`（Article VIII，NULL 不得静默跳过 owner 校验）；`:1788` `revoked_reason = p_reason` 与 invite 字段表（`:393-406`）不一致 → 删列或补列定义；`:1774` `app.artifact_exists()` 不在 `:1519` 的 16 个函数清单 → 补进清单或删调用；`:143-144` `23503`/`23001` 都映 `CONFLICT` 与 `plan.md:838`「必须分开」对齐；`:154` `GX005 NOT_FOUND` vs `data-model.md:1819` `TARGET_INVALID` 对齐；`:129` `RATE_LIMITED` 429 vs `:136`/`:464`「未定义」对齐。

Run: `grep -rn 'v_prev <>\|ON DELETE RESTRICT\|FOR SHARE\|revoked_reason\|artifact_exists' docs/architecture/data/`
Expected: `<>` 不出现在 owner 校验；每组只有一份一致写法。

- [ ] **Step 5: Article II/III 违规收敛**

原 `:371` / `:1842` `status='archived'` 替代物理删除 → 改为物理删除语义，或若确为业务状态则明确写「归档是业务状态，不替代删除」并给出删除的执行者（与 `:2519`「删除就是删除」及 `spec.md:160`「数据不被物理删除」统一）；`:1309/1314/1319` 的「结构决策 / 流程 / 文档」三行改为四选一执行者或删除该行；`:195` 声称四处清单由 `src/domain/enums.ts` 生成但全是手写 → 改为「本文件为唯一权威手写清单，`gen:sql` 待实现」，并把 `:300`「CI 只做一件事」与 `:2117-2128` 十项校验统一；`:234` 物化 `organization_id` 说明为何不可推导，否则按 Article IV 删除。

Run: `grep -rc '结构决策 |\|流程 |\|文档 |' docs/architecture/data/invariants.md`
Expected: 不变量表「类型」列不再出现三类非执行者值。

- [ ] **Step 6: Commit**

```bash
git add docs/ .specify/memory/constitution.md
git commit -m "docs: complete second constitution gate, register complexity exceptions, resolve contradictions"
```

---

### Task 9: `docs/README.md` 导航与 `docs/` ↔ `specs/` 分工约定

**Files:**
- Modify: `/home/bobo/project/yunpu/docs/README.md`（Task 8 已建立门禁/例外/编号索引骨架，本 Task 补导航与分工）
- Read-only: `/home/bobo/project/yunpu/.specify/scripts/bash/check-prerequisites.sh`（只跑一次，记录事实）

**Interfaces:**
- Consumes: 评审报告 v2 §4.2 目录树、§5 谁定义什么表；spec-kit 官方 Project Structure（`.specify/templates/plan-template.md:44-62`）。
- Produces: `docs/README.md` 含「谁定义什么」表、阅读顺序、校验命令、`specs/` 后期分批约定；`check-prerequisites.sh --json` 当前 exit=1 被**如实记录**，不伪装通过、不为变绿创建 `specs/`。

- [ ] **Step 1: 写「谁定义什么」导航表**

`docs/README.md` 顶部写一张表：每个 `docs/` 主题文件 → 负责的主题 → 唯一权威的编号族（`OOS-*` / `DM-*` / `ARCH-*` / `SC-*` / `EC-*`）→ 校验命令 `scripts/check-docs.sh --root docs --strict`。补阅读顺序：先 `README.md` → `requirements/` → `architecture/overview.md` → `architecture/data/` → `architecture/api/`。

Run: `grep -c '唯一权威\|check-docs.sh' docs/README.md`
Expected: ≥ 17 行命中（对应 17 个主题文件）且含 `scripts/check-docs.sh --root docs --strict`。

- [ ] **Step 2: 写 `docs/` ↔ `specs/` 分工约定（含用户决策原文）**

单开一节写明：`docs/` 是**完整目标架构基线**，稳定、按主题组织、与实现批次无关；`specs/<NNN>-<feature>/` 只在后期分批实现时由 `/speckit-specify` 生成，按官方 Project Structure 放 `spec.md`/`plan.md`/`research.md`/`data-model.md`/`quickstart.md`/`contracts/`/`tasks.md`，每个批次**引用 `docs/` 编号，不复制**；`.specify/feature.json` 是 gitignored 本地状态、CI 用 `SPECIFY_FEATURE_DIRECTORY`，二者都属于工具状态不属于文档树。明确写「本次重构不创建 `specs/`，不生成 `tasks.md`/`quickstart.md`」。

Run: `grep -n '不创建 `specs/`\|引用 `docs/` 编号，不复制\|SPECIFY_FEATURE_DIRECTORY' docs/README.md`
Expected: 三处都命中。

- [ ] **Step 3: 如实记录 spec-kit 运行时当前状态**

Run: `/home/bobo/project/yunpu/.specify/scripts/bash/check-prerequisites.sh --json 2>&1; echo "prereq_exit=$?"`
Expected: `prereq_exit=1`，输出含 `ERROR: Feature directory not found. Set SPECIFY_FEATURE_DIRECTORY or run the specify command to create .specify/feature.json.` 或 `ERROR: Failed to resolve feature paths`。把该事实与原因写入 `docs/README.md`（「当前未开始任何实现批次，故无特性目录；这不是缺陷，也不需要为了变绿而造一个」）。**不要**写 `.specify/feature.json`、**不要**创建 `specs/`。

Run（第二条）: `test ! -e .specify/feature.json && test ! -d specs && echo "STATE_OK"` 与 `grep -c 'prereq_exit=1\|Feature directory not found' docs/README.md`
Expected: `STATE_OK`；README 计数 ≥ 1。

- [ ] **Step 4: Commit**

```bash
git add docs/README.md
git commit -m "docs: add navigation and docs/ vs specs/ boundary, record spec-kit runtime state honestly"
```

---

### Task 10: 全绿收尾与提交

**Files:**
- Read-only: 全部 `docs/**`、`.specify/memory/constitution.md`
- Modify: `/home/bobo/project/yunpu/docs/superpowers/reviews/2026-11-13-architecture-docs-review.md`（追加「实施结果」小节，记录最终计数与未满足门禁）

**Interfaces:**
- Consumes: Task 1–9 全部产物。
- Produces: `scripts/check-docs.sh --root docs --strict` exit=0；`git status --short` 干净（除已声明的 `.dsh/`、`docs/superpowers/`）；**无 `specs/`**。

- [ ] **Step 1: 跑编号/链接/行尾全量校验**

Run: `scripts/check-docs.sh --root docs --strict; echo "check_exit=$?"`
Expected: `check_exit=0`，`VIOLATIONS=0`（`WARN>0` 时每条在 `docs/README.md` Complexity Tracking 有登记）。

- [ ] **Step 2: 跑校验器自身测试**

Run: `bash tests/docs/check-docs.test.sh; echo "test_exit=$?"`
Expected: `test_exit=0`。

- [ ] **Step 3: 断言用户决策未被违反**

Run: `test ! -d specs && echo "NO_SPECS_OK"`; `find docs/architecture -maxdepth 1 -name 'spec.md' -o -name 'plan.md' -o -name 'research.md' -o -name 'data-model.md' -o -name 'api.md' | wc -l`; `git status --short`
Expected: `NO_SPECS_OK`；旧文件名计数 = `0`；`git status --short` 无 `?? specs/`、无 `.specify/feature.json`。

- [ ] **Step 4: 记录未满足的宪法门禁**

Run: `ls scripts/gen-sql.ts 2>&1; echo "gen_sql_exit=$?"`
Expected: 文件不存在、`gen_sql_exit=2`；在评审报告「实施结果」小节明确写「`constitution.md:222` 的 `gen:sql && git diff --exit-code` 门禁因仓库尚无 `scripts/gen-sql.ts` 未满足，属后续实现阶段任务，不伪装为通过」。

- [ ] **Step 5: 行尾、体量、断链终检**

Run: `grep -rlc $'\r' docs/ scripts/ --include='*.md' --include='*.sh' | head` 与 `find docs -name '*.md' -not -path '*/superpowers/*' -exec wc -l {} + | tail -n 1` 与 `git status --short`
Expected: 前者无输出；体量与 `docs/README.md` 登记一致；`git status --short` 除 `.dsh/`、`docs/superpowers/` 外干净。

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/reviews/2026-11-13-architecture-docs-review.md
git commit -m "docs: record architecture refactor verification results"
```

---

## Self-Review（已完成，fix 已内联）

1. **Spec coverage**：评审报告 v2 §6 的 10 条建议 → Task 1（治理）、2（执行者）、3（主题化目录树）、4（8 主题重复/一题一文件）、5（编号/追溯矩阵）、6（Context7 官方依据）、7（验收可测/Phase 0）、8（门禁/预算/数值矛盾）、9（导航与 `docs/`↔`specs/` 分工）、10（全绿收尾），逐条有 Task；评审报告 §7 原 5 个开放问题已于 2026-11-13 21:31 由用户全部拍板（§4.2 17 文件 / 标题改「九条」/ PG 18「实测」降级「待验证」/ **版本锁定到实测最新版** / `docs/` 保留），其中第 4 项偏离报告推荐，已回写本计划 Global Constraints 与 Task 6 Step 2/5。
2. **Step scan**：每个 Step 都是单动作 + 可核对的 `Run`/`Expected`；未在代码块里写脚本正文（Task 2 Step 3 只给规则契约与语言约束）。
3. **Type consistency**：全局统一 `scripts/check-docs.sh --root <dir> [--strict] [--json]`、规则名 `R1 link`…`R8 size`、文档根 `docs/`、宪法版本 `1.1.0`、目标目录树 17 个主题文件；**不含 `--no-tasks`**（v2 不生成 `tasks.md`，v1 的该 flag 已删除）；不出现 `specs/001-cloud-genealogy-v1/`。
4. **Review Focus**：6 条失败模式（含新增「不要把架构文档搬进 `specs/`」）分别钉在 Task 3/4/5/2/6/10 的 Step 上，且都有对应 fixture 或 `grep`/`test` 断言。
5. **Proportion**：本计划 10 个 Task、60 个 Step；规格（评审报告 v2）273 行、被评审文档 5613 行 —— 计划不含实现代码正文，且比 v1 更聚焦于按主题重组（删掉 `specs/` 迁移、`quickstart.md`/`tasks.md` 生成、`feature.json` 写入等已作废动作）。
6. **v1 → v2 变更**：用户决策 m00401 后，删掉「整体迁入 `specs/001-cloud-genealogy-v1/`」「物理删除 `docs/architecture/`」「生成 `quickstart.md`/`tasks.md`」「写 `.specify/feature.json`」「让 `check-prerequisites.sh --json` 变绿」五组动作；新增「按主题重组 17 个文件」「`docs/README.md` 导航与分工」「如实记录 `prereq_exit=1`」三组动作。第三位评审代理（plan.md + api.md）的 10 条发现已并入评审报告 v2 §2/§3 与 Task 4/5/6/8。

---

## Execution Handoff（用户已于 2026-11-13 21:31 确认）

按 `/writing-plans` 技能规定计划先经用户审阅；用户已确认并选定 **Subagent-driven**（`subagent-driven-development` 技能：每个 Task 一个 implementer + 一个 task reviewer，末尾一次 whole-branch review）。评审报告 §7 的 5 项决策已并入本计划 Global Constraints、Task 1/3/6 与报告 §3/§4/§5/§6/§7；「版本锁定到实测最新版」偏离推荐，按用户选择改写。实施按 Task 1→10 连续执行，任务之间不停下询问；仅遇不可逆/破坏性操作、安全敏感、worktree 外副作用（merge/push/publish）时停下。
