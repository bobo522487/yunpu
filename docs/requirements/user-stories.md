# 用户故事与验收场景

> 本文件是「US-001..US-010 与 Given/When/Then 场景」的唯一权威；其他主题见 `docs/README.md` 导航，同一主题不复制表格。

## 2. 用户场景与验收（User Scenarios & Testing）

### US-001（P1）录入人物与多种姓名

**作为**修谱主事人，**我希望**为一个已故或在世人物录入姓名、字、号、谱名、乳名、谥号，**以便**同一人物在不同史料中的不同称谓都能留存。

**为什么是 P1**：人物是谱牒的原子单位。没有人物，其他一切功能都无法测试。

**独立测试**：新建一个人物 → 录入三个不同类型的姓名 → 刷新页面 → 三个姓名都在，且只有一个被标记为主显示名。

**验收场景**：

1. **Given** 一个已创建的项目，**When** 录入一个带姓氏和名字的人物，**Then** 人物创建成功并显示主显示名
2. **Given** 一个已有主显示名的人物，**When** 再录入一个同类型姓名，**Then** 系统接受（多姓名合法），主显示名保持不变
3. **Given** 一个姓名类型为「谱名」的人物，**When** 录入，**Then** `person_name` 中 `kind='genealogy'` 的行数由 `SELECT count(*) FROM person_name WHERE person_id = :id AND kind='genealogy'` 读出且 ≥ 1，UI 展示分组键即 `kind`（`FR-PER-01`）。
4. **Given** 一个姓名类型为「乳名」的人物，**When** 录入，**Then** 正式称谓排序查询 `SELECT count(*) FROM person_name WHERE person_id = :id AND kind <> 'milk'` 不含该行，即 `kind <> 'milk'` 的结果集与 `is_primary` 展示集一致（`FR-PER-01`）。
5. **Given** 人物已存在，**When** 把主显示名切换到另一个已录姓名，**Then** 切换成功且原主显示名降为普通姓名

---

### US-002（P1）用固定关系类型记录亲属关系

**作为**修谱主事人，**我希望**用父母、收养、继亲、寄养、承嗣、监护、配偶、伴侣这几类固定关系记录亲属，**以便**家庭结构能被可靠地推导出来。

**为什么是 P1**：关系类型是**封闭集合**，这是整个模型能做严格约束的前提。如果允许任意关系类型，所有下游不变量（祖先环检测、兄弟姐妹归组）都会退化为启发式。

**独立测试**：在一个项目里录入父母、配偶各一条 → 查询该人物的家庭视图 → 父母出现在正确的父/母位置，配偶出现在配偶位置。

**验收场景**：

1. **Given** 一个项目，**When** 录入一条 `parent` 关系，**Then** 关系被接受并出现在家庭视图
2. **Given** 一个项目，**When** 录入一条 `spouse` 关系，**Then** 关系被接受且不产生任何 `parent` 关系
3. **Given** 一个项目，**When** 试图录入一种不在封闭集合内的关系类型，**Then** 请求被拒绝，错误明确指出该类型不在允许列表
4. **Given** 一条已存在的 `spouse` 关系，**When** 把两端对调后再记一次，**Then** 写入被拒绝（两端不可互换重复）
5. **Given** 一条 `parent` 关系，**When** 检查被连接的孩子，**Then** 该孩子必须已存在于同一项目中，否则写入被拒绝

---

### US-003（P1）家庭视图由关系拼出，不虚构

**作为**修谱主事人，**我希望**家庭视图（父母、兄弟姐妹、子女、世次）完全由已记录的关系推导，**以便**视图里的每个人都是有据可查的，而不是系统编出来的。

**为什么是 P1**：这是「事实与推导分离」原则的落地。若系统为了填满视图而虚构另一方，数据就不可信了。

**独立测试**：只记录单方父母 → 查看家庭视图 → 缺失的一侧显示为「未知」，而不是自动补一个人。

**验收场景**：

