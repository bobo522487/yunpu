import { createDb, schema } from "@yunpu/db";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { config } from "../config";

const business = createDb(config().DATABASE_URL);

export const businessPool = business.pool;

export type TxDatabase = NodePgDatabase<typeof schema>;

export type TenantTxOptions = {
  userId: string;
};

/** Transient codes eligible for withTenantTransaction retry (max 3 attempts). */
export const RETRYABLE_ERROR_CODES = ["ECONNRESET", "40001", "40P01"] as const;

const RETRYABLE = new Set<string>(RETRYABLE_ERROR_CODES);

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

function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

/** Exported for unit tests / classification docs (contracts/runtime-hardening.md §2). */
export function isRetryableTenantError(error: unknown): boolean {
  const code = errorCode(error);
  if (code && RETRYABLE.has(code)) return true;
  if (error instanceof Error && /ECONNRESET/i.test(error.message)) return true;
  return false;
}

/** A connection-level error must never be handed back to the pool. */
export function isConnectionLevelError(error: unknown): boolean {
  const code = errorCode(error);
  if (code && CONNECTION_LEVEL_ERROR_CODES.has(code)) return true;
  return error instanceof Error && /ECONNRESET/i.test(error.message);
}

/** Unique-key conflicts must surface as 409 and must not be retried. */
export function isNonRetryableConflictError(error: unknown): boolean {
  return errorCode(error) === "23505";
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function runOnce<T>(
  options: TenantTxOptions,
  fn: (db: TxDatabase) => Promise<T>,
): Promise<T> {
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
    const result = await fn(tx);
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
  while (attempt < 3) {
    try {
      return await runOnce(options, fn);
    } catch (error) {
      lastError = error;
      if (
        isNonRetryableConflictError(error) ||
        !isRetryableTenantError(error) ||
        attempt === 2
      ) {
        throw error;
      }
      await sleep(25 * 2 ** attempt);
      attempt += 1;
    }
  }
  throw lastError;
}
