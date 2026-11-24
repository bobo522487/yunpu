import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

function loadEnvFile(path: string): Record<string, string> {
  const env: Record<string, string> = {};
  const text = readFileSync(path, "utf8");
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    env[key] = value;
  }
  return env;
}

function loadEnvTest(): Record<string, string> {
  // Prefer the gitignored repo-root copy written by `env.sh up test`, then
  // the runtime file under `.local/` (same contents) for CI/fresh checkouts.
  for (const relative of [".env.test", ".local/runtime/test/.env"]) {
    try {
      return loadEnvFile(resolve(__dirname, relative));
    } catch {
      // try next candidate
    }
  }
  return {};
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
