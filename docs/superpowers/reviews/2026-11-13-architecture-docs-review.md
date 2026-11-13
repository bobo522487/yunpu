# 目标架构文档评审报告（Linus 哲学 + 官方最佳实践）· v2

- **日期**：2026-11-13（Asia/Shanghai）
- **评审范围**：`/home/bobo/project/yunpu/docs/architecture/` 下 5 份文档（用户称 `/docs`；绝对路径 `/docs` 不存在）
- **基线**：`/home/bobo/project/yunpu/.specify/memory/constitution.md` v1.0.0（9 条 Article，用户原文称「这五条是 Linus 哲学」）；spec-kit v1.4.0 官方模板与脚本
- **方法**：只读静态扫描（行数/行尾/链接/编号/去重）＋ 3 个独立只读评审子代理 ＋ Context7 官方库文档（`/github/spec-kit`、`/honojs/website`、`/websites/postgresql/18`、`/pnpm/pnpm.io`、`/drizzle-team/drizzle-orm-docs`、`/biomejs/website`）＋ 官方网页 web_fetch ＋ npm registry / GitHub releases 版本实测
- **本报告只读**：未改动任何被评审文档；所有重构动作写进配套实施计划，用户已于 2026-11-13 21:31 确认执行（Subagent-driven）
- **用户决策（m00401，2026-11-13 21:20，逐字）**：`我希望还是保持在 docs 目录下放完整的目标架构文档。specs/ 目录下后期再分批一步一步的实现。架构文档的目录肯定不是这几个文件名；` → 本版 §4/§5/§6 与配套计划 v2 已按此改写：**不把架构文档整体迁入 `specs/`，不物理删除 `docs/architecture/` 的知识内容，改为按主题重组目录与文件名**；v1 的「删除 `docs/architecture/`」建议作废。
- **用户 5 项决策（ask_user_question，2026-11-13 21:31，实施已授权）**：执行方式 = **Subagent-driven**；目录粒度 = **§4.2 主题化 17 文件**；宪法 = **改标题为「九条」**（正文 9 条措辞不改）；PG 18「实测」= **降级为「待验证」**；版本策略 = **锁定到 2026-11-13 实测最新版**（第 4 项偏离本报告原推荐「明确标注下限」，已回写 §3.1、§4.2、§5、§6、§7 与配套计划 Global Constraints / Task 6 Step 2/5）。
- **引用口径**：下文所有 `文件路径:行号` 均为 2026-11-13 重构前基线快照；重组后行号必然变化，实施时以编号（ID）与主题定位，不依赖行号。

---

## 0. 裁决

文档的技术含量很高（PG 18 RLS、`security_invoker`、`clock_timestamp()`、FK 引用侧索引、Hono 中间件顺序等多数结论与官方文档一致），**但它违反了自己刚刚批准的宪法，并且对外声称的状态不成立**。按 Article I「简单胜过聪明」与 Article III「规则要有执行者」，这不是「再补点说明」的问题，而是**删掉重复、把假状态改成真状态、给规则装上执行者**的问题。

三个最强问题：

1. **虚构产物 + 门禁自证全绿**：`docs/architecture/plan.md:224-282` §4.1 画出一棵 `specs/001-cloud-genealogy-v1/` 树并声明「遵循 spec-kit 的官方文档树」，状态表 7 行把 `/speckit.tasks` 写成 ✅「已完成（81 个任务）」、`quickstart.md` / `contracts/` 写成已交付；实际 5 份文档平铺在 `docs/architecture/`，`specs/` 不存在，`.specify/feature.json` 缺失，`/home/bobo/project/yunpu/.specify/scripts/bash/check-prerequisites.sh --json` 报 `ERROR: Feature directory not found.` 并 exit=1。第二次 Constitution Check（`plan.md:81`）完全空白，§20 却写「本表为空，表示当前设计完全在宪法与预算之内」。
2. **自证清白的编号体系**：`docs/architecture/data-model.md:2780` 写「共 97 个编号，**零悬空、零冲突、零一号两义**」，实测 `DM-GEN-16`、`DM-MED-01`、`EC-02` 各承载两条不同规则，`ARCH-HONO-01` 有四种含义，14 个 `ARCH-*` / `SC-DOC-01` 无定义，三处 `§13.4` 指向不存在的章节，`plan.md:1537-1573` §21 索引表 5 处位置指针错误；而 `docs/architecture/spec.md:285` 把校验责任交给「校验脚本」，仓库里没有任何脚本（Article III：没有执行者的规则不是规则，是愿望）。
3. **单一真相源崩坏**：8 个主题各有 3–5 份互相否定的副本（错误码、RLS 谓词/角色、索引、工具链版本表、明确不做、中间件链、依赖注入、删除语义，见 §2 P0-3 矩阵）；跨文档 87 条逐字重复长行；近千行修订记录 / 实测 / 迁移 / 验收清单混进规格文档 —— 同时违反 Article II（删掉就是删掉）、Article VI（单一真相源）、Article VII（不猜未来）与宪法「文档分层不重叠」。

---

## 1. 事实基线（实测，非推断）

| 文件 | 行数 | 字节 | 行尾 |
|---|---:|---:|---|
| `docs/architecture/api.md` | 467 | 44,738 | 467/467 CRLF |
| `docs/architecture/data-model.md` | 2,845 | 185,427 | 全 LF |
| `docs/architecture/plan.md` | 1,595 | 121,274 | 1,595/1595 CRLF |
| `docs/architecture/research.md` | 320 | 40,732 | 全 LF |
| `docs/architecture/spec.md` | 386 | 32,644 | 全 LF |
| **合计** | **5,613** | **424,815** | 同目录混用 CRLF/LF |

- 宪法 `constitution.md:146` 规定「单文件行数 400 = **警报**」、`:140-141` `ARCH-GOV-01`「超过 400 行触发评审讨论『是否内聚』，不触发自动拒绝」；`:152-153` 要求突破预算须在 Complexity Tracking 登记三列。3/5 文件超 400 行，但 `docs/architecture/plan.md:1518-1531` §20 只有一行占位 `| — | 当前无例外 | — | — | — | — |`（且表头是 6 列，与宪法要求的 3 列不符）。
- `git log --oneline` 只有 `44c7eec chore: initialize repository`；`git status --short` = `?? .dsh/ ?? .specify/ ?? docs/`。五份文档从未提交，所有「v1.1 → v1.2 修订记录」没有 git 历史支撑。
- 仓库内除 `.specify/scripts/` 脚手架外**没有任何 `.ts/.js/.mjs/.py` 源码**；`bun MISSING`、`psql: NOT FOUND`、`pg_ctl: NOT FOUND`。
- 基础设施预算不实：宪法 `:150` 硬约束「3（应用 / PostgreSQL / 对象存储）」，但 `plan.md:102`/`:1391` 有 PgBouncer、`:1224` Sentry、`:199` APM + 网关、`:201` WAF；业务模块 `:148` ≤8 vs `plan.md:344-354` 9 行表、`:356`/`:1059` 的 8/7 域三种口径。均未登记例外。

---

## 2. P0 · 阻塞级发现

### P0-1 虚构目录树、假命令状态与工具链脱节

`docs/architecture/plan.md:224-282` §4.1 画出的树是 `specs/001-cloud-genealogy-v1/` 下 `spec.md / plan.md / research.md / data-model.md / quickstart.md / contracts/api.md / tasks.md`，外加 `.codebuddy/commands/`、`.specify/feature.json`、`data/schema_v12.sql`、`data/functions_v12.sql`；具体行：`plan.md:242`「└─ 001-cloud-genealogy-v1/ ← 特性目录」、`:247`「quickstart.md Phase 1 交付」、`:249`「contracts/api.md」、`:250`「tasks.md Phase 2 任务清单」、`:263`「`/speckit.plan` … ✅ 已完成」、`:264`「`/speckit.tasks` … ✅ 已完成（81 个任务）」。`plan.md:226` 自称「**遵循 spec-kit 的官方文档树，不另创体系**」。

