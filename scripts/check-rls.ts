import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "pg";
import { PG_OPTIONS } from "../packages/db/src/client.ts";

function requestedEnv(argv: string[]): string {
  const index = argv.indexOf("--env");
  const value = index >= 0 ? argv[index + 1] : undefined;
  return value === "test" || value === "development" ? value : "test";
}

async function loadEnvFile(env: string): Promise<void> {
  const path = join(process.cwd(), `.env.${env}`);
  try {
    const text = await readFile(path, "utf8");
    for (const rawLine of text.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      const value = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // Missing env file is fine when the caller exported variables directly.
  }
}

type TableFlagRow = {
  relname: string;
  relrowsecurity: boolean;
  relforcerowsecurity: boolean;
};

async function main(): Promise<void> {
  const env = requestedEnv(process.argv);
  await loadEnvFile(env);

  const connectionString = process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("MIGRATE_DATABASE_URL or DATABASE_URL is required for the RLS check");
  }

  const client = new Client({ connectionString, options: PG_OPTIONS });
  await client.connect();
  try {
    const result = await client.query<TableFlagRow>(`
      SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
      FROM pg_class AS c
      JOIN pg_namespace AS n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind IN ('r', 'p')
        AND c.relname <> 'schema_migrations'
        AND NOT starts_with(c.relname, '__drizzle_migrations')
      ORDER BY c.relname
    `);

    const rows = result.rows;
    let failed = 0;
    for (const row of rows) {
      const missing: string[] = [];
      if (!row.relrowsecurity) missing.push("ENABLE ROW LEVEL SECURITY");
      if (!row.relforcerowsecurity) missing.push("FORCE ROW LEVEL SECURITY");
      if (missing.length > 0) {
        failed += 1;
        console.error(`public.${row.relname}: missing ${missing.join(", ")}`);
      }
    }

    if (failed > 0) {
      console.error(`RLS check failed: ${failed} of ${rows.length} tables lack required flags`);
      process.exitCode = 1;
      return;
    }

    console.log(`RLS check passed: ${rows.length} tables have RLS enabled and forced`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
