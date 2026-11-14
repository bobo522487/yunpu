# API 端点表

> 本文件是「端点形状、请求响应与逐端点约束」的唯一权威；其他主题见 `docs/README.md` 导航，同一主题不复制表格。
>
> **Phase 0 处置**：C1（Zod schema 名）、C2（状态码）、C3（权限名）、C4（分页参数）、C5（限流）、C6（通用幂等）、C8（端点清单）、C9（错误映射）均已定值；C7（批量端点）维持 V1 不做。本表的端点路径、权限名与关键状态码均为 V1 定值；未列出的端点视为 V1 不做。

## 2. 端点表

**通用约定**

- 路径参数一律经 `zValidator('param', <Entity>IdParamsSchema)` 校验；请求体 schema 名按 C1 的 `<动词><实体>Schema` 规则置于 `packages/shared/src/schemas`。
- 删除成功返回 `200` 与 `{ ok: true, data: { deleted: true } }`；不使用 `204`（C2 不引入新状态码）。
- 未登录访问受保护端点返回 `401`；权限不足返回 `403`；目标不存在或无权访问统一返回 `404`，不泄漏存在性（`FR-TEN-03`）。
- 分页端点使用 `cursor` / `limit`（默认 50、上限 200），响应为 `{ ok: true, data: { items, nextCursor } }`，见 [conventions.md](conventions.md) 的分页约定。
- 请求体大小、超时与限流见 [conventions.md](conventions.md)。

### 2.1 认证与账号

| 方法    | 路径                       | 用途                       | 请求体来源（Zod schema） | 权限要求                       | 关键状态码                    |
| ------- | -------------------------- | -------------------------- | ------------------------ | ------------------------------ | ----------------------------- |
| `POST`  | `/api/v1/auth/sign-in`     | 登录                       | `SignInSchema`           | 公开端点                       | 200；400 / 401 / 429          |
| `POST`  | `/api/v1/auth/sign-up`     | 注册                       | `SignUpSchema`           | 公开端点                       | 201；400 / 409 / 429          |
| `POST`  | `/api/v1/auth/sign-out`    | 登出当前会话               | —                        | 需登录                         | 200；401                      |
| `GET`   | `/api/v1/auth/session`     | 当前会话与默认组织         | —                        | 公开端点（未登录返回 `user: null`） | 200                       |
| `GET`   | `/api/v1/account`          | 读取自己的账号资料         | —                        | `account.read`（本人）         | 200；401                      |
| `PATCH` | `/api/v1/account`          | 修改自己的资料             | `UpdateAccountSchema`    | `account.write`（本人）        | 200；400 / 401                |
| `POST`  | `/api/v1/account/password` | 修改密码                   | `ChangePasswordSchema`   | `account.write`（本人）        | 200；400 / 401                |

> 本批次不提供账号删除端点；账号停用与删除属于后续批次。登录失败限流与注册配额见 [conventions.md](conventions.md) §1.11。

### 2.2 组织、成员与邀请