1. **Given** 一条 `parent` 关系只连接了孩子和母亲，**When** 打开家庭视图，**Then** 父亲位置显示为未知，不自动创建人物
2. **Given** 一条 `spouse` 关系，**When** 推导家庭视图，**Then** 配偶双方**不会**被自动写成孩子的父母
3. **Given** 同一对父母有多个孩子，**When** 推导兄弟姐妹，**Then** 这些孩子互相出现在对方的兄弟姐妹列表中
4. **Given** 一个没有父母记录的人物，**When** 推导世次，**Then** 该人物被标记为世次起点，其后代世次逐级递增
5. **Given** 关系事实被修改，**When** 重新推导家庭视图，**Then** 视图随之改变，且视图数据本身不被存储

---

### US-004（P2）在谱系中安排编纂位置

**作为**修谱主事人，**我希望**在某条谱系里安排人物的编纂位置（节点与路径），**以便**表达「这一支排在第几世、第几支」这类编排决策。

**为什么是 P2**：位置是**投影**，不是事实。它是谱牒区别于普通家谱树的关键能力，但排在人物与关系之后。

**独立测试**：创建一个谱系 → 把已有的人物放到该谱系的某个位置 → 查询路径 → 路径与放入的位置一致。

**验收场景**：

1. **Given** 一个谱系与一批人物，**When** 安排一个人物到某位置，**Then** 位置被接受，谱系路径包含该位置
2. **Given** 一个已安排位置的人物，**When** 修改其人物关系，**Then** **位置不变**（关系是事实，位置是安排）
3. **Given** 一个节点，**When** 删除该节点，**Then** **人物不被删除**（删位置不等于删人）
4. **Given** 一个谱系，**When** 查看根节点，**Then** 根节点唯一且符合 `lineage_root` 视图定义
5. **Given** 一个项目，**When** 人物关系形成祖先环，**Then** 关系写入被拒绝，且该写入不产生任何位置投影

---

### US-005（P2）挂载来源引用

**作为**修谱主事人，**我希望**为人物、姓名、关系和事件挂上来源引用，**以便**每条录入的结论都能回溯到史料出处。

**为什么是 P2**：溯源是谱牒产品的核心价值之一，但不影响数据模型的可行性——先做会推迟价值交付。

**独立测试**：为一个事件挂一条来源引用 → 查询该事件 → 显示来源名称与引用位置。

**验收场景**：

1. **Given** 一个事件，**When** 挂一条引用，**Then** 引用被接受并与该事件关联
2. **Given** 一个来源，**When** 查询引用它的事件，**Then** `SELECT count(*) FROM source_citation WHERE source_id = :id` 与反向引用视图行数相等，且 `fk_source_citation_source` 保证无悬空 `source_id`（`FR-SRC-01`）。
3. **Given** 一条引用，**When** 引用定位指向一个不存在的人物，**Then** 写入被拒绝
4. **Given** 一个来源，**When** 删除该来源，**Then** 有引用时 `SELECT count(*) FROM source_citation WHERE source_id = :id` > 0 触发 `23001` 拒绝（`RESTRICT`）；无引用时删除成功且引用表行数不变；规则见 `invariants.md` §10 删除语义表。

---

### US-006（P2）撰写单篇谱文

**作为**修谱主事人，**我希望**写单篇谱文（富文本、分页、可挂媒体），**以便**记录序言、凡例、修谱说明等文字。

**为什么是 P2**：谱文是内容型功能，与前面的结构型功能（人、关系、位置）正交。

**独立测试**：新建一篇谱文 → 编辑正文并分页 → 保存 → 刷新后内容一致。

**验收场景**：

1. **Given** 一个项目，**When** 创建一篇谱文，**Then** 谱文创建成功且有标题与正文
2. **Given** 一篇谱文，**When** 两个会话同时编辑，**Then** 后提交的冲突方收到明确的冲突错误，不静默覆盖
3. **Given** 一篇谱文，**When** 保存并刷新，**Then** `SELECT count(*) FROM article_page WHERE article_id = :id` 与保存前相等、每页 `version` 单调递增且正文分页序号连续（`FR-ART-02` 乐观锁）。
4. **Given** 一篇谱文，**When** 删除，**Then** `SELECT count(*) FROM article_page WHERE article_id = :id` = 0（`fk_article_page_article` `CASCADE`），`article_page_media` 关联行清空、`media_asset` 字节按提交后回调清理；规则见 `invariants.md` §10。

