import { Hono } from "hono";
import { AppError } from "../../lib/errors";
import type { ApiEnv } from "../../types";
import { validationError } from "./errors";
import {
  CreatePersonSchema,
  CreateRelationSchema,
  SubgraphQuerySchema,
  UpdatePersonSchema,
} from "./schema";
import {
  createPersonForProject,
  createRelationForProject,
  deletePersonForProject,
  deleteRelationForProject,
  getPersonForProject,
  getSubgraphForProject,
  updatePersonForProject,
} from "./service";

function requireUser(user: ApiEnv["Variables"]["user"]) {
  if (!user) throw new AppError("UNAUTHORIZED", "需要登录", 401);
  return user;
}

function zodError(error: { flatten: () => unknown }) {
  return validationError({ issues: error.flatten() });
}

export const personRouter = new Hono<ApiEnv>();

personRouter.post("/projects/:projectId/persons", async (c) => {
  const user = requireUser(c.get("user"));
  const projectId = c.req.param("projectId");
  const body = await c.req.json().catch(() => null);
  const parsed = CreatePersonSchema.safeParse(body);
  if (!parsed.success) throw zodError(parsed.error);
  const person = await createPersonForProject(user.id, projectId, parsed.data);
  return c.json({ ok: true, data: { person } }, 201);
});

personRouter.get("/projects/:projectId/persons/:personId", async (c) => {
  const user = requireUser(c.get("user"));
  const person = await getPersonForProject(
    user.id,
    c.req.param("projectId"),
    c.req.param("personId"),
  );
  return c.json({ ok: true, data: { person } });
});

personRouter.patch("/projects/:projectId/persons/:personId", async (c) => {
  const user = requireUser(c.get("user"));
  const body = await c.req.json().catch(() => null);
  const parsed = UpdatePersonSchema.safeParse(body);
  if (!parsed.success) throw zodError(parsed.error);
  const person = await updatePersonForProject(
    user.id,
    c.req.param("projectId"),
    c.req.param("personId"),
    parsed.data,
  );
  return c.json({ ok: true, data: { person } });
});

personRouter.delete("/projects/:projectId/persons/:personId", async (c) => {
  const user = requireUser(c.get("user"));
  await deletePersonForProject(
    user.id,
    c.req.param("projectId"),
    c.req.param("personId"),
  );
  return c.json({ ok: true });
});

personRouter.post("/projects/:projectId/relations", async (c) => {
  const user = requireUser(c.get("user"));
  const body = await c.req.json().catch(() => null);
  const parsed = CreateRelationSchema.safeParse(body);
  if (!parsed.success) throw zodError(parsed.error);
  const relation = await createRelationForProject(
    user.id,
    c.req.param("projectId"),
    parsed.data,
  );
  return c.json({ ok: true, data: { relation } }, 201);
});

personRouter.delete("/projects/:projectId/relations/:relationId", async (c) => {
  const user = requireUser(c.get("user"));
  await deleteRelationForProject(
    user.id,
    c.req.param("projectId"),
    c.req.param("relationId"),
  );
  return c.json({ ok: true });
});

personRouter.get("/projects/:projectId/subgraph", async (c) => {
  const user = requireUser(c.get("user"));
  const parsed = SubgraphQuerySchema.safeParse({
    rootPersonId: c.req.query("rootPersonId"),
    upDepth: c.req.query("upDepth"),
    downDepth: c.req.query("downDepth"),
    limit: c.req.query("limit"),
  });
  if (!parsed.success) throw zodError(parsed.error);
  const data = await getSubgraphForProject(
    user.id,
    c.req.param("projectId"),
    parsed.data,
  );
  return c.json({ ok: true, data });
});