| 方法     | 路径                                                      | 用途                                        | 请求体来源（Zod schema） | 权限要求                                                     | 关键状态码                       |
| -------- | --------------------------------------------------------- | ------------------------------------------- | ------------------------ | ------------------------------------------------------------ | -------------------------------- |
| `GET`    | `/api/v1/organizations`                                   | 我的组织列表（仅 active）                   | —                        | 需登录                                                       | 200；401                         |
| `POST`   | `/api/v1/organizations`                                   | 创建组织（同一事务内插组织 + owner 成员行） | `CreateOrganizationSchema` | `organization.create`（登录即可）                            | 201；400 / 401                   |
| `GET`    | `/api/v1/organizations/:organizationId`                   | 组织详情                                    | —                        | `organization.read`                                          | 200；401 / 403 / 404             |
| `PATCH`  | `/api/v1/organizations/:organizationId`                   | 改名或归档                                  | `UpdateOrganizationSchema` | 改名 `organization.update`；归档 `organization.archive`；`owner_user_id` **不可**由此路径修改 | 200；400 / 401 / 403 / 404 / 409 |
| `POST`   | `/api/v1/organizations/:organizationId/activate`          | 把组织设为当前账号的默认组织                | —                        | `organization.read`（本人成员关系）                          | 200；401 / 404                   |
| `POST`   | `/api/v1/organizations/:organizationId/leave`             | 当前账号退出组织                            | —                        | `organization.read`（本人成员关系）；owner 必须先转移所有权 | 200；401 / 404 / 409             |
| `GET`    | `/api/v1/organizations/:organizationId/members`           | 成员列表                                    | —                        | `organization.member.read`                                   | 200；401 / 403 / 404             |
| `PATCH`  | `/api/v1/organizations/:organizationId/members/:userId`   | 修改成员角色                                | `UpdateMemberRoleSchema` | `organization.member.write`；不能改动 owner 的角色          | 200；400 / 401 / 403 / 404 / 409 |
| `DELETE` | `/api/v1/organizations/:organizationId/members/:userId`   | 移除成员                                    | —                        | `organization.member.write`；不能移除 owner                  | 200；401 / 403 / 404 / 409       |
| `GET`    | `/api/v1/organizations/:organizationId/invites`           | 邀请列表                                    | —                        | `organization.invite.read`                                   | 200；401 / 403 / 404             |
| `POST`   | `/api/v1/organizations/:organizationId/invites`           | 创建邀请                                    | `CreateInviteSchema`     | `organization.invite.create`；邀请不能授予 owner            | 201；400 / 401 / 403 / 404 / 409 |
| `DELETE` | `/api/v1/organizations/:organizationId/invites/:inviteId` | 撤销待处理邀请                              | —                        | `organization.invite.revoke`                                 | 200；401 / 403 / 404 / 409       |
| `PUT`    | `/api/v1/organizations/:organizationId/owner`             | 转移所有权（CAS 条件更新）                  | `TransferOwnerSchema`    | `organization.transfer_ownership`（ownerOnly）；新 owner 必须已是成员 | 200；400 / 401 / 403 / 404 / 409 |
| `POST`   | `/api/v1/invites/accept`                                  | 兑换邀请（明文 token 只出现一次）           | `AcceptInviteSchema`     | `invite.accept`（需登录 + 邮箱一致）                          | 200；400 / 401 / 403 / 404 / 409 / 429 |

> 说明：邀请兑换路径已定值为 `POST /api/v1/invites/accept`。它需要登录，但属于公开范围内的「未登录先注册/登录」流程；邮箱不一致返回 `INVITE_EMAIL_MISMATCH`（`GX009`），已兑换/并发失败返回 `GX010`。
> 来源：plan.md（重构前基线定位符，见 git 历史 `5cbb72b`） §8.9、§10、§11.4

### 2.3 项目与分类

| 方法     | 路径                                             | 用途     | 请求体来源（Zod schema） | 权限要求         | 关键状态码                       |
| -------- | ------------------------------------------------ | -------- | ------------------------ | ---------------- | -------------------------------- |
| `GET`    | `/api/v1/organizations/:organizationId/projects` | 项目列表 | —                        | `project.read`   | 200；401 / 403 / 404             |
| `POST`   | `/api/v1/organizations/:organizationId/projects` | 创建项目 | `CreateProjectSchema`    | `project.create` | 201；400 / 401 / 403 / 404       |
| `GET`    | `/api/v1/projects/:projectId`                    | 项目详情 | —                        | `project.read`   | 200；401 / 403 / 404             |
| `PATCH`  | `/api/v1/projects/:projectId`                    | 编辑项目 | `UpdateProjectSchema`    | `project.update` | 200；400 / 401 / 403 / 404 / 409 |
| `DELETE` | `/api/v1/projects/:projectId`                    | 删除项目 | —                        | `project.delete` | 200；401 / 403 / 404 / 409       |
| `GET`    | `/api/v1/projects/:projectId/folders`            | 分类列表 | —                        | `folder.read`    | 200；401 / 403 / 404             |
| `POST`   | `/api/v1/projects/:projectId/folders`            | 创建分类 | `CreateFolderSchema`     | `folder.write`   | 201；400 / 401 / 403 / 404 / 409 |
| `PATCH`  | `/api/v1/folders/:folderId`                      | 编辑分类 | `UpdateFolderSchema`     | `folder.write`   | 200；400 / 401 / 403 / 404 / 409 |
| `DELETE` | `/api/v1/folders/:folderId`                      | 删除分类 | —                        | `folder.delete`  | 200；401 / 403 / 404             |

