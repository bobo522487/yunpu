import type {
  ApiRelationKind,
  CreatePersonInput,
  CreateRelationInput,
  SubgraphQueryInput,
  UpdatePersonInput,
} from "@yunpu/shared";
import { requireMember } from "../../access";
import { withTenantTransaction } from "../../db/with-tenant-transaction";
import {
  AppError,
  conflict,
  cycleDetected,
  mapDatabaseError,
  notFound,
  versionConflict,
} from "../../lib/errors";
import {
  casUpdatePerson,
  deletePerson,
  deleteRelation,
  getPerson,
  getProjectScope,
  insertPerson,
  insertRelation,
  listPersons,
  type PersonView,
  personExistsInProject,
  querySubgraph,
  type RelationView,
} from "./queries";

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

async function resolveProjectScope(
  db: Parameters<typeof getProjectScope>[0],
  projectId: string,
): Promise<{ id: string; organizationId: string }> {
  const scope = await getProjectScope(db, projectId);
  if (!scope) throw notFound();
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
      await requireMember(db, scope.organizationId, userId, "editor");
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
      await requireMember(db, scope.organizationId, userId, null);
      const person = await getPerson(db, projectId, personId);
      if (!person) throw notFound();
      return person;
    });
  } catch (error) {
    throw asAppError(error);
  }
}

export async function listPersonsForProject(
  userId: string,
  projectId: string,
): Promise<PersonView[]> {
  try {
    return await withTenantTransaction({ userId }, async (db) => {
      const scope = await resolveProjectScope(db, projectId);
      await requireMember(db, scope.organizationId, userId, null);
      return listPersons(db, scope.organizationId, projectId);
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
      await requireMember(db, scope.organizationId, userId, "editor");
      const existing = await getPerson(db, projectId, personId);
      if (!existing) throw notFound();
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
      await requireMember(db, scope.organizationId, userId, "editor");
      const ok = await deletePerson(db, projectId, personId);
      if (!ok) throw notFound();
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
      await requireMember(db, scope.organizationId, userId, "editor");

      let fromPersonId = input.fromPersonId;
      let toPersonId = input.toPersonId;
      const kind = input.kind as ApiRelationKind;

      if (!(await personExistsInProject(db, projectId, fromPersonId))) {
        throw notFound();
      }
      if (!(await personExistsInProject(db, projectId, toPersonId))) {
        throw notFound();
      }

      if (kind === "spouse") {
        ({ fromPersonId, toPersonId } = normalizeSpouse(
          fromPersonId,
          toPersonId,
        ));
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

      return created;
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    const mapped = mapDatabaseError(error);
    if (mapped.code === "CYCLE_DETECTED") throw cycleDetected();
    if (mapped.code === "CONFLICT" && mapped.message === "记录已存在") {
      throw conflict("这条关系已存在");
    }
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
      await requireMember(db, scope.organizationId, userId, "editor");
      const deleted = await deleteRelation(db, projectId, relationId);
      if (!deleted) throw notFound();
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
      await requireMember(db, scope.organizationId, userId, null);
      const graph = await querySubgraph(db, scope.organizationId, projectId, {
        rootPersonId: query.rootPersonId,
        upDepth: query.upDepth ?? 2,
        downDepth: query.downDepth ?? 4,
        limit: query.limit ?? 300,
      });
      if (!graph) throw notFound();
      return graph;
    });
  } catch (error) {
    throw asAppError(error);
  }
}
