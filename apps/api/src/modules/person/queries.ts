import {
  lineageProjection,
  person,
  personName,
  personRelation,
  project,
} from "@yunpu/db";
import type { ApiRelationKind, PersonSex } from "@yunpu/shared";
import { and, eq, gt, sql } from "drizzle-orm";
import type { TxDatabase } from "../../db/with-tenant-transaction";
import { validationError } from "../../lib/errors";
import { isoTimestamp as timestamp } from "../../lib/sql";

export type PersonView = {
  id: string;
  projectId: string;
  displayName: string;
  sex: PersonSex;
  surname: string | null;
  birthYear: number | null;
  deathYear: number | null;
  isLiving: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type RelationView = {
  id: string;
  projectId: string;
  fromPersonId: string;
  toPersonId: string;
  kind: ApiRelationKind | string;
  createdAt: string;
  updatedAt: string;
};

function pathLabel(personId: string): string {
  return personId.replace(/-/g, "");
}

export async function getProjectScope(
  db: TxDatabase,
  projectId: string,
): Promise<{ id: string; organizationId: string } | null> {
  const rows = await db
    .select({ id: project.id, organizationId: project.organizationId })
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1);
  return rows[0] ?? null;
}

async function loadPersonView(
  db: TxDatabase,
  projectId: string,
  personId: string,
): Promise<PersonView | null> {
  const rows = await db
    .select({
      id: person.id,
      projectId: person.projectId,
      displayName: personName.value,
      sex: person.sex,
      surname: person.surname,
      birthYear: person.birthYear,
      deathYear: person.deathYear,
      isLiving: person.isLiving,
      version: person.version,
      createdAt: timestamp(person.createdAt),
      updatedAt: timestamp(person.updatedAt),
    })
    .from(person)
    .innerJoin(
      personName,
      and(
        eq(personName.projectId, person.projectId),
        eq(personName.personId, person.id),
        eq(personName.isPrimary, true),
      ),
    )
    .where(and(eq(person.projectId, projectId), eq(person.id, personId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getPerson(
  db: TxDatabase,
  projectId: string,
  personId: string,
): Promise<PersonView | null> {
  return loadPersonView(db, projectId, personId);
}

export type ListPageOptions = {
  cursor?: string;
  limit: number;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listPersons(
  db: TxDatabase,
  organizationId: string,
  projectId: string,
  options: ListPageOptions,
): Promise<{ persons: PersonView[]; nextCursor: string | null }> {
  if (options.cursor && !UUID_PATTERN.test(options.cursor)) {
    throw validationError({ cursor: "游标格式不合法" });
  }
  const conditions = [
    eq(person.organizationId, organizationId),
    eq(person.projectId, projectId),
  ];
  if (options.cursor) {
    conditions.push(gt(person.id, options.cursor));
  }
  const rows = await db
    .select({
      id: person.id,
      projectId: person.projectId,
      displayName: personName.value,
      sex: person.sex,
      surname: person.surname,
      birthYear: person.birthYear,
      deathYear: person.deathYear,
      isLiving: person.isLiving,
      version: person.version,
      createdAt: timestamp(person.createdAt),
      updatedAt: timestamp(person.updatedAt),
    })
    .from(person)
    .innerJoin(
      personName,
      and(
        eq(personName.organizationId, person.organizationId),
        eq(personName.projectId, person.projectId),
        eq(personName.personId, person.id),
        eq(personName.isPrimary, true),
      ),
    )
    .where(and(...conditions))
    .orderBy(person.id)
    .limit(options.limit + 1);
  const hasMore = rows.length > options.limit;
  const persons = hasMore ? rows.slice(0, options.limit) : rows;
  const last = persons[persons.length - 1];
  return {
    persons,
    nextCursor: hasMore && last ? last.id : null,
  };
}

export type CreatePersonValues = {
  displayName: string;
  sex?: PersonSex;
  surname?: string;
  birthYear?: number;
  deathYear?: number;
  isLiving?: boolean;
};

export async function insertPerson(
  db: TxDatabase,
  organizationId: string,
  projectId: string,
  values: CreatePersonValues,
): Promise<PersonView> {
  const inserted = await db
    .insert(person)
    .values({
      organizationId,
      projectId,
      sex: values.sex ?? "unknown",
      surname: values.surname ?? null,
      birthYear: values.birthYear ?? null,
      deathYear: values.deathYear ?? null,
      isLiving: values.isLiving ?? true,
    })
    .returning({ id: person.id });
  const personId = inserted[0].id;

  await db.insert(personName).values({
    organizationId,
    projectId,
    personId,
    kind: "formal",
    value: values.displayName,
    isPrimary: true,
  });

  await db.insert(lineageProjection).values({
    organizationId,
    projectId,
    personId,
    primaryPath: pathLabel(personId),
    generation: 0,
  });

  const view = await loadPersonView(db, projectId, personId);
  if (!view) throw new Error("person insert failed to reload");
  return view;
}

export type UpdatePersonValues = {
  displayName?: string;
  sex?: PersonSex;
  surname?: string | null;
  birthYear?: number | null;
  deathYear?: number | null;
  isLiving?: boolean;
};

export async function casUpdatePerson(
  db: TxDatabase,
  projectId: string,
  personId: string,
  expectedVersion: number,
  values: UpdatePersonValues,
): Promise<PersonView | null> {
  const set: Record<string, unknown> = {
    version: sql`${person.version} + 1`,
    updatedAt: sql`clock_timestamp()`,
  };
  if (values.sex !== undefined) set.sex = values.sex;
  if ("surname" in values) set.surname = values.surname ?? null;
  if ("birthYear" in values) set.birthYear = values.birthYear ?? null;
  if ("deathYear" in values) set.deathYear = values.deathYear ?? null;
  if (values.isLiving !== undefined) set.isLiving = values.isLiving;

  const rows = await db
    .update(person)
    .set(set)
    .where(
      and(
        eq(person.projectId, projectId),
        eq(person.id, personId),
        eq(person.version, expectedVersion),
      ),
    )
    .returning({ id: person.id });

  if (rows.length === 0) return null;

  if (values.displayName !== undefined) {
    await db
      .update(personName)
      .set({
        value: values.displayName,
        updatedAt: sql`clock_timestamp()`,
      })
      .where(
        and(
          eq(personName.projectId, projectId),
          eq(personName.personId, personId),
          eq(personName.isPrimary, true),
        ),
      );
  }

  return loadPersonView(db, projectId, personId);
}

export async function deletePerson(
  db: TxDatabase,
  projectId: string,
  personId: string,
): Promise<boolean> {
  const rows = await db
    .delete(person)
    .where(and(eq(person.projectId, projectId), eq(person.id, personId)))
    .returning({ id: person.id });
  return rows.length > 0;
}

export async function personExistsInProject(
  db: TxDatabase,
  projectId: string,
  personId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: person.id })
    .from(person)
    .where(and(eq(person.projectId, projectId), eq(person.id, personId)))
    .limit(1);
  return rows.length > 0;
}

export async function insertRelation(
  db: TxDatabase,
  organizationId: string,
  projectId: string,
  values: {
    fromPersonId: string;
    toPersonId: string;
    kind: ApiRelationKind;
    note?: string | null;
  },
): Promise<RelationView> {
  const rows = await db
    .insert(personRelation)
    .values({
      organizationId,
      projectId,
      fromPersonId: values.fromPersonId,
      toPersonId: values.toPersonId,
      kind: values.kind,
      note: values.note ?? null,
    })
    .returning({
      id: personRelation.id,
      projectId: personRelation.projectId,
      fromPersonId: personRelation.fromPersonId,
      toPersonId: personRelation.toPersonId,
      kind: personRelation.kind,
      createdAt: timestamp(personRelation.createdAt),
      updatedAt: timestamp(personRelation.updatedAt),
    });
  return rows[0];
}

export async function getRelation(
  db: TxDatabase,
  projectId: string,
  relationId: string,
): Promise<RelationView | null> {
  const rows = await db
    .select({
      id: personRelation.id,
      projectId: personRelation.projectId,
      fromPersonId: personRelation.fromPersonId,
      toPersonId: personRelation.toPersonId,
      kind: personRelation.kind,
      createdAt: timestamp(personRelation.createdAt),
      updatedAt: timestamp(personRelation.updatedAt),
    })
    .from(personRelation)
    .where(
      and(
        eq(personRelation.projectId, projectId),
        eq(personRelation.id, relationId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteRelation(
  db: TxDatabase,
  projectId: string,
  relationId: string,
): Promise<RelationView | null> {
  const existing = await getRelation(db, projectId, relationId);
  if (!existing) return null;
  await db
    .delete(personRelation)
    .where(
      and(
        eq(personRelation.projectId, projectId),
        eq(personRelation.id, relationId),
      ),
    );
  return existing;
}

export type SubgraphResult = {
  rootPersonId: string;
  persons: PersonView[];
  relations: RelationView[];
  hasMoreAncestors: boolean;
  hasMoreDescendants: boolean;
};

export async function querySubgraph(
  db: TxDatabase,
  organizationId: string,
  projectId: string,
  options: {
    rootPersonId: string;
    upDepth: number;
    downDepth: number;
    limit: number;
  },
): Promise<SubgraphResult | null> {
  type Payload = {
    root_ok: boolean;
    persons: PersonView[] | null;
    relations: RelationView[] | null;
    has_more_ancestors: boolean;
    has_more_descendants: boolean;
  };

  const executed = await db.execute(sql`
    WITH RECURSIVE
    root_path AS (
      SELECT lp.person_id, lp.primary_path, lp.generation
        FROM lineage_projection lp
       WHERE lp.organization_id = ${organizationId}::uuid
         AND lp.project_id = ${projectId}::uuid
         AND lp.person_id = ${options.rootPersonId}::uuid
    ),
    ancestors AS (
      SELECT ${options.rootPersonId}::uuid AS person_id, 0 AS depth
      UNION ALL
      SELECT r.from_person_id, a.depth + 1
        FROM person_relation r
        JOIN ancestors a ON r.to_person_id = a.person_id
       WHERE r.organization_id = ${organizationId}::uuid
         AND r.project_id = ${projectId}::uuid
         AND r.kind IN ('biological_parent', 'adoptive_parent', 'ritual_heir')
         AND a.depth < ${options.upDepth}
    ),
    descendants AS (
      SELECT lp.person_id,
             (nlevel(lp.primary_path) - nlevel(rp.primary_path)) AS depth
        FROM lineage_projection lp
        JOIN root_path rp ON true
       WHERE lp.organization_id = ${organizationId}::uuid
         AND lp.project_id = ${projectId}::uuid
         AND lp.primary_path <@ rp.primary_path
         AND nlevel(lp.primary_path) <= nlevel(rp.primary_path) + ${options.downDepth}
    ),
    spouse_of_core AS (
      SELECT CASE
               WHEN r.from_person_id = c.person_id THEN r.to_person_id
               ELSE r.from_person_id
             END AS person_id
        FROM person_relation r
        JOIN (
          SELECT person_id FROM ancestors
          UNION
          SELECT person_id FROM descendants
        ) c ON c.person_id IN (r.from_person_id, r.to_person_id)
       WHERE r.organization_id = ${organizationId}::uuid
         AND r.project_id = ${projectId}::uuid
         AND r.kind = 'spouse'
    ),
    candidate AS (
      SELECT person_id, min(depth) AS depth, 'up'::text AS direction
        FROM ancestors
       GROUP BY person_id
      UNION ALL
      SELECT person_id, min(depth) AS depth, 'down'::text AS direction
        FROM descendants
       GROUP BY person_id
      UNION ALL
      SELECT person_id, 0 AS depth, 'spouse'::text AS direction
        FROM spouse_of_core
    ),
    ordered AS (
      SELECT DISTINCT ON (person_id) person_id, depth, direction
        FROM candidate
       ORDER BY person_id,
                CASE direction WHEN 'up' THEN 0 WHEN 'down' THEN 1 ELSE 2 END,
                depth
    ),
    limited AS (
      SELECT person_id, depth, direction
        FROM ordered
       ORDER BY
         CASE WHEN person_id = ${options.rootPersonId}::uuid THEN 0 ELSE 1 END,
         depth,
         person_id
       LIMIT ${options.limit}
    ),
    person_json AS (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
               'id', p.id,
               'projectId', p.project_id,
               'displayName', pn.value,
               'sex', p.sex,
               'surname', p.surname,
               'birthYear', p.birth_year,
               'deathYear', p.death_year,
               'isLiving', p.is_living,
               'version', p.version,
               'createdAt', to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
               'updatedAt', to_char(p.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
             ) ORDER BY p.id), '[]'::jsonb) AS persons
        FROM limited l
        JOIN person p
          ON p.organization_id = ${organizationId}::uuid
         AND p.project_id = ${projectId}::uuid
         AND p.id = l.person_id
        JOIN person_name pn
          ON pn.organization_id = p.organization_id
         AND pn.project_id = p.project_id
         AND pn.person_id = p.id
         AND pn.is_primary
    ),
    relation_json AS (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
               'id', r.id,
               'projectId', r.project_id,
               'fromPersonId', r.from_person_id,
               'toPersonId', r.to_person_id,
               'kind', r.kind,
               'createdAt', to_char(r.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
               'updatedAt', to_char(r.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
             ) ORDER BY r.id), '[]'::jsonb) AS relations
        FROM person_relation r
       WHERE r.organization_id = ${organizationId}::uuid
         AND r.project_id = ${projectId}::uuid
         AND r.from_person_id IN (SELECT person_id FROM limited)
         AND r.to_person_id IN (SELECT person_id FROM limited)
         AND r.kind IN ('biological_parent', 'adoptive_parent', 'ritual_heir', 'spouse')
    )
    SELECT
      EXISTS (SELECT 1 FROM root_path) AS root_ok,
      (SELECT persons FROM person_json) AS persons,
      (SELECT relations FROM relation_json) AS relations,
      (
        EXISTS (
          SELECT 1 FROM ancestors a
           WHERE a.depth = ${options.upDepth}
             AND ${options.upDepth} > 0
             AND EXISTS (
               SELECT 1 FROM person_relation r
                WHERE r.organization_id = ${organizationId}::uuid
         AND r.project_id = ${projectId}::uuid
                  AND r.to_person_id = a.person_id
                  AND r.kind IN ('biological_parent', 'adoptive_parent', 'ritual_heir')
             )
        )
        OR (
          (SELECT count(*) FROM ordered) > ${options.limit}
          AND EXISTS (
            SELECT 1 FROM ordered o
             WHERE o.direction = 'up'
               AND o.person_id NOT IN (SELECT person_id FROM limited)
          )
        )
      ) AS has_more_ancestors,
      (
        EXISTS (
          SELECT 1
            FROM lineage_projection lp
            JOIN root_path rp ON true
           WHERE lp.organization_id = ${organizationId}::uuid
         AND lp.project_id = ${projectId}::uuid
             AND lp.primary_path <@ rp.primary_path
             AND nlevel(lp.primary_path) = nlevel(rp.primary_path) + ${options.downDepth}
             AND ${options.downDepth} > 0
             AND EXISTS (
               SELECT 1 FROM person_relation r
                WHERE r.organization_id = ${organizationId}::uuid
         AND r.project_id = ${projectId}::uuid
                  AND r.from_person_id = lp.person_id
                  AND r.kind IN ('biological_parent', 'adoptive_parent', 'ritual_heir')
             )
        )
        OR (
          (SELECT count(*) FROM ordered) > ${options.limit}
          AND EXISTS (
            SELECT 1 FROM ordered o
             WHERE o.direction = 'down'
               AND o.person_id NOT IN (SELECT person_id FROM limited)
          )
        )
      ) AS has_more_descendants
  `);

  const row = (executed as unknown as { rows: Payload[] }).rows[0];
  if (!row?.root_ok) return null;

  return {
    rootPersonId: options.rootPersonId,
    persons: (row.persons ?? []) as PersonView[],
    relations: (row.relations ?? []) as RelationView[],
    hasMoreAncestors: Boolean(row.has_more_ancestors),
    hasMoreDescendants: Boolean(row.has_more_descendants),
  };
}
