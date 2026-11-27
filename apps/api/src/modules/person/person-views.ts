import { person, personEvent, personName, personRelation } from "@yunpu/db";
import type {
  ApiRelationKind,
  GenealogyDateInput,
  GenealogyPlaceInput,
  PersonBirthInfoInput,
  PersonDeathInfoInput,
  PersonEventType,
  PersonNameKind,
  PersonSex,
} from "@yunpu/shared";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { TxDatabase } from "../../db/with-tenant-transaction";
import { isoTimestamp as timestamp } from "../../lib/sql";

export type PersonNameView = {
  id: string;
  projectId: string;
  personId: string;
  kind: PersonNameKind;
  value: string;
  surname: string | null;
  romanizedSurname: string | null;
  romanizedName: string | null;
  label: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PersonEventView = {
  id: string;
  projectId: string;
  personId: string;
  type: PersonEventType;
  structuredDate: GenealogyDateInput | null;
  structuredPlace: GenealogyPlaceInput | null;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type PersonView = {
  id: string;
  projectId: string;
  lineageId: string;
  displayName: string;
  sex: PersonSex;
  surname: string | null;
  givenName: string | null;
  romanizedSurname: string | null;
  romanizedName: string | null;
  romanizedSuffix: string | null;
  birthYear: number | null;
  deathYear: number | null;
  isLiving: boolean;
  birthInfo: PersonBirthInfoInput | null;
  deathInfo: PersonDeathInfoInput | null;
  generationWord: string | null;
  relationTitle: string | null;
  siblingOrder: number | null;
  biography: string | null;
  notes: string | null;
  avatarKey: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  names?: PersonNameView[];
  events?: PersonEventView[];
};

export type RelationView = {
  id: string;
  projectId: string;
  fromPersonId: string;
  toPersonId: string;
  kind: ApiRelationKind | string;
  fromRoleLabel: string | null;
  toRoleLabel: string | null;
  sortOrder: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectionView = {
  personId: string;
  primaryPath: string;
  generation: number;
};

export type SubgraphResult = {
  rootPersonId: string;
  persons: PersonView[];
  relations: RelationView[];
  hasMoreAncestors: boolean;
  hasMoreDescendants: boolean;
};

export const personBaseColumns = {
  id: person.id,
  projectId: person.projectId,
  lineageId: person.lineageId,
  sex: person.sex,
  surname: person.surname,
  givenName: person.givenName,
  romanizedSurname: person.romanizedSurname,
  romanizedName: person.romanizedName,
  romanizedSuffix: person.romanizedSuffix,
  birthYear: person.birthYear,
  deathYear: person.deathYear,
  isLiving: person.isLiving,
  birthInfo: person.birthInfo,
  deathInfo: person.deathInfo,
  generationWord: person.generationWord,
  relationTitle: person.relationTitle,
  siblingOrder: person.siblingOrder,
  biography: person.biography,
  notes: person.notes,
  avatarKey: person.avatarKey,
  version: person.version,
  createdAt: timestamp(person.createdAt),
  updatedAt: timestamp(person.updatedAt),
};

export const personNameColumns = {
  id: personName.id,
  projectId: personName.projectId,
  personId: personName.personId,
  kind: personName.kind,
  value: personName.value,
  surname: personName.surname,
  romanizedSurname: personName.romanizedSurname,
  romanizedName: personName.romanizedName,
  label: personName.label,
  isPrimary: personName.isPrimary,
  createdAt: timestamp(personName.createdAt),
  updatedAt: timestamp(personName.updatedAt),
};

export const personEventColumns = {
  id: personEvent.id,
  projectId: personEvent.projectId,
  personId: personEvent.personId,
  type: personEvent.type,
  structuredDate: personEvent.structuredDate,
  structuredPlace: personEvent.structuredPlace,
  description: personEvent.description,
  sortOrder: personEvent.sortOrder,
  createdAt: timestamp(personEvent.createdAt),
  updatedAt: timestamp(personEvent.updatedAt),
};

export const relationColumns = {
  id: personRelation.id,
  projectId: personRelation.projectId,
  fromPersonId: personRelation.fromPersonId,
  toPersonId: personRelation.toPersonId,
  kind: personRelation.kind,
  fromRoleLabel: personRelation.fromRoleLabel,
  toRoleLabel: personRelation.toRoleLabel,
  sortOrder: personRelation.sortOrder,
  note: personRelation.note,
  createdAt: timestamp(personRelation.createdAt),
  updatedAt: timestamp(personRelation.updatedAt),
};

export function mapPersonRow(row: {
  id: string;
  projectId: string;
  lineageId: string;
  displayName: string;
  sex: PersonSex;
  surname: string | null;
  givenName: string | null;
  romanizedSurname: string | null;
  romanizedName: string | null;
  romanizedSuffix: string | null;
  birthYear: number | null;
  deathYear: number | null;
  isLiving: boolean;
  birthInfo: unknown;
  deathInfo: unknown;
  generationWord: string | null;
  relationTitle: string | null;
  siblingOrder: number | null;
  biography: string | null;
  notes: string | null;
  avatarKey: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}): PersonView {
  return {
    ...row,
    birthInfo: (row.birthInfo as PersonBirthInfoInput | null) ?? null,
    deathInfo: (row.deathInfo as PersonDeathInfoInput | null) ?? null,
  };
}

export function mapEventRow(row: {
  id: string;
  projectId: string;
  personId: string;
  type: PersonEventType;
  structuredDate: unknown;
  structuredPlace: unknown;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}): PersonEventView {
  return {
    ...row,
    structuredDate: (row.structuredDate as GenealogyDateInput | null) ?? null,
    structuredPlace:
      (row.structuredPlace as GenealogyPlaceInput | null) ?? null,
  };
}

export async function hydratePersonsDetails(
  db: TxDatabase,
  projectId: string,
  persons: PersonView[],
  options: { includeNames?: boolean; includeEvents?: boolean } = {},
): Promise<PersonView[]> {
  if (persons.length === 0) return [];
  const includeNames = options.includeNames ?? true;
  const includeEvents = options.includeEvents ?? true;
  if (!includeNames && !includeEvents) return persons;

  const personIds = persons.map((item) => item.id);
  const [nameRows, eventRows] = await Promise.all([
    includeNames
      ? db
          .select(personNameColumns)
          .from(personName)
          .where(
            and(
              eq(personName.projectId, projectId),
              inArray(personName.personId, personIds),
            ),
          )
          .orderBy(asc(personName.createdAt), asc(personName.id))
      : Promise.resolve([]),
    includeEvents
      ? db
          .select(personEventColumns)
          .from(personEvent)
          .where(
            and(
              eq(personEvent.projectId, projectId),
              inArray(personEvent.personId, personIds),
            ),
          )
          .orderBy(asc(personEvent.sortOrder), asc(personEvent.createdAt))
      : Promise.resolve([]),
  ]);

  const namesByPerson = new Map<string, PersonNameView[]>();
  for (const row of nameRows) {
    const list = namesByPerson.get(row.personId) ?? [];
    list.push(row);
    namesByPerson.set(row.personId, list);
  }

  const eventsByPerson = new Map<string, PersonEventView[]>();
  for (const row of eventRows) {
    const list = eventsByPerson.get(row.personId) ?? [];
    list.push(mapEventRow(row));
    eventsByPerson.set(row.personId, list);
  }

  return persons.map((item) => {
    const names = namesByPerson.get(item.id) ?? [];
    const primaryName = names.find((n) => n.isPrimary)?.value;
    return {
      ...item,
      ...(includeNames
        ? {
            displayName: primaryName ?? item.displayName ?? item.surname ?? "",
            names,
          }
        : {}),
      ...(includeEvents ? { events: eventsByPerson.get(item.id) ?? [] } : {}),
    };
  });
}
