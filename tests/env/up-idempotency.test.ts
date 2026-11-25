import { spawnSync } from "node:child_process";
import { expect, test } from "vitest";

const envsh = new URL("../../scripts/env.sh", import.meta.url).pathname;
const devReady =
  spawnSync("sh", [envsh, "ready", "development"], {
    stdio: "ignore",
    timeout: 15_000,
  }).status === 0;

// `up` must be idempotent: when the development stack already answers ready,
// its published ports are self-held even if the container runtime cannot be
// queried. Refusing to start then produces a misleading port-conflict error.
test.skipIf(!devReady)(
  "up development is idempotent while ready",
  () => {
    const up = spawnSync("sh", [envsh, "up", "development"], {
      stdio: "ignore",
      timeout: 240_000,
    });
    expect(up.status).toBe(0);
  },
  240_000,
);
