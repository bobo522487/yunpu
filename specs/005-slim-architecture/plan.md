# Implementation Plan: 把权威还给行为本身

**Branch**: `005-slim-architecture` | **Date**: 2026-11-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-slim-architecture/spec.md`

## Summary

把现行说明收成决策记录加一份边界说明，并废止编号族、文档校验、两次治理检查和复杂度账本这些合并条件。已登记且存储能够拒绝的规则下沉到 CHECK、触发器、行级写入策略和四条引用索引；角色的 HTTP 可见结果保持不变，由一个访问函数翻译，由数据库兜底。请求继续从 `app.ts` 显式进到 `withTenantTransaction`，不引入依赖注入。最近 20 次业务提交没有总是成对修改的目录，因此不合并应用或包。

技术取舍见 [research.md](research.md)。规则见 [data-model.md](data-model.md)。调用方可见结果见 [contracts/](contracts/)。验收步骤见 [quickstart.md](quickstart.md)。

Git 工作分支是 `cursor/slim-architecture-8585`。上表的 Branch 是特性目录名，与既有批次的写法一致。

## Technical Context

**Language/Version**: TypeScript（仓库现有版本）；运行时 Node.js；包管理 pnpm

**Primary Dependencies**: Hono、Drizzle ORM、`pg`、Zod、Biome、Vitest。不新增依赖注入框架，不新增 OpenAPI 生成器。

**Storage**: PostgreSQL 18。变更通过新的 SQL 迁移落地，并同步 Drizzle schema。不新增业务表，不新增基础设施。

**Testing**: Vitest，集成测试连接真实 PostgreSQL。禁止用 mock 代替本特性新增的 CHECK、触发器和行级策略。

**Target Platform**: Linux 上的 API 进程与 PostgreSQL。Web 应用只在合法响应被改坏时才需要改，本计划不改它的数据流。

**Project Type**: 已有的 Web 服务（`apps/api` + `apps/web`）与两个库包（`packages/db`、`packages/shared`）。

**Performance Goals**: 一个项目 10,000 位人物时，人物列表与谱系子图各自在 2 秒内返回；其他项目数据加倍后，这两次耗时增幅不超过 10%（规格 SC-009）。

**Constraints**:

- 合法的登录、组织、工作台、谱系编辑，可见结果不变（FR-019）
- 非成员仍得到「不存在」，不改成「无权」
- 失败按 SQLSTATE 与约束名映射，不解析错误文本
- 业务模块不能导入连接池
- 不创建 event、node、folder、book、media 等尚未落地的表
- 合并不再依赖文档校验、编号完整、两次治理检查或复杂度例外账本

**Scale/Scope**: 四张已落地内容表的索引与约束；组织、项目、成员、邀请的写入策略；一份边界说明；删除现行的重述性文档与文档校验门禁。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

现行宪法是 1.1.0。本特性的规格要求废止其中作为合并条件的文档机器。下面先按 1.1.0 检查，再说明哪些条款必须改写。Phase 1 之后按改写后的 2.0.0 复核。

### Phase 0 之前（对照宪法 1.1.0）

| # | 检查 | 结论 | 出处 |
| --- | --- | --- | --- |
| 1 | 是否引入新抽象层？ | 否。触发器、CHECK 和行级策略替换已经复制的服务层判断。不引入容器或新的包。 | Article I |
| 2 | 是否引入新表？ | 否。 | Article IV、Article VII |
| 3 | 是否新增依赖方向？ | 否。`access.ts` 位于 `apps/api`，被各模块调用，不反向依赖模块内部查询。 | Article I |
| 4 | 新约束的执行者是谁？ | 年份：CHECK。父母上限与归档写入：触发器。角色兜底：行级写入策略。投影一致：同一事务内的触发器。HTTP 文案：一个访问函数加 `mapDatabaseError`。 | Article III |
| 5 | 新错误码是否登记到 `errors.md`？ | 不登记。这正是要废止的第二权威。状态码放在 `ERROR_STATUS`，映射放在 `mapDatabaseError`。相对 1.1.0 的流程条款，这是有意违反，理由见 Complexity Tracking。 | Article VI 的执行方式 |
| 6 | 新编号是否写入 `docs/README.md`？ | 不写入。编号族本身被废止。相对 1.1.0 是有意违反，理由见 Complexity Tracking。 | 宪法流程第 6 条 |
| 7 | 是否触碰「明确不做」？ | 不做物理清除，不新建未落地的编纂表，不把投影当成关系事实。 | Article II、Article IV、Article VII |
| 8 | 复杂度预算 | 不新增表、模块或基础设施组件。删除文档门禁和复制的角色函数，复杂程度下降。 | 复杂度预算 |

门禁：通过。第 5、6 条对 1.1.0 的流程条款构成有意违反，已在 Complexity Tracking 写明为什么必须违反、以及更简单的「继续维护文档机器」为什么不成立。没有未解释的违反。

### 宪法改写（实现时先改这一份，再删现行文档）

`.specify/memory/constitution.md` 改为 2.0.0（MAJOR：重新定义单一权威的执行方式，并删除合并门禁）。改写后仍保留的行为原则：

- 能由存储拒绝的状态就由存储拒绝。
- 同一事实只有一处权威：迁移、与之对照的 schema、`AppType`、`ERROR_STATUS` 与 `mapDatabaseError`。
- 失败对调用方可见。
- 租户隔离仍在数据库的行级策略里；应用只负责在唯一事务里设置 `app.user_id`。
- 删除是物理删除。归档仍是状态。
- 不为未到来的表预建索引或软约束登记。

改写后删除的合并条件：编号族、`scripts/check-docs.sh`、Phase 0 与 Phase 1 各一次的散文门禁、复杂度例外三列表、软约束登记表、外键例外白名单。

### Phase 1 之后（对照改写后的原则）

| 检查 | 结论 |
| --- | --- |
| 是否还有没有执行者的约束？ | 否。见 [data-model.md](data-model.md)。跨系统规则目前没有产品实例；边界说明只记录三个非租户入口。 |
| 是否留下第二份结构说明？ | 否。`specs/005-slim-architecture/` 是本批次的设计记录，不是产品现行权威。产品现行说明只剩 decisions 与 boundaries。 |
| 角色兜底会不会改变合法结果？ | 不会。读取策略不变。写入策略按今天的 editor/admin 矩阵。非成员仍由「看不见行」得到不存在。 |
| 列表和树会不会因为新策略变慢？ | 读取策略不加角色子查询。新索引只服务项目外键的查找。耗时由 quickstart 第 5 节验收。 |
| 是否出现总是成对修改却未合并的目录？ | 否。测量见 research 第 7 节，没有这样的一对。 |

门禁：通过。

## Project Structure

### Documentation (this feature)

```text
specs/005-slim-architecture/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── authority.md
│   ├── write-rejections.md
│   └── tenant-entry.md
└── tasks.md                 # /speckit-tasks 生成，本命令不创建
```

### Source Code (repository root)

```text
.specify/memory/constitution.md          # 改写为 2.0.0
docs/
├── boundaries.md                        # 新建：三个非租户入口
└── decisions/
    ├── 0001-pg18-defects.md             # 保留
    └── 0002-owner-fk-index.md           # 新建
