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
      else if (path.endsWith(".ts")) found.push(path);
    }
  }
  await walk(root);
  return found;
}

describe("module database entry", () => {
  test("modules do not import a pool, withUser, or createDb except auth", async () => {
    const files = await sourceFiles("apps/api/src/modules");
    const offenders: string[] = [];
    for (const file of files) {
      const text = await readFile(file, "utf8");
      const importsPool = /from ["'][^"']*db\/pool["']/.test(text);
      const importsWithUser = /\bwithUser\b/.test(text);
      const importsBusinessPool = /\bbusinessPool\b/.test(text);
      const importsCreateDb =
        /\bcreateDb\b/.test(text) &&
        !file.endsWith("apps/api/src/modules/auth/better-auth.ts");
      if (
        importsPool ||
        importsWithUser ||
        importsBusinessPool ||
        importsCreateDb
      ) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
