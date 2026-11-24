import { describe, expect, test } from "vitest";
import { request } from "../auth/fixtures";
import { call, seedOwnerProject } from "../genealogy/fixtures/helpers";

function assertEnvelope(json: {
  ok?: boolean;
  code?: string;
  message?: string;
}) {
  expect(json.ok).toBe(false);
  expect(typeof json.code).toBe("string");
  expect(typeof json.message).toBe("string");
  expect(json).not.toHaveProperty("error");
}

describe("error envelope shape", () => {
  test("401 unauthenticated", async () => {
    const response = await request(
      "/api/v1/projects/00000000-0000-0000-0000-000000000001",
    );
    const json = (await response.json()) as {
      ok: boolean;
      code: string;
      message: string;
    };
    expect(response.status).toBe(401);
    assertEnvelope(json);
  });

  test("400 validation on blank person name", async () => {
    const { cookie, projectId } = await seedOwnerProject("env-400");
    const result = await call(`/api/v1/projects/${projectId}/persons`, cookie, {
      method: "POST",
      body: JSON.stringify({ displayName: "   " }),
    });
    expect(result.status).toBe(400);
    assertEnvelope(result.json);
  });

  test("404 missing person", async () => {
    const { cookie, projectId } = await seedOwnerProject("env-404");
    const result = await call(
      `/api/v1/projects/${projectId}/persons/00000000-0000-7000-8000-000000000099`,
      cookie,
    );
    expect(result.status).toBe(404);
    assertEnvelope(result.json);
  });

  test("409 version conflict", async () => {
    const { cookie, projectId } = await seedOwnerProject("env-409");
    const created = await call(
      `/api/v1/projects/${projectId}/persons`,
      cookie,
      {
        method: "POST",
        body: JSON.stringify({ displayName: "冲突人物" }),
      },
    );
    const person = created.data?.person as { id: string; version: number };
    const conflict = await call(
      `/api/v1/projects/${projectId}/persons/${person.id}`,
      cookie,
      {
        method: "PATCH",
        body: JSON.stringify({
          displayName: "旧版",
          version: person.version + 10,
        }),
      },
    );
    expect(conflict.status).toBe(409);
    assertEnvelope(conflict.json);
    expect(conflict.json.code).toBe("VERSION_CONFLICT");
  });

  test("sign-up still returns envelope on validation", async () => {
    const response = await request("/api/v1/auth/sign-up", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "not-an-email", password: "x" }),
    });
    const json = (await response.json()) as {
      ok: boolean;
      code: string;
      message: string;
    };
    expect(response.status).toBeGreaterThanOrEqual(400);
    assertEnvelope(json);
  });
});
