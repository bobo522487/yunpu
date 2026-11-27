import { book, bookEdition } from "@yunpu/db";
import type {
  BookBindingStyle,
  BookEditionPrintStatus,
  BookLayoutConfigInput,
  BookLineageStyle,
  BookPaperSize,
  BookSectionsInput,
  CreateBookEditionInput,
  CreateBookInput,
  UpdateBookInput,
} from "@yunpu/shared";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { TxDatabase } from "../../db/with-tenant-transaction";
import { isoTimestamp as timestamp } from "../../lib/sql";

export const DEFAULT_BOOK_LAYOUT: BookLayoutConfigInput = {
  bindingStyle: "thread",
  lineageStyle: "euler",
  paperSize: "thread_185x290",
  borderStyle: "double",
  fontFamily: "song",
  density: "standard",
  fishtailStyle: "black",
  showHallName: true,
  showHeaderName: true,
  pageNumberStyle: "chinese",
};

export function createEmptyBookSections(): BookSectionsInput {
  return {
    preface: {
      code: "preface",
      label: "卷首",
      hint: "(显示在目录之前的内容)",
      collapsed: false,
      items: [],
    },
    body: {
      code: "body",
      label: "正文",
      hint: "(建议放源流、字辈、碑文等)",
      collapsed: false,
      items: [],
    },
    lineage: {
      code: "lineage",
      label: "世系",
      hint: "(族丁检索表、吊线图、世系表)",
      collapsed: false,
      items: [],
    },
    appendix: {
      code: "appendix",
      label: "附录",
      hint: "",
      collapsed: false,
      items: [],
    },
  };
}

