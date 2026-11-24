# Research: 把权威还给行为本身

## 1. 现行文档门禁不是行为的执行者

**Decision**: 产品的现行说明只保留 `docs/decisions/` 与一份新建的 `docs/boundaries.md`。删除 `docs/README.md`、`docs/requirements/`、`docs/architecture/`、`docs/verification/`、`docs/superpowers/` 和 `docs/.check-docs-baseline.txt`。从 `.github/workflows/verify.yml` 与 `docs.yml` 去掉 `scripts/check-docs.sh` 及其测试。删除 `scripts/check-docs.sh` 与 `tests/docs/`，避免门禁被重新挂上。`.specify/memory/constitution.md` 升到 2.0.0：保留「非法状态存不进去、同一事实只有一处权威、失败可见、租户数据不串、简单胜过聪明、删除即物理删除、不猜未来」；废止编号族、两次治理检查、复杂度例外账本和文档校验作为合并条件。

**Rationale**: `docs/README.md` 自己写明两次 Constitution Check 是 2026-11-14 的历史快照，严格校验在无基线时有 478 条违规，带基线只拦新增。这套编号与校验已经不是可执行的规则。规格要求现行说明里重述结构、契约、错误对照和模块依赖的文档数量为 0。Git 历史保留被删文本，不另建 `docs/archive/`，否则档案仍会被当成要维护的第二份说明。

**Alternatives considered**: 保留校验器但不进 CI。否决，因为脚本还在就会被重新接回合并条件。把旧文档移到 `docs/archive/`。否决，因为目录仍在现行树里，和「数量为 0」冲突。

## 2. 权威定义落在已经存在的三处

**Decision**:

- 存储结构的权威是已执行的迁移 `packages/db/migrations/*.sql`，加上与之同一次变更更新的 Drizzle 表定义 `packages/db/src/schema/`。用一条集成测试对照两边的约束名，禁止只改其中一边。
- 对外形状的权威是 `apps/api/src/app.ts` 导出的 `AppType`。不手写第二份端点说明。`apps/web` 目前故意不把 `AppType` 打进 Vite 包，本特性不改这个打包边界。
- 失败含义的权威是 `packages/shared/src/errors.ts` 的 `ERROR_STATUS`，以及 `apps/api/src/lib/errors.ts` 的 `mapDatabaseError`。按 SQLSTATE 和约束名映射，不解析错误文本，不另写 `errors.md`。

**Rationale**: 这两处代码已经是运行中的事实。规格禁止再维护一份散文对照表。

**Alternatives considered**: 引入 OpenAPI 生成器。否决。仓库没有这套生成链，为了「生成」再加一条工具链是新的维护面。`AppType` 已是类型契约。

## 3. 软约束逐条结局

对照 `docs/architecture/data/invariants.md` §7.2 与已落地的迁移。未出现在 `packages/db/migrations/` 里的表（event、node、folder、lineage、source、article、book、media 等）本特性不创建。

| 登记项 | 结局 |
| --- | --- |
| `DM-ORG-05` 归档后禁止新写入 | 下沉为数据库触发器。已落地的子表在组织 `status <> 'active'` 时拒绝 INSERT/UPDATE/DELETE。归档组织本身的那一次状态更新除外。服务层里复制的 `requireActiveOrganization` 删除。 |
| `DM-ORG-07` 角色与 `last_used_at` | 角色矩阵见 data-model。写入策略放进 RLS，使绕过服务的连接仍写不进去。HTTP 上「非成员 404、成员但权限不够 403、不能改所有者角色 409」仍由唯一的 `access.ts` 翻译，因为行策略本身分不出这三种可见结果。`last_used_at` 只允许本人改，用触发器限制列。 |
| `DM-PER-03` `is_living` 与年份 | 下沉为 `person` 上的 CHECK：有死亡年则 `is_living` 必须为假；出生年与死亡年同时存在时死亡年不早于出生年。不新建 event 表。 |
| `DM-REL-13` 同 kind 父母边 ≤ 2 | 下沉为约束触发器，只限制 `biological_parent` 与 `adoptive_parent`。`ritual_heir` 的基数不变。删除 `countParentsOfKind` 预检查。竞态下仍由触发器拒绝。错误码继续用 `PARENT_LIMIT`，由触发器抛出专用 SQLSTATE，不解析消息文本。 |
| `DM-PROJ-01` 投影与父母边同事务 | 把现有刷新语句收成数据库函数，由 `person_relation` 上的触发器在同一事务调用。服务层不再单独刷新。投影仍是加速层，不是关系事实。环检测触发器保持原样；刷新与环检测在同一事务，环检测失败则一并回滚。 |
| `DM-EVT-05`、`DM-NOD-07` | 表不存在。不实现，不登记。 |
| `DM-PURGE-01` | 产品明确不做。不实现，不登记。 |
| `DM-MED-05` | 产品媒体表不存在。`apps/api/src/media.ts` 是独立的存储证明，不在人物写入事务里删对象。不登记为软约束。将来若有跨系统效果，必须从该次已提交写入的同一个函数发出，并在 `docs/boundaries.md` 写明补救。 |
| `DM-AUD-01` | 已落地的审计插入在 `packages/db/migrations/` 的函数里，与业务写入同一事务，失败即回滚。不存在「记得调用」的应用层路径。不登记。 |
| PG 18 待验证清单 | 不是业务规则。保留 `docs/decisions/0001-pg18-defects.md`。 |

**Decision**: 上表即审计结果。实现时不得再写回软约束登记表。

**Rationale**: 规格要求每条旧登记只有一个结局。能由存储拒绝的，存储拒绝；表不存在的，不提前建表。