---

### US-007（P1）多租户隔离

**作为**工作室管理员，**我希望**我的 Organization 完全看不到其他 Organization 的任何行，**以便**客户数据绝对不串。

**为什么是 P1**：这是 SaaS 的生死线。跨租户泄漏一次，产品即结束。

**独立测试**：建两个 Organization 各写一条人物 → 用 A 的会话查全部人物 → 只能看到 A 的。

**验收场景**：

1. **Given** 两个 Organization 各有数据，**When** A 组织成员查询列表，**Then** 结果不含 B 的任何行
2. **Given** B 组织的一条记录 ID，**When** A 组织成员直接按 ID 访问，**Then** 返回「不存在或无权」，不泄漏 B 的数据存在性
3. **Given** 应用代码漏写 `WHERE organization_id` 的一个查询，**When** 在真 PG 18 上执行，**Then** RLS 策略仍然过滤掉其他租户的行
4. **Given** 一个成员被移出 Organization，**When** 该成员用旧会话重试，**Then** 可见组织数组为空，读不到任何行
5. **Given** 一个只读角色，**When** 尝试写入，**Then** 被拒绝且错误明确

---

### US-008（P1）组织与谱项目生命周期

**作为**工作室管理员，**我希望**创建项目、邀请成员、归档组织，**以便**管理真实的修谱工作流程。

**为什么是 P1**：租户的组织结构是所有数据的挂载点，先于任何业务功能存在。

**独立测试**：创建组织 → 创建项目 → 邀请成员并接受 → 成员可访问该项目。

**验收场景**：

1. **Given** 一个已认证用户，**When** 创建 Organization，**Then** 创建者成为 `owner`
2. **Given** 一个 Organization，**When** 邀请一名成员，**Then** 邀请记录创建，成员接受后进入 `organization_member`
3. **Given** 一个 Organization，**When** 转移所有权，**Then** 所有权原子转移，并发转移时只有一个成功，其余收到明确错误
4. **Given** 一个 Organization，**When** 归档该组织，**Then** 组织进入归档状态，**数据不被物理删除**
5. **Given** 一个已归档组织，**When** 成员尝试写入，**Then** 写入被拒绝

---

### US-009（P3）编排谱书目录并导出不可变版本

**作为**修谱主事人，**我希望**编排谱书目录并导出一个不可变版本，**以便**底稿之后怎么改，已导出的文件不变。

**为什么是 P3**：出版是终点功能，依赖前面全部到位；且它有独立的复杂度（同步导出的上限），不适合早期。

**独立测试**：编排目录 → 导出一个版本 → 之后修改底稿 → 再看已导出文件，内容不变。

**验收场景**：

1. **Given** 一个谱书目录，**When** 导出，**Then** 生成一个 `book_release` 快照，版本号唯一且单调递增
2. **Given** 一个已导出版本，**When** 底稿内容被修改，**Then** 该版本内容不变
3. **Given** 一个谱书，**When** 两次并发导出，**Then** 版本号不冲突，后到者收到明确错误
4. **Given** 一个超出同步导出上限的谱书，**When** 导出，**Then** 明确拒绝并说明上限，而不是静默截断

---

### US-010（P3）媒体附件

**作为**修谱主事人，**我希望**上传家谱图片、老照片、扫描件并关联到人物或谱文，**以便**影像资料与文字记录在同一处。

**为什么是 P3**：媒体是横切关注点，且引入对象存储后有额外的访问控制面；先验证结构型功能。

**验收场景**：

1. **Given** 一个项目，**When** 通过服务端代理上传一个媒体文件，**Then** 文件进入私有桶并生成 `media_asset` 记录
2. **Given** 一个媒体资产，**When** 未授权用户尝试下载，**Then** 被拒绝（对象存储不做公开读）
3. **Given** 一条人物媒体关联，**When** 删除该关联，**Then** `SELECT count(*) FROM person_media WHERE id = :id` = 0，`fk_person_media_media` 保持 `RESTRICT`，`media_asset` 行保留且对象字节按 `DM-MED-05` 在事务提交后删除。

---

### 13.3 验收清单（Given / When / Then）

编号即测试用例 ID。**v1.2 修订**的用例标 🔧，**新增**的标 ✚。

