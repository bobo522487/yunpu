import type {
  ApiRelationKind,
  CreatePersonInput,
  CreateRelationInput,
  SubgraphQueryInput,
  UpdatePersonInput,
} from "@yunpu/shared";
import { requireProjectMember } from "../../access";
import { withTenantTransaction } from "../../db/with-tenant-transaction";
import { notFound, versionConflict } from "../../lib/errors";
import {
  casUpdatePerson,
  countPersonsInProject,
  deletePerson,
  deleteRelation,
  getPerson,
  insertPerson,
  insertRelation,
  listPersons,
  type PersonView,
  personExistsInProject,
  querySubgraph,
  type RelationView,
} from "./queries";

function normalizeSpouse(
  fromPersonId: string,
  toPersonId: string,
): { fromPersonId: string; toPersonId: string } {
  return fromPersonId < toPersonId
    ? { fromPersonId, toPersonId }
    : { fromPersonId: toPersonId, toPersonId: fromPersonId };
}

export async function createPersonForProject(
  userId: string,
  projectId: string,
  input: CreatePersonInput,
): Promise<PersonView> {
  return withTenantTransaction({ userId }, async (db) => {
    const { organizationId } = await requireProjectMember(
      db,
      projectId,
      userId,
      "editor",
    );
    return insertPerson(db, organizationId, projectId, input);
  });
}

export async function getPersonForProject(
  userId: string,
  projectId: string,
  personId: string,
): Promise<PersonView> {
  return withTenantTransaction({ userId, readOnly: true }, async (db) => {
    await requireProjectMember(db, projectId, userId, null);
    const person = await getPerson(db, projectId, personId);
    if (!person) throw notFound();
    return person;
  });
}

export async function listPersonsForProject(
  userId: string,
  projectId: string,
  options: { cursor?: string; limit?: number },
): Promise<{ persons: PersonView[]; nextCursor: string | null }> {
  return withTenantTransaction({ userId, readOnly: true }, async (db) => {
    const { organizationId } = await requireProjectMember(
      db,
      projectId,
      userId,
      null,
    );
    return listPersons(db, organizationId, projectId, {
      cursor: options.cursor,
      limit: options.limit ?? 50,
    });
  });
}

export async function updatePersonForProject(
  userId: string,
  projectId: string,
  personId: string,
  input: UpdatePersonInput,
): Promise<PersonView> {
  return withTenantTransaction({ userId }, async (db) => {
    await requireProjectMember(db, projectId, userId, "editor");
    const { version, ...values } = input;
    const updated = await casUpdatePerson(
      db,
      projectId,
      personId,
      version,
      values,
    );
    if (updated) return updated;
    if (!(await personExistsInProject(db, projectId, personId))) {
      throw notFound();
    }
    throw versionConflict();
  });
}

export async function deletePersonForProject(
  userId: string,
  projectId: string,
  personId: string,
): Promise<void> {
  await withTenantTransaction({ userId }, async (db) => {
    await requireProjectMember(db, projectId, userId, "editor");
    const ok = await deletePerson(db, projectId, personId);
    if (!ok) throw notFound();
  });
}

export async function createRelationForProject(
  userId: string,
  projectId: string,
  input: CreateRelationInput,
): Promise<RelationView> {
  return withTenantTransaction({ userId }, async (db) => {
    const { organizationId } = await requireProjectMember(
      db,
      projectId,
      userId,
      "editor",
    );

    let fromPersonId = input.fromPersonId;
    let toPersonId = input.toPersonId;
    const kind = input.kind as ApiRelationKind;

    if (
      (await countPersonsInProject(db, projectId, [
        fromPersonId,
        toPersonId,
      ])) !== 2
    ) {
      throw notFound();
    }

    if (kind === "spouse") {
      ({ fromPersonId, toPersonId } = normalizeSpouse(
        fromPersonId,
        toPersonId,
      ));
    }

    return insertRelation(db, organizationId, projectId, {
      fromPersonId,
      toPersonId,
      kind,
    });
  });
}

export async function deleteRelationForProject(
  userId: string,
  projectId: string,
  relationId: string,
): Promise<void> {
  await withTenantTransaction({ userId }, async (db) => {
    await requireProjectMember(db, projectId, userId, "editor");
    const deleted = await deleteRelation(db, projectId, relationId);
    if (!deleted) throw notFound();
  });
}

export async function getSubgraphForProject(
  userId: string,
  projectId: string,
  query: SubgraphQueryInput,
) {
  return withTenantTransaction({ userId, readOnly: true }, async (db) => {
    const { organizationId } = await requireProjectMember(
      db,
      projectId,
      userId,
      null,
    );
    const graph = await querySubgraph(db, organizationId, projectId, {
      rootPersonId: query.rootPersonId,
      upDepth: query.upDepth ?? 2,
      downDepth: query.downDepth ?? 4,
      limit: query.limit ?? 300,
    });
    if (!graph) throw notFound();
    return graph;
  });
}
