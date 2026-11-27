import { lineageProjection, person, personRelation } from "@yunpu/db";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { TxDatabase } from "../../db/with-tenant-transaction";
import {
  hydratePersonsDetails,
  mapPersonRow,
  type PersonView,
  type ProjectionView,
  personBaseColumns,
  type RelationView,
  relationColumns,
  type SubgraphResult,
} from "./person-views";

export async function queryLineageGraphData(
  db: TxDatabase,
  organizationId: string,
  projectId: string,
  lineageId: string,
): Promise<{
  persons: PersonView[];
  relations: RelationView[];
  projections: ProjectionView[];
}> {
  // Query person rows without joining person_name in SQL to avoid O(N^2) RLS nested-loop
  // plans on un-analyzed tables; hydratePersonsDetails resolves primary displayName & names.
  const personRows = await db
    .select({
      ...personBaseColumns,
      displayName: sql<string>`coalesce(${person.surname}, '')`,
    })
    .from(person)
    .where(
      and(
        eq(person.organizationId, organizationId),
        eq(person.projectId, projectId),
        eq(person.lineageId, lineageId),
      ),
    )
    .orderBy(asc(person.siblingOrder), asc(person.createdAt), asc(person.id));

  // Omit full person_event rows from /graph; details/events are fetched on demand via GET /persons/:personId.
  const persons = await hydratePersonsDetails(
    db,
    projectId,
    personRows.map(mapPersonRow),
    { includeNames: true, includeEvents: false },
  );
  if (persons.length === 0) {
    return { persons: [], relations: [], projections: [] };
  }

  const personIds = persons.map((item) => item.id);
  const [relations, projectionRows] = await Promise.all([
    db
      .select(relationColumns)
      .from(personRelation)
      .where(
        and(
          eq(personRelation.organizationId, organizationId),
          eq(personRelation.projectId, projectId),
          inArray(personRelation.fromPersonId, personIds),
          inArray(personRelation.toPersonId, personIds),
        ),
      )
      .orderBy(asc(personRelation.sortOrder), asc(personRelation.createdAt)),
    db
      .select({
        personId: lineageProjection.personId,
        primaryPath: sql<string>`${lineageProjection.primaryPath}::text`,
        generation: lineageProjection.generation,
      })
      .from(lineageProjection)
      .where(
        and(
          eq(lineageProjection.organizationId, organizationId),
          eq(lineageProjection.projectId, projectId),
          inArray(lineageProjection.personId, personIds),
        ),
      )
      .orderBy(
        asc(lineageProjection.generation),
        asc(lineageProjection.personId),
      ),
  ]);

  return { persons, relations, projections: projectionRows };
}

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
         AND r.kind IN ('spouse', 'partner')
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
               'lineageId', p.lineage_id,
               'displayName', coalesce((
                 SELECT pn.value
                   FROM person_name pn
                  WHERE pn.organization_id = p.organization_id
                    AND pn.project_id = p.project_id
                    AND pn.person_id = p.id
                    AND pn.is_primary
                  LIMIT 1
               ), p.surname, ''),
               'sex', p.sex,
               'surname', p.surname,
               'givenName', p.given_name,
               'romanizedSurname', p.romanized_surname,
               'romanizedName', p.romanized_name,
               'romanizedSuffix', p.romanized_suffix,
               'birthYear', p.birth_year,
               'deathYear', p.death_year,
               'isLiving', p.is_living,
               'birthInfo', p.birth_info,
               'deathInfo', p.death_info,
               'generationWord', p.generation_word,
               'relationTitle', p.relation_title,
               'siblingOrder', p.sibling_order,
               'biography', p.biography,
               'notes', p.notes,
               'avatarKey', p.avatar_key,
               'version', p.version,
               'createdAt', to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
               'updatedAt', to_char(p.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
             ) ORDER BY p.id), '[]'::jsonb) AS persons
        FROM limited l
        JOIN person p
          ON p.organization_id = ${organizationId}::uuid
         AND p.project_id = ${projectId}::uuid
         AND p.id = l.person_id
    ),
    relation_json AS (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
               'id', r.id,
               'projectId', r.project_id,
               'fromPersonId', r.from_person_id,
               'toPersonId', r.to_person_id,
               'kind', r.kind,
               'fromRoleLabel', r.from_role_label,
               'toRoleLabel', r.to_role_label,
               'sortOrder', r.sort_order,
               'note', r.note,
               'createdAt', to_char(r.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
               'updatedAt', to_char(r.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
             ) ORDER BY r.id), '[]'::jsonb) AS relations
        FROM person_relation r
       WHERE r.organization_id = ${organizationId}::uuid
         AND r.project_id = ${projectId}::uuid
         AND r.from_person_id IN (SELECT person_id FROM limited)
         AND r.to_person_id IN (SELECT person_id FROM limited)
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
