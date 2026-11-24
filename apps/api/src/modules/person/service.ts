import type { ApiRelationKind } from "@yunpu/shared";
import { sql } from "drizzle-orm";
import { withTenantTransaction } from "../../db/with-tenant-transaction";
import { AppError, mapDatabaseError } from "../../lib/errors";
import {
  conflict,
  cycleDetected,
  forbidden,
  parentLimit,
  personNotFound,
  versionConflict,
} from "./errors";
import {
  casUpdatePerson,
  countParentsOfKind,
  deletePerson,
  deleteRelation,
  getPerson,
  getProjectScope,
  hasRole,
  insertPerson,
  insertRelation,
  membershipRole,
  organizationStatus,
  type PersonView,
  personExistsInProject,
  querySubgraph,
  type RelationView,
  refreshLineageProjectionSubtree,
} from "./queries";
import type {
  CreatePersonInput,
  CreateRelationInput,
  SubgraphQueryInput,
  UpdatePersonInput,
} from "./schema";

function asAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const mapped = mapDatabaseError(error);
  if (mapped.code === "CYCLE_DETECTED") return cycleDetected();
  return mapped;
}

function normalizeSpouse(
  fromPersonId: string,
  toPersonId: string,
): { fromPersonId: string; toPersonId: string } {
  return fromPersonId < toPersonId
    ? { fromPersonId, toPersonId }
    : { fromPersonId: toPersonId, toPersonId: fromPersonId };
}

async function requireRole(
  db: Parameters<typeof membershipRole>[0],
  organizationId: string,
  userId: string,
  min: "editor" | "admin",
): Promise<void> {
  const role = await membershipRole(db, organizationId, userId);
  if (role === null) throw personNotFound();
  if (!hasRole(role, min)) throw forbidden();
}

async function requireActiveOrganization(
  db: Parameters<typeof organizationStatus>[0],
  organizationId: string,
): Promise<void> {
  const status = await organizationStatus(db, organizationId);
  if (status !== "active") {
    throw conflict("组织已归档，无法写入");
  }
}

async function resolveProjectScope(
  db: Parameters<typeof getProjectScope>[0],
  projectId: string,
): Promise<{ id: string; organizationId: string }> {
  const scope = await getProjectScope(db, projectId);
  if (!scope) throw personNotFound();
  return scope;
}

export async function createPersonForProject(
  userId: string,
  projectId: string,
  input: CreatePersonInput,
): Promise<PersonView> {
  try {
    return await withTenantTransaction({ userId }, async (db) => {
      const scope = await resolveProjectScope(db, projectId);
      await requireRole(db, scope.organizationId, userId, "editor");
      await requireActiveOrganization(db, scope.organizationId);
      return insertPerson(db, scope.organizationId, projectId, {
        displayName: input.displayName,
        sex: input.sex,
        surname: input.surname,
        birthYear: input.birthYear,
        deathYear: input.deathYear,
        isLiving: input.isLiving,
      });
    });
  } catch (error) {
    throw asAppError(error);
  }
}

export async function getPersonForProject(
  userId: string,
  projectId: string,
  personId: string,
): Promise<PersonView> {
  try {
    return await withTenantTransaction({ userId }, async (db) => {
      const scope = await resolveProjectScope(db, projectId);
      const role = await membershipRole(db, scope.organizationId, userId);
      if (role === null) throw personNotFound();
      const person = await getPerson(db, projectId, personId);
      if (!person) throw personNotFound();
      return person;
    });
  } catch (error) {
    throw asAppError(error);
  }
}

export async function updatePersonForProject(
  userId: string,
  projectId: string,
  personId: string,
  input: UpdatePersonInput,
): Promise<PersonView> {
  try {
    return await withTenantTransaction({ userId }, async (db) => {
      const scope = await resolveProjectScope(db, projectId);
      await requireRole(db, scope.organizationId, userId, "editor");
      await requireActiveOrganization(db, scope.organizationId);
      const existing = await getPerson(db, projectId, personId);
      if (!existing) throw personNotFound();
      const updated = await casUpdatePerson(
        db,
        projectId,
        personId,
        input.version,
        {
          displayName: input.displayName,
          sex: input.sex,
          surname: input.surname,
          birthYear: input.birthYear,
          deathYear: input.deathYear,
          isLiving: input.isLiving,
        },
      );
      if (!updated) throw versionConflict();
      return updated;
    });
  } catch (error) {
    throw asAppError(error);
  }
}

