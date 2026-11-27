import { describe, expect, test, vi } from "vitest";
import { config } from "../../apps/api/src/config";
import { OPENAPI_OPERATIONS } from "../../apps/api/src/openapi/operations";
import * as storage from "../../apps/api/src/storage";
import { insertInvite, request, signUp, uniqueEmail } from "../auth/fixtures";
import { call } from "../fixtures/http";

function operationFor(
  method: "get" | "post" | "patch" | "put" | "delete",
  path: string,
) {
  const found = OPENAPI_OPERATIONS.find(
    (entry) => entry.method === method && entry.path === path,
  );
  if (!found) {
    throw new Error(`Missing OpenAPI operation: ${method} ${path}`);
  }
  return found;
}

function assertMatchesContract(
  method: "get" | "post" | "patch" | "put" | "delete",
  path: string,
  payload: unknown,
) {
  const parsed = operationFor(method, path).success.safeParse(payload);
  expect(
    parsed.success,
    `${method.toUpperCase()} ${path} drifted: ${parsed.success ? "" : JSON.stringify(parsed.error.issues)}`,
  ).toBe(true);
}

describe("OpenAPI contract conformance", () => {
  test("live HTTP responses match OPENAPI_OPERATIONS success schemas", async () => {
    const health = await request("/api/health");
    expect(health.status).toBe(200);
    assertMatchesContract("get", "/api/health", await health.json());

    const anonSession = await request("/api/v1/auth/session");
    expect(anonSession.status).toBe(200);
    assertMatchesContract(
      "get",
      "/api/v1/auth/session",
      await anonSession.json(),
    );

    const ownerEmail = uniqueEmail("contract-o");
    const signedUp = await signUp(ownerEmail);
    expect(signedUp.response.status).toBe(201);
    assertMatchesContract("post", "/api/v1/auth/sign-up", signedUp.json);
    const ownerUserId = (signedUp.json.data?.user as { id: string }).id;

    const authSession = await request("/api/v1/auth/session", {
      headers: { cookie: signedUp.cookie },
    });
    assertMatchesContract(
      "get",
      "/api/v1/auth/session",
      await authSession.json(),
    );

    const createdOrg = await call("/api/v1/organizations", signedUp.cookie, {
      method: "POST",
      body: JSON.stringify({ name: "契约验证组织" }),
    });
    expect(createdOrg.status).toBe(201);
    assertMatchesContract("post", "/api/v1/organizations", createdOrg.json);
    const orgId = (createdOrg.data?.organization as { id: string }).id;

    const listedOrgs = await call("/api/v1/organizations", signedUp.cookie);
    expect(listedOrgs.status).toBe(200);
    assertMatchesContract("get", "/api/v1/organizations", listedOrgs.json);

    const orgDetail = await call(
      `/api/v1/organizations/${orgId}`,
      signedUp.cookie,
    );
    expect(orgDetail.status).toBe(200);
    assertMatchesContract(
      "get",
      "/api/v1/organizations/{organizationId}",
      orgDetail.json,
    );

    const activated = await call(
      `/api/v1/organizations/${orgId}/activate`,
      signedUp.cookie,
      { method: "POST" },
    );
    expect(activated.status).toBe(200);
    assertMatchesContract(
      "post",
      "/api/v1/organizations/{organizationId}/activate",
      activated.json,
    );

    const members = await call(
      `/api/v1/organizations/${orgId}/members`,
      signedUp.cookie,
    );
    expect(members.status).toBe(200);
    assertMatchesContract(
      "get",
      "/api/v1/organizations/{organizationId}/members",
      members.json,
    );

    const inviteCreated = await call(
      `/api/v1/organizations/${orgId}/invites`,
      signedUp.cookie,
      {
        method: "POST",
        body: JSON.stringify({ email: uniqueEmail("contract-inv") }),
      },
    );
    expect(inviteCreated.status).toBe(201);
    assertMatchesContract(
      "post",
      "/api/v1/organizations/{organizationId}/invites",
      inviteCreated.json,
    );

    const invites = await call(
      `/api/v1/organizations/${orgId}/invites`,
      signedUp.cookie,
    );
    expect(invites.status).toBe(200);
    assertMatchesContract(
      "get",
      "/api/v1/organizations/{organizationId}/invites",
      invites.json,
    );

    const inviteeEmail = uniqueEmail("contract-accept");
    const invitee = await signUp(inviteeEmail);
    const token = crypto.randomUUID();
    await insertInvite({
      organizationId: orgId,
      email: inviteeEmail,
      token,
      invitedBy: ownerUserId,
    });
    const accepted = await call("/api/v1/invites/accept", invitee.cookie, {
      method: "POST",
      body: JSON.stringify({ token }),
    });
    expect(accepted.status).toBe(200);
    assertMatchesContract("post", "/api/v1/invites/accept", accepted.json);

    const createdProject = await call(
      `/api/v1/organizations/${orgId}/projects`,
      signedUp.cookie,
      { method: "POST", body: JSON.stringify({ name: "契约验证谱" }) },
    );
    expect(createdProject.status).toBe(201);
    assertMatchesContract(
      "post",
      "/api/v1/organizations/{organizationId}/projects",
      createdProject.json,
    );
    const projectId = (createdProject.data?.project as { id: string }).id;

    const listedProjects = await call(
      `/api/v1/organizations/${orgId}/projects`,
      signedUp.cookie,
    );
    expect(listedProjects.status).toBe(200);
    assertMatchesContract(
      "get",
      "/api/v1/organizations/{organizationId}/projects",
      listedProjects.json,
    );

    const createdPerson = await call(
      `/api/v1/projects/${projectId}/persons`,
      signedUp.cookie,
      { method: "POST", body: JSON.stringify({ displayName: "契约先祖" }) },
    );
    expect(createdPerson.status).toBe(201);
    assertMatchesContract(
      "post",
      "/api/v1/projects/{projectId}/persons",
      createdPerson.json,
    );
    const personId = (createdPerson.data?.person as { id: string }).id;

    const listedPersons = await call(
      `/api/v1/projects/${projectId}/persons`,
      signedUp.cookie,
    );
    expect(listedPersons.status).toBe(200);
    assertMatchesContract(
      "get",
      "/api/v1/projects/{projectId}/persons",
      listedPersons.json,
    );

    const subgraph = await call(
      `/api/v1/projects/${projectId}/subgraph?rootPersonId=${personId}`,
      signedUp.cookie,
    );
    expect(subgraph.status).toBe(200);
    assertMatchesContract(
      "get",
      "/api/v1/projects/{projectId}/subgraph",
      subgraph.json,
    );

    const putSpy = vi.spyOn(storage, "putObject").mockResolvedValue(undefined);
    try {
      const uploaded = await request("/api/media", {
        method: "POST",
        headers: {
          authorization: `Bearer ${config().YUNPU_CAPABILITY_TOKEN}`,
        },
        body: "hello",
      });
      expect(uploaded.status).toBe(201);
      assertMatchesContract("post", "/api/media", await uploaded.json());
    } finally {
      putSpy.mockRestore();
    }
  });
});
