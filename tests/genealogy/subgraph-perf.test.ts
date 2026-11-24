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

  test("10k list and subgraph stay under 2s and ignore a doubled other project", async () => {
    const first = await seedOwnerProject("sub-10k");
    const tree = await seedLargeTree({
      organizationId: first.organizationId,
      projectId: first.projectId,
      personCount: 10_000,
    });
    const second = await seedOwnerProject("sub-10k-other");

    async function sample(): Promise<{ list: number; subgraph: number }> {
      const listStarted = performance.now();
      const listed = await call(
        `/api/v1/projects/${first.projectId}/persons`,
        first.cookie,
      );
      const list = performance.now() - listStarted;
      expect(listed.status).toBe(200);
      expect((listed.data?.persons as unknown[]).length).toBe(10_000);

      const graphStarted = performance.now();
      const graph = await call(
        `/api/v1/projects/${first.projectId}/subgraph?rootPersonId=${tree.rootPersonId}`,
        first.cookie,
      );
      const subgraph = performance.now() - graphStarted;
      expect(graph.status).toBe(200);
      return { list, subgraph };
    }

    async function measure(): Promise<{ list: number; subgraph: number }> {
      await sample();
      const samples = [await sample(), await sample(), await sample()];
      const median = (values: number[]) =>
        values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
      return {
        list: median(samples.map((item) => item.list)),
        subgraph: median(samples.map((item) => item.subgraph)),
      };
    }

    const before = await measure();
    expect(before.list).toBeLessThan(2_000);
    expect(before.subgraph).toBeLessThan(2_000);

    await seedLargeTree({
      organizationId: second.organizationId,
      projectId: second.projectId,
      personCount: 20_000,
    });

    const after = await measure();
    expect(after.list).toBeLessThanOrEqual(before.list * 1.1);
    expect(after.subgraph).toBeLessThanOrEqual(before.subgraph * 1.1);
  }, 600_000);
});
