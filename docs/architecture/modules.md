# 源码目录与业务模块

> 本文件是「源码树、模块划分与依赖方向」的唯一权威；其他主题见 `docs/README.md` 导航，同一主题不复制表格。

### 4.2 源码目录结构


```
yunpu/
├─ apps/
│  ├─ api/                          Hono 服务（API + 静态资源）
│  │  ├─ src/
│  │  │  ├─ index.ts                Bun.serve 入口 + 启动自检
│  │  │  ├─ app.ts                  组装中间件与路由（链式，勿拆）
│  │  │  ├─ env.ts                  环境变量解析与校验（唯一读取方）
│  │  │  ├─ middleware/             request-context · auth · rate-limit
│  │  │  ├─ modules/                ← 业务域，见 §5
│  │  │  │  └─ <domain>/
│  │  │  │     ├─ router.ts       Hono 子路由（export default + export const routes）
│  │  │  │     ├─ service.ts      领域规则（唯一的规则所在）
│  │  │  │     ├─ queries.ts      只读查询
│  │  │  │     ├─ schema.ts       本域 Zod schema（引用 packages/shared）
│  │  │  │     └─ errors.ts       本域特有错误
│  │  │  ├─ middleware/             request-id · request-context · auth · rate-limit
│  │  │  ├─ db/                     连接池 · 事务 · RLS 上下文
│  │  │  ├─ lib/                    errors · logger · ids · openapi
│  │  │  └─ plugins/                第三方接入（对象存储等）
│  │  └─ test/                      路由与集成测试
│  └─ web/                          Vite + React SPA
│     ├─ src/
│     │  ├─ routes/                 TanStack Router 文件式路由
│     │  ├─ features/               ← 域内组件，域清单同 §5.3
│     │  ├─ components/             跨域通用件（UI / 画布 / 编辑器）
│     │  ├─ lib/                    api-client · query-keys · 格式化
│     │  └─ main.tsx
│     └─ public/
├─ packages/
│  ├─ db/                           Drizzle schema + 迁移 + 策略 + 函数
│  │  ├─ src/
│  │  │  ├─ schema/                 表定义（镜像数据模型）
│  │  │  ├─ policies/               RLS 策略与角色
│  │  │  ├─ functions/              SECURITY DEFINER 函数（SQL）
│  │  │  ├─ generated/              由枚举常量生成的 SQL
│  │  │  └─ client.ts               drizzle 实例 + withUser
│  ├─ shared/                       前后端唯一契约
│  │  ├─ src/
│  │  │  ├─ schemas/                Zod schema（手写 + drizzle-zod 派生）
│  │  │  ├─ domain/                 领域枚举与表清单（唯一来源）
│  │  │  ├─ permissions.ts          角色 → 权限矩阵（唯一来源）
│  │  │  └─ errors.ts               错误码与 AppError 层次
├─ scripts/                         门禁与生成脚本
│  │  ├─ gen-sql.ts                 枚举/表清单 → SQL 生成器
│  │  ├─ reorder-node-siblings.ts   谱系兄弟重排（单语句，见 DM §5.11）
│  │  └─ reconcile-media.ts         对象存储与 DB 的孤儿字节对账
├─ tests/                           跨包集成与 E2E
└─ docs/
```

**为什么是 monorepo**：`packages/db` 与 `packages/shared` 被 API 与 Web 同时依赖，是真实的复用边界；把 schema 复制两份是 DRY 灾难。**但不要过度**：只有一个前端、一个后端，不需要额外的 UI 包。

---

## 5. 领域模块划分

按业务能力划分，不按技术分层划分。`router/service/queries` 是模块**内部**的事，不是模块之间的划分方式。

