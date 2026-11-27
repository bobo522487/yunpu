import {
  PERSON_EVENT_TYPES,
  PERSON_NAME_KINDS,
  PERSON_SEXES,
  RELATION_KINDS,
} from "@yunpu/shared";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { project } from "./tenant";

const createdAt = timestamp("created_at", { withTimezone: true })
  .notNull()
  .defaultNow();
const updatedAt = timestamp("updated_at", { withTimezone: true })
  .notNull()
  .defaultNow();

const ltree = customType<{ data: string; driverData: string }>({
  dataType() {
    return "ltree";
  },
});

export const folder = pgTable(
  "folder",
  {
    projectId: uuid("project_id").notNull(),
    id: uuid("id").notNull().default(sql`uuidv7()`),
    organizationId: uuid("organization_id").notNull(),
    name: text("name").notNull(),
    seq: integer("seq").notNull().default(0),
    createdAt,
    updatedAt,
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.id], name: "pk_folder" }),
    uniqueIndex("uq_folder_project_name").on(table.projectId, table.name),
    foreignKey({
      columns: [table.organizationId, table.projectId],
      foreignColumns: [project.organizationId, project.id],
      name: "fk_folder_project",
    }).onDelete("cascade"),
    check("ck_folder_name_not_blank", sql`btrim(${table.name}) <> ''`),
    check("ck_folder_seq_non_negative", sql`${table.seq} >= 0`),
    index("idx_folder_org_project").on(table.organizationId, table.projectId),
  ],
);

export const lineage = pgTable(
  "lineage",
  {
    projectId: uuid("project_id").notNull(),
    id: uuid("id").notNull().default(sql`uuidv7()`),
    organizationId: uuid("organization_id").notNull(),
    folderId: uuid("folder_id"),
    name: text("name").notNull(),
    surname: text("surname"),
    hallName: text("hall_name"),
    progenitor: text("progenitor"),
    region: jsonb("region"),
    seq: integer("seq").notNull().default(0),
    version: integer("version").notNull().default(1),
    createdAt,
    updatedAt,
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.id], name: "pk_lineage" }),
    foreignKey({
      columns: [table.organizationId, table.projectId],
      foreignColumns: [project.organizationId, project.id],
      name: "fk_lineage_project",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.projectId, table.folderId],
      foreignColumns: [folder.projectId, folder.id],
      name: "fk_lineage_folder",
    }).onDelete("set null"),
    check("ck_lineage_name_not_blank", sql`btrim(${table.name}) <> ''`),
    check(
      "ck_lineage_surname_not_blank",
      sql`${table.surname} IS NULL OR btrim(${table.surname}) <> ''`,
    ),
    check(
      "ck_lineage_hall_name_not_blank",
      sql`${table.hallName} IS NULL OR btrim(${table.hallName}) <> ''`,
    ),
    check(
      "ck_lineage_progenitor_not_blank",
      sql`${table.progenitor} IS NULL OR btrim(${table.progenitor}) <> ''`,
    ),
    check("ck_lineage_seq_non_negative", sql`${table.seq} >= 0`),
    check("ck_lineage_version_positive", sql`${table.version} > 0`),
    index("idx_lineage_org_project").on(table.organizationId, table.projectId),
    index("idx_lineage_project_folder").on(table.projectId, table.folderId),
  ],
);

