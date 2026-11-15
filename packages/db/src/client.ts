import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// The only executor for the three mandated server-side timeouts. `pg` passes
// this to the server as startup options; PGOPTIONS in the environment is not
// reliable because the app starts under `env -i` (scripts/env.sh:243-244).
export const PG_OPTIONS =
  "-c lock_timeout=3000 -c statement_timeout=30000 -c idle_in_transaction_session_timeout=60000";

export function createDb(connectionString: string) {
  const pool = new Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 5000,
    options: PG_OPTIONS,
  });
  return {
    pool,
    db: drizzle(pool, { schema }),
  };
}

export type Database = ReturnType<typeof createDb>["db"];
export type DatabasePool = ReturnType<typeof createDb>["pool"];
