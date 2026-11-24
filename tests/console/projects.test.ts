import { describe, expect, test } from "vitest";
import {
  createOrganization,
  request,
  signUp,
  uniqueEmail,
  withAdminDb,
  type JsonResponse,
} from "../auth/fixtures";

type Envelope = { status: number; json: JsonResponse; data?: Record<string, unknown> };

async function call(
  path: string,
  cookie: string | null,
  init: RequestInit = {},
): Promise<Envelope> {
  const response = await request(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
      ...(init.headers ?? {}),
    },
  });
  const json = (await response.json()) as JsonResponse;
  return { status: response.status, json, data: json.data };
}

async function addMember(
  organizationId: string,
  email: string,
  role: "admin" | "editor" | "viewer",
): Promise<string> {
  const member = await signUp(email);
  await withAdminDb(async (client) => {
    await client.query(
      `INSERT INTO organization_member (organization_id, user_id, role, created_at, updated_at)
       SELECT $1, id, $2, now(), now() FROM auth."user" WHERE email = $3
       ON CONFLICT DO NOTHING`,
      [organizationId, role, email.toLowerCase()],
    );
  });
  return member.cookie;
}

async function createProject(
  cookie: string,
  organizationId: string,
  name: string,
): Promise<Envelope> {
  return call(`/api/v1/organizations/${organizationId}/projects`, cookie, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

describe("project CRUD (console)", () => {
  test("create, list, get, update and delete a project", async () => {
    const owner = await signUp(uniqueEmail("proj-owner"));
    const created = await createOrganization(owner.cookie, "谱项目组织");
    const organizationId = (created.data?.organization as { id: string }).id;

    const createdProject = await createProject(owner.cookie, organizationId, "李氏家谱");
    expect(createdProject.status).toBe(201);
    expect(createdProject.json.ok).toBe(true);
    const project = createdProject.data?.project as Record<string, unknown>;
    expect(project.name).toBe("李氏家谱");
    expect(project.status).toBe("planning");
    expect(project.organizationId).toBe(organizationId);

    const list = await call(
      `/api/v1/organizations/${organizationId}/projects?limit=50`,
      owner.cookie,
    );
    expect(list.status).toBe(200);
    expect((list.data?.items as unknown[]).length).toBe(1);

    const fetched = await call(`/api/v1/projects/${project.id}`, owner.cookie);
    expect(fetched.status).toBe(200);

    const patched = await call(`/api/v1/projects/${project.id}`, owner.cookie, {
      method: "PATCH",
      body: JSON.stringify({
        name: "李氏家谱（修订）",
        expectedUpdatedAt: project.updatedAt,
      }),
    });
    expect(patched.status).toBe(200);
    expect((patched.data?.project as { name: string }).name).toBe("李氏家谱（修订）");
    expect((patched.data?.project as { updatedAt: string }).updatedAt).not.toBe(
      project.updatedAt,
    );

    const removed = await call(`/api/v1/projects/${project.id}`, owner.cookie, {
      method: "DELETE",
    });
    expect(removed.status).toBe(200);

    const afterDelete = await call(
      `/api/v1/organizations/${organizationId}/projects`,
      owner.cookie,
    );
    expect((afterDelete.data?.items as unknown[]).length).toBe(0);
  });

  test("blank project name is rejected", async () => {
    const owner = await signUp(uniqueEmail("proj-blank"));
    const created = await createOrganization(owner.cookie, "空白名组织");
    const organizationId = (created.data?.organization as { id: string }).id;

    const result = await createProject(owner.cookie, organizationId, "   ");
    expect(result.status).toBe(400);
    expect(result.json.code).toBe("VALIDATION");
  });

  test("cross-tenant access to a project returns not found", async () => {
    const owner = await signUp(uniqueEmail("proj-tenant-a"));
    const created = await createOrganization(owner.cookie, "租户A组织");
    const organizationId = (created.data?.organization as { id: string }).id;
    const project = (
      (await createProject(owner.cookie, organizationId, "A的谱")).data
        ?.project as { id: string }
    ).id;

    const stranger = await signUp(uniqueEmail("proj-tenant-b"));
    const otherOrg = await createOrganization(stranger.cookie, "租户B组织");
    const otherOrganizationId = (otherOrg.data?.organization as { id: string }).id;

    const list = await call(
      `/api/v1/organizations/${otherOrganizationId}/projects`,
      stranger.cookie,
    );
    expect((list.data?.items as unknown[]).length).toBe(0);

    for (const init of [
      {},
      { method: "PATCH", body: JSON.stringify({ name: "偷改", expectedUpdatedAt: new Date().toISOString() }) },
      { method: "DELETE" },
    ]) {
      const result = await call(`/api/v1/projects/${project}`, stranger.cookie, init);
      expect(result.status).toBe(404);
      expect(result.json.code).toBe("NOT_FOUND");
    }
  });

  test("stale expectedUpdatedAt yields conflict instead of silent overwrite", async () => {
    const owner = await signUp(uniqueEmail("proj-cas"));
    const created = await createOrganization(owner.cookie, "并发组织");
    const organizationId = (created.data?.organization as { id: string }).id;
    const project = (
      (await createProject(owner.cookie, organizationId, "并发谱")).data
        ?.project as { id: string; updatedAt: string }
    ).id;

    const first = await call(`/api/v1/projects/${project}`, owner.cookie, {
      method: "PATCH",
      body: JSON.stringify({ name: "第一次修改", expectedUpdatedAt: new Date(0).toISOString() }),
    });
    expect(first.status).toBe(409);
    expect(first.json.code).toBe("CONFLICT");
  });

  test("viewer cannot write; editor can create and update but not delete", async () => {
    const owner = await signUp(uniqueEmail("proj-role-o"));
    const created = await createOrganization(owner.cookie, "角色组织");
    const organizationId = (created.data?.organization as { id: string }).id;
    const project = (
      (await createProject(owner.cookie, organizationId, "角色谱")).data
        ?.project as { id: string; updatedAt: string }
    ).id;

    const viewerEmail = uniqueEmail("proj-viewer");
    const viewerCookie = await addMember(organizationId, viewerEmail, "viewer");
    const viewerCreate = await createProject(viewerCookie, organizationId, " viewer 项目");
    expect(viewerCreate.status).toBe(403);
    expect(viewerCreate.json.code).toBe("FORBIDDEN");
    const viewerPatch = await call(`/api/v1/projects/${project}`, viewerCookie, {
      method: "PATCH",
      body: JSON.stringify({ name: "viewer 改", expectedUpdatedAt: new Date().toISOString() }),
    });
    expect(viewerPatch.status).toBe(403);
    const viewerDelete = await call(`/api/v1/projects/${project}`, viewerCookie, {
      method: "DELETE",
    });
    expect(viewerDelete.status).toBe(403);

    const editorEmail = uniqueEmail("proj-editor");
    const editorCookie = await addMember(organizationId, editorEmail, "editor");
    const editorCreate = await createProject(editorCookie, organizationId, "editor 项目");
    expect(editorCreate.status).toBe(201);
    const editorPatch = await call(
      `/api/v1/projects/${(editorCreate.data?.project as { id: string }).id}`,
      editorCookie,
      {
        method: "PATCH",
        body: JSON.stringify({
          name: "editor 改名",
          expectedUpdatedAt: (editorCreate.data?.project as { updatedAt: string }).updatedAt,
        }),
      },
    );
    expect(editorPatch.status).toBe(200);
    const editorDelete = await call(`/api/v1/projects/${project}`, editorCookie, {
      method: "DELETE",
    });
    expect(editorDelete.status).toBe(403);
    expect(editorDelete.json.code).toBe("FORBIDDEN");
  });

  test("list is scoped to the organization and ordered by recent updates", async () => {
    const owner = await signUp(uniqueEmail("proj-order"));
    const created = await createOrganization(owner.cookie, "排序组织");
    const organizationId = (created.data?.organization as { id: string }).id;

    const a = await createProject(owner.cookie, organizationId, "先建的谱");
    await new Promise((resolve) => setTimeout(resolve, 5));
    const b = await createProject(owner.cookie, organizationId, "后建的谱");
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);

    const list = await call(
      `/api/v1/organizations/${organizationId}/projects?sort=recent`,
      owner.cookie,
    );
    const items = list.data?.items as { name: string }[];
    expect(items.length).toBe(2);
    expect(items[0].name).toBe("后建的谱");
    expect(items[1].name).toBe("先建的谱");
  });
});
