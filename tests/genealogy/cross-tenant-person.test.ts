import { describe, expect, test } from "vitest";
import { createOrganization, signUp, uniqueEmail } from "../auth/fixtures";
import {
  call,
  createPerson,
  createRelation,
  seedOwnerProject,
} from "./fixtures/helpers";

describe("cross-tenant person isolation", () => {
  test("stranger cannot read or write another org person or relation", async () => {
    const owner = await seedOwnerProject("tenant-a");
    const person = await createPerson(owner.cookie, owner.projectId, {
      displayName: "私有人物",
    });
    const personId = (person.data?.person as { id: string }).id;
    const other = await createPerson(owner.cookie, owner.projectId, {
      displayName: "另一人",
    });
    const otherId = (other.data?.person as { id: string }).id;
    const edge = await createRelation(owner.cookie, owner.projectId, {
      fromPersonId: personId,
      toPersonId: otherId,
      kind: "biological_parent",
    });
    const relationId = (edge.data?.relation as { id: string }).id;

    const stranger = await signUp(uniqueEmail("tenant-b"));
    const strangerOrg = await createOrganization(stranger.cookie, "租户B");
    const strangerOrgId = (strangerOrg.data?.organization as { id: string }).id;
    const strangerProject = await call(
      `/api/v1/organizations/${strangerOrgId}/projects`,
      stranger.cookie,
      { method: "POST", body: JSON.stringify({ name: "B的谱" }) },
    );
    const strangerProjectId = (strangerProject.data?.project as { id: string })
      .id;

    for (const init of [
      {},
      {
        method: "PATCH",
        body: JSON.stringify({ displayName: "偷改", version: 1 }),
      },
      { method: "DELETE" },
    ]) {
      const result = await call(
        `/api/v1/projects/${owner.projectId}/persons/${personId}`,
        stranger.cookie,
        init,
      );
      expect(result.status).toBe(404);
      expect(result.json.code).toBe("NOT_FOUND");
    }

    const writeRelation = await createRelation(
      stranger.cookie,
      owner.projectId,
      {
        fromPersonId: personId,
        toPersonId: otherId,
        kind: "spouse",
      },
    );
    expect(writeRelation.status).toBe(404);

    const deleteRelation = await call(
      `/api/v1/projects/${owner.projectId}/relations/${relationId}`,
      stranger.cookie,
      { method: "DELETE" },
    );
    expect(deleteRelation.status).toBe(404);

    const subgraph = await call(
      `/api/v1/projects/${owner.projectId}/subgraph?rootPersonId=${personId}`,
      stranger.cookie,
    );
    expect(subgraph.status).toBe(404);

    // Stranger's own project cannot see foreign persons by id either.
    const foreignGet = await call(
      `/api/v1/projects/${strangerProjectId}/persons/${personId}`,
      stranger.cookie,
    );
    expect(foreignGet.status).toBe(404);
  });
});