export async function deletePersonForProject(
  userId: string,
  projectId: string,
  personId: string,
): Promise<void> {
  try {
    await withTenantTransaction({ userId }, async (db) => {
      const scope = await resolveProjectScope(db, projectId);
      await requireRole(db, scope.organizationId, userId, "editor");
      await requireActiveOrganization(db, scope.organizationId);
      const ok = await deletePerson(db, projectId, personId);
      if (!ok) throw personNotFound();
    });
  } catch (error) {
    throw asAppError(error);
  }
}

export async function createRelationForProject(
  userId: string,
  projectId: string,
  input: CreateRelationInput,
): Promise<RelationView> {
  try {
    return await withTenantTransaction({ userId }, async (db) => {
      const scope = await resolveProjectScope(db, projectId);
      await requireRole(db, scope.organizationId, userId, "editor");
      await requireActiveOrganization(db, scope.organizationId);

      let fromPersonId = input.fromPersonId;
      let toPersonId = input.toPersonId;
      const kind = input.kind as ApiRelationKind;

      if (!(await personExistsInProject(db, projectId, fromPersonId))) {
        throw personNotFound();
      }
      if (!(await personExistsInProject(db, projectId, toPersonId))) {
        throw personNotFound();
      }

      if (kind === "spouse") {
        ({ fromPersonId, toPersonId } = normalizeSpouse(
          fromPersonId,
          toPersonId,
        ));
      }

      if (kind === "biological_parent" || kind === "adoptive_parent") {
        const count = await countParentsOfKind(db, projectId, toPersonId, kind);
        if (count >= 2) throw parentLimit();
      }

      const created = await insertRelation(
        db,
        scope.organizationId,
        projectId,
        {
          fromPersonId,
          toPersonId,
          kind,
        },
      );

      if (kind === "biological_parent" || kind === "adoptive_parent") {
        // Force deferred cycle trigger before projection rebuild.
        await db.execute(
          sql`SET CONSTRAINTS trg_person_relation_no_cycle IMMEDIATE`,
        );
        await refreshLineageProjectionSubtree(
          db,
          scope.organizationId,
          projectId,
          toPersonId,
        );
      }

      return created;
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    const mapped = mapDatabaseError(error);
    if (mapped.code === "CYCLE_DETECTED") throw cycleDetected();
    if (mapped.code === "CONFLICT") throw conflict("这条关系已存在");
    throw mapped;
  }
}

export async function deleteRelationForProject(
  userId: string,
  projectId: string,
  relationId: string,
): Promise<void> {
  try {
    await withTenantTransaction({ userId }, async (db) => {
      const scope = await resolveProjectScope(db, projectId);
      await requireRole(db, scope.organizationId, userId, "editor");
      await requireActiveOrganization(db, scope.organizationId);
      const deleted = await deleteRelation(db, projectId, relationId);
      if (!deleted) throw personNotFound();
      if (
        deleted.kind === "biological_parent" ||
        deleted.kind === "adoptive_parent" ||
        deleted.kind === "ritual_heir"
      ) {
        await refreshLineageProjectionSubtree(
          db,
          scope.organizationId,
          projectId,
          deleted.toPersonId,
        );
      }
    });
  } catch (error) {
    throw asAppError(error);
  }
}

export async function getSubgraphForProject(
  userId: string,
  projectId: string,
  query: SubgraphQueryInput,
) {
  try {
    return await withTenantTransaction({ userId }, async (db) => {
      const scope = await resolveProjectScope(db, projectId);
      const role = await membershipRole(db, scope.organizationId, userId);
      if (role === null) throw personNotFound();
      const graph = await querySubgraph(db, projectId, {
        rootPersonId: query.rootPersonId,
        upDepth: query.upDepth ?? 2,
        downDepth: query.downDepth ?? 4,
        limit: query.limit ?? 300,
      });
      if (!graph) throw personNotFound();
      return graph;
    });
  } catch (error) {
    throw asAppError(error);
  }
}
