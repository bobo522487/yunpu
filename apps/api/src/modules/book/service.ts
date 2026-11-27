import type {
  CreateBookEditionInput,
  CreateBookInput,
  UpdateBookEditionInput,
  UpdateBookInput,
} from "@yunpu/shared";
import { requireProjectMember } from "../../access";
import { withTenantTransaction } from "../../db/with-tenant-transaction";
import { AppError, notFound } from "../../lib/errors";
import { folderExistsInTx } from "../folder/service";
import {
  type BookEditionRecord,
  type BookRecord,
  casUpdateBook,
  deleteBook,
  deleteBookEdition,
  getBook,
  insertBook,
  insertBookEdition,
  listBookEditions,
  listBooks,
  trimBookEditionsToLimit,
  updateBookEditionPrintStatus,
  updateBookSeq,
} from "./queries";

export type { BookEditionRecord, BookRecord };

const MAX_EDITIONS_PER_BOOK = 9;

function bookVersionConflict(current: BookRecord): AppError {
  return new AppError(
    "VERSION_CONFLICT",
    "谱书已被他人修改，请刷新后重试",
    409,
    {
      book: current,
    },
  );
}

export async function listBooksForProject(
  userId: string,
  projectId: string,
): Promise<BookRecord[]> {
  return withTenantTransaction({ userId, readOnly: true }, async (db) => {
    await requireProjectMember(db, projectId, userId, null);
    return listBooks(db, projectId);
  });
}

export async function getBookForProject(
  userId: string,
  projectId: string,
  bookId: string,
): Promise<BookRecord> {
  return withTenantTransaction({ userId, readOnly: true }, async (db) => {
    await requireProjectMember(db, projectId, userId, null);
    const found = await getBook(db, projectId, bookId);
    if (!found) throw notFound();
    return found;
  });
}

export async function createBookForProject(
  userId: string,
  projectId: string,
  input: CreateBookInput,
): Promise<BookRecord> {
  return withTenantTransaction({ userId }, async (db) => {
    const { organizationId } = await requireProjectMember(
      db,
      projectId,
      userId,
      "editor",
    );
    if (input.folderId) {
      const exists = await folderExistsInTx(
        db,
        projectId,
        input.folderId,
        "book",
      );
      if (!exists) throw notFound();
    }
    return insertBook(db, organizationId, projectId, input);
  });
}

export async function updateBookForProject(
  userId: string,
  projectId: string,
  bookId: string,
  input: UpdateBookInput,
): Promise<BookRecord> {
  return withTenantTransaction({ userId }, async (db) => {
    await requireProjectMember(db, projectId, userId, "editor");
    const { version, ...values } = input;
    if (values.folderId) {
      const exists = await folderExistsInTx(
        db,
        projectId,
        values.folderId,
        "book",
      );
      if (!exists) throw notFound();
    }

    const updated = await casUpdateBook(db, projectId, bookId, version, values);
    if (updated) return updated;

    const existing = await getBook(db, projectId, bookId);
    if (existing) throw bookVersionConflict(existing);
    throw notFound();
  });
}

export async function duplicateBookForProject(
  userId: string,
  projectId: string,
  bookId: string,
): Promise<BookRecord> {
  return withTenantTransaction({ userId }, async (db) => {
    const { organizationId } = await requireProjectMember(
      db,
      projectId,
      userId,
      "editor",
    );
    const source = await getBook(db, projectId, bookId);
    if (!source) throw notFound();

    const copy = await insertBook(db, organizationId, projectId, {
      folderId: source.folderId,
      seq: source.seq + 1,
      bookName: `${source.bookName} (副本)`,
      headerName: source.headerName,
      hallName: source.hallName,
      volumeNo: source.volumeNo,
      editor: source.editor,
      compilationDate: source.compilationDate,
      sections: source.sections,
      layoutConfig: source.layoutConfig,
    });

    const sourceEditions = await listBookEditions(db, projectId, bookId);
    for (const edition of sourceEditions
      .slice(0, MAX_EDITIONS_PER_BOOK)
      .reverse()) {
      await insertBookEdition(db, organizationId, projectId, copy.id, {
        bindingStyle: edition.bindingStyle,
        lineageStyle: edition.lineageStyle,
        paperSize: edition.paperSize,
        pageCount: edition.pageCount,
        memberCount: edition.memberCount,
        wordCount: edition.wordCount,
        printStatus: edition.printStatus,
        layoutSnapshot: edition.layoutSnapshot,
        pages: edition.pages as CreateBookEditionInput["pages"],
      });
    }

    return copy;
  });
}

export async function reorderBooksForProject(
  userId: string,
  projectId: string,
  bookIds: string[],
): Promise<BookRecord[]> {
  return withTenantTransaction({ userId }, async (db) => {
    await requireProjectMember(db, projectId, userId, "editor");
    for (let idx = 0; idx < bookIds.length; idx += 1) {
      await updateBookSeq(db, projectId, bookIds[idx], idx);
    }
    return listBooks(db, projectId);
  });
}

export async function deleteBookForProject(
  userId: string,
  projectId: string,
  bookId: string,
): Promise<void> {
  await withTenantTransaction({ userId }, async (db) => {
    await requireProjectMember(db, projectId, userId, "editor");
    const deleted = await deleteBook(db, projectId, bookId);
    if (!deleted) throw notFound();
  });
}

export async function listBookEditionsForProject(
  userId: string,
  projectId: string,
  bookId: string,
): Promise<BookEditionRecord[]> {
  return withTenantTransaction({ userId, readOnly: true }, async (db) => {
    await requireProjectMember(db, projectId, userId, null);
    const found = await getBook(db, projectId, bookId);
    if (!found) throw notFound();
    return listBookEditions(db, projectId, bookId);
  });
}

export async function createBookEditionForProject(
  userId: string,
  projectId: string,
  bookId: string,
  input: CreateBookEditionInput,
): Promise<BookEditionRecord> {
  return withTenantTransaction({ userId }, async (db) => {
    const { organizationId } = await requireProjectMember(
      db,
      projectId,
      userId,
      "editor",
    );
    const found = await getBook(db, projectId, bookId);
    if (!found) throw notFound();

    const edition = await insertBookEdition(
      db,
      organizationId,
      projectId,
      bookId,
      input,
    );
    await trimBookEditionsToLimit(db, projectId, bookId, MAX_EDITIONS_PER_BOOK);
    return edition;
  });
}

export async function updateBookEditionForProject(
  userId: string,
  projectId: string,
  bookId: string,
  editionId: string,
  input: UpdateBookEditionInput,
): Promise<BookEditionRecord> {
  return withTenantTransaction({ userId }, async (db) => {
    await requireProjectMember(db, projectId, userId, "editor");
    const updated = await updateBookEditionPrintStatus(
      db,
      projectId,
      bookId,
      editionId,
      input.printStatus,
    );
    if (!updated) throw notFound();
    return updated;
  });
}

export async function deleteBookEditionForProject(
  userId: string,
  projectId: string,
  bookId: string,
  editionId: string,
): Promise<void> {
  await withTenantTransaction({ userId }, async (db) => {
    await requireProjectMember(db, projectId, userId, "editor");
    const deleted = await deleteBookEdition(db, projectId, bookId, editionId);
    if (!deleted) throw notFound();
  });
}
