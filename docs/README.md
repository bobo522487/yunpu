# 文档导航

> 本文件是目录导航、两次 Constitution Check、Complexity Tracking 与编号索引的唯一权威；其他文档引用编号，不复制表格。

## 目录与分工

- `docs/requirements/`：做什么与验收（`user-stories.md`、`functional.md`、`acceptance.md`、`out-of-scope.md`）
- `docs/architecture/`：怎么做与数据长什么样（`overview.md`、`stack.md`、`runtime.md`、`modules.md`、`operations.md`、`data/`、`api/`）
- `docs/decisions/`：为什么（ADR 与缺陷决策）
- `docs/verification/`：实测证据与「待验证」登记
- `docs/superpowers/`：本次评审报告与实施计划（历史快照，不参与规格校验）
- 本仓库的完整目标架构文档位于 `docs/`；`specs/<NNN>-<feature>/` 只在后期分批实现时由 spec-kit 生成，当前不存在。批次工件引用 `docs/` 编号，不复制表格。

## Constitution Check（两次门禁）

> 由 Task 8 逐条回答（Phase 0 前 / Phase 1 后）。当前为占位，不自证通过。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| 由 Task 8 登记 | — | — |

## 编号索引

> 以下为重构前的编号索引原文；由 Task 5/9 去重、纠正位置并补齐引用。

### 1.4 Constitution Check（门禁）

> **GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.**
> 两个时点，两次检查，缺一不可。

**第一次（Phase 0 之前）——本计划自身的合规性自查：**

| #    | 宪法条款                   | 本计划的落点                                      | 通过 |
| ---- | -------------------------- | ------------------------------------------------- | ---- |
| 1    | Article I 简单胜过聪明     | 单进程单容器；8 个业务域；无抽象框架层            | ✅    |
| 2    | Article II 删掉就是删掉    | `OOS-06` 软删除不做；组织归档是状态列             | ✅    |
| 3    | Article III 规则要有执行者 | 本文所有约束均标注执行者与验证方式                | ✅    |
| 4    | Article IV 数据优于抽象    | 无 Family 表；家庭视图由关系推导（[`schema.md`](architecture/data/schema.md)） | ✅    |
| 5    | Article V 隔离靠数据库     | §7 RLS 策略是唯一租户隔离执行者                   | ✅    |
| 6    | Article VI 单一真相源      | §1.5 数据层权威；§5.3 模块清单只有一份            | ✅    |
| 7    | Article VII 不猜未来       | §16 演进触发条件；无预埋接口                      | ✅    |
| 8    | Article VIII 失败要响亮    | §8.3 错误模型；`AppError` + 全局 `onError`        | ✅    |
| 9    | Article IX 先测量再优化    | 索引策略按查询模式建，见 [`indexes.md`](architecture/data/indexes.md) | ✅    |
| 10   | 复杂度预算                 | 8 域 / 22 表 / 3 基础设施组件，均在预算内（§1.3） | ✅    |
| 11   | `OOS-01`..`OOS-19`         | 本计划未引入任何「不做」清单里的东西              | ✅    |

**第二次（Phase 1 设计之后）——写 `tasks.md` 之前的复核：**逐条回答「新增了什么、它的执行者是谁、编号是否已登记」。空着不写就等于不允许。

**触发 Complexity Tracking 的条件**：任何设计需要突破 §1.3 复杂度预算、引入新抽象层、或放宽「明确不做」清单。登记三列——Violation / Why Needed / Simpler Alternative Rejected Because（见 §20）。

## 20. Complexity Tracking（复杂度例外登记）

> **只有违反宪法或突破复杂度预算的设计才登记在这里。**
> 本表为空，表示当前设计完全在宪法与预算之内（§1.4 第一次检查 11 项全通过）。
> 登记三列缺一不可：**违反了什么 / 为什么必须 / 更简单的替代方案为何被否**。

| #    | Violation（违反了什么） | Why Needed（为什么必须） | Simpler Alternative Rejected Because（更简单的替代为何被否） | 决策人 | 日期 |
| ---- | ----------------------- | ------------------------ | ------------------------------------------------------------ | ------ | ---- |
| —    | 当前无例外              | —                        | —                                                            | —      | —    |

