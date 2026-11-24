# Contract: 受控谱系子图 API

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md) | **Date**: 2026-11-24

## `GET /api/v1/projects/:projectId/subgraph`

**Query**

| 参数 | 类型 | 默认 | 约束 |
| --- | --- | --- | --- |
| `rootPersonId` | uuid | 必填 | 必须属于该项目 |
| `upDepth` | int | `2` | ≥0；设上限（建议 ≤10） |
| `downDepth` | int | `4` | ≥0；设上限（建议 ≤20） |
| `limit` | int | `300` | 1…1000 |

**Success `200`**

```json
{
  "ok": true,
  "data": {
    "rootPersonId": "…",
    "persons": [ /* PersonView 子集 */ ],
    "relations": [ /* 边视图子集 */ ],
    "hasMoreAncestors": false,
    "hasMoreDescendants": false
  }
}
```

规则：

- 默认绝不返回整项目；`persons.length` 与边数受 `limit` 约束（计数规则在实现中固定并测：建议「人物数 ≤ limit」）。
- 深度未用尽但触达 limit → 对应方向 `hasMore*` 仍可为 true。
- 根不存在/不可见 → `404` 不可发现。
- 跨组织不可读（RLS + 事务 org 绑定）。

性能验收：约 5,000 人谱、默认深度与 limit，P95 &lt; 200ms（约定环境）；依赖已同步的 `lineage_projection`。