> 来源：plan.md（重构前基线定位符，见 git 历史 `5cbb72b`） §8.9

### 2.4 谱系与节点

| 方法     | 路径                                        | 用途                                                       | 请求体来源（Zod schema） | 权限要求         | 关键状态码                       |
| -------- | ------------------------------------------- | ---------------------------------------------------------- | ------------------------ | ---------------- | -------------------------------- |
| `GET`    | `/api/v1/projects/:projectId/lineages`      | 谱系列表                                                   | —                        | `lineage.read`   | 200；401 / 403 / 404             |
| `POST`   | `/api/v1/projects/:projectId/lineages`      | 创建谱系                                                   | `CreateLineageSchema`    | `lineage.write`  | 201；400 / 401 / 403 / 404 / 409 |
| `GET`    | `/api/v1/lineages/:lineageId`               | 谱系详情                                                   | —                        | `lineage.read`   | 200；401 / 403 / 404             |
| `PATCH`  | `/api/v1/lineages/:lineageId`               | 编辑谱系                                                   | `UpdateLineageSchema`    | `lineage.write`  | 200；400 / 401 / 403 / 404 / 409 |
| `DELETE` | `/api/v1/lineages/:lineageId`               | 删除谱系                                                   | —                        | `lineage.delete` | 200；401 / 403 / 404 / 409       |
| `GET`    | `/api/v1/lineages/:lineageId/nodes`         | 节点列表（按 `path` 排序，按父路径查子节点，不用游标分页） | —                        | `node.read`      | 200；401 / 403 / 404             |
| `POST`   | `/api/v1/lineages/:lineageId/nodes`         | 建节点                                                     | `CreateNodeSchema`       | `node.write`     | 201；400 / 401 / 403 / 404 / 409 |
| `GET`    | `/api/v1/lineages/:lineageId/nodes/:nodeId` | 节点详情                                                   | —                        | `node.read`      | 200；401 / 403 / 404             |
| `PATCH`  | `/api/v1/nodes/:nodeId`                     | 修改节点                                                   | `UpdateNodeSchema`       | `node.write`     | 200；400 / 401 / 403 / 404 / 409 |
| `DELETE` | `/api/v1/nodes/:nodeId`                     | 删除子树                                                   | —                        | `node.delete`    | 200；401 / 403 / 404 / 409       |

> 来源：plan.md（重构前基线定位符，见 git 历史 `5cbb72b`） §8.9、§8.1、§11.2

### 2.5 人物与姓名

