import { createDb, schema } from "@yunpu/db";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { config } from "../config";

const business = createDb(config().DATABASE_URL);

export const businessPool = business.pool;

export type TxDatabase = NodePgDatabase<typeof schema>;

export async function withUser<T>(
  userId: string,
  fn: (db: TxDatabase) => Promise<T>,
): Promise<T> {
  const client = await business.pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE genealogy_app");
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);

    const who = await client.query<{ current_user: string }>("SELECT current_user");
    if (who.rows[0]?.current_user !== "genealogy_app") {
      throw new Error("database role assertion failed: expected genealogy_app");
    }

    const tx = drizzle(client, { schema });
    const result = await fn(tx);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
