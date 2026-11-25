---
status: accepted
---

# ADR-0011: Read-path boundary hardening

## Context

The Wave 2 review found four read-path leaks: six leaf tables still used a correlated `organization_member` subquery in their SELECT RLS policy (nested scans under `EXPLAIN`), the subgraph query dropped `ritual_heir` edges while the ancestor resolver followed them (island ancestors), list endpoints had no bounded person page and emitted a trailing empty project page on exact boundaries, and `authMiddleware` ran on every path, forcing a session lookup even for `/api/health` and the media capability endpoints. The health probe also opened a fresh `Client`/TCP connection per request while the tenant pool already exists.

## Decision

- Leaf-table SELECT policies (`invite`, `project`, `person`, `person_name`, `person_relation`, `lineage_projection`) use `organization_id = ANY (app.visible_org_array())`; no correlated `organization_member` scan remains in the read path.
- `querySubgraph` returns every fetched relation whose both endpoints are in the page, including `ritual_heir`; the ancestor resolver and edge projection now agree on the same kind set.
- `listPersons` accepts the shared page query and returns `{ persons, nextCursor }` using UUIDv7 keyset order with `limit + 1`; `listProjects` validates `timestamp|uuid` cursors before touching the database and only emits a cursor when an extra row exists.
- `authMiddleware` is mounted only on `/api/v1/*`. The media exception inside the middleware is deleted because media routes were never under that prefix. `/api/health` and `/api/ready` perform zero auth queries.
- `probeDatabase` runs `SELECT version()` through the existing `businessPool` instead of constructing a short-lived `Client`; no tenant tables are read.

## Consequences

- `EXPLAIN (ANALYZE)` on leaf SELECTs shows no `organization_member` node; RLS still resolves visibility from `app.visible_org_array()`.
- Subgraph consumers can render lineage ancestors connected by `ritual_heir` without a second query.
- List responses are bounded and cursors are either usable or `null`; malformed cursors are rejected as `VALIDATION` before a database round trip.
- Health checks no longer depend on the auth schema being reachable. The health probe reuses pooled connections; it remains a non-tenant exception documented in `docs/architecture.md`.
- Existing `data.persons` / `data.items` response shapes are preserved; `data.nextCursor` is added to the persons route.

## Status

Accepted。Implemented in Wave 2; tests cover policy plans, subgraph edges, pagination boundaries, auth scope, and pooled probing.
