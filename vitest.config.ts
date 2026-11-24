import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "tests/**/*.test.ts",
      "apps/api/test/**/*.test.ts",
    ],
    fileParallelism: false,
    sequence: { concurrent: false },
    env: {
      // Loaded per-suite via fixtures; keep vitest from inventing values.
    },
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
