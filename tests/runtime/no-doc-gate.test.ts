import { access, readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";

describe("document linter is not a merge gate", () => {
  test("workflows do not invoke check-docs.sh and the script is gone", async () => {
    const verify = await readFile(".github/workflows/verify.yml", "utf8");
    expect(verify).not.toContain("check-docs.sh");
    await expect(access("scripts/check-docs.sh")).rejects.toThrow();
    await expect(access("tests/docs")).rejects.toThrow();
  });
});
