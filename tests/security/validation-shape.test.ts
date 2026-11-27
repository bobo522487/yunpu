import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { createOrganization, signUp, uniqueEmail } from "../auth/fixtures";
import { call } from "../fixtures/http";

describe("validation error envelope", () => {
  test("person and project routes share the same fieldErrors shape", async () => {
    const owner = await signUp(uniqueEmail("validation-shape"));
    const created = await createOrganization(owner.cookie, "校验组织");
    const organizationId = (created.data?.organization as { id: string }).id;
    const project = await call(
      `/api/v1/organizations/${organizationId}/projects`,
      owner.cookie,
      { method: "POST", body: JSON.stringify({ name: "校验项目" }) },
    );
    const projectId = (project.data?.project as { id: string }).id;

    const invalidProject = await call(
      `/api/v1/organizations/${organizationId}/projects`,
      owner.cookie,
      { method: "POST", body: JSON.stringify({ name: "" }) },
    );
    const invalidPerson = await call(
      `/api/v1/projects/${projectId}/persons`,
      owner.cookie,
      { method: "POST", body: JSON.stringify({ displayName: "" }) },
    );

    expect(invalidProject.status).toBe(400);
    expect(invalidPerson.status).toBe(400);
    expect(invalidProject.json.details).toHaveProperty("name");
    expect(invalidPerson.json.details).toHaveProperty("displayName");
    expect(invalidPerson.json.details).not.toHaveProperty("issues");
  });
});

describe("generated OpenAPI contract", () => {
  test("no suspended status remains anywhere in the generated contract", async () => {
    const document = await readFile(
      join(process.cwd(), "contracts/openapi.json"),
      "utf8",
    );
    expect(document).not.toContain("suspended");
  });

  test("every operation declares parameters, request bodies where needed, and schemas", async () => {
    const document = JSON.parse(
      await readFile(join(process.cwd(), "contracts/openapi.json"), "utf8"),
    ) as {
      paths: Record<
        string,
        Record<
          string,
          {
            parameters?: unknown[];
            requestBody?: { content: Record<string, { schema: unknown }> };
            responses: Record<
              string,
              { content?: Record<string, { schema: unknown }> }
            >;
          }
        >
      >;
      components: { schemas: Record<string, unknown> };
    };

    const operations = Object.values(document.paths).flatMap((path) =>
      Object.values(path),
    );
    expect(operations.length).toBeGreaterThanOrEqual(38);
    expect(Object.keys(document.components.schemas).length).toBeGreaterThan(20);

    for (const operation of operations) {
      expect(operation.parameters).toBeDefined();
      for (const response of Object.values(operation.responses)) {
        const schema =
          response.content?.["application/json"]?.schema ??
          response.content?.["application/octet-stream"]?.schema;
        expect(schema).toBeDefined();
      }
    }

    const signUp = document.paths["/api/v1/auth/sign-up"]?.post;
    expect(
      signUp?.requestBody?.content["application/json"]?.schema,
    ).toBeDefined();
    expect(
      signUp?.responses["201"]?.content?.["application/json"]?.schema,
    ).toBeDefined();
  });
});
