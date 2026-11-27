import { createDb, schema } from "@yunpu/db";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { config } from "../config";
import { extractDatabaseError, hasErrorMessagePattern } from "../lib/errors";

const business = createDb(config().DATABASE_URL);

export const businessPool = business.pool;

export type TxDatabase = NodePgDatabase<typeof schema>;

export type TenantTxOptions = {
  userId: string;
  readOnly?: boolean;
};

type TxPhase = "setup" | "body" | "commit";

/** Transient codes eligible for withTenantTransaction retry (max 3 attempts). */
export const RETRYABLE_ERROR_CODES = ["ECONNRESET", "40001", "40P01"] as const;

const RETRYABLE = new Set<string>(RETRYABLE_ERROR_CODES);
const SERIALIZATION_OR_DEADLOCK = new Set(["40001", "40P01"]);

/** SQLSTATEs and driver codes that mean the socket/session itself is untrustworthy. */
const CONNECTION_LEVEL_ERROR_CODES = new Set([
  "08000",
  "08003",
  "08006",
  "57P01",
  "57P02",
  "57P03",
  "ECONNRESET",
  "ECONNREFUSED",
  "EPIPE",
  "ETIMEDOUT",
]);

function isEconnReset(error: unknown): boolean {
  return (
    extractDatabaseError(error)?.code === "ECONNRESET" ||
    hasErrorMessagePattern(error, /ECONNRESET/i)
  );
}

/** Exported for unit tests / classification docs (contracts/runtime-hardening.md §2). */
export function isRetryableTenantError(error: unknown): boolean {
  const code = extractDatabaseError(error)?.code;
  if (code && RETRYABLE.has(code)) return true;
  return hasErrorMessagePattern(error, /ECONNRESET/i);
}

/** A connection-level error must never be handed back to the pool. */
export function isConnectionLevelError(error: unknown): boolean {
  const code = extractDatabaseError(error)?.code;
  if (code && CONNECTION_LEVEL_ERROR_CODES.has(code)) return true;
  return hasErrorMessagePattern(error, /ECONNRESET/i);
}

/** Unique-key conflicts must surface as 409 and must not be retried. */
export function isNonRetryableConflictError(error: unknown): boolean {
  return extractDatabaseError(error)?.code === "23505";
}

function canRetryAtPhase(
  error: unknown,
  phase: TxPhase,
  readOnly: boolean,
): boolean {
  if (isNonRetryableConflictError(error)) return false;
  const code = extractDatabaseError(error)?.code;
  if (code && SERIALIZATION_OR_DEADLOCK.has(code)) return true;
  if (isEconnReset(error)) {
    return phase === "setup" || readOnly;
  }
  return isRetryableTenantError(error);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function runOnce<T>(
  options: TenantTxOptions,
  fn: (db: TxDatabase) => Promise<T>,
  onPhase: (phase: TxPhase) => void,
): Promise<T> {
  onPhase("setup");
  const client = await business.pool.connect();
  let destroy = false;
  try {
    // No parameters -> pg uses the simple query protocol: BEGIN and SET LOCAL
    // ROLE travel in one round trip. Both statements are transaction-scoped.
    await client.query("BEGIN; SET LOCAL ROLE genealogy_app");

    // Setting the user GUC and asserting the effective role share one round trip.
    // app.current_org_id was never read by any RLS policy and is intentionally gone.
    const who = await client.query<{ role: string }>(
      "SELECT set_config('app.user_id', $1, true), current_user AS role",
      [options.userId],
    );
    if (who.rows[0]?.role !== "genealogy_app") {
      destroy = true;
      throw new Error("database role assertion failed: expected genealogy_app");
    }

    const tx = drizzle(client, { schema });
    onPhase("body");
    const result = await fn(tx);
    onPhase("commit");
    await client.query("COMMIT");
    return result;
  } catch (error) {
    if (isConnectionLevelError(error)) destroy = true;
    try {
      await client.query("ROLLBACK");
    } catch {
      // Keep the original business/SQL error; a failed ROLLBACK means this
      // session may still be inside a broken transaction.
      destroy = true;
    }
    throw error;
  } finally {
    client.release(destroy);
  }
}

export async function withTenantTransaction<T>(
  options: TenantTxOptions,
  fn: (db: TxDatabase) => Promise<T>,
): Promise<T> {
  let attempt = 0;
  let lastError: unknown;
  const readOnly = options.readOnly ?? false;
  while (attempt < 3) {
    let phase: TxPhase = "setup";
    try {
      return await runOnce(options, fn, (next) => {
        phase = next;
      });
    } catch (error) {
      lastError = error;
      if (!canRetryAtPhase(error, phase, readOnly) || attempt === 2) {
        throw error;
      }
      await sleep(25 * 2 ** attempt);
      attempt += 1;
    }
  }
  throw lastError;
}