| 方法     | 路径                                  | 用途                                 | 请求体来源（Zod schema） | 权限要求        | 关键状态码                       |
| -------- | ------------------------------------- | ------------------------------------ | ------------------------ | --------------- | -------------------------------- |
| `GET`    | `/api/v1/projects/:projectId/persons` | 人物列表（keyset 分页，游标 = `id`） | —                        | `person.read`   | 200；401 / 403 / 404             |
| `POST`   | `/api/v1/projects/:projectId/persons` | 创建人物                             | `CreatePersonSchema`     | `person.write`  | 201；400 / 401 / 403 / 404       |
| `GET`    | `/api/v1/persons/:personId`           | 人物详情                             | —                        | `person.read`   | 200；401 / 403 / 404             |
| `PATCH`  | `/api/v1/persons/:personId`           | 编辑人物                             | `UpdatePersonSchema`     | `person.write`  | 200；400 / 401 / 403 / 404       |
| `DELETE` | `/api/v1/persons/:personId`           | 删除人物（**不删除**媒体资产）       | —                        | `person.delete` | 200；401 / 403 / 404 / 409       |
| `GET`    | `/api/v1/persons/:personId/names`     | 姓名列表                             | —                        | `person.read`   | 200；401 / 403 / 404             |
| `POST`   | `/api/v1/persons/:personId/names`     | 新增姓名                             | `CreatePersonNameSchema` | `person.write`  | 201；400 / 401 / 403 / 404 / 409 |
| `PATCH`  | `/api/v1/names/:nameId`               | 编辑姓名                             | `UpdatePersonNameSchema` | `person.write`  | 200；400 / 401 / 403 / 404 / 409 |
| `DELETE` | `/api/v1/names/:nameId`               | 删除姓名                             | —                        | `person.write`  | 200；401 / 403 / 404 / 409       |

> `person.write` 覆盖 `person` 与 `person_name`；唯一主姓名冲突返回 `409`。
> 来源：plan.md（重构前基线定位符，见 git 历史 `5cbb72b`） §8.9、§8.7、§12.1

### 2.6 关系

| 方法     | 路径                                  | 用途       | 请求体来源（Zod schema） | 权限要求          | 关键状态码                                                   |
| -------- | ------------------------------------- | ---------- | ------------------------ | ----------------- | ------------------------------------------------------------ |
| `GET`    | `/api/v1/persons/:personId/relations` | 关系边列表 | —                        | `relation.read`   | 200；401 / 403 / 404                                         |
| `POST`   | `/api/v1/persons/:personId/relations` | 新增关系   | `CreateRelationSchema`   | `relation.write`  | 201；400 / 401 / 403 / 404；祖先环 → `GX001` → 409；对称顺序错误 → 400 |
| `PATCH`  | `/api/v1/relations/:relationId`       | 编辑关系   | `UpdateRelationSchema`   | `relation.write`  | 200；400 / 401 / 403 / 404；祖先环 → `GX001` → 409          |
| `DELETE` | `/api/v1/relations/:relationId`       | 删除关系   | —                        | `relation.delete` | 200；401 / 403 / 404                                         |

> 来源：plan.md（重构前基线定位符，见 git 历史 `5cbb72b`） §8.9、§11.3

### 2.7 事件

| 方法     | 路径                               | 用途     | 请求体来源（Zod schema） | 权限要求       | 关键状态码                       |
| -------- | ---------------------------------- | -------- | ------------------------ | -------------- | -------------------------------- |
| `GET`    | `/api/v1/persons/:personId/events` | 事件列表 | —                        | `event.read`   | 200；401 / 403 / 404             |
| `POST`   | `/api/v1/persons/:personId/events` | 新增事件 | `CreateEventSchema`      | `event.write`  | 201；400 / 401 / 403 / 404       |
| `PATCH`  | `/api/v1/events/:eventId`          | 编辑事件 | `UpdateEventSchema`      | `event.write`  | 200；400 / 401 / 403 / 404       |
| `DELETE` | `/api/v1/events/:eventId`          | 删除事件 | —                        | `event.delete` | 200；401 / 403 / 404             |

> 来源：plan.md（重构前基线定位符，见 git 历史 `5cbb72b`） §8.9

### 2.8 来源与考证引用

