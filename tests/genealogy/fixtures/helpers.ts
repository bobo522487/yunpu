import { createOrganization, signUp, uniqueEmail } from "../../auth/fixtures";
import { call, type Envelope } from "../../fixtures/http";

export { call, type Envelope };

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
