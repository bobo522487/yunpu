import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as shared from "../packages/shared/src/index.ts";

const require = createRequire(
  new URL("../packages/shared/package.json", import.meta.url),
);
const { z } = require("zod") as typeof import("zod");

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const mounts: { file: string; prefix: string }[] = [
  { file: "apps/api/src/modules/auth/router.ts", prefix: "/api/v1/auth" },
  { file: "apps/api/src/modules/account/router.ts", prefix: "/api/v1" },
  { file: "apps/api/src/modules/organization/router.ts", prefix: "/api/v1" },
  { file: "apps/api/src/modules/project/router.ts", prefix: "/api/v1" },
  { file: "apps/api/src/modules/person/router.ts", prefix: "/api/v1" },
  { file: "apps/api/src/media.ts", prefix: "" },
];

const routePattern =
  /(?:Router|media)\.(get|post|patch|put|delete)\(\s*["']([^"']+)["']/g;

function toOpenApiPath(path: string): string {
  return path
    .replace(/:([A-Za-z0-9_]+)/g, "{$1}")
    .replace(/\/\*$/, "/{path}");
}

function joinRoute(prefix: string, route: string): string {
  if (route.startsWith("/api/")) return route;
  return `${prefix}${route.startsWith("/") ? route : `/${route}`}`;
}

async function collectRoutes(): Promise<
  { method: string; path: string; source: string }[]
> {
  const found: { method: string; path: string; source: string }[] = [
    { method: "get", path: "/api/health", source: "apps/api/src/app.ts" },
    { method: "get", path: "/api/ready", source: "apps/api/src/app.ts" },
  ];

  for (const mount of mounts) {
    const text = await readFile(join(repoRoot, mount.file), "utf8");
    for (const match of text.matchAll(routePattern)) {
      const method = match[1];
      const route = match[2];
      if (!method || !route) continue;
      found.push({
        method,
        path: toOpenApiPath(joinRoute(mount.prefix, route)),
        source: mount.file,
      });
    }
  }

  found.sort((a, b) =>
    a.path === b.path ? a.method.localeCompare(b.method) : a.path.localeCompare(b.path),
  );
  return found;
}

function collectSchemas(): Record<string, unknown> {
  const schemas: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(shared)) {
    if (!(value instanceof z.ZodType)) continue;
    schemas[name] = z.toJSONSchema(value);
  }
  return schemas;
}

const routes = await collectRoutes();
const schemas = collectSchemas();
const paths: Record<string, Record<string, unknown>> = {};

for (const route of routes) {
  const operation = {
    operationId: `${route.method}_${route.path.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "")}`,
    responses: {
      "200": {
        description: "JSON envelope `{ ok: true, ... }` or probe payload",
      },
    },
    "x-source": route.source,
  };
  const existing = paths[route.path] ?? {};
  existing[route.method] = operation;
  paths[route.path] = existing;
}

const document = {
  openapi: "3.1.0",
  info: {
    title: "Yunpu API",
    version: "0.0.0",
    description:
      "Generated from Hono route declarations and @yunpu/shared Zod schemas. Regenerate with pnpm contract:export. This file is the read-only contract for the separate yunpu-web repository.",
  },
  paths,
  components: { schemas },
};

const output = join(repoRoot, "contracts/openapi.json");
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(document, null, 2)}\n`);
console.log(
  `wrote ${output} (${routes.length} routes, ${Object.keys(schemas).length} schemas)`,
);
