import { Client } from "pg";
import {
  type MediaGcReport,
  runMediaReconciliationGc,
  toProjectMediaObjectKey,
} from "../apps/api/src/modules/project/media-gc";
import { deleteObjects, initStorage, listObjects } from "../apps/api/src/storage";
import { PG_OPTIONS } from "../packages/db/src/client";
import { loadEnvFileIntoProcess } from "../packages/db/src/load-env";

export interface GcCliOptions {
  dryRun: boolean;
  gracePeriodMs: number;
  prefix: string;
  env?: "test" | "development";
  now?: Date;
  help: boolean;
}

const DEFAULT_GRACE_HOURS = 24;

function readOptionValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

export function parseGcArgs(
  argv: string[],
  envVars: NodeJS.ProcessEnv = process.env,
): GcCliOptions {
  let dryRun = false;
  let prefix = "projects/";
  let env: "test" | "development" | undefined;
  let now: Date | undefined;
  let help = false;
  let graceHoursRaw = envVars.MEDIA_GC_GRACE_HOURS;
  let graceMsRaw: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--prefix") {
      prefix = readOptionValue(argv, i, "--prefix");
      i += 1;
    } else if (arg === "--grace-hours") {
      graceHoursRaw = readOptionValue(argv, i, "--grace-hours");
      i += 1;
    } else if (arg === "--grace-ms") {
      graceMsRaw = readOptionValue(argv, i, "--grace-ms");
      i += 1;
    } else if (arg === "--env") {
      const value = readOptionValue(argv, i, "--env");
      if (value !== "test" && value !== "development") {
        throw new Error(`--env must be "test" or "development", got "${value}"`);
      }
      env = value;
      i += 1;
    } else if (arg === "--now") {
      const parsed = new Date(readOptionValue(argv, i, "--now"));
      if (Number.isNaN(parsed.getTime())) {
        throw new Error("--now must be a valid ISO timestamp");
      }
      now = parsed;
      i += 1;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }

  let gracePeriodMs: number;
  if (graceMsRaw !== undefined) {
    const ms = Number(graceMsRaw);
    if (!Number.isFinite(ms) || ms < 0) {
      throw new Error(`invalid --grace-ms: ${graceMsRaw}`);
    }
    gracePeriodMs = ms;
  } else {
    const hours =
      graceHoursRaw !== undefined ? Number(graceHoursRaw) : DEFAULT_GRACE_HOURS;
    if (!Number.isFinite(hours) || hours < 0) {
      throw new Error(`invalid grace hours: ${String(graceHoursRaw)}`);
    }
    gracePeriodMs = hours * 3_600_000;
  }

  if (!prefix.startsWith("projects/")) {
    throw new Error(`--prefix must start with "projects/", got "${prefix}"`);
  }

  return { dryRun, gracePeriodMs, prefix, env, now, help };
}

/**
 * Query all referenced project media object keys across all tenants.
 * Requires a privileged/BYPASSRLS role so RLS cannot hide tenant rows and
 * falsely mark live portraits as orphaned.
 */
export async function queryAllReferencedMediaKeys(
  connectionString: string,
): Promise<Set<string>> {
  const client = new Client({ connectionString, options: PG_OPTIONS });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    try {
      const roleCheck = await client.query<{ can_bypass_rls: boolean }>(
        `SELECT (
           current_setting('is_superuser') = 'on'
           OR EXISTS (
             SELECT 1 FROM pg_roles WHERE rolname = current_user AND rolbypassrls
           )
         ) AS can_bypass_rls`,
      );
      if (!roleCheck.rows[0]?.can_bypass_rls) {
        throw new Error(
          "gc-media requires a database role with BYPASSRLS or superuser privileges",
        );
      }

      const result = await client.query<{
        project_id: string;
        avatar_key: string;
      }>(
        `SELECT project_id::text AS project_id, avatar_key
           FROM public.person
          WHERE avatar_key IS NOT NULL AND btrim(avatar_key) <> ''`,
      );
      await client.query("COMMIT");

      const keys = new Set<string>();
      for (const row of result.rows) {
        const key = toProjectMediaObjectKey(row.project_id, row.avatar_key);
        if (key) keys.add(key);
      }
      return keys;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    }
  } finally {
    await client.end();
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`missing required environment variable: ${name}`);
  }
  return value;
}

export async function executeMediaGc(
  options: Omit<GcCliOptions, "help">,
): Promise<MediaGcReport> {
  if (options.env) {
    await loadEnvFileIntoProcess(options.env);
  }

  const connectionString =
    process.env.GC_DATABASE_URL ?? process.env.MIGRATE_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "GC_DATABASE_URL or MIGRATE_DATABASE_URL is required for cross-tenant media reconciliation",
    );
  }

  await initStorage({
    endpoint: requiredEnv("S3_ENDPOINT"),
    bucket: requiredEnv("S3_BUCKET"),
    accessKeyId: requiredEnv("S3_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("S3_SECRET_ACCESS_KEY"),
    region: process.env.S3_REGION || "us-east-1",
  });

  return runMediaReconciliationGc({
    prefix: options.prefix,
    gracePeriodMs: options.gracePeriodMs,
    now: options.now,
    dryRun: options.dryRun,
    listObjects,
    listReferencedKeys: () => queryAllReferencedMediaKeys(connectionString),
    deleteObjects,
  });
}

function printUsage(): void {
  console.log(
    [
      "Usage: pnpm gc:media [--dry-run] [--grace-hours <n>] [--grace-ms <ms>] [--prefix projects/] [--env test|development]",
      "",
      "Options:",
      "  --dry-run          Scan and report orphan candidates without deleting S3 objects",
      "  --grace-hours <n>  Grace period in hours before deleting unreferenced objects (default: 24, or MEDIA_GC_GRACE_HOURS)",
      "  --grace-ms <ms>    Grace period in milliseconds (overrides --grace-hours)",
      "  --prefix <prefix>  S3 key prefix to scan (default: projects/)",
      "  --env <name>       Load .env.<name> before connecting (test | development)",
    ].join("\n"),
  );
}

async function main(): Promise<void> {
  const parsed = parseGcArgs(process.argv.slice(2));
  if (parsed.help) {
    printUsage();
    return;
  }
  const report = await executeMediaGc(parsed);
  console.log(JSON.stringify(report, null, 2));
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