export type BookRecord = {
  id: string;
  projectId: string;
  folderId: string | null;
  bookName: string;
  headerName: string;
  hallName: string;
  volumeNo: string;
  editor: string;
  compilationDate: string;
  sections: BookSectionsInput;
  layoutConfig: BookLayoutConfigInput;
  seq: number;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type BookEditionRecord = {
  id: string;
  projectId: string;
  bookId: string;
  bindingStyle: BookBindingStyle;
  lineageStyle: BookLineageStyle;
  paperSize: BookPaperSize;
  pageCount: number;
  memberCount: number;
  wordCount: number;
  printStatus: BookEditionPrintStatus;
  layoutSnapshot: BookLayoutConfigInput;
  pages: Array<Record<string, unknown>>;
  createdAt: string;
};

const bookColumns = {
  id: book.id,
  projectId: book.projectId,
  folderId: book.folderId,
  bookName: book.bookName,
  headerName: book.headerName,
  hallName: book.hallName,
  volumeNo: book.volumeNo,
  editor: book.editor,
  compilationDate: book.compilationDate,
  sections: book.sections,
  layoutConfig: book.layoutConfig,
  seq: book.seq,
  version: book.version,
  createdAt: timestamp(book.createdAt),
  updatedAt: timestamp(book.updatedAt),
};

const editionColumns = {
  id: bookEdition.id,
  projectId: bookEdition.projectId,
  bookId: bookEdition.bookId,
  bindingStyle: bookEdition.bindingStyle,
  lineageStyle: bookEdition.lineageStyle,
  paperSize: bookEdition.paperSize,
  pageCount: bookEdition.pageCount,
  memberCount: bookEdition.memberCount,
  wordCount: bookEdition.wordCount,
  printStatus: bookEdition.printStatus,
  layoutSnapshot: bookEdition.layoutSnapshot,
  pages: bookEdition.pages,
  createdAt: timestamp(bookEdition.createdAt),
};

function mapBookRow(row: {
  id: string;
  projectId: string;
  folderId: string | null;
  bookName: string;
  headerName: string;
  hallName: string;
  volumeNo: string;
  editor: string;
  compilationDate: string;
  sections: unknown;
  layoutConfig: unknown;
  seq: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}): BookRecord {
  return {
    ...row,
    sections:
      (row.sections as BookSectionsInput | null) ?? createEmptyBookSections(),
    layoutConfig:
      (row.layoutConfig as BookLayoutConfigInput | null) ?? DEFAULT_BOOK_LAYOUT,
  };
}

function mapEditionRow(row: {
  id: string;
  projectId: string;
  bookId: string;
  bindingStyle: BookBindingStyle;
  lineageStyle: BookLineageStyle;
  paperSize: BookPaperSize;
  pageCount: number;
  memberCount: number;
  wordCount: number;
  printStatus: BookEditionPrintStatus;
  layoutSnapshot: unknown;
  pages: unknown;
  createdAt: string;
}): BookEditionRecord {
  return {
    ...row,
    layoutSnapshot:
      (row.layoutSnapshot as BookLayoutConfigInput | null) ??
      DEFAULT_BOOK_LAYOUT,
    pages: Array.isArray(row.pages)
      ? (row.pages as Array<Record<string, unknown>>)
      : [],
  };
}

export async function listBooks(
  db: TxDatabase,
  projectId: string,
): Promise<BookRecord[]> {
  const rows = await db
    .select(bookColumns)
    .from(book)
    .where(eq(book.projectId, projectId))
    .orderBy(asc(book.seq), asc(book.createdAt), asc(book.id));
  return rows.map(mapBookRow);
}

export async function getBook(
  db: TxDatabase,
  projectId: string,
  bookId: string,
): Promise<BookRecord | null> {
  const rows = await db
    .select(bookColumns)
    .from(book)
    .where(and(eq(book.projectId, projectId), eq(book.id, bookId)))
    .limit(1);
  return rows[0] ? mapBookRow(rows[0]) : null;
}

export async function insertBook(
  db: TxDatabase,
  organizationId: string,
  projectId: string,
  values: CreateBookInput,
): Promise<BookRecord> {
  const rows = await db
    .insert(book)
    .values({
      organizationId,
      projectId,
      folderId: values.folderId ?? null,
      seq: values.seq ?? 0,
      bookName: values.bookName,
      headerName: values.headerName ?? values.bookName,
      hallName: values.hallName ?? "",
      volumeNo: values.volumeNo ?? "卷一",
      editor: values.editor ?? "",
      compilationDate:
        values.compilationDate ?? new Date().toISOString().slice(0, 10),
      sections: values.sections ?? createEmptyBookSections(),
      layoutConfig: values.layoutConfig ?? DEFAULT_BOOK_LAYOUT,
    })
    .returning(bookColumns);
  return mapBookRow(rows[0]);
}

export async function casUpdateBook(
  db: TxDatabase,
  projectId: string,
  bookId: string,
  expectedVersion: number,
  values: Omit<UpdateBookInput, "version">,
): Promise<BookRecord | null> {
  const set: Record<string, unknown> = {
    version: sql`${book.version} + 1`,
    updatedAt: sql`clock_timestamp()`,
  };
  if (values.folderId !== undefined) set.folderId = values.folderId;
  if (values.seq !== undefined) set.seq = values.seq;
  if (values.bookName !== undefined) set.bookName = values.bookName;
  if (values.headerName !== undefined) set.headerName = values.headerName;
  if (values.hallName !== undefined) set.hallName = values.hallName;
  if (values.volumeNo !== undefined) set.volumeNo = values.volumeNo;
  if (values.editor !== undefined) set.editor = values.editor;
  if (values.compilationDate !== undefined) {
    set.compilationDate = values.compilationDate;
  }
  if (values.sections !== undefined) set.sections = values.sections;
  if (values.layoutConfig !== undefined) set.layoutConfig = values.layoutConfig;

  const rows = await db
    .update(book)
    .set(set)
    .where(
      and(
        eq(book.projectId, projectId),
        eq(book.id, bookId),
        eq(book.version, expectedVersion),
      ),
    )
    .returning(bookColumns);
  return rows[0] ? mapBookRow(rows[0]) : null;
}

export async function updateBookSeq(
  db: TxDatabase,
  projectId: string,
  bookId: string,
  seq: number,
): Promise<void> {
  await db
    .update(book)
    .set({ seq, updatedAt: sql`clock_timestamp()` })
    .where(and(eq(book.projectId, projectId), eq(book.id, bookId)));
}

export async function deleteBook(
  db: TxDatabase,
  projectId: string,
  bookId: string,
): Promise<boolean> {
  const rows = await db
    .delete(book)
    .where(and(eq(book.projectId, projectId), eq(book.id, bookId)))
    .returning({ id: book.id });
  return rows.length > 0;
}

export async function listBookEditions(
  db: TxDatabase,
  projectId: string,
  bookId: string,
): Promise<BookEditionRecord[]> {
  const rows = await db
    .select(editionColumns)
    .from(bookEdition)
    .where(
      and(eq(bookEdition.projectId, projectId), eq(bookEdition.bookId, bookId)),
    )
    .orderBy(desc(bookEdition.createdAt), desc(bookEdition.id));
  return rows.map(mapEditionRow);
}

export async function insertBookEdition(
  db: TxDatabase,
  organizationId: string,
  projectId: string,
  bookId: string,
  values: CreateBookEditionInput & { printStatus?: BookEditionPrintStatus },
): Promise<BookEditionRecord> {
  const rows = await db
    .insert(bookEdition)
    .values({
      organizationId,
      projectId,
      bookId,
      bindingStyle: values.bindingStyle,
      lineageStyle: values.lineageStyle,
      paperSize: values.paperSize,
      pageCount: values.pageCount,
      memberCount: values.memberCount,
      wordCount: values.wordCount,
      printStatus: values.printStatus ?? "none",
      layoutSnapshot: values.layoutSnapshot,
      pages: values.pages,
    })
    .returning(editionColumns);
  return mapEditionRow(rows[0]);
}

export async function trimBookEditionsToLimit(
  db: TxDatabase,
  projectId: string,
  bookId: string,
  maxKeep: number,
): Promise<void> {
  const existing = await db
    .select({ id: bookEdition.id })
    .from(bookEdition)
    .where(
      and(eq(bookEdition.projectId, projectId), eq(bookEdition.bookId, bookId)),
    )
    .orderBy(desc(bookEdition.createdAt), desc(bookEdition.id));
  if (existing.length <= maxKeep) return;
  const staleIds = existing.slice(maxKeep).map((row) => row.id);
  await db
    .delete(bookEdition)
    .where(
      and(
        eq(bookEdition.projectId, projectId),
        eq(bookEdition.bookId, bookId),
        inArray(bookEdition.id, staleIds),
      ),
    );
}

export async function updateBookEditionPrintStatus(
  db: TxDatabase,
  projectId: string,
  bookId: string,
  editionId: string,
  printStatus: BookEditionPrintStatus,
): Promise<BookEditionRecord | null> {
  const rows = await db
    .update(bookEdition)
    .set({ printStatus })
    .where(
      and(
        eq(bookEdition.projectId, projectId),
        eq(bookEdition.bookId, bookId),
        eq(bookEdition.id, editionId),
      ),
    )
    .returning(editionColumns);
  return rows[0] ? mapEditionRow(rows[0]) : null;
}

export async function deleteBookEdition(
  db: TxDatabase,
  projectId: string,
  bookId: string,
  editionId: string,
): Promise<boolean> {
  const rows = await db
    .delete(bookEdition)
    .where(
      and(
        eq(bookEdition.projectId, projectId),
        eq(bookEdition.bookId, bookId),
        eq(bookEdition.id, editionId),
      ),
    )
    .returning({ id: bookEdition.id });
  return rows.length > 0;
}