> **规则**：本表不得事后补记。设计评审时未登记的例外，视为未获批准，实现按缺陷处理（宪法 Governance · 违反处理）。

---

## 21. 编号索引表（`ARCH-*`）

> 与数据模型 §18 的 `DM-*` 索引表同构：**引用编号必须能在本表找到定义**。
> 校验目标（由 `scripts/check-docs.sh --root docs --strict` 执行）：悬空引用 0、一号两义 0、断链 0、无 CRLF、无未决澄清标记。「未引用 0」无执行者，不作为门禁（见任务 ledger Ruling）。

| 编号           | 一句话定义                                           | 本文位置         |
| -------------- | ---------------------------------------------------- | ---------------- |
| `ARCH-AR-01`   | 领域逻辑只有一份：规则只存在于该域的 service         | §0, §5.2         |
| `ARCH-AR-02`   | 隔离靠数据库：租户边界写在 RLS 策略里                | §0, §7           |
| `ARCH-AR-03`   | 谱系是图不是树：关系边是事实，`ltree` 路径是位置投影 | [`schema.md`](architecture/data/schema.md) |
| `ARCH-AR-04`   | 规则要有执行者：没有执行者的条目不写进文档           | §0, §1.2         |
| `ARCH-AR-05`   | 依赖单向：前端 → API → service → 数据层              | §1.2, §5.2, §5.3 |
| `ARCH-AR-06`   | 单一真相源：一份 Zod schema、一份数据模型            | §1.2, §5.3, §8.5 |
| `ARCH-AR-07`   | 约束必须有执行者                                     | §1.2             |
| `ARCH-AR-08`   | 失败要响亮：禁止静默吞异常                           | §1.2, §8.3       |
| `ARCH-AR-09`   | 不猜未来：不预埋空实现                               | §1.2, §16        |
| `ARCH-API-01`  | `uuidv7()` 主键时间有序，主键本身即游标              | §8.7             |
| `ARCH-AUD-01`  | 审计完整性诚实降级为软约束并登记                     | §12.2            |
| `ARCH-BLD-01`  | pnpm 是全仓库唯一包管理器，Dockerfile 与之一致       | §3, §15.1        |
| `ARCH-CC-01`   | 并发控制用事务级 advisory lock，不锁 project 行      | §11.2            |
| `ARCH-ERR-01`  | 错误两级映射：先看 SQLSTATE，再看约束名              | §8.3             |
| `ARCH-FE-05`   | 只做一条画布渲染路径                                 | §9.2             |
| `ARCH-GOV-01`  | 400 行红线是警报，不是合并门禁（定义见 `.specify/memory/constitution.md`） | [`constitution.md`](../.specify/memory/constitution.md) |
| `ARCH-HONO-01` | 不用 `createFactory` 注入运行时对象                  | [`runtime.md`](architecture/runtime.md) |
| `ARCH-RPC-01`  | RPC 类型推断：全链式调用 + 具名变量推断               | [`stack.md`](architecture/stack.md) |
| `ARCH-HONO-02` | 中间件洋葱模型：进入正序、返回逆序                   | [`runtime.md`](architecture/runtime.md) |
| `ARCH-HONO-03` | 优先用 Hono 内置中间件，不采用须写明理由             | §3.1             |
| `ARCH-HONO-04` | 路径参数与查询参数必须经 `zValidator` 校验           | [`runtime.md`](architecture/runtime.md) |
| `ARCH-HONO-05` | 不用全局 `declare module 'hono'` 扩展变量            | [`runtime.md`](architecture/runtime.md) |
| `ARCH-HONO-06` | OpenAPI 用官方 `@hono/zod-openapi`                   | §3, §8.8         |
| `ARCH-HONO-07` | `onError` 必须同时处理 `HTTPException`               | §8.3             |
| `ARCH-HONO-08` | 校验的官方语义（各 target 取值来源）                 | §8.6             |
| `ARCH-HONO-09` | 校验失败响应体由 hook 统一                           | [`runtime.md`](architecture/runtime.md) |
| `ARCH-HONO-10` | Bun 入口与静态资源：媒体走 API 鉴权代理              | §15.1.1          |
| `ARCH-HONO-11` | Hono 升级大版本前重核官方实践表                      | §18              |
| `ARCH-HONO-12` | RPC 客户端用官方 `hc<AppType>`，不手写路径           | [`stack.md`](architecture/stack.md) |
| `ARCH-IDX-01`  | 索引按查询模式建，不设机械的「RLS 谓词列首列」规则   | [`indexes.md`](architecture/data/indexes.md) |
| `ARCH-MOD-01`  | 模块清单只有一份：`MODULES` 常量                     | §5, §9.3         |
| `ARCH-OPS-01`  | 回滚 = 恢复备份，不是 down migration                 | §15.3, §15.5     |
| `ARCH-PERM-01` | 同一授权规则不允许写两遍                             | §7.5, §10        |
| `ARCH-PUB-01`  | 出版同步起步，有明确上限，不留白                     | §11.6            |
| `ARCH-TST-03`  | 测试分层：`bun test` 跑集成，E2E 用 Node             | §3, §14.1        |
| `ARCH-TST-04`  | 路由测试用 `app.request()` 官方调用约定              | §14.1            |

