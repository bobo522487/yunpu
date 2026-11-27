import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as shared from "../packages/shared/src/index.ts";
import {
  OPENAPI_OPERATIONS,
  OPENAPI_SCHEMAS,
} from "../apps/api/src/openapi/operations.ts";

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

function declaredRoutes(): Set<string> {
  const found = new Set<string>();
  for (const mount of mounts) {
    const text = readFileSync(join(repoRoot, mount.file), "utf8");
    for (const match of text.matchAll(routePattern)) {
      const method = match[1];
      const route = match[2];
      if (!method || !route) continue;
      const full = route.startsWith("/api/")
        ? route
        : `${mount.prefix}${route.startsWith("/") ? route : `/${route}`}`;
      found.add(`${method}:${full}`);
    }
  }
  found.add("get:/api/health");
  found.add("get:/api/ready");
  return found;
}

function fullRoute(operation: (typeof OPENAPI_OPERATIONS)[number]): string {
  if (operation.route.startsWith("/api/")) return operation.route;
  const mount = mounts.find((entry) => entry.file === operation.source);
  if (!mount) return operation.route;
  return `${mount.prefix}${operation.route.startsWith("/") ? operation.route : `/${operation.route}`}`;
}

const declared = declaredRoutes();
const documented = new Set(
  OPENAPI_OPERATIONS.map(
    (operation) => `${operation.method}:${fullRoute(operation)}`,
  ),
);
const missing = [...declared].filter((key) => !documented.has(key));
const stale = [...documented].filter((key) => !declared.has(key));
if (missing.length > 0 || stale.length > 0) {
  throw new Error(
    `OpenAPI contract drift: missing=${missing.join(", ") || "none"}; stale=${stale.join(", ") || "none"}`,
  );
}

function jsonSchema(schema: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema) as Record<string, unknown>;
}

function parametersFor(schema: z.ZodType | undefined, where: "path" | "query") {
  if (!schema) return [];
  const encoded = jsonSchema(schema);
  const properties = (encoded.properties ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const required = new Set((encoded.required ?? []) as string[]);
  return Object.entries(properties).map(([name, value]) => ({
    name,
    in: where,
    required: where === "path" ? true : required.has(name),
    schema: value,
  }));
}

const schemas: Record<string, unknown> = {};
for (const [name, value] of Object.entries(shared)) {
  if (value instanceof z.ZodType) schemas[name] = jsonSchema(value);
}
for (const [name, schema] of Object.entries(OPENAPI_SCHEMAS)) {
  schemas[name] = jsonSchema(schema);
}

const paths: Record<string, Record<string, unknown>> = {};
for (const operation of OPENAPI_OPERATIONS) {
  const encodedSuccess = jsonSchema(operation.success);
  const contentType = operation.successContentType ?? "application/json";
  const responses: Record<string, unknown> = {
    [String(operation.successStatus)]: {
      description: operation.summary,
      content: {
        [contentType]: { schema: encodedSuccess },
      },
    },
  };
  if (operation.errors) {
    responses["400"] = {
      description: "校验或业务错误",
      content: {
        "application/json": { schema: jsonSchema(operation.errors) },
      },
    };
  }

  const entry: Record<string, unknown> = {
    operationId: `${operation.method}_${operation.path.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "")}`,
    summary: operation.summary,
    parameters: [
      ...parametersFor(operation.params, "path"),
      ...parametersFor(operation.query, "query"),
    ],
    responses,
    "x-source": operation.source,
  };
  if (operation.body) {
    entry.requestBody = {
      required: true,
      content: {
        "application/json": { schema: jsonSchema(operation.body) },
      },
    };
  }
  const existing = paths[operation.path] ?? {};
  existing[operation.method] = entry;
  paths[operation.path] = existing;
}

const document = {
  openapi: "3.1.0",
  info: {
    title: "Yunpu API",
    version: "0.0.0",
    description:
      "Generated from the declarative operation registry and @yunpu/shared Zod schemas. Regenerate with pnpm contract:export. This file is the read-only contract for the separate yunpu-web repository.",
  },
  paths,
  components: { schemas },
};

const output = join(repoRoot, "contracts/openapi.json");
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(document, null, 2)}\n`);
console.log(
  `wrote ${output} (${OPENAPI_OPERATIONS.length} routes, ${Object.keys(schemas).length} schemas)`,
);