| 方法     | 路径                                    | 用途         | 请求体来源（Zod schema） | 权限要求          | 关键状态码                       |
| -------- | --------------------------------------- | ------------ | ------------------------ | ----------------- | -------------------------------- |
| `GET`    | `/api/v1/projects/:projectId/sources`   | 来源列表     | —                        | `source.read`     | 200；401 / 403 / 404             |
| `POST`   | `/api/v1/projects/:projectId/sources`   | 新增来源     | `CreateSourceSchema`     | `source.write`    | 201；400 / 401 / 403 / 404       |
| `PATCH`  | `/api/v1/sources/:sourceId`             | 编辑来源     | `UpdateSourceSchema`     | `source.write`    | 200；400 / 401 / 403 / 404       |
| `DELETE` | `/api/v1/sources/:sourceId`             | 删除来源     | —                        | `source.delete`   | 200；401 / 403 / 404 / 409       |
| `GET`    | `/api/v1/projects/:projectId/citations` | 考证引用列表 | —                        | `citation.read`   | 200；401 / 403 / 404             |
| `POST`   | `/api/v1/projects/:projectId/citations` | 新增考证引用 | `CreateCitationSchema`   | `citation.write`  | 201；400 / 401 / 403 / 404       |
| `PATCH`  | `/api/v1/citations/:citationId`         | 编辑考证引用 | `UpdateCitationSchema`   | `citation.write`  | 200；400 / 401 / 403 / 404       |
| `DELETE` | `/api/v1/citations/:citationId`         | 删除考证引用 | —                        | `citation.delete` | 200；401 / 403 / 404             |

> 来源：plan.md（重构前基线定位符，见 git 历史 `5cbb72b`） §8.9

### 2.9 谱文（文章与分页富文本）

| 方法     | 路径                                        | 用途                                        | 请求体来源（Zod schema） | 权限要求         | 关键状态码                       |
| -------- | ------------------------------------------- | ------------------------------------------- | ------------------------ | ---------------- | -------------------------------- |
| `GET`    | `/api/v1/projects/:projectId/articles`      | 谱文列表                                    | —                        | `article.read`   | 200；401 / 403 / 404             |
| `POST`   | `/api/v1/projects/:projectId/articles`      | 新建谱文                                    | `CreateArticleSchema`    | `article.write`  | 201；400 / 401 / 403 / 404       |
| `GET`    | `/api/v1/articles/:articleId`               | 谱文详情                                    | —                        | `article.read`   | 200；401 / 403 / 404             |
| `PATCH`  | `/api/v1/articles/:articleId`               | 编辑谱文                                    | `UpdateArticleSchema`    | `article.write`  | 200；400 / 401 / 403 / 404       |
| `DELETE` | `/api/v1/articles/:articleId`               | 删除谱文（**不自动删除**媒体资产）          | —                        | `article.delete` | 200；401 / 403 / 404 / 409       |
| `POST`   | `/api/v1/articles/:articleId/pages`         | 新建分页                                    | `CreateArticlePageSchema` | `article.write`  | 201；400 / 401 / 403 / 404 / 409 |
| `PUT`    | `/api/v1/articles/:articleId/pages/:pageId` | 保存分页富文本（**乐观锁**，`version` CAS） | `SaveArticlePageSchema`  | `article.write`  | 200；400 / 401 / 403 / 404；版本冲突 → 409 |
| `DELETE` | `/api/v1/articles/:articleId/pages/:pageId` | 删除分页                                    | —                        | `article.delete` | 200；401 / 403 / 404             |

> 来源：plan.md（重构前基线定位符，见 git 历史 `5cbb72b`） §8.9、§11.1、§12.1

### 2.10 谱书与编目