| 模块           | 拥有的表                                                     | 职责                                 | 公开接口（其他模块只能调这些）                               |
| -------------- | ------------------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------ |
| `auth`         | `auth.*`（Better Auth）                                      | 注册、登录、会话、账号安全           | `getSession()`、`requireUser()`                              |
| `organization` | `organization`、`organization_member`、`invite`              | 组织、成员、邀请、所有权转移         | `requireOrganization()`、`acceptInvite()`、`transferOwner()` |
| `project`      | `project`、`folder`                                          | 项目与单层分类                       | `requireProject()`、`listFolders()`                          |
| `genealogy`    | `person`、`person_name`、`person_relation`、`event`、`lineage`、`node` | 人物事实、关系、事件、谱系与编纂位置 | `createPerson()`、`linkRelation()`、`placeNode()`、`getSubtree()` |
| `source`       | `source`、`source_citation`                                  | 来源与考证引用                       | `createSource()`、`cite()`、`listCitations()`                |
| `article`      | `article`、`article_page`                                    | 谱文与分页富文本                     | `createArticle()`、`savePage()`                              |
| `media`        | `media_asset`、`person_media`、`article_page_media`          | 媒体资产与人物/页面关联              | `uploadAsset()`、`attachToPerson()`、`attachToPage()`        |
| `book`         | `book`、`book_catalog`、`book_release`                       | 谱书、编目树、出版快照               | `createBook()`、`getCatalog()`、`release()`、`revoke()`      |
| `audit`        | `audit_log`                                                  | 写操作留痕（平台服务，不是业务域）   | `record()`                                                   |

- **8 个模块（含 `auth`），其中 7 个业务域**，符合复杂度预算。
- `audit` 是横切平台服务，不对应业务能力，不计入 8 个模块。
- **每个域的 `router.ts` 是一个独立的 `Hono` 实例**，`export default app` + `export const routes`；顶层 `app.ts` 用 `app.route()` 链式挂载。这是 Hono 官方对大型应用的推荐结构，也是 RPC 类型推断能生效的前提（§8.1）。

> `ARCH-MOD-01`（1.1 修正）：模块清单**只有一份**——`src/domain/enums.ts` 的 `MODULES` 常量。本文档 §5、前端 `features/` 目录说明、数据模型 §3.1 的「归属模块」列全部由它生成或引用。旧版 §4 的目录树漏列 `media`、§9.3 列了 7 个域，与本表的 7 个业务域不一致——**重复清单是 bug，当场应验**。CI 加一条检查：文档与代码中的域清单与 `MODULES` 一致。

### 5.1 模块内部结构

```
modules/genealogy/
├─ router.ts        路由定义（薄胶水，只做校验与错误映射）
├─ service.ts       领域规则（唯一的规则所在）
├─ queries.ts       只读查询（复杂读走这里，不要塞进 service）
├─ schema.ts        本域 Zod schema（引用 packages/shared）
├─ errors.ts        本域特有错误（继承 AppError）
└─ *.test.ts        单元测试
```

### 5.2 依赖方向

```
router.ts  →  service.ts  →  db
     ↓            ↓
 shared/      shared/
```

- `router.ts` **不得** import `db`（必须经 service），否则 SQL 会散进 HTTP 层。
- `service.ts` **不得** import 任何 HTTP 类型（`Context`、`Response`）。
- 跨模块调用**只能**走对方模块的 service 导出函数，不得直接查对方的表。
- 一个表只能被一个模块写；跨模块读取走 service 或只读视图。
- `audit` 只能被追加，不能被业务模块修改或删除。

### 5.3 用 Biome 强制，而不是靠自觉

```jsonc
// biome.json（节选）
{
  "overrides": [
    {
      "include": ["apps/api/src/modules/**/router.ts"],
      "linter": { "rules": { "correctness": { "noRestrictedImports": {
        "patterns": [{ "group": ["**/db/**", "drizzle-orm"], "message": "路由层不得直接访问数据库，走 service" }]
      } } } }
    },
    {
      "include": ["apps/api/src/modules/**/service.ts", "packages/db/**"],
      "linter": { "rules": { "correctness": { "noRestrictedImports": {
        "patterns": [{ "group": ["hono", "hono/**"], "message": "领域层与数据层不感知 HTTP" }]
      } } } }
    },
    {
      "include": ["apps/web/src/**"],
      "linter": { "rules": { "correctness": { "noRestrictedImports": {
        "patterns": [{ "group": ["drizzle-orm", "**/db/**"], "message": "客户端不得依赖数据库" }]
      } } } }
    }
  ]
}
```

Biome 的 `overrides` 对同名 `noRestrictedImports` **不合并 options**：一个文件命中多个 override 时，后匹配的组会整体替换前面的禁物清单。因此分区必须互斥，每个分区自带该目录被禁的全部 import；用交叉探针测试「拦得住且无误伤」。

---