export const person = pgTable(
  "person",
  {
    id: uuid("id").notNull().default(sql`uuidv7()`),
    organizationId: uuid("organization_id").notNull(),
    projectId: uuid("project_id").notNull(),
    lineageId: uuid("lineage_id").notNull(),
    sex: text("sex", { enum: PERSON_SEXES }).notNull().default("unknown"),
    surname: text("surname"),
    givenName: text("given_name"),
    romanizedSurname: text("romanized_surname"),
    romanizedName: text("romanized_name"),
    romanizedSuffix: text("romanized_suffix"),
    birthYear: integer("birth_year"),
    deathYear: integer("death_year"),
    isLiving: boolean("is_living").notNull().default(true),
    birthInfo: jsonb("birth_info"),
    deathInfo: jsonb("death_info"),
    generationWord: text("generation_word"),
    relationTitle: text("relation_title"),
    siblingOrder: integer("sibling_order"),
    biography: text("biography"),
    notes: text("notes"),
    avatarKey: text("avatar_key"),
    version: integer("version").notNull().default(1),
    createdAt,
    updatedAt,
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.id], name: "pk_person" }),
    uniqueIndex("uq_person_org_id").on(table.organizationId, table.id),
    foreignKey({
      columns: [table.organizationId, table.projectId],
      foreignColumns: [project.organizationId, project.id],
      name: "fk_person_project",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.projectId, table.lineageId],
      foreignColumns: [lineage.projectId, lineage.id],
      name: "fk_person_lineage",
    }).onDelete("cascade"),
    check(
      "ck_person_sex",
      sql`${table.sex} IN ('male', 'female', 'unknown', 'other')`,
    ),
    check(
      "ck_person_surname_not_blank",
      sql`${table.surname} IS NULL OR btrim(${table.surname}) <> ''`,
    ),
    check("ck_person_version_positive", sql`${table.version} > 0`),
    check(
      "ck_person_sibling_order",
      sql`${table.siblingOrder} IS NULL OR ${table.siblingOrder} >= 0`,
    ),
    check(
      "ck_person_life_years",
      sql`(${table.deathYear} IS NULL OR ${table.isLiving} = false) AND (${table.birthYear} IS NULL OR ${table.deathYear} IS NULL OR ${table.deathYear} >= ${table.birthYear})`,
    ),
    index("idx_person_org_project").on(table.organizationId, table.projectId),
    index("idx_person_project_lineage").on(table.projectId, table.lineageId),
    index("idx_person_project_surname")
      .on(table.projectId, table.surname)
      .where(sql`surname IS NOT NULL`),
  ],
);

export const personName = pgTable(
  "person_name",
  {
    id: uuid("id").notNull().default(sql`uuidv7()`),
    organizationId: uuid("organization_id").notNull(),
    projectId: uuid("project_id").notNull(),
    personId: uuid("person_id").notNull(),
    kind: text("kind", { enum: PERSON_NAME_KINDS }).notNull(),
    value: text("value").notNull(),
    surname: text("surname"),
    romanizedSurname: text("romanized_surname"),
    romanizedName: text("romanized_name"),
    label: text("label"),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt,
    updatedAt,
  },
  (table) => [
    primaryKey({
      columns: [table.projectId, table.id],
      name: "pk_person_name",
    }),
    foreignKey({
      columns: [table.organizationId, table.projectId],
      foreignColumns: [project.organizationId, project.id],
      name: "fk_person_name_project",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.projectId, table.personId],
      foreignColumns: [person.projectId, person.id],
      name: "fk_person_name_person",
    }).onDelete("cascade"),
    uniqueIndex("uq_person_name_kind_value").on(
      table.projectId,
      table.personId,
      table.kind,
      table.value,
    ),
    uniqueIndex("uq_person_name_primary")
      .on(table.projectId, table.personId)
      .where(sql`is_primary`),
    check(
      "ck_person_name_kind",
      sql`${table.kind} IN ('formal', 'courtesy', 'art', 'milk', 'genealogy', 'posthumous', 'other')`,
    ),
    check("ck_person_name_value_not_blank", sql`btrim(${table.value}) <> ''`),
    index("idx_person_name_org_project").on(
      table.organizationId,
      table.projectId,
    ),
  ],
);