实际：`find docs -maxdepth 3 -type f` 只有 5 个平铺文件；无 `specs/`、无 `tasks.md`、无 `quickstart.md`、无 `contracts/`、无 `data/*.sql`、无 `scripts/gen-sql.ts`、无 `packages/shared/src/permissions.ts`、无 `pg18-verification-log.md`。集成是 `.dsh/skills`（9 个 `speckit-*` 技能）而非 `.codebuddy`。`docs/architecture/spec.md:385` 引用不存在的 `contracts/api.md`，`docs/architecture/data-model.md:10` 的相对链接 `./tasks.md` 是唯一断链，`api.md:1` 标题「云谱 API 契约（001-cloud-genealogy-v1）」却放在 `docs/architecture/`。`plan.md:333` 画 `└─ docs/` 为空，真实文档却在 `docs/architecture/`。

官方依据（Context7 `/github/spec-kit`，本地 `.specify/templates/plan-template.md:44-62` 一致）：

- 官方 Project Structure：`specs/[###-feature]/` 下 `plan.md`（/speckit-plan 产出）、`research.md`（Phase 0）、`data-model.md` / `quickstart.md` / `contracts/`（Phase 1）、`tasks.md`（Phase 2，`NOT created by __SPECKIT_COMMAND_PLAN__`）。**官方 Documentation 树不含 `spec.md`**（它是 `/speckit-specify` 的输入/产物，由该文件自己管理）。→ `plan.md` 把 `spec.md`、`feature.json`、`.codebuddy/`、`data/*.sql` 塞进「官方树」，恰是「不另创体系」的反例。
- `/home/bobo/project/yunpu/.specify/scripts/bash/common.sh:188-237` 的 `get_feature_paths()` 是布局唯一权威：`SPECIFY_FEATURE_DIRECTORY` 环境变量 > `.specify/feature.json` 的 `feature_directory`；输出 `FEATURE_SPEC / IMPL_PLAN / TASKS / RESEARCH / DATA_MODEL / QUICKSTART / CONTRACTS_DIR`。`create-new-feature.sh:464-467` 才会写 `feature.json`。
- `/home/bobo/project/yunpu/.specify/.gitignore` 明确忽略 `feature.json`，注释：「Rewritten every time you switch features, so it is per-checkout state rather than something to share.」—— 它是**本地状态**，不该被画进文档树当交付物，更不该提交。
- 本项目 `.dsh/skills/speckit-tasks/SKILL.md` 的 `name: "speckit-tasks"`、`integration.json` 的 `invoke_separator:"-"` → 正确命令名是 `/speckit-tasks`，状态表里的 `/speckit.tasks` 是另一种集成的写法。

> **Linus 判词**：状态表是给人看的愿望，不是事实。一个 `check-prerequisites.sh --json` 就能证伪的东西写 7 行 ✅，属于 Article VIII「失败要响亮」的反面。**修复方向（用户决策）不是把文档搬进 `specs/`，而是删掉这棵想象的树和假状态，让 `docs/` 成为真实的架构基线，`specs/` 留到实现批次开始时由工具生成。**

### P0-2 编号体系：一号两义、悬空、错指、无执行者

已核实（逐条复读原文）：

| 编号 | 定义 A | 定义 B | 证据 |
|---|---|---|---|
| `DM-GEN-16` | 软约束必须登记并有补偿测试 | Person 物理清除（GDPR）V1 不做 | `data-model.md:61`、`:2697` vs `:1314`、`:1325`、`:1335`、`:1870` |
| `DM-MED-01` | 每个对象字节有唯一主人 | 对象字节在事务提交后删除 | `data-model.md:965`、`:1307` vs `:1117`、`:1336`、`:1780`、`:2743`（§18 定义位置还错指 §5.16/§7.2） |
| `EC-02` | 关系两端指向同一个人（自环）→ 拒绝 | 授权下载 | `spec.md:313` vs `:374` |
| `ARCH-HONO-01` | `createFactory` 不存在的 API | 「不用 createFactory 注入运行时对象」/「全链式调用」/「RPC 类型推断要求」 | `plan.md:614`、`:1555`、`api.md:434-435`、`research.md:36` 四种含义 |

- 错指章节：`data-model.md:58,60,65` 三处 `§13.4 实测 #12/#03/#01`，但 §13 只有 13.1/13.2/13.3（实测在 §17）；`:46,49,50,59` 的「§8 不变量表」实际在 §7.1；`:61,371,389,712` 的「§8.2 软约束登记表」实际在 §7.2。`research.md:51/:189`「§18 官方实践表」、`:257`「§17.1」、`:272`「§16 #26」在 research.md（仅 §0–§13）内全部悬空。`constitution.md:209`「§4.6 错误码表」（错误码→HTTP 在 §9.4）与 `:210`「§18 编号索引表」（索引表在 `plan.md` §21）指向不存在章节。
- `plan.md:1537-1573` §21 索引表 5 处位置列错：`:1556` HONO-02 写「§3.1, §8.2」实在 `:149`；`:1558` HONO-04 写「§8.2」实在 `:684`；`:1559` HONO-05 写「§8.2」实在 `:712`；`:1563` HONO-09 写「§8.3, §8.6」实在 `:923`；`:1566` HONO-12 写「§8.1, §9.1」实在 `:1023`。
- 悬空/未引用：`data-model.md:2677` 的 `SC-DOC-01` 全文仅出现一次；§18.1 的 14 个 `ARCH-*` 各只出现一次且不在 97 条索引内；`ARCH-GOV-01`/`ARCH-OPS-01` 与 27 个 `DM-*`（如 `DM-ADR-01..09`）除自身定义+索引外无引用；`spec.md:285` `| SC-DOC-01 | 编号一致性校验：悬空引用 0、一号两义 0、未引用 0 | 校验脚本 |` —— 执行者「校验脚本」不存在，仓库零源码。
- 宪法自认：`.specify/memory/constitution.md:26-30` `TODO(CROSS_REFERENCES)`「这些文档与编号尚无定义；按 Article III 与 DM-GEN-21 属悬空引用」，`:41` 标题「五条不可变原则」但正文 Article I–IX 共 9 条，`:34` 临时 HTML 注释仍在已批准文件里。
- 启发式审计（子代理 B）：31 个 FR token 中 7 个悬空（`FR-ERR-01`/`FR-OBS-01`/`FR-OPS-01`/`FR-SEC-01..03`/`FR-TST-01`）；101 个不同 `§x.y`、760 次出现、130 处本地无法解析、56 个 §号多义 → `constitution.md:228` 的门禁「悬空引用 0、一号两义 0、未引用 0」不通过。注意 `US-001..US-010` 以 `### US-001（P1）…` 标题定义（`spec.md:23`、`:182`），脚本判「无表格首列定义」是假阳性，不要误报。

### P0-3 单一真相源：8 主题重复矩阵（子代理 C 逐条复核）

