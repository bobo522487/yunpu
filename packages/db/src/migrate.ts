import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const migrationsDir = fileURLToPath(new URL("../migrations", import.meta.url));

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

async function main(): Promise<void> {
  const env = requestedEnv(process.argv);
  await loadEnvFile(env);

  const connectionString = process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("MIGRATE_DATABASE_URL or DATABASE_URL is required for migrations");
  }

  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(
      "CREATE TABLE IF NOT EXISTS public.schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );

    const files = (await readdir(migrationsDir))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const already = await client.query<{ version: string }>(
        "SELECT version FROM public.schema_migrations WHERE version = $1",
        [file],
      );
      if (already.rowCount && already.rowCount > 0) continue;

      const sql = await readFile(join(migrationsDir, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO public.schema_migrations (version) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`applied ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