apps/api/src/
├── app.ts                               # 组装点，不改成容器
├── access.ts                            # 新建：唯一的可见结果翻译
├── lib/errors.ts                        # GX011 / GX012 / 42501 / ck_person_life_years
└── db/with-tenant-transaction.ts        # 去掉 withUser 别名
packages/db/
├── src/schema/                          # 同步新约束与索引名
└── migrations/                          # 新迁移：CHECK、触发器、写入策略、四条索引
packages/shared/src/errors.ts            # 不新增错误码；PARENT_LIMIT 继续使用
.github/workflows/verify.yml             # 去掉文档校验步骤
.github/workflows/docs.yml               # 去掉文档校验步骤
```

删除：`docs/README.md`、`docs/requirements/`、`docs/architecture/`、`docs/verification/`、`docs/superpowers/`、`docs/.check-docs-baseline.txt`、`scripts/check-docs.sh`、`tests/docs/`。

**Structure Decision**: 保持现有 monorepo。测量表明 api、web、db、shared 不是总是成对修改。本特性在 api 内收拢访问判断，在 db 迁移里收拢数据规则，不新增包，不把 db 并进 api。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 不再把新错误码写入 `docs/architecture/data/errors.md`，不再把编号写入 `docs/README.md`（违反宪法 1.1.0 的流程第 5、6 条与 `SC-DOC-01`） | 规格要求这些散文不再是权威，也不再是合并条件。错误码的执行者改为 `ERROR_STATUS` 与映射测试 | 继续维护编号文档会被文档校验拖住，或在校验有基线豁免时腐烂。那份文档今天已经承认自己不是 CI 结果 |
| 角色判断保留一个访问函数，同时由行级写入策略兜底 | 行策略能阻止写入，但分不出「非成员应显示不存在」和「成员应显示无权」。可见结果是现有契约 | 只留行策略会把非成员的 404 变成 403，暴露组织是否存在。只留服务函数则新代码可以忘记检查 |
| `fk_organization_owner` 不新增引用侧索引 | 查找键的前导列是组织主键，删除成员时定位一行 | 为了「每条外键都有一条新索引」再加一条与主键重复的索引，没有额外的查找面。理由只留一条决策记录，不留白名单 |
| 不合并 `packages/db` 与 `apps/api` | 最近 20 次业务提交里它们不是总是一起改（5/14） | 按目录外观合并会把迁移入口绑进 API 进程，而测量没有要求合并 |

## Implementation notes

实现顺序：

1. 改写宪法到 2.0.0，避免后续删除文档时还被旧门禁要求补编号。
2. 添加迁移与 Drizzle 对照：生命 CHECK、父母上限触发器、归档触发器、`last_used_at` 列触发器、写入策略、四条索引、投影刷新函数与触发器。
3. 扩展 `mapDatabaseError`，把服务层预检查和复制的 `requireActiveOrganization` 去掉。角色的 404/403/409 收进 `access.ts`。
4. 删除 `withUser`，给业务模块加上不能导入连接池的 lint。
5. 用 quickstart 的集成测试证明直接 SQL 也会被拒绝，并跑 10,000 人的列表与子图。
6. 最后删除现行重述文档和文档校验。先删文档会丢掉审计对照；对照已经摘进 [research.md](research.md) 第 3 节。

投影刷新函数的语句从 `apps/api/src/modules/person/queries.ts` 移到迁移里的一个函数，避免两份算法。服务层删除对应的刷新调用。
