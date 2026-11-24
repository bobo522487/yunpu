# Contract: 人物与关系边 API

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md) | **Date**: 2026-11-24

基础路径：`/api/v1/projects/:projectId`。均需登录；组织上下文取自会话/默认组织或约定头；越权 → 404 语义。错误形状见 [runtime-hardening.md](runtime-hardening.md)。

## 1. 创建人物 `POST …/persons`

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `displayName` | string | 是 | 非空白；写入 primary `person_name` |
| `sex` | string | 否 | 默认 `unknown` |
| `surname` | string | 否 | |
| `birthYear` | number | 否 | |
| `deathYear` | number | 否 | |
| `isLiving` | boolean | 否 | 默认 `true` |

**Success `201`**: `{ ok: true, data: { person: PersonView } }`

`PersonView` 含 `id`、`projectId`、`displayName`、`sex`、`surname`、`birthYear`、`deathYear`、`isLiving`、`version`、时间戳。

## 2. 读取 / 更新 / 删除人物

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `…/persons/:personId` | 返回 `PersonView`；不存在 → 404 |
| `PATCH` | `…/persons/:personId` | 体含可变字段 + 必填 `version`；冲突 → `409` `VERSION_CONFLICT` |
| `DELETE` | `…/persons/:personId` | 物理删除；级联边与投影；`204` 或 `{ ok: true }` |

## 3. 创建关系边 `POST …/relations`

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `fromPersonId` | uuid | 是 | |
| `toPersonId` | uuid | 是 | ≠ from |
| `kind` | string | 是 | 仅 `biological_parent` / `adoptive_parent` / `spouse` |
| `meta` | object | 否 | 可选；映射文档 label/note 等可延后 |

服务端对 `spouse` 规范化 `from < to`（按 uuid 序）。

**Success `201`**: 边视图（含规范化后的端点）。

**Errors**

| code | HTTP | 场景 |
| --- | --- | --- |
| `VALIDATION` | 400 | kind 非法、自环、缺字段 |
| `CYCLE_DETECTED` | 409 | `GX001` 祖先环 |
| `PARENT_LIMIT` | 409 | 同类型父母已达 2 |
| `CONFLICT` | 409 | 唯一约束 / 配偶重复 |
| `NOT_FOUND` | 404 | 端点人物不在项目或不可见 |

## 4. 删除关系边 `DELETE …/relations/:relationId`

物理删除；同事务刷新投影。成功 `204` 或 `{ ok: true }`。

## 5. 权限

与项目编辑权限一致：viewer 只读；editor/admin 可写。只读角色写操作 → 404 或明确拒绝（与控制台批次策略对齐，对外不泄露）。