**编号规则**：`ARCH-<域>-<序号>`。域代码含义——`AR` 架构原则 / `API` 接口分页 / `AUD` 审计 / `BLD` 构建 / `CC` 并发控制 / `ERR` 错误 / `FE` 前端 / `GOV` 治理 / `HONO` Hono 官方实践 / `IDX` 索引 / `MOD` 模块 / `OPS` 运维 / `PERM` 权限 / `PUB` 出版 / `TST` 测试。

**编号唯一性**（`DM-GEN-21`）：同一编号不得承载两条规则。历史版本修订保留原编号并标注版本号，不复用编号表达新规则。

---

## 18. 编号索引表

**规则（`DM-GEN-21`）**：每个编号在全文档中只承载一条规则；引用编号必须在下表中有定义；下表中的编号全部有正文定义。

### 18.1 编号交叉引用

`ARCH-*` 与 `DM-*` 的定义分别见本文 §21 与 §18；两侧主题文件用编号互相引用，不复制规则正文（宪法 Article VI）。

> **反向引用规则**：架构侧引用本文用 `DM-*`，本文引用架构侧用 `ARCH-*`。任何一个编号必须能在本文 §21 / §18 找到定义——由 [`check-docs.sh`](../scripts/check-docs.sh)（`SC-DOC-01`）保证。


