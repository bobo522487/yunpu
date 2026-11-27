import type {
  CreatePersonInput,
  GenealogyDateInput,
  PersonDeathInfoInput,
  SubgraphQueryInput,
  UpdatePersonInput,
} from "@yunpu/shared";
import { requireProjectMember } from "../../access";
import {
  type TxDatabase,
  withTenantTransaction,
} from "../../db/with-tenant-transaction";
import { notFound, validationError, versionConflict } from "../../lib/errors";
import { queryLineageGraphData, querySubgraph } from "./graph-queries";
import {
  casUpdatePerson,
  deletePerson,
  getPerson,
  getPersonLivingState,
  insertPerson,
  lineageExistsInProject,
  listPersons,
  personExistsInProject,
  resolveOrCreateDefaultLineageId,
} from "./person-queries";
import type { PersonView, ProjectionView, RelationView } from "./person-views";

function extractGregorianYear(
  date: GenealogyDateInput | null | undefined,
): number | undefined {
  if (!date || date.kind !== "date" || date.calendar !== "gregorian") {
    return undefined;
  }
  const parts = date.parts as { year?: unknown };
  return typeof parts.year === "number" && Number.isInteger(parts.year)
    ? parts.year
    : undefined;
}

export function assertLivingDeathConsistency(
  isLiving: boolean,
  deathInfo: PersonDeathInfoInput | null | undefined,
): void {
  if (isLiving && deathInfo) {
    throw validationError({
      deathInfo: ["在世人物不能填写死亡或葬地信息"],
    });
  }
}

export function resolveUpdateLifeYears(values: {
  birthYear?: number | null;
  deathYear?: number | null;
  birthInfo?: UpdatePersonInput["birthInfo"];
  deathInfo?: UpdatePersonInput["deathInfo"];
}): {
  birthYear: number | null | undefined;
  deathYear: number | null | undefined;
} {
  const birthYear =
    values.birthYear !== undefined
      ? values.birthYear
      : values.birthInfo !== undefined
        ? (extractGregorianYear(values.birthInfo?.structuredDate) ?? null)
        : undefined;
  const deathYear =
    values.deathYear !== undefined
      ? values.deathYear
      : values.deathInfo !== undefined
        ? (extractGregorianYear(values.deathInfo?.structuredDate) ?? null)
        : undefined;
  return { birthYear, deathYear };
}

/** Create a person inside an existing tenant transaction. */
export async function createPersonInTx(
  db: TxDatabase,
  organizationId: string,
  projectId: string,
  input: CreatePersonInput,
): Promise<PersonView> {
  let lineageId = input.lineageId;
  if (lineageId) {
    if (!(await lineageExistsInProject(db, projectId, lineageId))) {
      throw notFound();
    }
  } else {
    lineageId = await resolveOrCreateDefaultLineageId(
      db,
      organizationId,
      projectId,
    );
  }

  const birthYear =
    input.birthYear ?? extractGregorianYear(input.birthInfo?.structuredDate);
  const deathYear =
    input.deathYear ?? extractGregorianYear(input.deathInfo?.structuredDate);
  const isLiving = input.isLiving ?? true;

  assertLivingDeathConsistency(isLiving, input.deathInfo);

  return insertPerson(db, organizationId, projectId, {
    ...input,
    lineageId,
    birthYear,
    deathYear,
    isLiving,
  });
}

/** Load persons, relations, and projections for a lineage inside an existing transaction. */
export async function loadLineageGraphDataInTx(
  db: TxDatabase,
  organizationId: string,
  projectId: string,
  lineageId: string,
): Promise<{
  persons: PersonView[];
  relations: RelationView[];
  projections: ProjectionView[];
}> {
  return queryLineageGraphData(db, organizationId, projectId, lineageId);
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
    return createPersonInTx(db, organizationId, projectId, input);
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
  options: { lineageId?: string; cursor?: string; limit?: number },
): Promise<{ persons: PersonView[]; nextCursor: string | null }> {
  return withTenantTransaction({ userId, readOnly: true }, async (db) => {
    const { organizationId } = await requireProjectMember(
      db,
      projectId,
      userId,
      null,
    );
    return listPersons(db, organizationId, projectId, {
      lineageId: options.lineageId,
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
    const existingState = await getPersonLivingState(db, projectId, personId);
    if (!existingState) throw notFound();

    const { version, ...values } = input;
    assertLivingDeathConsistency(
      values.isLiving ?? existingState.isLiving,
      values.deathInfo === undefined
        ? existingState.deathInfo
        : values.deathInfo,
    );

    const { birthYear, deathYear } = resolveUpdateLifeYears(values);

    const updated = await casUpdatePerson(db, projectId, personId, version, {
      ...values,
      birthYear,
      deathYear,
    });
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
