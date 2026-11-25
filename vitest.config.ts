import { resolve } from "node:path";
import { loadEnvFile } from "./packages/db/src/load-env";
import { defineConfig } from "vitest/config";

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