| 主题 | 全部定义位置 | 应唯一归属 |
|---|---|---|
| 工具链版本总表 | `plan.md:161-181`、`research.md:159-181`（13 行「未定义」）、`spec.md:13`、`data-model.md:72-80`/`:2834`、`plan.md:1457-1480` | `docs/architecture/stack.md` |
| 错误码映射 | `data-model.md:302-335`(§4.6)、`:1798-1831`(§9.4)、`plan.md:763-775`/`:806-868`、`api.md:96-114`/`:116-185`、`research.md:150`/`:292`、`spec.md:237`、`constitution.md:120`/`:209` | `docs/architecture/data/errors.md` |
| RLS 谓词/角色 | `constitution.md:159-166`/`:170-171`、`plan.md:143-155`/`:510-606`、`data-model.md:1343-1509`/`:2099-2113`、`research.md:19`/`:124`/`:145`/`:148`、`api.md:26`/`:441`、`spec.md:224-226` | `docs/architecture/data/security.md` |
| 索引策略 | `plan.md:77`/`:481-490`/`:1438`、`data-model.md:55`/`:1381-1383`/`:1875-2011`、`research.md:153`/`:245`、`spec.md:284`、`constitution.md:130-136`/`:180` | `docs/architecture/data/indexes.md` |
| 明确不做 OOS | `spec.md:335-360`(权威 19 条)/`:377`/`:386`、`plan.md:24-36`/`:79`/`:1449`/`:1596`、`data-model.md:2497-2539`、`constitution.md:200`/`:211`/`:235`/`:250` | `docs/requirements/out-of-scope.md` |
| 中间件链 | `plan.md:124-131`/`:189-203`/`:658-666`/`:717-729`/`:744-758`/`:1222-1225`/`:1376-1385`/`:1444-1445`、`api.md:40-56`/`:230-235`、`research.md:11`/`:32`/`:40` | `docs/architecture/runtime.md` |
| 依赖注入 | `plan.md:686-712`/`:714-739`/`:870-880`/`:1247-1259`/`:1476`、`api.md:237-248`/`:444`、`research.md:12-13`/`:34-35`/`:41` | `docs/architecture/runtime.md` |
| 删除语义 | `data-model.md:1835-1871`(§10)/`:53`/`:2519`、`plan.md:453`/`:473-479`/`:1154-1159`/`:1186-1201`/`:1470`、`spec.md:160`/`:222`/`:318`/`:347`、`api.md:90-92`/`:195`/`:323`/`:370`/`:423`、`constitution.md:55-65` | `docs/architecture/data/invariants.md` |

补充：`data-model.md:2599-2652` §17（21 组 PG 18 实测）↔ `research.md:224-256` §11 逐字重复；`data-model.md:2634-2652` §17.1 D1–D12 ↔ `research.md:257-279` §12 ↔ `research.md:280-320` §13 第三次复述；`data-model.md:28` §0.1、`:2564` §16「v1.2 修订记录（26 项）」、`:2634` §17.1 三份变更日志。python 归一比对检出 **87 条跨文档逐字重复长行**。宪法 `:233-235`：「同一主题只在一个文档里定义，其余用编号引用」「『明确不做』清单只存一份」。

---

## 3. P1 · 官方最佳实践与内容质量

### 3.1 官方依据错误（用户明确要求「遵循官方最佳实践(使用context7访问)」）

