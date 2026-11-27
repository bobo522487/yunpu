import {
  CreatePersonEventSchema,
  CreatePersonNameSchema,
  CreatePersonSchema,
  CreateRelationSchema,
  CreateRelativeSchema,
  ListPersonsQuerySchema,
  PersonEventIdParamsSchema,
  PersonIdParamsSchema,
  PersonNameIdParamsSchema,
  ProjectIdParamsSchema,
  RelationIdParamsSchema,
  SubgraphQuerySchema,
  UpdatePersonAggregateSchema,
  UpdatePersonEventSchema,
  UpdatePersonNameSchema,
  UpdatePersonSchema,
  UpdateRelationSchema,
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
  createPersonEventForProject,
  createPersonForProject,
  createPersonNameForProject,
  createRelationForProject,
  createRelativeForProject,
  deletePersonEventForProject,
  deletePersonForProject,
  deletePersonNameForProject,
  deleteRelationForProject,
  getPersonForProject,
  getSubgraphForProject,
  listPersonsForProject,
  updatePersonAggregateForProject,
  updatePersonEventForProject,
  updatePersonForProject,
  updatePersonNameForProject,
  updateRelationForProject,
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
  const query = parseQuery(c, ListPersonsQuerySchema);
  const page = await listPersonsForProject(user.id, projectId, {
    lineageId: query.lineageId,
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

personRouter.put(
  "/projects/:projectId/persons/:personId/aggregate",
  async (c) => {
    const user = requireUser(c);
    const { projectId, personId } = parseParams(c, PersonIdParamsSchema);
    const input = await parseJson(c, UpdatePersonAggregateSchema);
    const data = await updatePersonAggregateForProject(
      user.id,
      projectId,
      personId,
      input,
    );
    return c.json({ ok: true, data });
  },
);

personRouter.post("/projects/:projectId/relatives", async (c) => {
  const user = requireUser(c);
  const { projectId } = parseParams(c, ProjectIdParamsSchema);
  const input = await parseJson(c, CreateRelativeSchema);
  const data = await createRelativeForProject(user.id, projectId, input);
  return c.json({ ok: true, data }, 201);
});

personRouter.delete("/projects/:projectId/persons/:personId", async (c) => {
  const user = requireUser(c);
  const { projectId, personId } = parseParams(c, PersonIdParamsSchema);
  await deletePersonForProject(user.id, projectId, personId);
  return c.json({ ok: true });
});

personRouter.post("/projects/:projectId/persons/:personId/names", async (c) => {
  const user = requireUser(c);
  const { projectId, personId } = parseParams(c, PersonIdParamsSchema);
  const input = await parseJson(c, CreatePersonNameSchema);
  const name = await createPersonNameForProject(
    user.id,
    projectId,
    personId,
    input,
  );
  return c.json({ ok: true, data: { name } }, 201);
});

personRouter.patch(
  "/projects/:projectId/persons/:personId/names/:nameId",
  async (c) => {
    const user = requireUser(c);
    const { projectId, personId, nameId } = parseParams(
      c,
      PersonNameIdParamsSchema,
    );
    const input = await parseJson(c, UpdatePersonNameSchema);
    const name = await updatePersonNameForProject(
      user.id,
      projectId,
      personId,
      nameId,
      input,
    );
    return c.json({ ok: true, data: { name } });
  },
);

personRouter.delete(
  "/projects/:projectId/persons/:personId/names/:nameId",
  async (c) => {
    const user = requireUser(c);
    const { projectId, personId, nameId } = parseParams(
      c,
      PersonNameIdParamsSchema,
    );
    await deletePersonNameForProject(user.id, projectId, personId, nameId);
    return c.json({ ok: true });
  },
);

personRouter.post("/projects/:projectId/relations", async (c) => {
  const user = requireUser(c);
  const { projectId } = parseParams(c, ProjectIdParamsSchema);
  const input = await parseJson(c, CreateRelationSchema);
  const relation = await createRelationForProject(user.id, projectId, input);
  return c.json({ ok: true, data: { relation } }, 201);
});

personRouter.patch("/projects/:projectId/relations/:relationId", async (c) => {
  const user = requireUser(c);
  const { projectId, relationId } = parseParams(c, RelationIdParamsSchema);
  const input = await parseJson(c, UpdateRelationSchema);
  const relation = await updateRelationForProject(
    user.id,
    projectId,
    relationId,
    input,
  );
  return c.json({ ok: true, data: { relation } });
});

personRouter.delete("/projects/:projectId/relations/:relationId", async (c) => {
  const user = requireUser(c);
  const { projectId, relationId } = parseParams(c, RelationIdParamsSchema);
  await deleteRelationForProject(user.id, projectId, relationId);
  return c.json({ ok: true });
});

personRouter.post(
  "/projects/:projectId/persons/:personId/events",
  async (c) => {
    const user = requireUser(c);
    const { projectId, personId } = parseParams(c, PersonIdParamsSchema);
    const input = await parseJson(c, CreatePersonEventSchema);
    const event = await createPersonEventForProject(
      user.id,
      projectId,
      personId,
      input,
    );
    return c.json({ ok: true, data: { event } }, 201);
  },
);

personRouter.patch(
  "/projects/:projectId/persons/:personId/events/:eventId",
  async (c) => {
    const user = requireUser(c);
    const { projectId, personId, eventId } = parseParams(
      c,
      PersonEventIdParamsSchema,
    );
    const input = await parseJson(c, UpdatePersonEventSchema);
    const event = await updatePersonEventForProject(
      user.id,
      projectId,
      personId,
      eventId,
      input,
    );
    return c.json({ ok: true, data: { event } });
  },
);

personRouter.delete(
  "/projects/:projectId/persons/:personId/events/:eventId",
  async (c) => {
    const user = requireUser(c);
    const { projectId, personId, eventId } = parseParams(
      c,
      PersonEventIdParamsSchema,
    );
    await deletePersonEventForProject(user.id, projectId, personId, eventId);
    return c.json({ ok: true });
  },
);

personRouter.get("/projects/:projectId/subgraph", async (c) => {
  const user = requireUser(c);
  const { projectId } = parseParams(c, ProjectIdParamsSchema);
  const query = parseQuery(c, SubgraphQuerySchema);
  const data = await getSubgraphForProject(user.id, projectId, query);
  return c.json({ ok: true, data });
});

export default personRouter;
