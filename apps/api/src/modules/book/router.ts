import { Hono } from "hono";
import { createContractBinder } from "../../lib/contract";
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
const route = createContractBinder(
  bookRouter,
  "apps/api/src/modules/book/router.ts",
);

route("get", "/projects/:projectId/books", async (c, { user, params }) => {
  const books = await listBooksForProject(user.id, params.projectId);
  return c.json({ ok: true, data: { books } });
});

route(
  "post",
  "/projects/:projectId/books",
  async (c, { user, params, body }) => {
    const book = await createBookForProject(user.id, params.projectId, body);
    return c.json({ ok: true, data: { book } }, 201);
  },
);

route(
  "put",
  "/projects/:projectId/books/reorder",
  async (c, { user, params, body }) => {
    const books = await reorderBooksForProject(
      user.id,
      params.projectId,
      body.bookIds,
    );
    return c.json({ ok: true, data: { books } });
  },
);

route(
  "get",
  "/projects/:projectId/books/:bookId",
  async (c, { user, params }) => {
    const book = await getBookForProject(
      user.id,
      params.projectId,
      params.bookId,
    );
    return c.json({ ok: true, data: { book } });
  },
);

route(
  "patch",
  "/projects/:projectId/books/:bookId",
  async (c, { user, params, body }) => {
    const book = await updateBookForProject(
      user.id,
      params.projectId,
      params.bookId,
      body,
    );
    return c.json({ ok: true, data: { book } });
  },
);

route(
  "post",
  "/projects/:projectId/books/:bookId/duplicate",
  async (c, { user, params }) => {
    const book = await duplicateBookForProject(
      user.id,
      params.projectId,
      params.bookId,
    );
    return c.json({ ok: true, data: { book } }, 201);
  },
);

route(
  "delete",
  "/projects/:projectId/books/:bookId",
  async (c, { user, params }) => {
    await deleteBookForProject(user.id, params.projectId, params.bookId);
    return c.json({ ok: true, data: { deleted: true } });
  },
);

route(
  "get",
  "/projects/:projectId/books/:bookId/editions",
  async (c, { user, params }) => {
    const editions = await listBookEditionsForProject(
      user.id,
      params.projectId,
      params.bookId,
    );
    return c.json({ ok: true, data: { editions } });
  },
);

route(
  "post",
  "/projects/:projectId/books/:bookId/editions",
  async (c, { user, params, body }) => {
    const edition = await createBookEditionForProject(
      user.id,
      params.projectId,
      params.bookId,
      body,
    );
    return c.json({ ok: true, data: { edition } }, 201);
  },
);

route(
  "patch",
  "/projects/:projectId/books/:bookId/editions/:editionId",
  async (c, { user, params, body }) => {
    const edition = await updateBookEditionForProject(
      user.id,
      params.projectId,
      params.bookId,
      params.editionId,
      body,
    );
    return c.json({ ok: true, data: { edition } });
  },
);

route(
  "delete",
  "/projects/:projectId/books/:bookId/editions/:editionId",
  async (c, { user, params }) => {
    await deleteBookEditionForProject(
      user.id,
      params.projectId,
      params.bookId,
      params.editionId,
    );
    return c.json({ ok: true, data: { deleted: true } });
  },
);

export default bookRouter;
