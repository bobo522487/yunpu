import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

async function filesUnder(root: string): Promise<string[]> {
  const found: string[] = [];
  async function walk(dir: string): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = join(dir, entry);
      const info = await stat(path);
      if (info.isDirectory()) await walk(path);
      else found.push(path);
    }
  }
  await walk(root);
  return found.sort();
}

describe("living docs", () => {
  test("docs keeps only boundaries and decisions", async () => {
    const files = await filesUnder("docs");
    expect(files).toContain("docs/boundaries.md");
    expect(files).toContain("docs/decisions/0001-pg18-defects.md");
    for (const file of files) {
      const allowed =
        file === "docs/boundaries.md" || file.startsWith("docs/decisions/");
      expect(allowed, file).toBe(true);
    }
  });
});
