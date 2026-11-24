import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";

async function readJson(
  path: string,
): Promise<{ scripts?: Record<string, string> }> {
  return JSON.parse(await readFile(path, "utf8")) as {
    scripts?: Record<string, string>;
  };
}

describe("US1 no bun business scripts", () => {
  test("root and api package scripts have no bun business commands", async () => {
    const root = await readJson(
      new URL("../../package.json", import.meta.url).pathname,
    );
    const api = await readJson(
      new URL("../../apps/api/package.json", import.meta.url).pathname,
    );
    for (const [name, script] of Object.entries({
      ...root.scripts,
      ...api.scripts,
    })) {
      expect(script, name).not.toMatch(/(^|[\s;&|])bun(\s|$)/);
    }
  });

  test("verify workflow does not setup bun", async () => {
    const yaml = await readFile(
      new URL("../../.github/workflows/verify.yml", import.meta.url),
      "utf8",
    );
    expect(yaml).not.toMatch(/setup-bun/);
    expect(yaml).toMatch(/node-version:\s*26/);
  });
});
