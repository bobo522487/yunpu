import { Client } from "pg";
import { afterAll, expect, test } from "vitest";
import { config } from "../../apps/api/src/config";
import {
  businessPool,
  withTenantTransaction,
} from "../../apps/api/src/db/with-tenant-transaction";
import { createDb, PG_OPTIONS } from "../../packages/db/src/client";

afterAll(async () => {
  await businessPool.end();
});

test("every connection created by createDb has the three server-side timeouts", async () => {
  const { db, pool } = createDb(config().DATABASE_URL);
  try {
    for (const [q, want] of [
      ["SHOW lock_timeout", "3s"],
      ["SHOW statement_timeout", "30s"],
      ["SHOW idle_in_transaction_session_timeout", "1min"],
    ] as const) {
      const r = await db.execute(q);
      expect(Object.values(r.rows[0] as Record<string, string>)[0]).toBe(want);
    }
  } finally {
    await pool.end();
  }
});

test("a bare Client without PG_OPTIONS has no lock timeout (control)", async () => {
  const client = new Client({ connectionString: config().DATABASE_URL });
  await client.connect();
  try {
    const r = await client.query("SHOW lock_timeout");
    expect(Object.values(r.rows[0] as Record<string, string>)[0]).toBe("0");
  } finally {
    await client.end();
  }
});

test("SET LOCAL does not leak across pooled users", async () => {
  const u1 = "00000000-0000-0000-0000-000000000001";
  const u2 = "00000000-0000-0000-0000-000000000002";
  const read = (id: string) =>
    withTenantTransaction(
      { userId: id },
      async (db) =>
        (await db.execute("select app.current_user_id() as uid")).rows[0] as {
          uid: string;
        },
    );
  expect((await read(u1)).uid).toBe(u1);
  expect((await read(u2)).uid).toBe(u2);
  expect((await read(u1)).uid).toBe(u1);
  // businessPool.options 是 pg Pool 的配置对象，字符串在 .options.options。
  expect((businessPool.options as { options?: string }).options).toBe(
    PG_OPTIONS,
  );
});
