# 002 User Auth Default Org Spec Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `specs/002-user-auth-default-org` into the same archived three-file SDD shape as `specs/001-dev-test-environment`, preserving FR/SC traceability and removing obsolete auxiliary documents.

**Architecture:** Keep the feature archive at `specs/002-user-auth-default-org/` with only `spec.md`, `plan.md`, and `tasks.md`. The spec remains the business contract (FR-001–FR-021, SC-001–SC-012 → AC-001–AC-012); the plan is the technical record with effective research/data-model/contract conclusions folded into the seven template sections; the tasks file is the historical execution ledger plus the independent acceptance matrix. No production code is changed.

**Tech Stack:** SDD Markdown templates under `specs/_templates/`, Git diff verification, shell `grep`/`find` inventory checks. No runtime dependencies.

**Spec:** Approved short design in conversation (m00519) plus `specs/_templates/spec.md`, `specs/_templates/plan.md`, `specs/_templates/tasks.md` and the 001 refactor pattern in `specs/001-dev-test-environment/`.

## Global Constraints

- Preserve `FR-001` through `FR-021` exactly as existing IDs and business behaviors; do not renumber, merge, add, or delete FRs.
- Convert `SC-001` through `SC-012` one-to-one into `AC-001` through `AC-012`, each with a `（对应 FR-xxx）` mapping and `[x]` status. The old `SC-0xx` IDs must not remain.
- `spec.md` must use exactly the six sections from `specs/_templates/spec.md`: `## 1. Overview` … `## 6. Acceptance Criteria`.
- `plan.md` must use exactly the seven sections from `specs/_templates/plan.md`: `## 1. 上下文与复用分析` … `## 7. 技术风险与取舍`.
- `tasks.md` must use the template shape: one `T-001`…`T-066` table, `## 2. 每任务完成汇报模板`, `## 3. 独立验收与需求追踪矩阵`.
- Delete exactly these 8 auxiliary files: `research.md`, `quickstart.md`, `data-model.md`, `checklists/requirements.md`, `contracts/auth-api.md`, `contracts/organization-selection.md`, `contracts/invite-acceptance.md`, `contracts/web-pages.md`.
- Current runtime wording is Node 26.13.1 / pnpm 12.18.0 / Vitest 5.1.1 / Hono / PostgreSQL 18 / silo. No `Bun`, `bun test`, `bun:test`, or `MinIO` wording may remain in the three rewritten files.
- Front-end pages (`/sign-up`, `/app`, `/onboarding`) are out of scope (Approach A). Historical task rows that mention them must be explicitly tagged `[历史：前端页面已不在当前批次]`; no front-end contract survives.
- Do not modify code, `specs/INDEX.md`, `docs/`, `specs/001-dev-test-environment/`, or pre-existing unrelated worktree changes.
- Do not commit. The user requested a document refactor, not a commit; leave all changes uncommitted in the worktree.

## Review Focus

- FR inventory drift — a dropped or reordered `FR-0xx` would break traceability; Task 1 asserts the exact 21-heading list.
- SC→AC semantic loss — a success criterion could disappear during renumbering; Task 1 asserts 12 `[x]` AC rows and zero remaining `SC-0xx` IDs.
- Stale stack/path leakage — old Bun/MinIO/page paths could survive in the archive; Tasks 1–3 assert forbidden tokens are absent or explicitly historical.
- Task ledger loss — collapsing phases could drop `T001`–`T066` or their FR links; Task 3 asserts exactly `T-001`…`T-066` and both FR and AC matrix rows.
- Dangling documentation links — deleted contracts/data-model/quickstart may still be referenced; Task 4 greps `specs/002-user-auth-default-org` for every deleted filename.
- Front-end scope creep — a page contract could re-enter through task descriptions; Tasks 1–3 assert page paths appear only in explicitly historical rows, never as active requirements.

---

## File Structure

- Modify: `specs/002-user-auth-default-org/spec.md` — business-only contract, six template sections.
- Modify: `specs/002-user-auth-default-org/plan.md` — seven template sections; effective content from old research/data-model/contracts folded in.
- Modify: `specs/002-user-auth-default-org/tasks.md` — unified historical task table plus acceptance matrix.
- Delete: `specs/002-user-auth-default-org/research.md`
- Delete: `specs/002-user-auth-default-org/quickstart.md`
- Delete: `specs/002-user-auth-default-org/data-model.md`
- Delete: `specs/002-user-auth-default-org/checklists/requirements.md`
- Delete: `specs/002-user-auth-default-org/contracts/auth-api.md`
- Delete: `specs/002-user-auth-default-org/contracts/organization-selection.md`
- Delete: `specs/002-user-auth-default-org/contracts/invite-acceptance.md`
- Delete: `specs/002-user-auth-default-org/contracts/web-pages.md`
- No source files, test files, root docs, or other specs are touched.

