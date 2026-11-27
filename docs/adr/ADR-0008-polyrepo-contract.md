---
status: superseded
supersededBy: ADR-0013-monorepo-web-integration
---

# ADR-0008: Split the frontend into its own repository

## Context

`apps/web` was nested inside the backend repository and carried its own `.git` (`yunpu-web`), a `bun.lock`, and no imports of `@yunpu/shared` or the Hono `AppType`. The root workspace still typechecked that tree, so unfinished frontend files blocked `pnpm lint`. Google AI Studio produces a standalone Vite app and does not participate in the pnpm workspace graph.

A monorepo pays for itself only when one change atomically updates a shared contract and every consumer. That sharing was not happening.

## Decision

- Keep this repository as the Node 26 + pnpm API: `apps/api`, `packages/db`, `packages/shared`.
- Keep the frontend in the existing `yunpu-web` repository and manage it with Bun. Remove `apps/web` from this workspace.
- Publish one generated contract, `contracts/openapi.json`, from the Hono routes and `@yunpu/shared` Zod schemas (`pnpm contract:export`). The frontend and AI Studio consume that file; they do not hand-copy response types.
- The API serves JSON under `/api/*` only. Server-rendered sign-in HTML is removed.
- Cross-origin local development uses optional `CORS_ORIGINS` (comma-separated) and the same list is added to Better Auth `trustedOrigins`. The preferred path remains a Vite `/api` proxy so cookies stay same-origin.
- `packages/db` and `packages/shared` stay separate packages.

## Consequences

- `pnpm-workspace.yaml` lists `apps/api` and `packages/*` only. `pnpm lint` typechecks `@yunpu/api` and runs Biome; it does not typecheck the frontend.
- Backend code must not reintroduce `apps/web`, `pages/auth.ts`, or a second Better Auth / tenant-transaction implementation.
- Contract drift is fixed by regenerating `contracts/openapi.json` after a route or shared-schema change, then copying that file into the frontend workflow.

## Status

Superseded by [ADR-0013-monorepo-web-integration](ADR-0013-monorepo-web-integration.md).
