import { createDb, schema } from "@yunpu/db";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { config } from "../config";

const business = createDb(config().DATABASE_URL);

export const businessPool = business.pool;

export type TxDatabase = NodePgDatabase<typeof schema>;

export type TenantTxOptions = {
  userId: string;
  orgId?: string;
};

/** Transient codes eligible for withTenantTransaction retry (max 3 attempts). */
export const RETRYABLE_ERROR_CODES = ["ECONNRESET", "40001", "40P01"] as const;

const RETRYABLE = new Set<string>(RETRYABLE_ERROR_CODES);

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
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE genealogy_app");
    await client.query("SELECT set_config('app.user_id', $1, true)", [
      options.userId,
    ]);
    if (options.orgId) {
      await client.query("SELECT set_config('app.current_org_id', $1, true)", [
        options.orgId,
      ]);
    }

    const who = await client.query<{ current_user: string }>(
      "SELECT current_user",
    );
    if (who.rows[0]?.current_user !== "genealogy_app") {
      throw new Error("database role assertion failed: expected genealogy_app");
    }

    const tx = drizzle(client, { schema });
    const result = await fn(tx);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original business/SQL error (e.g. deferred GX001 on COMMIT).
    }
    throw error;
  } finally {
    client.release();
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
