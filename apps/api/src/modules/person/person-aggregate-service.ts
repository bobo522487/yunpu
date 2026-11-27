import type {
  CreateRelativeInput,
  UpdatePersonAggregateInput,
} from "@yunpu/shared";
import { requireProjectMember } from "../../access";
import {
  type TxDatabase,
  withTenantTransaction,
} from "../../db/with-tenant-transaction";
import { notFound, validationError, versionConflict } from "../../lib/errors";
import { deletePersonEvent, updatePersonEvent } from "./name-event-queries";
import {
  assertLivingDeathConsistency,
  createPersonInTx,
  resolveUpdateLifeYears,
} from "./person-core-service";
import {
  createPersonEventInTx,
  createPersonNameInTx,
  createRelationInTx,
  deletePersonNameInTx,
  updatePersonNameInTx,
  updateRelationInTx,
} from "./person-detail-service";
import {
  casUpdatePerson,
  getPerson,
  getPersonAnchorInfo,
  getPersonLivingState,
} from "./person-queries";
import type {
  PersonEventView,
  PersonView,
  ProjectionView,
  RelationView,
} from "./person-views";
import {
  deleteRelation,
  getProjectionForPerson,
  getRelation,
  listRelationsForPerson,
} from "./relation-queries";

async function applyAggregateNamesInTx(
  db: TxDatabase,
  organizationId: string,
  projectId: string,
  personId: string,
  names: NonNullable<UpdatePersonAggregateInput["names"]>,
): Promise<void> {
  for (const nameId of names.deleteIds ?? []) {
    await deletePersonNameInTx(db, projectId, personId, nameId);
  }
  for (const { id, ...patch } of names.update ?? []) {
    await updatePersonNameInTx(db, projectId, personId, id, patch);
  }
  for (const item of names.create ?? []) {
    await createPersonNameInTx(db, organizationId, projectId, personId, item);
  }
}

async function applyAggregateEventsInTx(
  db: TxDatabase,
  organizationId: string,
  projectId: string,
  personId: string,
  events: NonNullable<UpdatePersonAggregateInput["events"]>,
): Promise<void> {
  for (const eventId of events.deleteIds ?? []) {
    const deleted = await deletePersonEvent(db, projectId, personId, eventId);
    if (!deleted) throw notFound();
  }
  for (const { id, ...patch } of events.update ?? []) {
    const updated = await updatePersonEvent(db, projectId, personId, id, patch);
    if (!updated) throw notFound();
  }
  for (const item of events.create ?? []) {
    await createPersonEventInTx(db, organizationId, projectId, personId, item);
  }
}

async function applyAggregateRelationsInTx(
  db: TxDatabase,
  organizationId: string,
  projectId: string,
  personId: string,
  relations: NonNullable<UpdatePersonAggregateInput["relations"]>,
): Promise<void> {
  for (const relationId of relations.deleteIds ?? []) {
    const existing = await getRelation(db, projectId, relationId);
    if (
      !existing ||
      (existing.fromPersonId !== personId && existing.toPersonId !== personId)
    ) {
      throw notFound();
    }
    const deleted = await deleteRelation(db, projectId, relationId);
    if (!deleted) throw notFound();
  }
  for (const { id, ...patch } of relations.update ?? []) {
    await updateRelationInTx(db, projectId, id, patch, personId);
  }
  for (const item of relations.create ?? []) {
    if (item.fromPersonId !== personId && item.toPersonId !== personId) {
      throw validationError({
        relations: ["关系必须关联当前人物"],
      });
    }
    await createRelationInTx(db, organizationId, projectId, item);
  }
}

