---
status: superseded
---

# ADR-0003: Error envelope (Superseded)

## Context

An earlier 2026-11-23 architecture proposal suggested replacing `{ ok: false, code, message, details? }` with `{ error: { code, message, requestId, details? } }`.

## Decision

**This proposal was NOT adopted in the codebase.** During `004-backend-architecture` and `005-slim-architecture`, the repository standardized on keeping the flat envelope:

- Error responses: `{ ok: false, code, message, details? }` (defined in `apps/api/src/app.ts` `onApiError` and `packages/shared/src/errors.ts` `ERROR_STATUS`).
- `GX001` cycle detection maps to HTTP `409` with code `CYCLE_DETECTED`; `GX011` maps to `409 PARENT_LIMIT`; `GX012` maps to `409 CONFLICT` via `mapDatabaseError` (`apps/api/src/lib/errors.ts`).
- `tests/runtime/error-envelope.test.ts` explicitly asserts the flat `{ ok: false, code, message }` shape and forbids a nested `error` key.

## Status

Superseded by current implementation (`apps/api/src/app.ts` & `tests/runtime/error-envelope.test.ts`).
