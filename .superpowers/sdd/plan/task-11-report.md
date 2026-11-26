# T-011 Verification / Review Report

Status: PASS (verification/review pass complete; no implementation changes)

## Scope and constraints

- Worktree: `/home/bobo/Projects/yunpu/.worktrees/003-org-collab`, branch `003-org-collab`.
- Only test files were changed:
  - `tests/console/settings.test.ts`
  - `tests/auth/invite-acceptance.test.ts`
  - `tests/console/ownership.test.ts`
- No changes to `src/`, migrations, contracts, shared code, docs, spec/plan/tasks, or to test bodies added in Tasks 3, 8, 9, 10 (the T-010 `describe` in `tests/console/ownership.test.ts` is untouched; a new sibling `describe` was added).
- No subagents, no push, no merge.

Commit containing the test changes:
`f83a20e7bf0619cb9e66aa7b1ede26927f614916 test(review): strengthen T-011 collaboration concurrency checks`

This report itself is added in a follow-up local documentation commit because a commit cannot contain its own final SHA.

## Requirement coverage / added assertions

- **FR-006 / AC-005 (`tests/console/settings.test.ts`)**
  - Added `switching current organization updates the session and persisted last-used timestamp`: `POST /organizations/:id/activate` returns 200 with `ok: true` and organization `{id, role: "admin", isOwner: true}`; `readSession` reports the new `defaultOrganization.id`; `organization_member.last_used_at` is non-null and not regressed; organization list contains both orgs and `defaultOrganizationId` equals the newly activated org.
  - Added `activating an archived organization leaves membership and audit state untouched`: archived activation returns 404 with exact envelope `{ok:false, code:"NOT_FOUND", message:"不存在或无权"}`; `last_used_at` and the audit row count are unchanged; stored organization remains `{name:"归档切换无副作用组织", status:"archived"}`.
  - Existing archived activate/404, archived rename/409, leave/owner-blocked and cross-tenant tests were retained.

- **FR-017 / AC-010 (`tests/auth/invite-acceptance.test.ts`)**
  - Added tracked-email cleanup (`beforeEach`/`afterEach`) to this previously uncleaned file: emails are registered before any request that can fail, organization ids come from actual user ids (`owner_user_id` UNION `organization_member.user_id`), and audit/invite/member/project/organization/session/account/verification/user rows are deleted in a transaction with `session_replication_role = replica`. No non-uuid placeholder is bound to uuid parameters.
  - Replaced the status-only concurrent acceptance test with `test.each([1, 2, 3])("concurrent acceptance succeeds exactly once (run %i)")`: exactly one 200 and one 409; winner envelope `ok:true`, `data.organization.id` equals the owner org, `defaultOrganizationChanged:true`; loser exact envelope `{ok:false, code:"CONFLICT", details:{sqlstate:"GX010"}, message:"操作已被并发请求抢先，请重试"}`; invite row `status='accepted'` with non-null `accepted_at`; exactly two member rows (owner + invitee) with invitee `{role:"editor", last_used_at != null}`; exactly one `invite.accepted` audit row; invitee session default org is the owner org.
  - Added `an invalid invite token leaves membership and audit state unchanged`: GX005 maps to 404 with exact envelope `{ok:false, code:"NOT_FOUND", details:{sqlstate:"GX005"}, message:"目标不存在或已失效"}`; no partial member or audit row.

- **FR-018 / FR-019 / AC-011 (`tests/console/ownership.test.ts`)**
  - Added a new `describe("transfer concurrency and atomicity (T-011 review)")` with its own tracked-email cleanup and helpers, leaving the existing weak concurrency test and the T-010 tests intact.
  - `test.each([1, 2, 3])("concurrent transfers have one winner and no partial promotion (run %i)")`: two viewer recipients start with `role='viewer'`; a bounded admin `SELECT ... FOR UPDATE` row-lock barrier plus `pg_locks` wait check makes both requests pass the owner check before either CAS update, so the loser deterministically fails with GX010 (409) instead of an earlier GX006 (403). Asserts exact winner/loser envelopes, `data.ownerUserId` equals the persisted owner, persisted owner is one of the two candidates, winner role `admin`, loser role still `viewer` (proves loser promotion rolled back), old owner remains `admin`, exactly one `organization.owner_transferred` audit row, and detail `{ownerUserId, isOwner:false, myRole:"admin"}`.
  - Added `a rejected archived transfer does not promote the recipient or write audit`: GX012 maps to exact 409 envelope, owner unchanged, recipient stays `viewer`, zero audit rows.
  - Existing coverage for owner invariants, viewer promotion, archived transfer, cross-tenant transfer and audit events was reviewed and not duplicated.

## Verification evidence

- Baseline before edits: `pnpm exec vitest run --config vitest.config.ts --fileParallelism=false tests/console/settings.test.ts tests/auth/invite-acceptance.test.ts tests/console/ownership.test.ts` → 3 files passed, 23 tests passed, exit 0.
- After edits, same targeted command → 3 files passed, 32 tests passed, exit 0.
- `pnpm lint` (`pnpm exec biome check . && tsc --noEmit -p apps/api/tsconfig.json`) → exit 0 (Biome formatting applied first; 107 files checked).
- `pnpm test:all` → exit 0:
  - `tests/env` stage: `Test Files 5 passed (5)`, `Tests 13 passed (13)`.
  - main stage: `Test Files 54 passed | 1 skipped (55)`, `Tests 232 passed | 3 skipped (235)`, duration 171.84s.
- Concurrency 3-run evidence, command `pnpm exec vitest run --config vitest.config.ts --fileParallelism=false tests/auth/invite-acceptance.test.ts tests/console/ownership.test.ts -t "concurrent"`, run three times in fresh processes:
  - Run 1: exit 0, `Test Files 2 passed (2)`, `Tests 7 passed | 16 skipped (23)`; all 3 invite runs and all 3 new transfer runs passed (plus existing weak transfer test).
  - Run 2: exit 0, same counts; all 6 parameterized reps passed.
  - Run 3: exit 0, same counts; all 6 parameterized reps passed.
  - No flaky failures; no stress loops beyond the required 3 repetitions.

## Concerns

- The transfer concurrency test deliberately serializes the two racers' owner check using a test-held `SELECT ... FOR UPDATE` lock on the organization row and polls ungranted `transactionid` locks. Without this barrier the second request may observe the winner's committed owner and fail earlier as GX006/403, which is valid production behavior but would not exercise the GX010 CAS path. The polling filter is global to ungranted transactionid locks; it is safe under this suite's `fileParallelism: false`, but should be narrowed if tests ever run in parallel.
- `tests/auth/invite-acceptance.test.ts` previously had no fixture cleanup; the new cleanup adds transactional deletes. Care was taken to track emails before fallible requests and to derive organization ids only from persisted user ids.
- No implementation defects or missing implementation changes were found during this review pass.
