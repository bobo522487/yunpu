import {
  BookEditionIdParamsSchema,
  BookIdParamsSchema,
  CreateBookEditionSchema,
  CreateBookSchema,
  ProjectIdParamsSchema,
  ReorderBooksSchema,
  UpdateBookEditionSchema,
  UpdateBookSchema,
} from "@yunpu/shared";
import { Hono } from "hono";
import { parseJson, parseParams, requireUser } from "../../lib/http";
import type { ApiEnv } from "../../types";
import {
  createBookEditionForProject,
  createBookForProject,
  deleteBookEditionForProject,
  deleteBookForProject,
  duplicateBookForProject,
  getBookForProject,
  listBookEditionsForProject,
  listBooksForProject,
  reorderBooksForProject,
  updateBookEditionForProject,
  updateBookForProject,
} from "./service";

export const bookRouter = new Hono<ApiEnv>();

bookRouter.get("/projects/:projectId/books", async (c) => {
  const user = requireUser(c);
  const { projectId } = parseParams(c, ProjectIdParamsSchema);
  const books = await listBooksForProject(user.id, projectId);
  return c.json({ ok: true, data: { books } });
});

bookRouter.post("/projects/:projectId/books", async (c) => {
  const user = requireUser(c);
  const { projectId } = parseParams(c, ProjectIdParamsSchema);
  const input = await parseJson(c, CreateBookSchema);
  const book = await createBookForProject(user.id, projectId, input);
  return c.json({ ok: true, data: { book } }, 201);
});

bookRouter.put("/projects/:projectId/books/reorder", async (c) => {
  const user = requireUser(c);
  const { projectId } = parseParams(c, ProjectIdParamsSchema);
  const input = await parseJson(c, ReorderBooksSchema);
  const books = await reorderBooksForProject(user.id, projectId, input.bookIds);
  return c.json({ ok: true, data: { books } });
});

bookRouter.get("/projects/:projectId/books/:bookId", async (c) => {
  const user = requireUser(c);
  const { projectId, bookId } = parseParams(c, BookIdParamsSchema);
  const book = await getBookForProject(user.id, projectId, bookId);
  return c.json({ ok: true, data: { book } });
});

bookRouter.patch("/projects/:projectId/books/:bookId", async (c) => {
  const user = requireUser(c);
  const { projectId, bookId } = parseParams(c, BookIdParamsSchema);
  const input = await parseJson(c, UpdateBookSchema);
  const book = await updateBookForProject(user.id, projectId, bookId, input);
  return c.json({ ok: true, data: { book } });
});

bookRouter.post("/projects/:projectId/books/:bookId/duplicate", async (c) => {
  const user = requireUser(c);
  const { projectId, bookId } = parseParams(c, BookIdParamsSchema);
  const book = await duplicateBookForProject(user.id, projectId, bookId);
  return c.json({ ok: true, data: { book } }, 201);
});

bookRouter.delete("/projects/:projectId/books/:bookId", async (c) => {
  const user = requireUser(c);
  const { projectId, bookId } = parseParams(c, BookIdParamsSchema);
  await deleteBookForProject(user.id, projectId, bookId);
  return c.json({ ok: true, data: { deleted: true } });
});

bookRouter.get("/projects/:projectId/books/:bookId/editions", async (c) => {
  const user = requireUser(c);
  const { projectId, bookId } = parseParams(c, BookIdParamsSchema);
  const editions = await listBookEditionsForProject(user.id, projectId, bookId);
  return c.json({ ok: true, data: { editions } });
});

bookRouter.post("/projects/:projectId/books/:bookId/editions", async (c) => {
  const user = requireUser(c);
  const { projectId, bookId } = parseParams(c, BookIdParamsSchema);
  const input = await parseJson(c, CreateBookEditionSchema);
  const edition = await createBookEditionForProject(
    user.id,
    projectId,
    bookId,
    input,
  );
  return c.json({ ok: true, data: { edition } }, 201);
});

bookRouter.patch(
  "/projects/:projectId/books/:bookId/editions/:editionId",
  async (c) => {
    const user = requireUser(c);
    const { projectId, bookId, editionId } = parseParams(
      c,
      BookEditionIdParamsSchema,
    );
    const input = await parseJson(c, UpdateBookEditionSchema);
    const edition = await updateBookEditionForProject(
      user.id,
      projectId,
      bookId,
      editionId,
      input,
    );
    return c.json({ ok: true, data: { edition } });
  },
);

bookRouter.delete(
  "/projects/:projectId/books/:bookId/editions/:editionId",
  async (c) => {
    const user = requireUser(c);
    const { projectId, bookId, editionId } = parseParams(
      c,
      BookEditionIdParamsSchema,
    );
    await deleteBookEditionForProject(user.id, projectId, bookId, editionId);
    return c.json({ ok: true, data: { deleted: true } });
  },
);

export default bookRouter;