export const personRelation = pgTable(
  "person_relation",
  {
    id: uuid("id").notNull().default(sql`uuidv7()`),
    organizationId: uuid("organization_id").notNull(),
    projectId: uuid("project_id").notNull(),
    fromPersonId: uuid("from_person_id").notNull(),
    toPersonId: uuid("to_person_id").notNull(),
    kind: text("kind", { enum: RELATION_KINDS }).notNull(),
    fromRoleLabel: text("from_role_label"),
    toRoleLabel: text("to_role_label"),
    sortOrder: integer("sort_order"),
    note: text("note"),
    createdAt,
    updatedAt,
  },
  (table) => [
    primaryKey({
      columns: [table.projectId, table.id],
      name: "pk_person_relation",
    }),
    foreignKey({
      columns: [table.organizationId, table.projectId],
      foreignColumns: [project.organizationId, project.id],
      name: "fk_person_relation_project",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.projectId, table.fromPersonId],
      foreignColumns: [person.projectId, person.id],
      name: "fk_person_relation_from",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.projectId, table.toPersonId],
      foreignColumns: [person.projectId, person.id],
      name: "fk_person_relation_to",
    }).onDelete("cascade"),
    uniqueIndex("uk_person_relation_kind").on(
      table.projectId,
      table.fromPersonId,
      table.toPersonId,
      table.kind,
    ),
    check(
      "ck_person_relation_not_self",
      sql`${table.fromPersonId} <> ${table.toPersonId}`,
    ),
    check(
      "ck_person_relation_kind",
      sql`${table.kind} IN (
        'biological_parent', 'adoptive_parent', 'ritual_heir',
        'step_parent', 'foster_parent', 'spouse', 'partner'
      )`,
    ),
    check(
      "ck_person_relation_symmetric_order",
      sql`${table.kind} NOT IN ('spouse', 'partner') OR ${table.fromPersonId} < ${table.toPersonId}`,
    ),
    check(
      "ck_person_relation_from_role_not_blank",
      sql`${table.fromRoleLabel} IS NULL OR btrim(${table.fromRoleLabel}) <> ''`,
    ),
    check(
      "ck_person_relation_to_role_not_blank",
      sql`${table.toRoleLabel} IS NULL OR btrim(${table.toRoleLabel}) <> ''`,
    ),
    check(
      "ck_person_relation_sort_order",
      sql`${table.sortOrder} IS NULL OR ${table.sortOrder} >= 0`,
    ),
    index("idx_person_relation_org_project").on(
      table.organizationId,
      table.projectId,
    ),
    index("idx_person_relation_from").on(
      table.projectId,
      table.fromPersonId,
      table.kind,
    ),
    index("idx_person_relation_to").on(
      table.projectId,
      table.toPersonId,
      table.kind,
    ),
  ],
);

export const lineageProjection = pgTable(
  "lineage_projection",
  {
    organizationId: uuid("organization_id").notNull(),
    projectId: uuid("project_id").notNull(),
    personId: uuid("person_id").notNull(),
    primaryPath: ltree("primary_path").notNull(),
    generation: integer("generation").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.projectId, table.personId],
      name: "pk_lineage_projection",
    }),
    foreignKey({
      columns: [table.organizationId, table.projectId],
      foreignColumns: [project.organizationId, project.id],
      name: "fk_lineage_projection_project",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.projectId, table.personId],
      foreignColumns: [person.projectId, person.id],
      name: "fk_lineage_projection_person",
    }).onDelete("cascade"),
    // text_pattern_ops index idx_lineage_projection_path_text on (project_id, primary_path::text) is created in SQL migration 0018.
    index("idx_lineage_projection_org_project").on(
      table.organizationId,
      table.projectId,
    ),
  ],
);

export const personEvent = pgTable(
  "person_event",
  {
    projectId: uuid("project_id").notNull(),
    id: uuid("id").notNull().default(sql`uuidv7()`),
    organizationId: uuid("organization_id").notNull(),
    personId: uuid("person_id").notNull(),
    type: text("type", { enum: PERSON_EVENT_TYPES }).notNull(),
    structuredDate: jsonb("structured_date"),
    structuredPlace: jsonb("structured_place"),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt,
    updatedAt,
  },
  (table) => [
    primaryKey({
      columns: [table.projectId, table.id],
      name: "pk_person_event",
    }),
    foreignKey({
      columns: [table.organizationId, table.projectId],
      foreignColumns: [project.organizationId, project.id],
      name: "fk_person_event_project",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.projectId, table.personId],
      foreignColumns: [person.projectId, person.id],
      name: "fk_person_event_person",
    }).onDelete("cascade"),
    check(
      "ck_person_event_type",
      sql`${table.type} IN ('birth', 'education', 'career', 'marriage', 'residence', 'death', 'other')`,
    ),
    check("ck_person_event_sort_order", sql`${table.sortOrder} >= 0`),
    index("idx_person_event_project_person").on(
      table.projectId,
      table.personId,
    ),
  ],
);