**#1 组织原子创建**
- Given 无组织
- When 调用 `app.create_organization('X')`
- Then 返回组织 id，成员表含 owner 且 role='admin'，audit_log 有 `organization.created` 且 `project_id IS NULL`

**#2 owner 成员行不可删**
- Given 组织的 owner 是 u1
- When `DELETE FROM organization_member WHERE ... user_id = u1`
- Then 被外键拒绝，**SQLSTATE 为 `23001`**（v1.2 修订：PG 18 的 `RESTRICT` 专属码，不是 `23503`）🔧

**#3 转移后旧 owner 可删**
- Given 已把 owner 转给 u2
- When 删除 u1 的成员行
- Then 成功

**#4 owner 必须是成员**
- Given u9 不是成员
- When `UPDATE organization SET owner_user_id = u9`
- Then 提交时被外键拒绝

**#5 跨 Project 引用被拒**
- Given p1、p2 两个 Project
- When 在 p1 下建指向 p2 人物的 relation / node / citation
- Then 被复合外键拒绝

**#6 同名项目内实体互不冲突**
- Given p1、p2
- When 各建同名人物、同名谱系、同名分类
- Then 全部成功

**#7 对称关系唯一物理表示**
- Given A、B
- When 插入 `spouse` A→B，再插入 `spouse` B→A
- Then 第二次被 CHECK 拒绝（`23514`，约束 `ck_person_relation_symmetric_order`）

**#8 世系父边反向二元环被拒**
- Given A、B
- When 插入 `biological_parent` A→B，再插入 `biological_parent` B→A
- Then 第二次**提交时**被 `GX001` 拒绝

**#9 非世系关系反向边允许**
- Given A、B
- When 插入 `step_parent` A→B，再插入 `step_parent` B→A
- Then 两次都成功（实测 2 行）

**#10 自环被拒**
- When `from_person_id = to_person_id`
- Then 被 `23514` 拒绝，约束名 `ck_person_relation_not_self`

**#11 三元世系环被拒**
- When A→B、B→C、C→A（均为世系父边）
- Then 提交时被 `GX001` 拒绝

**#12 继亲/寄养成环允许**
- When `step_parent` / `foster_parent` 形成环
- Then 提交成功

**#13 并发竞争世系边**
- Given 两个并发事务各写一条互相冲突的世系边
- When 同时提交
- Then 恰好一条成功，另一条被 `GX001` 明确拒绝；**无死锁、无超时**；同时验证同 Project 的人物 INSERT 不被该锁阻塞

**#14 关系排序不唯一**
- Given 同一 from、同一 kind 的两条关系
- When 两条 `sort_order` 相同
- Then 插入成功；查询按 `(sort_order, id)` 返回稳定顺序

**#15 Node 根与父子**
- Given 新 lineage
- When 插入根节点、再插入子节点
- Then 根的 `parent_path IS NULL`，子节点 `parent_path` 等于根 path

**#16 父路径不存在时提交失败**
- When 插入子节点，其父 path 不存在
- Then 提交时被延迟外键拒绝（`23503`，约束 `fk_node_parent`）

**#17 子树移动单事务完成**
- When 一个事务内重排子树 path
- Then 提交时延迟外键通过，全部节点 `parent_path` 正确

**#18 重排不撞即时唯一约束**
- Given 兄弟节点 0010 / 0020
- When 用单条 `UPDATE ... SET path = CASE id ... END` 交换两者
- Then 成功（唯一性在语句结束时才检查）

**#19 path 格式与重复**
- When `path` 格式非法 / 同 Lineage path 重复 / 同人同 Lineage 第二个 primary
- Then 分别被拒绝

**#20 annotation 与人物节点**
- When `kind='annotation'` 带 person_id，或非 annotation 缺 person_id
- Then 被 CHECK 拒绝

**#21 删除 Lineage 级联范围**
- When 删除 Lineage
- Then node 级联删除；Person、Relation、Event、PersonName、Source 保留

**#22 Citation XOR**
- When 四个目标列零个或两个非空
- Then 被 CHECK 拒绝；`media_asset_id` 可独立存在