| 方法     | 路径                                | 用途         | 请求体来源（Zod schema） | 权限要求        | 关键状态码                       |
| -------- | ----------------------------------- | ------------ | ------------------------ | --------------- | -------------------------------- |
| `GET`    | `/api/v1/projects/:projectId/books` | 谱书列表     | —                        | `book.read`     | 200；401 / 403 / 404             |
| `POST`   | `/api/v1/projects/:projectId/books` | 新建谱书     | `CreateBookSchema`       | `book.write`    | 201；400 / 401 / 403 / 404       |
| `GET`    | `/api/v1/books/:bookId`             | 谱书详情     | —                        | `book.read`     | 200；401 / 403 / 404             |
| `PATCH`  | `/api/v1/books/:bookId`             | 编辑谱书     | `UpdateBookSchema`       | `book.write`    | 200；400 / 401 / 403 / 404       |
| `DELETE` | `/api/v1/books/:bookId`             | 删除谱书     | —                        | `book.delete`   | 200；401 / 403 / 404 / 409       |
| `GET`    | `/api/v1/books/:bookId/catalog`     | 编目树列表   | —                        | `book.read`     | 200；401 / 403 / 404             |
| `POST`   | `/api/v1/books/:bookId/catalog`     | 新增编目项   | `CreateCatalogItemSchema` | `book.write`    | 201；400 / 401 / 403 / 404 / 409 |
| `PATCH`  | `/api/v1/catalog/:catalogId`        | 编辑编目项   | `UpdateCatalogItemSchema` | `book.write`    | 200；400 / 401 / 403 / 404 / 409 |
| `DELETE` | `/api/v1/catalog/:catalogId`        | 删除编目项   | —                        | `book.delete`   | 200；401 / 403 / 404 / 409       |

> `book.write` 覆盖 `book` 与 `book_catalog`；有出版版本的谱书不能删除。
> 来源：plan.md（重构前基线定位符，见 git 历史 `5cbb72b`） §8.9

### 2.11 出版（快照）

| 方法   | 路径                                 | 用途                                                         | 请求体来源（Zod schema） | 权限要求                                                     | 关键状态码                                             |
| ------ | ------------------------------------ | ------------------------------------------------------------ | ------------------------ | ------------------------------------------------------------ | ------------------------------------------------------ |
| `GET`  | `/api/v1/books/:bookId/releases`     | 出版快照列表                                                 | —                        | `release.read`                                               | 200；401 / 403 / 404                                   |
| `POST` | `/api/v1/books/:bookId/releases`     | **同步**生成出版快照（编目节点 ≤ 2 000、文章页 ≤ 5 000；服务端 120s / 客户端 180s） | `CreateReleaseSchema`    | `release.create`                                             | 201；400 / 401 / 403 / 404 / 413 / 504                 |
| `POST` | `/api/v1/releases/:releaseId/revoke` | 作废版本（快照不可修改）                                     | `RevokeReleaseSchema`    | `release.revoke`                                             | 200；400 / 401 / 403 / 404；重复作废 → `GX007` → 409   |
| `POST` | `/api/v1/releases/:releaseId/purge`  | 清除出版版本（**仅组织所有者**）                             | —                        | `release.purge`（ownerOnly）                                 | 200；401 / 403（`GX006`）/ 404；状态不允许 → `GX007` → 409；产物缺失 → `GX011` → 500 |

> 来源：plan.md（重构前基线定位符，见 git 历史 `5cbb72b`） §8.9、§11.6、§7.5、§8.3

### 2.12 媒体

| 方法     | 路径                                                                      | 用途                                                         | 请求体来源（Zod schema） | 权限要求                                                    | 关键状态码                       |
| -------- | ------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------ | ----------------------------------------------------------- | -------------------------------- |
| `POST`   | `/api/v1/projects/:projectId/media-assets`                                | 上传媒体（服务端代理；`bodyLimit` 10 MB；计算 SHA-256）      | `UploadMediaSchema`（multipart） | `media.write`；`object_key` 由服务端生成，客户端不能指定 | 201；400 / 401 / 403 / 404 / 413 |
| `GET`    | `/api/v1/media-assets/:mediaAssetId`                                      | 鉴权下载                                                     | —                        | `media.read`                                                | 200；401 / 403 / 404             |
| `DELETE` | `/api/v1/media-assets/:mediaAssetId`                                      | 删除媒体（被引用时先解绑）                                   | —                        | `media.delete`                                              | 200；401 / 403 / 404 / 409       |
| `POST`   | `/api/v1/persons/:personId/media-assets`                                  | 关联媒体到人物                                               | `AttachMediaSchema`      | `media.write`                                               | 201；400 / 401 / 403 / 404 / 409 |
| `DELETE` | `/api/v1/persons/:personId/media-assets/:mediaAssetId`                    | 解除人物与媒体的关联                                         | —                        | `media.delete`                                              | 200；401 / 403 / 404             |
| `POST`   | `/api/v1/articles/:articleId/pages/:pageId/media-assets`                  | 关联媒体到谱文页                                             | `AttachMediaSchema`      | `media.write`                                               | 201；400 / 401 / 403 / 404 / 409 |
| `DELETE` | `/api/v1/articles/:articleId/pages/:pageId/media-assets/:mediaAssetId`   | 解除谱文页与媒体的关联                                       | —                        | `media.delete`                                              | 200；401 / 403 / 404             |

