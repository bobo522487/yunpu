import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  OPENAPI_OPERATIONS,
  OPENAPI_SCHEMAS,
} from "../apps/api/src/openapi/operations.ts";
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
  { file: "apps/api/src/modules/folder/router.ts", prefix: "/api/v1" },
  { file: "apps/api/src/modules/lineage/router.ts", prefix: "/api/v1" },
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

// Register all named schemas from @yunpu/shared and OPENAPI_SCHEMAS so nested
// and operation-level usages emit `#/components/schemas/<Name>` $refs instead
// of repeating multi-kilobyte inline definitions.
const registry = z.registry<{ id: string }>();
const schemaToId = new Map<z.ZodType, string>();
const aliases: Array<[alias: string, target: string]> = [];

function registerNamedSchemas(entries: Iterable<[string, unknown]>) {
  for (const [name, value] of entries) {
    if (!(value instanceof z.ZodType)) continue;
    const existing = schemaToId.get(value);
    if (existing) {
      if (existing !== name) aliases.push([name, existing]);
      continue;
    }
    schemaToId.set(value, name);
    registry.add(value, { id: name });
  }
}

registerNamedSchemas(Object.entries(shared));
registerNamedSchemas(Object.entries(OPENAPI_SCHEMAS));

const uuidJsonSchema = z.toJSONSchema(z.uuid()) as Record<string, unknown>;
delete uuidJsonSchema.$schema;
const isoDateTimeJsonSchema = z.toJSONSchema(z.iso.datetime()) as Record<
  string,
  unknown
>;
delete isoDateTimeJsonSchema.$schema;
const uuidSignature = JSON.stringify(uuidJsonSchema);
const isoDateTimeSignature = JSON.stringify(isoDateTimeJsonSchema);

const exportedRegistry = z.toJSONSchema(registry, {
  uri: (id) => `#/components/schemas/${id}`,
});

const schemas: Record<string, unknown> = {};
if (!schemaToId.has(z.uuid()) && !("Uuid" in exportedRegistry.schemas)) {
  schemas.Uuid = uuidJsonSchema;
}
if (!("IsoDateTime" in exportedRegistry.schemas)) {
  schemas.IsoDateTime = isoDateTimeJsonSchema;
}
for (const [name, raw] of Object.entries(exportedRegistry.schemas)) {
  if (name === "__shared") continue;
  const copy = { ...(raw as Record<string, unknown>) };
  delete copy.$schema;
  delete copy.$id;
  schemas[name] = copy;
}
for (const [alias, target] of aliases) {
  schemas[alias] = { $ref: `#/components/schemas/${target}` };
}

const knownIds = new Set(Object.keys(schemas));

function rewriteSchemaRefs(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(rewriteSchemaRefs);
  }
  if (node && typeof node === "object") {
    const serialized = JSON.stringify(node);
    if ("Uuid" in schemas && serialized === uuidSignature) {
      return { $ref: "#/components/schemas/Uuid" };
    }
    if ("IsoDateTime" in schemas && serialized === isoDateTimeSignature) {
      return { $ref: "#/components/schemas/IsoDateTime" };
    }
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      node as Record<string, unknown>,
    )) {
      if (
        key === "$ref" &&
        typeof value === "string" &&
        value.startsWith("#/$defs/")
      ) {
        const refId = value.slice("#/$defs/".length);
        out[key] = knownIds.has(refId) ? `#/components/schemas/${refId}` : value;
      } else {
        out[key] = rewriteSchemaRefs(value);
      }
    }
    return out;
  }
  return node;
}

for (const [name, schema] of Object.entries(schemas)) {
  if (name === "Uuid" || name === "IsoDateTime") continue;
  schemas[name] = rewriteSchemaRefs(schema);
}

function toOpenApiSchema(schema: z.ZodType): unknown {
  const directId = schemaToId.get(schema);
  if (directId) {
    return { $ref: `#/components/schemas/${directId}` };
  }
  const encoded = z.toJSONSchema(schema, { metadata: registry }) as Record<
    string,
    unknown
  >;
  delete encoded.$schema;
  if (encoded.$defs && typeof encoded.$defs === "object") {
    const remainingDefs: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      encoded.$defs as Record<string, unknown>,
    )) {
      if (!knownIds.has(key)) {
        remainingDefs[key] = rewriteSchemaRefs(value);
      }
    }
    if (Object.keys(remainingDefs).length > 0) {
      encoded.$defs = remainingDefs;
    } else {
      delete encoded.$defs;
    }
  }
  return rewriteSchemaRefs(encoded);
}

function parametersFor(schema: z.ZodType | undefined, where: "path" | "query") {
  if (!schema) return [];
  const encoded = z.toJSONSchema(schema) as Record<string, unknown>;
  const properties = (encoded.properties ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const required = new Set((encoded.required ?? []) as string[]);
  return Object.entries(properties).map(([name, value]) => ({
    name,
    in: where,
    required: where === "path" ? true : required.has(name),
    schema: rewriteSchemaRefs(value),
  }));
}

function isFlatLeaf(value: unknown): boolean {
  if (value === null || typeof value !== "object") return true;
  if (Array.isArray(value)) {
    return value.every((item) => item === null || typeof item !== "object");
  }
  return Object.values(value as Record<string, unknown>).every((item) => {
    if (item === null || typeof item !== "object") return true;
    if (Array.isArray(item)) {
      return item.every((el) => el === null || typeof el !== "object");
    }
    return false;
  });
}

function formatCompactReadableJson(value: unknown, indent = 0): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  const compact = JSON.stringify(value);
  if (compact.length <= 100 || isFlatLeaf(value)) {
    return compact;
  }
  const pad = "  ".repeat(indent);
  const childPad = "  ".repeat(indent + 1);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return `[\n${value
      .map((item) => `${childPad}${formatCompactReadableJson(item, indent + 1)}`)
      .join(",\n")}\n${pad}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([, item]) => item !== undefined,
  );
  if (entries.length === 0) return "{}";
  return `{\n${entries
    .map(
      ([key, item]) =>
        `${childPad}${JSON.stringify(key)}: ${formatCompactReadableJson(item, indent + 1)}`,
    )
    .join(",\n")}\n${pad}}`;
}

const paths: Record<string, Record<string, unknown>> = {};
for (const operation of OPENAPI_OPERATIONS) {
  const contentType = operation.successContentType ?? "application/json";
  const responses: Record<string, unknown> = {
    [String(operation.successStatus)]: {
      description: operation.summary,
      content: {
        [contentType]: { schema: toOpenApiSchema(operation.success) },
      },
    },
  };
  if (operation.errors) {
    responses["400"] = {
      description: "校验或业务错误",
      content: {
        "application/json": { schema: toOpenApiSchema(operation.errors) },
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
        "application/json": { schema: toOpenApiSchema(operation.body) },
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
await writeFile(output, `${formatCompactReadableJson(document)}\n`);
console.log(
  `wrote ${output} (${OPENAPI_OPERATIONS.length} routes, ${Object.keys(schemas).length} schemas)`,
);