- **Hono Factory 反官方 + 死链**：`research.md:34` 与 §1.1 称「`Factory` 的真实 API 只有 `createApp` / `createMiddleware` / `createHandlers`」「**不用 `createFactory` 注入运行时依赖**」（`ARCH-HONO-01`/`05`）；`plan.md:614`「`createFactory()` 返回的是 `Factory` 实例，它只有 `createApp()` / `createMiddleware()` / `createHandlers()` 三个方法」、`:688`「用途是复用 `Env` 类型，而不是注入运行时依赖」、`:696`「**不提供** `use()`/`get()`/`post()`，也不能注入 `db`、`services`」同样错误。官方 [Hono Helpers / Factory](https://hono.dev/docs/helpers/factory)（web_fetch HTTP 200）明确：`createFactory() can receive the initApp option to initialize an app created by createApp()`，并给出 `export default createFactory<Env>({ initApp: (app) => { app.use(async (c, next) => { const db = drizzle(c.env.MY_DB); c.set('db', db); await next() }) } })` + `const app = factoryWithDB.createApp()` 的跨文件 DI 示例。`plan.md:710`「两者不冲突」与 `research.md:34`「不用 createFactory」互相否定。`research.md:34` 引用的 `https://github.com/honojs/hono/blob/main/src/factory.ts` 实测 **HTTP 404 `File not found · GitHub`**。按文档自定的 `ARCH-HONO-11`（升级大版本前用 Context7 重拉 §18 表逐条核对）必须重核；该页面未版本化且侧栏已有 `Migrating to v5` 导航，而项目锁定 Hono v4 ≥4.11.2 —— 引用必须 pin 到版本/日期。
- **Zod 版本把 peer 范围当成项目约束**：`research.md:25` / `:75` / `:159-185` 把 `@hono/zod-validator@0.9.1` 的 `peerDependencies.zod = "^3.25.0 || ^4.0.0"` 写成项目自身的 `v4（^3.25 || ^4）`；而 `@hono/zod-openapi@1.6.3` 的 peer 明确 `zod: ^4.0.0`，与「允许 Zod 3.25」直接冲突。`plan.md:168` 同样表述。应改为「项目锁定 `zod@4.6.7`（2026-11-13 实测 latest）；`^3.25.0 || ^4.0.0` 是 zod-validator 的 peer 范围」。
- **11–13 行「官方依据链接 = 未定义」且明言拒绝补链**：`research.md:199`、`research.md:55-64`、`:59/:60/:92`。`research.md:196`「本文的官方链接均来自 plan.md §18 与 data-model.md §19 原文；原文未给出链接的条目标注『未定义』，不做补链」—— Phase 0 反向从 Phase 1 抄链接。宪法 `:236` 要求「规范陈述 + 执行者 + 验证方式」三段式；用户本次要求用 Context7 访问官方最佳实践。
- **实测不可审计 / 官方依据不可核验**：`research.md:192`「见 `pg18-verification-log.md`」文件不存在；`:93`「实测确认 `drizzle-orm@0.45.4` 的 `pg-core/columns/common.js` 第 28 行已硬编码 `mode: "stored"`」无脚本/日志佐证；`research.md:119` 自称「链接原文搬移」实为转述，`:126` 的「PG 18 的 `AFTER` 触发器以入队时角色执行」不被 [CREATE TRIGGER](https://www.postgresql.org/docs/18/sql-createtrigger.html) 支持；[Generated Columns](https://www.postgresql.org/docs/18/ddl-generated-columns.html) 当前标 PostgreSQL 18.7；GitHub 链接一律 unpinned `main`。`research.md:100` 引 [drizzle-kit generate](https://orm.drizzle.team/docs/drizzle-kit-generate) 声称 `--custom`，该页正文未出现该参数（`--custom` 在 [Custom migrations](https://orm.drizzle.team/docs/mysql/kit-custom-migrations)）。本机 `psql`/`pg_ctl` NOT FOUND，无法复现任何 PG 18 实测。
- **包管理器/运行时断言需重核**：`data-model.md:2096` `bunx drizzle-kit generate --custom --name=rls_policies` 与 `:300` `bun run gen:sql` 违反 `plan.md:205`/`:1340`「**包管理器只有 pnpm**：禁止 `bun install` / `bun add`」；`plan.md:163`/`:213`「Playwright 不在 Bun 上跑」是绝对断言而 `research.md:60` 标「链接未定义」，需按 [Bun 1.4](https://bun.sh/blog/bun-v1.4) 与 [Playwright release notes](https://playwright.dev/docs/release-notes) 复核；`plan.md:1326` `FROM oven/bun:1-slim` 未固定次版本。
- **陈旧 1.1 文案仍在**：`constitution.md:174-175` 与 `data-model.md:648` 已定「会话级 `SET` 与 PgBouncer 事务池化不兼容，参数必须由连接串 `PGOPTIONS` 下发」，但 `plan.md:1144`「三个超时在连接池初始化连接时统一 `SET`」与 `research.md:152` 仍是被明令废弃的 1.1 写法；`data-model.md:2177` 的 `prepare: false` 硬要求未出现在 `plan.md` §3.2/§15.2。
- 版本实测（2026-11-13，npm registry / GitHub releases）：`hono 4.13.18`、`drizzle-orm 0.45.4`、`drizzle-kit 0.31.11`、`zod 4.6.7`、`@biomejs/biome 2.6.7`、`pnpm 12.18.0`、`bun-v1.4.4`、`@hono/zod-validator 0.9.1`、`@hono/zod-openapi 1.6.3`。文档里的 ≥4.11.2 / ≥1.4.4 / 12.x / 0.45.x 是**版本下限**，容易被读作锁定版本。**用户决策（21:31 5 问）明确改为「锁定到实测最新版」**：`stack.md` 唯一工具链总表写上述精确版本 + 抓取日期 `2026-11-13`，不再写 `≥` / `x` 区间；`@hono/zod-validator` 的 `zod: ^3.25.0 || ^4.0.0` 与 `@hono/zod-openapi` 的 `zod: ^4.0.0` 只作上游 peer 兼容性说明。例外：PostgreSQL 本机无 `psql`，按用户另一决策降级为「PostgreSQL 18（待验证）」，不写 18.0/18.6/18.7 等未经复现的小版本。

### 3.2 官方依据**成立**的部分（应保留，别一刀切删）

Context7 / 官方文档核对后，以下结论站得住：`WITH (security_invoker = true)` 用调用者权限与 RLS（[CREATE VIEW](https://www.postgresql.org/docs/18/sql-createview.html)）；表拥有者默认绕过 RLS 需 `ALTER TABLE ... FORCE ROW LEVEL SECURITY`（[Row Security Policies](https://www.postgresql.org/docs/18/ddl-rowsecurity.html)）；[Constraints §5.5.5](https://www.postgresql.org/docs/18/ddl-constraints.html) 原文「the declaration of a foreign key constraint does not automatically create an index on the referencing columns」；`clock_timestamp()` 单条 SQL 内也变而 `now()` 是事务开始（[Date/Time Functions](https://www.postgresql.org/docs/18/functions-datetime.html)）；PG 18 新增 `uuidv7()`；Hono 中间件按注册顺序、`await next()` 前后正序/逆序、「Hono catches unhandled errors automatically so next() never throws」（[Middleware](https://hono.dev/docs/guides/middleware)）；内置中间件 `hono/secure-headers` / `hono/body-limit` / `hono/compress` / `hono/etag`；`@hono/zod-openapi` 的 `createRoute` / `OpenAPIHono` / `app.doc()`；pnpm 官方 Dockerfile 的 `pnpm install --frozen-lockfile`（CI 默认 true）；Biome `overrides` 与 `style.noRestrictedImports`。`data-model.md:1358` `= ANY (app.visible_org_array())`、`:1180/:1198` `security_invoker = true`、`:741` 世次读时派生，均符合宪法 Article IV/V。
> 待核：Context7 `/drizzle-team/drizzle-orm-docs` 只返回 `drizzle-kit generate --custom --name=...`，未见 `pgPolicy()` 与 `FORCE ROW LEVEL SECURITY` 的明确官方说明 —— 「Drizzle pgPolicy() 不生成 FORCE RLS」这条 claim 需要补官方证据或降级为「手写迁移」的实测结论。

### 3.3 规格与验收质量

- `spec.md:23-192` 有 45 个 Given/When/Then（US-001..US-010），但多处不可测：`:35`「该姓名字段在界面上有独立的展示位置」、`:36`「不参与正式称谓排序」、`:106`「反向引用列表完整」、`:108` / `:192`「按声明的删除语义处理（不留下悬空引用）」—— 没有 oracle、阈值，且「声明的语义」指向未定义文档。
- `spec.md:364-380` §9 追溯矩阵仅 11 行，未覆盖 §3 的 24 FR + 8 NFR、12 SC、12 EC、19 OOS 与 45 个场景；`spec.md:284` `SC-INT-03`「外键引用侧列的支撑索引覆盖率 = 100%」与 `data-model.md:1959`「55 条外键中 37 条有支撑索引，**18 条无**」直接冲突；`:286` `SC-PER-01`「1 万行 P95 < 200ms」未测量（Article IX：先测量再优化）。
- `api.md:450-467` §4 列 9 类「plan.md 未定义项」（Zod schema 名、逐端点状态码、权限名矩阵、分页参数名、限流配额、幂等、批量、约 10 类端点、ErrorCode→HTTP 映射），写「需在后续 spec 中补齐，不得在实现阶段自行编造」；但 `api.md:5-13` §0 又说「需在实现阶段由 spec 补齐」，自相矛盾。五份文档 `grep -c 'NEEDS CLARIFICATION'` 全为 0。spec-kit 官方 Phase 0 规则是「mark unknowns as `NEEDS CLARIFICATION`」+「Generate research.md (resolve all NEEDS CLARIFICATION)」。
- 两次 Constitution Check：`plan.md:70-83` §1.4 第一次 11 项全 ✅（`:71`「本文所有约束均标注执行者与验证方式 ✅」而 §1.1/§8.9/§16/§17/§18 表均无执行者列）；`:83` 第二次要求「逐条回答…空着不写就等于不允许」—— 之后没有任何逐条回答，而 `:1518-1531` §20 却称「本表为空，表示当前设计完全在宪法与预算之内」并规定「本表不得事后补记」。宪法 `:200-201` 明确两次门禁。
- CRLF/LF 混用会让 `git diff` 与 Biome 持续抖动，且与「单一真相源」无关却天天制造噪音。

### 3.4 内容自相矛盾 / 声称已修复但未落地（择要）

| 主题 | A | B |
|---|---|---|
| PG 版本 | `data-model.md:11`/`:74` 18.0 | `:2601`/`:2786`/`:2834` 与 `research.md:21`/`:204` 18.6 |
| 缺陷数 / 用例 | `data-model.md:36` 修正 5 处、`:2592`/`:2842` 53 条 | `:2595` 真实缺陷 12 项；§13.3 实际 59 个用例头 |
| 表 / RLS | `:1378` 列 17 张表却写「全部 18 张」；`:2123` 断言 22 张表 `rowsecurity=true` | `:2625` `tables = 22, rls_on = 21, policies = 21` |
| DDL 修复 | `:2569` 说改为 `ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE` | `:361-362` 仍是 `DEFERRABLE INITIALLY IMMEDIATE` / `ON DELETE RESTRICT;` |
| 并发 | `:1488/:1500/:1502/:2559` 改用 CAS「不需要行锁」 | `:1739` `FOR SHARE`、`:1759`「用 FOR SHARE 读旧值」 |
| 失败要响亮 | `:427/:1730` 定为漏洞并改用 `IS DISTINCT FROM` | `:1741` `IF v_prev <> app.current_user_id() THEN`（NULL 时静默跳过 owner 校验） |
| 字段 / 函数 | `:393-406` invite 字段表无 `revoked_reason`；`:1519`「app schema 下 16 个函数」 | `:1788` `revoked_reason = p_reason`；`:1774` `app.artifact_exists(v_artifact)` 是第 17 个 |
| 删除语义 | `constitution.md:57`「归档与完成是业务状态字段，**不是删除的替代品**」 | `data-model.md:371` `status='archived'`、`:1842`「不支持物理删除」；`:2519` 又写「删除就是删除」；`spec.md:160`「数据不被物理删除」 |
| 执行者 / 生成物 | `constitution.md:69-70` 四选一、`:102` 清单一律生成 | `data-model.md:1309/1314/1319` 类型写成「结构决策/流程/文档」；`:195` 声称四处由 `src/domain/enums.ts` 生成但 `:170-191`/`:275-289`/`:1372-1379` 全手写；`:300`「CI 只做一件事」与 `:2117-2128` 十项校验冲突 |
| 错误码 / API | `plan.md:808`「不维护第二份映射表」、`api.md:118`「不构成第二份定义」、`api.md:468`「所有内容均出自 plan.md」 | `plan.md:815-868` 20 条 SQLSTATE→25 码 + 12 行约束名文案；`api.md:120/:138/:162` 三张完整表；`PG_ERROR_MAP`/`PG_CONSTRAINT_MESSAGES` 全仓库无定义；`api.md:179` 与 `:178` 逐字重复；`:129` `RATE_LIMITED` 429 vs `:136`/`:464`「未定义」；`:143-144` `23503`/`23001` 都映 `CONFLICT` vs `plan.md:838`「必须分开」；`:154` `GX005 NOT_FOUND` vs `data-model.md:1819` `TARGET_INVALID` |
| Bun 入口 | `plan.md:290`「`Bun.serve` 入口 + 启动自检」 | `plan.md:1348`「Bun 官方启动方式是默认导出，无需自己 `Bun.serve`」；`:293`/`:301` 两条同名 `middleware/` 目录内容不一致 |
| EXPLAIN 口径 | `plan.md:490` `EXPLAIN (ANALYZE, BUFFERS)` | `data-model.md:2007` `EXPLAIN (ANALYZE)`；`research.md:153` `EXPLAIN (ANALYZE, TIMING off, COSTS off)` |
| Article VIII | `constitution.md:119-121` 禁止静默吞异常 | `data-model.md:1415-1416`/`:1556-1557` `EXCEPTION … RETURN NULL`（fail-closed 设计合理，但需按 Governance 显式登记例外）；`plan.md:538`「默认拒绝，不报错、不返回全表」 |
| 索引覆盖率 | `spec.md:284` `SC-INT-03` = 100% | `data-model.md:1959` 37/55、`:1988`「这是显式决策，不是遗漏」且未登记 §7.2 |

### 3.5 架构文档的命名与组织问题（用户明确关注点）

- **5 个文件名是 spec-kit 命令的产物名，不是架构主题**：`spec.md`/`plan.md`/`research.md`/`data-model.md`/`tasks.md` 描述的是「哪个命令在什么阶段生成」，属于 `specs/<NNN>-<feature>/` 里的**批次工件**；把它们当作「完整目标架构文档」的目录，等于用过程阶段代替主题，读者想知道「RLS 怎么配」必须先知道「这是 Phase 1 的 data-model.md」。
- **一文件混六类主题**：`data-model.md` 2845 行里同时有表结构（§5）、视图（§6）、不变量（§7）、RLS/角色（§8）、函数/错误码（§9）、删除语义（§10）、索引（§11）、Drizzle 落地（§12）、迁移与 59 条验收清单（§13）、明确不做（§14）、ADR（§15）、v1.2 修订记录（§16）、PG 实测（§17）、编号索引（§18）、官方依据（§19）、附录 A（元信息）。其中 API+UI 文案（`:1802`「用户可见文案」）与验收清单（`:2224-2494`）根本不属于数据模型。
- **「唯一权威」声明与复制行为成对出现**：`api.md:118`、`plan.md:808`、`data-model.md:2499`、`spec.md:337` 都先声明「唯一/不复制」，紧接着就是第二份表。这不是文档太多，而是**没有按主题划边界**。
- **过程性内容混入基线**：修订记录、实测日志、缺陷表、命令状态表、复评触发条件表属于 git 历史 / ADR / 验证记录，不属于「目标架构」；它们正好是 87 条逐字重复的主要来源（Article II、VII）。
- **结论**：目录重构不是「换 5 个名字」，而是按**主题单一真相源**切开（§4），把过程性内容移出基线，并用 `docs/README.md` 做导航与门禁。切分依据是每个主题当前有 ≥2 份重复副本（Article I「新抽象须消除 ≥2 处重复」），**不是**为了规避 400 行警报（`ARCH-GOV-01`）。

---

## 4. 目标架构文档目录（提案 v2 · 按用户决策）

### 4.1 设计原则

1. `docs/` 保存**完整的目标架构基线**：稳定、主题化、与实现批次无关；`specs/` 只在后期分批实现时由 `/speckit-specify` 生成。
2. 文件名描述**主题**（数据长什么样、隔离怎么执行），不描述**生成命令**（spec/plan/research/tasks）。
3. 同一主题只在一个文件定义，其余用编号/链接引用；过程性内容（决策、实测、门禁）归 `decisions/` `verification/` 与 `docs/README.md`。
4. 不新增编号前缀、不为 400 行警报机械拆文件、不写「以后可能」的复评条件表（Article VII）。
5. 不在 `docs/` 里画任何 `specs/` 树，也不写「/speckit-* 已完成」的状态表 —— 事实来源是文件系统与 `check-prerequisites.sh --json`。

### 4.2 推荐目录树（主题化，两级）

```
docs/
├── README.md                          # 导航：谁定义什么 / 阅读顺序 / 校验命令
│                                      #   + 两次 Constitution Check + Complexity Tracking 三列
│                                      #   + docs/ 与 specs/ 的分工约定
├── architecture/                      # 完整目标架构（稳定基线）
│   ├── overview.md                    # 系统目标、边界、分层与依赖方向、模块图、基础设施组件
│   ├── stack.md                       # 技术选型与锁定版本（精确版本 + 抓取日期，唯一工具链总表）+ 官方依据索引
│   ├── runtime.md                     # Hono/Bun 入口、中间件链、依赖注入、错误映射落地、配置
│   ├── modules.md                     # 业务模块清单（≤8）、依赖方向、源码树、Biome overrides
│   ├── operations.md                  # CI / 部署 / 观测 / 备份 / PGOPTIONS 超时 / 待验证登记
│   ├── data/
│   │   ├── schema.md                  # 22 张表、字段、约束、枚举、生成列、视图
│   │   ├── security.md                # RLS 策略、租户谓词、角色与权限矩阵（唯一权威）
│   │   ├── invariants.md              # 不变量 + 软约束登记表 + 删除语义 + 执行者四选一
│   │   ├── indexes.md                 # 索引策略 + 统一 EXPLAIN 口径
│   │   ├── errors.md                  # 错误码 → SQLSTATE/约束名 → HTTP/文案（唯一权威）
│   │   └── migrations.md              # Drizzle 落地边界、生成物、迁移与回滚
│   └── api/
│       ├── conventions.md             # 通用约定、分页、限流、幂等、权限名、媒体
│       └── endpoints.md               # 端点表：形状、状态码、Zod schema、契约
├── requirements/                      # 做什么与验收（与目标架构同属基线）
│   ├── user-stories.md                # US-001..US-010 + 45 个可测 Given/When/Then
│   ├── functional.md                  # FR-*/NFR-*（三段式）
│   ├── acceptance.md                  # SC-* 成功标准 + 全量追溯矩阵
│   └── out-of-scope.md                # OOS-01..OOS-19 唯一副本
├── decisions/
│   └── 0001-pg18-defects.md           # D1–D12 决策记录（唯一一份，含「本机未实测」声明）
├── verification/
│   └── README.md                      # 可复现 PG 18 实测登记 / 待验证项（不写进规格文档）
└── superpowers/
    ├── reviews/2026-11-13-architecture-docs-review.md   # 本报告
    └── plans/2026-11-13-architecture-docs-refactor.md   # 配套实施计划 v2
```

`specs/` **本次不创建**。后期分批实现时，每个批次按官方布局由工具生成：

```
specs/<NNN>-<feature>/
├── spec.md            # 该批次做什么与验收，引用 docs/requirements/ 编号，不复制
├── plan.md            # 该批次怎么做；Constitution Check 引用 docs/README.md
├── research.md        # Phase 0：本批次新增的官方依据（pinned URL + 日期）
├── data-model.md      # 仅当本批次改动数据形状；否则引用 docs/architecture/data/
├── quickstart.md      # 本批次可运行验证指南
├── contracts/         # 本批次新增/变更端点
└── tasks.md           # Phase 2，由 /speckit-tasks 生成
```

`.specify/feature.json` 由 `/speckit-specify` 写入且被 `.specify/.gitignore` 忽略（每检出本地状态）；CI 用 `SPECIFY_FEATURE_DIRECTORY` 指定当前批次。二者都**不该出现在 `docs/` 的目录树里**。

### 4.3 紧凑备选（若用户希望文件更少）

把 `data/` 六份合成 `data/schema.md`（表/视图/索引）与 `data/constraints.md`（不变量/RLS/错误码/删除语义/迁移）两份，`api/` 合成 `api.md` 一份，`requirements/` 合成 `spec.md` 一份 → 共约 8 个文件。代价：单文件仍会超 400 行（触发评审讨论，按 `ARCH-GOV-01` 允许，但必须在 `docs/README.md` 登记），且「唯一权威」的边界要写在文件内小标题而非文件名。推荐 4.2 的主题化版本，因为 8 主题重复正是当前缺陷的根因。

---

## 5. 内容收敛清单（谁定义什么 + 净删）

| 主题 | 新唯一权威 | 其他文档只能 |
|---|---|---|
| 做什么、验收场景、成功标准、明确不做（OOS） | `docs/requirements/*.md`（OOS 只在 `out-of-scope.md`） | 引用 `OOS-01..19` / `US-001..010` / `SC-*` 编号 |
| 技术选型、锁定版本、官方依据 | `docs/architecture/stack.md` | 引用 pinned URL 与抓取日期；不复制工具链表 |
| 模块划分、依赖方向、源码树 | `docs/architecture/modules.md` | 引用 `ARCH-*` 编号 |
| 中间件链、DI、错误映射落地 | `docs/architecture/runtime.md` | 引用编号，不复制链 |
| 表结构、约束、RLS、视图、索引、函数、错误码 | `docs/architecture/data/*.md` | 引用 `DM-*` 编号 |
| 端点形状、请求/响应/Zod schema | `docs/architecture/api/endpoints.md` | —— |
| 复杂度例外、两次门禁、导航 | `docs/README.md` | 三列登记，不写「当前无例外」 |
| 缺陷/修复决策（D1–D12） | `docs/decisions/0001-*.md` 单份 | 引用编号 |
| 修订记录、实测日志 | git 历史 / `docs/verification/` | 不写入规格文档（Article II、VII） |
| 最高约束 | `.specify/memory/constitution.md` | 全部文档遵守 |

**旧 5 文件 → 新文件映射**（重组时用，非新增抽象）：`api.md` §0/§1/§3 → `api/conventions.md`，§2 → `api/endpoints.md`，§4 九类未定义项 → `requirements/functional.md` + `stack.md` 的 Phase 0 结论；`data-model.md` §3/§5/§6 → `data/schema.md`，§8 → `data/security.md`，§7/§10 → `data/invariants.md`，§11 → `data/indexes.md`，§9.4 + §4.6 → `data/errors.md`，§12/§13.1–13.2 → `data/migrations.md`，§13.3 的 59 条验收 → `requirements/user-stories.md`（去重后唯一副本），§15/§16/§17/§18/§19/附录 A → `decisions/`、`verification/`、`docs/README.md` 或直接删除；`plan.md` §0/§2 → `overview.md`，§3 → `stack.md`，§4.2/§5 → `modules.md`，§8 → `runtime.md`，§15–§17 → `operations.md`，§1.4/§20/§21 → `docs/README.md`，§4.1 假树与状态表**整节删除**；`research.md` → `stack.md` 官方依据 + `decisions/`；`spec.md` §2 → `requirements/user-stories.md`，§3 → `functional.md`，§5/§9 → `acceptance.md`，§8 → `out-of-scope.md`。

**净删清单**：3 份 OOS 表、2 份工具链版本表、3 份 D1–D12 / 21 组实测、3 份变更日志、8 份中间件链/DI 副本、错误码三张表、`api.md:179` 重复行、`plan.md` §4.1 假树与假状态表、`research.md:199`「不做补链」、所有 unpinned `main` 链接与「链接未定义」、`data-model.md` §13.3/§16/§19/附录 A。删后总量应从 5613 行降到约 2800–3300 行，**且不靠拆文件凑行数**（`ARCH-GOV-01`）。

---

## 6. 优先级排序的重构建议

| # | 动作 | Linus 依据 | 可验证结果 |
|---|---|---|---|
| 1 | 给 `SC-DOC-01` 装上执行者：校验脚本（悬空编号 / 一号两义 / 断链 / CRLF / OOS 唯一副本 / 400 行登记）＋ `docs/README.md` 接线 | Article III「没有执行者的规则不是规则，是愿望」 | 脚本对当前文档 exit≠0 并列出问题；修完后 exit=0 |
| 2 | 按 Governance 先修宪法（9 条标题、悬空 TODO、删临时注释、把文档分层规则改写为按主题的文件名、版本号） | `:252`「宪法先改，再改文档」 | 宪法无 `[ALL_CAPS]` 占位符、无临时注释、无指向旧文件名的悬空引用 |
| 3 | 在 `docs/` 内按 §4.2 重组目录与文件名，统一 LF；删除 `plan.md` §4.1 假树与假状态表 | 用户决策 m00401；Article VI | `docs/architecture/` 下不再有 `spec.md`/`plan.md`/`research.md`/`data-model.md`；`grep -rlc $'\r' docs/` 无输出 |
| 4 | 按 §5 删除 8 主题重复副本，改写为编号引用 | Article II、VI、`:235` | `grep -c '^\| \`OOS-'` 只在 `out-of-scope.md` 命中；跨文档逐字重复长行 = 0 |
| 5 | 修 `DM-GEN-16`/`DM-MED-01`/`EC-02`/`ARCH-HONO-01`、§21 五处错位置、`§13.4`/`§8`/`§8.2` 错指、14 个 `ARCH-*` 与 `SC-DOC-01` 悬空、未引用 ID | `:237` 编号唯一且可追溯 | 校验脚本「悬空 0 / 一号两义 0」通过；删掉 `:2780` 手写「零悬空」统计，改由脚本生成 |
| 6 | Context7 重核官方断言：工具链版本由「下限」改为**锁定 2026-11-13 实测精确版本**（用户决策）/ Hono Factory（含 `plan.md:614/688/696`）/ Zod peer / 11 处「链接未定义」/ 死链 / pinned URL + 日期 / PG 18.0 vs 18.6 统一「待验证」 / PGOPTIONS 陈旧文案 / `bunx` vs pnpm / Bun+Playwright / Drizzle `--custom` | 用户明确要求；`ARCH-HONO-11`；`:236` 三段式 | `stack.md` 工具链表写精确版本 + 抓取日期；每条「官方依据」有 pinned URL 与日期；Factory 断言按官方 `initApp` 改写 |
| 7 | 补齐 45 个 Given/When/Then 的 oracle、`docs/requirements/acceptance.md` 全量追溯矩阵；9 类未定义项转 `[NEEDS CLARIFICATION]` 并给出结论 | 官方 spec-kit Phase 0；`:233` 文档分层 | 无裸「声明的语义」；`NEEDS CLARIFICATION` 计数 0（或明确登记未决） |
| 8 | 落实第二次 Constitution Check 逐条回答与 Complexity Tracking 三列（>400 行文件、18 条无索引 FK、PgBouncer/Sentry/APM 第 4 组件、Article VIII 的 `RETURN NULL`、模块数口径） | `:200-201` 两次门禁、`:152-153` 例外登记 | `docs/README.md` 有逐条回答；例外表有登记行且说明理由与「更简方案为何被否」 |
| 9 | 写 `docs/README.md` 导航与 `docs/` ↔ `specs/` 分工约定；明确 `specs/` 后期由 `/speckit-specify` 分批生成 | 用户决策；官方 Project Structure | README 含「谁定义什么」表；`check-prerequisites.sh --json` 当前 exit=1 被如实记录，不伪装通过 |
| 10 | 修数值/实现矛盾（18.0 vs 18.6、5 vs 12、53 vs 59、17 vs 18、22 vs 21、DDL 顺序、`<>`→`IS DISTINCT FROM`、`revoked_reason`、第 17 个函数、`status='archived'` 替代删除、`Bun.serve` 入口、三种 EXPLAIN） | Article II / VIII / IX；`plan.md:1508-1517`「两条带编号冲突视为缺陷，必须在同一次提交里改掉」 | 成对矛盾各留一处真值 |

**明确不做**（YAGNI / Article VII）：不引入新的编号前缀、不新增 `docs/architecture/v2/` 之类的版本层级、不写「以后可能」的复评条件表、不把实测日志改造成框架、不为 400 行警报机械拆文件、本次**不创建 `specs/`、不生成 `tasks.md`/`quickstart.md`**、不改动任何业务代码（仓库目前没有代码）。

---

## 7. 用户决策记录（原开放问题，2026-11-13 21:31 全部关闭）

| # | 问题 | 用户决策 | 计划落点 |
|---|---|---|---|
| 1 | 目录粒度：§4.2 17 个主题文件 vs §4.3 约 8 个文件 | **§4.2 主题化 17 文件**（报告推荐） | §4.2、计划 Task 3 |
| 2 | 宪法「五条」vs 正文 9 条 Article | **改标题为「九条」**，正文 9 条措辞不改，走 Governance | Task 1 Step 2/5 |
| 3 | PG 18「实测」声明，本机无 `psql`/`pg_ctl` | **降级为「待验证」**，在 `docs/architecture/data/invariants.md` 软约束登记表与 `docs/verification/README.md` 登记 | Global Constraints、Task 6 Step 5、Task 8 |
| 4 | 版本写「下限」还是「锁定」 | **锁定到 2026-11-13 实测最新版**（**偏离**报告推荐的「明确标注为下限」） | Global Constraints、Task 6 Step 2/5、`stack.md` |
| 5 | `docs/` 保留 / `specs/` 后期分批（m00401） | 已决策：保留全部知识内容、按主题重组；`specs/` 由 `/speckit-specify` 后期分批生成 | §4/§5/§6、计划 v2 |

> 决策 3 与 4 的分工：npm / GitHub 工具链包写精确锁定版本 + 抓取日期；PostgreSQL 因本机无 `psql` 不假装实测，写「PostgreSQL 18（待验证）」。`FROM oven/bun:1-slim` 之类浮动 tag 改为固定 `FROM oven/bun:1.4.4`。

---

## 8. 官方依据索引（本次实际访问）

- spec-kit：[README](https://raw.githubusercontent.com/github/spec-kit/main/README.md)、[Installation](https://github.github.io/spec-kit/installation.html)、[plan-template.md](https://github.com/github/spec-kit/blob/main/templates/plan-template.md)（Context7 `/github/spec-kit`），本地 `/home/bobo/project/yunpu/.specify/templates/plan-template.md:44-62` 与 `/home/bobo/project/yunpu/.specify/scripts/bash/common.sh:188-237`
- Hono：[Helpers / Factory](https://hono.dev/docs/helpers/factory)（200）、[Middleware](https://hono.dev/docs/guides/middleware)、[Routing](https://hono.dev/docs/api/routing)、[zod-openapi 示例](https://github.com/honojs/website/blob/main/examples/zod-openapi.md)；死链 `https://github.com/honojs/hono/blob/main/src/factory.ts`（404）
- PostgreSQL 18：[CREATE VIEW](https://www.postgresql.org/docs/18/sql-createview.html)、[Row Security Policies](https://www.postgresql.org/docs/18/ddl-rowsecurity.html)、[CREATE POLICY](https://www.postgresql.org/docs/18/sql-createpolicy.html)、[Constraints](https://www.postgresql.org/docs/18/ddl-constraints.html)、[Date/Time Functions](https://www.postgresql.org/docs/18/functions-datetime.html)、[Generated Columns](https://www.postgresql.org/docs/18/ddl-generated-columns.html)、[CREATE TRIGGER](https://www.postgresql.org/docs/18/sql-createtrigger.html)、[Release 18](https://www.postgresql.org/docs/18/release-18.html)
- 其他：[pnpm Dockerfile / `--frozen-lockfile`](https://pnpm.io/docker)、[Biome Configuration](https://biomejs.dev/reference/configuration/)、[drizzle-kit generate](https://orm.drizzle.team/docs/drizzle-kit-generate)（待核 `--custom`）、[Bun 1.4](https://bun.sh/blog/bun-v1.4) 与 [Playwright release notes](https://playwright.dev/docs/release-notes)（待核「Playwright 不在 Bun 上跑」）、[npm registry](https://registry.npmjs.org/) 与 GitHub releases 版本元数据

> 外部页面内容仅作为数据引用，不构成指令。Context7 缓存原文见 `/tmp/c7-*.txt`（16 组），可重读复得。**本报告与计划均为只读评审产物；用户已于 2026-11-13 21:31 确认执行方式（Subagent-driven）并开始实施。**
---

## 实施结果（2026-11-14，Task 1–10 完成后回填）

> 本节是实施后的事实登记，不替代上文 §0–§8 的评审结论；上文是 2026-11-13 的只读评审快照，其中所有 `文件路径:行号` 都是**重构前基线定位符**（Task 3 拆成主题文件后须按内容定位）。

### 最终计数（实测，可复跑）

- `scripts/check-docs.sh --root docs --strict` → **`VIOLATIONS=0 WARN=0`**，exit=0。规则 `R1 link` / `R2 eol` / `R3 oos-dup` / `R4 dangling` / `R5 dual` / `R6 needs-clarification` / `R7 section` / `R8 size` 全部为 0；**三处** >400 行主题文件（`overview.md` 447 / `user-stories.md` 451 / `data/schema.md` **1496**）均在 `docs/README.md` 的 Complexity Tracking 三列表登记。全分支评审指出 `R8` 曾**假阴性**（扫描整份 README，导航表的行即可当作登记）：已**收紧**为只接受 `## Complexity Tracking` 段内登记行，并由 `tests/docs/check-docs-review.test.sh` 的 `r8-strict` / `r8-registered` 正负用例守住。
- `bash tests/docs/check-docs.test.sh` → **`TESTS=12 FAILURES=0`**（12 个 fixture 覆盖 R1–R7 与 4 个回归场景）；`sh tests/docs/check-docs-review.test.sh` → **`REVIEW_TESTS=4 FAILURES=0`**（全分支评审补的 R8 CT 段限定、`--strict` 升级、`--json` 输出、R7 裸 `.md` 豁免收紧）。
- `python3 .superpowers/sdd/2026-11-13-architecture-docs-refactor/task-4-dups.py docs` → `DUP_LINES=0`（跨文件逐字重复长行已清零）。
- **`NO_SPECS_OK`**：`test ! -d specs` 与 `test ! -e .specify/feature.json` 均通过；`find docs/architecture -maxdepth 1` 的旧文件名（`api.md` / `data-model.md` / `plan.md` / `research.md` / `spec.md`）计数 = `0`；`git status --short` 无 `?? specs/`、无 `feature.json`。
- 目标架构按主题重组为 **17 个主题文件**（`docs/architecture/` 13 + `docs/requirements/` 4），加 `docs/README.md`、`docs/decisions/0001-pg18-defects.md`、`docs/verification/README.md` 共 20 个非过程文档；`find docs -name '*.md' -not -path '*/superpowers/*' -exec wc -l {} +` 合计 **5039 行**（重构前 5 份平铺文档 5613 行）。
- docs/ 与 scripts/ 全 LF（`grep -rlc $'\r' docs/ scripts/ --include='*.md' --include='*.sh'` 无输出）；`sh -n scripts/check-docs.sh` 通过。
- 十个 Task 的 verify 脚本全绿：T4 `16/0`、T5 `31/0`、T6 `34/0`、T7 `27/0`、T8 `33/0`、T9 `25/0`、T10 `48/0`（另 T1/T2/T3 为复合断言与 12 fixtures），无 prior-verify 回归。

### 未满足的宪法门禁（如实记录，不伪装通过）

- brief Task 10 Step 4 所指 `constitution.md:222` 的 `gen:sql && git diff --exit-code` 门禁（该行号是重构前基线定位符；Task 1 删除 35 行 HTML Sync Impact Report 后，实际文本在 `/home/bobo/project/yunpu/.specify/memory/constitution.md:69` 与 `:187`）因仓库尚无 `scripts/gen-sql.ts` **未满足**：`ls scripts/gen-sql.ts` → **`gen_sql_exit=2`**（`ls: cannot access ...: No such file or directory`）。这属**后续实现阶段**任务，本次是纯文档重构，**不伪装为通过**。
- 当前唯一可执行门禁是 `scripts/check-docs.sh --root docs --strict`；`docs/architecture/data/schema.md` §12 与 `docs/architecture/data/migrations.md` §12.3 已把 `scripts/gen-sql.ts`、`pnpm gen:sql`、`db/verify/*.sql` 十项校验明确标注为「待实现 / 设计目标未落地」，与仓库真实状态一致。

### 决策与执行方式

- 用户 2026-11-13 21:31 的 5 项决策全部落地；其中 `version_policy = 锁定到实测最新版` 偏离本报告 §7 的推荐（原推荐「明确标注为下限」），已在 `docs/architecture/stack.md` §7 写 9 个精确版本 + 抓取日期 `2026-11-13`，前端工具链亦按 npm dist-tags 精确化。
- 执行方式：21:31 选 Subagent-driven，用户 (m00634) `/executing-plans` 覆盖为 **inline** 本会话逐 Task 执行（ledger 有对应 Ruling）；连续执行，任务间未停下询问。
- PG 18 结论按用户决策降级为**待验证**：D1–D12 与 21 组结论均未在本次重构复现（本机无 `psql` / `pg_ctl`），已登记 `docs/architecture/data/invariants.md` §7.2 与 `docs/verification/README.md`。

### deferred（本次不处理，明确留给后期批次）

- Phase 0 九类契约项中 C3（完整权限名矩阵）/ C4（分页参数名）/ C5（限流配额）/ C6（通用幂等机制）/ C8（增删改等端点清单）**未决**，已在 `docs/README.md` 的 Phase 0 未决项表登记，并**阻塞该批次 `/speckit-tasks`**（tasks.md 不得在这些项定值前生成）。
- `SC-PER-01`（1 万行 P95 < 200ms）待压测，Article IX「先测量再优化」；18 条无支撑索引外键按 `SC-INT-03` 逐条登记理由，未补索引，压测证明必要时再改白名单。
- `scripts/gen-sql.ts` / `pnpm gen:sql` / `db/verify/*.sql` / 真实 PG 18 复现 / `specs/<NNN>-<feature>/` 分批实现，均为后续阶段工作；本次不创建 `specs/`、不生成 `tasks.md` / `quickstart.md`、不写 `.specify/feature.json`。
- `check-prerequisites.sh --json` 当前 `prereq_exit=1`（`ERROR: Feature directory not found.`）已如实记入 `docs/README.md`；这是「尚未开始实现批次」的正常状态，不是缺陷，也未为变绿而造特性目录。

---

> 本次实施的全部自裁决见会话内 SDD ledger（`progress.md`，该目录按 `.gitignore` 不随仓库分发）；逐条 WHAT / WHY / COST 在最终答复列出。末尾 whole-branch review 的 Minor 项由最终答复以 `Final: minor (deferred)` 逐条登记，不在此处预先声明。

### 全分支评审 fix wave（2026-11-14，一次 fix pass）

末尾 whole-branch review 判 `Ready to merge? **With fixes**`、**Critical: None**、3 项 Important。按
`/executing-plans` 只做一次 fix pass：先写会失败的测试（`tests/docs/check-docs-review.test.sh` 的 4 个
review fixture，RED `REVIEW_TESTS=4 FAILURES=2`），再逐项修到 GREEN。

- **Important 1（R8 假阴性）**：`scripts/check-docs.sh` 的 `R8 size` 原扫描整份 `docs/README.md`，
  Task 9 的 17 行导航表让每个主题文件都凑出一行三列填齐行，`R8` 永不触发。现收紧为只接受
  `## Complexity Tracking` 段内登记行；`data/schema.md`（1496 行）补进三列表，三处 >400 行文件全部登记。
  新增 `r8-strict`（CT 外伪登记须报违规）与 `r8-registered`（CT 内登记须放行）正负用例。
- **Important 2（裸基线引用 + R7 豁免过宽）**：全树 40 处 `plan.md` / `api.md` / `data-model.md` 的
  `§N.N` 来源行统一加「重构前基线定位符，见 git 历史 `5cbb72b`」；`stack.md` 的悬空 `§19.1` / `§6.7`
  改为现行权威指针；`R7` 的 `.md` 豁免收紧为只认 markdown 链接形式，新增 `r7-dead-md` 用例；
  `stack.md` 重复 `## 3.` 重编号为 `## 10.`（子节同步 10.1–10.3，`docs/README.md` 的
  `ARCH-HONO-03` 位置列同步改 `§10.1`）。
- **Important 3（编号错配）**：`docs/README.md` 第二次 Constitution Check 第 6 行的 `ARCH-RPC-01`
  改为 `ARCH-ERR-01`，执行者改为具体测试脚本 `tests/docs/check-docs.test.sh`，不再把 `SC-DOC-01`
  当执行者。

6 项 Minor 按 `/executing-plans` 记为 `Final: minor (deferred)`，见最终答复；其中第 ② 项的 fixture
覆盖面措辞已随本 wave 订正为真实覆盖面，第 ① 项的过期计数与 gitignored 绝对路径已从本报告移除。
