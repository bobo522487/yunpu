import {
  CreatePersonSchema,
  CreateRelationSchema,
  PageQuerySchema,
  PersonIdParamsSchema,
  ProjectIdParamsSchema,
  RelationIdParamsSchema,
  SubgraphQuerySchema,
  UpdatePersonSchema,
} from "@yunpu/shared";
import { Hono } from "hono";
import {
  parseJson,
  parseParams,
  parseQuery,
  requireUser,
} from "../../lib/http";
import type { ApiEnv } from "../../types";
import {
  createPersonForProject,
  createRelationForProject,
  deletePersonForProject,
  deleteRelationForProject,
  getPersonForProject,
  getSubgraphForProject,
  listPersonsForProject,
  updatePersonForProject,
} from "./service";

export const personRouter = new Hono<ApiEnv>();

personRouter.post("/projects/:projectId/persons", async (c) => {
  const user = requireUser(c);
  const { projectId } = parseParams(c, ProjectIdParamsSchema);
  const input = await parseJson(c, CreatePersonSchema);
  const person = await createPersonForProject(user.id, projectId, input);
  return c.json({ ok: true, data: { person } }, 201);
});

personRouter.get("/projects/:projectId/persons", async (c) => {
  const user = requireUser(c);
  const { projectId } = parseParams(c, ProjectIdParamsSchema);
  const query = parseQuery(c, PageQuerySchema);
  const page = await listPersonsForProject(user.id, projectId, {
    cursor: query.cursor,
    limit: query.limit,
  });
  return c.json({ ok: true, data: page });
});

personRouter.get("/projects/:projectId/persons/:personId", async (c) => {
  const user = requireUser(c);
  const { projectId, personId } = parseParams(c, PersonIdParamsSchema);
  const person = await getPersonForProject(user.id, projectId, personId);
  return c.json({ ok: true, data: { person } });
});

personRouter.patch("/projects/:projectId/persons/:personId", async (c) => {
  const user = requireUser(c);
  const { projectId, personId } = parseParams(c, PersonIdParamsSchema);
  const input = await parseJson(c, UpdatePersonSchema);
  const person = await updatePersonForProject(
    user.id,
    projectId,
    personId,
    input,
  );
  return c.json({ ok: true, data: { person } });
});

personRouter.delete("/projects/:projectId/persons/:personId", async (c) => {
  const user = requireUser(c);
  const { projectId, personId } = parseParams(c, PersonIdParamsSchema);
  await deletePersonForProject(user.id, projectId, personId);
  return c.json({ ok: true });
});

personRouter.post("/projects/:projectId/relations", async (c) => {
  const user = requireUser(c);
  const { projectId } = parseParams(c, ProjectIdParamsSchema);
  const input = await parseJson(c, CreateRelationSchema);
  const relation = await createRelationForProject(user.id, projectId, input);
  return c.json({ ok: true, data: { relation } }, 201);
});

personRouter.delete("/projects/:projectId/relations/:relationId", async (c) => {
  const user = requireUser(c);
  const { projectId, relationId } = parseParams(c, RelationIdParamsSchema);
  await deleteRelationForProject(user.id, projectId, relationId);
  return c.json({ ok: true });
});

personRouter.get("/projects/:projectId/subgraph", async (c) => {
  const user = requireUser(c);
  const { projectId } = parseParams(c, ProjectIdParamsSchema);
  const query = parseQuery(c, SubgraphQuerySchema);
  const data = await getSubgraphForProject(user.id, projectId, query);
  return c.json({ ok: true, data });
});

export default personRouter;
