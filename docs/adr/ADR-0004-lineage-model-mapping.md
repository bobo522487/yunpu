---
status: superseded
---

# ADR-0004: Lineage model mapping (Superseded)

## Context

An earlier 2026-11-23 architecture proposal assumed a 22-table legacy schema (`node`, `relation_edge`, etc.) and mapped three conceptual tables onto it.

## Decision

**This mapping was NOT adopted.** 在早期架构精简批次中，仓库从 `packages/db/migrations/0012_genealogy_core.sql` 开始直接实现具体的家谱核心模型 `packages/db/src/schema/genealogy.ts`：

- `person`: core person entity (`sex`, `surname`, `birth_year`, `death_year`, `is_living`, `version`).
- `person_name`: multi-kind names (`formal`, `courtesy`, `art`, `milk`, `genealogy`, `posthumous`, `other`) with partial unique index for `is_primary`.
- `person_relation`: lineage and spouse/partner edges (`ck_person_relation_not_self`, symmetric ordering `from_person_id < to_person_id` for `spouse`/`partner`, parent limit `GX011`, cycle check `GX001`).
- `lineage_projection`: concrete projection table storing PostgreSQL `ltree` `primary_path` and `generation`, updated in the same transaction.

## Status

Superseded by `packages/db/migrations/0012_genealogy_core.sql`–`0014_write_policies.sql` and `packages/db/src/schema/genealogy.ts`.
