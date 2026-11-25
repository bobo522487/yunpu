---
status: accepted
---

# ADR-0007: 所有者外键不另建引用侧索引

## Context

`organization (id, owner_user_id)` 通过外键 `fk_organization_owner` 引用 `organization_member (organization_id, user_id)`。按照通用外键索引原则，需评估删除 `organization_member` 时是否会引起 `organization` 全表扫描。

## Decision

不为 `fk_organization_owner` 额外创建 `(id, owner_user_id)` 复合索引。

理由：删除一名成员时，数据库在 `organization` 中查找 `id` 与 `owner_user_id` 同时匹配的行；由于 `id` 本身就是 `organization` 的主键（前导唯一索引），该查找最多定位单行，不会随成员数量增长退化为全表扫描。

## Consequences

- `organization` 仅保留 `idx_organization_owner(owner_user_id)`；已落地的项目内容表（`person`、`person_name`、`person_relation`、`lineage_projection`）仍各自保留 `(organization_id, project_id)` 索引。

## Status

Accepted & Implemented.
