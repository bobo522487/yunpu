import { expect, test } from "bun:test";
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

test("development GET / contains the starter workspace", async () => {
  const response = await app.request("/");
  expect(response.status).toBe(200);

  const body = await response.text();
  expect(body).toContain("示例工作区");
  expect(body).toContain("yunpu-starter-workspace");
});
