import { expect, test } from "vitest";
import app from "../../apps/api/src/app.ts";

process.env.YUNPU_ENV = "development";

test("GET /api/health returns process and database up and omits storage", async () => {
  const response = await app.request("/api/health");
  expect(response.status).toBe(200);

  const body = await response.json();
  expect(body).toEqual({
    ok: true,
    checks: {
      process: "up",
      database: "up",
    },
  });
  expect(body).not.toHaveProperty("storage");
  expect(body.checks).not.toHaveProperty("storage");
});

test("API service does not serve legacy HTML at /", async () => {
  const response = await app.request("/");
  expect(response.status).toBe(404);

  const body = await response.json();
  expect(body).toEqual({
    ok: false,
    code: "NOT_FOUND",
    message: "接口不存在",
  });
});
