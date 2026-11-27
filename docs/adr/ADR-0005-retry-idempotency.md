---
status: accepted
---

# ADR-0005: Retry and conflict classification

## Context

Database transactions under concurrent load can encounter transient connection resets, serialization failures, or deadlocks, while constraint violations (unique keys, optimistic version mismatches) are deterministic business conflicts that must never be silently retried.

## Decision

In `apps/api/src/db/with-tenant-transaction.ts`:

- **Drizzle `.cause`-chain unwrapping**: `extractDatabaseError` and `hasErrorMessagePattern` unwrap wrapped `DrizzleQueryError` instances up to 5 levels so PostgreSQL SQLSTATE codes (`40001`, `40P01`, `23505`, `08*`, `57P01-03`) are classified accurately rather than missed behind the Drizzle wrapper.
- **Retryable transient errors**: PostgreSQL `40001` (`serialization_failure`) and `40P01` (`deadlock_detected`) are retried up to 3 attempts with exponential backoff (`25ms * 2^attempt`). Connection resets (`ECONNRESET`) are retried only during the `setup` phase or inside `readOnly: true` transactions; write transactions never replay on `commit`-phase `ECONNRESET`.
- **Non-retryable conflicts**: unique-constraint violations (`23505`) and optimistic-lock mismatches (`VERSION_CONFLICT`) are never retried and surface directly as HTTP `409`.
- **Note on `Idempotency-Key`**: HTTP-layer `Idempotency-Key` middleware is not currently implemented in `apps/api`; any future write-idempotency mechanism should be introduced via a dedicated spec and ADR.

## Consequences

- `isRetryableTenantError` and `isNonRetryableConflictError` are exported and unit-tested in `apps/api/test/with-tenant-transaction.test.ts`.
- Callers must treat HTTP `409` (`CONFLICT`, `VERSION_CONFLICT`, `CYCLE_DETECTED`, `PARENT_LIMIT`) as terminal business conflicts.

## Status

Accepted (transient retry & conflict classification implemented; `Idempotency-Key` deferred).
