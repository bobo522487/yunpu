import { describe, expect, test } from "vitest";
import { call, seedOwnerProject } from "./fixtures/helpers";
import { seedLargeTree } from "./fixtures/large-tree";

/**
 * Opt-in performance suite. Default CI skips unless YUNPU_PERF=1.
 * Fixture: tests/genealogy/fixtures/large-tree.ts (~5k persons + parent edges).
 */
const runPerf = process.env.YUNPU_PERF === "1";

describe.skipIf(!runPerf)("subgraph performance (~5k)", () => {
  test("default viewport P95 under 200ms on seeded tree", async () => {
    const { cookie, organizationId, projectId } =
      await seedOwnerProject("sub-perf");
    const tree = await seedLargeTree({
      organizationId,
      projectId,
      personCount: 5000,
    });
    expect(tree.personCount).toBe(5000);

    const samples: number[] = [];
    for (let i = 0; i < 16; i += 1) {
      const started = performance.now();
      const result = await call(
        `/api/v1/projects/${projectId}/subgraph?rootPersonId=${tree.rootPersonId}`,
        cookie,
      );
      const elapsed = performance.now() - started;
      expect(result.status).toBe(200);
      const data = result.data as { persons: unknown[] };
      expect(data.persons.length).toBeGreaterThan(0);
      expect(data.persons.length).toBeLessThanOrEqual(300);
      // Warm-up samples discarded for P95 (planner/cache settle).
      if (i >= 4) samples.push(elapsed);
    }

    samples.sort((a, b) => a - b);
    const index = Math.min(
      samples.length - 1,
      Math.ceil(samples.length * 0.95) - 1,
    );
    const p95 = samples[index];
    expect(p95).toBeLessThan(200);
  }, 180_000);
});
