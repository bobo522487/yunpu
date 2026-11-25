---
status: accepted
---

# ADR-0001: Node 26 runtime (zero Bun)

## Context

Earlier specs and architecture docs locked Bun 1.4.4 as the server/test runtime (`bun test`, Bun `S3Client`, Bun-based Docker image). Subsequent runtime convergence replaced that baseline with a standard Node.js LTS toolchain.

## Decision

Use Node.js `>=26.13.0` as the sole server/script/test runtime (with native TypeScript type stripping and `scripts/ts-ext-register.mjs`), `pnpm@12.18.0` for workspace management, `vitest@5.1.0` for unit/integration tests, `@hono/node-server` to serve `hono@4.13.19`, and `@aws-sdk/client-s3` for object storage. Better Auth (`1.7.27`) and Drizzle ORM (`0.45.4`) remain. No Bun runtime or `bun:test` API is permitted.

## Consequences

- `biome.json` enforces `noRestrictedImports` blocking `"bun"` and `"bun:test"`, backed by `tests/runtime/no-bun-scripts.test.ts`.
- All scripts, CI workflows (`.github/workflows/verify.yml`), and tests execute on Node 26 + Vitest.
- Implemented across `package.json`, `biome.json`, `scripts/env.sh`, and `apps/api/`.

## Status

Accepted & Implemented.