export async function updatePersonAggregateForProject(
  userId: string,
  projectId: string,
  personId: string,
  input: UpdatePersonAggregateInput,
): Promise<{
  person: PersonView;
  relations: RelationView[];
  projection: ProjectionView | null;
}> {
  return withTenantTransaction({ userId }, async (db) => {
    const { organizationId } = await requireProjectMember(
      db,
      projectId,
      userId,
      "editor",
    );
    const existingState = await getPersonLivingState(db, projectId, personId);
    if (!existingState) throw notFound();

    const scalarValues = input.person ?? {};
    assertLivingDeathConsistency(
      scalarValues.isLiving ?? existingState.isLiving,
      scalarValues.deathInfo === undefined
        ? existingState.deathInfo
        : scalarValues.deathInfo,
    );

    const { birthYear, deathYear } = resolveUpdateLifeYears(scalarValues);
    const updated = await casUpdatePerson(
      db,
      projectId,
      personId,
      input.version,
      {
        ...scalarValues,
        birthYear,
        deathYear,
      },
    );
    if (!updated) {
      throw versionConflict();
    }

    if (input.names) {
      await applyAggregateNamesInTx(
        db,
        organizationId,
        projectId,
        personId,
        input.names,
      );
    }
    if (input.events) {
      await applyAggregateEventsInTx(
        db,
        organizationId,
        projectId,
        personId,
        input.events,
      );
    }
    if (input.relations) {
      await applyAggregateRelationsInTx(
        db,
        organizationId,
        projectId,
        personId,
        input.relations,
      );
    }

    const [person, relations, projection] = await Promise.all([
      getPerson(db, projectId, personId),
      listRelationsForPerson(db, projectId, personId),
      getProjectionForPerson(db, projectId, personId),
    ]);

    return {
      person: person ?? updated,
      relations,
      projection,
    };
  });
}

export async function createRelativeForProject(
  userId: string,
  projectId: string,
  input: CreateRelativeInput,
): Promise<{
  person: PersonView;
  companionPerson: PersonView | null;
  relations: RelationView[];
  anchorEvents: PersonEventView[];
}> {
  return withTenantTransaction({ userId }, async (db) => {
    const { organizationId } = await requireProjectMember(
      db,
      projectId,
      userId,
      "editor",
    );
    const anchor = await getPersonAnchorInfo(
      db,
      projectId,
      input.anchorPersonId,
    );
    if (!anchor) throw notFound();

    const createdPerson = await createPersonInTx(
      db,
      organizationId,
      projectId,
      {
        ...input.person,
        lineageId: input.person.lineageId ?? anchor.lineageId,
      },
    );

    for (const item of input.names ?? []) {
      await createPersonNameInTx(
        db,
        organizationId,
        projectId,
        createdPerson.id,
        item,
      );
    }

    for (const item of input.events ?? []) {
      await createPersonEventInTx(
        db,
        organizationId,
        projectId,
        createdPerson.id,
        item,
      );
    }

    const createdRelations: RelationView[] = [];
    for (const rel of input.relations) {
      const otherPersonId = rel.otherPersonId ?? input.anchorPersonId;
      const fromPersonId =
        rel.direction === "new_to_other" ? createdPerson.id : otherPersonId;
      const toPersonId =
        rel.direction === "new_to_other" ? otherPersonId : createdPerson.id;
      createdRelations.push(
        await createRelationInTx(db, organizationId, projectId, {
          fromPersonId,
          toPersonId,
          kind: rel.kind,
          fromRoleLabel: rel.fromRoleLabel,
          toRoleLabel: rel.toRoleLabel,
          sortOrder: rel.sortOrder,
          note: rel.note,
        }),
      );
    }

    let companionPerson: PersonView | null = null;
    if (input.companion) {
      companionPerson = await createPersonInTx(db, organizationId, projectId, {
        ...input.companion.person,
        lineageId: input.companion.person.lineageId ?? createdPerson.lineageId,
      });
      if (input.companion.spouseRelation) {
        createdRelations.push(
          await createRelationInTx(db, organizationId, projectId, {
            fromPersonId: input.anchorPersonId,
            toPersonId: companionPerson.id,
            kind: "spouse",
            fromRoleLabel: input.companion.spouseRelation.fromRoleLabel,
            toRoleLabel: input.companion.spouseRelation.toRoleLabel,
            sortOrder: input.companion.spouseRelation.sortOrder,
          }),
        );
      }
      createdRelations.push(
        await createRelationInTx(db, organizationId, projectId, {
          fromPersonId: companionPerson.id,
          toPersonId: createdPerson.id,
          kind: input.companion.childRelation.kind,
          toRoleLabel: input.companion.childRelation.toRoleLabel,
        }),
      );
    }

    const anchorEvents: PersonEventView[] = [];
    for (const ev of input.anchorEvents ?? []) {
      anchorEvents.push(
        await createPersonEventInTx(
          db,
          organizationId,
          projectId,
          input.anchorPersonId,
          ev,
        ),
      );
    }

    const person =
      (await getPerson(db, projectId, createdPerson.id)) ?? createdPerson;

    return {
      person,
      companionPerson,
      relations: createdRelations,
      anchorEvents,
    };
  });
}
