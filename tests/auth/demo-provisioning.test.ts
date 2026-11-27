import { describe, expect, test } from "vitest";
import { call } from "../fixtures/http";
import {
  findUserIdByEmail,
  insertInvite,
  signUp,
  uniqueEmail,
} from "./fixtures";

describe("new user demo family provisioning (auth)", () => {
  test("personal default organization receives editable and deletable 3-gen demo project", async () => {
    const email = uniqueEmail("demo-seed");
    const signedUp = await signUp(email);
    expect(signedUp.response.status).toBe(201);
    const defaultOrgId = (
      signedUp.json.data?.defaultOrganization as { id: string }
    ).id;

    const projects = await call(
      `/api/v1/organizations/${defaultOrgId}/projects`,
      signedUp.cookie,
    );
    expect(projects.status).toBe(200);
    const items = projects.data?.items as {
      id: string;
      name: string;
      version: number;
    }[];
    expect(items.length).toBe(1);
    expect(items[0]?.name).toBe("义门陈氏宗谱（范例）");
    const demoProjectId = items[0].id;

    const directory = await call(
      `/api/v1/projects/${demoProjectId}/lineages`,
      signedUp.cookie,
    );
    expect(directory.status).toBe(200);
    const folders = directory.data?.folders as { id: string; name: string }[];
    const lineages = directory.data?.lineages as { id: string; name: string }[];
    expect(folders.length).toBe(1);
    expect(lineages.length).toBe(1);

    const graph = await call(
      `/api/v1/projects/${demoProjectId}/lineages/${lineages[0].id}/graph`,
      signedUp.cookie,
    );
    expect(graph.status).toBe(200);
    const persons = graph.data?.persons as {
      names?: unknown[];
      events?: unknown[];
    }[];
    const relations = graph.data?.relations as { kind: string }[];
    expect(persons.length).toBe(9);
    expect(relations.length).toBeGreaterThanOrEqual(8);
    expect(persons.some((p) => (p.events?.length ?? 0) > 0)).toBe(true);
    expect(persons.some((p) => (p.names?.length ?? 0) > 1)).toBe(true);

    // Demo project is editable
    const edited = await call(
      `/api/v1/projects/${demoProjectId}`,
      signedUp.cookie,
      {
        method: "PATCH",
        body: JSON.stringify({
          name: "我修改后的义门陈谱",
          version: items[0].version,
        }),
      },
    );
    expect(edited.status).toBe(200);

    // Demo project is deletable
    const deleted = await call(
      `/api/v1/projects/${demoProjectId}`,
      signedUp.cookie,
      { method: "DELETE" },
    );
    expect(deleted.status).toBe(200);

    const afterDelete = await call(
      `/api/v1/organizations/${defaultOrgId}/projects`,
      signedUp.cookie,
    );
    expect((afterDelete.data?.items as unknown[]).length).toBe(0);
  });

  test("signing up via valid invite joins inviter org without seeding a duplicate demo project", async () => {
    const ownerEmail = uniqueEmail("invite-host");
    const owner = await signUp(ownerEmail);
    const orgId = (owner.json.data?.defaultOrganization as { id: string }).id;
    const ownerUserId = await findUserIdByEmail(ownerEmail);
    expect(ownerUserId).toBeDefined();

    const inviteeEmail = uniqueEmail("invite-guest");
    const token = `demo-skip-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await insertInvite({
      organizationId: orgId,
      email: inviteeEmail,
      token,
      invitedBy: ownerUserId as string,
      role: "editor",
    });

    const guest = await signUp(inviteeEmail, { inviteToken: token });
    expect(guest.response.status).toBe(201);
    expect((guest.json.data?.defaultOrganization as { id: string }).id).toBe(
      orgId,
    );

    const projects = await call(
      `/api/v1/organizations/${orgId}/projects`,
      owner.cookie,
    );
    expect(projects.status).toBe(200);
    expect((projects.data?.items as unknown[]).length).toBe(1);
  });
});
