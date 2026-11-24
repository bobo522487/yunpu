# Data Model: 把权威还给行为本身

本特性不新增业务表，不新增终端用户能保存的新事实。下面是规格里的概念实体，以及已有存储上收紧的规则。

## 概念实体

### 权威定义

一件事实只有一处定义。

| 事实 | 权威 | 不得另存 |
| --- | --- | --- |
| 表、列、约束、触发器、行级策略 | `packages/db/migrations/` 中已执行的 SQL；Drizzle schema 必须在同一次变更中与它对上约束名 | 散文里的表清单、编号索引 |
| 对外请求与响应形状 | `AppType` | 手写端点对照 |
| 失败码与 HTTP 状态 | `ERROR_STATUS` + `mapDatabaseError` | 手写错误对照表 |

### 决策记录

说明为什么这样选、放弃了什么。放在 `docs/decisions/`。不能推翻迁移里的约束。本特性新增一条：所有者外键为什么不另建索引。

### 核心不变量

只写存储表达不了、且跨系统或位于存储之外的规则。落地后的 `docs/boundaries.md` 只包含三条入口例外：健康检查、认证库、迁移命令。产品里目前没有「提交后再删外部字节」的写入。

### 租户事务

一次读取或写入带着 `app.user_id`，角色为 `genealogy_app`，设置用事务局部配置，提交或回滚后身份消失。可选的 `orgId` 只用于收窄，不代替 `user_id`。

### 业务模块

一组并不总是一起改的行为保持分开。本特性的测量结论是 api、web、db、shared 以及五个 api 模块都保持原边界。

## 已有实体上的规则

### Person

已有字段继续使用：`sex`、`surname`、`birth_year`、`death_year`、`is_living`、`version`，主键 `(project_id, id)`，外键指向项目与组织。

新增校验：

- 有 `death_year` 时 `is_living` 必须为假。
- `birth_year` 与 `death_year` 都有值时，`death_year >= birth_year`。
- 只有出生年、或死亡年未知但 `is_living` 为假，仍然允许。
- 违反时存储拒绝，调用方看到校验失败，已有数据不变。

### PersonRelation

已有规则保留：端点不同、配偶端点有序且同一无序对只有一条、父母类边的环由现有约束触发器拒绝。

新增：同一项目、同一 `to_person_id`、同为 `biological_parent` 或同为 `adoptive_parent` 的边最多 2 条。第三条无法提交。`ritual_heir` 不套用这个上限。

关系事实仍只在这张表。`lineage_projection` 在同一事务由触发器按父母类边刷新，不能单独被写成与边矛盾的事实。

### Organization

`status` 取值仍是 `active`、`suspended`、`archived`。归档是状态，不是删除。

`status <> 'active'` 时，已落地的项目、人物、人名、关系、投影、成员与邀请上的新增、修改和删除被拒绝。把组织更新为 `archived` 的那一次写入本身允许通过。

### 谁可以写

读取策略不变：成员能看见自己所属组织的行。非成员看不见行，服务仍返回「不存在」，不改成「无权」，以免暴露组织是否存在。

写入策略是兜底执行者，矩阵与今天的服务判断一致：

| 表 | 新增 / 修改 | 删除 |
| --- | --- | --- |
| person、person_name、person_relation、lineage_projection | editor 或 admin，且组织为 active | 同左 |
| project | editor 或 admin，且组织为 active | 仅 admin，且组织为 active |
| organization、invite | admin | admin |
| organization_member | admin；本人只能改自己的 `last_used_at` | admin，或本人退出；所有者行仍由现有外键限制删除 |

成员但角色不够：拒绝，调用方看到无权。非成员：仍看到不存在。修改所有者角色：仍看到冲突。这些可见结果由唯一的访问函数翻译数据库拒绝，不在每个服务里各写一份角色判断。

### 引用保护

四张已落地内容表的项目外键补 `(organization_id, project_id)` 索引。`organization(id, owner_user_id)` 指向成员的外键依赖组织主键定位，不另建索引，理由只存在于一条决策记录。

## 状态

组织状态只有一条与本特性相关的迁移：`active` 或 `suspended` 可以改为 `archived`。本特性不增加从 `archived` 恢复的路径。人物与关系没有新的状态机。非法组合没有「保存后再标记」的状态，它们不能被保存。
