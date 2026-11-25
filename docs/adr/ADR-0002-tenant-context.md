---
status: superseded
superseded_by: ADR-0010-tenant-session-hardening
---

# ADR-0002: Tenant transaction entry

> **Superseded by [ADR-0010](ADR-0010-tenant-session-hardening.md).** The single tenant-entry boundary remains, but the `orgId` / `app.current_org_id` option is removed and the session setup is collapsed to two round trips with poisoned-connection destruction. The text below is kept as history.

## Context

Older code and docs used `withUser(tx, userId)` and set GUCs ad hoc. Business modules need a single enforceable transaction boundary that preserves PostgreSQL `FORCE ROW LEVEL SECURITY` as the sole tenant isolation authority.

## Decision

Standardize on `withTenantTransaction({ userId, orgId? }, fn)` in `apps/api/src/db/with-tenant-transaction.ts`:

- Enters a transaction on `businessPool`, sets `SET LOCAL ROLE genealogy_app`, asserts `current_user === 'genealogy_app'`, and sets transaction-local `app.user_id` (plus optional `app.current_org_id`).
- `orgId` is only an auxiliary context GUC; tenant isolation and authorization still rely on RLS predicates and membership verification (`apps/api/src/access.ts`).
- `withUser` is removed; `apps/api/src/modules/**` are forbidden from importing `db/pool`, `businessPool`, or `createDb` (except `modules/auth/better-auth.ts` for the separate `auth` schema).

## Consequences

- Enforced statically by `biome.json` (`noRestrictedImports`) and verified by `tests/runtime/no-pool-import.test.ts`, `tests/security/force-rls.test.ts`, and `tests/security/tenant-connection-reuse.test.ts`.
- The only non-tenant database connections are documented in `docs/architecture.md` (health probe, Better Auth DB, migrations).

## Status

Accepted & Implemented.
