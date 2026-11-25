import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

function parseEnvEntries(text: string): [string, string][] {
  const entries: [string, string][] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line
      .slice(eq + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    entries.push([key, value]);
  }
  return entries;
}

/** Read an env file into a record; throws when the file cannot be read. */
export function loadEnvFile(path: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of parseEnvEntries(readFileSync(path, "utf8"))) {
    env[key] = value;
  }
  return env;
}

/** Load `.env.<env>` from cwd into process.env, keeping exported values. */
export async function loadEnvFileIntoProcess(env: string): Promise<void> {
  try {
    const entries = parseEnvEntries(
      await readFile(join(process.cwd(), `.env.${env}`), "utf8"),
    );
    for (const [key, value] of entries) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // Missing env file is fine when the caller exported variables directly.
  }
}
