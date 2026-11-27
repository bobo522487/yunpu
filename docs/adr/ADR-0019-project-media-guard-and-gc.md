---
status: accepted
---

# ADR-0019: 项目媒体文件头魔数校验、防嗅探响应头与带宽限期离线对账 GC

## Context

`ADR-0018` 落地了已鉴权的项目媒体端点（`POST /api/v1/projects/:projectId/media` 与 `GET /api/v1/projects/:projectId/media/:fileName`），但存在两类安全与运维隐患：

1. **上传仅校验请求头 `Content-Type` 与下载缺少显式防嗅探头**：恶意客户端可伪造 `Content-Type: image/png` 上传 HTML/SVG/脚本等非图片载荷，或上传与声明类型不一致的文件头。
2. **孤立对象清理策略**：人物更换或清空 `avatar_key`、或上传后未提交人物保存时，S3 `projects/<projectId>/` 下会遗留未引用对象；若在业务写事务提交后异步删除 S3 对象，会引入跨 PostgreSQL 与 S3 的双写一致性风险与事务边界破坏（见 `docs/architecture.md` 第五节）。

## Decision

1. **真实字节魔数校验（`apps/api/src/modules/project/service.ts` & `router.ts`）**：
   - 上传时除校验 `Content-Type` 属于 `image/png`、`image/jpeg`、`image/webp`、`image/gif` 外，必须解析请求体前导字节签名（PNG 8 字节签名、JPEG `FF D8 FF`、WEBP `RIFF....WEBP`、GIF `GIF87a`/`GIF89a`）。
   - 非上述四种签名或签名与声明 `Content-Type` 不匹配时，一律拒绝写入 S3 并返回 `400 VALIDATION`。
2. **下载显式防嗅探响应头**：
   - `GET /api/v1/projects/:projectId/media/:fileName` 显式输出 `X-Content-Type-Options: nosniff`、`Content-Security-Policy: default-src 'none'; sandbox` 与 `Content-Disposition: inline; filename="..."`，阻断浏览器 MIME 嗅探与脚本执行。
3. **带宽限期的离线/定时安全对账 GC（`apps/api/src/modules/project/media-gc.ts` & `scripts/gc-media.ts`）**：
   - 不在 HTTP 写路径事务提交后执行外部对象异步删除；改由独立命令行/定时任务 `pnpm gc:media`（`scripts/gc-media.ts`）先分页扫描 S3 `projects/` 前缀，再在 `BEGIN READ ONLY` 事务中汇总全库 `public.person.avatar_key` 引用，仅删除「无数据库引用且距 `LastModified` 超过可配置宽限期（默认 24 小时）」的孤立对象，并支持 `--dry-run` 预演。
   - **第四处非租户事务例外登记**：由于 `public.person` 启用了 `FORCE ROW LEVEL SECURITY`，普通租户角色 `genealogy_app` 只能读取单一用户可见的组织，若误用于全局对账会导致未可见租户的头像被误判为孤立对象。因此 `scripts/gc-media.ts` 登记为 `docs/architecture.md` 第四处非租户事务入口：强制使用 `GC_DATABASE_URL` 或 `MIGRATE_DATABASE_URL`，并在查询前显式校验当前数据库角色具备 `BYPASSRLS` 或超级用户权限，否则立即中止并报错。

## Consequences

- 上传伪造 `Content-Type` 或畸形载荷在写入对象存储前被拦截，下载响应自带纵深防嗅探与沙箱隔离。
- 业务请求事务边界保持纯粹，没有事务后异步删 S3 的半失败状态；并发上传尚未入库的新对象受宽限期保护，不会被误删。
- 新增运维入口 `pnpm gc:media`（支持 `--dry-run`、`--grace-hours`、`--grace-ms`、`--prefix`、`--env`）。

## Status

Accepted & Implemented。