**#23 citation_person 视图**
- Given 四类目标各一条 citation
- When 查询 `app.citation_person`
- Then 四类目标都返回「一行一人」；跨租户查询返回空（`security_invoker` 生效）

**#24 BookCatalog 匹配**
- When `kind` 与 `article_id`/`lineage_id` 不匹配
- Then 被 CHECK 拒绝

**#25 BookRelease 生命周期**
- Given 一条 release
- When 直接 UPDATE 快照字段 / 直接 DELETE
- Then 分别被触发器（`GX003`）与权限拒绝；`revoke` 成功并写审计；非 owner `purge` 被 `GX006` 拒绝；owner `purge` 成功并写审计；`artifact_uri` 存在但对象缺失时 `purge` 抛 `GX011`

**#26 Book 删除前置**
- Given 存在任何 release（含已作废）
- When 删除 Book
- Then 被外键拒绝；全部 purge 后可删

**#27 AuditLog 只追加**
- When UPDATE / DELETE `audit_log`
- Then 被权限拒绝；组织级审计 `project_id IS NULL` 可写入

**#28 邀请兑换**
- Given 一条 pending 邀请，token 熵 ≥ 256 bit
- When 用正确 token 兑换 → Then 成员建立、状态 accepted、审计写入
- When 用错误/过期 token → Then `GX005`
- When 用他人 token 兑换（邮箱不一致）→ Then `GX009`
- When 同一 token 并发兑换两次 → Then 一次成功，一次 `GX010`

**#28a ✚ 邀请邮箱为 NULL 时校验不得被跳过**
- Given 登录用户的 `auth."user".email` 为 NULL
- When 兑换一条邮箱非空的邀请
- Then 抛 `GX009`（**不是**放行）——验证 `IS DISTINCT FROM` 而非 `<>` 🔧

**#28b ✚ 业务角色不得直接改邀请状态**
- Given `genealogy_app` 角色
- When `UPDATE invite SET status='accepted'`
- Then 权限不足（`42501`）——验证 §8.4 收回 `invite` 的 `UPDATE` 授权

**#29 重复 pending 邀请**
- When 同组织同邮箱重复 pending
- Then 被部分唯一索引拒绝；已接受的历史邀请不阻止再次邀请

**#30 RLS fail-closed 与连接池**
- When 不带 `app.user_id` 查询
- Then 返回空；连接池复用后不继承上一个事务的用户上下文

**#30a ✚ 非法 GUC 上下文必须 fail-closed**
- Given `app.user_id` 被设为 `'not-a-uuid'`
- When 查询任意受 RLS 保护的表
- Then 返回空，且 `app.current_user_id() IS NULL` 为 true；**不抛 `22P02`** 🔧

**#30b ✚ 通用计划下 RLS 仍 fail-closed**
- Given 同一 prepared statement 被不同租户上下文复用执行 ≥ 5 次
- When 每次设置不同的 `app.user_id`
- Then 每次返回的行数都严格对应该租户，无跨租户泄露（验证 `prepare: false` 的必要性）

**#30c ✚ 角色断言**
- Given 事务入口 `SET LOCAL ROLE genealogy_app` 未生效
- When 事务开始
- Then 断言失败并中止事务，不在错误权限下继续执行

**#31 updated_at 推进**
- When UPDATE 任意带 `updated_at` 的行
- Then `updated_at` 严格大于原值——**包括同一事务内的第二次 UPDATE**（`clock_timestamp()` 而非 `now()`）🔧

**#32 media_asset key 跨 Project**
- When 两个 Project 用同一个 `object_key`
- Then 被唯一索引拒绝

**#33 article_page**
- Given 默认 content
- Then 是合法 TipTap 文档；缺 `type` 的 JSON 被拒；乐观锁冲突返回 409

**#34 媒体引用保护**
- Given asset 被 person_media / article_page_media / source_citation 引用
- When 删除 asset
- Then 被 RESTRICT 拒绝；无引用后可删；字节在提交后删

**#35 主姓名唯一**
- When 同人第二个 `is_primary = true`
- Then 被部分唯一索引拒绝；同人同类型同值唯一

