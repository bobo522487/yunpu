import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/** Serialize a timestamptz column as a UTC ISO-8601 string (Drizzle SQL expr). */
export function isoTimestamp(column: AnyPgColumn) {
  return sql<string>`to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
}

/** Serialize a nullable timestamptz column as a UTC ISO-8601 string or null. */
export function nullableIsoTimestamp(column: AnyPgColumn) {
  return sql<
    string | null
  >`to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
}
