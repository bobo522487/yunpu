import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export function createDb(connectionString: string) {
  const pool = new Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 5000,
  });
  return {
    pool,
    db: drizzle(pool, { schema }),
  };
}

export type Database = ReturnType<typeof createDb>["db"];
export type DatabasePool = ReturnType<typeof createDb>["pool"];