**#36 枚举生成物一致**
- When CI 跑 `gen:sql`
- Then `db/generated/enums.sql` 无 diff；`relation_kind_is_lineage_parent()` 与生成物一致；`ck_audit_log_entity_type` 取值 = 22 张表名

**#37 Drizzle 与数据库一致**
- Then 表数、CHECK 名单、唯一索引名单一致；**且 `uq_person_relation_sort_order` 不存在**

**#37a ✚ 编号零悬空零冲突**
- When 扫描全文所有 `DM-<域>-<序号>` 引用
- Then 每个编号在 §18 索引表中恰有一条定义，无一号两义，无引用未定义 🔧

**#38 软约束显式**
- When 组织归档
- Then 应用层拒绝新写入，数据库层不拦截（已声明的软约束，不是 bug）

**#39 Node 编排依据语义**
- When `placement_relation_id` 指向错误人物/类型
- Then 用例测试拦住（软不变量）

**#40 权限一致性**
- When 跑 `db/verify/permissions.sql`
- Then `rls_definer` 的权限集合与 §8.5 完全一致；`genealogy_app` 无 `book_release` 的 UPDATE/DELETE；**也无 `invite` 的 UPDATE/DELETE** 🔧

**#41 锁超时**
- Given 事务 A 持有 `yunpu:relation:<pid>` advisory lock
- When 事务 B 写同 Project 世系边
- Then 在 `lock_timeout`（3s）内失败并回滚（`55P03`），而不是无限等待

**#42 事件内容非空白**
- When `summary = ' '`（纯空白）、`date_text`/`place_text`/`summary` 全为空
- Then 被 CHECK 拒绝

**#43 ✚ 所有约束具名**
- When 扫描 `pg_constraint` 中 `public` schema 的全部约束
- Then 无匿名约束；`contype='n'` 的 `NOT NULL` 具名（PG 18 新能力）

**#44 ✚ FK 引用侧索引覆盖**
- When 跑 `db/verify/fk_indexes.sql`
- Then 37 条外键有支撑索引；18 条未覆盖项全部在白名单中且附理由；白名单与 `indexes.md` §11.2 逐条一致且未登记例外 = 0。

**#45 ✚ RLS 全表覆盖**
- When 跑 `db/verify/rls.sql`
- Then 22 张表全部 `rowsecurity = true` **且** `forcerowsecurity = true`；策略数 = 21

**#46 ✚ 生成列语义**
- When 跑 `db/verify/generated_columns.sql`
- Then `node.parent_path` 与 `book_catalog.parent_path` 为 STORED；断言虚拟 + `ltree` 会报 `0A000`

**#47 ✚ 错误码映射**
- Given 应用侧错误映射表
- When 触发 `RESTRICT` 违规（`23001`）与普通外键违规（`23503`）
- Then 映射到**不同的**应用错误；映射过程不解析消息文本

**#48 ✚ 视图 security_invoker**
- When 以非特权角色查询 `app.lineage_root` / `app.citation_person`
- Then 受调用者的 RLS 约束，跨租户数据不可见

**#49 ✚ `ON DELETE SET NULL` 列清单式**
- Given `article.folder_id` 指向某 folder
- When 删除该 folder
- Then `article.folder_id` 变 NULL，但 `organization_id` / `project_id` 不变（scope 不变量不被破坏）

**#50 ✚ 并发所有权转移**
- Given 两个事务同时转移同一组织的 owner
- When 同时提交
- Then 一个成功，一个 `GX010`（CAS 生效，无锁竞争死锁）

**#51 ✚ 出版产物字节纪律**
- Given `book_release.artifact_uri` 非空但对象不存在
- When owner `purge`
- Then 抛 `GX011`，行**不被**删除（状态不一致必须响亮）

**#52 ✚ 撤销邀请**
- Given 一条 pending 邀请
- When 组织管理员调用 `app.revoke_invite(id, '理由')`
- Then 状态变 `revoked`，写审计；非管理员调用抛 `GX006`；重复撤销抛 `GX005`

**#53 ✚ 连接池超时下发**
- Given PgBouncer 事务池化
- When 应用建立连接
- Then `lock_timeout` / `statement_timeout` / `idle_in_transaction_session_timeout` 由 `PGOPTIONS` 在服务端生效，而非应用侧 `SET`

---