---

### Task 1: Rewrite `spec.md` as the six-section business contract

**Files:**
- Modify: `specs/002-user-auth-default-org/spec.md`

**Interfaces:**
- Consumes: current `spec.md` FR-001–FR-021, SC-001–SC-012, clarifications, edge cases, key entities, assumptions.
- Produces: six-section spec used by Tasks 2–3 as the authoritative FR/AC list.

- [ ] **Step 1: Replace the file with the template six-section structure**

Write `specs/002-user-auth-default-org/spec.md` with:
  - No `Status: Draft`, no `Feature Branch`, no `Created`, no `Input` header. Start with `# 用户注册、登录与默认组织`.
  - `## 1. Overview`: business goal, in-scope registration/login/default-org behavior, explicit out-of-scope list (WeChat OAuth, email verification, password recovery/change, MFA/captcha, permanent lock, front-end SPA/pages).
  - `## 2. User Stories`: `US-01`…`US-04` from old User Story 1–4, keeping priority and independent-test intent.
  - `## 3. Functional Requirements`: `### FR-001` … `### FR-021` headings in the original order, with the original business behavior converted into template bullets (input/precondition, action, observable result). Keep exact values: email trim+lowercase and unique; password minimum 8 and reject empty/whitespace; 7-day sliding session with no absolute cap; default-org order `last_used_at → created_at → onboarding`; 5 failures / 15 minutes keyed by email+source; invite failure does not fail registration; one-time concurrent invite redemption.
  - `## 4. Business Rules`: fold the 2026-11-14 clarifications, Key Entities definitions, and Assumptions into business rules/definitions. Add no new rule.
  - `## 5. Exception Handling`: fold old Edge Cases into observable external behavior; include consistent `401` for unknown email vs wrong password, `400 VALIDATION`, `403 INVITE_EMAIL_MISMATCH`, `404 TARGET_INVALID`, `409 CONFLICT`, `429 RATE_LIMITED`, `500 INTERNAL` for compensated registration failure, and fail-closed behavior for invalid/expired sessions.
  - `## 6. Acceptance Criteria`: `AC-001`…`AC-012` replacing `SC-001`…`SC-012` one-to-one, each `[x]` and each ending with `（对应 FR-xxx）`. Use mappings: AC-001←SC-001/FR-001,FR-007,FR-012; AC-002←SC-002/FR-005,FR-006; AC-003←SC-003/FR-001; AC-004←SC-004/FR-008,FR-013; AC-005←SC-005/FR-016,FR-017; AC-006←SC-006/FR-012; AC-007←SC-007/FR-013,FR-014; AC-008←SC-008/FR-014,FR-015; AC-009←SC-009/FR-009; AC-010←SC-010/FR-021; AC-011←SC-011/FR-010; AC-012←SC-012/FR-001,FR-002.

- [ ] **Step 2: Assert the six headings are exact**

Run: `grep -n '^## ' specs/002-user-auth-default-org/spec.md`
Expected exactly:
```
## 1. Overview
## 2. User Stories
## 3. Functional Requirements
## 4. Business Rules
## 5. Exception Handling
## 6. Acceptance Criteria
```

- [ ] **Step 3: Assert the FR inventory is intact**

Run: `grep -n '^### FR-[0-9][0-9][0-9]' specs/002-user-auth-default-org/spec.md`
Expected 21 headings from `### FR-001` through `### FR-021` with no gaps or duplicates.

- [ ] **Step 4: Assert SC→AC conversion is complete**

Run:
```
grep -n '^- \[x\] \*\*AC-[0-9][0-9][0-9]' specs/002-user-auth-default-org/spec.md
grep -n 'SC-0' specs/002-user-auth-default-org/spec.md
```
Expected: 12 AC lines numbered AC-001…AC-012, all containing `（对应 FR-`; second command prints nothing.

- [ ] **Step 5: Assert no implementation or page contract leaked into the spec**

Run: `grep -nE 'Bun|bun test|bun:test|MinIO|Better Auth|Drizzle|SQL|/sign-up|/app|/onboarding' specs/002-user-auth-default-org/spec.md`
Expected: no output. Business terms like `Organization` and `审计` are allowed; framework, storage, schema, and page-route names are not.

