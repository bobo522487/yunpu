import {
  ARTICLE_DOC_TYPES,
  ARTICLE_PRIVACIES,
  ARTICLE_STATUSES,
  type ArticleCitationInput,
  type ArticleContentJson,
  BOOK_BINDING_STYLES,
  BOOK_EDITION_PRINT_STATUSES,
  BOOK_LINEAGE_STYLES,
  BOOK_PAPER_SIZES,
  type BookLayoutConfigInput,
  type BookSectionsInput,
  type CompiledPage,
} from "@yunpu/shared";
import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { folder } from "./genealogy";
import { project } from "./tenant";

const createdAt = timestamp("created_at", { withTimezone: true })
  .notNull()
  .defaultNow();
const updatedAt = timestamp("updated_at", { withTimezone: true })
  .notNull()
  .defaultNow();

export const article = pgTable(
  "article",
  {
    projectId: uuid("project_id").notNull(),
    id: uuid("id").notNull().default(sql`uuidv7()`),
    organizationId: uuid("organization_id").notNull(),
    folderId: uuid("folder_id"),
    seq: integer("seq").notNull().default(0),
    title: text("title").notNull(),
    subtitle: text("subtitle").notNull().default(""),
    author: text("author").notNull().default(""),
    docType: text("doc_type", { enum: ARTICLE_DOC_TYPES })
      .notNull()
      .default("custom"),
    status: text("status", { enum: ARTICLE_STATUSES })
      .notNull()
      .default("draft"),
    privacy: text("privacy", { enum: ARTICLE_PRIVACIES })
      .notNull()
      .default("clan"),
    contentJson: jsonb("content_json")
      .$type<ArticleContentJson>()
      .notNull()
      .default(sql`'{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb`),
    contentHtml: text("content_html").notNull().default("<p></p>"),
    linkedPersonIds: jsonb("linked_person_ids")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    linkedChartIds: jsonb("linked_chart_ids")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    citations: jsonb("citations")
      .$type<ArticleCitationInput[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    wordCount: integer("word_count").notNull().default(0),
    version: integer("version").notNull().default(1),
    updatedBy: uuid("updated_by"),
    createdAt,
    updatedAt,
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.id], name: "pk_article" }),
    foreignKey({
      columns: [table.organizationId, table.projectId],
      foreignColumns: [project.organizationId, project.id],
      name: "fk_article_project",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.projectId, table.folderId],
      foreignColumns: [folder.projectId, folder.id],
      name: "fk_article_folder",
    }).onDelete("set null"),
    check("ck_article_title_not_blank", sql`btrim(${table.title}) <> ''`),
    check(
      "ck_article_doc_type",
      sql`${table.docType} IN ('preface', 'rules', 'origin', 'motto', 'biography', 'inscription', 'custom')`,
    ),
    check(
      "ck_article_status",
      sql`${table.status} IN ('draft', 'review', 'approved')`,
    ),
    check(
      "ck_article_privacy",
      sql`${table.privacy} IN ('public', 'clan', 'editors')`,
    ),
    check("ck_article_word_count_non_negative", sql`${table.wordCount} >= 0`),
    check("ck_article_seq_non_negative", sql`${table.seq} >= 0`),
    check("ck_article_version_positive", sql`${table.version} > 0`),
    check(
      "ck_article_content_json_object",
      sql`jsonb_typeof(${table.contentJson}) = 'object'`,
    ),
    check(
      "ck_article_citations_array",
      sql`jsonb_typeof(${table.citations}) = 'array'`,
    ),
    check(
      "ck_article_linked_persons_array",
      sql`jsonb_typeof(${table.linkedPersonIds}) = 'array'`,
    ),
    check(
      "ck_article_linked_charts_array",
      sql`jsonb_typeof(${table.linkedChartIds}) = 'array'`,
    ),
    index("idx_article_org_project").on(table.organizationId, table.projectId),
    index("idx_article_project_folder").on(table.projectId, table.folderId),
  ],
);

export const articleRevision = pgTable(
  "article_revision",
  {
    projectId: uuid("project_id").notNull(),
    id: uuid("id").notNull().default(sql`uuidv7()`),
    organizationId: uuid("organization_id").notNull(),
    articleId: uuid("article_id").notNull(),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    status: text("status", { enum: ARTICLE_STATUSES }).notNull(),
    contentJson: jsonb("content_json").$type<ArticleContentJson>().notNull(),
    contentHtml: text("content_html").notNull(),
    wordCount: integer("word_count").notNull().default(0),
    summary: text("summary").notNull().default(""),
    authorName: text("author_name").notNull().default(""),
    createdBy: uuid("created_by"),
    createdAt,
  },
  (table) => [
    primaryKey({
      columns: [table.projectId, table.id],
      name: "pk_article_revision",
    }),
    foreignKey({
      columns: [table.organizationId, table.projectId],
      foreignColumns: [project.organizationId, project.id],
      name: "fk_article_revision_project",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.projectId, table.articleId],
      foreignColumns: [article.projectId, article.id],
      name: "fk_article_revision_article",
    }).onDelete("cascade"),
    check(
      "ck_article_revision_title_not_blank",
      sql`btrim(${table.title}) <> ''`,
    ),
    check(
      "ck_article_revision_status",
      sql`${table.status} IN ('draft', 'review', 'approved')`,
    ),
    check("ck_article_revision_version_positive", sql`${table.version} > 0`),
    check(
      "ck_article_revision_word_count_non_negative",
      sql`${table.wordCount} >= 0`,
    ),
    check(
      "ck_article_revision_content_json_object",
      sql`jsonb_typeof(${table.contentJson}) = 'object'`,
    ),
    index("idx_article_revision_org_project").on(
      table.organizationId,
      table.projectId,
    ),
    index("idx_article_revision_article").on(
      table.projectId,
      table.articleId,
      table.createdAt,
    ),
  ],
);