> `media.write` 覆盖上传与关联；`media.delete` 覆盖删除媒体与解除关联。媒体字节在事务提交后删除，见数据模型的删除语义。
> 来源：plan.md（重构前基线定位符，见 git 历史 `5cbb72b`） §8.9、§12.1、§15.1.2

### 2.13 探活与文档

| 方法  | 路径          | 用途                                             | 请求体来源（Zod schema） | 权限要求   | 关键状态码 |
| ----- | ------------- | ------------------------------------------------ | ------------------------ | ---------- | ---------- |
| `GET` | `/api/health` | 探活（只检查进程与数据库连通性，不检查对象存储） | —                        | 公开端点   | 200 / 503  |
| `GET` | `/api/ready`  | 环境就绪（进程、数据库、对象存储三项，且数据库代际为 PostgreSQL 18） | —       | 公开端点   | 200 / 503  |
| `GET` | `/api/docs`   | Scalar 渲染的 OpenAPI 文档（`app.doc()` 输出）   | —                        | 公开端点；生产环境可关闭 | 200        |

> 说明：`/api/health` 与 `/api/ready` 分工——前者只证明进程活着、数据库可连通；后者证明整个环境可用。两者都不计入限流配额。
> 来源：plan.md（重构前基线定位符，见 git 历史 `5cbb72b`） §8.9、§13、`ARCH-HONO-06`；specs/001-dev-test-environment/contracts/readiness.md

### 2.14 审计

| 方法  | 路径                                                    | 用途                     | 请求体来源（Zod schema）   | 权限要求     | 关键状态码             |
| ----- | ------------------------------------------------------- | ------------------------ | -------------------------- | ------------ | ---------------------- |
| `GET` | `/api/v1/organizations/:organizationId/audit-logs`      | 组织审计日志列表（只读） | `ListAuditLogsQuerySchema` | `audit.read` | 200；400 / 401 / 403 / 404 |

- 查询参数：`cursor`、`limit`（默认 50、上限 200）、`action`、`entity_type`、`entity_id`、`actor_user_id`、`from`、`to`；分页按通用约定。
- 返回按 `created_at` 倒序；只返回当前账号可见组织的日志。
- 没有审计更新 / 删除端点；`audit_log` 只追加（`GX004`）。
- 强审计与尽力而为审计的边界见数据模型的审计分级；本端点只读，不改变审计写入路径。

> 来源：plan.md（重构前基线定位符，见 git 历史 `5cbb72b`） §12.2

---

## 3. V1 明确不提供的端点

- `DELETE /api/v1/account`：账号删除 / 停用不在 V1。
- `DELETE /api/v1/organizations/:organizationId`：组织只归档，不物理删除。
- `PUT/DELETE /api/v1/audit-logs/:id`：审计只追加。
- 批量导入 / 批量写入端点：见 C7。
- 通用 `Idempotency-Key` 机制：C6 已定值为 V1 不启用；重复提交按各端点的自然键与条件更新处理。

> 未列出的端点视为 V1 不做；新增端点必须回到本表登记，并在 [stack.md](../stack.md) 的 Phase 0 结论中说明是否引入新契约项。