**Alternatives considered**: 父母边上限继续留在服务层并用测试补偿。否决。并发下计数检查可以越过，非法状态仍能提交。用 EXCLUDE 约束表达「最多两条」。否决。EXCLUDE 适合区间重叠，不适合「同终点计数 ≤ 2」。约束触发器是存储里能拒绝该状态的现成能力。

## 4. 引用侧索引

**Decision**: 为已经落地、且引用列没有前导索引的外键补索引：`person`、`person_name`、`person_relation`、`lineage_projection` 上指向 `project (organization_id, id)` 的外键，各建 `(organization_id, project_id)` 索引。`fk_organization_owner` 不另建索引：引用表 `organization` 的主键就是 `id`，删除成员时按主键定位一行，不是随表增长的扫描。这条理由写入 `docs/decisions/0002-owner-fk-index.md`，不维持白名单。文档里其余 17 条「不建」属于未创建的表，随那些表的不存在而消失，不预建索引。

**Rationale**: 规格禁止活白名单。已存在的四张内容表会随人物数增长，删除项目时要在引用表上按 `(organization_id, project_id)` 查找。所有者外键的查找面是一行。

**Alternatives considered**: 沿用「项目删除很罕见，所以 18 条都不建」的整表豁免。否决。那是一份要人工同步的例外清单，而且其中多数表根本没有落地。对四张已落地表先跑 EXPLAIN 再决定。测量仍然要做，但默认动作是补上这四条索引；只有测量显示写入代价且查找仍是主键定位时，才允许像所有者外键这样留下一条决策记录。

## 5. 请求路径上没有依赖注入容器

**Decision**: 不引入依赖注入容器，也不把现有的显式函数再包一层工厂。组装点就是 `apps/api/src/app.ts`（路由与中间件）和 `apps/api/src/db/with-tenant-transaction.ts`（连接、角色、`app.user_id`）。中间件保持现在的四段：请求标识、安全响应头、压缩、认证。它们不决定租户数据可见性。删除 `withUser` 这个别名，调用处改为 `withTenantTransaction`。业务模块禁止导入连接池或 `createDb`。

**Rationale**: 仓库里没有装饰器、令牌或 IoC 容器。租户隔离已经由 `SET LOCAL ROLE genealogy_app` 加 `set_config(..., true)` 加 FORCE RLS 完成。危险点是别名和被导出的池可能让新代码绕过这次事务。

**Alternatives considered**: 做一个组合根工厂，把 db、配置、服务注入到每个模块。否决。当前调用链从路由到服务函数已经显式，再包一层就是规格要去掉的隐藏装配。

## 6. 租户入口与三个例外

**Decision**: 凡读写租户表，只能通过 `withTenantTransaction`。该函数在归还连接前结束事务，`SET LOCAL` 不留到下一次借出。三个不走该函数的入口写进 `docs/boundaries.md`，并且不能被普通请求或普通后台任务调用：

1. 健康检查：单独的短连接，只执行 `SELECT version()`。
2. 认证库：`AUTH_DATABASE_URL` 上的 Better Auth 连接，不查询家谱租户表。
3. 迁移命令：`packages/db` 的迁移用自己的连接，作为跨租户入口。

**Rationale**: 规格要求裸连接读不到租户表，同时允许迁移和明确的非租户入口。健康检查与认证库今天已经是这样分开的。

**Alternatives considered**: 让健康检查也包进租户事务。否决。它没有用户，也没有租户。把认证表并进家谱库的同一条连接。否决。那会扩大本特性的范围，并改变现有的双连接角色。

## 7. 模块边界：最近 20 次提交没有总是成对的目录

**Decision**: 不合并 `apps/api`、`apps/web`、`packages/db`、`packages/shared`，也不合并 api 内的 account、auth、organization、person、project。删除三处复制的 `hasRole` / `requireRole`，收成一个 `apps/api/src/access.ts` 普通函数。不新增只做字段拷贝的包、DTO 或 repository。路由上的输入校验保留。

**Rationale**: 取最近 20 次改动 `apps/` 或 `packages/`、且不是 merge 的提交（从 `79ec2c3` 到 `cb2b9ca`）。成对比例：

| 双方 | 同时修改 / 触及至少一方 |
| --- | --- |
| `apps/api` + `apps/web` | 4/20 |
| `apps/api` + `packages/db` | 5/14 |
| `apps/api` + `packages/shared` | 5/14 |
| `apps/web` + `packages/db` | 4/11 |
| `apps/web` + `packages/shared` | 4/11 |
| `packages/db` + `packages/shared` | 4/6 |

api 模块两两最高是 account+organization 与 account+project，均为 2/3，不是 20 次窗口里的「总是」。规格只在「总是同时修改」时合并。`apps/web` 不引用 `@yunpu/shared`，共享包仍被 api 与 db 使用，不能并进某一个应用。

**Alternatives considered**: 因为 monorepo 看起来过早，就把 `packages/db` 并进 `apps/api`。否决。测量不支持，而且迁移命令需要一个不依赖 API 进程的入口。

## 8. 名单与谱系树的耗时

**Decision**: 用现有的人物列表查询和子图查询做验收，不新增缓存或第二套投影。一个项目 10,000 位人物，列表与子图各自在 2 秒内返回；另一个项目的数据量加倍后，这两次耗时增幅不超过 10%。超过预算时再看执行计划，不把执行计划文本写进现行文档。

**Rationale**: 规格的成功标准是使用者等待时间，不是某条计划节点的名字。RLS 的 SELECT 策略保持 `organization_id = ANY (app.visible_org_array())`，不往读取策略里加角色子查询，避免列表和树的读取路径变重。角色只加在写入策略上。

**Alternatives considered**: 把角色子查询加进所有 SELECT 策略。否决。读取可见性今天是「成员可见」，收紧读取会改变合法结果，也可能让列表失去按组织过滤的索引用法。
