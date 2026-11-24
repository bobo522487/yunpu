import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

function loadEnvTest(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    const text = readFileSync(resolve(__dirname, ".env.test"), "utf8");
    for (const rawLine of text.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      const value = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
      env[key] = value;
    }
  } catch {
    // Caller may export variables directly.
  }
  return env;
}

export default defineConfig({
  test: {
    include: [
      "tests/**/*.test.ts",
      "apps/api/test/**/*.test.ts",
    ],
    fileParallelism: false,
    sequence: { concurrent: false },
    env: loadEnvTest(),
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
