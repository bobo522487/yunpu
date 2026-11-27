import { person, personName, personRelation } from "@yunpu/db";
import type { ApiRelationKind, PersonSex } from "@yunpu/shared";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import type { TxDatabase } from "../../db/with-tenant-transaction";
import { parseUuidCursor, sliceCursorPage } from "../../lib/pagination";
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

export async function listPersons(
  db: TxDatabase,
  organizationId: string,
  projectId: string,
  options: ListPageOptions,
): Promise<{ persons: PersonView[]; nextCursor: string | null }> {
  const conditions = [
    eq(person.organizationId, organizationId),
    eq(person.projectId, projectId),
  ];
  if (options.cursor) {
    conditions.push(gt(person.id, parseUuidCursor(options.cursor)));
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
  const page = sliceCursorPage(rows, options.limit, (last) => last.id);
  return {
    persons: page.items,
    nextCursor: page.nextCursor,
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
  const sex = values.sex ?? "unknown";
  const surname = values.surname ?? null;
  const birthYear = values.birthYear ?? null;
  const deathYear = values.deathYear ?? null;
  const isLiving = values.isLiving ?? true;

  const executed = await db.execute<PersonView>(sql`
    WITH inserted_person AS (
      INSERT INTO person (
        organization_id, project_id, sex, surname, birth_year, death_year, is_living
      )
      VALUES (
        ${organizationId}::uuid,
        ${projectId}::uuid,
        ${sex},
        ${surname},
        ${birthYear},
        ${deathYear},
        ${isLiving}
      )
      RETURNING id, project_id, sex, surname, birth_year, death_year, is_living, version, created_at, updated_at
    ),
    inserted_name AS (
      INSERT INTO person_name (
        organization_id, project_id, person_id, kind, value, is_primary
      )
      SELECT
        ${organizationId}::uuid,
        ${projectId}::uuid,
        ip.id,
        'formal',
        ${values.displayName},
        true
      FROM inserted_person ip
      RETURNING person_id, value
    )
    SELECT
      ip.id,
      ip.project_id AS "projectId",
      inm.value AS "displayName",
      ip.sex,
      ip.surname,
      ip.birth_year AS "birthYear",
      ip.death_year AS "deathYear",
      ip.is_living AS "isLiving",
      ip.version,
      to_char(ip.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt",
      to_char(ip.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "updatedAt"
    FROM inserted_person ip
    JOIN inserted_name inm ON inm.person_id = ip.id
  `);
  const rows = (executed as unknown as { rows: PersonView[] }).rows;
  const view = rows[0];
  if (!view) throw new Error("person insert failed");
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

const personBaseColumns = {
  id: person.id,
  projectId: person.projectId,
  sex: person.sex,
  surname: person.surname,
  birthYear: person.birthYear,
  deathYear: person.deathYear,
  isLiving: person.isLiving,
  version: person.version,
  createdAt: timestamp(person.createdAt),
  updatedAt: timestamp(person.updatedAt),
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
  if (values.surname !== undefined) set.surname = values.surname;
  if (values.birthYear !== undefined) set.birthYear = values.birthYear;
  if (values.deathYear !== undefined) set.deathYear = values.deathYear;
  if (values.isLiving !== undefined) set.isLiving = values.isLiving;

  const whereClause = and(
    eq(person.projectId, projectId),
    eq(person.id, personId),
    eq(person.version, expectedVersion),
  );

  if (values.displayName !== undefined) {
    const rows = await db
      .update(person)
      .set(set)
      .where(whereClause)
      .returning(personBaseColumns);
    const updated = rows[0];
    if (!updated) return null;

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
    return { ...updated, displayName: values.displayName };
  }

  const rows = await db
    .update(person)
    .set(set)
    .where(whereClause)
    .returning({
      ...personBaseColumns,
      displayName: sql<string>`(
        SELECT pn.value FROM person_name pn
         WHERE pn.project_id = ${person.projectId}
           AND pn.person_id = ${person.id}
           AND pn.is_primary = true
         LIMIT 1
      )`,
    });
  return rows[0] ?? null;
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

export async function countPersonsInProject(
  db: TxDatabase,
  projectId: string,
  personIds: string[],
): Promise<number> {
  const rows = await db
    .select({ id: person.id })
    .from(person)
    .where(and(eq(person.projectId, projectId), inArray(person.id, personIds)));
  return rows.length;
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

export async function deleteRelation(
  db: TxDatabase,
  projectId: string,
  relationId: string,
): Promise<boolean> {
  const rows = await db
    .delete(personRelation)
    .where(
      and(
        eq(personRelation.projectId, projectId),
        eq(personRelation.id, relationId),
      ),
    )
    .returning({ id: personRelation.id });
  return rows.length > 0;
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
      SELECT rp.person_id, 0 AS depth
        FROM root_path rp
      UNION ALL
      SELECT lp.person_id,
             (nlevel(lp.primary_path) - nlevel(rp.primary_path)) AS depth
        FROM lineage_projection lp
        JOIN root_path rp ON true
       WHERE lp.organization_id = ${organizationId}::uuid
         AND lp.project_id = ${projectId}::uuid
         AND ${options.downDepth} > 0
         AND lp.primary_path::text ~>=~ (rp.primary_path::text || '.')
         AND lp.primary_path::text ~<~ (rp.primary_path::text || '/')
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
             AND lp.primary_path::text ~>=~ (rp.primary_path::text || '.')
             AND lp.primary_path::text ~<~ (rp.primary_path::text || '/')
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