- [ ] **Step 6: Do not commit**

Run: `git diff --check -- specs/002-user-auth-default-org/spec.md`
Expected: no output. Leave the file modified but unstaged.

---

### Task 2: Rewrite `plan.md` as the seven-section technical record

**Files:**
- Modify: `specs/002-user-auth-default-org/plan.md`

**Interfaces:**
- Consumes: new `spec.md` FR list; old `plan.md`, `research.md`, `data-model.md`, `contracts/auth-api.md`, `contracts/organization-selection.md`, `contracts/invite-acceptance.md`.
- Produces: technical record consumed by Task 3 traceability rows and Task 4 deletion checks.

- [ ] **Step 1: Replace the file with the template seven-section structure**

Write `specs/002-user-auth-default-org/plan.md` with:
  - `# Technical Plan: 用户注册、登录与默认组织`, then the template prerequisite note, then exactly `## 1. 上下文与复用分析` … `## 7. 技术风险与取舍`.
  - In `## 1`: list reused modules `apps/api/src/modules/auth/*`, `apps/api/src/modules/organization/*`, `apps/api/src/middleware/login-rate-limit.ts`, `apps/api/src/db/with-user.ts`, `packages/db`, `packages/shared`; state no new abstraction, current runtime Node 26.13.1 + pnpm 12.18.0 + Vitest 5.1.1 + Hono + PostgreSQL 18 + silo.
  - In `## 2`: describe `router → service → queries`, `auth/provisioning.ts` compensation flow, `with-user` transaction context, login rate-limit middleware, and map each to FR IDs.
  - In `## 3`: fold the effective content of old `data-model.md` §§1–9 and `research.md`: `auth."user"/session/account/verification`, four tenant tables `organization`/`organization_member`/`invite`/`audit_log`, `organization_member.last_used_at`, default-org query ordering, controlled functions (`app.create_organization`, `app.accept_invite`, `app.resolve_invite_by_token`), four-table RLS, migration numbers `0000_roles.sql`, `0001_auth_tenant.sql`, `0003_functions.sql`, `0004_rls.sql`, `0005_grants.sql`, `0006_fix_user_email_grant.sql` (explicitly note no `0002`), and execution by `packages/db/src/migrate.ts`.
  - In `## 4`: fold old contracts into an API contract list without page routes: `POST /api/v1/auth/sign-up`, `POST /api/v1/auth/sign-in`, `POST /api/v1/auth/sign-out`, `GET /api/v1/auth/session`, `GET /api/v1/organizations`, `POST /api/v1/organizations`, `POST /api/v1/organizations/:organizationId/activate`, `POST /api/v1/invites/accept`. State the flat error envelope `{ ok: false, code, message, details? }` per ADR-0003 and the success shape `{ ok: true, data }`.
  - In `## 5`: document compensation deletion order `session → account → user`, `23505 → 409`, `GX005`/`GX008`/`GX009`/`GX010` mappings, invite conditional-update preemption with `IS DISTINCT FROM`, 5/15-minute in-process rate-limit window, and RLS fail-closed context.
  - In `## 6`: document no plaintext password/session token/invite token in responses or logs, 7-day sliding session with no absolute cap, one-query default-org resolution, tenant isolation, and that `/sign-up`, `/app`, `/onboarding` are out of current scope.
  - In `## 7`: fold the old Complexity Tracking table into bullet form: compensation across auth/business boundaries, in-process rate limiting, Better Auth + Drizzle runtime dependencies, and `last_used_at` over a new preference table. Add an archive note that the front-end page contract was removed under Approach A and that `check-docs.sh` is not part of this archive's acceptance path.

- [ ] **Step 2: Assert the seven headings are exact**

Run: `grep -n '^## ' specs/002-user-auth-default-org/plan.md`
Expected exactly the seven template headings listed in Step 1, in order.

- [ ] **Step 3: Assert stale runtime and deleted-file references are gone**

Run: `grep -nE 'Bun|bun test|bun:test|MinIO|src/pages|src/auth/index.ts|check-docs.sh|quickstart.md|research.md|data-model.md|contracts/|web-pages' specs/002-user-auth-default-org/plan.md`
Expected: no output. The front-end removal note must say "the front-end page contract was removed under Approach A", not name the deleted file.

- [ ] **Step 4: Assert all FRs are traceable in the plan**

Run:
```
grep -o 'FR-[0-9][0-9][0-9]' specs/002-user-auth-default-org/plan.md | sort -u
```
Expected: exactly `FR-001`…`FR-021`, no extras.

