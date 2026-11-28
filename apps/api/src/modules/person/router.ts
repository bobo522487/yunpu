import { Hono } from "hono";
import { createContractBinder } from "../../lib/contract";
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
const route = createContractBinder(
  personRouter,
  "apps/api/src/modules/person/router.ts",
);

route(
  "post",
  "/projects/:projectId/persons",
  async (c, { user, params, body }) => {
    const person = await createPersonForProject(
      user.id,
      params.projectId,
      body,
    );
    return c.json({ ok: true, data: { person } }, 201);
  },
);

route(
  "get",
  "/projects/:projectId/persons",
  async (c, { user, params, query }) => {
    const page = await listPersonsForProject(user.id, params.projectId, {
      lineageId: query.lineageId,
      cursor: query.cursor,
      limit: query.limit,
    });
    return c.json({ ok: true, data: page });
  },
);

route(
  "get",
  "/projects/:projectId/persons/:personId",
  async (c, { user, params }) => {
    const person = await getPersonForProject(
      user.id,
      params.projectId,
      params.personId,
    );
    return c.json({ ok: true, data: { person } });
  },
);

route(
  "patch",
  "/projects/:projectId/persons/:personId",
  async (c, { user, params, body }) => {
    const person = await updatePersonForProject(
      user.id,
      params.projectId,
      params.personId,
      body,
    );
    return c.json({ ok: true, data: { person } });
  },
);

route(
  "put",
  "/projects/:projectId/persons/:personId/aggregate",
  async (c, { user, params, body }) => {
    const data = await updatePersonAggregateForProject(
      user.id,
      params.projectId,
      params.personId,
      body,
    );
    return c.json({ ok: true, data });
  },
);

route(
  "post",
  "/projects/:projectId/relatives",
  async (c, { user, params, body }) => {
    const data = await createRelativeForProject(
      user.id,
      params.projectId,
      body,
    );
    return c.json({ ok: true, data }, 201);
  },
);

route(
  "delete",
  "/projects/:projectId/persons/:personId",
  async (c, { user, params }) => {
    await deletePersonForProject(user.id, params.projectId, params.personId);
    return c.json({ ok: true });
  },
);

route(
  "post",
  "/projects/:projectId/persons/:personId/names",
  async (c, { user, params, body }) => {
    const name = await createPersonNameForProject(
      user.id,
      params.projectId,
      params.personId,
      body,
    );
    return c.json({ ok: true, data: { name } }, 201);
  },
);

route(
  "patch",
  "/projects/:projectId/persons/:personId/names/:nameId",
  async (c, { user, params, body }) => {
    const name = await updatePersonNameForProject(
      user.id,
      params.projectId,
      params.personId,
      params.nameId,
      body,
    );
    return c.json({ ok: true, data: { name } });
  },
);

route(
  "delete",
  "/projects/:projectId/persons/:personId/names/:nameId",
  async (c, { user, params }) => {
    await deletePersonNameForProject(
      user.id,
      params.projectId,
      params.personId,
      params.nameId,
    );
    return c.json({ ok: true });
  },
);

route(
  "post",
  "/projects/:projectId/relations",
  async (c, { user, params, body }) => {
    const relation = await createRelationForProject(
      user.id,
      params.projectId,
      body,
    );
    return c.json({ ok: true, data: { relation } }, 201);
  },
);

route(
  "patch",
  "/projects/:projectId/relations/:relationId",
  async (c, { user, params, body }) => {
    const relation = await updateRelationForProject(
      user.id,
      params.projectId,
      params.relationId,
      body,
    );
    return c.json({ ok: true, data: { relation } });
  },
);

route(
  "delete",
  "/projects/:projectId/relations/:relationId",
  async (c, { user, params }) => {
    await deleteRelationForProject(
      user.id,
      params.projectId,
      params.relationId,
    );
    return c.json({ ok: true });
  },
);

route(
  "post",
  "/projects/:projectId/persons/:personId/events",
  async (c, { user, params, body }) => {
    const event = await createPersonEventForProject(
      user.id,
      params.projectId,
      params.personId,
      body,
    );
    return c.json({ ok: true, data: { event } }, 201);
  },
);

route(
  "patch",
  "/projects/:projectId/persons/:personId/events/:eventId",
  async (c, { user, params, body }) => {
    const event = await updatePersonEventForProject(
      user.id,
      params.projectId,
      params.personId,
      params.eventId,
      body,
    );
    return c.json({ ok: true, data: { event } });
  },
);

route(
  "delete",
  "/projects/:projectId/persons/:personId/events/:eventId",
  async (c, { user, params }) => {
    await deletePersonEventForProject(
      user.id,
      params.projectId,
      params.personId,
      params.eventId,
    );
    return c.json({ ok: true });
  },
);

route(
  "get",
  "/projects/:projectId/subgraph",
  async (c, { user, params, query }) => {
    const data = await getSubgraphForProject(user.id, params.projectId, query);
    return c.json({ ok: true, data });
  },
);

export default personRouter;
