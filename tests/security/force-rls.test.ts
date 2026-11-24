import { Client } from "pg";
import { expect, test } from "vitest";
import { PG_OPTIONS } from "../../packages/db/src/client";

/**
 * Explicit whitelist for public tables that intentionally omit FORCE RLS.
 * Add a justification comment when extending.
 */
const FORCE_RLS_WHITELIST = [
  "__drizzle_migrations", // Drizzle migration journal; not tenant data
  "schema_migrations", // Hand-rolled migrate.ts journal; not tenant data
] as const;

const adminUrl =
  process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL ?? "";

test("all public business tables ENABLE + FORCE row level security", async () => {
  expect(adminUrl).toBeTruthy();
  const client = new Client({
    connectionString: adminUrl,
    options: PG_OPTIONS,
  });
  await client.connect();
  try {
    const result = await client.query<{ relname: string }>(
      `
      SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND c.relname <> ALL($1::text[])
        AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity)
      ORDER BY c.relname
      `,
      [FORCE_RLS_WHITELIST],
    );
    expect(result.rows.map((row) => row.relname)).toEqual([]);
  } finally {
    await client.end();
  }
});