| 编号 | 规则摘要 | 定义位置 |
|---|---|---|
| `DM-GEN-01` | 每条不变量必须能指出执行者 | §1 |
| `DM-GEN-02` | 枚举 / 权限矩阵 / 表清单只有一份来源 | §1, §4.5 |
| `DM-GEN-03` | 规范之间不得互相否定 | §1 |
| `DM-GEN-04` | 事实只存一次，可推导的不落库 | §1 |
| `DM-GEN-05` | 能用约束表达的规则不写成应用层 if | §1 |
| `DM-GEN-06` | 约束必须能在真实 PG 18 上稳定执行 | §1 |
| `DM-GEN-07` | 视图是只读投影，必须 `security_invoker` | §1, §6 |
| `DM-GEN-08` | 每个外键显式声明删除动作的业务含义 | §1, §10 |
| `DM-GEN-09` | 数据库不猜语义：原文不被规范化值覆盖 | §1, §5.6 |
| `DM-GEN-10` | 先测量再优化 | §1, §11.4 |
| `DM-GEN-11` | 约束保护事实，不保护排版 | §1, §5.8 |
| `DM-GEN-12` | 锁只加在真正需要串行化的写者上 | §1, §5.8 |
| `DM-GEN-13` | 约束必须具名 | §1, §4.1 |
| `DM-GEN-14` | 非空文本字段必须带 `btrim(x) <> ''` | §1, §4.2 |
| `DM-GEN-15` | `updated_at` 由 DB 推进且严格单调递增 | §1, §4.4 |
| `DM-GEN-16` | 软约束必须登记并有补偿测试 | [`schema.md`](architecture/data/schema.md) |
| `DM-PURGE-01` | Person 物理清除（GDPR）V1 不做，走独立运维流程 + 审计 | [`invariants.md`](architecture/data/invariants.md) |
| `DM-GEN-17` | 每条外键的引用侧列必须有支撑索引 | §1, §11.2 |
| `DM-GEN-18` | 应用错误按「SQLSTATE + 约束名」映射，不解析文本 | §1, §4.6, §9.4 |
| `DM-GEN-19` | 清单类内容由生成物产出并被反向校验 | §1, §4.5, §12.3 |
| `DM-GEN-20` | 不依赖数据库默认值 | §1, §2.1 |
| `DM-GEN-21` | 编号唯一且可追溯 | §1, §18 |
| `DM-TEN-01` | 跨 Organization 不可见 | §7.1 #1 |
| `DM-SCP-01` | 租户和 Project scope 不可迁移 | §4.3, §7.1 #22 |
| `DM-SCP-02` | 每条内容属于唯一 Organization / Project | §4.3, §7.1 #2 |
| `DM-SCP-03` | 不存在跨 Project 引用 | §7.1 #3 |
| `DM-ORG-01` | 每个 Organization 恰好一个 owner | §5.1, §7.1 #4 |
| `DM-ORG-02` | owner 必须是成员 | §5.1, §7.1 #5 |
| `DM-ORG-03` | 不能删除 owner 的成员行 | §5.1, §7.1 #6 |
| `DM-ORG-04` | 创建组织必须在同一事务内插组织 + owner 成员行 | §5.1 |
| `DM-ORG-05` | 组织归档后禁止新写入（软约束） | §7.2 |
| `DM-ORG-06` | `organization_member.role` 无 `owner` 值 | §5.2 |
| `DM-ORG-07` | 成员增删改的角色授权（软约束） | §7.2 |
| `DM-PER-01` | `surname` 的三条硬规则 | §5.6 |
| `DM-NAM-01` | 每人最多一个主姓名 | §5.7, §7.1 #7 |
| `DM-NAM-02` | 同人同类型同值唯一 | §5.7 |
| `DM-REL-01` | 世系父边反向二元环被拒 | §5.8 |
| `DM-REL-02` | 反向非世系边允许并存 | §5.8 |
| `DM-REL-03` | 对称关系唯一物理表示 | §5.8, §7.1 #10 |
| `DM-REL-04` | 展示顺序不唯一 | §5.8, §7.1 #38 |
| `DM-REL-05` | 世系父边不能形成环 | §5.8, §7.1 #11 |
| `DM-REL-06` | 锁顺序与超时 | §5.8 |
| `DM-REL-07` | 并发正确性必须在目标仓库真实 PG 18 上实测 | §5.8 |
| `DM-REL-08` | 关系两端同 Project 且不同人物 | §5.8, §7.1 #8 |
| `DM-REL-09` | 同一对人物同一 kind 不重复 | §5.8, §7.1 #9 |
| `DM-REL-10` | 非世系关系不参与环检查 | §5.8, §7.1 #12 |
| `DM-REL-11` | 世系写锁不阻塞同 Project 其他写入 | §5.8, §7.1 #50 |
| `DM-REL-12` | `kind` 取值单一来源 | §5.8, §7.1 #49 |
| `DM-EVT-01` | Event 至少有一项非空白内容 | §5.9, §7.1 #16 |
| `DM-EVT-02` | Event 恰好关联 Person 或 Relation | §5.9, §7.1 #13 |
| `DM-EVT-03` | Event 类型属于对应域 | §5.9, §7.1 #14 |
| `DM-EVT-04` | Event 日期范围有序 | §5.9, §7.1 #15 |
| `DM-EVT-05` | Relation 类型与 Event 类型匹配（软约束） | §7.2 |
| `DM-NOD-01` | Node 重排纪律（单语句一次写完） | §5.11 |
| `DM-NOD-02` | Node 的 path 唯一、格式合法 | §5.11, §7.1 #17 |
| `DM-NOD-03` | 父路径存在且严格更短（结构性无环） | §5.11, §7.1 #18 |
| `DM-NOD-04` | 每人每 Lineage 最多一个 primary | §5.11, §7.1 #19 |
| `DM-NOD-05` | annotation 无人物，人物节点有 Person | §5.11, §7.1 #20 |
| `DM-NOD-06` | 根是顶层节点 | §5.11, §7.1 #21 |
| `DM-NOD-07` | Node 编排依据的语义正确（软约束） | §7.2 |
| `DM-SRC-01` | Citation 目标同 Project | §5.13 |
| `DM-ART-01` | `article_page.content` 至少含 `type` | §5.15, §7.1 #33 |
| `DM-MED-01` | 每个对象字节有唯一主人 | [`schema.md`](architecture/data/schema.md) |
| `DM-MED-02` | 孤儿字节回收靠桶级对账 | [`schema.md`](architecture/data/schema.md) |
| `DM-MED-05` | 对象字节在事务提交后删除（软约束，有补偿测试） | [`invariants.md`](architecture/data/invariants.md) |
| `DM-MED-03` | `object_key` 物理唯一 | §5.16, §7.1 #23 |
| `DM-MED-04` | 媒体引用存在、同 Project | §7.1 #35 |
| `DM-INV-01` | token 唯一、只存哈希、熵 ≥ 256 bit | §5.3, §7.1 #24 |
| `DM-INV-02` | 邀请邮箱一致性 | §5.3, §7.1 #27 |
| `DM-INV-03` | 邀请并发兑换抢占 | §5.3, §7.1 #27 |
| `DM-INV-04` | 同邮箱单条待处理邀请 | §5.3, §7.1 #25 |
| `DM-INV-05` | 邀请状态与时间一致 | §5.3, §7.1 #26 |
| `DM-BOK-01` | 出版快照不可修改 | §5.21, §7.1 #28 |
| `DM-BOK-02` | 出版记录不可直接删除 | §5.21, §7.1 #29 |
| `DM-BOK-03` | Book 有 release 时不能删除 | §5.21, §7.1 #30 |
| `DM-BOK-04` | 编目项类型与内容引用匹配 | §5.20, §7.1 #37 |
| `DM-BOK-05` | 产物字节纪律 | §5.21 |
| `DM-AUD-01` | 审计的完整性分级（强 / 尽力而为） | §5.22, §7.2 |
| `DM-AUD-02` | `audit_log` 只追加 | §5.22, §7.1 #31 |
| `DM-RLS-01` | 上下文缺失时默认拒绝 | §8.2 |
| `DM-RLS-02` | 所有业务表启用 `ENABLE` + `FORCE` | §8.2 |
| `DM-RLS-03` | 业务视图必须 `security_invoker` | §6 |
| `DM-PERM-01` | `rls_definer` 的权限清单按函数最小化 | §8.5 |
| `DM-POOL-01` | 会话超时由连接串下发，Drizzle `prepare: false` | §5.8, §12.5 |
| `DM-IDX-01` | 索引按查询模式建，无机械规则 | §8.2, §11 |
| `DM-ADR-01` | 世系写入用事务级 advisory lock | §15 |
| `DM-ADR-02` | 关系排序不唯一 | §15 |
| `DM-ADR-03` | 世系反向二元环拒绝 | §15 |
| `DM-ADR-04` | 索引首列无机械规则 | §15 |
| `DM-ADR-05` | 审计完整性两级分级 | §15 |
| `DM-ADR-06` | 产物字节归 `book_release` 行 | §15 |
| `DM-ADR-07` | 孤儿字节靠对账脚本 | §15 |
| `DM-ADR-08` | Node 重排单语句写完 | §15 |
| `DM-ADR-09` | 权限规则来源单一 | §15 |
| `DM-ADR-10` | 路径容量上限触达时重建 lineage | §5.11, §15 |
| `DM-ADR-11` | 生成列一律显式 `STORED` | §15 |
| `DM-ADR-12` | `invite` 状态变更只经受控函数 | §15 |
| `DM-ADR-13` | 所有权并发控制用 CAS | §15 |
| `DM-ADR-14` | 会话超时由 `PGOPTIONS` 下发 | §15 |

**统计**：编号清单与一致性由 [`check-docs.sh`](../scripts/check-docs.sh) 的 `--strict` 输出（R4/R5/R7）与 CI 生成；人工不维护手写计数。

---