- [ ] **Step 5: Do not commit**

Run: `git diff --check -- specs/002-user-auth-default-org/plan.md`
Expected: no output. Leave the file modified but unstaged.

---

### Task 3: Rewrite `tasks.md` as one ledger plus the acceptance matrix

**Files:**
- Modify: `specs/002-user-auth-default-org/tasks.md`

**Interfaces:**
- Consumes: Task 1 FR/AC list and Task 2 technical record; old `tasks.md` T001–T066 and old quality checklist conclusions.
- Produces: archived execution ledger and acceptance traceability consumed by Task 4 final checks.

- [ ] **Step 1: Replace the file with the archive header and unified task table**

Write `specs/002-user-auth-default-org/tasks.md`:
  - Start with `# Tasks: 用户注册、登录与默认组织`.
  - Include an archive note like 001's: all tasks were completed by 2026-11-25, old Phases 1–8 are folded into a unified table, `[P]`/`[USx]` labels are preserved as traceability tags, current stack wording is Node 26 / pnpm / Vitest / silo, and page-related tasks are historical only.
  - Use input links `./spec.md` and `./plan.md` only.
  - `## 1. 开发任务清单` contains one table with exactly these columns: `ID | 状态 | 依赖 | 关联需求 | 任务描述 | 修改范围 & 变更类型（迁移/API/配置） | 测试要求`.
  - Create 66 rows `T-001`…`T-066`, all status `[x]`, preserving the old T001–T066 descriptions and dependency intent. Map old IDs by adding a hyphen and zero padding (`T001` → `T-001`, `T060` → `T-060`).
  - Keep `FR-xxx` links for each row; for T-060…T-066 keep the original correction annotations (`per FR-020`, `per FR-002`, `per SC-003`, `per SC-011`, etc.) but rewrite them as normal FR/AC references.
  - Tag historical page rows `T-029`, `T-037`, `T-044`, `T-051` with `[历史：前端页面已不在当前批次]` in the task description; their paths become `/sign-up`, `/app`, `/onboarding` only in those tagged rows.
  - After the table, add one execution-order paragraph (like 001 line 44) summarizing Setup → Foundational → US1–US4 → Polish → Convergence, parallel opportunities, and MVP stopping point.

- [ ] **Step 2: Keep the report template unchanged**

Write `## 2. 每任务完成汇报模板` with the same five numbered items as `specs/_templates/tasks.md`: modified files, implemented behavior, executed tests and commands, result, remaining issues.

- [ ] **Step 3: Build the independent acceptance matrix**

In `## 3. 独立验收与需求追踪矩阵`:
  - Use the template note plus an archive sentence that the old `checklists/requirements.md` quality-check conclusion is folded here.
  - Add one row per `FR-001`…`FR-021` and one row per `AC-001`…`AC-012` (label each as `AC-001（原 SC-001）` … `AC-012（原 SC-012）`).
  - For implementation location use real current paths such as `apps/api/src/modules/auth/service.ts`, `apps/api/src/modules/auth/client.ts`, `apps/api/src/modules/organization/service.ts`, `apps/api/src/middleware/login-rate-limit.ts`, `packages/db/src/schema/`, `packages/db/migrations/`, and `tests/auth/`.
  - For tests use existing files such as `tests/auth/registration.test.ts`, `tests/auth/login-session.test.ts`, `tests/auth/default-organization.test.ts`, `tests/auth/invite-acceptance.test.ts`, `tests/auth/login-rate-limit.test.ts`, `tests/auth/log-redaction.test.ts`, `apps/api/test/auth-router.test.ts`.
  - Use static/integration checks `pnpm lint`, `pnpm test:auth`, `pnpm test:all`, and real PostgreSQL 18 assertions. Set every result to `[Pass]`.
  - Add a quality-check conclusion paragraph: the 2026-11-14 review found no `[NEEDS CLARIFICATION]`, FR/SC traceability complete, success criteria measurable, scope clear; acceptance now recorded by the AC rows above.

- [ ] **Step 4: Assert the task IDs are complete**

Run: `grep -o 'T-[0-9][0-9][0-9]' specs/002-user-auth-default-org/tasks.md | sort -u`
Expected: exactly 66 IDs from `T-001` through `T-066`; no `T001`-style bare IDs remain.

- [ ] **Step 5: Assert matrix coverage**

