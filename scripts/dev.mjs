import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { loadEnvFile } from "../packages/db/src/load-env.ts";

function resolveApiPort(): string {
  if (process.env.PORT?.trim()) {
    return process.env.PORT.trim();
  }
  try {
    const fileEnv = loadEnvFile(resolve(process.cwd(), ".env"));
    if (fileEnv.PORT?.trim()) {
      return fileEnv.PORT.trim();
    }
  } catch {
    // Fall back to default port when .env is absent.
  }
  return "3001";
}

const apiPort = resolveApiPort();
const apiOrigin = `http://127.0.0.1:${apiPort}`;

const children = [
  spawn("pnpm", ["run", "start:api"], {
    stdio: "inherit",
    env: process.env,
  }),
  spawn("pnpm", ["--filter", "@yunpu/web", "run", "dev"], {
    stdio: "inherit",
    env: {
      ...process.env,
      VITE_API_PROXY_TARGET:
        process.env.VITE_API_PROXY_TARGET?.trim() || apiOrigin,
    },
  }),
];

let exiting = false;

function shutdown(signal, exitCode = 0) {
  if (exiting) return;
  exiting = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
  setTimeout(() => process.exit(exitCode), 1500).unref();
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => shutdown(signal, 0));
}

for (const child of children) {
  child.on("exit", (code, signal) => {
    if (exiting) return;
    const exitCode = code ?? (signal ? 1 : 0);
    shutdown("SIGTERM", exitCode);
    process.exitCode = exitCode;
  });
}
