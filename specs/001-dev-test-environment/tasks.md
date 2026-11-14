---

description: "Task list for the development and test environment"
---

# Tasks: 开发与测试环境

**Input**: Design documents from `/specs/001-dev-test-environment/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: 规格 FR-006、SC-003 与 quickstart 要求 `bun test` 打到真实测试环境。本清单包含这些测试。先写会失败的测试，再写实现。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- 应用代码在 `apps/api/src/`
- 环境命令在 `scripts/env.sh`
- 容器定义在 `compose.yaml` 与 `docker/postgres/init/`
- 自动检查在 `tests/env/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 建立 pnpm 工作区与环境说明，不引入第二套包管理器

- [X] T001 Create root `package.json` with `"packageManager": "pnpm@12.18.0"` and scripts that call `scripts/env.sh` and `bun test --env-file .env.test`. Do not add `bun install`, `bun add`, or `bun.lock` in `package.json`
- [X] T002 [P] Create `pnpm-workspace.yaml` listing only `apps/api`
- [X] T003 [P] Create `apps/api/package.json` with exact dependencies `hono@4.13.18`, `zod@4.6.7`, and `pg@8.23.1`
- [X] T004 [P] Create `.env.example` for `development` (`yunpu_dev`, ports 3000/5432/9000) and `test` (`yunpu_test`, ports 3010/5433/9010), with a separate nonempty capability token per environment
- [ ] T005 [P] Update `.gitignore` so `.env`, `.env.test`, `.local/`, and `bun.lock` are ignored

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 配置校验、数据库角色和命令入口。未完成前不得开始用户故事

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 Generate `pnpm-lock.yaml` with `pnpm install` from the repository root. Later installs use `pnpm install --frozen-lockfile`
- [ ] T007 Implement `apps/api/src/env.ts` so `YUNPU_ENV` accepts only `development` or `test`（没有第三种）. The database name must be `yunpu_dev` or `yunpu_test` paired with that value. Reject `yunpu_prod` and any production target. The capability token is nonempty. Parse failure prints the failing fields and exits non-zero before the process listens
- [ ] T008 [P] Create `compose.yaml` with only `postgres:18` and one `quay.io/minio/minio server /data` process. Postgres is healthy only when `pg_isready` exits 0. MinIO is healthy only when `GET /minio/health/live` returns HTTP 200. `POSTGRES_USER` is the superuser owner, not `genealogy_app`. Do not add PgBouncer, Vite, Redis, a queue, or a search service
- [ ] T009 [P] Create `docker/postgres/init/01-role.sql` that creates `genealogy_app` with `LOGIN NOSUPERUSER NOBYPASSRLS`. The script runs only on an empty data directory
- [ ] T010 Export `{ port, fetch: app.fetch }` from `apps/api/src/index.ts` and call the parser in `apps/api/src/env.ts` before listening
- [ ] T011 Implement argument and prerequisite guards in `scripts/env.sh`: actions are `up|down|reset|ready`, names are `development|test`. Any other name, including production, exits non-zero and prints the allowed values. If `docker`, `pnpm`, or `bun` is missing, print that tool's name and exit non-zero

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - 一次拉起可工作的开发环境 (Priority: P1) 🎯 MVP

**Goal**: 开发者按一条路径启动开发环境，三项都就绪后打开产品能看到合成示例工作区，私有文件不能绕过应用读取

**Independent Test**: 在前置条件已齐、没有残留环境的机器上执行 `scripts/env.sh up development`，不向他人求助。`scripts/env.sh ready development` 退出码为 0，打开产品能看到示例工作区，绕过应用直接读取私有文件失败

### Tests for User Story 1

- [ ] T012 [P] [US1] Write a failing `app.request` test in `tests/env/dev-surface.test.ts` for `GET /api/health` and development `GET /`. Health 200 is `{ "ok": true, "checks": { "process": "up", "database": "up" } }` and the body has no `storage` field. The page body contains `示例工作区` and `yunpu-starter-workspace`

### Implementation for User Story 1