Run:
```
grep -o 'FR-[0-9][0-9][0-9]' specs/002-user-auth-default-org/tasks.md | sort -u
grep -c '^- \[x\] \*\*AC-[0-9][0-9][0-9]' specs/002-user-auth-default-org/tasks.md
```
Expected: first command prints `FR-001`…`FR-021`; second prints `12`.

- [ ] **Step 6: Assert stale tokens and untagged page routes are gone**

Run:
```
grep -nE 'Bun|bun test|bun:test|MinIO|quickstart.md|research.md|data-model.md|contracts/' specs/002-user-auth-default-org/tasks.md
grep -nE '/sign-up|/app|/onboarding' specs/002-user-auth-default-org/tasks.md | grep -v '历史：前端页面已不在当前批次'
```
Expected: both commands print nothing.

- [ ] **Step 7: Do not commit**

Run: `git diff --check -- specs/002-user-auth-default-org/tasks.md`
Expected: no output. Leave the file modified but unstaged.

---

### Task 4: Delete auxiliary files and run final consistency checks

**Files:**
- Delete: `specs/002-user-auth-default-org/research.md`
- Delete: `specs/002-user-auth-default-org/quickstart.md`
- Delete: `specs/002-user-auth-default-org/data-model.md`
- Delete: `specs/002-user-auth-default-org/checklists/requirements.md`
- Delete: `specs/002-user-auth-default-org/contracts/auth-api.md`
- Delete: `specs/002-user-auth-default-org/contracts/organization-selection.md`
- Delete: `specs/002-user-auth-default-org/contracts/invite-acceptance.md`
- Delete: `specs/002-user-auth-default-org/contracts/web-pages.md`

**Interfaces:**
- Consumes: completed `spec.md`, `plan.md`, `tasks.md`.
- Produces: a three-file archived spec directory with no dangling internal links.

- [ ] **Step 1: Verify the exact deletion targets**

Run:
```
ls -l specs/002-user-auth-default-org/research.md \
  specs/002-user-auth-default-org/quickstart.md \
  specs/002-user-auth-default-org/data-model.md \
  specs/002-user-auth-default-org/checklists/requirements.md \
  specs/002-user-auth-default-org/contracts/auth-api.md \
  specs/002-user-auth-default-org/contracts/organization-selection.md \
  specs/002-user-auth-default-org/contracts/invite-acceptance.md \
  specs/002-user-auth-default-org/contracts/web-pages.md
```
Expected: eight existing regular files, all under `specs/002-user-auth-default-org/`.

- [ ] **Step 2: Delete only those eight files**

Run:
```
rm specs/002-user-auth-default-org/research.md \
   specs/002-user-auth-default-org/quickstart.md \
   specs/002-user-auth-default-org/data-model.md \
   specs/002-user-auth-default-org/checklists/requirements.md \
   specs/002-user-auth-default-org/contracts/auth-api.md \
   specs/002-user-auth-default-org/contracts/organization-selection.md \
   specs/002-user-auth-default-org/contracts/invite-acceptance.md \
   specs/002-user-auth-default-org/contracts/web-pages.md
rmdir specs/002-user-auth-default-org/checklists specs/002-user-auth-default-org/contracts
```
Expected: no output. Do not use `git rm` and do not commit; deletions remain unstaged like the edits.

- [ ] **Step 3: Assert no dangling deleted-file references remain**

Run: `grep -R -nE 'research\.md|quickstart\.md|data-model\.md|checklists/requirements\.md|contracts/(auth-api|organization-selection|invite-acceptance|web-pages)\.md' specs/002-user-auth-default-org/`
Expected: no output.

- [ ] **Step 4: Assert the archive contains exactly three files**

Run: `find specs/002-user-auth-default-org -type f | sort`
Expected exactly:
```
specs/002-user-auth-default-org/plan.md
specs/002-user-auth-default-org/spec.md
specs/002-user-auth-default-org/tasks.md
```

- [ ] **Step 5: Final worktree sanity check**

Run:
```
git diff --check
git status --short
```
Expected: no whitespace errors. Status shows this plan file as untracked (`?? docs/superpowers/plans/`), modifications to the three 002 files, and deletions of the eight auxiliary files, plus the pre-existing unrelated changes that were present before this task (`M compose.yaml`, deleted historical spec files, and modified 001 spec/plan/tasks). No source code, root docs, `specs/INDEX.md`, or 001 files are changed by this task beyond their pre-existing state.

- [ ] **Step 6: No commit**

Do not run `git add` or `git commit`. Report the document refactor as complete with the verification commands above.
