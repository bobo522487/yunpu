---
status: accepted
---

# ADR-0010: Tenant session hardening

## Context

ADR-0002 made `withTenantTransaction` the only tenant entry point, but its startup path issued 4–5 serial round trips (`BEGIN`, `SET LOCAL ROLE`, `set_config('app.user_id')`, optional `set_config('app.current_org_id')`, `SELECT current_user`). A repository-wide search showed that no RLS policy, function, or test reads `app.current_org_id`; the GUC was a dead pipe that suggested tenant narrowing the database never performed. Worse, a catch block silently swallowed `ROLLBACK` failures and then called `client.release()` with no argument, returning a possibly poisoned (aborted or wrong-role) session to the pool.

## Decision

- Keep `withTenantTransaction` as the only tenant entry point and keep the `genealogy_app` role assertion.
- Remove `TenantTxOptions.orgId` and the `app.current_org_id` GUC entirely. Tenant isolation continues to rely on `app.user_id`, `FORCE ROW LEVEL SECURITY`, membership predicates, and role checks — never on an unread session variable.
- Send `BEGIN; SET LOCAL ROLE genealogy_app` as one simple-query batch, then assert the role in the same statement that sets `app.user_id`: `SELECT set_config('app.user_id', $1, true), current_user AS role`. Startup cost drops from 5 to 2 round trips.
- Track a `destroy` flag. On a connection-level error (SQLSTATE `08*`, `57P01`–`57P03`, or driver codes such as `ECONNRESET`/`EPIPE`/`ETIMEDOUT`), a failed `ROLLBACK`, or a failed role assertion, call `client.release(true)` so the session is discarded. Ordinary business/SQL errors that roll back cleanly still return the connection to the pool.

This supersedes ADR-0002's `orgId` / `app.current_org_id` clause; its single-entry-point and RLS-authority clauses remain in force.

## Consequences

- Every tenant transaction saves 3 network round trips; the role assertion is unchanged in strength.
- No code can set a GUC that nobody reads, so the session state has exactly one identity fact (`app.user_id`) plus the ephemeral role.
- A broken session can no longer be reused by a later tenant request. Tests cover both destruction (rollback failure, connection-level error, role assertion failure) and reuse (ordinary business error).
- `TenantTxOptions` narrows to `{ userId }`; the two callers that passed `orgId` (`apps/api/src/modules/project/service.ts` `listProjectsForOrg` / `createProject`) keep their organization checks via `requireMember` inside the transaction, so behavior is unchanged.
- Retry classification is unchanged: `ECONNRESET`, `40001`, `40P01` remain retryable up to three attempts, and `23505` remains non-retryable.

## Status

Accepted。ADR-0002 marked `superseded`; docs/constitution.md and docs/architecture.md updated; unit tests for RTT count, role assertion, and pool hygiene passing.
