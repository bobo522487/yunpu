# Technical Plan: [Feature Name]

> **前置要求**：制定方案前必须先阅读受影响模块现有代码、`docs/constitution.md`、`docs/architecture.md`、`docs/coding-standards.md` 与 `docs/glossary.md`。所有设计必须可追溯至 `spec.md` 中的 `FR-xxx`；完成后等待人工审核，再拆解任务或编码。

## 1. 上下文与复用分析

- **关联 Spec**：[spec.md](./spec.md)
- **复用现有模块**：[列出复用的 `apps/api/src/modules/*`、`withTenantTransaction`、`access.ts`、`packages/shared` 等]
- **新增/修改范围**：[列出需要新增或修改的目录与文件]

## 2. 模块职责与依赖关系

- [各模块的职责划分与调用链：`router` → `service` → `queries`，遵守 `biome.json` 导入边界]

## 3. 数据模型与数据库变更

- [表结构、字段、约束（`CHECK`/`UNIQUE`/外键/触发器/RLS 策略）、`packages/db/migrations/` 迁移号及 Drizzle schema 变更]
- [追溯：`FR-xxx`]

## 4. API Contract

- [路由路径、HTTP 方法、Zod 请求/响应 Schema（`packages/shared`）、`AppType` 导出影响]
- [追溯：`FR-xxx`]

## 5. 异常处理、事务与并发控制

- [事务边界（`withTenantTransaction`）、重试/冲突处理（`23505`/`VERSION_CONFLICT`）、`SQLSTATE` 到 `ErrorCode` 映射]

## 6. 安全性、性能与兼容性

- [FORCE RLS 与 `access.ts` 权限校验（非成员 404 / 权限不足 403）、索引与查询复杂度、向后兼容说明]

## 7. 技术风险与取舍

- [存在争议的设计选择、替代方案与权衡理由；若涉及核心架构变更，记录对应 `docs/adr/ADR-XXXX-*.md`]
