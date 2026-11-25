import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

async function filesUnder(roots: string[]): Promise<string[]> {
  const found: string[] = [];
  async function walk(dir: string): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry === "node_modules" || entry === "dist") continue;
      const path = join(dir, entry);
      const info = await stat(path);
      if (info.isDirectory()) await walk(path);
      else found.push(path);
    }
  }
  for (const root of roots) await walk(root);
  return found;
}

describe("request path", () => {
  test("there is no mapper or repository pass-through", async () => {
    const files = await filesUnder(["apps/api", "packages"]);
    const passthrough = files.filter(
      (file) => /mapper/i.test(file) || file.endsWith(".repo.ts"),
    );
    expect(passthrough).toEqual([]);
    const router = await readFile(
      "apps/api/src/modules/person/router.ts",
      "utf8",
    );
    expect(router).toContain("CreatePersonSchema");
    expect(router).toContain("createPersonForProject");
  });

  test("api, db, and shared stay separate packages", async () => {
    const present = await Promise.all(
      ["apps/api", "packages/db", "packages/shared"].map((dir) =>
        stat(dir).then((info) => info.isDirectory()),
      ),
    );
    expect(present).toEqual([true, true, true]);
  });
});
