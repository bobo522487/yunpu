import {
  createOrganization,
  type JsonResponse,
  request,
  signUp,
  uniqueEmail,
} from "../../auth/fixtures";

export type Envelope = {
  status: number;
  json: JsonResponse;
  data?: Record<string, unknown>;
};

export async function call(
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

export async function seedOwnerProject(prefix: string): Promise<{
  cookie: string;
  organizationId: string;
  projectId: string;
}> {
  const owner = await signUp(uniqueEmail(prefix));
  const created = await createOrganization(owner.cookie, `${prefix}-org`);
  const organizationId = (created.data?.organization as { id: string }).id;
  const project = await call(
    `/api/v1/organizations/${organizationId}/projects`,
    owner.cookie,
    { method: "POST", body: JSON.stringify({ name: `${prefix}-谱` }) },
  );
  return {
    cookie: owner.cookie,
    organizationId,
    projectId: (project.data?.project as { id: string }).id,
  };
}

export async function createPerson(
  cookie: string,
  projectId: string,
  body: Record<string, unknown>,
): Promise<Envelope> {
  return call(`/api/v1/projects/${projectId}/persons`, cookie, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function createRelation(
  cookie: string,
  projectId: string,
  body: Record<string, unknown>,
): Promise<Envelope> {
  return call(`/api/v1/projects/${projectId}/relations`, cookie, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