export const book = pgTable(
  "book",
  {
    projectId: uuid("project_id").notNull(),
    id: uuid("id").notNull().default(sql`uuidv7()`),
    organizationId: uuid("organization_id").notNull(),
    folderId: uuid("folder_id"),
    bookName: text("book_name").notNull(),
    headerName: text("header_name").notNull().default(""),
    hallName: text("hall_name").notNull().default(""),
    volumeNo: text("volume_no").notNull().default("卷一"),
    editor: text("editor").notNull().default(""),
    compilationDate: text("compilation_date").notNull().default(""),
    sections: jsonb("sections").$type<BookSectionsInput>().notNull(),
    layoutConfig: jsonb("layout_config")
      .$type<BookLayoutConfigInput>()
      .notNull(),
    seq: integer("seq").notNull().default(0),
    version: integer("version").notNull().default(1),
    createdAt,
    updatedAt,
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.id], name: "pk_book" }),
    foreignKey({
      columns: [table.organizationId, table.projectId],
      foreignColumns: [project.organizationId, project.id],
      name: "fk_book_project",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.projectId, table.folderId],
      foreignColumns: [folder.projectId, folder.id],
      name: "fk_book_folder",
    }).onDelete("set null"),
    check("ck_book_name_not_blank", sql`btrim(${table.bookName}) <> ''`),
    check("ck_book_volume_no_not_blank", sql`btrim(${table.volumeNo}) <> ''`),
    check("ck_book_seq_non_negative", sql`${table.seq} >= 0`),
    check("ck_book_version_positive", sql`${table.version} > 0`),
    check(
      "ck_book_sections_object",
      sql`jsonb_typeof(${table.sections}) = 'object'`,
    ),
    check(
      "ck_book_layout_config_object",
      sql`jsonb_typeof(${table.layoutConfig}) = 'object'`,
    ),
    index("idx_book_org_project").on(table.organizationId, table.projectId),
  ],
);

export const bookEdition = pgTable(
  "book_edition",
  {
    projectId: uuid("project_id").notNull(),
    id: uuid("id").notNull().default(sql`uuidv7()`),
    organizationId: uuid("organization_id").notNull(),
    bookId: uuid("book_id").notNull(),
    bindingStyle: text("binding_style", {
      enum: BOOK_BINDING_STYLES,
    }).notNull(),
    lineageStyle: text("lineage_style", {
      enum: BOOK_LINEAGE_STYLES,
    }).notNull(),
    paperSize: text("paper_size", { enum: BOOK_PAPER_SIZES }).notNull(),
    pageCount: integer("page_count").notNull(),
    memberCount: integer("member_count").notNull(),
    wordCount: integer("word_count").notNull(),
    printStatus: text("print_status", { enum: BOOK_EDITION_PRINT_STATUSES })
      .notNull()
      .default("none"),
    layoutSnapshot: jsonb("layout_snapshot")
      .$type<BookLayoutConfigInput>()
      .notNull(),
    pages: jsonb("pages").$type<CompiledPage[]>().notNull(),
    createdAt,
  },
  (table) => [
    primaryKey({
      columns: [table.projectId, table.id],
      name: "pk_book_edition",
    }),
    foreignKey({
      columns: [table.organizationId, table.projectId],
      foreignColumns: [project.organizationId, project.id],
      name: "fk_book_edition_project",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.projectId, table.bookId],
      foreignColumns: [book.projectId, book.id],
      name: "fk_book_edition_book",
    }).onDelete("cascade"),
    check(
      "ck_book_edition_binding_style",
      sql`${table.bindingStyle} IN ('thread', 'hardcover')`,
    ),
    check(
      "ck_book_edition_lineage_style",
      sql`${table.lineageStyle} IN ('euler', 'su', 'modern_double')`,
    ),
    check(
      "ck_book_edition_paper_size",
      sql`${table.paperSize} IN ('thread_185x290', 'a4_210x297', 'k16_185x260')`,
    ),
    check(
      "ck_book_edition_print_status",
      sql`${table.printStatus} IN ('none', 'finalized')`,
    ),
    check(
      "ck_book_edition_page_count_non_negative",
      sql`${table.pageCount} >= 0`,
    ),
    check(
      "ck_book_edition_member_count_non_negative",
      sql`${table.memberCount} >= 0`,
    ),
    check(
      "ck_book_edition_word_count_non_negative",
      sql`${table.wordCount} >= 0`,
    ),
    check(
      "ck_book_edition_layout_snapshot_object",
      sql`jsonb_typeof(${table.layoutSnapshot}) = 'object'`,
    ),
    check(
      "ck_book_edition_pages_array",
      sql`jsonb_typeof(${table.pages}) = 'array'`,
    ),
    index("idx_book_edition_org_project").on(
      table.organizationId,
      table.projectId,
    ),
    index("idx_book_edition_book").on(
      table.projectId,
      table.bookId,
      table.createdAt,
    ),
  ],
);
