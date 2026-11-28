import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

async function sourceFiles(root: string): Promise<string[]> {
  const found: string[] = [];
  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir)) {
      const path = join(dir, entry);
      const info = await stat(path);
      if (info.isDirectory()) {
        // 夹具代表存量记录名，界面按原值显示，不属于新增文案。
        if (entry === "__fixtures__") continue;
        await walk(path);
      } else if (
        (path.endsWith(".ts") || path.endsWith(".tsx")) &&
        !path.endsWith(".test.ts") &&
        !path.endsWith(".test.tsx")
      ) {
        found.push(path);
      }
    }
  }
  await walk(root);
  return found;
}

function visibleLines(text: string): { line: number; text: string }[] {
  return text
    .split("\n")
    .map((raw, index) => ({ line: index + 1, text: raw.trim() }))
    .filter(
      ({ text: line }) =>
        line.length > 0 &&
        !line.startsWith("//") &&
        !line.startsWith("/*") &&
        !line.startsWith("*") &&
        !line.startsWith("{/*"),
    );
}

async function oldTermOffenders(root: string): Promise<string[]> {
  const offenders: string[] = [];
  for (const file of await sourceFiles(root)) {
    const text = await readFile(file, "utf8");
    for (const { line, text: content } of visibleLines(text)) {
      if (content.includes("世系"))
        offenders.push(`${file}:${line} ${content}`);
    }
  }
  return offenders;
}

function oldTermLines(text: string): string[] {
  return text
    .split("\n")
    .filter((line) => line.includes("世系"))
    .map((line) => line.trim());
}

describe("FR-009 文案统一为谱系", () => {
  test("apps/web/src 生产源码的用户可见文案不含「世系」", async () => {
    expect(await oldTermOffenders("apps/web/src")).toEqual([]);
  });

  test("packages/shared/src 用户可见文案不含「世系」", async () => {
    expect(await oldTermOffenders("packages/shared/src")).toEqual([]);
  });

  test("新建默认名为「主谱系」，demo 与目录默认文案无「世系」", async () => {
    const projectService = await readFile(
      "apps/api/src/modules/project/service.ts",
      "utf8",
    );
    const personQueries = await readFile(
      "apps/api/src/modules/person/person-queries.ts",
      "utf8",
    );
    const demoSeed = await readFile(
      "apps/api/src/modules/auth/demo-seed.ts",
      "utf8",
    );
    const bookQueries = await readFile(
      "apps/api/src/modules/book/queries.ts",
      "utf8",
    );

    expect(projectService).toContain("主谱系");
    expect(personQueries).toContain("主谱系");
    expect(demoSeed).toContain('name: "总谱系与支系"');
    expect(demoSeed).toContain('name: "义门陈氏总谱系"');
    expect(bookQueries).toContain('label: "谱系"');
    expect(oldTermLines(projectService)).toEqual([]);
    expect(oldTermLines(personQueries)).toEqual([]);
    expect(oldTermLines(demoSeed)).toEqual([]);
    expect(oldTermLines(bookQueries)).toEqual([]);
  });

  test("空谱系名称的校验提示为「谱系名称不能为空」", async () => {
    const { CreateLineageSchema, UpdateLineageSchema } = await import(
      "../../packages/shared/src/schemas.ts"
    );
    const created = CreateLineageSchema.safeParse({ name: "" });
    expect(created.success).toBe(false);
    if (!created.success) {
      expect(created.error.issues[0]?.message).toBe("谱系名称不能为空");
    }
    const updated = UpdateLineageSchema.safeParse({ name: "", version: 1 });
    expect(updated.success).toBe(false);
    if (!updated.success) {
      expect(updated.error.issues[0]?.message).toBe("谱系名称不能为空");
    }
  });
});
