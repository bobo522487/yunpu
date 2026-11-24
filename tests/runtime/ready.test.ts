import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";

describe("US1 runtime ready", () => {
  test("app /api/ready returns JSON with process check without Bun runtime", async () => {
    const { default: app } = await import("../../apps/api/src/app");
    const response = await app.request("/api/ready");
    const json = (await response.json()) as { ok: boolean; checks: Record<string, string> };
    expect(typeof json.ok).toBe("boolean");
    expect(json.checks.process).toBe("up");
  });

  test("package scripts use node/vitest and not bun for migrate/test/start", async () => {
    const raw = await readFile(new URL("../../package.json", import.meta.url), "utf8");
    const pkg = JSON.parse(raw) as { scripts: Record<string, string>; engines?: { node?: string } };
    expect(pkg.engines?.node).toMatch(/26/);
    expect(pkg.scripts["db:migrate"]).toContain("node packages/db/src/migrate.ts");
    expect(pkg.scripts.test).not.toMatch(/\bbun\b/);
    expect(pkg.scripts["test:all"]).not.toMatch(/\bbun\b/);
    expect(pkg.scripts["start:api"]).toContain("node apps/api/src/index.ts");
  });
});
