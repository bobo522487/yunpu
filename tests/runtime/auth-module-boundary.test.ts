import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { expect, test } from "vitest";

const apiSrc = resolve(__dirname, "../../apps/api/src");
const legacyAuthDir = join(apiSrc, "auth");
const modularAuthIndex = join(apiSrc, "modules/auth/index.ts");

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === "dist") continue;
      out.push(...walkTsFiles(full));
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

test("legacy apps/api/src/auth is gone or only re-exports modules/auth", () => {
  expect(existsSync(modularAuthIndex)).toBe(true);

  if (!existsSync(legacyAuthDir)) {
    return;
  }

  // If a leftover directory remains, every .ts file must only re-export
  // from modules/auth (no parallel better-auth / provisioning bodies).
  const leftovers = walkTsFiles(legacyAuthDir);
  expect(leftovers.length).toBeGreaterThan(0);
  for (const file of leftovers) {
    const source = readFileSync(file, "utf8");
    const stripped = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "")
      .trim();
    expect(stripped.length).toBeGreaterThan(0);
    expect(stripped).toMatch(/from\s+["']\.\.\/modules\/auth/);
    expect(stripped).not.toMatch(/betterAuth\s*\(/);
    expect(stripped).not.toMatch(/createDb\s*\(/);
  }
});

test("non-module api files do not import the removed legacy auth package path", () => {
  const offenders: string[] = [];
  for (const file of walkTsFiles(apiSrc)) {
    const rel = relative(apiSrc, file).replace(/\\/g, "/");
    if (rel.startsWith("modules/")) continue;
    if (rel.startsWith("auth/")) continue;

    const source = readFileSync(file, "utf8");
    // Legacy package was `../auth` or `./auth` resolving to src/auth.
    // After merge, callers must use `./modules/auth` (or deeper).
    const legacyHits = [
      ...source.matchAll(/from\s+["'](\.\.\/)+auth(?:\/[^"']*)?["']/g),
      ...source.matchAll(/from\s+["']\.\/auth(?:\/[^"']*)?["']/g),
      ...source.matchAll(/import\(["'](\.\.\/)+auth(?:\/[^"']*)?["']\)/g),
    ];
    for (const match of legacyHits) {
      const spec = match[0];
      if (spec.includes("modules/auth")) continue;
      offenders.push(`${rel}: ${spec}`);
    }
  }
  expect(offenders).toEqual([]);
});