- [ ] T013 [US1] Implement `GET /api/health` in `apps/api/src/app.ts`. Return 200 with `{ "ok": true, "checks": { "process": "up", "database": "up" } }` when the database accepts a query. Return 503 with `ok` false and `database` `down` when it does not. Do not include `storage` and do not check the database generation
- [ ] T014 [US1] Implement `GET /api/ready` in `apps/api/src/app.ts`. Respond within 10 seconds. Return 200 only when `process`, `database`, and `storage` are `up` and `version` contains `PostgreSQL 18`. Otherwise return 503 with `ok` false and a `reason` on the failed check. `storage: up` requires MinIO live probe HTTP 200 and bucket access with this environment's credentials
- [ ] T015 [US1] Implement `GET /` in `apps/api/src/app.ts` for `development`. The body contains `示例工作区` and `yunpu-starter-workspace`, comes from configuration rather than a database row, and contains no real customer or family data
- [ ] T016 [P] [US1] Create the private bucket on startup in `apps/api/src/storage.ts`. If creation fails, exit the process. Do not call `mc anonymous` and do not set `acl: "public-read"`
- [ ] T017 [US1] Implement `up`, `ready`, and `down` for `development` in `scripts/env.sh`. Use project `yunpu-dev`, database `yunpu_dev`, and ports 3000/5432/9000. Reuse the volume when that project is already running. If another project holds a port, exit non-zero and print the port. Exit 0 only when `GET /api/ready` has `ok` true. `down` stops the pid in `.local/` and the two containers, frees those ports, and keeps the volume

**Checkpoint**: User Story 1 is independently testable. `ready development` reports three components and the starter page is visible

---

## Phase 4: User Story 2 - 测试环境证明基础设施能力 (Priority: P2)

**Goal**: 测试环境与开发环境数据隔离，每次启动都是空起点，隔离检查打在真实数据库上，只有本环境的能力令牌能经应用读写对象

**Independent Test**: 开发环境保持运行并已有数据时，启动测试环境。测试环境看不到开发环境的数据。`bun test --env-file .env.test` 在真实数据库上证明租户隔离；未出示本环境令牌的读取失败，出示正确令牌并经应用可以读回原对象

### Tests for User Story 2

- [ ] T018 [P] [US2] Write a failing test in `tests/env/infrastructure.test.ts` that refuses to skip when the test environment is down. It must use the real test database for the tenant-isolation proof, assert `SELECT version()` contains `PostgreSQL 18`, assert a direct unauthenticated object read is not HTTP 200, and assert the other environment's token is rejected

### Implementation for User Story 2

- [ ] T019 [US2] Implement `up test` in `scripts/env.sh` with project `yunpu-test`, database `yunpu_test`, and ports 3010/5433/9010. Delete this environment's database and object-storage volumes before each start so interrupted check data is not the empty baseline. Do not delete `yunpu-dev` volumes
- [ ] T020 [US2] Change `GET /` in `apps/api/src/app.ts` so `test` returns an empty state that does not contain `示例工作区` or `yunpu-starter-workspace`
- [ ] T021 [P] [US2] Implement `POST /api/media` and `GET /api/media/:key` in `apps/api/src/media.ts`. The body limit is 1 MB. The application generates the key and the caller cannot choose it. The correct capability token for this environment returns 201 on write and the same bytes on read
- [ ] T022 [US2] Reject media calls in `apps/api/src/media.ts` with 401 when the token is missing, wrong, or belongs to the other environment. Do not add product login
- [ ] T023 [US2] Create the proof fixture in `tests/env/proof-fixture.ts` and call it from `tests/env/infrastructure.test.ts`. The owner role creates it, `genealogy_app` is `NOSUPERUSER NOBYPASSRLS`, row security is enabled and forced, and a select without a tenant filter returns only the current tenant. Drop the fixture when the test ends, including on failure

**Checkpoint**: User Stories 1 and 2 both work. Development data remains visible only in the development environment

---

## Phase 5: User Story 3 - 把环境恢复到已知起点 (Priority: P3)

