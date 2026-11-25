import {
  CreatePersonSchema,
  CreateRelationSchema,
  SubgraphQuerySchema,
  UpdatePersonSchema,
} from "@yunpu/shared";
import { Hono } from "hono";
import { parse, parseJson, requireUser } from "../../lib/http";
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
  const projectId = c.req.param("projectId");
  const input = await parseJson(c, CreatePersonSchema, "issues");
  const person = await createPersonForProject(user.id, projectId, input);
  return c.json({ ok: true, data: { person } }, 201);
});

personRouter.get("/projects/:projectId/persons", async (c) => {
  const user = requireUser(c);
  const persons = await listPersonsForProject(
    user.id,
    c.req.param("projectId"),
  );
  return c.json({ ok: true, data: { persons } });
});

personRouter.get("/projects/:projectId/persons/:personId", async (c) => {
  const user = requireUser(c);
  const person = await getPersonForProject(
    user.id,
    c.req.param("projectId"),
    c.req.param("personId"),
  );
  return c.json({ ok: true, data: { person } });
});

personRouter.patch("/projects/:projectId/persons/:personId", async (c) => {
  const user = requireUser(c);
  const input = await parseJson(c, UpdatePersonSchema, "issues");
  const person = await updatePersonForProject(
    user.id,
    c.req.param("projectId"),
    c.req.param("personId"),
    input,
  );
  return c.json({ ok: true, data: { person } });
});

personRouter.delete("/projects/:projectId/persons/:personId", async (c) => {
  const user = requireUser(c);
  await deletePersonForProject(
    user.id,
    c.req.param("projectId"),
    c.req.param("personId"),
  );
  return c.json({ ok: true });
});

personRouter.post("/projects/:projectId/relations", async (c) => {
  const user = requireUser(c);
  const input = await parseJson(c, CreateRelationSchema, "issues");
  const relation = await createRelationForProject(
    user.id,
    c.req.param("projectId"),
    input,
  );
  return c.json({ ok: true, data: { relation } }, 201);
});

personRouter.delete("/projects/:projectId/relations/:relationId", async (c) => {
  const user = requireUser(c);
  await deleteRelationForProject(
    user.id,
    c.req.param("projectId"),
    c.req.param("relationId"),
  );
  return c.json({ ok: true });
});

personRouter.get("/projects/:projectId/subgraph", async (c) => {
  const user = requireUser(c);
  const query = parse(
    SubgraphQuerySchema,
    {
      rootPersonId: c.req.query("rootPersonId"),
      upDepth: c.req.query("upDepth"),
      downDepth: c.req.query("downDepth"),
      limit: c.req.query("limit"),
    },
    "issues",
  );
  const data = await getSubgraphForProject(
    user.id,
    c.req.param("projectId"),
    query,
  );
  return c.json({ ok: true, data });
});

export default personRouter;
