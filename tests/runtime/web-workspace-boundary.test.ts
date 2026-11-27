import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

async function sourceFiles(root: string): Promise<string[]> {
  const found: string[] = [];
  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir)) {
      const path = join(dir, entry);
      const info = await stat(path);
      if (info.isDirectory()) await walk(path);
      else if (path.endsWith(".ts") || path.endsWith(".tsx")) found.push(path);
    }
  }
  await walk(root);
  return found;
}

describe("web workspace boundary", () => {
  test("pnpm-workspace includes apps/web and @yunpu/web depends on @yunpu/shared", async () => {
    const workspaceYaml = await readFile(
      new URL("../../pnpm-workspace.yaml", import.meta.url).pathname,
      "utf8",
    );
    expect(workspaceYaml).toMatch(/['"]?apps\/web['"]?/);

    const webPkg = JSON.parse(
      await readFile(
        new URL("../../apps/web/package.json", import.meta.url).pathname,
        "utf8",
      ),
    ) as {
      name?: string;
      dependencies?: Record<string, string>;
    };
    expect(webPkg.name).toBe("@yunpu/web");
    expect(webPkg.dependencies?.["@yunpu/shared"]).toBe("workspace:*");
  });

  test("apps/web source does not import @yunpu/db, apps/api, or bun APIs", async () => {
    const files = await sourceFiles("apps/web/src");
    const offenders: string[] = [];
    for (const file of files) {
      const text = await readFile(file, "utf8");
      if (
        /from\s+["'](@yunpu\/db|@yunpu\/api|bun|bun:test)["']/.test(text) ||
        /from\s+["'][^"']*(apps\/api|packages\/db)/.test(text)
      ) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