**Goal**: 恢复只清空被点名的环境并在两分钟内再次就绪。停止开发环境后再启动，上一轮数据仍在

**Independent Test**: 两个环境都写入可识别数据后，只恢复其中一个。另一环境的数据和就绪状态不变。停止开发环境后再启动，原数据仍在。再次启动测试环境后，上一轮检查数据为 0 条

### Tests for User Story 3

- [ ] T024 [P] [US3] Write a failing test in `tests/env/lifecycle.test.ts` that checks three outcomes: development data survives `down` then `up`, test data is gone after the next `up test`, and resetting one environment leaves the other environment's object count unchanged

### Implementation for User Story 3

- [ ] T025 [US3] Implement `reset` in `scripts/env.sh`. Delete only the named environment's volumes, then run the same path as `up`. Development returns to the starter page. Test returns to an empty page. The previous `POST /api/media` object in the reset environment is gone. Finish with `ok` true within 2 minutes
- [ ] T026 [US3] Keep `scripts/env.sh` from removing the other project during `reset`, `down`, or `up`. A write that arrives during reset is not present after reset completes

**Checkpoint**: All three user stories are independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 把新的就绪入口写回端点清单，并按 quickstart 走一遍

- [ ] T027 [P] Add `GET /api/ready` to `docs/architecture/api/endpoints.md` and state that `GET /api/health` still checks only the process and database. Do not add a domain error code to `docs/architecture/data/errors.md`
- [ ] T028 Run the scenarios in `specs/001-dev-test-environment/quickstart.md` and fix only failures that violate `specs/001-dev-test-environment/contracts/`
- [ ] T029 Confirm `compose.yaml` still has exactly two services and the repository has no `bun.lock`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in priority order (P1 → P2 → P3)
  - US2 and US3 edit `apps/api/src/app.ts` and `scripts/env.sh` after US1, so they are sequential on those files
- **Polish (Final Phase)**: Depends on the desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational. No dependency on US2 or US3
- **User Story 2 (P2)**: Starts after Foundational. Uses the same app and script as US1, and is tested with the development environment left running
- **User Story 3 (P3)**: Starts after US1 and US2 because reset and restart are defined on environments those stories create

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- The failing test task is the first task in that story
- Story complete before moving to the next priority

### Parallel Opportunities

- T002, T003, T004, and T005 can run in parallel
- After T006, T007, T008, and T009 can run in parallel
- T012 can be written while T016 is drafted
- T018 can be written while T021 is drafted
- T024 can be written before T025
- T027 can run alongside the quickstart once the routes exist

---

## Parallel Example: User Story 1

```bash
# Write the failing surface test and the storage helper in different files:
Task: "Write a failing app.request test in tests/env/dev-surface.test.ts"
Task: "Create the private bucket on startup in apps/api/src/storage.ts"
```

## Parallel Example: User Story 2

```bash
# Write the failing infrastructure test and the media routes in different files:
Task: "Write a failing test in tests/env/infrastructure.test.ts"
Task: "Implement POST /api/media and GET /api/media/:key in apps/api/src/media.ts"
```

## Parallel Example: User Story 3

```bash
# The lifecycle test is a different file from the script it will exercise:
Task: "Write a failing test in tests/env/lifecycle.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: `scripts/env.sh ready development` exits 0, and `GET /` shows `示例工作区`
5. Demonstrate the development environment before starting the test environment

### Incremental Delivery

1. Setup + Foundational → configuration fails loudly and the two containers are defined
2. User Story 1 → development environment is ready and shows the starter workspace
3. User Story 2 → test environment proves isolation and private objects
4. User Story 3 → reset and restart match the clarified data rules
5. Each story adds an environment behavior without replacing the previous one

### Parallel Team Strategy

With multiple developers:

1. Complete Setup and Foundational together
2. After that, one person owns `scripts/env.sh` and another owns `apps/api/src/`
3. Do not edit the same file in two stories at the same time

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps a task to a user story for traceability
- Each user story is independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate the story independently
- Avoid vague tasks, same-file conflicts, and a fourth infrastructure component
